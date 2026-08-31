import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Clipboard } from 'react-native';
import Modal from 'react-native-modal';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme } from '../styles/ThemeContext';
import dayjs from 'dayjs';
import { isTaskMissed } from '../utils/filters';
import { processAutoManageTasks } from '../features/taskSlice';
import { useTranslation } from 'react-i18next';

export default function OverdueDebugModal({ isVisible, onClose }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const tasks = useSelector(state => state.taskReducer.tasks || []);
  const themeState = useSelector(state => state.themeReducer || {});
  const userState = useSelector(state => state.userReducer || {});
  const boards = userState.boards || [{ id: 'main', name: 'Main' }];
  const boardAutomations = themeState.boardAutomations || {};

  const [logOutput, setLogOutput] = useState('');
  const [scrollOffset, setScrollOffset] = useState(0);

  const globalSettings = useMemo(() => ({
    autoTransferMode: themeState.autoTransferMode || 'none',
    increasePriorityWhenOverdue: themeState.increasePriorityWhenOverdue || false,
    priorityFrequency: themeState.priorityFrequency || 'never',
    removePriorityWhenCompleted: themeState.removePriorityWhenCompleted || false,
    autoDeleteOverdueDays: themeState.autoDeleteOverdueDays !== undefined ? themeState.autoDeleteOverdueDays : 0,
    autoDeleteCompletedDays: themeState.autoDeleteCompletedDays !== undefined ? themeState.autoDeleteCompletedDays : 0,
    autoRescheduleTime: themeState.autoRescheduleTime || '09:00'
  }), [themeState]);

  const actualToday = dayjs().startOf('day');

  const debugTaskAnalysis = useMemo(() => {
    return tasks.map(task => {
      const taskBoardId = task.boardId || 'main';
      const boardObj = boards.find(b => b.id === taskBoardId);
      const boardName = boardObj ? boardObj.name : taskBoardId;
      const boardCustom = boardAutomations[taskBoardId];
      const isOverride = !!(boardCustom && boardCustom.overrideGlobal === true);

      const effectiveAutoTransferMode = (isOverride && boardCustom?.autoTransferMode !== undefined)
        ? boardCustom.autoTransferMode
        : globalSettings.autoTransferMode;

      const effectiveAutoRescheduleTime = (isOverride && boardCustom?.autoRescheduleTime !== undefined)
        ? boardCustom.autoRescheduleTime
        : globalSettings.autoRescheduleTime;

      const taskDate = task.completionDate ? dayjs(task.completionDate).startOf('day') : null;
      const isOverdue = (!task.completed && taskDate) ? taskDate.isBefore(actualToday) : false;
      const daysOverdue = (taskDate && isOverdue) ? actualToday.diff(taskDate, 'day') : 0;
      const missed = isTaskMissed(task);

      let calculatedTargetDate = null;
      if (!task.completed && isOverdue && effectiveAutoTransferMode && effectiveAutoTransferMode !== 'none') {
        let target = actualToday;
        if (effectiveAutoTransferMode === 'tomorrow') {
          target = target.add(1, 'day');
        } else if (effectiveAutoTransferMode === 'next_workday') {
          while (target.day() === 0 || target.day() === 6) {
            target = target.add(1, 'day');
          }
        }
        calculatedTargetDate = target.format('YYYY-MM-DD (ddd)');
      }

      return {
        id: task.id,
        name: task.taskname,
        completed: task.completed,
        boardId: taskBoardId,
        boardName,
        completionDate: task.completionDate ? dayjs(task.completionDate).format('YYYY-MM-DD') : 'No Date',
        time: task.time || 'None',
        priority: task.priority || 'none',
        isOverdue,
        daysOverdue,
        isMissed: missed,
        isOverride,
        effectiveAutoTransferMode,
        effectiveAutoRescheduleTime,
        calculatedTargetDate
      };
    });
  }, [tasks, boards, boardAutomations, globalSettings, actualToday]);

  const overdueAndMissedTasks = useMemo(() => {
    return debugTaskAnalysis.filter(t => t.isOverdue || t.isMissed);
  }, [debugTaskAnalysis]);

  const handleRunAutoManage = async () => {
    try {
      await dispatch(processAutoManageTasks());
      setLogOutput(`[${dayjs().format('HH:mm:ss')}] Force run auto-manage executed successfully.`);
    } catch (e) {
      setLogOutput(`[${dayjs().format('HH:mm:ss')}] Error: ${e.message}`);
    }
  };

  const handleCopyDiagnostics = () => {
    const diagnosticPayload = {
      systemTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      globalSettings,
      boardAutomations,
      overdueTaskCount: overdueAndMissedTasks.length,
      tasks: overdueAndMissedTasks
    };
    const jsonStr = JSON.stringify(diagnosticPayload, null, 2);
    if (Clipboard && Clipboard.setString) {
      Clipboard.setString(jsonStr);
    }
    Share.share({ message: jsonStr });
    setLogOutput(`[${dayjs().format('HH:mm:ss')}] Diagnostics copied & shared.`);
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      style={styles.modal}
    >
      <View style={[styles.container, { backgroundColor: colors.bgCard || '#1e1e1e' }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderColor || '#333' }]}>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary || '#fff' }]}>
              🐛 Overdue & Automation Debugger
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary || '#aaa', marginTop: 2 }}>
              System Time: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={{ fontSize: 18, color: colors.textSecondary || '#aaa', fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Global Config Card */}
          <View style={[styles.card, { backgroundColor: colors.surfaceContainer || '#2a2a2a' }]}>
            <Text style={[styles.cardTitle, { color: colors.primary || '#4caf50' }]}>
              🌐 Global Auto-Manage Configuration
            </Text>
            <View style={styles.gridRow}>
              <Text style={styles.label}>Transfer Mode:</Text>
              <Text style={styles.val}>{globalSettings.autoTransferMode}</Text>
            </View>
            <View style={styles.gridRow}>
              <Text style={styles.label}>Reschedule Cutoff Time:</Text>
              <Text style={styles.val}>{globalSettings.autoRescheduleTime}</Text>
            </View>
            <View style={styles.gridRow}>
              <Text style={styles.label}>Increase Priority Overdue:</Text>
              <Text style={styles.val}>{globalSettings.increasePriorityWhenOverdue ? `ON (${globalSettings.priorityFrequency})` : 'OFF'}</Text>
            </View>
          </View>

          {/* Action Toolbar */}
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={handleRunAutoManage} style={[styles.actionBtn, { backgroundColor: colors.primary || '#4caf50' }]}>
              <Text style={styles.actionBtnText}>⚡ Force Run Auto-Manage</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCopyDiagnostics} style={[styles.actionBtn, { backgroundColor: '#2196f3' }]}>
              <Text style={styles.actionBtnText}>📋 Copy Diagnostics</Text>
            </TouchableOpacity>
          </View>

          {logOutput ? (
            <View style={styles.logBox}>
              <Text style={{ color: '#4caf50', fontSize: 12, fontFamily: 'monospace' }}>{logOutput}</Text>
            </View>
          ) : null}

          {/* Overdue Tasks Section */}
          <Text style={[styles.sectionHeader, { color: colors.textPrimary || '#fff' }]}>
            Overdue / Missed Tasks ({overdueAndMissedTasks.length})
          </Text>

          {overdueAndMissedTasks.length === 0 ? (
            <View style={[styles.card, { alignItems: 'center', padding: 20 }]}>
              <Text style={{ color: '#4caf50', fontWeight: 'bold' }}>🎉 No Overdue or Missed Tasks Found!</Text>
            </View>
          ) : (
            overdueAndMissedTasks.map(t => (
              <View key={t.id} style={[styles.taskCard, { backgroundColor: colors.surfaceContainer || '#2a2a2a', borderColor: t.isOverdue ? '#ff5252' : '#ff9800' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.taskName, { color: colors.textPrimary || '#fff' }]} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: t.isOverdue ? 'rgba(255, 82, 82, 0.2)' : 'rgba(255, 152, 0, 0.2)' }]}>
                    <Text style={{ color: t.isOverdue ? '#ff5252' : '#ff9800', fontSize: 11, fontWeight: 'bold' }}>
                      {t.isOverdue ? `${t.daysOverdue}d Overdue` : 'Missed'}
                    </Text>
                  </View>
                </View>

                <View style={styles.taskMetaRow}>
                  <Text style={styles.metaText}>Board: <Text style={{ fontWeight: 'bold' }}>{t.boardName}</Text></Text>
                  <Text style={styles.metaText}>Due: <Text style={{ fontWeight: 'bold' }}>{t.completionDate}</Text> ({t.time})</Text>
                </View>

                <View style={styles.taskMetaRow}>
                  <Text style={styles.metaText}>Rule Source: <Text style={{ color: t.isOverride ? '#ff9800' : '#4caf50', fontWeight: 'bold' }}>{t.isOverride ? 'Board Override' : 'Global'}</Text></Text>
                  <Text style={styles.metaText}>Transfer Mode: <Text style={{ fontWeight: 'bold' }}>{t.effectiveAutoTransferMode}</Text></Text>
                </View>

                {t.calculatedTargetDate ? (
                  <View style={styles.targetBanner}>
                    <Text style={{ color: '#4caf50', fontSize: 12, fontWeight: 'bold' }}>
                      ➜ Will Move To: {t.calculatedTargetDate}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.targetBanner, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                    <Text style={{ color: '#aaa', fontSize: 12 }}>
                      ➜ No Transfer Rule Applied (Mode: {t.effectiveAutoTransferMode})
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 15,
    justifyContent: 'center',
  },
  container: {
    borderRadius: 16,
    maxHeight: '85%',
    padding: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 5,
  },
  body: {
    flexGrow: 0,
  },
  card: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: '#aaa',
  },
  val: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  logBox: {
    backgroundColor: '#111',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 5,
  },
  taskCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  taskName: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  taskMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#aaa',
  },
  targetBanner: {
    marginTop: 8,
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  }
});
