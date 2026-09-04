import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, ToastAndroid } from 'react-native';
import { scheduleExactAlarm, cancelAlarm, schedulePomodoroAlarm, cancelPomodoroAlarm } from '../../modules/expo-task-alarm';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { DevLogger } from './logger';

dayjs.extend(isSameOrBefore);

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

export function getSoundBasename(sound, isAlarm = false) {
  let baseName = sound ? sound.replace(/\.(wav|mp3|ogg)$/i, '') : 'default';
  if (baseName === 'default' && isAlarm) {
    // Expo hardcodes 'default' to the OS's NOTIFICATION sound.
    // Since we can't trigger the OS default alarm sound, we map to a bundled alarm sound.
    baseName = 'alarm_02';
  }
  return baseName;
}

export function getChannelId(
  isAlarm,
  sound,
  vibrationEnabled
) {
  const base = isAlarm ? 'alarm' : 'default';
  const soundName = getSoundBasename(sound, isAlarm);
  const vib = vibrationEnabled ? 'vib1' : 'vib0';

  return `task_${base}_${soundName}_${vib}_v17`;
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

        sound: getSoundBasename(notificationSound, false),

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

        sound: getSoundBasename(alarmSound, true),

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

export async function configurePomodoroChannel(soundName, isBreak) {
  if (Platform.OS !== 'android') return null;
  const baseName = getSoundBasename(soundName, true);
  const type = isBreak ? 'break' : 'work';
  const channelId = `pomodoro_${type}_${baseName}_v1`;

  try {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: `Pomodoro ${isBreak ? 'Break' : 'Work'} Alarm`,
      description: 'Pomodoro timer completion alarm',
      importance: Notifications.AndroidImportance.MAX,
      // We don't need to check for 'default' here because getSoundBasename(soundName, true) guarantees it will be mapped to a real file.
      sound: baseName === 'none' ? null : baseName,
      enableVibrate: true,
      vibrationPattern: VIBRATION_PRESETS.alarm,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
    return channelId;
  } catch (error) {
    console.error('Failed to configure pomodoro channel', error);
    return null;
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
export async function scheduleTaskReminder(taskName, reminderValue, completionDateStr, timeStr, taskId = null, isAlarm = false, themeState = {}, advancedOptions = {}) {
  if (Platform.OS === 'web') return [];
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

  if (advancedOptions.escalationLevel === 'active') {
    const escOffsets = [
      { amount: 1, unit: 'hour' },
      { amount: 30, unit: 'minute' },
      { amount: 15, unit: 'minute' },
      { amount: 5, unit: 'minute' },
      { amount: 1, unit: 'minute' }
    ];
    for (const escOffset of escOffsets) {
      let remDate = targetDate.subtract(escOffset.amount, escOffset.unit);
      if (remDate.isAfter(dayjs())) {
        const remId = await scheduleExactTaskReminder(`[URGENT] ${taskName}`, remDate.toDate(), taskId, true, 'task_alarm', themeState);
        if (remId) ids.push(remId);
      }
    }
  }

  if (advancedOptions.isNagMode === true) {
    for (let i = 1; i <= 12; i++) {
      let nagDate = targetDate.add(i * 10, 'minute');
      if (nagDate.isAfter(dayjs())) {
        const nagId = await scheduleExactTaskReminder(`[OVERDUE] ${taskName}`, nagDate.toDate(), taskId, true, 'task_alarm', themeState);
        if (nagId) ids.push(nagId);
      }
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
  if (Platform.OS === 'web') return null;
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
        channelId
      );
      if (success) {
        DevLogger.success(`Successfully scheduled exact native ALARM`, { taskId, channelId, taskName });
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
          : taskName,

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
  seconds = 3,
  isSilent = false
) {
  if (Platform.OS === 'web') return null;
  try {
    if (Platform.OS === 'android') {
      // Use v2 to force Android to create a fresh channel with these settings
      const channelId = isSilent ? 'task_silent_notification_v2' : 'task_default_system_sound_v11';

      await Notifications.setNotificationChannelAsync(channelId, {
        name: isSilent ? 'Silent notifications' : 'Task notifications',
        description: isSilent ? 'Notifications without sound' : 'Task notifications with system sound',
        // LOW importance (2) shows visually but guarantees NO sound and NO vibration on Android
        importance: isSilent ? Notifications.AndroidImportance.LOW : Notifications.AndroidImportance.MAX,
        sound: isSilent ? null : 'default',
        enableVibrate: !isSilent,
        vibrationPattern: isSilent ? null : VIBRATION_PRESETS.newTask,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      return await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: isSilent ? null : 'default',
          // Use LOW priority to match channel importance
          priority: isSilent ? Notifications.AndroidNotificationPriority.LOW : Notifications.AndroidImportance.MAX,
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
        sound: isSilent ? null : 'default',
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
  if (Platform.OS === 'web') return;
  if (notificationIds) {
    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
    for (const id of ids) {
      if (id) {
        if (typeof id === 'string' && id.startsWith('native_alarm_')) {
          if (Platform.OS === 'android') {
            await cancelAlarm(id.replace('native_alarm_', ''));
          }
        } else if (typeof id === 'string' && id.startsWith('pomodoro_alarm_')) {
          if (Platform.OS === 'android') {
            await cancelPomodoroAlarm(id.replace('pomodoro_alarm_', ''));
          }
        } else {
          await Notifications.cancelScheduledNotificationAsync(id);
        }
      }
    }
  }
}

export { schedulePomodoroAlarm, cancelPomodoroAlarm };

export async function rescheduleAllActiveTasks(tasks, themeState, dispatch, updateTaskAction) {
  for (const task of tasks) {
    if (task.completed) continue;
    if (task.notificationId && task.notificationId.length > 0) {
      await cancelNotification(task.notificationId);
      
      const notifIds = await scheduleTaskReminder(
        task.taskname,
        task.reminder || 'None',
        task.completionDate,
        task.time,
        task.id,
        task.isAlarm || false,
        themeState,
        { isNagMode: task.isNagMode, escalationLevel: task.escalationLevel }
      );
      
      if (notifIds && notifIds.length > 0) {
        dispatch(updateTaskAction({ taskId: task.id, notificationId: notifIds }));
      } else {
        dispatch(updateTaskAction({ taskId: task.id, notificationId: [] }));
      }
    }
  }
}

export async function updateRecurringAutomations(themeState, tasks = []) {
  if (Platform.OS === 'web') return;
  const {
    morningReminder, morningReminderTime,
    eveningReminder, eveningReminderTime,
    summaryReminder, summaryReminderTime
  } = themeState || {};

  const notificationSound = themeState?.notificationSound || 'default';
  const vibrationEnabled = themeState?.vibrationEnabled !== false;
  const channelId = getChannelId(false, notificationSound, vibrationEnabled);

  // Ensure channel exists
  await configureAndroidNotificationChannels(notificationSound, 'default', vibrationEnabled);

  try {
    // Cancel existing automations
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.isAutomation) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (error) {
    DevLogger.error('Failed to cancel existing automations', error);
  }

  // Helper to find the absolute next occurrence of a time, with an optional day offset
  const getNextOccurrence = (hour, minute, daysOffset = 0) => {
    let now = dayjs();
    let next = dayjs().hour(hour).minute(minute).second(0).millisecond(0);
    // If the time has already passed today, start from tomorrow
    if (next.isBefore(now)) {
      next = next.add(1, 'day');
    }
    return next.add(daysOffset, 'day');
  };

  // Helper to determine if a task is overdue relative to a reference trigger date/time
  const isTaskOverdueAt = (task, refDateTime) => {
    if (task.completed || !task.completionDate) return false;
    const taskDate = dayjs(task.completionDate);
    if (taskDate.isBefore(refDateTime, 'day')) return true;
    if (taskDate.isSame(refDateTime, 'day') && task.time) {
      const [h, m] = task.time.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const taskDateTime = dayjs(task.completionDate).hour(h).minute(m).second(0).millisecond(0);
        if (taskDateTime.isBefore(refDateTime)) return true;
      }
    }
    return false;
  };

  // Morning Reminder: Upcoming tasks (Schedule for next 7 days)
  if (morningReminder && morningReminderTime) {
    const [hour, minute] = morningReminderTime.split(':').map(Number);
    
    for (let i = 0; i < 7; i++) {
      const triggerDate = getNextOccurrence(hour, minute, i);

      const dueToday = tasks.filter(t => !t.completed && t.completionDate && dayjs(t.completionDate).isSame(triggerDate, 'day'));
      const overdue = tasks.filter(t => isTaskOverdueAt(t, triggerDate));
      
      let bodyText = 'You have no tasks due today. Have a great day!';
      if (dueToday.length > 0) {
        bodyText = `You have ${dueToday.length} task${dueToday.length === 1 ? '' : 's'} for today`;
        if (overdue.length > 0) {
          bodyText += ` (${overdue.length} overdue)`;
        }
        bodyText += '.\n';
        const top5 = [...dueToday, ...overdue].slice(0, 5);
        bodyText += top5.map(t => `• ${t.taskname}`).join('\n');
        if (dueToday.length + overdue.length > 5) {
          bodyText += `\n...and ${dueToday.length + overdue.length - 5} more`;
        }
      } else if (overdue.length > 0) {
        bodyText = `You have no tasks due today, but ${overdue.length} overdue task${overdue.length === 1 ? '' : 's'} waiting.\n`;
        const top5 = overdue.slice(0, 5);
        bodyText += top5.map(t => `• ${t.taskname}`).join('\n');
        if (overdue.length > 5) {
          bodyText += `\n...and ${overdue.length - 5} more`;
        }
      }

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Good Morning!',
            body: bodyText,
            sound: true,
            data: { isAutomation: true, automationType: 'morning' },
          },
          trigger: Platform.OS === 'android' ? { date: triggerDate.toDate(), channelId } : { date: triggerDate.toDate() }
        });
      } catch (error) {
        DevLogger.error('Failed to schedule morning reminder', error);
      }
    }
  }

  // Summary Reminder: Overdue tasks (Schedule for next 7 days)
  if (summaryReminder && summaryReminderTime) {
    const [hour, minute] = summaryReminderTime.split(':').map(Number);
    
    for (let i = 0; i < 7; i++) {
      const triggerDate = getNextOccurrence(hour, minute, i);

      const overdueTasks = tasks.filter(t => isTaskOverdueAt(t, triggerDate));
      
      let bodyText = 'All tasks are on track! You have no overdue tasks.';
      if (overdueTasks.length > 0) {
        bodyText = `You have ${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'} waiting.\n`;
        const top5 = overdueTasks.slice(0, 5);
        bodyText += top5.map(t => `• ${t.taskname}`).join('\n');
        if (overdueTasks.length > 5) {
          bodyText += `\n...and ${overdueTasks.length - 5} more`;
        }
      }

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Daily Summary',
            body: bodyText,
            sound: true,
            data: { isAutomation: true, automationType: 'summary' },
          },
          trigger: Platform.OS === 'android' ? { date: triggerDate.toDate(), channelId } : { date: triggerDate.toDate() }
        });
      } catch (error) {
        DevLogger.error('Failed to schedule summary reminder', error);
      }
    }
  }

  // Evening Reminder: Unfinished tasks (Schedule for next 7 days)
  if (eveningReminder && eveningReminderTime) {
    const [hour, minute] = eveningReminderTime.split(':').map(Number);
    
    for (let i = 0; i < 7; i++) {
      const triggerDate = getNextOccurrence(hour, minute, i);

      const unfinishedTasks = tasks.filter(t => !t.completed && t.completionDate && dayjs(t.completionDate).isSameOrBefore(triggerDate, 'day'));
      
      let bodyText = 'All caught up for today! Have a relaxing evening.';
      if (unfinishedTasks.length > 0) {
        bodyText = `Wrap up ${unfinishedTasks.length} unfinished task${unfinishedTasks.length === 1 ? '' : 's'} before the day ends.\n`;
        const top5 = unfinishedTasks.slice(0, 5);
        bodyText += top5.map(t => `• ${t.taskname}`).join('\n');
        if (unfinishedTasks.length > 5) {
          bodyText += `\n...and ${unfinishedTasks.length - 5} more`;
        }
      }

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Evening Review',
            body: bodyText,
            sound: true,
            data: { isAutomation: true, automationType: 'evening' },
          },
          trigger: Platform.OS === 'android' ? { date: triggerDate.toDate(), channelId } : { date: triggerDate.toDate() }
        });
      } catch (error) {
        DevLogger.error('Failed to schedule evening reminder', error);
      }
    }
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
