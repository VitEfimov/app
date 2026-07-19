import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Modal from 'react-native-modal';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../styles/ThemeContext';
import { setAutoManageSettings } from '../features/themeSlice';
import { processAutoManageTasks } from '../features/taskSlice';
import { updateRecurringAutomations } from '../utils/notifications';

export default function AutoManageSettings({ isVisible, onClose }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const themeState = useSelector(state => state.themeReducer);

  const scrollViewRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);

  const defaultSettings = {
    autoTransferMode: 'none',
    increasePriorityWhenOverdue: false,
    increasePriorityDailyOverdue: false,
    removePriorityWhenCompleted: false,
    autoDeleteOverdueDays: 0,
    autoDeleteCompletedDays: 0,
    confirmBeforeDeletion: true,
    dailySummaryOverdue: false,
    morningReminderToday: false,
    eveningReminderUnfinished: false
  };

  const [localSettings, setLocalSettings] = useState(defaultSettings);

  useEffect(() => {
    if (isVisible) {
      setLocalSettings(themeState || defaultSettings);
    }
  }, [isVisible, themeState]);

  const handleUpdate = (updates) => {
    setLocalSettings(prev => ({ ...prev, ...updates }));
  };

  const handleSave = () => {
    dispatch(setAutoManageSettings(localSettings));
    updateRecurringAutomations(localSettings);
    dispatch(processAutoManageTasks());
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(defaultSettings);
  };

  const {
    autoTransferMode = 'none',
    increasePriorityWhenOverdue = false,
    increasePriorityDailyOverdue = false,
    removePriorityWhenCompleted = false,
    autoDeleteOverdueDays = 0,
    autoDeleteCompletedDays = 0,
    confirmBeforeDeletion = true,
    dailySummaryOverdue = false,
    morningReminderToday = false,
    eveningReminderUnfinished = false
  } = localSettings;

  const SettingToggle = ({ label, value, onValueChange }) => (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Switch 
        value={value} 
        onValueChange={onValueChange} 
        trackColor={{ true: colors.primary, false: colors.borderColor }}
        thumbColor="#ffffff"
      />
    </View>
  );

  return (
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      swipeDirection={scrollOffset > 0 ? undefined : ['down']}
      propagateSwipe={true}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      scrollTo={(p) => scrollViewRef.current?.scrollTo(p)}
      scrollOffset={scrollOffset}
      scrollOffsetMax={Math.max(0, scrollContentHeight - scrollViewHeight)}
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
        <View style={styles.dragHandleContainer}>
          <View style={[styles.dragHandle, { backgroundColor: colors.textSecondary }]} />
        </View>
        
        <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Auto-Manage Tasks')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeText, { color: colors.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          ref={scrollViewRef}
          onScroll={(e) => setScrollOffset(e.nativeEvent.contentOffset.y)}
          onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, h) => setScrollContentHeight(h)}
          scrollEventThrottle={16}
          style={styles.scrollArea}
        >
          <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>{t('Task Scheduling')}</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surfaceContainer }]}>
            <SettingToggle 
              label={t('Move missed tasks to Today')} 
              value={autoTransferMode === 'today'} 
              onValueChange={(val) => handleUpdate({ autoTransferMode: val ? 'today' : 'none' })} 
            />
            <SettingToggle 
              label={t('Move missed tasks to Tomorrow')} 
              value={autoTransferMode === 'tomorrow'} 
              onValueChange={(val) => handleUpdate({ autoTransferMode: val ? 'tomorrow' : 'none' })} 
            />
            <SettingToggle 
              label={t('Move missed to next Workday')} 
              value={autoTransferMode === 'next_workday'} 
              onValueChange={(val) => handleUpdate({ autoTransferMode: val ? 'next_workday' : 'none' })} 
            />
          </View>
          
          <Text style={[styles.groupHeader, { color: colors.textSecondary, marginTop: 15 }]}>{t('Priority Automation')}</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surfaceContainer }]}>
            <SettingToggle 
              label={t('Increase priority when overdue')} 
              value={increasePriorityWhenOverdue} 
              onValueChange={(val) => handleUpdate({ increasePriorityWhenOverdue: val })} 
            />
            <SettingToggle 
              label={t('Increase priority daily if overdue')} 
              value={increasePriorityDailyOverdue} 
              onValueChange={(val) => handleUpdate({ increasePriorityDailyOverdue: val })} 
            />
            <SettingToggle 
              label={t('Remove priority when completed')} 
              value={removePriorityWhenCompleted} 
              onValueChange={(val) => handleUpdate({ removePriorityWhenCompleted: val })} 
            />
          </View>

          <Text style={[styles.groupHeader, { color: colors.textSecondary, marginTop: 15 }]}>{t('Cleanup Automation')}</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surfaceContainer }]}>
            <SettingToggle 
              label={t('Delete 3-day overdue tasks')} 
              value={autoDeleteOverdueDays === 3} 
              onValueChange={(val) => handleUpdate({ autoDeleteOverdueDays: val ? 3 : 0 })} 
            />
            <SettingToggle 
              label={t('Delete 7-day completed tasks')} 
              value={autoDeleteCompletedDays === 7} 
              onValueChange={(val) => handleUpdate({ autoDeleteCompletedDays: val ? 7 : 0 })} 
            />
            <SettingToggle 
              label={t('Confirm before automatic deletion')} 
              value={confirmBeforeDeletion} 
              onValueChange={(val) => handleUpdate({ confirmBeforeDeletion: val })} 
            />
          </View>

          <Text style={[styles.groupHeader, { color: colors.textSecondary, marginTop: 15 }]}>{t('Recurring Reminders')}</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surfaceContainer }]}>
            <SettingToggle 
              label={t('Daily summary of overdue tasks (9 AM)')} 
              value={dailySummaryOverdue} 
              onValueChange={(val) => handleUpdate({ dailySummaryOverdue: val })} 
            />
            <SettingToggle 
              label={t("Morning reminder of today's tasks (8 AM)")} 
              value={morningReminderToday} 
              onValueChange={(val) => handleUpdate({ morningReminderToday: val })} 
            />
            <SettingToggle 
              label={t("Evening reminder of unfinished tasks (8 PM)")} 
              value={eveningReminderUnfinished} 
              onValueChange={(val) => handleUpdate({ eveningReminderUnfinished: val })} 
            />
          </View>
          <View style={{ height: 30 }} />
          
          <View style={[styles.footer, { borderTopColor: colors.borderColor }]}>
            <TouchableOpacity onPress={handleReset} style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderColor }]}>
              <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{t('Reset')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.textInverse, fontWeight: 'bold' }}>{t('Save')}</Text>
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
    maxHeight: '90%',
    paddingTop: 10,
  },
  dragHandleContainer: {
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#666',
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 5,
  },
  closeText: {
    fontSize: 20,
  },
  scrollArea: {
    padding: 20,
  },
  groupHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsGroup: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 5,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  toggleLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 15,
    paddingBottom: 25,
    borderTopWidth: 1,
    gap: 15,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
