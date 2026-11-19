import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { DevLogger } from './logger';
import {
  DAILY_CALENDAR_SYNC_HOURS,
  DAILY_CALENDAR_SYNC_SLOTS,
  CALENDAR_SYNC_STATE_KEY,
  SYNC_PAST_DAYS,
  SYNC_FUTURE_DAYS,
  SYNC_CHUNK_DAYS,
  MAX_EVENTS_PER_SYNC_BATCH,
  MAX_IMPORTS_PER_SYNC,
  formatLocalDateKey,
  extractTaskDateKey,
  isDateStrInSyncWindow,
  buildSyncWindowChunks,
  getTaskCalendarFingerprint,
  getDailySyncSlotsForDate,
  getMostRecentDueSyncSlot,
  getNextScheduledSyncTime,
  isScheduledCalendarSyncDue,
} from './calendarSyncSchedule';

export {
  DAILY_CALENDAR_SYNC_HOURS,
  DAILY_CALENDAR_SYNC_SLOTS,
  CALENDAR_SYNC_STATE_KEY,
  SYNC_PAST_DAYS,
  SYNC_FUTURE_DAYS,
  SYNC_CHUNK_DAYS,
  MAX_EVENTS_PER_SYNC_BATCH,
  MAX_IMPORTS_PER_SYNC,
  formatLocalDateKey,
  extractTaskDateKey,
  isDateStrInSyncWindow,
  buildSyncWindowChunks,
  getTaskCalendarFingerprint,
  getDailySyncSlotsForDate,
  getMostRecentDueSyncSlot,
  getNextScheduledSyncTime,
  isScheduledCalendarSyncDue,
};

const TOMBSTONES_STORAGE_KEY = 'calendar_deleted_tombstones';
const TOMBSTONE_TTL_MS = 15 * 60 * 1000; // 15-minute TTL to prevent resurrection
const WRITABLE_ACCESS_LEVELS = new Set(['owner', 'root', 'editor', 'contributor']);

// Strict sequential queue for ALL native expo-calendar calls.
// Prevents concurrent native calls from racing on Android CalendarModule's shared SimpleDateFormat
// and prevents overlapping ContentResolver CursorWindow bursts.
let calendarNativeQueue = Promise.resolve();
export const enqueueCalendarOp = (fn) => {
  const run = calendarNativeQueue.then(fn, fn);
  calendarNativeQueue = run.catch(() => {});
  return run;
};

const sleepMs = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// On Android, passing numeric epoch ms to expo-calendar bypasses CalendarModule's
// unpatched shared SimpleDateFormat.parse() (which is thread-unsafe & locale-sensitive).
// On iOS, keep Date objects as expected by EventKit.
const toNativeCalendarDate = (date) => {
  if (Platform.OS === 'android' && date instanceof Date) {
    return date.getTime();
  }
  return date;
};

const toNativeEventDetails = (details) => {
  if (!details || Platform.OS !== 'android') return details;
  return {
    ...details,
    startDate: toNativeCalendarDate(details.startDate),
    endDate: toNativeCalendarDate(details.endDate),
  };
};

const sanitizeCalendarText = (value, maxLen = 200) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
};

const isValidNativeCalendarId = (id) => {
  if (id === null || id === undefined) return false;
  const str = String(id).trim();
  if (!str) return false;
  if (Platform.OS === 'android') {
    return /^\d+$/.test(str);
  }
  return true;
};

const isCalendarWritable = (cal) => {
  if (!cal || !isValidNativeCalendarId(cal.id)) return false;
  if (cal.allowsModifications === false) return false;
  if (Platform.OS === 'android' && cal.accessLevel) {
    return WRITABLE_ACCESS_LEVELS.has(String(cal.accessLevel).toLowerCase());
  }
  return cal.allowsModifications !== false;
};

/**
 * Reads persisted 3x/day calendar sync schedule state from storage.
 */
export const getCalendarSyncScheduleStateAsync = async () => {
  try {
    const raw = await AsyncStorage.getItem(CALENDAR_SYNC_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        lastSyncedSlotKey: parsed?.lastSyncedSlotKey || null,
        lastSyncedAt: parsed?.lastSyncedAt || null,
        lastSyncSummary: parsed?.lastSyncSummary || null,
      };
    }
  } catch (e) {}
  return { lastSyncedSlotKey: null, lastSyncedAt: null, lastSyncSummary: null };
};

