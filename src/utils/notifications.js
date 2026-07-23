import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, ToastAndroid } from 'react-native';
import { scheduleExactAlarm, cancelAlarm } from '../../modules/expo-task-alarm';
import dayjs from 'dayjs';
import { DevLogger } from './logger';

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

export function getSoundBasename(sound) {
  return sound ? sound.replace(/\.(wav|mp3|ogg)$/i, '') : 'default';
}

export function getChannelId(
  isAlarm,
  sound,
  vibrationEnabled
) {
  const base = isAlarm ? 'alarm' : 'default';
  const soundName = getSoundBasename(sound);
  const vib = vibrationEnabled ? 'vib1' : 'vib0';

  return `task_${base}_${soundName}_${vib}_v16`;
}

// let configuredChannels = new Set(); // Temporarily removed for debugging

function serializeError(error) {
  if (!error) {
    return {
      message: 'Unknown error',
    };
  }

  return {
    name: error.name || 'Error',
    message: error.message || String(error),
    stack: error.stack || null,
    code: error.code || null,
  };
}

export function normalizeChannelForLog(channel) {
  if (!channel) {
    return null;
  }

  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,

    importance: channel.importance,
    sound: channel.sound,

    enableVibrate: channel.enableVibrate,
    vibrationPattern: channel.vibrationPattern,

    enableLights: channel.enableLights,
    lightColor: channel.lightColor,

    lockscreenVisibility:
      channel.lockscreenVisibility,

    bypassDnd: channel.bypassDnd,

    audioAttributes:
      channel.audioAttributes || null,
  };
}

export async function configureAndroidNotificationChannels(
  notificationSound,
  alarmSound,
  vibrationEnabled
) {
  if (Platform.OS !== 'android') {
    return;
  }

  const defaultChannelId = getChannelId(
    false,
    notificationSound,
    vibrationEnabled
  );

  const alarmChannelId = getChannelId(
    true,
    alarmSound,
    vibrationEnabled
  );

  DevLogger.info(
    'Configuring Android notification channels',
    {
      notificationSound,
      alarmSound,
      vibrationEnabled,
      defaultChannelId,
      alarmChannelId,
    }
  );

  try {
    await Notifications.setNotificationChannelAsync(
      defaultChannelId,
      {
        name: 'Task reminders',
        description:
          'Standard task reminder notifications',

        importance:
          Notifications.AndroidImportance.HIGH,

        sound: getSoundBasename(notificationSound),

        enableVibrate: vibrationEnabled,

        vibrationPattern: vibrationEnabled
          ? VIBRATION_PRESETS.reminder
          : null,

        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      }
    );

    await Notifications.setNotificationChannelAsync(
      alarmChannelId,
      {
        name: 'Task alarms',
        description:
          'Urgent task alarms with sound and vibration',

        importance:
          Notifications.AndroidImportance.MAX,

        sound: getSoundBasename(alarmSound),

        enableVibrate: vibrationEnabled,

        vibrationPattern: vibrationEnabled
          ? VIBRATION_PRESETS.alarm
          : null,

        audioAttributes: {
          usage:
            Notifications.AndroidAudioUsage.ALARM,

          contentType:
            Notifications.AndroidAudioContentType
              .SONIFICATION,
        },

        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,

        bypassDnd: true,
      }
    );

    // Read both channels back from Android.
    const storedDefault =
      await Notifications.getNotificationChannelAsync(
        defaultChannelId
      );

    const storedAlarm =
      await Notifications.getNotificationChannelAsync(
        alarmChannelId
      );

    DevLogger.info(
      'Stored task-reminder channel',
      normalizeChannelForLog(storedDefault)
    );

    DevLogger.info(
      'Stored task-alarm channel',
      normalizeChannelForLog(storedAlarm)
    );

    const problems = [];

    if (!storedDefault) {
      problems.push(
        'Default notification channel was not found'
      );
    } else {
      if (!storedDefault.sound) {
        problems.push(
          'Default notification channel has no sound'
        );
      }

      if (
        storedDefault.importance ===
        Notifications.AndroidImportance.NONE
      ) {
        problems.push(
          'Default notification channel is blocked'
        );
      }
    }

    if (!storedAlarm) {
      problems.push(
        'Alarm notification channel was not found'
      );
    } else {
      if (!storedAlarm.sound) {
        problems.push(
          'Alarm notification channel has no sound'
        );
      }

      if (
        storedAlarm.importance ===
        Notifications.AndroidImportance.NONE
      ) {
        problems.push(
          'Alarm notification channel is blocked'
        );
      }
    }

    if (problems.length > 0) {
      DevLogger.error(
        'Android stored invalid or silent channel settings',
        {
          problems,
          defaultChannel:
            normalizeChannelForLog(storedDefault),
          alarmChannel:
            normalizeChannelForLog(storedAlarm),
        }
      );

      // Do not cache a channel that Android reports as bad.
      return;
    }

    // configuredChannels.add(defaultChannelId);
    // configuredChannels.add(alarmChannelId);

    DevLogger.success(
      'Android notification channels verified',
      {
        defaultChannelId,
        alarmChannelId,
        defaultSound: storedDefault.sound,
        alarmSound: storedAlarm.sound,
      }
    );
  } catch (error) {
    DevLogger.error(
      'Failed to configure Android notification channels',
      serializeError(error)
    );

    throw error;
  }
}

