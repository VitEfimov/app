import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';

export const SYNC_PAST_DAYS = 30;
export const SYNC_FUTURE_DAYS = 90;
const TOMBSTONES_STORAGE_KEY = 'calendar_deleted_tombstones';
const TOMBSTONE_TTL_MS = 15 * 60 * 1000; // 15-minute TTL to prevent resurrection

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
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
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
    const { status } = await Calendar.requestCalendarPermissionsAsync();
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

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars.filter(cal => cal.allowsModifications !== false && cal.isPrimary !== undefined);
  } catch (error) {
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

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (!calendars || calendars.length === 0) return null;

    // 1. If preferred ID is provided and exists among writable calendars
    if (preferredCalendarId) {
      const match = calendars.find(c => String(c.id) === String(preferredCalendarId) && c.allowsModifications !== false);
      if (match) return match.id;
    }

    // 2. On iOS, default calendar is usually available
    if (Platform.OS === 'ios') {
      try {
        const defaultCal = await Calendar.getDefaultCalendarAsync();
        if (defaultCal && defaultCal.allowsModifications !== false) {
          return defaultCal.id;
        }
      } catch (e) {}
    }

    // 3. On Android or fallback: find primary Google calendar or primary account
    const primaryGoogle = calendars.find(
      c => c.allowsModifications !== false &&
           (c.isPrimary || c.source?.name?.includes('@') || c.source?.type === 'com.google' || c.ownerAccount?.includes('@'))
    );
    if (primaryGoogle) return primaryGoogle.id;

    // 4. Any writable calendar
    const anyWritable = calendars.find(c => c.allowsModifications !== false);
    if (anyWritable) return anyWritable.id;

    return null;
  } catch (error) {
    console.warn('Error resolving target calendar ID:', error);
    return null;
  }
};

/**
 * Converts task reminder text into calendar alarm offset in minutes
 */
const getAlarmOffsetMinutes = (reminder) => {
  if (!reminder || reminder === 'None') return null;
  const rem = reminder.toLowerCase();
  if (rem.includes('15 min')) return -15;
  if (rem.includes('30 min')) return -30;
  if (rem.includes('1 hr') || rem.includes('1 hour')) return -60;
  if (rem.includes('1 day')) return -1440;
  if (rem.includes('day of')) return 0;
  return -15;
};

/**
 * Constructs event details from a task and calendar settings
 */
export const buildEventDetails = (task, calendarAlarmsEnabled = false) => {
  if (!task || !task.completionDate) return null;

  let rawDate = task.dateString;
  if (!rawDate && typeof task.completionDate === 'string') {
    rawDate = task.completionDate.split('T')[0];
  } else if (!rawDate && task.completionDate) {
    rawDate = dayjs(task.completionDate).format('YYYY-MM-DD');
  }

  if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const parsed = dayjs(task.completionDate);
    if (!parsed.isValid()) return null;
    rawDate = parsed.format('YYYY-MM-DD');
  }

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
    const dayStart = dayjs(rawDate).startOf('day');
    const dayEnd = dayjs(rawDate).endOf('day');
    if (!dayStart.isValid()) return null;
    startDate = dayStart.toDate();
    endDate = dayEnd.toDate();
    allDay = true;
  }

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return null;
  }

  // Alarms: Only attach alarms if user enabled calendar alarms in settings and reminder is set
  const alarms = [];
  if (calendarAlarmsEnabled && task.reminder && task.reminder !== 'None') {
    const offset = getAlarmOffsetMinutes(task.reminder);
    if (offset !== null) {
      alarms.push({ relativeOffset: offset });
    }
  }

  const cleanDescription = task.description?.text
    ? String(task.description.text).replace(/<[^>]+>/g, '').trim()
    : '';

  const cleanTitle = (task.taskname ? String(task.taskname).trim() : 'Task') || 'Task';

  const details = {
    title: task.completed ? `✓ ${cleanTitle}` : cleanTitle,
    startDate,
    endDate,
    allDay,
    notes: cleanDescription ? `${cleanDescription}\n\n[Synced from TaskFlow]` : '[Synced from TaskFlow]',
    availability: Calendar.Availability.BUSY,
  };

  if (allDay) {
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
    if (!calendarId) return null;

    const eventDetails = buildEventDetails(task, calendarAlarmsEnabled);
    if (!eventDetails) return null;

    // If task already has a calendar event ID, try to update it
    if (task.calendarEventId) {
      const eventIdStr = String(task.calendarEventId);
      const isNumericId = /^\d+$/.test(eventIdStr);
      const canUpdate = Platform.OS === 'android' ? isNumericId : !!eventIdStr;
      if (canUpdate) {
        try {
          await Calendar.updateEventAsync(eventIdStr, eventDetails);
          return eventIdStr;
        } catch (updateErr) {
          // Event might have been deleted from calendar externally; recreate below
        }
      }
    }

    // Create new event
    const newEventId = await Calendar.createEventAsync(String(calendarId), eventDetails);
    return newEventId ? String(newEventId) : null;
  } catch (error) {
    console.warn(`Failed to sync task "${task.taskname}" to calendar:`, error);
    return null;
  }
};