/**
 * Marks the current due scheduled sync slot (08:00, 12:00, or 17:00) as completed
 * and persists the timestamp and summary.
 */
export const markCalendarSyncCompletedAsync = async (summary = null, nowLike = new Date()) => {
  const now = nowLike instanceof Date ? nowLike : new Date(nowLike);
  const dueSlot = getMostRecentDueSyncSlot(now);
  const nextState = {
    lastSyncedSlotKey: dueSlot.slotKey,
    lastSyncedAt: now.toISOString(),
    lastSyncSummary: summary,
  };
  try {
    await AsyncStorage.setItem(CALENDAR_SYNC_STATE_KEY, JSON.stringify(nextState));
  } catch (e) {}
  return nextState;
};

// In-memory cache for zero-latency lookups
let inMemoryTombstones = new Map();
let tombstonesLoaded = false;

/**
 * Retrieves the set of recently deleted calendar event IDs
 */
export const getTombstonesAsync = async () => {
  const now = Date.now();
  if (!tombstonesLoaded) {
    try {
      const stored = await AsyncStorage.getItem(TOMBSTONES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([id, time]) => {
          if (now - time < TOMBSTONE_TTL_MS) {
            inMemoryTombstones.set(String(id), time);
          }
        });
      }
    } catch (e) {}
    tombstonesLoaded = true;
  } else {
    // Purge expired tombstones
    for (const [id, time] of inMemoryTombstones.entries()) {
      if (now - time >= TOMBSTONE_TTL_MS) {
        inMemoryTombstones.delete(id);
      }
    }
  }
  return inMemoryTombstones;
};

/**
 * Records a deleted calendar event ID to prevent resurrection
 */
