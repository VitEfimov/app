import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { DevLogger } from './logger';
import {
  DAILY_CALENDAR_SYNC_HOURS,
  DAILY_CALENDAR_SYNC_SLOTS,
  CALENDAR_SYNC_STATE_KEY,
  CALENDAR_PUSH_DEFAULT_ENABLED,
  normalizeSelectedCalendarIds,
  SYNC_PAST_DAYS,
  SYNC_FUTURE_DAYS,
  SYNC_CHUNK_DAYS,
  MAX_EVENTS_PER_SYNC_BATCH,
  MAX_IMPORTS_PER_SYNC,
  RECENT_TASK_GHOST_GRACE_MS,
  CALENDAR_SYNC_AUTO_BOARD_TYPES,
  CALENDAR_SYNC_OFF_BOARD_TYPES,
  QUICK_LIST_BOARD_TYPES,
  isQuickListBoardType,
  isCalendarSyncSupportedForBoard,
  getDefaultBoardCalendarSync,
  getBoardCalendarSyncKey,
  isBoardCalendarSyncEnabled,
  resolveTaskBoard,
  isTaskEligibleForCalendarSync,
  getImportTargetBoardId,
  formatLocalDateKey,
  extractTaskDateKey,
  normalizeCalendarTitle,
  getTaskMatchTitle,
  isMainBoardId,
  shiftDateKeyByDays,
  buildTaskDeduplicationPlan,
  buildTaskCalendarIndex,
  findMatchingTaskForCalendarEvent,
  isDateStrInSyncWindow,
  buildSyncWindowChunks,
  isTaskRecentlyCreatedOrUpdated,
  prioritizeTasksForCalendarExport,
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
  CALENDAR_PUSH_DEFAULT_ENABLED,
  normalizeSelectedCalendarIds,
  SYNC_PAST_DAYS,
  SYNC_FUTURE_DAYS,
  SYNC_CHUNK_DAYS,
  MAX_EVENTS_PER_SYNC_BATCH,
  MAX_IMPORTS_PER_SYNC,
  RECENT_TASK_GHOST_GRACE_MS,
  CALENDAR_SYNC_AUTO_BOARD_TYPES,
  CALENDAR_SYNC_OFF_BOARD_TYPES,
  QUICK_LIST_BOARD_TYPES,
  isQuickListBoardType,
  isCalendarSyncSupportedForBoard,
  getDefaultBoardCalendarSync,
  getBoardCalendarSyncKey,
  isBoardCalendarSyncEnabled,
  resolveTaskBoard,
  isTaskEligibleForCalendarSync,
  getImportTargetBoardId,
  formatLocalDateKey,
  extractTaskDateKey,
  normalizeCalendarTitle,
  getTaskMatchTitle,
  isMainBoardId,
  shiftDateKeyByDays,
  buildTaskDeduplicationPlan,
  buildTaskCalendarIndex,
  findMatchingTaskForCalendarEvent,
  isDateStrInSyncWindow,
  buildSyncWindowChunks,
  isTaskRecentlyCreatedOrUpdated,
  prioritizeTasksForCalendarExport,
  getTaskCalendarFingerprint,
  getDailySyncSlotsForDate,
  getMostRecentDueSyncSlot,
  getNextScheduledSyncTime,
  isScheduledCalendarSyncDue,
};

const TOMBSTONES_STORAGE_KEY = 'calendar_deleted_tombstones';
const TOMBSTONE_TTL_MS = 15 * 60 * 1000; // 15-minute TTL to prevent resurrection
const WRITABLE_ACCESS_LEVELS = new Set(['owner', 'root', 'editor', 'contributor']);

// Strict sequential queue for ALL native expo-calendar calls with a high-priority lane
// for immediate user writes (addTask / updateTask / deleteTask) so adding Today/Tomorrow
// tasks never stalls behind multi-chunk background reads while preserving 100% single-op
// serialization on Android CalendarModule.
const urgentCalendarOps = [];
const normalCalendarOps = [];
let calendarQueueRunning = false;

const drainCalendarQueue = () => {
  if (calendarQueueRunning) return;
  const nextItem = urgentCalendarOps.shift() || normalCalendarOps.shift();
  if (!nextItem) return;
  calendarQueueRunning = true;
  Promise.resolve()
    .then(() => nextItem.fn())
    .then(
      (val) => {
        calendarQueueRunning = false;
        nextItem.resolve(val);
        drainCalendarQueue();
      },
      (err) => {
        calendarQueueRunning = false;
        nextItem.reject(err);
        drainCalendarQueue();
      }
    );
};

export const enqueueCalendarOp = (fn, options = {}) => {
  const priority = options?.priority === 'high' ? 'high' : 'normal';
  return new Promise((resolve, reject) => {
    const queue = priority === 'high' ? urgentCalendarOps : normalCalendarOps;
    queue.push({ fn, resolve, reject });
    drainCalendarQueue();
  });
};

