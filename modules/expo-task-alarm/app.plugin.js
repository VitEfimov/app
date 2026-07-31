const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withTaskAlarm(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application[0];

    // Check if receiver already exists
    const hasReceiver = app.receiver?.some(
      (r) => r.$['android:name'] === 'expo.modules.taskalarm.TaskAlarmReceiver'
    );

    if (!hasReceiver) {
      if (!app.receiver) app.receiver = [];
      app.receiver.push({
        $: {
          'android:name': 'expo.modules.taskalarm.TaskAlarmReceiver',
          'android:exported': 'false',
        },
      });
    }

    // Check if Action receiver already exists
    const hasActionReceiver = app.receiver?.some(
      (r) => r.$['android:name'] === 'expo.modules.taskalarm.AlarmActionReceiver'
    );

    if (!hasActionReceiver) {
      if (!app.receiver) app.receiver = [];
      app.receiver.push({
        $: {
          'android:name': 'expo.modules.taskalarm.AlarmActionReceiver',
          'android:exported': 'false',
        },
      });
    }

    // Check if PomodoroAlarmReceiver already exists
    const hasPomodoroReceiver = app.receiver?.some(
      (r) => r.$['android:name'] === 'expo.modules.taskalarm.PomodoroAlarmReceiver'
    );

    if (!hasPomodoroReceiver) {
      if (!app.receiver) app.receiver = [];
      app.receiver.push({
        $: {
          'android:name': 'expo.modules.taskalarm.PomodoroAlarmReceiver',
          'android:exported': 'false',
        },
      });
    }

    // Check if activity already exists
    const hasActivity = app.activity?.some(
      (a) => a.$['android:name'] === 'expo.modules.taskalarm.AlarmActivity'
    );

    if (!hasActivity) {
      if (!app.activity) app.activity = [];
      app.activity.push({
        $: {
          'android:name': 'expo.modules.taskalarm.AlarmActivity',
          'android:exported': 'false',
          'android:showOnLockScreen': 'true',
          'android:showForAllUsers': 'true',
          'android:turnScreenOn': 'true',
          'android:theme': '@android:style/Theme.DeviceDefault.Light.NoActionBar',
        },
      });
    }

    return config;
  });
};
