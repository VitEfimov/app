import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Modal from 'react-native-modal';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../styles/ThemeContext';
import { setAutoManageSettings, setBoardAutoManageSettings, removeBoardAutoManageSettings } from '../features/themeSlice';
import { processAutoManageTasks } from '../features/taskSlice';
import { updateRecurringAutomations } from '../utils/notifications';
import CustomDropdown from './CustomDropdown';
import CustomTimePicker from './CustomTimePicker';
import * as Localization from 'expo-localization';

export default function AutoManageSettings({ isVisible, onClose, boardId, boardName }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const themeState = useSelector(state => state.themeReducer);
  const tasks = useSelector(state => state.taskReducer.tasks);

  const scrollViewRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const [timePickerTarget, setTimePickerTarget] = useState(null);

  const defaultSettings = {
    overrideGlobal: true,
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
    summaryReminderTime: '09:00',
    autoRescheduleTime: '09:00'
  };

  const formatDisplayTime = (timeStr) => {
    if (!timeStr || timeStr === '--:--') return '--:--';
    try {
      const str = String(timeStr).trim();
      const isPmStr = /pm/i.test(str);
      const isAmStr = /am/i.test(str);
      const cleanStr = str.replace(/(am|pm)/i, '').trim();
      const parts = cleanStr.split(':');
      if (parts.length < 2) return timeStr;

      let hour = parseInt(parts[0], 10);
      let minute = parseInt(parts[1], 10);
      if (isNaN(hour) || isNaN(minute)) return timeStr;

      if (isPmStr && hour < 12) hour += 12;
      if (isAmStr && hour === 12) hour = 0;

      const is24Hour = Localization.getCalendars?.()?.[0]?.uses24hourClock ?? false;
      let ampm = '';

      if (!is24Hour) {
        ampm = hour >= 12 ? ' PM' : ' AM';
        if (hour > 12) hour -= 12;
        if (hour === 0) hour = 12;
        return `${hour}:${minute.toString().padStart(2, '0')}${ampm}`;
      } else {
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }
    } catch {
      return timeStr;
    }
  };

  const [localSettings, setLocalSettings] = useState(defaultSettings);

  useEffect(() => {
    if (isVisible) {
      if (boardId) {
        const boardCustom = themeState.boardAutomations?.[boardId];
        setLocalSettings(boardCustom || { ...themeState, overrideGlobal: false });
      } else {
        setLocalSettings(themeState || defaultSettings);
      }
    }
  }, [isVisible, boardId, themeState]);

  const handleUpdate = (updates) => {
    const updated = { ...localSettings, ...updates };
    setLocalSettings(updated);
    if (boardId) {
      dispatch(setBoardAutoManageSettings({ boardId, settings: updated }));
    } else {
      dispatch(setAutoManageSettings(updated));
      updateRecurringAutomations(updated, tasks);
    }
    dispatch(processAutoManageTasks());
  };

  const handleSave = () => {
    if (boardId) {
      dispatch(setBoardAutoManageSettings({ boardId, settings: localSettings }));
    } else {
      dispatch(setAutoManageSettings(localSettings));
      updateRecurringAutomations(localSettings, tasks);
    }
    dispatch(processAutoManageTasks());
    onClose();
  };

  const handleReset = () => {
    if (boardId) {
      dispatch(removeBoardAutoManageSettings({ boardId }));
      setLocalSettings({ ...defaultSettings, overrideGlobal: false });
    } else {
      setLocalSettings(defaultSettings);
    }
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
    summaryReminderTime = '09:00',
    autoRescheduleTime = '09:00'
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
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {boardId ? `${t('Board Automation')}: ${boardName || ''}` : t('Auto-Manage Tasks')}
            </Text>
            {boardId && (
              <Text style={{ fontSize: 12, color: colors.primary, marginTop: 2, fontWeight: 'bold' }}>
                {localSettings.overrideGlobal === true ? t('Custom Board Automation (Overrides Main)') : t('Using Main Global Automation')}
              </Text>
            )}
          </View>
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
          {boardId && (
            <View style={[styles.settingsGroup, { backgroundColor: colors.surfaceContainer, padding: 12, marginBottom: 15, borderRadius: 10, borderWidth: 1, borderColor: colors.primary }]}>
              <SettingToggle 
                label={t('Override Main Automation for this Board')}
                value={localSettings.overrideGlobal === true}
                onValueChange={(val) => handleUpdate({ overrideGlobal: val })}
              />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
                {t('When enabled, custom automation rules specified for this board take priority and main global automation will not apply to tasks on this board.')}
              </Text>
            </View>
          )}

          <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>{t('Task Scheduling')}</Text>
          <View style={[styles.settingsGroup, { backgroundColor: colors.surfaceContainer, padding: 10 }]}>
            <Text style={[styles.subText, { color: colors.textSecondary, marginBottom: 2, fontWeight: 'bold' }]}>{t('When overdue')}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10 }}>{t('Automatically move uncompleted tasks to a new date when their due date passes.')}</Text>
            <RadioButton label={t('Today')} selected={autoTransferMode === 'today'} onPress={() => handleUpdate({ autoTransferMode: 'today' })} />
            <RadioButton label={t('Tomorrow')} selected={autoTransferMode === 'tomorrow'} onPress={() => handleUpdate({ autoTransferMode: 'tomorrow' })} />
            <RadioButton label={t('Next Workday')} selected={autoTransferMode === 'next_workday'} onPress={() => handleUpdate({ autoTransferMode: 'next_workday' })} />
            <RadioButton label={t('Never')} selected={autoTransferMode === 'none'} onPress={() => handleUpdate({ autoTransferMode: 'none' })} />
            {(autoTransferMode === 'tomorrow' || autoTransferMode === 'next_workday' || autoTransferMode === 'today') && (
              <View style={{ paddingHorizontal: 15, paddingTop: 6, paddingBottom: 10, alignItems: 'flex-start' }}>
                <Text style={[styles.subText, { color: colors.textSecondary, marginBottom: 6 }]}>{t('Auto-reschedule time')}</Text>
                <TouchableOpacity onPress={() => setTimePickerTarget('autoReschedule')} style={{ paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.surfaceContainerHigh }}>
                  <Text style={{ color: colors.textPrimary }}>{formatDisplayTime(autoRescheduleTime)}</Text>
                </TouchableOpacity>
              </View>
            )}
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
              <View style={{ paddingHorizontal: 15, paddingBottom: 10, alignItems: 'flex-start' }}>
                <TouchableOpacity onPress={() => setTimePickerTarget('morning')} style={{ paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.surfaceContainerHigh }}>
                  <Text style={{ color: colors.textPrimary }}>{formatDisplayTime(morningReminderTime)}</Text>
                </TouchableOpacity>
              </View>
            )}

            <SettingToggle 
              label={t("Evening reminder")} 
              value={eveningReminder} 
              onValueChange={(val) => handleUpdate({ eveningReminder: val })} 
            />
            {eveningReminder && (
              <View style={{ paddingHorizontal: 15, paddingBottom: 10, alignItems: 'flex-start' }}>
                <TouchableOpacity onPress={() => setTimePickerTarget('evening')} style={{ paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.surfaceContainerHigh }}>
                  <Text style={{ color: colors.textPrimary }}>{formatDisplayTime(eveningReminderTime)}</Text>
                </TouchableOpacity>
              </View>
            )}

            <SettingToggle 
              label={t('Summary')} 
              value={summaryReminder} 
              onValueChange={(val) => handleUpdate({ summaryReminder: val })} 
            />
            {summaryReminder && (
              <View style={{ paddingHorizontal: 15, paddingBottom: 10, alignItems: 'flex-start' }}>
                <TouchableOpacity onPress={() => setTimePickerTarget('summary')} style={{ paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.surfaceContainerHigh }}>
                  <Text style={{ color: colors.textPrimary }}>{formatDisplayTime(summaryReminderTime)}</Text>
                </TouchableOpacity>
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
        {timePickerTarget && (
          <CustomTimePicker
            visible={!!timePickerTarget}
            value={
              timePickerTarget === 'morning' ? morningReminderTime :
              timePickerTarget === 'evening' ? eveningReminderTime :
              timePickerTarget === 'summary' ? summaryReminderTime :
              timePickerTarget === 'autoReschedule' ? autoRescheduleTime : '12:00'
            }
            colors={colors}
            isDark={themeState?.isDark || false}
            onClose={() => setTimePickerTarget(null)}
            onSave={(newTime) => {
              if (timePickerTarget === 'morning') handleUpdate({ morningReminderTime: newTime });
              else if (timePickerTarget === 'evening') handleUpdate({ eveningReminderTime: newTime });
              else if (timePickerTarget === 'summary') handleUpdate({ summaryReminderTime: newTime });
              else if (timePickerTarget === 'autoReschedule') handleUpdate({ autoRescheduleTime: newTime });
              setTimePickerTarget(null);
            }}
          />
        )}
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
