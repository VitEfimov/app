import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateRecurringAutomations } from './notifications';

export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

// Define the headless background task globally
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
  try {
    const themeJson = await AsyncStorage.getItem('customTheme');
    const tasksJson = await AsyncStorage.getItem('tasks');
    
    if (themeJson) {
      const themeState = JSON.parse(themeJson);
      let tasks = tasksJson ? JSON.parse(tasksJson) : [];
      
      // Headless differential calendar sync if enabled (PRO)
      const entitlementJson = await AsyncStorage.getItem('entitlement');
      let isPremium = false;
      if (entitlementJson) {
        try {
          const ent = JSON.parse(entitlementJson);
          isPremium = !!ent.isPremium;
        } catch (e) {}
      }

      if (isPremium && themeState.calendarSyncEnabled) {
        try {
          const { performDifferentialCalendarSyncAsync } = require('./calendarSync');
          const diffResult = await performDifferentialCalendarSyncAsync(themeState, tasks);
          if (diffResult && diffResult.hasChanges) {
            const { deletedTaskIds, updatedTasks, newTasks } = diffResult;
            let currentList = [...tasks];
            if (Array.isArray(deletedTaskIds) && deletedTaskIds.length > 0) {
              const delSet = new Set(deletedTaskIds.map(String));
              currentList = currentList.filter(t => t && !delSet.has(String(t.id)));
            }
            if (Array.isArray(updatedTasks) && updatedTasks.length > 0) {
              updatedTasks.forEach(u => {
                const item = currentList.find(t => t && t.id === u.taskId);
                if (item) {
                  if (u.name !== undefined) item.taskname = u.name;
                  if (u.completionDate !== undefined) {
                    item.completionDate = u.completionDate;
                    item.dateString = u.completionDate;
                  }
                  if (u.time !== undefined) item.time = u.time;
                  if (u.completed !== undefined) item.completed = u.completed;
                }
              });
            }
            if (Array.isArray(newTasks) && newTasks.length > 0) {
              const { sortTasksChronologically } = require('./binaryInsert');
              currentList = sortTasksChronologically([...currentList, ...newTasks]);
            }
            await AsyncStorage.setItem('tasks', JSON.stringify(currentList));
            tasks = currentList;
          }
        } catch (calErr) {
          console.warn('Background headless calendar sync error:', calErr);
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
 * Registers the background fetch task with the OS.
 */
export async function registerBackgroundFetchAsync() {
  if (Platform.OS === 'web') return;
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
      minimumInterval: 60 * 15, // 15 minutes
      stopOnTerminate: false, // Android only
      startOnBoot: true, // Android only
    });
  } catch (err) {
    console.error("Task Register failed:", err);
  }
}
