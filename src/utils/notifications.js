import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Set how notifications should be handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    // token = (await Notifications.getExpoPushTokenAsync()).data;
    // We don't strictly need a push token if we only do LOCAL notifications,
    // but requesting permissions is required.
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  await Notifications.setNotificationCategoryAsync('task_reminder', [
    {
      identifier: 'snooze_30_min',
      buttonTitle: 'Snooze 30 Min',
      options: { opensAppToForeground: false }
    },
    {
      identifier: 'snooze_1_hr',
      buttonTitle: 'Snooze 1 Hr',
      options: { opensAppToForeground: false }
    },
    {
      identifier: 'snooze_1_day',
      buttonTitle: 'Next Day',
      options: { opensAppToForeground: false }
    }
  ]);

  return token;
}

import dayjs from 'dayjs';

export async function scheduleTaskReminder(taskName, reminderValue, completionDateStr, timeStr, taskId = null) {
  if (!reminderValue || reminderValue === 'None') return null;
  if (!completionDateStr) return null;

  let targetDate = dayjs(completionDateStr);
  
  if (timeStr) {
    const [hoursStr, minutesStr] = timeStr.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr.replace(/[^0-9]/g, ''), 10);
    if (timeStr.toLowerCase().includes('pm') && hours !== 12) hours += 12;
    if (timeStr.toLowerCase().includes('am') && hours === 12) hours = 0;
    targetDate = targetDate.hour(hours).minute(minutes).second(0);
  } else {
    targetDate = targetDate.hour(9).minute(0).second(0); // Default to 9 AM
  }

  if (reminderValue === '15 min before') targetDate = targetDate.subtract(15, 'minute');
  else if (reminderValue === '30 min before') targetDate = targetDate.subtract(30, 'minute');
  else if (reminderValue === '1 hr before') targetDate = targetDate.subtract(1, 'hour');
  else if (reminderValue === '1 day before') targetDate = targetDate.subtract(1, 'day');
  // If 'Day of (All Day)', just use 9 AM of that day

  if (targetDate.isBefore(dayjs())) {
    console.log('Cannot schedule a notification in the past');
    return null;
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Task Reminder',
        body: taskName,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { taskId },
        categoryId: 'task_reminder'
      },
      trigger: targetDate.toDate(),
    });
    return id;
  } catch (error) {
    console.log('Error scheduling task reminder:', error);
    return null;
  }
}

export async function scheduleLocalNotification(title, body, triggerTimeOrDelay) {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: triggerTimeOrDelay,
    });
    return id;
  } catch (error) {
    console.log('Error scheduling notification:', error);
    return null;
  }
}

export async function cancelNotification(notificationId) {
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
}