// Short-lived cache for resolved target calendar ID so immediate addTask/updateTask writes
// do not wait on redundant getCalendarsAsync round-trips.
let cachedTargetCalendar = { prefKey: null, calendarId: null, resolvedAt: 0 };
const TARGET_CALENDAR_CACHE_TTL_MS = 60 * 1000;
const invalidateTargetCalendarCache = () => {
  cachedTargetCalendar = { prefKey: null, calendarId: null, resolvedAt: 0 };
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

const isCalendarReadable = (cal) => {
  return Boolean(cal && isValidNativeCalendarId(cal.id));
};

const isOutlookOrExchangeCalendar = (cal) => {
  if (!cal) return false;
  const srcType = String(cal.source?.type || '').toLowerCase();
  const srcName = String(cal.source?.name || '').toLowerCase();
  const owner = String(cal.ownerAccount || '').toLowerCase();
  const title = String(cal.title || '').toLowerCase();
  return (
    srcType.includes('outlook') ||
    srcType.includes('exchange') ||
    srcType.includes('microsoft') ||
    srcName.includes('outlook') ||
    srcName.includes('hotmail') ||
    srcName.includes('exchange') ||
    owner.includes('@outlook.') ||
    owner.includes('@hotmail.') ||
    owner.includes('@live.') ||
    title.includes('outlook')
  );
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
 * Fetches all available calendars on the device (e.g. Google Calendar, Microsoft Outlook / Exchange, iCloud, Local).
 * In fetch-only mode, also includes read-only synced calendars (such as Outlook or subscribed calendars) if no writable filter is forced.
 */
export const getWritableCalendarsAsync = async (options = {}) => {
  if (Platform.OS === 'web') return [];
  try {
    const hasPermission = await checkCalendarPermissionsAsync();
    if (!hasPermission) return [];

    const calendars = await enqueueCalendarOp(() =>
      Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
    );
    const list = calendars || [];
    const writable = list.filter(isCalendarWritable);
    const readable = options?.requireWritable ? writable : list.filter(isCalendarReadable);
    const pool = readable.length > 0 ? readable : writable;
    return pool.sort((a, b) => {
      const score = (c) => {
        let s = 0;
        if (c.isPrimary) s += 4;
        if (c.source?.type === 'com.google' || isOutlookOrExchangeCalendar(c) || c.source?.name?.includes('@') || c.ownerAccount?.includes('@')) s += 2;
        if (isCalendarWritable(c)) s += 1;
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
export const getTargetCalendarIdAsync = async (preferredCalendarId = null, options = {}) => {
  if (Platform.OS === 'web') return null;
  const prefKey = preferredCalendarId ? String(preferredCalendarId) : '__default__';
  const nowMs = Date.now();
  if (
    !options?.bypassCache &&
    cachedTargetCalendar.calendarId &&
    cachedTargetCalendar.prefKey === prefKey &&
    (nowMs - cachedTargetCalendar.resolvedAt) < TARGET_CALENDAR_CACHE_TTL_MS
  ) {
    return cachedTargetCalendar.calendarId;
  }

  try {
    const hasPermission = await checkCalendarPermissionsAsync();
    if (!hasPermission) return null;

    const calendars = await enqueueCalendarOp(
      () => Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT),
      { priority: options?.priority }
    );
    if (!calendars || calendars.length === 0) return null;

    const writableCalendars = calendars.filter(isCalendarWritable);
    const readableCalendars = calendars.filter(isCalendarReadable);
    const candidateCalendars = writableCalendars.length > 0 ? writableCalendars : readableCalendars;
    if (candidateCalendars.length === 0) return null;

    let resolvedId = null;

    // 1. If preferred ID is provided and exists among readable/writable calendars (supports Google, Outlook, Exchange, iCloud)
    if (preferredCalendarId) {
      const match = readableCalendars.find(c => String(c.id) === String(preferredCalendarId));
      if (match) resolvedId = String(match.id);
    }

    // 2. On iOS, default calendar is usually available
    if (!resolvedId && Platform.OS === 'ios') {
      try {
        const defaultCal = await enqueueCalendarOp(
          () => Calendar.getDefaultCalendarAsync(),
          { priority: options?.priority }
        );
        if (defaultCal && isCalendarReadable(defaultCal)) {
          resolvedId = String(defaultCal.id);
        }
      } catch (e) {}
    }

    // 3. On Android or fallback: find primary Google / Outlook / Exchange calendar or primary account
    if (!resolvedId) {
      const primaryAccount = candidateCalendars.find(
        c =>
          c.isPrimary ||
          c.source?.type === 'com.google' ||
          isOutlookOrExchangeCalendar(c) ||
          c.source?.name?.includes('@') ||
          c.ownerAccount?.includes('@')
      );
      if (primaryAccount) resolvedId = String(primaryAccount.id);
    }

    // 4. Any available calendar
    if (!resolvedId) {
      resolvedId = String(candidateCalendars[0].id);
    }

    if (resolvedId) {
      cachedTargetCalendar = { prefKey, calendarId: resolvedId, resolvedAt: Date.now() };
    }
    return resolvedId;
  } catch (error) {
    DevLogger.warn('[CalendarSync] Error resolving target calendar ID', error?.message || String(error));
    console.warn('Error resolving target calendar ID:', error);
    return null;
  }
};

/**
 * Resolves one or more target device calendar IDs for multi-calendar fetching
 * (e.g. simultaneously fetching from Google Calendar + Microsoft Outlook / Exchange + iCloud).
 */
export const getTargetCalendarIdsAsync = async (
  preferredCalendarIds = [],
  legacyPreferredCalendarId = null,
  options = {}
) => {
  if (Platform.OS === 'web') return [];
  const requestedIds = normalizeSelectedCalendarIds(preferredCalendarIds, legacyPreferredCalendarId);

  try {
    const hasPermission = await checkCalendarPermissionsAsync();
    if (!hasPermission) return [];

    if (requestedIds.length > 0) {
      const calendars = await enqueueCalendarOp(
        () => Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT),
        { priority: options?.priority }
      );
      const readableIds = new Set(
        (calendars || []).filter(isCalendarReadable).map(c => String(c.id).trim())
      );
      const matched = requestedIds.filter(id => readableIds.has(id) && isValidNativeCalendarId(id));
      if (matched.length > 0) {
        return matched;
      }
    }

    const fallbackId = await getTargetCalendarIdAsync(legacyPreferredCalendarId, options);
    return fallbackId && isValidNativeCalendarId(fallbackId) ? [String(fallbackId)] : [];
  } catch (error) {
    DevLogger.warn('[CalendarSync] Error resolving target calendar IDs', error?.message || String(error));
    return [];
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
  if (!task || (!task.completionDate && !task.dateString && !task.dueDate && !task.date)) return null;

  let rawDate = extractTaskDateKey(task);
  if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const parsed = dayjs(task.completionDate || task.dateString || task.dueDate || task.date);
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

  // Alarms: TaskFlow schedules its own rich notifications/alarms via scheduleTaskReminder.
  // Always pass an explicit empty alarms array (unless task.useCalendarAlarmOnly === true)
  // so Google/Device Calendar sets HAS_ALARM = 0 and never fires duplicate reminder alerts!
  const alarms = [];
  if (task.useCalendarAlarmOnly === true && calendarAlarmsEnabled && task.reminder && task.reminder !== 'None') {
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
    alarms,
  };

  // On iOS, attach standard availability; on Android, let CalendarProvider use its calendar default
  if (Platform.OS === 'ios' && Calendar?.Availability?.BUSY) {
    details.availability = Calendar.Availability.BUSY;
  }

  if (allDay && Platform.OS === 'android') {
    details.timeZone = 'UTC';
    details.endTimeZone = 'UTC';
  }

  return details;
};

/**
 * Creates or updates an event in device calendar for a given task.
 * Uses the high-priority queue lane so direct user task additions/updates commit immediately
 * without waiting behind multi-chunk background reads.
 */
export const syncTaskToCalendarAsync = async (task, settings = {}) => {
  if (Platform.OS === 'web') return null;
  const { calendarSyncEnabled, calendarPushEnabled, calendarAlarmsEnabled, selectedCalendarId } = settings;
  if (!calendarSyncEnabled) return null;
  const isPushActive = calendarPushEnabled === undefined ? CALENDAR_PUSH_DEFAULT_ENABLED : Boolean(calendarPushEnabled);
  if (!isPushActive) return null;
  if (!task || (!task.completionDate && !task.dateString && !task.dueDate && !task.date)) return null;

  try {
    const calendarId = await getTargetCalendarIdAsync(selectedCalendarId, { priority: 'high' });
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
          await enqueueCalendarOp(
            () => Calendar.updateEventAsync(eventIdStr, nativeDetails),
            { priority: 'high' }
          );
          return eventIdStr;
        } catch (updateErr) {
          // Event might have been deleted from calendar externally; recreate below
        }
      }
    }

    // Create new event sequentially on the high-priority lane
    try {
      const newEventId = await enqueueCalendarOp(
        () => Calendar.createEventAsync(String(calendarId), nativeDetails),
        { priority: 'high' }
      );
      return newEventId ? String(newEventId) : null;
    } catch (createErr) {
      // If cached calendar ID went stale, refresh target calendar once and retry
      invalidateTargetCalendarCache();
      const freshCalId = await getTargetCalendarIdAsync(selectedCalendarId, { priority: 'high', bypassCache: true });
      if (!freshCalId || freshCalId === calendarId) throw createErr;
      const retryEventId = await enqueueCalendarOp(
        () => Calendar.createEventAsync(String(freshCalId), nativeDetails),
        { priority: 'high' }
      );
      return retryEventId ? String(retryEventId) : null;
    }
  } catch (error) {
    DevLogger.warn(`[CalendarSync] Failed to sync task "${task?.taskname}"`, error?.message || String(error));
    console.warn(`Failed to sync task "${task.taskname}" to calendar:`, error);
    return null;
  }
};

/**
 * Verifies directly against the native Calendar Events table (not just Instances) whether
 * an event ID still exists and is not canceled. Prevents false ghost-deletion if Instances
 * misses a boundary/all-day/syncing event.
 */
export const verifyCalendarEventExistsAsync = async (calendarEventId) => {
  if (Platform.OS === 'web' || !calendarEventId) return false;
  const idStr = String(calendarEventId).trim();
  if (!idStr) return false;
  if (Platform.OS === 'android' && !/^\d+$/.test(idStr)) return false;
  if (typeof Calendar.getEventByIdAsync !== 'function') return false;
  try {
    const ev = await enqueueCalendarOp(() => Calendar.getEventByIdAsync(idStr));
    if (!ev || !ev.id) return false;
    return String(ev.status || '').toLowerCase() !== 'canceled';
  } catch (err) {
    const code = String(err?.code || '');
    const msg = String(err?.message || '').toLowerCase();
    if (code === 'E_EVENT_NOT_FOUND' || msg.includes('could not be found') || msg.includes('not found')) {
      return false;
    }
    // Fail-safe: never delete a user's task on a transient/permission native error
    return true;
  }
};

/**
 * Removes an event from the device calendar.
 * Supports high-priority queue lane when triggered directly by user deletion.
 */
export const removeTaskFromCalendarAsync = async (calendarEventId, options = {}) => {
  if (Platform.OS === 'web' || !calendarEventId) return;
  const idStr = String(calendarEventId).trim();
  if (Platform.OS === 'android' && !/^\d+$/.test(idStr)) return;
  try {
    await enqueueCalendarOp(
      () => Calendar.deleteEventAsync(idStr),
      { priority: options?.priority }
    );
  } catch (error) {
    // Silently ignore if already removed
  }
};

/**
 * Immediately deletes calendar events for one or more user-deleted tasks (0ms delay).
 * - Deletes the linked `task.calendarEventId` on the high-priority native queue lane
 * - Also scans the deleted task's date (±1 day) in Google Calendar and deletes any
 *   duplicate or unlinked `[Synced from TaskFlow]` events with the same normalized title.
 */
export const removeTaskEventsFromCalendarImmediateAsync = async (tasksToRemove = [], settings = {}) => {
  if (Platform.OS === 'web') return 0;
  const list = (Array.isArray(tasksToRemove) ? tasksToRemove : [tasksToRemove]).filter(Boolean);
  if (list.length === 0) return 0;

  let removedCount = 0;
  const removedEventIds = new Set();
  const dateBuckets = new Map(); // dateKey -> Set<normTitle>

  for (const task of list) {
    if (task.calendarEventId) {
      const idStr = String(task.calendarEventId).trim();
      if (idStr && (Platform.OS !== 'android' || /^\d+$/.test(idStr)) && !removedEventIds.has(idStr)) {
        removedEventIds.add(idStr);
        try {
          await addTombstoneAsync(idStr);
          await removeTaskFromCalendarAsync(idStr, { priority: 'high' });
          removedCount++;
        } catch (e) {}
      }
    }
    const normTitle = getTaskMatchTitle(task);
    const dateKey = extractTaskDateKey(task);
    if (normTitle && dateKey) {
      if (!dateBuckets.has(dateKey)) dateBuckets.set(dateKey, new Set());
      dateBuckets.get(dateKey).add(normTitle);
    }
  }

  if (!settings?.calendarSyncEnabled || dateBuckets.size === 0) {
    return removedCount;
  }

  try {
    const calendarId = await getTargetCalendarIdAsync(settings?.selectedCalendarId, { priority: 'high' });
    if (!calendarId || !isValidNativeCalendarId(calendarId)) return removedCount;

    for (const [dateKey, titleSet] of dateBuckets.entries()) {
      const [y, m, d] = dateKey.split('-').map(Number);
      if (!y || !m || !d) continue;
      const queryStart = new Date(y, m - 1, d - 1, 0, 0, 0, 0);
      const queryEnd = new Date(y, m - 1, d + 1, 23, 59, 59, 999);
      let events = [];
      try {
        events = await enqueueCalendarOp(
          () => Calendar.getEventsAsync(
            [String(calendarId)],
            toNativeCalendarDate(queryStart),
            toNativeCalendarDate(queryEnd)
          ),
          { priority: 'high' }
        );
      } catch (e) {}

      for (const ev of events || []) {
        if (!ev || !ev.id) continue;
        const evId = String(ev.id).trim();
        if (removedEventIds.has(evId)) continue;
        if (!isTaskFlowExportedEvent(ev)) continue;
        const evTitle = normalizeCalendarTitle(ev.title);
        if (!evTitle || !titleSet.has(evTitle)) continue;
        const { dateStr: evDate } = parseCalendarEventDate(ev);
        if (evDate === dateKey || evDate === shiftDateKeyByDays(dateKey, -1) || evDate === shiftDateKeyByDays(dateKey, 1)) {
          removedEventIds.add(evId);
          try {
            await addTombstoneAsync(evId);
            await removeTaskFromCalendarAsync(evId, { priority: 'high' });
            removedCount++;
          } catch (e) {}
        }
      }
    }
  } catch (e) {}

  return removedCount;
};

const isTaskFlowExportedEvent = (event) => {
  return typeof event?.notes === 'string' && event.notes.includes('[Synced from TaskFlow]');
};

/**
 * Fetches all active calendar events in the rolling window [-SYNC_PAST_DAYS, +SYNC_FUTURE_DAYS]
 * using safe 14-day chunks. Shared between export pre-matching and differential import so
 * each sync only reads native CalendarProvider once.
 */
export const fetchCalendarWindowEventsAsync = async (settings = {}) => {
  const now = new Date();
  const empty = {
    calendarId: null,
    calendarIds: [],
    activeNativeEventMap: new Map(),
    activeNativeIds: new Set(),
    allChunksSucceeded: false,
    now,
  };
  if (Platform.OS === 'web') return empty;
  const { calendarSyncEnabled, selectedCalendarId, selectedCalendarIds } = settings || {};
  if (!calendarSyncEnabled) return empty;

  try {
    const hasPermission = await checkCalendarPermissionsAsync();
    if (!hasPermission) return empty;

    const targetCalendarIds = await getTargetCalendarIdsAsync(selectedCalendarIds, selectedCalendarId);
    if (!targetCalendarIds || targetCalendarIds.length === 0) return empty;
    const primaryCalendarId = String(targetCalendarIds[0]);

    const chunks = buildSyncWindowChunks(now, SYNC_PAST_DAYS, SYNC_FUTURE_DAYS, SYNC_CHUNK_DAYS);
    const activeNativeEventMap = new Map();
    const activeNativeIds = new Set();
    let allChunksSucceeded = true;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const chunkEvents = await enqueueCalendarOp(() =>
          Calendar.getEventsAsync(
            targetCalendarIds.map(String),
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

    return {
      calendarId: primaryCalendarId,
      calendarIds: targetCalendarIds.map(String),
      activeNativeEventMap,
      activeNativeIds,
      allChunksSucceeded,
      now,
    };
  } catch (error) {
    DevLogger.error('[CalendarSync] Failed fetching calendar window events', error?.message || String(error));
    return empty;
  }
};

/**
 * Removes TaskFlow-exported events for a disabled/unsynced/deleted board from Google / device calendar
 * while keeping all local tasks completely untouched in the app (when disabling sync).
 * Also scans the active calendar window for any unlinked or duplicate [Synced from TaskFlow] events
 * matching the board's task titles so no orphan events remain in Google Calendar.
 */
export const removeBoardEventsFromCalendarAsync = async (boardTasks = [], settings = {}, prefetchedWindow = null) => {
  if (Platform.OS === 'web' || !settings?.calendarSyncEnabled) {
    return { removedCount: 0, clearedEventTaskIds: [] };
  }
  const clearedEventTaskIds = [];
  const deletedEventIds = new Set();
  const boardTitles = new Set();
  let removedCount = 0;
  let opsExecuted = 0;

  for (const task of boardTasks || []) {
    if (!task) continue;
    const normTitle = getTaskMatchTitle(task);
    if (normTitle) boardTitles.add(normTitle);

    const taskKey = task.id || task._id;
    if (taskKey) {
      clearedEventTaskIds.push(taskKey);
    }
    if (!task.calendarEventId) continue;

    const eventIdStr = String(task.calendarEventId).trim();
    const isValidExistingId = eventIdStr && (Platform.OS === 'android' ? /^\d+$/.test(eventIdStr) : true);
    if (!isValidExistingId || deletedEventIds.has(eventIdStr)) continue;

    deletedEventIds.add(eventIdStr);
    opsExecuted++;
    if (opsExecuted % 5 === 0) {
      await sleepMs(20);
    }
    try {
      await addTombstoneAsync(eventIdStr);
      await removeTaskFromCalendarAsync(eventIdStr, { priority: 'high' });
      removedCount++;
    } catch (e) {}
  }

  // Also scan the active calendar window for any unlinked or duplicate [Synced from TaskFlow]
  // events whose title matches a task on this board (e.g. if calendarEventId was cleared or duplicated).
  if (boardTitles.size > 0) {
    try {
      const windowData = prefetchedWindow || (await fetchCalendarWindowEventsAsync(settings));
      const activeMap = windowData?.activeNativeEventMap;
      if (activeMap && activeMap.size > 0) {
        for (const [evId, ev] of activeMap.entries()) {
          const idStr = String(evId).trim();
          if (!idStr || deletedEventIds.has(idStr)) continue;
          if (!isTaskFlowExportedEvent(ev)) continue;
          const evTitle = normalizeCalendarTitle(ev?.title);
          if (!evTitle || !boardTitles.has(evTitle)) continue;

          deletedEventIds.add(idStr);
          opsExecuted++;
          if (opsExecuted % 5 === 0) {
            await sleepMs(20);
          }
          try {
            await addTombstoneAsync(idStr);
            await removeTaskFromCalendarAsync(idStr, { priority: 'high' });
            activeMap.delete(evId);
            windowData?.activeNativeIds?.delete(evId);
            removedCount++;
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  return { removedCount, clearedEventTaskIds };
};

/**
 * Crash-safe batch export of local tasks to Google / device calendar.
 * - Enforces per-board sync policy (standard/Main, birthdays/Events, expenses/Payments ON by default;
 *   grocery, media/Books, packing/Travel, habits, simple_list OFF by default unless toggled ON)
 * - Automatically removes previously exported [Synced from TaskFlow] events belonging to unsynced boards
 *   from Google Calendar while keeping the tasks untouched in the app
 * - Scoped to the active rolling sync window [-SYNC_PAST_DAYS, +SYNC_FUTURE_DAYS]
 * - Reuses prefetched calendar events to LINK matching events instead of creating duplicates
 * - Skips already-synced tasks whose calendar fingerprint hasn't changed
 * - Caps writes per batch (MAX_EVENTS_PER_SYNC_BATCH) with event-loop/GC yields
 */
export const syncAllTasksToCalendarAsync = async (tasks = [], settings = {}, prefetchedWindow = null, boards = []) => {
  if (Platform.OS === 'web') return { syncedCount: 0, removedCount: 0, eventMap: {}, hashMap: {}, clearedEventTaskIds: [] };
  const { calendarSyncEnabled, calendarPushEnabled, calendarAlarmsEnabled, selectedCalendarId, boardCalendarSync = {} } = settings;
  if (!calendarSyncEnabled) return { syncedCount: 0, removedCount: 0, eventMap: {}, hashMap: {}, clearedEventTaskIds: [] };
  const isPushActive = calendarPushEnabled === undefined ? CALENDAR_PUSH_DEFAULT_ENABLED : Boolean(calendarPushEnabled);
  if (!isPushActive) return { syncedCount: 0, removedCount: 0, eventMap: {}, hashMap: {}, clearedEventTaskIds: [] };

  try {
    const calendarId = prefetchedWindow?.calendarId || (await getTargetCalendarIdAsync(selectedCalendarId));
    if (!calendarId || !isValidNativeCalendarId(calendarId)) {
      return { syncedCount: 0, removedCount: 0, eventMap: {}, hashMap: {}, clearedEventTaskIds: [] };
    }

    const stringCalendarId = String(calendarId);
    const eventMap = {};
    const hashMap = {};
    const clearedEventTaskIds = [];
    let syncedCount = 0;
    let removedCount = 0;
    let exportsExecuted = 0;
    let removalsExecuted = 0;
    const now = prefetchedWindow?.now || new Date();

    // Build pre-export lookup of existing Google/device calendar events by (normalizedTitle, date)
    // so unlinked tasks on payments/birthdays/events/main link to existing events instead of duplicating them.
    const existingNativeByTitleDate = new Map();
    const claimedNativeIds = new Set();
    (tasks || []).forEach(t => {
      if (t?.calendarEventId) claimedNativeIds.add(String(t.calendarEventId).trim());
    });

    if (prefetchedWindow?.activeNativeEventMap) {
      for (const [evId, ev] of prefetchedWindow.activeNativeEventMap.entries()) {
        if (!ev?.title) continue;
        const normTitle = normalizeCalendarTitle(ev.title);
        const { dateStr } = parseCalendarEventDate(ev);
        if (!normTitle || !dateStr) continue;
        const key = `${normTitle}_${dateStr}`;
        if (!existingNativeByTitleDate.has(key)) existingNativeByTitleDate.set(key, []);
        existingNativeByTitleDate.get(key).push({
          id: String(evId),
          event: ev,
          isFromTaskFlow: isTaskFlowExportedEvent(ev),
        });
      }
    }

    DevLogger.log('[CalendarSync] Starting board-filtered window-scoped batch export', {
      totalTasks: tasks.length,
      calendarId: stringCalendarId,
    });

    // Prioritize unlinked Today/Tomorrow/Upcoming tasks FIRST so old missed tasks
    // and unsynced-board cleanups never starve Today/Tomorrow under MAX_EVENTS_PER_SYNC_BATCH.
    const orderedTasks = prioritizeTasksForCalendarExport(tasks, now);

    for (const task of orderedTasks) {
      if (!task) continue;
      const taskKey = task.id || task._id;
      if (!taskKey) continue;

      const existingEventId = task.calendarEventId ? String(task.calendarEventId).trim() : null;
      const isValidExistingId = existingEventId && (Platform.OS === 'android' ? /^\d+$/.test(existingEventId) : true);

      // Per-board calendar sync policy check:
      // If the task's board is OFF (e.g. Grocery, Books/Media, Travel/Packing, Habits, Simple List,
      // or explicitly toggled OFF by the user), NEVER export it and remove any old TaskFlow-exported event!
      const isBoardSynced = isTaskEligibleForCalendarSync(task, boards, boardCalendarSync);
      if (!isBoardSynced) {
        if (existingEventId) {
          const prefetchedEv = prefetchedWindow?.activeNativeEventMap?.get(existingEventId);
          const safeToDeleteFromCalendar = !task.syncedFromCalendar || (prefetchedEv && isTaskFlowExportedEvent(prefetchedEv));
          if (isValidExistingId && safeToDeleteFromCalendar && removalsExecuted < MAX_EVENTS_PER_SYNC_BATCH) {
            removalsExecuted++;
            if (removalsExecuted % 5 === 0) {
              await sleepMs(30);
            }
            try {
              await addTombstoneAsync(existingEventId);
              await removeTaskFromCalendarAsync(existingEventId);
              if (prefetchedWindow?.activeNativeEventMap) {
                prefetchedWindow.activeNativeEventMap.delete(existingEventId);
              }
              if (prefetchedWindow?.activeNativeIds) {
                prefetchedWindow.activeNativeIds.delete(existingEventId);
              }
              removedCount++;
            } catch (e) {}
          }
          clearedEventTaskIds.push(taskKey);
        }
        continue;
      }

      if (exportsExecuted >= MAX_EVENTS_PER_SYNC_BATCH) {
        DevLogger.log('[CalendarSync] Reached safe batch export cap', { cap: MAX_EVENTS_PER_SYNC_BATCH });
        continue;
      }
      if (task.completed) continue;

      const dateKey = extractTaskDateKey(task);
      if (!dateKey || !isDateStrInSyncWindow(dateKey, now, SYNC_PAST_DAYS, SYNC_FUTURE_DAYS)) {
        continue;
      }

      const fingerprint = getTaskCalendarFingerprint(task, calendarAlarmsEnabled);

      // Skip already-synced tasks whose content has not changed (avoids unnecessary native writes & cursor leaks)
      if (isValidExistingId && task.calendarSyncHash && task.calendarSyncHash === fingerprint) {
        continue;
      }

      // Pre-export deduplication: if task is unlinked, check whether an identical event
      // already exists in Google Calendar (e.g. from a prior sync or manually created).
      // Link it in place on its existing board instead of creating a duplicate calendar event!
      if (!isValidExistingId && existingNativeByTitleDate.size > 0) {
        const matchKey = `${getTaskMatchTitle(task)}_${dateKey}`;
        const nativeMatches = existingNativeByTitleDate.get(matchKey) || [];
        const availableMatch = nativeMatches.find(m => !claimedNativeIds.has(m.id));
        if (availableMatch) {
          claimedNativeIds.add(availableMatch.id);
          eventMap[taskKey] = availableMatch.id;
          hashMap[taskKey] = fingerprint;

          // Clean up any extra duplicate [Synced from TaskFlow] copies for the same (title, date)
          for (const extra of nativeMatches) {
            if (extra.id !== availableMatch.id && extra.isFromTaskFlow && !claimedNativeIds.has(extra.id)) {
              claimedNativeIds.add(extra.id);
              addTombstoneAsync(extra.id).catch(() => {});
              removeTaskFromCalendarAsync(extra.id).catch(() => {});
              if (prefetchedWindow?.activeNativeEventMap) {
                prefetchedWindow.activeNativeEventMap.delete(extra.id);
              }
            }
          }
          continue;
        }
      }

      const eventDetails = buildEventDetails(task, calendarAlarmsEnabled);
      if (!eventDetails) continue;
      const nativeDetails = toNativeEventDetails(eventDetails);

      exportsExecuted++;
      if (exportsExecuted % 5 === 0) {
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
          claimedNativeIds.add(idString);
          if (prefetchedWindow?.activeNativeIds) {
            prefetchedWindow.activeNativeIds.add(idString);
          }
          syncedCount++;
        }
      } catch (e) {
        DevLogger.warn(`[CalendarSync] Failed batch sync for task ${taskKey}`, e?.message || String(e));
        console.warn(`Failed batch sync for task ${taskKey}:`, e);
      }
    }

    return { syncedCount, removedCount, eventMap, hashMap, clearedEventTaskIds };
  } catch (error) {
    DevLogger.error('[CalendarSync] Failed to batch sync tasks to calendar', error?.message || String(error));
    console.warn('Failed to batch sync tasks to calendar:', error);
    return { syncedCount: 0, removedCount: 0, eventMap: {}, hashMap: {}, clearedEventTaskIds: [] };
  }
};

/**
 * Performs Chunked Differential Synchronization with device/Google calendar.
 * Implements:
 * 1. Cross-board duplicate cleanup for previously imported calendar copies on 'main'
 * 2. Per-board sync awareness (never ghost-deletes tasks on unsynced boards; removes orphaned
 *    [Synced from TaskFlow] calendar events that match unsynced boards like Grocery/Books/Habits)
 * 3. Chunked 14-day native queries across [Today - SYNC_PAST_DAYS, Today + SYNC_FUTURE_DAYS]
 *    (or reuses prefetchedWindow to avoid redundant native reads)
 * 4. Cross-board matching across ALL boards so existing board tasks are NEVER duplicated onto 'main'
 * 5. Window-Scoped Ghost Deletion Detection (only runs when all chunks succeeded!)
 */
export const performDifferentialCalendarSyncAsync = async (settings = {}, existingTasks = [], prefetchedWindow = null, boards = []) => {
  if (Platform.OS === 'web') {
    return { hasChanges: false, newTasks: [], updatedTasks: [], deletedTaskIds: [], clearedEventTaskIds: [], importedCount: 0, deletedCount: 0 };
  }
  const { calendarSyncEnabled, boardCalendarSync = {} } = settings;
  if (!calendarSyncEnabled) {
    return { hasChanges: false, newTasks: [], updatedTasks: [], deletedTaskIds: [], clearedEventTaskIds: [], importedCount: 0, deletedCount: 0 };
  }

  try {
    const windowData = prefetchedWindow || (await fetchCalendarWindowEventsAsync(settings));
    const { calendarId, activeNativeEventMap, activeNativeIds, allChunksSucceeded, now } = windowData;
    if (!calendarId) {
      return { hasChanges: false, newTasks: [], updatedTasks: [], deletedTaskIds: [], clearedEventTaskIds: [], importedCount: 0, deletedCount: 0 };
    }

    // 0. Automatic Cross-Board Duplicate Cleanup:
    // Removes previously imported `syncedFromCalendar` duplicates on 'main' when an authoritative
    // task with the same (title, date) or same title on an unsynced non-Main board already exists.
    const dedupPlan = buildTaskDeduplicationPlan(existingTasks, boards, boardCalendarSync);
    const deletedTaskIds = [...dedupPlan.duplicateTaskIds];
    const deletedIdSet = new Set(deletedTaskIds.map(String));
    const clearedEventTaskIds = [];
    const updatedTasks = [];

    const linkTransferByTaskId = new Map();
    dedupPlan.linkTransfers.forEach(tr => {
      linkTransferByTaskId.set(String(tr.taskId), tr.calendarEventId);
      updatedTasks.push({
        taskId: tr.taskId,
        calendarEventId: tr.calendarEventId,
      });
    });

    // Clean up extra orphan [Synced from TaskFlow] calendar events left behind by duplicate imports
    for (const orphanCalId of dedupPlan.orphanCalendarEventIds) {
      const ev = activeNativeEventMap.get(String(orphanCalId));
      if (!ev || isTaskFlowExportedEvent(ev)) {
        addTombstoneAsync(orphanCalId).catch(() => {});
        removeTaskFromCalendarAsync(orphanCalId).catch(() => {});
        activeNativeEventMap.delete(String(orphanCalId));
        activeNativeIds.delete(String(orphanCalId));
      }
    }

    // Build effective working task list (excluding removed main duplicates, with transferred links applied)
    const effectiveTasks = (existingTasks || [])
      .filter(t => {
        if (!t) return false;
        const tid = t.id || t._id;
        return !tid || !deletedIdSet.has(String(tid));
      })
      .map(t => {
        const tid = t.id || t._id;
        if (tid && linkTransferByTaskId.has(String(tid))) {
          return { ...t, calendarEventId: linkTransferByTaskId.get(String(tid)) };
        }
        return t;
      });

    // Load active tombstone IDs (recently deleted in TaskFlow)
    const tombstones = await getTombstonesAsync();

    // 2. Window-Scoped Ghost Deletion Detection:
    // ONLY evaluate deletions if all chunks succeeded, the task's board has calendar sync enabled,
    // the task is past the recent-write propagation grace window, AND direct native verification
    // via Calendar.getEventByIdAsync confirms the event is genuinely deleted from Google Calendar.
    // In fetch-only mode (!isPushActive), ONLY check tasks that were fetched from the calendar
    // (`task.syncedFromCalendar === true`), never user-created TaskFlow tasks.
    const isPushActive = settings?.calendarPushEnabled === undefined
      ? CALENDAR_PUSH_DEFAULT_ENABLED
      : Boolean(settings.calendarPushEnabled);
    if (allChunksSucceeded) {
      const nowMs = now instanceof Date ? now.getTime() : Date.now();
      for (const task of effectiveTasks) {
        if (!task || !task.calendarEventId) continue;
        if (!isPushActive && !task.syncedFromCalendar) continue;
        if (!isTaskEligibleForCalendarSync(task, boards, boardCalendarSync)) continue;
        if (isTaskRecentlyCreatedOrUpdated(task, nowMs)) continue;

        const taskDateStr = extractTaskDateKey(task);
        if (!taskDateStr) continue;

        if (isDateStrInSyncWindow(taskDateStr, now, SYNC_PAST_DAYS, SYNC_FUTURE_DAYS)) {
          const taskCalId = String(task.calendarEventId).trim();
          if (!activeNativeIds.has(taskCalId)) {
            const stillExists = await verifyCalendarEventExistsAsync(taskCalId);
            if (stillExists) {
              activeNativeIds.add(taskCalId);
              continue;
            }
            const tid = task.id || task._id;
            if (tid && !deletedIdSet.has(String(tid))) {
              deletedTaskIds.push(tid);
              deletedIdSet.add(String(tid));
            }
          }
        }
      }
    }

    // 3. Process Active Native Events (Updates & Imports) using Cross-Board Index
    const taskIndex = buildTaskCalendarIndex(effectiveTasks);
    const importTargetBoardId = getImportTargetBoardId(boards, boardCalendarSync);
    const newTasks = [];
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

      const isFromTaskFlow = isTaskFlowExportedEvent(event);
      const cleanNotes = sanitizeCalendarText(
        String(event.notes || '').replace(/\[Synced from TaskFlow\]/g, ''),
        1800
      );

      const match = findMatchingTaskForCalendarEvent(
        { eventCalId, cleanTitle, dateStr, isFromTaskFlow },
        taskIndex,
        deletedIdSet
      );

      if (match.matchType === 'linked' && match.task) {
        const existingLinkedTask = match.task;
        const linkedTaskId = existingLinkedTask.id || existingLinkedTask._id;

        // If a previous sync mistakenly loopback-imported a [Synced from TaskFlow] event onto Main
        // as a `syncedFromCalendar: true` task, purge both the bogus Main task and the orphan calendar event!
        if (isFromTaskFlow && existingLinkedTask.syncedFromCalendar === true) {
          addTombstoneAsync(eventCalId).catch(() => {});
          removeTaskFromCalendarAsync(eventCalId).catch(() => {});
          if (linkedTaskId && !deletedIdSet.has(String(linkedTaskId))) {
            deletedTaskIds.push(linkedTaskId);
            deletedIdSet.add(String(linkedTaskId));
          }
          continue;
        }

        // If this linked task sits on a board whose calendar sync is OFF, remove the old
        // [Synced from TaskFlow] calendar event and clear calendarEventId without deleting the task!
        if (!isTaskEligibleForCalendarSync(existingLinkedTask, boards, boardCalendarSync)) {
          if (isFromTaskFlow || !existingLinkedTask.syncedFromCalendar) {
            addTombstoneAsync(eventCalId).catch(() => {});
            removeTaskFromCalendarAsync(eventCalId).catch(() => {});
          }
          if (linkedTaskId) clearedEventTaskIds.push(linkedTaskId);
          continue;
        }

        const titleChanged = existingLinkedTask.taskname !== cleanTitle;
        const dateChanged = extractTaskDateKey(existingLinkedTask) !== dateStr;
        const timeChanged = (existingLinkedTask.time || '') !== timeStr;
        const completionChanged = isCompleted && !existingLinkedTask.completed;

        if (titleChanged || dateChanged || timeChanged || completionChanged) {
          const nextTaskSnapshot = {
            ...existingLinkedTask,
            taskname: cleanTitle,
            completionDate: dateStr,
            dateString: dateStr,
            time: timeStr,
            completed: completionChanged ? true : existingLinkedTask.completed,
            ...(cleanNotes ? { description: { ...(existingLinkedTask.description || {}), text: cleanNotes } } : {})
          };
          updatedTasks.push({
            taskId: linkedTaskId,
            name: cleanTitle,
            completionDate: dateStr,
            time: timeStr,
            completed: nextTaskSnapshot.completed,
            calendarSyncHash: getTaskCalendarFingerprint(nextTaskSnapshot, Boolean(settings?.calendarAlarmsEnabled)),
            ...(cleanNotes ? { description: nextTaskSnapshot.description } : {})
          });
        }
        continue;
      }

      if (match.matchType === 'unlinked' && match.task) {
        const unlinkedTask = match.task;
        const unlinkedId = unlinkedTask.id || unlinkedTask._id;

        // If the matched task lives on an UNSYNCED board (e.g. Grocery, Books, Travel, Habits, Simple List):
        // Remove orphaned [Synced from TaskFlow] event from Google Calendar and never import a duplicate!
        if (!isTaskEligibleForCalendarSync(unlinkedTask, boards, boardCalendarSync)) {
          if (isFromTaskFlow) {
            addTombstoneAsync(eventCalId).catch(() => {});
            removeTaskFromCalendarAsync(eventCalId).catch(() => {});
          }
          if (unlinkedId && unlinkedTask.calendarEventId) {
            clearedEventTaskIds.push(unlinkedId);
          }
          continue;
        }

        // Bind calendarEventId to the existing synced-board task in place (payments, birthdays, events, main)
        unlinkedTask.calendarEventId = eventCalId;
        taskIndex.byCalEventId.set(String(eventCalId), unlinkedTask);
        updatedTasks.push({
          taskId: unlinkedId,
          calendarEventId: eventCalId,
          calendarSyncHash: getTaskCalendarFingerprint(unlinkedTask, Boolean(settings?.calendarAlarmsEnabled)),
        });
        continue;
      }

      if (match.matchType === 'already_exists' && match.task) {
        // A task with the same title (& date or across board) already exists on another board or main.
        // Never create a duplicate copy on 'main'!
        const matchedTask = match.task;
        const matchedTaskId = matchedTask.id || matchedTask._id;
        const existingCalId = matchedTask.calendarEventId ? String(matchedTask.calendarEventId).trim() : '';

        if (!isTaskEligibleForCalendarSync(matchedTask, boards, boardCalendarSync)) {
          if (isFromTaskFlow) {
            addTombstoneAsync(eventCalId).catch(() => {});
            removeTaskFromCalendarAsync(eventCalId).catch(() => {});
          }
          if (matchedTaskId && existingCalId) {
            clearedEventTaskIds.push(matchedTaskId);
          }
          continue;
        }

        if (isFromTaskFlow && (
          !existingCalId ||
          existingCalId !== String(eventCalId) ||
          extractTaskDateKey(matchedTask) !== dateStr
        )) {
          // Extra duplicate or stale event previously exported by TaskFlow -> clean it up from calendar
          addTombstoneAsync(eventCalId).catch(() => {});
          removeTaskFromCalendarAsync(eventCalId).catch(() => {});
        }
        continue;
      }

      // CRITICAL LOOPBACK & ORPHAN GUARD:
      // Events carrying `[Synced from TaskFlow]` were exported by TaskFlow, NEVER created externally in Google Calendar.
      // If a `[Synced from TaskFlow]` event does not match any eligible local task (e.g. its task or board was deleted,
      // or its board's calendar sync was turned OFF), delete it from Google Calendar and NEVER import it onto Main!
      if (isFromTaskFlow) {
        addTombstoneAsync(eventCalId).catch(() => {});
        removeTaskFromCalendarAsync(eventCalId).catch(() => {});
        continue;
      }

      // Guard max newly imported tasks per sync to protect memory on huge shared calendars
      if (newTasks.length >= MAX_IMPORTS_PER_SYNC) {
        continue;
      }

      // Genuinely new event from Google Calendar / Native Calendar not on any board -> Import into synced target board
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
        boardId: importTargetBoardId,
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
      taskIndex.byCalEventId.set(String(eventCalId), importedTask);
      const normKey = `${normalizeCalendarTitle(cleanTitle)}_${dateStr}`;
      if (!taskIndex.byNameAndDate.has(normKey)) taskIndex.byNameAndDate.set(normKey, []);
      taskIndex.byNameAndDate.get(normKey).push(importedTask);
    }

    const hasChanges = deletedTaskIds.length > 0 || clearedEventTaskIds.length > 0 || newTasks.length > 0 || updatedTasks.length > 0;

    return {
      hasChanges,
      newTasks,
      updatedTasks,
      deletedTaskIds,
      clearedEventTaskIds,
      importedCount: newTasks.length,
      deletedCount: deletedTaskIds.length
    };
  } catch (error) {
    DevLogger.error('[CalendarSync] Failed differential sync', error?.message || String(error));
    console.warn('Failed to differential sync events from calendar:', error);
    return { hasChanges: false, newTasks: [], updatedTasks: [], deletedTaskIds: [], clearedEventTaskIds: [], importedCount: 0, deletedCount: 0 };
  }
};

/**
 * Backward compatibility alias for performDifferentialCalendarSyncAsync
 */
export const importCalendarEventsAsync = async (settings = {}, existingTasks = []) => {
  return await performDifferentialCalendarSyncAsync(settings, existingTasks);
};