export async function deleteObsoleteNotificationChannels(
  notificationSound,
  alarmSound,
  vibrationEnabled
) {
  if (Platform.OS !== 'android') {
    return;
  }

  const activeDefaultId = getChannelId(
    false,
    notificationSound,
    vibrationEnabled
  );

  const activeAlarmId = getChannelId(
    true,
    alarmSound,
    vibrationEnabled
  );

  const keepIds = new Set([
    activeDefaultId,
    activeAlarmId,
    'debug_system_sound_v16',
  ]);

  try {
    const channels =
      await Notifications.getNotificationChannelsAsync();

    for (const channel of channels) {
      const isManagedByYourApp =
        channel.id.startsWith('task_default_') ||
        channel.id.startsWith('task_alarm_') ||
        channel.id.startsWith('debug_system_sound_') ||
        channel.id.startsWith('task_default_system_sound_') ||
        channel.id.startsWith('default_sound_');

      if (
        isManagedByYourApp &&
        !keepIds.has(channel.id)
      ) {
        await Notifications.deleteNotificationChannelAsync(
          channel.id
        );

        DevLogger.info(
          'Deleted old notification channel',
          {
            id: channel.id,
            name: channel.name,
          }
        );
      }
    }
  } catch (error) {
    DevLogger.error(
      'Notification channel cleanup failed',
      {
        message: error?.message,
        stack: error?.stack,
      }
    );
  }
}