export const addTombstoneAsync = async (calEventId) => {
  if (!calEventId) return;
  const idStr = String(calEventId);
  const now = Date.now();
  inMemoryTombstones.set(idStr, now);
  try {
    const obj = Object.fromEntries(inMemoryTombstones.entries());
    await AsyncStorage.setItem(TOMBSTONES_STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {}
};

/**
 * Normalizes calendar event start date and time.
 * Fixes the Android UTC all-day date shift bug where 00:00:00Z shifts back to previous day in Western timezones.
 */
export const parseCalendarEventDate = (event) => {
  if (!event || !event.startDate) return { dateStr: '', timeStr: '' };

  if (event.allDay) {
    let dateStr = '';
    if (typeof event.startDate === 'string') {
      dateStr = event.startDate.slice(0, 10);
    } else if (event.startDate instanceof Date) {
      const y = event.startDate.getUTCFullYear();
      const m = String(event.startDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(event.startDate.getUTCDate()).padStart(2, '0');
      dateStr = `${y}-${m}-${d}`;
    } else {
      dateStr = dayjs(event.startDate).format('YYYY-MM-DD');
    }
    return { dateStr, timeStr: '' };
  }

  const startDay = dayjs(event.startDate);
  if (!startDay.isValid()) return { dateStr: '', timeStr: '' };
  return {
    dateStr: startDay.format('YYYY-MM-DD'),
    timeStr: startDay.format('HH:mm')
  };
};

/**
 * Checks whether calendar permissions are granted
 */
export const checkCalendarPermissionsAsync = async () => {
  if (Platform.OS === 'web') return false;
  try {
    const res = await Calendar.getCalendarPermissionsAsync();
    return res?.status === 'granted';
  } catch (error) {
    console.warn('Error checking calendar permissions:', error);
    return false;
  }
};

/**
 * Requests calendar permissions from the user
 */
export const requestCalendarPermissionsAsync = async () => {
  if (Platform.OS === 'web') return false;
  try {
    const res = await Calendar.requestCalendarPermissionsAsync();
    const status = res?.status;
    if (Platform.OS === 'ios' && status === 'granted') {
      try {
        await Calendar.requestRemindersPermissionsAsync();
      } catch (e) {
        // Reminders permission is secondary
      }
    }
    return status === 'granted';
  } catch (error) {
    console.warn('Error requesting calendar permissions:', error);
    return false;
  }
};

/**
 * Fetches all writable calendars on the device (e.g. Google Calendar, iCloud, Local)
 */
export const getWritableCalendarsAsync = async () => {
  if (Platform.OS === 'web') return [];
  try {
    const hasPermission = await checkCalendarPermissionsAsync();
    if (!hasPermission) return [];

    const calendars = await enqueueCalendarOp(() =>
      Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
    );
    const writable = (calendars || []).filter(isCalendarWritable);
    return writable.sort((a, b) => {
      const score = (c) => {
        let s = 0;
        if (c.isPrimary) s += 4;
        if (c.source?.type === 'com.google' || c.source?.name?.includes('@') || c.ownerAccount?.includes('@')) s += 2;
        if (c.source?.isLocalAccount || c.source?.type === 'LOCAL') s += 1;
        return s;
      };
      return score(b) - score(a);
    });
  } catch (error) {
    DevLogger.warn('[CalendarSync] Error getting calendars', error?.message || String(error));
    console.warn('Error getting calendars:', error);
    return [];
  }
};

/**
 * Determines the target calendar ID (preferred, primary Google account, or default)
 */
export const getTargetCalendarIdAsync = async (preferredCalendarId = null) => {
  if (Platform.OS === 'web') return null;
  try {
    const hasPermission = await checkCalendarPermissionsAsync();
    if (!hasPermission) return null;

    const calendars = await enqueueCalendarOp(() =>
      Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
    );
    if (!calendars || calendars.length === 0) return null;

    const writableCalendars = calendars.filter(isCalendarWritable);
    if (writableCalendars.length === 0) return null;

    // 1. If preferred ID is provided and exists among writable calendars
    if (preferredCalendarId) {
      const match = writableCalendars.find(c => String(c.id) === String(preferredCalendarId));
      if (match) return String(match.id);
    }

    // 2. On iOS, default calendar is usually available
    if (Platform.OS === 'ios') {
      try {
        const defaultCal = await enqueueCalendarOp(() => Calendar.getDefaultCalendarAsync());
        if (defaultCal && isCalendarWritable(defaultCal)) {
          return String(defaultCal.id);
        }
      } catch (e) {}
    }

    // 3. On Android or fallback: find primary Google calendar or primary account
    const primaryGoogle = writableCalendars.find(
      c => c.isPrimary || c.source?.name?.includes('@') || c.source?.type === 'com.google' || c.ownerAccount?.includes('@')
    );
    if (primaryGoogle) return String(primaryGoogle.id);

    // 4. Any writable calendar
    return String(writableCalendars[0].id);
  } catch (error) {
    DevLogger.warn('[CalendarSync] Error resolving target calendar ID', error?.message || String(error));
    console.warn('Error resolving target calendar ID:', error);
    return null;
  }
};

/**
 * Converts task reminder text into calendar alarm offset in minutes
 */
const getAlarmOffsetMinutes = (reminder) => {
  if (!reminder || reminder === 'None') return null;
  const rem = String(reminder).toLowerCase();
  if (rem.includes('15 min')) return -15;
  if (rem.includes('30 min')) return -30;
  if (rem.includes('1 hr') || rem.includes('1 hour')) return -60;
  if (rem.includes('1 day')) return -1440;
  if (rem.includes('day of')) return 0;
  return -15;
};

/**
 * Constructs sanitized event details from a task and calendar settings
 */
export const buildEventDetails = (task, calendarAlarmsEnabled = false) => {
  if (!task || !task.completionDate) return null;

  let rawDate = extractTaskDateKey(task);
  if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const parsed = dayjs(task.completionDate);
    if (!parsed.isValid()) return null;
    rawDate = parsed.format('YYYY-MM-DD');
  }

  const [y, m, d] = rawDate.split('-').map(Number);
  if (!y || !m || !d || y < 1970 || y > 2100) return null;

  const rawTime = typeof task.time === 'string' ? task.time.trim() : '';
  const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)/;
  const matchTime = rawTime.match(timeRegex);

  let startDate;
  let endDate;
  let allDay = false;

  if (matchTime) {
    const formattedTime = `${matchTime[1].padStart(2, '0')}:${matchTime[2]}`;
    const startDayjs = dayjs(`${rawDate}T${formattedTime}:00`);
    if (startDayjs.isValid()) {
      startDate = startDayjs.toDate();
      endDate = startDayjs.add(30, 'minute').toDate();
      allDay = false;
    }
  }

  if (!startDate || isNaN(startDate.getTime())) {
    if (Platform.OS === 'android') {
      startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      endDate = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
    } else {
      const dayStart = dayjs(rawDate).startOf('day');
      const dayEnd = dayjs(rawDate).endOf('day');
      if (!dayStart.isValid()) return null;
      startDate = dayStart.toDate();
      endDate = dayEnd.toDate();
    }
    allDay = true;
  }

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate.getTime() < startDate.getTime()) {
    return null;
  }

  // Alarms: Only attach alarms if user enabled calendar alarms in settings and reminder is set
  const alarms = [];
  if (calendarAlarmsEnabled && task.reminder && task.reminder !== 'None') {
    const offset = getAlarmOffsetMinutes(task.reminder);
    if (typeof offset === 'number' && !isNaN(offset)) {
      alarms.push({ relativeOffset: offset });
    }
  }

  const cleanDescription = task.description?.text
    ? sanitizeCalendarText(String(task.description.text).replace(/<[^>]+>/g, ''), 1800)
    : '';

  const cleanTitle = sanitizeCalendarText(task.taskname, 200) || 'Task';

  const details = {
    title: task.completed ? `✓ ${cleanTitle}` : cleanTitle,
    startDate,
    endDate,
    allDay,
    notes: cleanDescription ? `${cleanDescription}\n\n[Synced from TaskFlow]` : '[Synced from TaskFlow]',
  };

  // On iOS, attach standard availability; on Android, let CalendarProvider use its calendar default
  if (Platform.OS === 'ios' && Calendar?.Availability?.BUSY) {
    details.availability = Calendar.Availability.BUSY;
  }

  if (allDay && Platform.OS === 'android') {
    details.timeZone = 'UTC';
    details.endTimeZone = 'UTC';
  }

  if (alarms.length > 0) {
    details.alarms = alarms;
  }

  return details;
};

