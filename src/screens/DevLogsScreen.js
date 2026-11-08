import React, { useEffect, useState, useMemo, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Clipboard,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { DevLogger } from '../utils/logger';
import { CrashLogger } from '../utils/crashLogger';
import { useTheme } from '../styles/ThemeContext';
import {
  testAndroidDefaultNotification,
  normalizeChannelForLog,
  scheduleTaskReminder,
  scheduleExactTaskReminder,
  scheduleLocalNotification,
  cancelNotification,
  rescheduleAllActiveTasks,
  getChannelId,
} from '../utils/notifications';
import { updateTask, processAutoManageTasks, addMultipleTasks, deleteMultipleTasks } from '../features/taskSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CryptoStorage } from '../utils/cryptoStorage';
import { ChaosTestHelper } from '../utils/chaosTestHelper';
import { useMemoryPressureGuard, MemoryPressureGuard, HARDWARE_THRESHOLDS } from '../utils/memoryPressureGuard';
import * as Notifications from 'expo-notifications';
import dayjs from 'dayjs';
import { navigationRef } from '../navigation/AppNavigator';
import TaskDetailsModal from '../components/TaskDetailsModal';
import { TaskEditDiagnostics } from '../utils/taskEditDiagnostics';
import getFilters, { isTaskToday, isTaskMissed, getTaskDateStr, isTaskUpcoming } from '../utils/filters';
import Svg, { Path } from 'react-native-svg';
import {
  getAlarmSystemDiagnostics,
  openExactAlarmSettings,
  openBatteryOptimizationSettings,
  openOverlaySettings,
  isCarConnected,
  getSystemMemoryMetrics,
} from '../../modules/expo-task-alarm';

const IconRefresh = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 4v6h-6" />
    <Path d="M1 20v-6h6" />
    <Path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </Svg>
);

const IconTrash = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </Svg>
);

const IconBell = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <Path d="M13.73 21a2 2 0 01-3.46 0" />
  </Svg>
);

const IconArrowLeft = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5M12 19l-7-7 7-7" />
  </Svg>
);

