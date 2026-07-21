import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, ToastAndroid } from 'react-native';

// Set how notifications should be handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const VIBRATION_PATTERNS = {
  notificationSoft: [0, 35, 45, 40],
  reminder: [0, 60, 70, 60, 120, 90],
  important: [0, 120, 80, 180],
  alarmGentle: [0, 250, 120, 250, 120, 400, 350],
  alarmUrgent: [0, 500, 180, 500, 180, 700, 180, 700],
};

export const VIBRATION_PRESETS = {
  taskCompleted: [],
  newTask: VIBRATION_PATTERNS.notificationSoft,
  reminder: VIBRATION_PATTERNS.reminder,
  importantReminder: VIBRATION_PATTERNS.important,
  morningReminder: VIBRATION_PATTERNS.notificationSoft,
  eveningReminder: VIBRATION_PATTERNS.notificationSoft,
  overdueTask: VIBRATION_PATTERNS.alarmGentle,
  alarm: VIBRATION_PATTERNS.alarmGentle,
  criticalAlarm: VIBRATION_PATTERNS.alarmUrgent,
};

export function getChannelId(isAlarm, sound, vibrationEnabled) {
  const base = isAlarm ? 'alarm' : 'default';
  const soundName = sound ? sound.replace(/\.(wav|mp3)$/i, '') : 'default';
  const vib = vibrationEnabled ? 'vib1' : 'vib0';
  // Appending _v10 ensures Android creates a completely fresh channel,
  // bypassing any broken channels that may have been restored from cloud backups.
  return `task_${base}_${soundName}_${vib}_v10`;
}

export async function configureAndroidNotificationChannels(notificationSound, alarmSound, vibrationEnabled) {
  if (Platform.OS !== 'android') {
    return;
  }

  const defaultChannelId = getChannelId(false, notificationSound, vibrationEnabled);
  await Notifications.setNotificationChannelAsync(
    defaultChannelId,
    {
      name: 'Task reminders',
      description: 'Standard task reminder notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: vibrationEnabled ? VIBRATION_PRESETS.reminder : undefined,
      enableVibrate: vibrationEnabled,
      sound: notificationSound || 'default',
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    }
  );

  const alarmChannelId = getChannelId(true, alarmSound, vibrationEnabled);
  await Notifications.setNotificationChannelAsync(
    alarmChannelId,
    {
      name: 'Task alarms',
      description: 'Urgent task alarms with sound and vibration',
      importance: Notifications.AndroidImportance.MAX,

      sound: alarmSound || 'alarm_urgent_loop.wav',

      enableVibrate: vibrationEnabled,
      vibrationPattern: vibrationEnabled ? VIBRATION_PRESETS.alarm : undefined,

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



export async function registerForPushNotificationsAsync(themeState = {}) {
  if (Platform.OS === 'web') {
    return null;
  }

  const notifSound = 'default';
  const alrmSound = 'default';
  const vibEnabled = themeState.vibrationEnabled !== false;

  await configureAndroidNotificationChannels(notifSound, alrmSound, vibEnabled);

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
export async function scheduleTaskReminder(taskName, reminderValue, completionDateStr, timeStr, taskId = null, isAlarm = false, themeState = {}) {
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
      isAlarm ? 'task_reminder' : 'task_regular',
      themeState
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
      const remId = await scheduleExactTaskReminder(taskName, reminderDate.toDate(), taskId, isAlarm, 'task_reminder', themeState);
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
  category = 'task_reminder',
  themeState = {}
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

  const notificationSound = 'default';
  const alarmSound = 'default';
  const vibrationEnabled = themeState.vibrationEnabled !== false;

  const channelId = getChannelId(isAlarm, isAlarm ? alarmSound : notificationSound, vibrationEnabled);

  const sound = isAlarm
    ? alarmSound
    : notificationSound;

  try {
    // Ensure channels exist before scheduling
    await configureAndroidNotificationChannels(notificationSound, alarmSound, vibrationEnabled);

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
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: targetDate.toDate(),
              channelId,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: targetDate.toDate(),
            },
    });
  } catch (error) {
    console.error(
      'Error scheduling task reminder:',
      error
    );
    if (Platform.OS === 'android') {
      ToastAndroid.show(`Error scheduling: ${error.message}`, ToastAndroid.LONG);
    }

    return null;
  }
}

export async function scheduleLocalNotification(
  title,
  body,
  seconds = 3
) {
  try {
    if (Platform.OS === 'android') {
      const channelId = 'task_default_system_sound_v10';

      await Notifications.setNotificationChannelAsync(channelId, {
        name: 'Task notifications',
        description: 'Task notifications with system sound',

        importance:
          Notifications.AndroidImportance.MAX,

        sound: 'default',

        enableVibrate: true,
        vibrationPattern:
          VIBRATION_PRESETS.newTask,

        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      return await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',

          priority:
            Notifications.AndroidNotificationPriority.MAX,
        },

        trigger: {
          type:
            Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,

          seconds,
          repeats: false,
          channelId,
        },
      });
    }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
      },

      trigger: {
        type:
          Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,

        seconds,
        repeats: false,
      },
    });
  } catch (error) {
    console.error(
      'Error scheduling local notification:',
      error
    );

    if (Platform.OS === 'android') {
      ToastAndroid.show(
        `Notification error: ${error.message}`,
        ToastAndroid.LONG
      );
    }

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

export async function testAndroidDefaultNotification() {
  if (Platform.OS !== 'android') {
    return null;
  }

  const permission = await Notifications.requestPermissionsAsync();

  console.log('Notification permission:', permission);

  if (permission.status !== 'granted') {
    ToastAndroid.show(
      'Notification permission is not granted',
      ToastAndroid.LONG
    );

    return null;
  }

  // Use a brand-new ID every time you significantly change the channel.
  const channelId = 'android_default_sound_test_v10';

  // Remove the test channel first so Android cannot reuse old silent settings.
  try {
    await Notifications.deleteNotificationChannelAsync(channelId);
  } catch (error) {
    console.log('Channel did not previously exist:', error);
  }

  await Notifications.setNotificationChannelAsync(channelId, {
    name: 'Default Sound Test V10',
    description: 'Tests the Android system notification sound',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 250, 150, 250],
    lockscreenVisibility:
      Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  const channel =
    await Notifications.getNotificationChannelAsync(channelId);

  console.log('CREATED CHANNEL:', channel);

  const notificationId =
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Default sound test',
        body: 'This notification should play the Android default sound.',

        // Android mainly uses the channel sound.
        // Keeping this set is still appropriate.
        sound: 'default',

        priority:
          Notifications.AndroidNotificationPriority.MAX,

        data: {
          test: true,
        },
      },

      trigger: {
        type:
          Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,

        seconds: 3,
        repeats: false,

        // Critical: explicitly connect the notification to the channel.
        channelId,
      },
    });

  console.log('Scheduled test notification:', notificationId);

  ToastAndroid.show(
    'Default notification scheduled in 3 seconds',
    ToastAndroid.SHORT
  );

  return notificationId;
}
