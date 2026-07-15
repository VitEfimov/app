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
    
    await Notifications.setNotificationChannelAsync('alarm', {
      name: 'Alarm',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 500, 500, 500, 500],
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      sound: 'default', // uses default alarm sound if available
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    // Even if denied, we don't return early because we still want to register categories
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
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);
export async function scheduleTaskReminder(taskName, reminderValue, completionDateStr, timeStr, taskId = null, isAlarm = false) {
  if (!reminderValue || reminderValue === 'None') return null;
  if (!completionDateStr) return null;

  let targetDate = dayjs(completionDateStr);
  if (!targetDate.isValid()) return null;

  if (timeStr) {
    const parsedTime = dayjs(`${completionDateStr} ${timeStr}`, ["YYYY-MM-DD HH:mm", "YYYY-MM-DD h:mm A", "YYYY-MM-DD hh:mm A"], true);
    if (parsedTime.isValid()) {
      targetDate = parsedTime;
    } else {
      const [hoursStr, minutesStr] = timeStr.split(':');
      let hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr.replace(/[^0-9]/g, ''), 10);
      if (timeStr.toLowerCase().includes('pm') && hours !== 12) hours += 12;
      if (timeStr.toLowerCase().includes('am') && hours === 12) hours = 0;
      targetDate = targetDate.hour(hours).minute(minutes).second(0);
    }
  } else {
    targetDate = targetDate.hour(9).minute(0).second(0); // Default to 9 AM
  }

  const offsets = {
    "15 min before": { amount: 15, unit: "minute" },
    "30 min before": { amount: 30, unit: "minute" },
    "1 hr before": { amount: 1, unit: "hour" },
    "1 day before": { amount: 1, unit: "day" }
  };
  
  const offset = offsets[reminderValue];
  if (offset) {
    targetDate = targetDate.subtract(offset.amount, offset.unit);
  }

  return scheduleExactTaskReminder(taskName, targetDate.toDate(), taskId, isAlarm);
}

export async function scheduleExactTaskReminder(taskName, targetDateObj, taskId = null, isAlarm = false) {
  const targetDate = dayjs(targetDateObj);

  if (targetDate.isBefore(dayjs())) {
    console.log('Cannot schedule a notification in the past');
    return null;
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Task Reminder',
        body: `Reminder: ${taskName}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { taskId },
        categoryId: 'task_reminder'
      },
      trigger: Platform.OS === 'android' ? {
        date: targetDate.toDate(),
        channelId: isAlarm ? 'alarm' : 'default'
      } : targetDate.toDate(),
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
