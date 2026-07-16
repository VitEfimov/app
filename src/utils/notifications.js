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
    
    await Notifications.setNotificationChannelAsync('alarm_v3', {
      name: 'Alarm Sound',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000],
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      sound: true,
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
      identifier: 'complete_task',
      buttonTitle: 'Complete Task',
      options: { opensAppToForeground: false }
    },
    {
      identifier: 'snooze',
      buttonTitle: 'Snooze',
      options: { opensAppToForeground: false }
    },
    {
      identifier: 'reschedule',
      buttonTitle: 'Reschedule',
      options: { opensAppToForeground: true }
    }
  ]);

  await Notifications.setNotificationCategoryAsync('task_regular', [
    {
      identifier: 'complete_task',
      buttonTitle: 'Complete Task',
      options: { opensAppToForeground: false }
    },
    {
      identifier: 'reschedule',
      buttonTitle: 'Reschedule',
      options: { opensAppToForeground: true }
    }
  ]);

  return token;
}

import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);
export async function scheduleTaskReminder(taskName, reminderValue, completionDateStr, timeStr, taskId = null, isAlarm = false) {
  if (!completionDateStr) return [];
  const ids = [];

  let targetDate = dayjs(completionDateStr);
  if (!targetDate.isValid()) return [];

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
    
    // Schedule exact time notification (Always standard sound, no snooze)
    const timeId = await scheduleExactTaskReminder(`It's time: ${taskName}`, targetDate.toDate(), taskId, false, 'task_regular');
    if (timeId) ids.push(timeId);
  } else {
    targetDate = targetDate.hour(9).minute(0).second(0); // Default to 9 AM
  }

  if (reminderValue && reminderValue !== 'None') {
    const offsets = {
      "15 min before": { amount: 15, unit: "minute" },
      "30 min before": { amount: 30, unit: "minute" },
      "1 hr before": { amount: 1, unit: "hour" },
      "1 day before": { amount: 1, unit: "day" }
    };
    
    const offset = offsets[reminderValue];
    if (offset) {
      let reminderDate = targetDate.subtract(offset.amount, offset.unit);
      const remId = await scheduleExactTaskReminder(taskName, reminderDate.toDate(), taskId, isAlarm, 'task_reminder');
      if (remId) ids.push(remId);
    }
  }

  return ids;
}

export async function scheduleExactTaskReminder(taskName, targetDateObj, taskId = null, isAlarm = false, category = 'task_reminder') {
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
        data: { taskId, isAlarm },
        categoryIdentifier: category
      },
      trigger: Platform.OS === 'android' ? {
        date: targetDate.toDate(),
        channelId: isAlarm ? 'alarm_v3' : 'default'
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

export async function cancelNotification(notificationIds) {
  if (notificationIds) {
    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
    for (const id of ids) {
      if (id) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    }
  }
}
