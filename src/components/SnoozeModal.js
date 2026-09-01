import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { updateTask } from '../features/taskSlice';
import dayjs from 'dayjs';
import Svg, { Path, Circle, Polyline, Rect } from 'react-native-svg';

const IconSun = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="5" />
    <Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </Svg>
);

const IconCoffee = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <Path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    <Path d="M6 1v3M10 1v3M14 1v3" />
  </Svg>
);

const IconBriefcase = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </Svg>
);

const IconUmbrella = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 12a10.06 10.06 0 0 0-20 0Z" />
    <Path d="M12 12v8a2 2 0 0 0 4 0" />
    <Path d="M12 2v1" />
  </Svg>
);

const IconHourglass = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 22h14" />
    <Path d="M5 2h14" />
    <Path d="M17 22v-4a5 5 0 0 0-3-4.5V11" />
    <Path d="M7 22v-4a5 5 0 0 1 3-4.5V11" />
    <Path d="M7 2v4a5 5 0 0 0 3 4.5v2.5" />
    <Path d="M17 2v4a5 5 0 0 1-3 4.5v2.5" />
  </Svg>
);

const IconStopwatch = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="13" r="8" />
    <Polyline points="12 9 12 13 14 15" />
    <Path d="M12 2v2M4 4l2 2" />
  </Svg>
);

const IconWatch = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="7" />
    <Polyline points="12 9 12 12 13.5 13.5" />
    <Path d="M16.41 7l-2-5H9.59l-2 5M7.59 17l2 5h4.82l2-5" />
  </Svg>
);

const IconCalendar = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);

const IconBell = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Svg>
);

const IconTrendingUp = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <Polyline points="17 6 23 6 23 12" />
  </Svg>
);

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
  const autoRescheduleTime = useSelector(state => state.themeReducer.autoRescheduleTime || '09:00');

  const [activeTab, setActiveTab] = useState('date'); // 'date' or 'reminder'

  if (!task) return null;

  const handleSnoozeDate = (mode) => {
    let targetDate = dayjs();
    let targetTime = task.time; // preserve time if possible

    switch (mode) {
      case 'later_today':
        targetDate = targetDate.add(3, 'hour');
        targetTime = targetDate.format('HH:mm');
        break;
      case 'tomorrow':
        targetDate = targetDate.add(1, 'day');
        targetTime = autoRescheduleTime;
        break;
      case 'next_workday':
        targetDate = targetDate.add(1, 'day');
        while (targetDate.day() === 0 || targetDate.day() === 6) {
          targetDate = targetDate.add(1, 'day');
        }
        targetTime = autoRescheduleTime;
        break;
      case 'weekend':
        // Next Saturday (advance at least 1 day so if today is Saturday, it finds next Saturday)
        targetDate = targetDate.add(1, 'day');
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
    { label: t('Later today (+3 hrs)'), mode: 'later_today', icon: IconSun },
    { label: t('Tomorrow morning'), mode: 'tomorrow', icon: IconCoffee },
    { label: t('Next workday'), mode: 'next_workday', icon: IconBriefcase },
    { label: t('This weekend'), mode: 'weekend', icon: IconUmbrella }
  ];

  const reminderOptions = [
    { label: t('+10 minutes'), mode: '10m', icon: IconHourglass },
    { label: t('+30 minutes'), mode: '30m', icon: IconStopwatch },
    { label: t('+1 hour'), mode: '1h', icon: IconWatch },
    { label: t('Tomorrow'), mode: 'tomorrow', icon: IconCalendar }
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
              <View style={styles.actionIconContainer}>
                <opt.icon color={colors.textPrimary} />
              </View>
              <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}

          {activeTab === 'reminder' && reminderOptions.map((opt, i) => (
            <TouchableOpacity key={i} style={[styles.optionRow, { borderBottomColor: colors.borderColor }]} onPress={() => handleSnoozeReminder(opt.mode)}>
              <View style={styles.actionIconContainer}>
                <opt.icon color={colors.textPrimary} />
              </View>
              <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}

          {/* Premium Section */}
          {isPremium ? (
            <View style={styles.premiumSection}>
              <TouchableOpacity style={[styles.optionRow, { borderBottomColor: colors.borderColor }]} onPress={() => handlePremiumAction('nag')}>
                <View style={styles.actionIconContainer}>
                  <IconBell color={colors.textPrimary} />
                </View>
                <Text style={[styles.optionLabel, { color: colors.textPrimary, flex: 1 }]}>{t('Nag Mode (Every 10 min)')}</Text>
                {task.isNagMode && <Text style={{color: '#4caf50', fontWeight:'bold'}}>ON</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.optionRow, { borderBottomColor: colors.borderColor }]} onPress={() => handlePremiumAction('escalating')}>
                <View style={styles.actionIconContainer}>
                  <IconTrendingUp color={colors.textPrimary} />
                </View>
                <Text style={[styles.optionLabel, { color: colors.textPrimary, flex: 1 }]}>{t('Escalating Reminder')}</Text>
                {task.escalationLevel === 'active' && <Text style={{color: '#4caf50', fontWeight:'bold'}}>ON</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.proUpsellRow} 
              onPress={() => onOpenPremiumModal(t('Advanced Snoozing'))}
            >
              <Text style={[styles.proUpsellText, { color: colors.primary }]}>✦ {t('More options with Pro')} →</Text>
            </TouchableOpacity>
          )}
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
  actionIconContainer: {
    marginRight: 15,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500'
  },
  premiumSection: {
    marginTop: 10,
  },
  proUpsellRow: {
    marginTop: 10,
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 12,
  },
  proUpsellText: {
    fontSize: 15,
    fontWeight: 'bold',
  }
});