/**
 * Creates or updates an event in device calendar for a given task
 */
export const syncTaskToCalendarAsync = async (task, settings = {}) => {
  if (Platform.OS === 'web') return null;
  const { calendarSyncEnabled, calendarAlarmsEnabled, selectedCalendarId } = settings;
  if (!calendarSyncEnabled) return null;
  if (!task || !task.completionDate) return null;

  try {
    const calendarId = await getTargetCalendarIdAsync(selectedCalendarId);
    if (!calendarId || !isValidNativeCalendarId(calendarId)) return null;

    const eventDetails = buildEventDetails(task, calendarAlarmsEnabled);
    if (!eventDetails) return null;
    const nativeDetails = toNativeEventDetails(eventDetails);

    // If task already has a calendar event ID, try to update it
    if (task.calendarEventId) {
      const eventIdStr = String(task.calendarEventId).trim();
      const isNumericId = /^\d+$/.test(eventIdStr);
      const canUpdate = Platform.OS === 'android' ? isNumericId : !!eventIdStr;
      if (canUpdate) {
        try {
          await enqueueCalendarOp(() => Calendar.updateEventAsync(eventIdStr, nativeDetails));
          return eventIdStr;
        } catch (updateErr) {
          // Event might have been deleted from calendar externally; recreate below
        }
      }
    }

    // Create new event sequentially
    const newEventId = await enqueueCalendarOp(() =>
      Calendar.createEventAsync(String(calendarId), nativeDetails)
    );
    return newEventId ? String(newEventId) : null;
  } catch (error) {
    DevLogger.warn(`[CalendarSync] Failed to sync task "${task?.taskname}"`, error?.message || String(error));
    console.warn(`Failed to sync task "${task.taskname}" to calendar:`, error);
    return null;
  }
};

/**
 * Removes an event from the device calendar
 */
export const removeTaskFromCalendarAsync = async (calendarEventId) => {
  if (Platform.OS === 'web' || !calendarEventId) return;
  const idStr = String(calendarEventId).trim();
  if (Platform.OS === 'android' && !/^\d+$/.test(idStr)) return;
  try {
    await enqueueCalendarOp(() => Calendar.deleteEventAsync(idStr));
  } catch (error) {
    // Silently ignore if already removed
  }
};

/**
 * Crash-safe batch export of local tasks to Google / device calendar.
 * - Scoped to the active rolling sync window [-SYNC_PAST_DAYS, +SYNC_FUTURE_DAYS]
 * - Skips already-synced tasks whose calendar fingerprint hasn't changed
 * - Caps writes per batch (MAX_EVENTS_PER_SYNC_BATCH) with event-loop/GC yields
 * - Runs every native call sequentially through enqueueCalendarOp
 */
