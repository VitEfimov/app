import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Set how notifications should be handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const DEFAULT_CHANNEL_ID = 'task_default_v2';
export const ALARM_CHANNEL_ID = 'task_alarm_v5';
const ALARM_SOUND = 'alarm_urgent_loop.wav';

async function configureAndroidNotificationChannels() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(
    DEFAULT_CHANNEL_ID,
    {
      name: 'Task reminders',
      description: 'Standard task reminder notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      sound: 'default',
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    }
  );

  await Notifications.setNotificationChannelAsync(
    ALARM_CHANNEL_ID,
    {
      name: 'Task alarms',
      description: 'Urgent task alarms with sound and vibration',
      importance: Notifications.AndroidImportance.MAX,

      sound: ALARM_SOUND,

      enableVibrate: true,
      vibrationPattern: [
        0,
        900,
        350,
        900,
        350,
        1200,
      ],

      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType:
          Notifications.AndroidAudioContentType.SONIFICATION,
      },

      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,

      bypassDnd: true,
    }
  );
}

export const DEFAULT_APP_CHANNEL = DEFAULT_CHANNEL_ID;

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') {
    return null;
  }

  await configureAndroidNotificationChannels();

  const permission =
    await Notifications.getPermissionsAsync();

  let finalStatus = permission.status;

  if (finalStatus !== 'granted') {
    const requested =
      await Notifications.requestPermissionsAsync();

    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    console.warn(
      'Notification permission was not granted.'
    );
  }

  await Notifications.setNotificationCategoryAsync(
    'task_reminder',
    [
      {
        identifier: 'complete_task',
        buttonTitle: 'Complete Task',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'snooze',
        buttonTitle: 'Snooze',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'reschedule',
        buttonTitle: 'Reschedule',
        options: {
          opensAppToForeground: true,
        },
      },
    ]
  );

  await Notifications.setNotificationCategoryAsync(
    'task_regular',
    [
      {
        identifier: 'complete_task',
        buttonTitle: 'Complete Task',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'reschedule',
        buttonTitle: 'Reschedule',
        options: {
          opensAppToForeground: true,
        },
      },
    ]
  );

  /*
   * You do not need a push token for local notifications.
   * Obtain one only when you intend to receive remote push messages.
   */
  if (!Device.isDevice) {
    return null;
  }

  return null;
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
    const parsedTime = dayjs(
      `${completionDateStr} ${timeStr}`,
      [
        'YYYY-MM-DD HH:mm',
        'YYYY-MM-DD H:mm',
        'YYYY-MM-DD h:mm A',
        'YYYY-MM-DD hh:mm A',
      ],
      true
    );

    if (parsedTime.isValid()) {
      targetDate = parsedTime;
    } else {
      console.warn(
        'Invalid task time:',
        timeStr
      );

      return [];
    }

    // Schedule exact time notification
    const timeId = await scheduleExactTaskReminder(
      taskName,
      targetDate.toDate(),
      taskId,
      isAlarm,
      isAlarm ? 'task_reminder' : 'task_regular'
    );
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

export async function scheduleExactTaskReminder(
  taskName,
  targetDateObj,
  taskId = null,
  isAlarm = false,
  category = 'task_reminder'
) {
  const targetDate = dayjs(targetDateObj);

  if (
    !targetDate.isValid() ||
    !targetDate.isAfter(dayjs())
  ) {
    console.warn(
      'Cannot schedule notification in the past.'
    );

    return null;
  }

  const channelId = isAlarm
    ? ALARM_CHANNEL_ID
    : DEFAULT_CHANNEL_ID;

  const sound = isAlarm
    ? ALARM_SOUND
    : 'default';

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: isAlarm
          ? 'Task Alarm'
          : 'Task Reminder',

        body: isAlarm
          ? `${taskName} is due now`
          : `Reminder: ${taskName}`,

        sound,

        priority:
          Notifications.AndroidNotificationPriority.MAX,

        categoryIdentifier: category,

        data: {
          taskId,
          isAlarm,
        },

        /*
         * Makes the Android notification harder to dismiss,
         * but it still does not create a real alarm screen.
         */
        sticky: isAlarm,
        autoDismiss: !isAlarm,
      },

      trigger:
        Platform.OS === 'android'
          ? {
              type:
                Notifications
                  .SchedulableTriggerInputTypes.DATE,

              date: targetDate.toDate(),
              channelId,
            }
          : {
              type:
                Notifications
                  .SchedulableTriggerInputTypes.DATE,

              date: targetDate.toDate(),
            },
    });
  } catch (error) {
    console.error(
      'Error scheduling task reminder:',
      error
    );

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

export async function updateRecurringAutomations(themeState) {
  const {
    morningReminder, morningReminderTime,
    eveningReminder, eveningReminderTime,
    summaryReminder, summaryReminderTime
  } = themeState;

  // Cancel existing automations
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.isAutomation) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  if (morningReminder && morningReminderTime) {
    const [hour, minute] = morningReminderTime.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Good Morning!',
        body: "Check your tasks for today.",
        sound: true,
        data: { isAutomation: true },
      },
      trigger: { hour, minute, repeats: true }
    });
  }

  if (summaryReminder && summaryReminderTime) {
    const [hour, minute] = summaryReminderTime.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Summary',
        body: "You might have some overdue tasks waiting.",
        sound: true,
        data: { isAutomation: true },
      },
      trigger: { hour, minute, repeats: true }
    });
  }

  if (eveningReminder && eveningReminderTime) {
    const [hour, minute] = eveningReminderTime.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Evening Review',
        body: "Wrap up any unfinished tasks before the day ends.",
        sound: true,
        data: { isAutomation: true },
      },
      trigger: { hour, minute, repeats: true }
    });
  }
}
