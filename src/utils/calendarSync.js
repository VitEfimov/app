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
 * Batch sync multiple tasks to device calendar (exports tasks to calendar)
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

/**
 * Imports/synchronizes events from device/Google calendar to local tasks (two-way sync)
 */
export const importCalendarEventsAsync = async (settings = {}, existingTasks = []) => {
  if (Platform.OS === 'web') return { newTasks: [], updatedTasks: [], importedCount: 0 };
  const { calendarSyncEnabled, selectedCalendarId } = settings;
  if (!calendarSyncEnabled) return { newTasks: [], updatedTasks: [], importedCount: 0 };

  try {
    const hasPermission = await checkCalendarPermissionsAsync();
    if (!hasPermission) return { newTasks: [], updatedTasks: [], importedCount: 0 };

    const calendarId = await getTargetCalendarIdAsync(selectedCalendarId);
    if (!calendarId) return { newTasks: [], updatedTasks: [], importedCount: 0 };

    // Fetch events from 30 days ago to 180 days in future
    const startDate = dayjs().subtract(30, 'day').startOf('day').toDate();
    const endDate = dayjs().add(180, 'day').endOf('day').toDate();

    const calendarEvents = await Calendar.getEventsAsync([calendarId], startDate, endDate);
    if (!calendarEvents || calendarEvents.length === 0) {
      return { newTasks: [], updatedTasks: [], importedCount: 0 };
    }

    const taskByCalEventId = new Map();
    const taskByNameAndDate = new Map();

    (existingTasks || []).forEach(t => {
      if (!t) return;
      if (t.calendarEventId) {
        taskByCalEventId.set(String(t.calendarEventId), t);
      }
      const dateKey = t.dateString || (t.completionDate ? (typeof t.completionDate === 'string' ? t.completionDate.split('T')[0] : dayjs(t.completionDate).format('YYYY-MM-DD')) : '');
      if (t.taskname && dateKey) {
        const key = `${t.taskname.trim().toLowerCase()}_${dateKey}`;
        taskByNameAndDate.set(key, t);
      }
    });

    const newTasks = [];
    const updatedTasks = [];
    let counter = 0;

    for (const event of calendarEvents) {
      counter++;
      if (counter % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      if (!event || event.status === 'CANCELED' || !event.title) continue;

      const eventCalId = String(event.id);
      const isCompleted = event.title.startsWith('✓ ');
      const cleanTitle = event.title.replace(/^✓\s*/, '').trim() || 'Calendar Event';
      
      const startDay = dayjs(event.startDate);
      const dateStr = startDay.format('YYYY-MM-DD');
      const timeStr = event.allDay ? '' : startDay.format('HH:mm');
      
      const cleanNotes = (event.notes || '')
        .replace(/\[Synced from TaskFlow\]/g, '')
        .trim();

      // Check if already mapped to a task
      const existingLinkedTask = taskByCalEventId.get(eventCalId);
      if (existingLinkedTask) {
        // Event is already linked to this task. Check if calendar updated
        const titleChanged = existingLinkedTask.taskname !== cleanTitle;
        const dateChanged = existingLinkedTask.completionDate !== dateStr;
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
        // Just link them up
        updatedTasks.push({
          taskId: unlinkedMatch.id,
          calendarEventId: eventCalId
        });
        taskByCalEventId.set(eventCalId, unlinkedMatch);
        continue;
      }

      // This is a new event from Google Calendar / device calendar! Import it into TaskFlow
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
      // Register in map to prevent duplicate creates if calendar has multiple instances
      taskByCalEventId.set(eventCalId, { id: uniqueId });
    }

    return {
      newTasks,
      updatedTasks,
      importedCount: newTasks.length
    };
  } catch (error) {
    console.warn('Failed to import events from calendar:', error);
    return { newTasks: [], updatedTasks: [], importedCount: 0 };
  }
};
