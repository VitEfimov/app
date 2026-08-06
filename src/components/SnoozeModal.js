import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { updateTask } from '../features/taskSlice';
import dayjs from 'dayjs';

export default function SnoozeModal({ 
  isVisible, 
  onClose, 
  task, 
  colors,
  onOpenPremiumModal
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isPremium = useSelector(state => state.entitlementReducer?.isPremium);

  const [activeTab, setActiveTab] = useState('date'); // 'date' or 'reminder'

  if (!task) return null;

  const handleSnoozeDate = (mode) => {
    let targetDate = dayjs();
    let targetTime = task.time; // preserve time if possible

    switch (mode) {
      case 'later_today':
        targetDate = targetDate.add(4, 'hour');
        targetTime = targetDate.format('HH:mm');
        break;
      case 'tomorrow':
        targetDate = targetDate.add(1, 'day');
        targetTime = '09:00';
        break;
      case 'next_workday':
        targetDate = targetDate.add(1, 'day');
        while (targetDate.day() === 0 || targetDate.day() === 6) {
          targetDate = targetDate.add(1, 'day');
        }
        targetTime = '09:00';
        break;
      case 'weekend':
        // Next Saturday
        while (targetDate.day() !== 6) {
          targetDate = targetDate.add(1, 'day');
        }
        targetTime = '10:00';
        break;
    }

    dispatch(updateTask({
      taskId: task.id,
      completionDate: targetDate.toISOString(),
      time: targetTime
    }));
    onClose();
  };

  const handleSnoozeReminder = (mode) => {
    let newReminderStr = 'None';
    switch (mode) {
      case '10m':
        newReminderStr = '10 min before'; // Or any custom logic we want to parse
        break;
      case '30m':
        newReminderStr = '30 min before';
        break;
      case '1h':
        newReminderStr = '1 hr before';
        break;
      case 'tomorrow':
        newReminderStr = '1 day before';
        break;
    }

    dispatch(updateTask({
      taskId: task.id,
      reminder: newReminderStr
    }));
    onClose();
  };

  const handlePremiumAction = (action) => {
    if (!isPremium) {
      onClose();
      onOpenPremiumModal(t('Advanced Snoozing'));
      return;
    }

    if (action === 'nag') {
      dispatch(updateTask({
        taskId: task.id,
        isNagMode: !task.isNagMode
      }));
    } else if (action === 'escalating') {
      dispatch(updateTask({
        taskId: task.id,
        escalationLevel: 'active'
      }));
    }
    onClose();
  };

  const dateOptions = [
    { label: t('Later today (+4 hrs)'), mode: 'later_today', icon: '🌅' },
    { label: t('Tomorrow morning'), mode: 'tomorrow', icon: '☕' },
    { label: t('Next workday'), mode: 'next_workday', icon: '💼' },
    { label: t('This weekend'), mode: 'weekend', icon: '🏖️' }
  ];

  const reminderOptions = [
    { label: t('+10 minutes'), mode: '10m', icon: '⏳' },
    { label: t('+30 minutes'), mode: '30m', icon: '⏱️' },
    { label: t('+1 hour'), mode: '1h', icon: '⌚' },
    { label: t('Tomorrow'), mode: 'tomorrow', icon: '📅' }
  ];

  return (
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      propagateSwipe={true}
      onBackdropPress={onClose}
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
        <View style={styles.dragHandle} />
        
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Snooze')}</Text>
          <Text style={[styles.taskTitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {task.taskname}
          </Text>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'date' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('date')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'date' ? colors.primary : colors.textSecondary }]}>
              {t('Reschedule Date')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'reminder' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('reminder')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'reminder' ? colors.primary : colors.textSecondary }]}>
              {t('Adjust Reminder')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.optionsList}>
          {activeTab === 'date' && dateOptions.map((opt, i) => (
            <TouchableOpacity key={i} style={[styles.optionRow, { borderBottomColor: colors.borderColor }]} onPress={() => handleSnoozeDate(opt.mode)}>
              <Text style={styles.optionIcon}>{opt.icon}</Text>
              <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}

          {activeTab === 'reminder' && reminderOptions.map((opt, i) => (
            <TouchableOpacity key={i} style={[styles.optionRow, { borderBottomColor: colors.borderColor }]} onPress={() => handleSnoozeReminder(opt.mode)}>
              <Text style={styles.optionIcon}>{opt.icon}</Text>
              <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}

          {/* Premium Section */}
          <View style={styles.premiumSection}>
            <Text style={[styles.premiumHeader, { color: '#FFD700' }]}>★ {t('PRO FEATURES')}</Text>
            <TouchableOpacity style={[styles.optionRow, { borderBottomColor: colors.borderColor }]} onPress={() => handlePremiumAction('nag')}>
              <Text style={styles.optionIcon}>🔔</Text>
              <Text style={[styles.optionLabel, { color: colors.textPrimary, flex: 1 }]}>{t('Nag Mode (Every 10 min)')}</Text>
              {task.isNagMode && <Text style={{color: '#4caf50', fontWeight:'bold'}}>ON</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionRow, { borderBottomColor: colors.borderColor }]} onPress={() => handlePremiumAction('escalating')}>
              <Text style={styles.optionIcon}>📈</Text>
              <Text style={[styles.optionLabel, { color: colors.textPrimary, flex: 1 }]}>{t('Escalating Reminder')}</Text>
              {task.escalationLevel === 'active' && <Text style={{color: '#4caf50', fontWeight:'bold'}}>ON</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 15,
    paddingBottom: 30,
    paddingHorizontal: 20,
    maxHeight: '80%'
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#888',
    borderRadius: 3,
    marginBottom: 20,
    alignSelf: 'center'
  },
  header: {
    marginBottom: 15,
    alignItems: 'center'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5
  },
  taskTitle: {
    fontSize: 14
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)'
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center'
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold'
  },
  optionsList: {
    width: '100%'
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  optionIcon: {
    fontSize: 22,
    marginRight: 15,
    width: 30,
    textAlign: 'center'
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500'
  },
  premiumSection: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)'
  },
  premiumHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
    marginLeft: 5
  }
});