export const syncAllTasksToCalendarAsync = async (tasks = [], settings = {}) => {
  if (Platform.OS === 'web') return { syncedCount: 0, eventMap: {}, hashMap: {} };
  const { calendarSyncEnabled, calendarAlarmsEnabled, selectedCalendarId } = settings;
  if (!calendarSyncEnabled) return { syncedCount: 0, eventMap: {}, hashMap: {} };

  try {
    const calendarId = await getTargetCalendarIdAsync(selectedCalendarId);
    if (!calendarId || !isValidNativeCalendarId(calendarId)) {
      return { syncedCount: 0, eventMap: {}, hashMap: {} };
    }

    const stringCalendarId = String(calendarId);
    const eventMap = {};
    const hashMap = {};
    let syncedCount = 0;
    let opsExecuted = 0;
    const now = new Date();

    DevLogger.log('[CalendarSync] Starting window-scoped batch export', {
      totalTasks: tasks.length,
      calendarId: stringCalendarId,
    });

    for (const task of tasks) {
      if (opsExecuted >= MAX_EVENTS_PER_SYNC_BATCH) {
        DevLogger.log('[CalendarSync] Reached safe batch export cap', { cap: MAX_EVENTS_PER_SYNC_BATCH });
        break;
      }
      if (!task || !task.completionDate || task.completed) continue;

      const dateKey = extractTaskDateKey(task);
      if (!isDateStrInSyncWindow(dateKey, now, SYNC_PAST_DAYS, SYNC_FUTURE_DAYS)) {
        continue;
      }

      const taskKey = task.id || task._id;
      if (!taskKey) continue;

      const fingerprint = getTaskCalendarFingerprint(task, calendarAlarmsEnabled);
      const existingEventId = task.calendarEventId ? String(task.calendarEventId).trim() : null;
      const isValidExistingId = existingEventId && (Platform.OS === 'android' ? /^\d+$/.test(existingEventId) : true);

      // Skip already-synced tasks whose content has not changed (avoids unnecessary native writes & cursor leaks)
      if (isValidExistingId && task.calendarSyncHash && task.calendarSyncHash === fingerprint) {
        continue;
      }

      const eventDetails = buildEventDetails(task, calendarAlarmsEnabled);
      if (!eventDetails) continue;
      const nativeDetails = toNativeEventDetails(eventDetails);

      opsExecuted++;
      if (opsExecuted % 5 === 0) {
        // Yield cleanly to UI thread and allow Android native GC/Cursor finalizers to reclaim memory
        await sleepMs(30);
      }

      try {
        let eventId = isValidExistingId ? existingEventId : null;
        if (eventId) {
          try {
            await enqueueCalendarOp(() => Calendar.updateEventAsync(eventId, nativeDetails));
          } catch (e) {
            eventId = await enqueueCalendarOp(() =>
              Calendar.createEventAsync(stringCalendarId, nativeDetails)
            );
          }
        } else {
          eventId = await enqueueCalendarOp(() =>
            Calendar.createEventAsync(stringCalendarId, nativeDetails)
          );
        }

        if (eventId) {
          const idString = String(eventId);
          eventMap[taskKey] = idString;
          hashMap[taskKey] = fingerprint;
          syncedCount++;
        }
      } catch (e) {
        DevLogger.warn(`[CalendarSync] Failed batch sync for task ${taskKey}`, e?.message || String(e));
        console.warn(`Failed batch sync for task ${taskKey}:`, e);
      }
    }

    return { syncedCount, eventMap, hashMap };
  } catch (error) {
    DevLogger.error('[CalendarSync] Failed to batch sync tasks to calendar', error?.message || String(error));
    console.warn('Failed to batch sync tasks to calendar:', error);
    return { syncedCount: 0, eventMap: {}, hashMap: {} };
  }
};

/**
 * Performs Chunked Differential Synchronization with device/Google calendar.
 * Implements:
 * 1. Chunked 14-day native queries across [Today - SYNC_PAST_DAYS, Today + SYNC_FUTURE_DAYS]
 *    (prevents Android CalendarModule CursorWindow leaks & OOM on busy Google Calendars)
 * 2. Window-Scoped Ghost Deletion Detection (only runs when all chunks succeeded!)
 * 3. Tombstone Ledger check (prevents zombie resurrection)
 * 4. UTC All-Day Date Normalization (eliminates Android -1 day time shift)
 */