export default function DevLogsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const dispatch = useDispatch();
  const tasks = useSelector((state) => state.taskReducer.tasks || []);
  const themeState = useSelector((state) => state.themeReducer);
  const boards = useSelector((state) => state.userReducer.boards || []);

  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks', 'notifications', 'reschedule', 'bottlenecks', 'logs'
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState('all'); // 'all', 'active', 'missed', 'hasNotif', 'alarm'
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [scheduledNotifications, setScheduledNotifications] = useState([]);
  const [channelsList, setChannelsList] = useState([]);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [systemDiag, setSystemDiag] = useState(null);
  const [desyncReport, setDesyncReport] = useState(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [crashLogs, setCrashLogs] = useState([]);
  const [expandedCrashId, setExpandedCrashId] = useState(null);
  const [visibleTaskLimit, setVisibleTaskLimit] = useState(30);
  const [taskEditEvents, setTaskEditEvents] = useState(() => TaskEditDiagnostics.getHistory());
  const [testModalTask, setTestModalTask] = useState(null);
  const [isTestModalVisible, setIsTestModalVisible] = useState(false);

  const {
    status: memoryGuardStatus,
    isPeak: isMemoryPeak,
    isWarning: isMemoryWarning,
    heapSaturationPercent,
    reasons: memoryGuardReasons,
    metrics: hardwareMetrics,
    peakHistory,
    triggerEmergencyCleanup,
  } = useMemoryPressureGuard({
    intervalMs: 2500,
    autoMitigateOnPeak: true,
    enabled: activeTab === 'crashes' || activeTab === 'bottlenecks',
  });

  const payloadMetrics = useMemo(() => ChaosTestHelper.getPayloadMetrics(tasks), [tasks]);
  const chaosTaskCount = useMemo(() => tasks.filter(ChaosTestHelper.isChaosTask).length, [tasks]);

  const refreshHardwareMetrics = () => {
    MemoryPressureGuard.checkMemoryPressure();
  };

  useEffect(() => {
    const unsubscribe = DevLogger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = CrashLogger.subscribe((newCrashes) => {
      setCrashLogs(newCrashes);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = TaskEditDiagnostics.subscribe((newEvents) => {
      setTaskEditEvents(newEvents);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    runSystemDiagnostics();
  }, [tasks]);

  const runSystemDiagnostics = async () => {
    setIsDiagnosing(true);
    try {
      const diag = await getAlarmSystemDiagnostics();
      setSystemDiag(diag);

      const perm = await Notifications.getPermissionsAsync();
      setPermissionStatus(perm.status);

      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      setScheduledNotifications(scheduled);

      if (Platform.OS === 'android') {
        try {
          const channels = await Notifications.getNotificationChannelsAsync();
          setChannelsList(channels);
        } catch (e) {}
      }

      // Check desync between tasks with reminders and OS scheduled notifications
      const activeTasksWithReminders = tasks.filter(
        (t) => !t.completed && ((t.reminder && t.reminder !== 'None') || t.isAlarm)
      );
      const scheduledIds = new Set(scheduled.map((s) => String(s.identifier)));

      const missingFromOS = [];
      activeTasksWithReminders.forEach((t) => {
        const notifIds = Array.isArray(t.notificationId)
          ? t.notificationId
          : t.notificationId
          ? [t.notificationId]
          : [];
        const hasNative = notifIds.some((id) => String(id).startsWith('native_alarm_'));
        const hasExpo = notifIds.some((id) => scheduledIds.has(String(id)));
        if (!hasNative && !hasExpo) {
          missingFromOS.push(t);
        }
      });

      setDesyncReport({
        total: activeTasksWithReminders.length,
        osScheduled: scheduled.length,
        missing: missingFromOS,
      });

      DevLogger.success('Checker diagnostics updated', {
        canExact: diag?.canScheduleExactAlarms,
        fullScreen: diag?.canUseFullScreenIntent,
        batteryOpt: diag?.isIgnoringBatteryOptimizations,
        missing: missingFromOS.length,
      });
    } catch (err) {
      DevLogger.error('Failed to run alarm diagnostics', err.message);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleFixAllDesynced = async () => {
    if (!desyncReport || !desyncReport.missing || desyncReport.missing.length === 0) return;
    DevLogger.info(`Re-syncing ${desyncReport.missing.length} missing tasks...`);
    for (const t of desyncReport.missing) {
      try {
        const newNotifIds = await scheduleTaskReminder(
          t.taskname,
          t.reminder || 'None',
          t.completionDate,
          t.time,
          t.id,
          t.isAlarm || false,
          themeState,
          { isNagMode: t.isNagMode, escalationLevel: t.escalationLevel }
        );
        dispatch(
          updateTask({
            taskId: t.id,
            notificationId: newNotifIds || [],
          })
        );
      } catch (e) {
        DevLogger.error(`Failed to reschedule ${t.taskname}`, e.message);
      }
    }
    DevLogger.success('Re-sync completed. Refreshing diagnostics...');
    await runSystemDiagnostics();
  };

  const checkPermissions = async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      setPermissionStatus(perm.status);
    } catch (e) {
      setPermissionStatus('unknown');
    }
  };

  // --- Task Stats ---
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const active = total - completed;
    const missed = tasks.filter((t) => isTaskMissed(t)).length;
    const now = dayjs();
    const FILTERS = getFilters(now);
    const upcoming = tasks.filter(
      (t) => isTaskUpcoming(t, now)
    ).length;
    const hasNotif = tasks.filter(
      (t) => !t.completed && t.notificationId && t.notificationId.length > 0
    ).length;
    const alarms = tasks.filter((t) => !t.completed && t.isAlarm).length;
    const recurring = tasks.filter((t) => !t.completed && t.recurringSeriesId).length;

    return { total, completed, active, missed, upcoming, hasNotif, alarms, recurring };
  }, [tasks]);

  // --- Filtered Tasks ---
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = (t.taskname || '').toLowerCase().includes(query);
        const matchesId = String(t.id).includes(query);
        if (!matchesName && !matchesId) return false;
      }

      if (taskFilter === 'active') return !t.completed;
      if (taskFilter === 'missed') return isTaskMissed(t);
      if (taskFilter === 'hasNotif')
        return !t.completed && t.notificationId && t.notificationId.length > 0;
      if (taskFilter === 'alarm') return !t.completed && t.isAlarm;
      if (taskFilter === 'recurring') return !t.completed && t.recurringSeriesId;

      return true;
    });
  }, [tasks, searchQuery, taskFilter]);

  // --- Task Quick Actions ---
  const handleTaskReminderChange = async (task, newReminder) => {
    DevLogger.info(`Adjusting reminder for task ${task.taskname} to ${newReminder}`);
    await cancelNotification(task.notificationId, task.id);
    const newNotifIds = await scheduleTaskReminder(
      task.taskname,
      newReminder,
      task.completionDate,
      task.time,
      task.id,
      task.isAlarm || false,
      themeState,
      { isNagMode: task.isNagMode, escalationLevel: task.escalationLevel }
    );
    dispatch(
      updateTask({
        taskId: task.id,
        reminder: newReminder,
        notificationId: newNotifIds || [],
      })
    );
    DevLogger.success(`Updated reminder for ${task.taskname}`);
  };

  const handleToggleTaskAlarm = async (task) => {
    const nextIsAlarm = !task.isAlarm;
    DevLogger.info(`Toggling alarm for task ${task.taskname} to ${nextIsAlarm}`);
    await cancelNotification(task.notificationId, task.id);
    const newNotifIds = await scheduleTaskReminder(
      task.taskname,
      task.reminder || 'None',
      task.completionDate,
      task.time,
      task.id,
      nextIsAlarm,
      themeState,
      { isNagMode: task.isNagMode, escalationLevel: task.escalationLevel }
    );
    dispatch(
      updateTask({
        taskId: task.id,
        isAlarm: nextIsAlarm,
        notificationId: newNotifIds || [],
      })
    );
  };

  const handleRescheduleTaskDate = async (task, targetDateIso) => {
    DevLogger.info(`Rescheduling task ${task.taskname} to ${targetDateIso}`);
    await cancelNotification(task.notificationId, task.id);
    const newNotifIds = await scheduleTaskReminder(
      task.taskname,
      task.reminder || 'None',
      targetDateIso,
      task.time,
      task.id,
      task.isAlarm || false,
      themeState,
      { isNagMode: task.isNagMode, escalationLevel: task.escalationLevel }
    );
    dispatch(
      updateTask({
        taskId: task.id,
        completionDate: targetDateIso,
        notificationId: newNotifIds || [],
      })
    );
    DevLogger.success(`Rescheduled task ${task.taskname}`);
  };

  const handleTestTaskNotifNow = async (task) => {
    DevLogger.info(`Triggering instant test notification for ${task.taskname} (in 3s)`);
    const fireTime = dayjs().add(3, 'second');
    const notifId = await scheduleExactTaskReminder(
      `[DEBUG TEST] ${task.taskname}`,
      fireTime.toDate(),
      task.id,
      task.isAlarm || false,
      'task_reminder',
      themeState
    );
    if (notifId) {
      DevLogger.success(`Test notification scheduled in 3s (ID: ${notifId})`);
    } else {
      DevLogger.error(`Failed to schedule test notification for ${task.taskname}`);
    }
  };

  const handlePurgeTaskNotif = async (task) => {
    DevLogger.info(`Purging notifications for task ${task.taskname}`);
    await cancelNotification(task.notificationId, task.id);
    dispatch(updateTask({ taskId: task.id, notificationId: [] }));
    DevLogger.success(`Purged notifications for task ${task.id}`);
  };

  // --- Notification Diagnostic Actions ---
  const handleTestStandardNotif = async () => {
    DevLogger.info('Triggering 3-second Standard Notification Test');
    const fireTime = dayjs().add(3, 'second');
    await scheduleExactTaskReminder(
      'Standard Test Reminder',
      fireTime.toDate(),
      'test_std_123',
      false,
      'task_reminder',
      themeState
    );
  };

  const handleTestFullAlarm = async () => {
    DevLogger.info('Triggering 3-second Full-Screen Alarm Test (with audio pause & over other apps)');
    const fireTime = dayjs().add(3, 'second');
    await scheduleExactTaskReminder(
      'Full Screen Alarm Test',
      fireTime.toDate(),
      'test_alarm_fullscreen_123',
      true,
      'task_alarm',
      { ...themeState, alarmPresentationStyle: 'fullscreen' }
    );
  };

  const handleTestPopupAlarm = async () => {
    DevLogger.info('Triggering 3-second Popup Banner Alarm Test (heads-up with action buttons)');
    const fireTime = dayjs().add(3, 'second');
    await scheduleExactTaskReminder(
      'Popup Banner Alarm Test',
      fireTime.toDate(),
      'test_alarm_popup_123',
      true,
      'task_reminder',
      { ...themeState, alarmPresentationStyle: 'popup' }
    );
  };

  const handleTestCarSilentMode = async () => {
    DevLogger.info('Triggering 3-second Android Auto / Car Silent Mode Test');
    const fireTime = dayjs().add(3, 'second');
    await scheduleExactTaskReminder(
      'Car Silent Notification Test',
      fireTime.toDate(),
      'test_car_silent_123',
      false,
      'task_reminder',
      { ...themeState, androidAutoEnabled: true }
    );
  };

  const handleTestNagSimulation = async () => {
    DevLogger.info('Starting Nag Mode Simulation (3 notifications at 5s, 10s, 15s)');
    for (let i = 1; i <= 3; i++) {
      const fireTime = dayjs().add(i * 5, 'second');
      await scheduleExactTaskReminder(
        `[NAG #${i}] Test Nag Reminder`,
        fireTime.toDate(),
        `test_nag_${i}`,
        true,
        'task_alarm',
        themeState
      );
    }
  };

  const handleTestEscalationSimulation = async () => {
    DevLogger.info('Starting Escalation Simulation (2 urgent reminders at 3s and 7s)');
    const t1 = dayjs().add(3, 'second');
    const t2 = dayjs().add(7, 'second');
    await scheduleExactTaskReminder(
      '[URGENT 1/2] Escalating Task Reminder',
      t1.toDate(),
      'test_esc_1',
      true,
      'task_alarm',
      themeState
    );
    await scheduleExactTaskReminder(
      '[URGENT 2/2] Escalating Task Reminder',
      t2.toDate(),
      'test_esc_2',
      true,
      'task_alarm',
      themeState
    );
  };

  const handleTestAutomationMorning = async () => {
    DevLogger.info('Triggering Morning Summary Test Notification');
    const channelId = getChannelId(false, themeState.notificationSound, themeState.vibrationEnabled);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Good Morning! (Debug Test)',
        body: 'You have 3 tasks for today.\n• Finish Project Report\n• Call Client\n• Team Meeting',
        sound: true,
      },
      trigger: Platform.OS === 'android' ? { channelId } : null,
    });
  };

  const handleInspectScheduledNotifs = async () => {
    try {
      const list = await Notifications.getAllScheduledNotificationsAsync();
      setScheduledNotifications(list);
      DevLogger.info(`Fetched ${list.length} scheduled notifications in system`, list);
    } catch (e) {
      DevLogger.error('Failed to inspect scheduled notifications', e.message);
    }
  };

  const handlePurgeAllScheduledNotifs = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      setScheduledNotifications([]);
      DevLogger.success('Successfully purged ALL scheduled notifications from system scheduler');
    } catch (e) {
      DevLogger.error('Failed to purge scheduled notifications', e.message);
    }
  };

  const handleInspectChannels = async () => {
    if (Platform.OS !== 'android') {
      DevLogger.warn('Notification channels only exist on Android');
      return;
    }
    try {
      const channels = await Notifications.getNotificationChannelsAsync();
      setChannelsList(channels);
      DevLogger.info(
        `Android notification channels: ${channels.length}`,
        channels.map(normalizeChannelForLog)
      );
    } catch (error) {
      DevLogger.error('Failed to inspect Android channels', error.message);
    }
  };

  // --- Reschedule Actions ---
  const handleRescheduleAllActive = async () => {
    DevLogger.info('Manual trigger: Rescheduling all active tasks');
    await rescheduleAllActiveTasks(tasks, themeState, dispatch, updateTask);
    DevLogger.success('Reschedule all active tasks completed');
  };

  const handleRunAutoManageEngine = async () => {
    DevLogger.info('Manual trigger: Running Auto-Manage engine (processAutoManageTasks)');
    await dispatch(processAutoManageTasks());
    DevLogger.success('Auto-Manage engine execution finished');
  };

  // --- Chaos & Stress Testing Handlers ---
  const handleInjectStressTasks = async () => {
    try {
      const activeBoard = boards[0]?.id || 'main';
      const startTime = Date.now();
      const stressTasks = ChaosTestHelper.generateStressTasks(200, activeBoard);
      await dispatch(addMultipleTasks(stressTasks));
      const durationMs = Date.now() - startTime;
      const metrics = ChaosTestHelper.getPayloadMetrics([...tasks, ...stressTasks]);
      DevLogger.info(`[ChaosTest] Injected 200 stress tasks in ${durationMs}ms. New payload: ${metrics.formattedSize}`);
      Alert.alert(
        'Stress Benchmark Injected',
        `Successfully generated and dispatched 200 tasks in ${durationMs}ms.\nTotal payload: ${metrics.formattedSize}.\nUse Board and Calendar screens to inspect FlashList rendering and scrolling responsiveness.`
      );
    } catch (e) {
      DevLogger.error('[ChaosTest] Failed to inject stress tasks', e.message);
      Alert.alert('Injection Error', e.message);
    }
  };

  const handleRunStorageTamperTest = async () => {
    try {
      const result = await ChaosTestHelper.testStorageCorruptionResilience(CryptoStorage, AsyncStorage);
      if (result.isTamperCaught) {
        DevLogger.success(`[ChaosTest] Tamper canary passed: ${result.message}`);
        Alert.alert('Storage Resilience PASS', result.message);
      } else {
        DevLogger.error(`[ChaosTest] Tamper canary failed: ${result.message || result.error}`);
        Alert.alert('Storage Resilience FAIL', result.error || result.message);
      }
    } catch (e) {
      DevLogger.error('[ChaosTest] Storage tamper test threw unexpected error', e.message);
      Alert.alert('Test Error', e.message);
    }
  };

  const handlePurgeChaosTasks = async () => {
    try {
      const chaosTaskIds = tasks.filter(ChaosTestHelper.isChaosTask).map((t) => t.id || t._id);
      if (chaosTaskIds.length === 0) {
        Alert.alert('No Chaos Tasks', 'There are no active chaos test tasks in the state.');
        return;
      }
      await dispatch(deleteMultipleTasks(chaosTaskIds));
      DevLogger.info(`[ChaosTest] Purged ${chaosTaskIds.length} synthetic chaos tasks from state`);
      Alert.alert('Cleaned Up', `Successfully purged ${chaosTaskIds.length} synthetic chaos tasks.`);
    } catch (e) {
      DevLogger.error('[ChaosTest] Failed to purge chaos tasks', e.message);
      Alert.alert('Purge Error', e.message);
    }
  };

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    return logs.filter((l) => l.type === logFilter);
  }, [logs, logFilter]);

  const handleBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else if (navigation?.navigate) {
      navigation.navigate('MainTabs', { screen: 'Settings' });
    } else if (navigationRef?.isReady?.()) {
      navigationRef.navigate('MainTabs', { screen: 'Settings' });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgMain, paddingBottom: insets?.bottom || 0 }]}>
      {/* Top Header with Back button */}
      <View style={[styles.screenHeader, { backgroundColor: colors.bgCard, borderBottomColor: colors.borderColor }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back to Settings"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconArrowLeft color={colors.textPrimary} size={20} />
          <Text style={[styles.backBtnText, { color: colors.textPrimary }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Debugger & System Logs</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Top Section Nav Tabs */}
      <View style={[styles.topTabsBar, { backgroundColor: colors.bgCard, borderBottomColor: colors.borderColor }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 6 }}>
          {[
            { id: 'tasks', label: 'Tasks & State' },
            { id: 'notifications', label: 'Notifications' },
            { id: 'reschedule', label: 'Reschedule Engine' },
            { id: 'bottlenecks', label: 'Bottlenecks' },
            { id: 'crashes', label: `Crashes (${crashLogs.length})` },
            { id: 'logs', label: `Logs (${logs.length})` },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabBtn,
                activeTab === tab.id && { backgroundColor: colors.primary },
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === tab.id ? '#fff' : colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      <View style={{ flex: 1 }}>
        {/* ================= TAB 1: TASKS & STATE ================= */}
        {activeTab === 'tasks' && (
          <ScrollView contentContainerStyle={styles.scrollSection}>
            {/* Stats Bar */}
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: colors.bgCard }]}>
                <Text style={[styles.statNum, { color: colors.primary }]}>{taskStats.total}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: colors.bgCard }]}>
                <Text style={[styles.statNum, { color: '#ffaa00' }]}>{taskStats.active}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: colors.bgCard }]}>
                <Text style={[styles.statNum, { color: '#ff4d4f' }]}>{taskStats.missed}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Missed</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: colors.bgCard }]}>
                <Text style={[styles.statNum, { color: '#52c41a' }]}>{taskStats.hasNotif}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Scheduled</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: colors.bgCard }]}>
                <Text style={[styles.statNum, { color: '#1890ff' }]}>{taskStats.alarms}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Alarms</Text>
              </View>
            </View>

            {/* Live Task Details Modal Diagnostics Card */}
            <View style={{ backgroundColor: isDark ? '#1a1f2c' : '#f0f4ff', borderColor: colors.primary, borderWidth: 1.5, borderRadius: 12, padding: 14, marginBottom: 15 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary }}>
                  🔬 Task Details Modal Diagnostics
                </Text>
                <TouchableOpacity
                  onPress={() => TaskEditDiagnostics.clear()}
                  style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: isDark ? '#2a2f3d' : '#e2e8f0', borderRadius: 6 }}
                >
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>Clear</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                Fabric: {typeof global !== 'undefined' && Boolean(global.nativeFabricUIManager) ? 'Active' : 'Disabled'} | Platform: {Platform.OS} | Intercepted: {taskEditEvents.length} events
              </Text>

              {taskEditEvents.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 12 }}>
                  No edit events captured yet. Tap any task row or edit button in Tasks or Calendar, then return here to inspect the trace.
                </Text>
              ) : (
                <View style={{ backgroundColor: isDark ? '#121620' : '#ffffff', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#52c41a', marginBottom: 4 }}>
                    Latest: {taskEditEvents[0].type} ({dayjs(taskEditEvents[0].timestamp).format('HH:mm:ss.SSS')})
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }} numberOfLines={4}>
                    {JSON.stringify(taskEditEvents[0].payload, null, 2)}
                  </Text>
                  {taskEditEvents.slice(1, 4).map((ev, i) => (
                    <Text key={ev.id || i} style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4 }}>
                      • {ev.type} @ {dayjs(ev.timestamp).format('HH:mm:ss.SSS')}
                    </Text>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                onPress={() => {
                  const target = tasks.length > 0 ? tasks[0] : { id: 'diag_test_task', taskname: 'Diagnostics Test Task', completionDate: dayjs().format('YYYY-MM-DD'), priority: 'high', subtasks: [] };
                  TaskEditDiagnostics.record('DEVLOGS_TRIGGER_MODAL_TEST', { taskId: target.id, taskname: target.taskname });
                  setTestModalTask(target);
                  setIsTestModalVisible(true);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                  🧪 Test Open Task Details Modal Now
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search & Filter */}
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.bgCard, color: colors.textPrimary, borderColor: colors.borderColor }]}
              placeholder="Search task by name or ID..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 15 }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'missed', label: 'Missed' },
                { id: 'hasNotif', label: 'Has Notif' },
                { id: 'alarm', label: 'Alarm' },
                { id: 'recurring', label: 'Recurring' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterChip, taskFilter === f.id && { backgroundColor: colors.primary }]}
                  onPress={() => setTaskFilter(f.id)}
                >
                  <Text style={{ color: taskFilter === f.id ? '#fff' : colors.textSecondary, fontSize: 12, fontWeight: 'bold' }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Task List */}
            {filteredTasks.length === 0 ? (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginVertical: 20 }}>
                No tasks match filter.
              </Text>
            ) : (
              <>
              {filteredTasks.slice(0, visibleTaskLimit).map((t) => {
                const isExpanded = expandedTaskId === t.id;
                const isMissed = isTaskMissed(t);
                return (
                  <View
                    key={t.id}
                    style={[
                      styles.taskDebugCard,
                      { backgroundColor: colors.bgCard, borderColor: isMissed ? '#ff4d4f' : colors.borderColor },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => setExpandedTaskId(isExpanded ? null : t.id)}
                      style={styles.taskDebugHeader}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.taskTitle, { color: colors.textPrimary }]}>
                          {t.taskname || 'Untitled Task'}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                          ID: {t.id} | Due: {getTaskDateStr(t) || 'No date'} {t.time || ''} | Rem: {t.reminder || 'None'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        {t.isAlarm && (
                          <View style={[styles.tag, { backgroundColor: 'rgba(255,77,79,0.2)' }]}>
                            <Text style={{ color: '#ff4d4f', fontSize: 10, fontWeight: 'bold' }}>ALARM</Text>
                          </View>
                        )}
                        {t.notificationId && t.notificationId.length > 0 && (
                          <View style={[styles.tag, { backgroundColor: 'rgba(82,196,26,0.2)' }]}>
                            <Text style={{ color: '#52c41a', fontSize: 10, fontWeight: 'bold' }}>NOTIF</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Expanded Raw State & Actions */}
                    {isExpanded && (
                      <View style={styles.expandedSection}>
                        <Text style={[styles.jsonText, { color: colors.textSecondary }]}>
                          {JSON.stringify(
                            {
                              id: t.id,
                              boardId: t.boardId || 'main',
                              completionDate: t.completionDate,
                              dateString: t.dateString,
                              time: t.time,
                              reminder: t.reminder,
                              isAlarm: !!t.isAlarm,
                              isNagMode: !!t.isNagMode,
                              escalationLevel: t.escalationLevel || 'none',
                              notificationId: t.notificationId || [],
                              recurringSeriesId: t.recurringSeriesId || null,
                              completed: !!t.completed,
                            },
                            null,
                            2
                          )}
                        </Text>

                        {/* Actions */}
                        <Text style={{ color: colors.textPrimary, fontWeight: 'bold', marginTop: 10, marginBottom: 6, fontSize: 12 }}>
                          Quick Debug Actions:
                        </Text>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleTestTaskNotifNow(t)}
                          >
                            <Text style={styles.actionBtnText}>Test Notif (in 3s)</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: t.isAlarm ? '#ff4d4f' : colors.primary }]}
                            onPress={() => handleToggleTaskAlarm(t)}
                          >
                            <Text style={styles.actionBtnText}>
                              {t.isAlarm ? 'Disable Alarm Mode' : 'Enable Alarm Mode'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() =>
                              handleRescheduleTaskDate(t, dayjs().format('YYYY-MM-DD'))
                            }
                          >
                            <Text style={styles.actionBtnText}>Move to Today</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() =>
                              handleRescheduleTaskDate(t, dayjs().add(1, 'day').format('YYYY-MM-DD'))
                            }
                          >
                            <Text style={styles.actionBtnText}>Move to Tomorrow</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() =>
                              handleTaskReminderChange(
                                t,
                                t.reminder === '15 min before' ? 'None' : '15 min before'
                              )
                            }
                          >
                            <Text style={styles.actionBtnText}>
                              Set Reminder ({t.reminder === '15 min before' ? 'None' : '15m'})
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#ff4d4f' }]}
                            onPress={() => handlePurgeTaskNotif(t)}
                          >
                            <Text style={styles.actionBtnText}>Purge Task Notifs</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
              {filteredTasks.length > visibleTaskLimit && (
                <TouchableOpacity
                  style={[styles.btnLarge, { backgroundColor: colors.surfaceContainerHigh || '#E5E5EA', marginTop: 8, marginBottom: 16 }]}
                  onPress={() => setVisibleTaskLimit((prev) => prev + 40)}
                >
                  <Text style={[styles.btnLargeText, { color: colors.textPrimary }]}>
                    Show More Tasks ({filteredTasks.length - visibleTaskLimit} remaining)
                  </Text>
                </TouchableOpacity>
              )}
              </>
            )}
          </ScrollView>
        )}

        {/* ================= TAB 2: NOTIFICATIONS & ALARMS ================= */}
        {activeTab === 'notifications' && (
          <ScrollView contentContainerStyle={styles.scrollSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                Alarms & Notifications Health Checker
              </Text>
              <TouchableOpacity
                style={[styles.btnSmall, { backgroundColor: colors.primary, maxWidth: 120, paddingVertical: 6 }]}
                onPress={runSystemDiagnostics}
                disabled={isDiagnosing}
              >
                <Text style={styles.btnSmallText}>
                  {isDiagnosing ? 'Checking...' : 'Run Diagnostic'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* System Health Capabilities Matrix Card */}
            <View style={[styles.cardDump, { backgroundColor: colors.bgCard, borderColor: colors.borderColor, marginBottom: 16 }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 8 }}>
                System Permissions & Subsystem Health
              </Text>

              {/* Exact Alarms Capability */}
              <View style={styles.infoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoKey, { color: colors.textPrimary }]}>Exact Alarms (Android 12+)</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Required for on-time alarm triggering</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.tag, { backgroundColor: systemDiag?.canScheduleExactAlarms !== false ? 'rgba(82, 196, 26, 0.15)' : 'rgba(255, 77, 79, 0.15)' }]}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: systemDiag?.canScheduleExactAlarms !== false ? '#52c41a' : '#ff4d4f' }}>
                      {systemDiag?.canScheduleExactAlarms !== false ? 'Allowed' : 'Restricted'}
                    </Text>
                  </View>
                  {systemDiag?.canScheduleExactAlarms === false && (
                    <TouchableOpacity
                      style={[styles.btnSmall, { backgroundColor: '#ff4d4f', paddingVertical: 4, paddingHorizontal: 6 }]}
                      onPress={openExactAlarmSettings}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>Enable</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Full Screen Intent Capability */}
              <View style={styles.infoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoKey, { color: colors.textPrimary }]}>Full-Screen Intent (Android 14+)</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Required for full-screen alarm screen</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: systemDiag?.canUseFullScreenIntent !== false ? 'rgba(82, 196, 26, 0.15)' : 'rgba(255, 77, 79, 0.15)' }]}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: systemDiag?.canUseFullScreenIntent !== false ? '#52c41a' : '#ff4d4f' }}>
                    {systemDiag?.canUseFullScreenIntent !== false ? 'Allowed' : 'Blocked'}
                  </Text>
                </View>
              </View>

              {/* Display Over Other Apps */}
              <View style={styles.infoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoKey, { color: colors.textPrimary }]}>Display Over Other Apps</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Shows alarm over YouTube, games & active apps</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.tag, { backgroundColor: systemDiag?.canDrawOverlays ? 'rgba(82, 196, 26, 0.15)' : 'rgba(250, 173, 20, 0.15)' }]}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: systemDiag?.canDrawOverlays ? '#52c41a' : '#faad14' }}>
                      {systemDiag?.canDrawOverlays ? 'Granted' : 'Not Granted'}
                    </Text>
                  </View>
                  {!systemDiag?.canDrawOverlays && (
                    <TouchableOpacity
                      style={[styles.btnSmall, { backgroundColor: colors.primary, paddingVertical: 4, paddingHorizontal: 6 }]}
                      onPress={openOverlaySettings}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>Grant</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Battery Optimization / Doze */}
              <View style={styles.infoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoKey, { color: colors.textPrimary }]}>Battery Optimization</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Prevents OS from killing or delaying alarms</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.tag, { backgroundColor: systemDiag?.isIgnoringBatteryOptimizations ? 'rgba(82, 196, 26, 0.15)' : 'rgba(250, 173, 20, 0.15)' }]}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: systemDiag?.isIgnoringBatteryOptimizations ? '#52c41a' : '#faad14' }}>
                      {systemDiag?.isIgnoringBatteryOptimizations ? 'Unrestricted' : 'Optimized'}
                    </Text>
                  </View>
                  {!systemDiag?.isIgnoringBatteryOptimizations && (
                    <TouchableOpacity
                      style={[styles.btnSmall, { backgroundColor: '#faad14', paddingVertical: 4, paddingHorizontal: 6 }]}
                      onPress={openBatteryOptimizationSettings}
                    >
                      <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>Fix</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Notifications Permission */}
              <View style={styles.infoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoKey, { color: colors.textPrimary }]}>Notification Permission</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Standard notification posting permission</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.tag, { backgroundColor: permissionStatus === 'granted' ? 'rgba(82, 196, 26, 0.15)' : 'rgba(255, 77, 79, 0.15)' }]}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: permissionStatus === 'granted' ? '#52c41a' : '#ff4d4f' }}>
                      {permissionStatus || 'Checking...'}
                    </Text>
                  </View>
                  {permissionStatus !== 'granted' && (
                    <TouchableOpacity
                      style={[styles.btnSmall, { backgroundColor: colors.primary, paddingVertical: 4, paddingHorizontal: 6 }]}
                      onPress={async () => {
                        const res = await Notifications.requestPermissionsAsync();
                        setPermissionStatus(res.status);
                        await runSystemDiagnostics();
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>Grant</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Android Auto / Car Connection */}
              <View style={styles.infoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoKey, { color: colors.textPrimary }]}>Android Auto / Car Connection</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Auto-silences sounds while driving</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: systemDiag?.isCarConnected ? 'rgba(24, 144, 255, 0.15)' : 'rgba(128, 128, 128, 0.15)' }]}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: systemDiag?.isCarConnected ? '#1890ff' : colors.textSecondary }}>
                    {systemDiag?.isCarConnected ? 'Connected (Muted)' : 'Disconnected (Normal)'}
                  </Text>
                </View>
              </View>

              {/* Alarm Display Mode */}
              <View style={styles.infoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoKey, { color: colors.textPrimary }]}>Alarm Display Mode</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Locked screen: Full Screen • Other: Popup banner</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: 'rgba(98, 70, 234, 0.15)' }]}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.primary }}>
                    Adaptive
                  </Text>
                </View>
              </View>

              {/* Audio Management */}
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoKey, { color: colors.textPrimary }]}>Audio Focus & Ducking</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Alarms pause YouTube/media; notifications duck volume</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: 'rgba(82, 196, 26, 0.15)' }]}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#52c41a' }}>Active</Text>
                </View>
              </View>
            </View>

            {/* Task Reminders vs OS Scheduler Synchronization Card */}
            <View style={[styles.cardDump, { backgroundColor: colors.bgCard, borderColor: colors.borderColor, marginBottom: 16 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  Scheduler Synchronization Checker
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  {desyncReport?.osScheduled ?? 0} OS Alarms Active
                </Text>
              </View>

              {desyncReport?.missing && desyncReport.missing.length > 0 ? (
                <View style={{ marginTop: 6 }}>
                  <View style={{ backgroundColor: 'rgba(255, 77, 79, 0.1)', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#ff4d4f' }}>
                    <Text style={{ color: '#ff4d4f', fontWeight: 'bold', fontSize: 12 }}>
                      ⚠️ {desyncReport.missing.length} tasks have reminders configured but are MISSING from the OS scheduler!
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                      Tasks: {desyncReport.missing.map(m => `"${m.taskname}"`).join(', ')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.btnLarge, { backgroundColor: '#ff4d4f' }]}
                    onPress={handleFixAllDesynced}
                  >
                    <Text style={styles.btnLargeText}>⚡ Fix & Re-sync All ({desyncReport.missing.length} tasks)</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ backgroundColor: 'rgba(82, 196, 26, 0.1)', padding: 10, borderRadius: 8, marginTop: 6 }}>
                  <Text style={{ color: '#52c41a', fontWeight: 'bold', fontSize: 12 }}>
                    ✅ All {desyncReport?.total ?? 0} tasks with reminders are fully registered with the Android OS scheduler.
                  </Text>
                </View>
              )}
            </View>

            {/* Live Interactive Test Suite */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 10 }]}>
              Live Alarm & Audio Diagnostics (In 3s)
            </Text>

            <View style={{ gap: 10, marginBottom: 20 }}>
              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: '#ff4d4f' }]}
                onPress={handleTestFullAlarm}
              >
                <Text style={styles.btnLargeText}>Test Full-Screen Alarm (Pauses Media & Shows on Top)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: '#722ed1' }]}
                onPress={handleTestPopupAlarm}
              >
                <Text style={styles.btnLargeText}>Test Popup Banner Alarm (Heads-Up with Actions)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: colors.primary }]}
                onPress={handleTestStandardNotif}
              >
                <Text style={styles.btnLargeText}>Test Standard Notification (Audio Ducking)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: '#1890ff' }]}
                onPress={handleTestCarSilentMode}
              >
                <Text style={styles.btnLargeText}>Test Android Auto / Car Silent Mode (Muted)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: '#faad14' }]}
                onPress={handleTestNagSimulation}
              >
                <Text style={[styles.btnLargeText, { color: '#000' }]}>
                  Test Nag Mode Simulation (3 Repeating Alarms)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: '#13c2c2' }]}
                onPress={handleTestEscalationSimulation}
              >
                <Text style={styles.btnLargeText}>Test Escalating Reminders Simulation</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: '#333' }]}
                onPress={async () => {
                  const id = await testAndroidDefaultNotification();
                  if (id) DevLogger.success(`Default sound diagnostic triggered: ${id}`);
                }}
              >
                <Text style={styles.btnLargeText}>Test Android Default Sound Diagnostic</Text>
              </TouchableOpacity>
            </View>

            {/* System Scheduler Inspection */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>OS Scheduler Details</Text>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
              <TouchableOpacity style={[styles.btnSmall, { backgroundColor: colors.primary }]} onPress={handleInspectScheduledNotifs}>
                <Text style={styles.btnSmallText}>Inspect Scheduled ({scheduledNotifications.length})</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btnSmall, { backgroundColor: '#ff4d4f' }]} onPress={handlePurgeAllScheduledNotifs}>
                <Text style={styles.btnSmallText}>Purge ALL Scheduled</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btnSmall, { backgroundColor: '#52c41a' }]} onPress={handleInspectChannels}>
                <Text style={styles.btnSmallText}>Inspect Channels ({channelsList.length})</Text>
              </TouchableOpacity>
            </View>

            {/* Scheduled Notifications Details */}
            {scheduledNotifications.length > 0 && (
              <View style={[styles.cardDump, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
                <Text style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 6 }}>
                  Active Scheduled Notifications ({scheduledNotifications.length}):
                </Text>
                <ScrollView style={{ maxHeight: 200 }}>
                  <Text style={[styles.jsonText, { color: colors.textSecondary }]}>
                    {JSON.stringify(scheduledNotifications, null, 2)}
                  </Text>
                </ScrollView>
              </View>
            )}

            {/* Channels Details */}
            {channelsList.length > 0 && (
              <View style={[styles.cardDump, { backgroundColor: colors.bgCard, borderColor: colors.borderColor, marginTop: 10 }]}>
                <Text style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 6 }}>
                  Android Channels ({channelsList.length}):
                </Text>
                <ScrollView style={{ maxHeight: 200 }}>
                  <Text style={[styles.jsonText, { color: colors.textSecondary }]}>
                    {JSON.stringify(channelsList.map(normalizeChannelForLog), null, 2)}
                  </Text>
                </ScrollView>
              </View>
            )}
          </ScrollView>
        )}

        {/* ================= TAB 3: RESCHEDULE ENGINE ================= */}
        {activeTab === 'reschedule' && (
          <ScrollView contentContainerStyle={styles.scrollSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Reschedule & Auto-Manage Engine</Text>

            <View style={{ gap: 12, marginBottom: 20 }}>
              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: colors.primary }]}
                onPress={handleRescheduleAllActive}
              >
                <Text style={styles.btnLargeText}>Run Reschedule All Active Tasks</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: '#52c41a' }]}
                onPress={handleRunAutoManageEngine}
              >
                <Text style={styles.btnLargeText}>Run Process Auto-Manage Tasks Engine</Text>
              </TouchableOpacity>
            </View>

            {/* Auto Manage Settings Dump */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Current Settings Config</Text>
            <View style={[styles.cardDump, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
              <Text style={[styles.jsonText, { color: colors.textSecondary }]}>
                {JSON.stringify(
                  {
                    autoTransferMode: themeState.autoTransferMode || 'none',
                    increasePriorityWhenOverdue: !!themeState.increasePriorityWhenOverdue,
                    priorityFrequency: themeState.priorityFrequency || 'never',
                    autoRescheduleTime: themeState.autoRescheduleTime || '23:59',
                    rescheduleTransferredReminders: themeState.rescheduleTransferredReminders !== false,
                    notificationSound: themeState.notificationSound || 'default',
                    alarmSound: themeState.alarmSound || 'default',
                    vibrationEnabled: themeState.vibrationEnabled !== false,
                    defaultReminderEnabled: !!themeState.defaultReminderEnabled,
                    defaultReminderTime: themeState.defaultReminderTime || '15 min before',
                    boardAutomations: themeState.boardAutomations || {},
                  },
                  null,
                  2
                )}
              </Text>
            </View>
          </ScrollView>
        )}

        {/* ================= TAB 4: BOTTLENECKS & SYSTEM ================= */}
        {activeTab === 'bottlenecks' && (
          <ScrollView contentContainerStyle={styles.scrollSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>System & Performance Metrics</Text>

            <View style={[styles.cardDump, { backgroundColor: colors.bgCard, borderColor: colors.borderColor, marginBottom: 15 }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoKey, { color: colors.textSecondary }]}>Platform OS:</Text>
                <Text style={[styles.infoVal, { color: colors.textPrimary }]}>{Platform.OS} ({Platform.Version})</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoKey, { color: colors.textSecondary }]}>Device Time:</Text>
                <Text style={[styles.infoVal, { color: colors.textPrimary }]}>{new Date().toLocaleString()}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoKey, { color: colors.textSecondary }]}>Notifications Permission:</Text>
                <Text style={[styles.infoVal, { color: permissionStatus === 'granted' ? '#52c41a' : '#ff4d4f' }]}>
                  {permissionStatus || 'Checking...'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoKey, { color: colors.textSecondary }]}>Redux Task Payload Size:</Text>
                <Text style={[styles.infoVal, { color: colors.textPrimary }]}>
                  ~{Math.round(JSON.stringify(tasks).length / 1024)} KB ({tasks.length} items)
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoKey, { color: colors.textSecondary }]}>Boards Count:</Text>
                <Text style={[styles.infoVal, { color: colors.textPrimary }]}>{boards.length}</Text>
              </View>
            </View>
          </ScrollView>
        )}

        {/* ================= TAB 5: CRASHES & ERROR LOGS ================= */}
        {activeTab === 'crashes' && (
          <ScrollView contentContainerStyle={styles.scrollSection}>
            {/* Crash Health Status Card */}
            <View style={[
              styles.sectionCard, 
              { 
                backgroundColor: colors.bgCard, 
                borderColor: crashLogs.length > 0 ? '#f44336' : (colors.borderColor || '#E5E5EA'),
                borderWidth: crashLogs.length > 0 ? 1.5 : 1
              }
            ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={[styles.sectionTitle, { color: crashLogs.length > 0 ? '#f44336' : colors.textPrimary, marginBottom: 0 }]}>
                  {crashLogs.length > 0 ? `⚠️ ${crashLogs.length} Crash(es) Detected` : '✅ System Healthy (0 Crashes)'}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: crashLogs.length > 0 ? 'rgba(244,67,54,0.15)' : 'rgba(76,175,80,0.15)' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: crashLogs.length > 0 ? '#f44336' : '#4CAF50' }}>
                    {crashLogs.length > 0 ? 'ERRORS RECORDED' : 'ALL CLEAR'}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 }}>
                {crashLogs.length > 0 
                  ? 'Runtime errors or exceptions caught by ScreenErrorBoundary are captured here. Tap any item to inspect the stack trace.'
                  : 'No runtime errors or unhandled exceptions have been recorded. Error boundaries and render passes are clean.'}
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={async () => {
                    const testEntry = {
                      screenName: 'ManualCrashTester',
                      error: new Error('Simulated runtime error triggered to verify crash detection system.'),
                      errorInfo: { componentStack: '\n    in TaskList\n    in BoardScreen\n    in ScreenErrorBoundary' }
                    };
                    await CrashLogger.recordCrash(testEntry);
                    Alert.alert('Simulated Crash Recorded', 'A test crash was added to the crash log to verify the capture mechanism.');
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Simulate Test Error</Text>
                </TouchableOpacity>

                {crashLogs.length > 0 && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.surfaceContainerHigh || '#E5E5EA' }]}
                      onPress={() => {
                        const reportText = JSON.stringify(crashLogs, null, 2);
                        Clipboard.setString(reportText);
                        Alert.alert('Copied', 'Complete crash report copied to clipboard.');
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 'bold' }}>Copy All Crashes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: 'rgba(244,67,54,0.15)' }]}
                      onPress={async () => {
                        await CrashLogger.clearCrashLogs();
                        Alert.alert('Cleared', 'Crash log history has been wiped.');
                      }}
                    >
                      <Text style={{ color: '#f44336', fontSize: 12, fontWeight: 'bold' }}>Clear Crashes</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Crash Entries Feed */}
            {crashLogs.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginBottom: 8 }]}>
                  CRASH LOGS HISTORY ({crashLogs.length})
                </Text>
                {crashLogs.map((crash) => {
                  const isExpanded = expandedCrashId === crash.id;
                  return (
                    <View
                      key={crash.id}
                      style={[
                        styles.taskDetailCard,
                        { backgroundColor: colors.bgCard, borderColor: colors.borderColor, marginBottom: 10 }
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setExpandedCrashId(isExpanded ? null : crash.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f44336' }} />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                              {crash.screenName}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                              {dayjs(crash.timestamp).format('MMM D, h:mm:ss A')}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 12, color: '#f44336', fontWeight: '600' }} numberOfLines={isExpanded ? undefined : 2}>
                            {crash.message}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: 'bold' }}>
                          {isExpanded ? '▲' : '▼'}
                        </Text>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderColor }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
                              STACK TRACE:
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                const fullReport = `Screen: ${crash.screenName}\nTime: ${crash.timestamp}\nError: ${crash.message}\n\nStack:\n${crash.stack || 'No stack'}\n\nComponent Stack:\n${crash.componentStack || 'None'}`;
                                Clipboard.setString(fullReport);
                                Alert.alert('Copied', 'Crash stack trace copied to clipboard.');
                              }}
                              style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: colors.surfaceContainerHigh || '#E5E5EA' }}
                            >
                              <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.textPrimary }}>Copy Stack</Text>
                            </TouchableOpacity>
                          </View>

                          <ScrollView horizontal style={{ backgroundColor: isDark ? '#1a1a24' : '#2d2d3a', borderRadius: 8, padding: 10, maxHeight: 220 }}>
                            <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11, color: '#e0e0e0', lineHeight: 16 }}>
                              {crash.stack || crash.componentStack || crash.message}
                            </Text>
                          </ScrollView>

                          {crash.componentStack && (
                            <View style={{ marginTop: 8 }}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 }}>
                                COMPONENT HIERARCHY:
                              </Text>
                              <ScrollView horizontal style={{ backgroundColor: isDark ? '#1a1a24' : '#2d2d3a', borderRadius: 8, padding: 10, maxHeight: 150 }}>
                                <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 10, color: '#a0c0e0', lineHeight: 14 }}>
                                  {crash.componentStack}
                                </Text>
                              </ScrollView>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Hardware Health & Resource Monitor */}
            <View style={[
              styles.sectionCard,
              {
                backgroundColor: colors.bgCard,
                borderColor: isMemoryPeak ? '#f44336' : isMemoryWarning ? '#faad14' : (colors.borderColor || '#E5E5EA'),
                borderWidth: (isMemoryPeak || isMemoryWarning) ? 1.5 : 1,
                marginTop: 14,
              }
            ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[styles.sectionTitle, { color: isMemoryPeak ? '#f44336' : colors.textPrimary, marginBottom: 0, flex: 1, marginRight: 8 }]}>
                  🖥️ Hardware Health & Resource Monitor (Peak Guard)
                </Text>
                <View style={[
                  styles.statusBadge, 
                  { 
                    flexShrink: 0,
                    backgroundColor: isMemoryPeak 
                      ? 'rgba(244,67,54,0.15)' 
                      : isMemoryWarning 
                      ? 'rgba(250,173,20,0.15)' 
                      : 'rgba(76,175,80,0.15)' 
                  }
                ]}>
                  <Text style={{ 
                    fontSize: 11, 
                    fontWeight: '700', 
                    color: isMemoryPeak ? '#f44336' : isMemoryWarning ? '#faad14' : '#4CAF50' 
                  }}>
                    {isMemoryPeak ? '⚠️ CRITICAL PEAK' : isMemoryWarning ? '⚡ APPROACHING PEAK' : '✅ RESOURCES OPTIMAL'}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10, lineHeight: 18 }}>
                Live Android ART runtime heap, device memory pressure, and event loop latency metrics. Automatically detects and mitigates resource spikes before Android OS terminates the process.
              </Text>

              {/* Peak Warning Banner */}
              {memoryGuardReasons && memoryGuardReasons.length > 0 && (
                <View style={{ 
                  backgroundColor: isMemoryPeak ? 'rgba(244,67,54,0.12)' : 'rgba(250,173,20,0.12)', 
                  borderWidth: 1, 
                  borderColor: isMemoryPeak ? '#f44336' : '#faad14', 
                  borderRadius: 8, 
                  padding: 10, 
                  marginBottom: 12 
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isMemoryPeak ? '#f44336' : '#faad14', marginBottom: 4 }}>
                    {isMemoryPeak ? '🚨 System Approaching Maximum Hardware Peak:' : '⚡ Hardware Threshold Warning:'}
                  </Text>
                  {memoryGuardReasons.map((reason, idx) => (
                    <Text key={idx} style={{ fontSize: 11, color: colors.textPrimary, marginLeft: 6, marginVertical: 1 }}>
                      • {reason}
                    </Text>
                  ))}
                </View>
              )}

              {/* Resource Metrics Grid */}
              <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', padding: 12, borderRadius: 10, marginBottom: 12, gap: 10 }}>
                {/* 1. RAM / Heap with visual bar */}
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>RAM Spent (App Heap):</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isMemoryPeak ? '#f44336' : isMemoryWarning ? '#faad14' : colors.textPrimary }}>
                      {hardwareMetrics.usedHeapMb} MB / {hardwareMetrics.maxHeapMb} MB max ({heapSaturationPercent}%)
                    </Text>
                  </View>
                  <View style={{ height: 6, width: '100%', backgroundColor: isDark ? '#333' : '#e0e0e0', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ 
                      height: '100%', 
                      width: `${Math.min(100, Math.max(5, heapSaturationPercent))}%`, 
                      backgroundColor: heapSaturationPercent >= 85 ? '#f44336' : heapSaturationPercent >= 75 ? '#faad14' : '#52c41a', 
                      borderRadius: 3 
                    }} />
                  </View>
                </View>

                {/* 2. Total Device RAM */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Device RAM Available:</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: hardwareMetrics.lowMemory || hardwareMetrics.availMemMb < 350 ? '#faad14' : colors.textPrimary }}>
                    {hardwareMetrics.availMemMb} MB free / {hardwareMetrics.totalMemMb} MB total {hardwareMetrics.lowMemory ? '⚠️ Low' : ''}
                  </Text>
                </View>

                {/* 3. Processor / Event Loop */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Processor Responsiveness:</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: hardwareMetrics.eventLoopLagMs < 25 ? '#52c41a' : hardwareMetrics.eventLoopLagMs < 70 ? '#faad14' : '#ff4d4f' }}>
                    {hardwareMetrics.fps} FPS ({hardwareMetrics.eventLoopLagMs}ms latency)
                  </Text>
                </View>

                {/* 4. Large Section Density */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Missed Section Density:</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: taskStats.missed > 50 ? '#faad14' : colors.textPrimary }}>
                    {taskStats.missed} tasks (Overdue)
                  </Text>
                </View>

                {/* 5. Crash Guard Status */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>FlashList Crash Guard:</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#52c41a' }}>
                    🛡️ Active (LayoutAnimation bypassed & Peak Guard)
                  </Text>
                </View>
              </View>

              {/* Hardware Numbers Reference Card */}
              <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.borderColor || '#E5E5EA', marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 }}>
                  📊 CRITICAL HARDWARE NUMBERS & THRESHOLDS:
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                  • <Text style={{ fontWeight: '600', color: colors.textPrimary }}>App Heap Saturation:</Text> Warning at <Text style={{ color: '#faad14' }}>{HARDWARE_THRESHOLDS.HEAP_WARNING_PERCENT}%</Text> | Critical Peak at <Text style={{ color: '#f44336' }}>{HARDWARE_THRESHOLDS.HEAP_CRITICAL_PERCENT}%</Text> (Fatal OutOfMemoryError)
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                  • <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Device Free RAM:</Text> Warning under <Text style={{ color: '#faad14' }}>{HARDWARE_THRESHOLDS.AVAIL_MEM_WARNING_MB}MB</Text> | Critical Peak under <Text style={{ color: '#f44336' }}>{HARDWARE_THRESHOLDS.AVAIL_MEM_CRITICAL_MB}MB</Text> (Linux OOM killer)
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                  • <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Event Loop Latency:</Text> Warning over <Text style={{ color: '#faad14' }}>{HARDWARE_THRESHOLDS.EVENT_LOOP_LAG_WARNING_MS}ms</Text> | Critical Peak over <Text style={{ color: '#f44336' }}>{HARDWARE_THRESHOLDS.EVENT_LOOP_LAG_CRITICAL_MS}ms</Text> (ANR dialog)
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                  • <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Section Density:</Text> Warning over <Text style={{ color: '#faad14' }}>{HARDWARE_THRESHOLDS.SECTION_DENSITY_WARNING}</Text> items | Critical Peak over <Text style={{ color: '#f44336' }}>{HARDWARE_THRESHOLDS.SECTION_DENSITY_CRITICAL}</Text> items (Recycling overload)
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  style={[styles.btnLarge, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    const result = triggerEmergencyCleanup('DevLogsScreen Manual Trigger');
                    Alert.alert(
                      '🛡️ Emergency Cleanup Executed',
                      `Executed ${result.hooksExecuted} cleanup hooks and forced GC in ${result.durationMs}ms.\nHeap: ${hardwareMetrics.usedHeapMb}MB / ${hardwareMetrics.maxHeapMb}MB.`
                    );
                  }}
                >
                  <Text style={styles.btnLargeText}>🛡️ Run Emergency RAM Flush & GC (Peak Guard)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnLarge, { backgroundColor: colors.surfaceContainerHigh || '#E5E5EA' }]}
                  onPress={() => {
                    refreshHardwareMetrics();
                    Alert.alert('Memory Refreshed', 'Hardware memory metrics and event loop timers sampled.');
                  }}
                >
                  <Text style={[styles.btnLargeText, { color: colors.textPrimary }]}>Refresh Hardware Diagnostics</Text>
                </TouchableOpacity>
              </View>

              {/* Peak Events History */}
              {peakHistory && peakHistory.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 }}>
                    RECENT PEAK MITIGATION EVENTS ({peakHistory.length}):
                  </Text>
                  {peakHistory.slice(0, 3).map((item) => (
                    <View key={item.id} style={{ padding: 6, borderRadius: 6, backgroundColor: isDark ? '#1a1a24' : '#f0f0f5', marginBottom: 4 }}>
                      <Text style={{ fontSize: 10, color: colors.textPrimary, fontWeight: '600' }}>
                        ⚡ {item.reason} — {item.durationMs}ms ({item.hooksExecuted} hooks executed)
                      </Text>
                      <Text style={{ fontSize: 9, color: colors.textSecondary }}>
                        {item.timestamp} | Heap: {item.metricsSnapshot?.usedHeapMb}MB
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Chaos & Stress Testing Harness */}
            <View style={[
              styles.sectionCard,
              {
                backgroundColor: colors.bgCard,
                borderColor: colors.borderColor || '#E5E5EA',
                borderWidth: 1,
                marginTop: 14,
              }
            ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0, flex: 1, marginRight: 8 }]}>
                  ⚡ Chaos & Stress Testing Harness
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(98, 70, 234, 0.15)', flexShrink: 0 }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                    FAULT INJECTION
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 }}>
                Simulate production edge cases: high-density task loads, FlashList memory pressure, and corrupted/tampered storage envelopes to test cryptographic self-quarantine and zero-crash resilience.
              </Text>

              {/* Memory / Payload Stats */}
              <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>
                  Current Task Payload: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{payloadMetrics.formattedSize}</Text>
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  Active Chaos Tasks in State: <Text style={{ fontWeight: '700', color: chaosTaskCount > 0 ? '#ffaa00' : '#52c41a' }}>
                    {chaosTaskCount} items
                  </Text>
                </Text>
              </View>

              <View style={{ gap: 8 }}>
                {/* 1. Mass Injection */}
                <TouchableOpacity
                  style={[styles.btnLarge, { backgroundColor: colors.primary }]}
                  onPress={handleInjectStressTasks}
                >
                  <Text style={styles.btnLargeText}>Inject 200 Stress Tasks (Memory Benchmark)</Text>
                </TouchableOpacity>

                {/* 2. Storage Tamper Canary Test */}
                <TouchableOpacity
                  style={[styles.btnLarge, { backgroundColor: '#1890ff' }]}
                  onPress={handleRunStorageTamperTest}
                >
                  <Text style={styles.btnLargeText}>Run Storage Tamper & Integrity Test</Text>
                </TouchableOpacity>

                {/* 3. Purge Chaos Data */}
                {chaosTaskCount > 0 && (
                  <TouchableOpacity
                    style={[styles.btnLarge, { backgroundColor: '#ff4d4f' }]}
                    onPress={handlePurgeChaosTasks}
                  >
                    <Text style={styles.btnLargeText}>Purge All Chaos Test Data ({chaosTaskCount})</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        )}

        {/* ================= TAB 6: LOGS FEED ================= */}
        {activeTab === 'logs' && (
          <View style={{ flex: 1 }}>
            {/* Filter Log Bar */}
            <View style={[styles.logsHeader, { backgroundColor: colors.bgCard, borderBottomColor: colors.borderColor }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {['all', 'info', 'success', 'warning', 'error'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.filterChip, logFilter === t && { backgroundColor: colors.primary }]}
                    onPress={() => setLogFilter(t)}
                  >
                    <Text style={{ color: logFilter === t ? '#fff' : colors.textSecondary, fontSize: 11, fontWeight: 'bold' }}>
                      {t.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.iconBtn} onPress={() => DevLogger.clearLogs()}>
                <IconTrash color="#ff4d4f" />
              </TouchableOpacity>
            </View>

            {/* FlatList for Logs */}
            <FlatList
              data={filteredLogs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 15 }}
              renderItem={({ item }) => {
                let color = colors.textPrimary;
                if (item.type === 'error') color = '#ff4d4f';
                if (item.type === 'success') color = '#52c41a';
                if (item.type === 'warning') color = '#faad14';

                return (
                  <View style={[styles.logItem, { borderBottomColor: colors.borderColor }]}>
                    <Text style={{ color: colors.textSecondary, fontSize: 10 }}>
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </Text>
                    <Text style={{ color, fontWeight: 'bold', marginVertical: 3 }}>{item.message}</Text>
                    {item.details && (
                      <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                        {typeof item.details === 'object' ? JSON.stringify(item.details, null, 2) : String(item.details)}
                      </Text>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 30 }}>
                  No logs recorded. Trigger actions to inspect logs.
                </Text>
              }
            />
          </View>
        )}
      </View>

      {testModalTask && (
        <TaskDetailsModal
          task={testModalTask}
          isVisible={isTestModalVisible}
          onClose={() => setIsTestModalVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  topTabsBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollSection: {
    padding: 16,
    paddingBottom: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },
  statBox: {
    flex: 1,
    minWidth: '28%',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  searchInput: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 13,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  taskDebugCard: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  taskDebugHeader: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expandedSection: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  jsonText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actionBtn: {
    backgroundColor: 'rgba(128,128,128,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  btnLarge: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnLargeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  btnSmall: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSmallText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
    textAlign: 'center',
  },
  cardDump: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
  infoKey: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoVal: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  iconBtn: {
    padding: 6,
    marginLeft: 8,
  },
  logItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
});
