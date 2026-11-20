import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { CryptoStorage } from './cryptoStorage';
import { updateRecurringAutomations } from './notifications';

export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

/**
 * Resolves the active encrypted task storage key matching App.js & taskSlice.js
 * (authenticated user email key -> guest key -> default 'tasks' key).
 */
async function resolveActiveTaskStorageKeyAsync() {
  try {
    const [isGuestVal, rememberedVal] = await Promise.all([
      CryptoStorage.getItem('isGuest'),
      CryptoStorage.getItem('rememberedUser'),
    ]);

    if (isGuestVal !== 'true' && rememberedVal) {
      const remUser = JSON.parse(rememberedVal);
      if (remUser && remUser.rememberMe && remUser.email) {
        return `tasks_${remUser.email.toLowerCase().trim()}`;
      }
    }

    if (isGuestVal === 'true') {
      return 'tasks_guest';
    }
  } catch (e) {}

  return 'tasks_guest';
}

/**
 * Performs headless bi-directional calendar sync if enabled and a scheduled
 * 3x/day sync slot (08:00, 12:00, 17:00) is due.
 */
export async function runHeadlessCalendarSyncIfDueAsync(themeState, tasks = [], taskKey = 'tasks_guest', now = new Date()) {
  if (Platform.OS === 'web' || !themeState?.calendarSyncEnabled) {
    return { ran: false, tasks };
  }

  try {
    const {
      fetchCalendarWindowEventsAsync,
      buildTaskDeduplicationPlan,
      syncAllTasksToCalendarAsync,
      performDifferentialCalendarSyncAsync,
      getCalendarSyncScheduleStateAsync,
      markCalendarSyncCompletedAsync,
      isScheduledCalendarSyncDue,
    } = require('./calendarSync');

    const scheduleState = await getCalendarSyncScheduleStateAsync();
    const dueInfo = isScheduledCalendarSyncDue(scheduleState.lastSyncedSlotKey, now);

    if (!dueInfo.isDue) {
      return { ran: false, tasks, nextSyncTime: dueInfo.nextSyncTime };
    }

    // 0. Prefetch calendar window ONCE & deduplicate previously imported main duplicates
    const prefetchedWindow = await fetchCalendarWindowEventsAsync(themeState);
    const dedupPlan = buildTaskDeduplicationPlan(tasks);
    const dupIdSet = new Set(dedupPlan.duplicateTaskIds.map(String));
    const transferMap = new Map(dedupPlan.linkTransfers.map(tr => [String(tr.taskId), tr.calendarEventId]));

    const tasksBeforeExport = (tasks || [])
      .filter(t => {
        if (!t) return false;
        const tid = t.id || t._id;
        return !tid || !dupIdSet.has(String(tid));
      })
      .map(t => {
        const tid = t.id || t._id;
        if (tid && transferMap.has(String(tid))) {
          return { ...t, calendarEventId: transferMap.get(String(tid)) };
        }
        return t;
      });

    // 1. Export/link local tasks with due dates to Google / device calendar
    const { syncedCount = 0, eventMap = {}, hashMap = {} } = await syncAllTasksToCalendarAsync(
      tasksBeforeExport,
      themeState,
      prefetchedWindow
    );

    let currentList = (tasks || []).map(t => {
      if (!t) return t;
      const tid = t.id || t._id;
      const nextCalId = (tid && eventMap && eventMap[tid]) || (tid && transferMap.get(String(tid))) || t.calendarEventId;
      const nextHash = (tid && hashMap && hashMap[tid]) || t.calendarSyncHash;
      if (nextCalId !== t.calendarEventId || nextHash !== t.calendarSyncHash) {
        return {
          ...t,
          ...(nextCalId ? { calendarEventId: nextCalId } : {}),
          ...(nextHash ? { calendarSyncHash: nextHash } : {}),
        };
      }
      return t;
    });

    // 2. Differential sync from Google / device calendar back to local tasks (reusing prefetchedWindow)
    const diffResult = await performDifferentialCalendarSyncAsync(themeState, currentList, prefetchedWindow);
    const hasEventMapChanges = Object.keys(eventMap || {}).length > 0 || dedupPlan.duplicateTaskIds.length > 0 || dedupPlan.linkTransfers.length > 0;

    if (diffResult && diffResult.hasChanges) {
      const { deletedTaskIds = [], updatedTasks = [], newTasks = [] } = diffResult;
      const mergedDeletedIds = Array.from(new Set([...dedupPlan.duplicateTaskIds, ...deletedTaskIds].map(String)));
      if (mergedDeletedIds.length > 0) {
        const delSet = new Set(mergedDeletedIds);
        currentList = currentList.filter(t => t && !delSet.has(String(t.id || t._id)));
      }
      if (Array.isArray(updatedTasks) && updatedTasks.length > 0) {
        updatedTasks.forEach(u => {
          const item = currentList.find(t => t && String(t.id || t._id) === String(u.taskId));
          if (item) {
            if (u.name !== undefined) item.taskname = u.name;
            if (u.completionDate !== undefined) {
              item.completionDate = u.completionDate;
              item.dateString = u.completionDate;
            }
            if (u.time !== undefined) item.time = u.time;
            if (u.completed !== undefined) item.completed = u.completed;
            if (u.calendarEventId !== undefined) item.calendarEventId = u.calendarEventId;
            if (u.calendarSyncHash !== undefined) item.calendarSyncHash = u.calendarSyncHash;
            if (u.description !== undefined) item.description = u.description;
          }
        });
      }
      if (Array.isArray(newTasks) && newTasks.length > 0) {
        const { sortTasksChronologically } = require('./binaryInsert');
        currentList = sortTasksChronologically([...currentList, ...newTasks]);
      }
    } else if (dedupPlan.duplicateTaskIds.length > 0) {
      const delSet = new Set(dedupPlan.duplicateTaskIds.map(String));
      currentList = currentList.filter(t => t && !delSet.has(String(t.id || t._id)));
    }

    if (hasEventMapChanges || (diffResult && diffResult.hasChanges)) {
      await CryptoStorage.setItem(taskKey, JSON.stringify(currentList));
    }

    const summary = {
      slotKey: dueInfo.dueSlotKey,
      exportedCount: syncedCount || 0,
      importedCount: diffResult?.importedCount || 0,
      deletedCount: diffResult?.deletedCount || 0,
    };

    await markCalendarSyncCompletedAsync(summary, now);

    // Update lastCalendarSyncAt inside persisted theme state
    try {
      const updatedTheme = { ...themeState, lastCalendarSyncAt: now.toISOString() };
      await CryptoStorage.setItem('customTheme', JSON.stringify(updatedTheme));
    } catch (e) {}

    return { ran: true, tasks: currentList, summary };
  } catch (calErr) {
    console.warn('Background headless calendar sync error:', calErr);
    return { ran: false, tasks, error: calErr?.message };
  }
}

