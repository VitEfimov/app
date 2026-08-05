import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
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
      const tasks = tasksJson ? JSON.parse(tasksJson) : [];
      
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
