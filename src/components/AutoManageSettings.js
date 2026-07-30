import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Modal from 'react-native-modal';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../styles/ThemeContext';
import { setAutoManageSettings } from '../features/themeSlice';
import { processAutoManageTasks } from '../features/taskSlice';
import { updateRecurringAutomations } from '../utils/notifications';
import CustomDropdown from './CustomDropdown';

export default function AutoManageSettings({ isVisible, onClose }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const themeState = useSelector(state => state.themeReducer);
  const tasks = useSelector(state => state.taskReducer.tasks);

  const scrollViewRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);

  const defaultSettings = {
    autoTransferMode: 'none',
    increasePriorityWhenOverdue: false,
    priorityFrequency: 'never',
    removePriorityWhenCompleted: false,
    autoDeleteOverdueDays: 0,
    autoDeleteCompletedDays: 0,
    confirmBeforeDeletion: true,
    morningReminder: false,
    morningReminderTime: '08:00',
    eveningReminder: false,
    eveningReminderTime: '20:00',
    summaryReminder: false,
    summaryReminderTime: '09:00'
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
    updateRecurringAutomations(localSettings, tasks);
    dispatch(processAutoManageTasks());
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(defaultSettings);
  };

  const {
    autoTransferMode = 'none',
    increasePriorityWhenOverdue = false,
    priorityFrequency = 'never',
    removePriorityWhenCompleted = false,
    autoDeleteOverdueDays = 0,
    autoDeleteCompletedDays = 0,
    confirmBeforeDeletion = true,
    morningReminder = false,
    morningReminderTime = '08:00',
    eveningReminder = false,
    eveningReminderTime = '20:00',
    summaryReminder = false,
    summaryReminderTime = '09:00'
  } = localSettings;

  const SettingToggle = ({ label, value, onValueChange }) => (
    <View style={styles.toggleRow} accessible={true} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label}>
      <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Switch 
        value={value} 
        onValueChange={onValueChange} 
        trackColor={{ true: colors.primary, false: colors.borderColor }}
        thumbColor="#ffffff"
        importantForAccessibility="no"
      />
    </View>
  );

  const RadioButton = ({ label, selected, onPress }) => (
    <TouchableOpacity style={styles.radioRow} onPress={onPress} accessible={true} accessibilityRole="radio" accessibilityState={{ selected: selected }} accessibilityLabel={label}>
      <View style={[styles.radioCircle, { borderColor: selected ? colors.primary : colors.textSecondary }]}>
        {selected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
      </View>
      <Text style={[styles.radioLabel, { color: colors.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );

  const timeOptions = [
    { label: '07:00', value: '07:00' },
    { label: '08:00', value: '08:00' },
    { label: '09:00', value: '09:00' },
    { label: '10:00', value: '10:00' },
    { label: '18:00', value: '18:00' },
    { label: '19:00', value: '19:00' },
    { label: '20:00', value: '20:00' },
    { label: '21:00', value: '21:00' }
  ];

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
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessible={true} accessibilityRole="button" accessibilityLabel="Close auto manage settings">
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
          <View style={[styles.settingsGroup, { backgroundColor: colors.surfaceContainer, padding: 10 }]}>
            <Text style={[styles.subText, { color: colors.textSecondary, marginBottom: 2, fontWeight: 'bold' }]}>{t('When overdue')}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10 }}>{t('Automatically move uncompleted tasks to a new date when their due date passes.')}</Text>
            <RadioButton label={t('Today')} selected={autoTransferMode === 'today'} onPress={() => handleUpdate({ autoTransferMode: 'today' })} />
            <RadioButton label={t('Tomorrow')} selected={autoTransferMode === 'tomorrow'} onPress={() => handleUpdate({ autoTransferMode: 'tomorrow' })} />
            <RadioButton label={t('Next Workday')} selected={autoTransferMode === 'next_workday'} onPress={() => handleUpdate({ autoTransferMode: 'next_workday' })} />
            <RadioButton label={t('Never')} selected={autoTransferMode === 'none'} onPress={() => handleUpdate({ autoTransferMode: 'none' })} />
          </View>
          
          <Text style={[styles.groupHeader, { color: colors.textSecondary, marginTop: 15 }]}>{t('Priority Automation')}</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surfaceContainer }]}>
            <SettingToggle 
              label={t('Increase when overdue')} 
              value={increasePriorityWhenOverdue} 
              onValueChange={(val) => handleUpdate({ increasePriorityWhenOverdue: val })} 
            />
            {increasePriorityWhenOverdue && (
              <View style={{ paddingHorizontal: 15, paddingBottom: 15 }}>
                <CustomDropdown
                  label={t('Frequency')}
                  value={priorityFrequency}
                  options={[
                    { label: t('Daily'), value: 'daily' },
                    { label: t('Weekly'), value: 'weekly' },
                    { label: t('Never'), value: 'never' },
                  ]}
                  onSelect={(val) => handleUpdate({ priorityFrequency: val })}
                  colors={colors}
                  layout="horizontal"
                />
              </View>
            )}
            <SettingToggle 
              label={t('Remove priority when completed')} 
              value={removePriorityWhenCompleted} 
              onValueChange={(val) => handleUpdate({ removePriorityWhenCompleted: val })} 
            />
          </View>

          <Text style={[styles.groupHeader, { color: colors.textSecondary, marginTop: 15 }]}>{t('Cleanup Automation')}</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surfaceContainer, padding: 15 }]}>
            <CustomDropdown
              label={t('Delete overdue after')}
              value={autoDeleteOverdueDays}
              options={[
                { label: t('Never'), value: 0 },
                { label: t('3 days'), value: 3 },
                { label: t('7 days'), value: 7 },
                { label: t('30 days'), value: 30 },
              ]}
              onSelect={(val) => handleUpdate({ autoDeleteOverdueDays: val })}
              colors={colors}
              layout="horizontal"
            />
            <View style={{ height: 10 }} />
            <CustomDropdown
              label={t('Delete completed after')}
              value={autoDeleteCompletedDays}
              options={[
                { label: t('Never'), value: 0 },
                { label: t('1 day'), value: 1 },
                { label: t('3 days'), value: 3 },
                { label: t('7 days'), value: 7 },
                { label: t('30 days'), value: 30 },
              ]}
              onSelect={(val) => handleUpdate({ autoDeleteCompletedDays: val })}
              colors={colors}
              layout="horizontal"
            />
            <SettingToggle 
              label={t('Confirm before automatic deletion')} 
              value={confirmBeforeDeletion} 
              onValueChange={(val) => handleUpdate({ confirmBeforeDeletion: val })} 
            />
          </View>

          <Text style={[styles.groupHeader, { color: colors.textSecondary, marginTop: 15 }]}>{t('Recurring Reminders')}</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surfaceContainer }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 5, lineHeight: 18 }}>
              {t('• Morning: Lists tasks due today.')}
              {'\n'}{t('• Evening: Reminds you of tasks due today that are still unfinished.')}
              {'\n'}{t('• Summary: Alerts you about overdue tasks.')}
            </Text>
            
            <SettingToggle 
              label={t("Morning reminder")} 
              value={morningReminder} 
              onValueChange={(val) => handleUpdate({ morningReminder: val })} 
            />
            {morningReminder && (
              <View style={{ paddingHorizontal: 15, paddingBottom: 10 }}>
                <CustomDropdown
                  value={morningReminderTime}
                  options={timeOptions}
                  onSelect={(val) => handleUpdate({ morningReminderTime: val })}
                  colors={colors}
                  layout="horizontal"
                  customBtnStyle={{ paddingVertical: 5 }}
                />
              </View>
            )}

            <SettingToggle 
              label={t("Evening reminder")} 
              value={eveningReminder} 
              onValueChange={(val) => handleUpdate({ eveningReminder: val })} 
            />
            {eveningReminder && (
              <View style={{ paddingHorizontal: 15, paddingBottom: 10 }}>
                <CustomDropdown
                  value={eveningReminderTime}
                  options={timeOptions}
                  onSelect={(val) => handleUpdate({ eveningReminderTime: val })}
                  colors={colors}
                  layout="horizontal"
                  customBtnStyle={{ paddingVertical: 5 }}
                />
              </View>
            )}

            <SettingToggle 
              label={t('Summary')} 
              value={summaryReminder} 
              onValueChange={(val) => handleUpdate({ summaryReminder: val })} 
            />
            {summaryReminder && (
              <View style={{ paddingHorizontal: 15, paddingBottom: 10 }}>
                <CustomDropdown
                  value={summaryReminderTime}
                  options={timeOptions}
                  onSelect={(val) => handleUpdate({ summaryReminderTime: val })}
                  colors={colors}
                  layout="horizontal"
                  customBtnStyle={{ paddingVertical: 5 }}
                />
              </View>
            )}
            
          </View>
          <View style={{ height: 30 }} />
          
          <View style={[styles.footer, { borderTopColor: colors.borderColor }]}>
            <TouchableOpacity onPress={handleReset} style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderColor }]} accessible={true} accessibilityRole="button" accessibilityLabel="Reset settings">
              <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{t('Reset')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={[styles.actionBtn, { backgroundColor: colors.primary }]} accessible={true} accessibilityRole="button" accessibilityLabel="Save settings">
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
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioLabel: {
    fontSize: 14,
  },
  subText: {
    fontSize: 12,
    paddingHorizontal: 10,
    marginBottom: 5,
  }
});