// Define the headless background task globally
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
  try {
    const themeJson = await CryptoStorage.getItem('customTheme');
    const activeTaskKey = await resolveActiveTaskStorageKeyAsync();
    let tasksJson = await CryptoStorage.getItem(activeTaskKey);
    if (!tasksJson && activeTaskKey !== 'tasks') {
      tasksJson = await CryptoStorage.getItem('tasks');
    }

    if (themeJson) {
      const themeState = JSON.parse(themeJson);
      let tasks = tasksJson ? JSON.parse(tasksJson) : [];

      // Headless 3x/day scheduled calendar sync (08:00, 12:00, 17:00) - open to all users
      if (themeState.calendarSyncEnabled) {
        const syncRes = await runHeadlessCalendarSyncIfDueAsync(themeState, tasks, activeTaskKey);
        if (syncRes && Array.isArray(syncRes.tasks)) {
          tasks = syncRes.tasks;
        }
      }

      // Rebuild the exact scheduled notifications for the next 24-48 hours based on current state
      await updateRecurringAutomations(themeState, tasks);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('Background fetch failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Registers the background fetch task with the OS so scheduled 3x/day calendar sync
 * (8:00 AM, 12:00 PM, 5:00 PM) and recurring automations execute reliably in the background.
 */
export async function registerBackgroundFetchAsync() {
  if (Platform.OS === 'web') return;
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
      minimumInterval: 60 * 15, // 15 minutes so 08:00, 12:00, 17:00 sync slots trigger promptly
      stopOnTerminate: false, // Android only
      startOnBoot: true, // Android only
    });
  } catch (err) {
    console.error("Task Register failed:", err);
  }
}