export async function registerForPushNotificationsAsync(themeState = {}) {
  if (Platform.OS === 'web') {
    return null;
  }

  const notifSound = themeState.notificationSound || 'default';
  const alrmSound = themeState.alarmSound || 'default';
  const vibEnabled = themeState.vibrationEnabled !== false;

  await deleteObsoleteNotificationChannels(
    notifSound,
    alrmSound,
    vibEnabled
  );

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
    DevLogger.warn('Notification permission was not granted.');
  } else {
    DevLogger.success('Notification permission granted.');
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

import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);
export async function scheduleTaskReminder(taskName, reminderValue, completionDateStr, timeStr, taskId = null, isAlarm = false, themeState = {}) {
  DevLogger.info(`scheduleTaskReminder called for task: ${taskName}`, { reminderValue, completionDateStr, timeStr, isAlarm });
  if (!completionDateStr) {
    DevLogger.warn(`scheduleTaskReminder: No completionDateStr provided, aborting`);
    return [];
  }
  const ids = [];

  let targetDate = dayjs(completionDateStr);
  if (!targetDate.isValid()) return [];

  if (timeStr) {
    const dateOnly = targetDate.format('YYYY-MM-DD');
    const parsedTime = dayjs(
      `${dateOnly} ${timeStr}`,
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
      console.warn('Invalid task time:', timeStr, 'for date:', dateOnly);
      DevLogger.warn(`Invalid task time format. Expected HH:mm. Got: ${timeStr} for date ${dateOnly}`);
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
  DevLogger.info(`scheduleExactTaskReminder for: ${taskName}`, { targetDate: targetDate.format(), isAlarm, category });

  if (
    !targetDate.isValid() ||
    !targetDate.isAfter(dayjs())
  ) {
    console.warn(
      'Cannot schedule notification in the past.'
    );
    DevLogger.warn(`Cannot schedule notification in the past. Date: ${targetDate.format()}`);

    return null;
  }

  const notificationSound = themeState.notificationSound || 'default';
  const alarmSound = themeState.alarmSound || 'default';
  const vibrationEnabled = themeState.vibrationEnabled !== false;

  const channelId = getChannelId(isAlarm, isAlarm ? alarmSound : notificationSound, vibrationEnabled);

  const sound = isAlarm
    ? alarmSound
    : notificationSound;

  try {
    // Ensure channels exist before scheduling
    await configureAndroidNotificationChannels(notificationSound, alarmSound, vibrationEnabled);

    if (Platform.OS === 'android' && isAlarm) {
      const success = await scheduleExactAlarm(
        taskId,
        taskName,
        targetDate.valueOf(),
        getSoundBasename(sound)
      );
      if (success) {
        DevLogger.success(`Successfully scheduled exact native ALARM`, { taskId, sound, taskName });
        return `native_alarm_${taskId}`;
      }
    }

    const scheduledId = await Notifications.scheduleNotificationAsync({
      content: {
        title: isAlarm
          ? 'Task Alarm'
          : 'Task Reminder',

        body: isAlarm
          ? `${taskName} is due now`
          : `Reminder: ${taskName}`,

        ...(Platform.OS !== 'android' && { sound }),

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
              date: targetDate.toDate(),
              channelId,
            }
          : {
              date: targetDate.toDate(),
            },
    });
    
    DevLogger.success(`Successfully scheduled exact notification`, { scheduledId, channelId, sound, taskName });
    return scheduledId;
  } catch (error) {
    DevLogger.error(`Error scheduling task reminder`, error.message);
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
      const channelId = 'task_default_system_sound_v11';

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
        if (typeof id === 'string' && id.startsWith('native_alarm_')) {
          if (Platform.OS === 'android') {
            await cancelAlarm(id.replace('native_alarm_', ''));
          }
        } else {
          await Notifications.cancelScheduledNotificationAsync(id);
        }
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
    DevLogger.warn('System notification test is Android-only');
    return null;
  }

  // Use a new ID for this diagnostic test.
  // Increment this manually if you test a changed configuration later.
  const channelId = 'debug_system_sound_v16';

  DevLogger.info('Starting Android default-sound diagnostic', {
    platform: Platform.OS,
    channelId,
    time: new Date().toISOString(),
  });

  try {
    // 1. Read notification permission.
    const permissions =
      await Notifications.getPermissionsAsync();

    DevLogger.info('Notification permissions', permissions);

    if (permissions.status !== 'granted') {
      const requested =
        await Notifications.requestPermissionsAsync();

      DevLogger.info(
        'Notification permissions after request',
        requested
      );

      if (requested.status !== 'granted') {
        DevLogger.error(
          'Notification permission is not granted',
          requested
        );
        return null;
      }
    }

    // 2. Remove this exact diagnostic channel first.
    // This helps during development, provided Android does not restore it.
    try {
      await Notifications.deleteNotificationChannelAsync(
        channelId
      );

      DevLogger.info(
        'Deleted previous diagnostic channel',
        { channelId }
      );
    } catch (deleteError) {
      DevLogger.warn(
        'Could not delete previous diagnostic channel',
        serializeError(deleteError)
      );
    }

    // 3. Create a channel using only Android's system sound.
    const createdChannel =
      await Notifications.setNotificationChannelAsync(
        channelId,
        {
          name: 'Sound diagnostic',
          description:
            'Temporary channel for notification sound diagnostics',

          importance:
            Notifications.AndroidImportance.MAX,

          sound: 'default',

          enableVibrate: true,

          vibrationPattern: [0, 300, 150, 300],

          lockscreenVisibility:
            Notifications.AndroidNotificationVisibility.PUBLIC,
        }
      );

    DevLogger.info(
      'setNotificationChannelAsync result',
      createdChannel
    );

    // 4. Read back what Android actually stored.
    const storedChannel =
      await Notifications.getNotificationChannelAsync(
        channelId
      );

    DevLogger.info(
      'Stored Android diagnostic channel',
      normalizeChannelForLog(storedChannel)
    );

    if (!storedChannel) {
      DevLogger.error(
        'Android did not return the diagnostic channel',
        { channelId }
      );
      return null;
    }

    if (
      storedChannel.importance ===
      Notifications.AndroidImportance.NONE
    ) {
      DevLogger.error(
        'Diagnostic channel is blocked',
        normalizeChannelForLog(storedChannel)
      );
    }

    if (!storedChannel.sound) {
      DevLogger.error(
        'Diagnostic channel is silent: Android returned no sound',
        normalizeChannelForLog(storedChannel)
      );
    }

    // 5. Schedule the notification.
    const notificationId =
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Android Sound Test',
          body: 'This notification should use the system sound.',

          // Channel controls Android 8+ sound, but keeping this
          // makes the intended behavior explicit.
          sound: 'default',

          priority:
            Notifications.AndroidNotificationPriority.MAX,

          data: {
            diagnostic: true,
            expectedSound: 'default',
            channelId,
          },
        },

        trigger: {
          seconds: 3,
          repeats: false,
          channelId,
        },
      });

    DevLogger.success(
      'Diagnostic notification scheduled',
      {
        notificationId,
        channelId,
        expectedSound: 'default',
        firesInSeconds: 3,
      }
    );

    // 6. Confirm it exists in Expo's scheduled list.
    const scheduled =
      await Notifications.getAllScheduledNotificationsAsync();

    const matchingNotification = scheduled.find(
      item => item.identifier === notificationId
    );

    DevLogger.info(
      'Scheduled notification verification',
      matchingNotification
        ? {
            found: true,
            identifier: matchingNotification.identifier,
            content: matchingNotification.content,
            trigger: matchingNotification.trigger,
          }
        : {
            found: false,
            notificationId,
          }
    );

    return notificationId;
  } catch (error) {
    DevLogger.error(
      'Android default-sound diagnostic failed',
      serializeError(error)
    );

    return null;
  }
}

export function attachNotificationDiagnostics() {
  const receivedSubscription =
    Notifications.addNotificationReceivedListener(
      notification => {
        DevLogger.success(
          'Notification received by application',
          {
            identifier:
              notification.request.identifier,

            content:
              notification.request.content,

            trigger:
              notification.request.trigger,

            receivedAt:
              new Date().toISOString(),
          }
        );
      }
    );

  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener(
      response => {
        DevLogger.info(
          'User interacted with notification',
          {
            actionIdentifier:
              response.actionIdentifier,

            identifier:
              response.notification.request.identifier,

            content:
              response.notification.request.content,

            trigger:
              response.notification.request.trigger,
          }
        );
      }
    );

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
