import React, { useEffect, useState, useMemo } from 'react';
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
import { DevLogger } from '../utils/logger';
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
import { updateTask, processAutoManageTasks } from '../features/taskSlice';
import * as Notifications from 'expo-notifications';
import dayjs from 'dayjs';
import getFilters, { isTaskToday, isTaskMissed, getTaskDateStr, isTaskUpcoming } from '../utils/filters';
import Svg, { Path } from 'react-native-svg';

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

export default function DevLogsScreen() {
  const { colors, isDark } = useTheme();
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

  useEffect(() => {
    const unsubscribe = DevLogger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    checkPermissions();
  }, []);

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
    DevLogger.info('Triggering 3-second Full-Screen Alarm Test');
    const fireTime = dayjs().add(3, 'second');
    await scheduleExactTaskReminder(
      'Full Screen Alarm Test',
      fireTime.toDate(),
      'test_alarm_123',
      true,
      'task_alarm',
      themeState
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

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    return logs.filter((l) => l.type === logFilter);
  }, [logs, logFilter]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      {/* Top Section Nav Tabs */}
      <View style={[styles.topTabsBar, { backgroundColor: colors.bgCard, borderBottomColor: colors.borderColor }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 6 }}>
          {[
            { id: 'tasks', label: 'Tasks & State' },
            { id: 'notifications', label: 'Notifications' },
            { id: 'reschedule', label: 'Reschedule Engine' },
            { id: 'bottlenecks', label: 'Bottlenecks' },
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
              filteredTasks.map((t) => {
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
              })
            )}
          </ScrollView>
        )}

        {/* ================= TAB 2: NOTIFICATIONS & ALARMS ================= */}
        {activeTab === 'notifications' && (
          <ScrollView contentContainerStyle={styles.scrollSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notification Diagnostics</Text>

            {/* Test Action Buttons */}
            <View style={{ gap: 10, marginBottom: 20 }}>
              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: colors.primary }]}
                onPress={handleTestStandardNotif}
              >
                <Text style={styles.btnLargeText}>Test Standard Notification (in 3s)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: '#ff4d4f' }]}
                onPress={handleTestFullAlarm}
              >
                <Text style={styles.btnLargeText}>Test Full-Screen Alarm (in 3s)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: '#faad14' }]}
                onPress={handleTestNagSimulation}
              >
                <Text style={[styles.btnLargeText, { color: '#000' }]}>
                  Test Nag Mode Simulation (3 Notifs)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: '#722ed1' }]}
                onPress={handleTestEscalationSimulation}
              >
                <Text style={styles.btnLargeText}>Test Escalating Reminders Simulation</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnLarge, { backgroundColor: '#13c2c2' }]}
                onPress={handleTestAutomationMorning}
              >
                <Text style={styles.btnLargeText}>Test Morning Summary Notification</Text>
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
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>System Scheduler State</Text>

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

        {/* ================= TAB 5: LOGS FEED ================= */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
