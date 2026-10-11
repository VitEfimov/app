import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import dayjs from 'dayjs';

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

  const dateStr = task.dateString || (typeof task.completionDate === 'string' ? task.completionDate.split('T')[0] : dayjs(task.completionDate).format('YYYY-MM-DD'));
  const hasTime = !!(task.time && task.time.trim() !== '');

  let startDate;
  let endDate;
  let allDay = false;

  if (hasTime) {
    startDate = dayjs(`${dateStr}T${task.time}`).toDate();
    endDate = dayjs(startDate).add(30, 'minute').toDate();
    allDay = false;
  } else {
    startDate = dayjs(dateStr).startOf('day').toDate();
    endDate = dayjs(dateStr).endOf('day').toDate();
    allDay = true;
  }

  // Alarms: By default, alarms: [] to avoid duplicate notifications (app push handles reminders).
  // If user enabled calendar alarms in settings, attach relative offset.
  const alarms = [];
  if (calendarAlarmsEnabled && task.reminder && task.reminder !== 'None') {
    const offset = getAlarmOffsetMinutes(task.reminder);
    if (offset !== null) {
      alarms.push({ relativeOffset: offset });
    }
  }

  const cleanDescription = task.description?.text
    ? task.description.text.replace(/<[^>]+>/g, '').trim()
    : '';

  return {
    title: task.completed ? `✓ ${task.taskname}` : task.taskname,
    startDate,
    endDate,
    allDay,
    notes: cleanDescription ? `${cleanDescription}\n\n[Synced from TaskFlow]` : '[Synced from TaskFlow]',
    alarms,
    availability: Calendar.Availability.BUSY,
  };
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
      try {
        await Calendar.updateEventAsync(String(task.calendarEventId), eventDetails);
        return task.calendarEventId;
      } catch (updateErr) {
        // Event might have been deleted from calendar externally; recreate
      }
    }

    // Create new event
    const newEventId = await Calendar.createEventAsync(calendarId, eventDetails);
    return newEventId;
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
  try {
    await Calendar.deleteEventAsync(String(calendarEventId));
  } catch (error) {
    // Silently ignore if already removed
  }
};

/**
 * Batch sync multiple tasks to device calendar
 */
export const syncAllTasksToCalendarAsync = async (tasks = [], settings = {}) => {
  if (Platform.OS === 'web') return { syncedCount: 0, eventMap: {} };
  const { calendarSyncEnabled, calendarAlarmsEnabled, selectedCalendarId } = settings;
  if (!calendarSyncEnabled) return { syncedCount: 0, eventMap: {} };

  try {
    const calendarId = await getTargetCalendarIdAsync(selectedCalendarId);
    if (!calendarId) return { syncedCount: 0, eventMap: {} };

    const eventMap = {};
    let syncedCount = 0;

    for (const task of tasks) {
      if (task && task.completionDate && !task.completed) {
        const eventDetails = buildEventDetails(task, calendarAlarmsEnabled);
        if (eventDetails) {
          try {
            let eventId = task.calendarEventId;
            if (eventId) {
              try {
                await Calendar.updateEventAsync(String(eventId), eventDetails);
              } catch (e) {
                eventId = await Calendar.createEventAsync(calendarId, eventDetails);
              }
            } else {
              eventId = await Calendar.createEventAsync(calendarId, eventDetails);
            }
            if (eventId) {
              eventMap[task.id] = eventId;
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