export const performDifferentialCalendarSyncAsync = async (settings = {}, existingTasks = []) => {
  if (Platform.OS === 'web') {
    return { hasChanges: false, newTasks: [], updatedTasks: [], deletedTaskIds: [], importedCount: 0, deletedCount: 0 };
  }
  const { calendarSyncEnabled, selectedCalendarId } = settings;
  if (!calendarSyncEnabled) {
    return { hasChanges: false, newTasks: [], updatedTasks: [], deletedTaskIds: [], importedCount: 0, deletedCount: 0 };
  }

  try {
    const hasPermission = await checkCalendarPermissionsAsync();
    if (!hasPermission) {
      return { hasChanges: false, newTasks: [], updatedTasks: [], deletedTaskIds: [], importedCount: 0, deletedCount: 0 };
    }

    const calendarId = await getTargetCalendarIdAsync(selectedCalendarId);
    if (!calendarId || !isValidNativeCalendarId(calendarId)) {
      return { hasChanges: false, newTasks: [], updatedTasks: [], deletedTaskIds: [], importedCount: 0, deletedCount: 0 };
    }

    // 1. Chunked 14-day queries across rolling horizon [Today - 14 days, Today + 60 days]
    const now = new Date();
    const chunks = buildSyncWindowChunks(now, SYNC_PAST_DAYS, SYNC_FUTURE_DAYS, SYNC_CHUNK_DAYS);
    const activeNativeEventMap = new Map();
    const activeNativeIds = new Set();
    let allChunksSucceeded = true;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const chunkEvents = await enqueueCalendarOp(() =>
          Calendar.getEventsAsync(
            [String(calendarId)],
            toNativeCalendarDate(chunk.start),
            toNativeCalendarDate(chunk.end)
          )
        );
        (chunkEvents || []).forEach(event => {
          if (event && event.id && String(event.status || '').toLowerCase() !== 'canceled') {
            const idStr = String(event.id);
            activeNativeIds.add(idStr);
            if (!activeNativeEventMap.has(idStr)) {
              activeNativeEventMap.set(idStr, event);
            }
          }
        });
      } catch (chunkErr) {
        allChunksSucceeded = false;
        DevLogger.warn(`[CalendarSync] Chunk ${i + 1}/${chunks.length} getEventsAsync failed`, chunkErr?.message || String(chunkErr));
        console.warn('Calendar.getEventsAsync chunk error:', chunkErr);
      }

      if (i < chunks.length - 1) {
        await sleepMs(50);
      }
    }

    // Load active tombstone IDs (recently deleted in TaskFlow)
    const tombstones = await getTombstonesAsync();

    // 2. Window-Scoped Ghost Deletion Detection:
    // ONLY evaluate deletions if all chunks succeeded so a transient read failure never deletes tasks.
    const deletedTaskIds = [];
    if (allChunksSucceeded) {
      (existingTasks || []).forEach(task => {
        if (!task || !task.calendarEventId) return;

        const taskDateStr = extractTaskDateKey(task);
        if (!taskDateStr) return;

        if (isDateStrInSyncWindow(taskDateStr, now, SYNC_PAST_DAYS, SYNC_FUTURE_DAYS)) {
          const taskCalId = String(task.calendarEventId);
          if (!activeNativeIds.has(taskCalId)) {
            const tid = task.id || task._id;
            if (tid) deletedTaskIds.push(tid);
          }
        }
      });
    }

    // 3. Process Active Native Events (Updates & Imports)
    const taskByCalEventId = new Map();
    const taskByNameAndDate = new Map();

    (existingTasks || []).forEach(t => {
      if (!t) return;
      if (t.calendarEventId) {
        taskByCalEventId.set(String(t.calendarEventId), t);
      }
      const dateKey = extractTaskDateKey(t);
      const taskTitle = typeof t.taskname === 'string' ? t.taskname.trim().toLowerCase() : (t.taskname ? String(t.taskname).trim().toLowerCase() : '');
      if (taskTitle && dateKey) {
        const key = `${taskTitle}_${dateKey}`;
        taskByNameAndDate.set(key, t);
      }
    });

    const newTasks = [];
    const updatedTasks = [];
    let counter = 0;

    for (const [eventCalId, event] of activeNativeEventMap.entries()) {
      counter++;
      if (counter % 10 === 0) {
        await sleepMs(0);
      }

      if (!event.title) continue;

      // Anti-Resurrection Guard: If user recently deleted this task in TaskFlow,
      // do not re-import it as a new task.
      if (tombstones.has(eventCalId)) {
        removeTaskFromCalendarAsync(eventCalId).catch(() => {});
        continue;
      }

      const rawTitle = sanitizeCalendarText(event.title, 200);
      if (!rawTitle) continue;
      const isCompleted = rawTitle.startsWith('✓ ');
      const cleanTitle = rawTitle.replace(/^✓\s*/, '').trim() || 'Calendar Event';
      const { dateStr, timeStr } = parseCalendarEventDate(event);
      if (!dateStr) continue;

      const cleanNotes = sanitizeCalendarText(
        String(event.notes || '').replace(/\[Synced from TaskFlow\]/g, ''),
        1800
      );

      // Check if already mapped to a task
      const existingLinkedTask = taskByCalEventId.get(eventCalId);
      if (existingLinkedTask) {
        const linkedTaskId = existingLinkedTask.id || existingLinkedTask._id;
        if (deletedTaskIds.includes(linkedTaskId)) continue;

        const titleChanged = existingLinkedTask.taskname !== cleanTitle;
        const dateChanged = extractTaskDateKey(existingLinkedTask) !== dateStr;
        const timeChanged = (existingLinkedTask.time || '') !== timeStr;
        const completionChanged = isCompleted && !existingLinkedTask.completed;

        if (titleChanged || dateChanged || timeChanged || completionChanged) {
          updatedTasks.push({
            taskId: linkedTaskId,
            name: cleanTitle,
            completionDate: dateStr,
            time: timeStr,
            completed: completionChanged ? true : existingLinkedTask.completed,
            ...(cleanNotes ? { description: { ...(existingLinkedTask.description || {}), text: cleanNotes } } : {})
          });
        }
        continue;
      }

      // Check if matches an unlinked task by title and date
      const matchKey = `${cleanTitle.toLowerCase()}_${dateStr}`;
      const unlinkedMatch = taskByNameAndDate.get(matchKey);
      if (unlinkedMatch && !unlinkedMatch.calendarEventId) {
        const unlinkedId = unlinkedMatch.id || unlinkedMatch._id;
        if (!deletedTaskIds.includes(unlinkedId)) {
          updatedTasks.push({
            taskId: unlinkedId,
            calendarEventId: eventCalId
          });
          taskByCalEventId.set(eventCalId, unlinkedMatch);
          continue;
        }
      }

      // Guard max newly imported tasks per sync to protect memory on huge shared calendars
      if (newTasks.length >= MAX_IMPORTS_PER_SYNC) {
        continue;
      }

      // New event from Google Calendar / Native Calendar -> Import into TaskFlow
      const nowIso = new Date().toISOString();
      const uniqueId = `cal_${eventCalId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const importedTask = {
        id: uniqueId,
        taskname: cleanTitle,
        completionDate: dateStr,
        dateString: dateStr,
        time: timeStr,
        completed: isCompleted,
        priority: 'normal',
        boardId: 'main',
        calendarEventId: eventCalId,
        syncedFromCalendar: true,
        reminder: 'None',
        isAlarm: false,
        subtasks: [],
        description: {
          text: cleanNotes,
          img: '',
          url: '',
          attachments: []
        },
        createdAt: nowIso,
        lastUpdatedDate: nowIso
      };
      importedTask.calendarSyncHash = getTaskCalendarFingerprint(importedTask, Boolean(settings?.calendarAlarmsEnabled));

      newTasks.push(importedTask);
      taskByCalEventId.set(eventCalId, { id: uniqueId });
    }

    const hasChanges = deletedTaskIds.length > 0 || newTasks.length > 0 || updatedTasks.length > 0;

    return {
      hasChanges,
      newTasks,
      updatedTasks,
      deletedTaskIds,
      importedCount: newTasks.length,
      deletedCount: deletedTaskIds.length
    };
  } catch (error) {
    DevLogger.error('[CalendarSync] Failed differential sync', error?.message || String(error));
    console.warn('Failed to differential sync events from calendar:', error);
    return { hasChanges: false, newTasks: [], updatedTasks: [], deletedTaskIds: [], importedCount: 0, deletedCount: 0 };
  }
};

/**
 * Backward compatibility alias for performDifferentialCalendarSyncAsync
 */
export const importCalendarEventsAsync = async (settings = {}, existingTasks = []) => {
  return await performDifferentialCalendarSyncAsync(settings, existingTasks);
};