/**
 * Removes an event from the device calendar
 */
export const removeTaskFromCalendarAsync = async (calendarEventId) => {
  if (Platform.OS === 'web' || !calendarEventId) return;
  const idStr = String(calendarEventId);
  if (Platform.OS === 'android' && !/^\d+$/.test(idStr)) return;
  try {
    await Calendar.deleteEventAsync(idStr);
  } catch (error) {
    // Silently ignore if already removed
  }
};

/**
 * Batch sync multiple tasks to device calendar (exports tasks to calendar)
 */
export const syncAllTasksToCalendarAsync = async (tasks = [], settings = {}) => {
  if (Platform.OS === 'web') return { syncedCount: 0, eventMap: {} };
  const { calendarSyncEnabled, calendarAlarmsEnabled, selectedCalendarId } = settings;
  if (!calendarSyncEnabled) return { syncedCount: 0, eventMap: {} };

  try {
    const calendarId = await getTargetCalendarIdAsync(selectedCalendarId);
    if (!calendarId) return { syncedCount: 0, eventMap: {} };

    const stringCalendarId = String(calendarId);
    const eventMap = {};
    let syncedCount = 0;
    let index = 0;

    for (const task of tasks) {
      if (task && task.completionDate && !task.completed) {
        index++;
        if (index % 3 === 0) {
          // Yield to JS event loop so UI thread stays responsive and does not freeze
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        const eventDetails = buildEventDetails(task, calendarAlarmsEnabled);
        if (eventDetails) {
          try {
            let eventId = task.calendarEventId ? String(task.calendarEventId) : null;
            const isNumericId = eventId && /^\d+$/.test(eventId);
            const canUpdate = Platform.OS === 'android' ? isNumericId : !!eventId;

            if (canUpdate) {
              try {
                await Calendar.updateEventAsync(eventId, eventDetails);
              } catch (e) {
                eventId = await Calendar.createEventAsync(stringCalendarId, eventDetails);
              }
            } else {
              eventId = await Calendar.createEventAsync(stringCalendarId, eventDetails);
            }
            if (eventId) {
              const idString = String(eventId);
              eventMap[task.id] = idString;
              syncedCount++;
            }
          } catch (e) {
            console.warn(`Failed batch sync for task ${task.id}:`, e);
          }
        }
      }
    }

    return { syncedCount, eventMap };
  } catch (error) {
    console.warn('Failed to batch sync tasks to calendar:', error);
    return { syncedCount: 0, eventMap: {} };
  }
};

/**
 * Performs Foreground Differential Synchronization with device/Google calendar.
 * Implements:
 * 1. Strict Rolling Time Horizon [Today - 30 days, Today + 90 days]
 * 2. Window-Scoped Ghost Deletion Detection (prevents false-wiping out-of-boundary tasks)
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
    if (!calendarId) {
      return { hasChanges: false, newTasks: [], updatedTasks: [], deletedTaskIds: [], importedCount: 0, deletedCount: 0 };
    }

    // 1. Strict Rolling Time Window: [Today - 30 days, Today + 90 days]
    const windowStart = dayjs().subtract(SYNC_PAST_DAYS, 'day').startOf('day');
    const windowEnd = dayjs().add(SYNC_FUTURE_DAYS, 'day').endOf('day');

    let calendarEvents = [];
    try {
      calendarEvents = await Calendar.getEventsAsync([String(calendarId)], windowStart.toDate(), windowEnd.toDate());
    } catch (e) {
      console.warn('Calendar.getEventsAsync error:', e);
      return { hasChanges: false, newTasks: [], updatedTasks: [], deletedTaskIds: [], importedCount: 0, deletedCount: 0 };
    }
    
    // Collect active native IDs and map
    const activeNativeEventMap = new Map();
    const activeNativeIds = new Set();
    (calendarEvents || []).forEach(event => {
      if (event && event.id && event.status !== 'CANCELED') {
        const idStr = String(event.id);
        activeNativeIds.add(idStr);
        activeNativeEventMap.set(idStr, event);
      }
    });

    // Load active tombstone IDs (recently deleted in TaskFlow)
    const tombstones = await getTombstonesAsync();

    // 2. Window-Scoped Ghost Deletion Detection:
    // Only evaluate tasks whose completionDate falls strictly within [windowStart, windowEnd].
    // Tasks scheduled outside the window are protected from false deletion.
    const deletedTaskIds = [];
    (existingTasks || []).forEach(task => {
      if (!task || !task.calendarEventId) return;

      const taskDateStr = task.dateString || (typeof task.completionDate === 'string' ? task.completionDate.split('T')[0] : (task.completionDate ? dayjs(task.completionDate).format('YYYY-MM-DD') : null));
      if (!taskDateStr) return;

      const taskDay = dayjs(taskDateStr);
      if (!taskDay.isValid()) return;

      const isInWindow = (taskDay.isSame(windowStart, 'day') || taskDay.isAfter(windowStart, 'day')) &&
                         (taskDay.isSame(windowEnd, 'day') || taskDay.isBefore(windowEnd, 'day'));

      if (isInWindow) {
        const taskCalId = String(task.calendarEventId);
        if (!activeNativeIds.has(taskCalId)) {
          // Native event no longer exists in calendar -> Ghost deletion detected!
          deletedTaskIds.push(task.id);
        }
      }
    });

    // 3. Process Active Native Events (Updates & Imports)
    const taskByCalEventId = new Map();
    const taskByNameAndDate = new Map();

    (existingTasks || []).forEach(t => {
      if (!t) return;
      if (t.calendarEventId) {
        taskByCalEventId.set(String(t.calendarEventId), t);
      }
      const dateKey = t.dateString || (t.completionDate ? (typeof t.completionDate === 'string' ? t.completionDate.split('T')[0] : dayjs(t.completionDate).format('YYYY-MM-DD')) : '');
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
      if (counter % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      if (!event.title) continue;

      // Anti-Resurrection Guard: If user recently deleted this task in TaskFlow,
      // do not re-import it as a new task. Asynchronously purge the orphaned native event.
      if (tombstones.has(eventCalId)) {
        try {
          Calendar.deleteEventAsync(eventCalId).catch(() => {});
        } catch (e) {}
        continue;
      }

      const isCompleted = event.title.startsWith('✓ ');
      const cleanTitle = event.title.replace(/^✓\s*/, '').trim() || 'Calendar Event';
      const { dateStr, timeStr } = parseCalendarEventDate(event);
      
      const cleanNotes = (event.notes || '')
        .replace(/\[Synced from TaskFlow\]/g, '')
        .trim();

      // Check if already mapped to a task
      const existingLinkedTask = taskByCalEventId.get(eventCalId);
      if (existingLinkedTask) {
        // Skip if task was marked for deletion
        if (deletedTaskIds.includes(existingLinkedTask.id)) continue;

        const titleChanged = existingLinkedTask.taskname !== cleanTitle;
        const dateChanged = (existingLinkedTask.dateString || existingLinkedTask.completionDate) !== dateStr;
        const timeChanged = (existingLinkedTask.time || '') !== timeStr;
        const completionChanged = isCompleted && !existingLinkedTask.completed;

        if (titleChanged || dateChanged || timeChanged || completionChanged) {
          updatedTasks.push({
            taskId: existingLinkedTask.id,
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
        if (!deletedTaskIds.includes(unlinkedMatch.id)) {
          updatedTasks.push({
            taskId: unlinkedMatch.id,
            calendarEventId: eventCalId
          });
          taskByCalEventId.set(eventCalId, unlinkedMatch);
          continue;
        }
      }

      // New event from Google Calendar / Native Calendar -> Import into TaskFlow
      const nowIso = new Date().toISOString();
      const uniqueId = `cal_${eventCalId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      newTasks.push({
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
      });
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
