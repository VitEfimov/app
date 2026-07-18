import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal as RNModal, ScrollView, Platform, Share, Image, KeyboardAvoidingView, Keyboard, Alert, Switch } from 'react-native';
import Modal from 'react-native-modal';
import CustomTimePicker from './CustomTimePicker';
import CustomWheelTimePicker from './CustomWheelTimePicker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useDispatch, useSelector } from 'react-redux';
import { updateTask, deleteTask } from '../features/taskSlice';
import { useTheme } from '../styles/ThemeContext';
import dayjs from 'dayjs';
import Svg, { Path, Circle, Rect, Polyline } from 'react-native-svg';
import { Calendar } from 'react-native-calendars';
import { scheduleTaskReminder, cancelNotification } from '../utils/notifications';
import { useTaskRepeat } from '../custom-hooks/useTaskRepeat';
import CustomDropdown from './CustomDropdown';
import ConfirmModal from './ConfirmModal';
import { useTranslation } from 'react-i18next';

const IconClose = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

const IconShare = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
    <Path d="M16 6l-4-4-4 4" />
    <Path d="M12 2v13" />
  </Svg>
);

const IconCalendar = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18" />
  </Svg>
);

const IconCircle = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
  </Svg>
);

const IconCheckCircle = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M8 12l3 3 5-6" />
  </Svg>
);

const IconClock = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 6v6l4 2" />
  </Svg>
);

const IconList = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Svg>
);

const IconListNumbered = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M4 14h2M4 18h2" />
  </Svg>
);

const IconSquare = ({ color }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </Svg>
);

const IconImage = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <Circle cx="8.5" cy="8.5" r="1.5" />
    <Polyline points="21 15 16 10 5 21" />
  </Svg>
);

const IconCheckSquare = ({ color }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 11l3 3L22 4" />
    <Path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </Svg>
);

export default function TaskDetailsModal({ task, isVisible, onClose }) {
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();
  const scrollViewRef = useRef(null);
  const { t, i18n } = useTranslation();
  const [scrollOffset, setScrollOffset] = useState(0);

  const [taskName, setTaskName] = useState('');
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const [notes, setNotes] = useState('');
  const [noteImage, setNoteImage] = useState('');
  const [subtasks, setSubtasks] = useState(task ? (task.subtasks || []) : []);
  const [priority, setPriority] = useState('none');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reminder, setReminder] = useState('None');
  const [isAlarm, setIsAlarm] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState('None');
  const [repeatStartDate, setRepeatStartDate] = useState('');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [confirmConfig, setConfirmConfig] = useState({ isVisible: false, title: '', message: '', onConfirm: null, confirmText: 'Confirm', isDestructive: false });
  const { generateRepeatingTasks } = useTaskRepeat();

  const [datePickerType, setDatePickerType] = useState(null);
  const [inputHeight, setInputHeight] = useState(46);
  const [isFullscreenImageVisible, setFullscreenImageVisible] = useState(false);

  const surfaceLighter = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';

  const stripHtml = (html) => html ? html.replace(/<[^>]+>/g, '').trim() : '';

  useEffect(() => {
    if (isVisible && task) {
      setTaskName(task.taskname || '');
      setNotes(stripHtml(task.description?.text));
      setNoteImage(task.description?.img || '');
      setSubtasks(task.subtasks || []);
      setPriority(task.priority || 'none');
      setSelectedDate(task.completionDate || '');
      setSelectedTime(task.time || '');
      
      setRepeatFrequency(task.repeatFrequency || 'None');
      setRepeatStartDate(task.repeatStartDate || task.completionDate || '');
      setRepeatEndDate(task.repeatEndDate || '');
      setReminder(task.reminder || 'None');
      setIsAlarm(task.isAlarm || false);
    }
  }, [isVisible, task?.id]);

  const formatDisplayTime = (timeStr) => {
    if (!timeStr || timeStr === '--:--') return '--:--';
    try {
      const [h, m] = timeStr.split(':');
      if (!h || !m || isNaN(h) || isNaN(m)) return timeStr;
      const d = new Date();
      d.setHours(parseInt(h, 10), parseInt(m, 10));
      const result = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return result === 'Invalid Date' ? timeStr : result;
    } catch {
      return timeStr;
    }
  };

  const handleShare = async () => {
    try {
      const priorityStr = priority && priority !== 'none' ? priority.charAt(0).toUpperCase() + priority.slice(1) : '';
      const message = `${t('Task')}: ${taskName}\n${t('Due')}: ${selectedDate ? dayjs(selectedDate).format('MMM D, YYYY') : t('Not set')}${selectedTime ? ` ${t('at')} ${selectedTime}` : ''}${priorityStr ? `\n${t('Priority')}: ${priorityStr}` : ''}\n\n${notes ? `${t('Notes')}:\n${notes}\n\n` : ''}${subtasks.length > 0 ? `${t('Subtasks')}:\n${subtasks.map(s => `- ${s.completed ? '☑️' : '🔲'} ${s.text}`).join('\n')}` : ''}`;
      
      await Share.share({
        message,
        title: t('Share Task')
      });
    } catch (error) {
      console.error(error.message);
    }
  };

  if (!task) return null;

  const handleUpdate = (updates) => {
    // Only used for immediate local updates like priority or subtask check
    dispatch(updateTask({ taskId: task.id, ...updates }));
  };

  const hasUnsavedChanges = () => {
    if (!task) return false;
    if (taskName !== task.taskname) return true;
    if (notes !== stripHtml(task.description?.text) || noteImage !== (task.description?.img || '')) return true;
    if (selectedTime !== (task.time || '')) return true;
    if (reminder !== (task.reminder || 'None')) return true;
    if (isAlarm !== (task.isAlarm || false)) return true;
    if (priority !== (task.priority || 'none')) return true;
    if (selectedDate !== (task.completionDate || '')) return true;
    if (repeatFrequency !== (task.repeatFrequency || 'None')) return true;
    if (repeatStartDate !== (task.repeatStartDate || task.completionDate || '')) return true;
    if (repeatEndDate !== (task.repeatEndDate || '')) return true;
    if (JSON.stringify(subtasks) !== JSON.stringify(task.subtasks || [])) return true;
    return false;
  };

  const handleSave = async () => {
    let updates = {};
    if (taskName !== task.taskname) updates.name = taskName;
    if (notes !== stripHtml(task.description?.text) || noteImage !== (task.description?.img || '')) {
      updates.description = { text: notes, img: noteImage, url: '' };
    }
    if (selectedTime !== (task.time || '')) updates.time = selectedTime;
    if (selectedDate !== (task.completionDate || '')) updates.completionDate = selectedDate;
    if (priority !== (task.priority || 'none')) updates.priority = priority;
    if (repeatFrequency !== (task.repeatFrequency || 'None')) updates.repeatFrequency = repeatFrequency;
    if (repeatStartDate !== (task.repeatStartDate || task.completionDate || '')) updates.repeatStartDate = repeatStartDate;
    if (repeatEndDate !== (task.repeatEndDate || '')) updates.repeatEndDate = repeatEndDate;
    
    const timeChanged = selectedTime !== (task.time || '');
    const dateChanged = selectedDate !== (task.completionDate || '');
    const reminderChanged = reminder !== (task.reminder || 'None');
    const isAlarmChanged = isAlarm !== (task.isAlarm || false);
    const nameChanged = taskName !== task.taskname;

    if (isAlarmChanged) updates.isAlarm = isAlarm;

    if (timeChanged || dateChanged || reminderChanged || isAlarmChanged || nameChanged) {
      if (reminder !== (task.reminder || 'None')) updates.reminder = reminder;
      // Schedule new notifications
      if (task.notificationId) {
        await cancelNotification(task.notificationId);
        updates.notificationId = null;
      }
      const notifIds = await scheduleTaskReminder(taskName, reminder, selectedDate || dayjs().format('YYYY-MM-DD'), selectedTime, task.id, isAlarm);
      if (notifIds && notifIds.length > 0) updates.notificationId = notifIds;
    }
    
    if (JSON.stringify(subtasks) !== JSON.stringify(task.subtasks || [])) {
      updates.subtasks = subtasks;
    }
    
    if (Object.keys(updates).length > 0) {
      dispatch(updateTask({ taskId: task.id, ...updates }));
    }

    if (repeatFrequency !== 'None' && repeatEndDate) {
      generateRepeatingTasks(task, { name: taskName, descriptionText: notes, priority }, { frequency: repeatFrequency, startDate: repeatStartDate || selectedDate || dayjs().format('YYYY-MM-DD'), endDate: repeatEndDate });
    }

    onClose();
  };

  const handleClose = () => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        t('Unsaved Changes'),
        t('You have unsaved changes. Are you sure you want to discard them?'),
        [
          { text: t('Cancel'), style: 'cancel' },
          { text: t('Discard'), style: 'destructive', onPress: onClose }
        ]
      );
    } else {
      onClose();
    }
  };

  const handleNameBlur = () => {
    // Removed auto-save
  };

  const handleNotesBlur = () => {
    // Removed auto-save
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.1,
      base64: true,
    });
    
    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setNoteImage(base64Img);
      // Wait for user to save
    }
  };

  const addSubtask = () => {
    const newSubtasks = [...subtasks, { id: Date.now().toString(), text: '', completed: false }];
    setSubtasks(newSubtasks);
  };

  const updateSubtask = (id, text) => {
    const newSubtasks = subtasks.map(s => s.id === id ? { ...s, text } : s);
    setSubtasks(newSubtasks);
  };

  const toggleSubtask = (id) => {
    const newSubtasks = subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s);
    setSubtasks(newSubtasks);
  };

  const removeSubtask = (id) => {
    const newSubtasks = subtasks.filter(s => s.id !== id);
    setSubtasks(newSubtasks);
  };

  const handlePrioritySelect = (level) => {
    setPriority(level);
  };

  const handleDateSelect = (dateStr) => {
    if (datePickerType === 'due') {
      setSelectedDate(dateStr);
    } else if (datePickerType === 'repeatStart') {
      setRepeatStartDate(dateStr);
    } else if (datePickerType === 'repeatEnd') {
      setRepeatEndDate(dateStr);
    }
    setShowDatePicker(false);
  };

  const handleDelete = () => {
    setConfirmConfig({
      isVisible: true,
      title: t('Delete Task'),
      message: t('Are you sure you want to delete this task?'),
      confirmText: t('Delete'),
      isDestructive: true,
      onConfirm: () => {
        dispatch(deleteTask({ taskId: task.id }));
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
        onClose();
      }
    });
  };

  const toggleComplete = () => {
    const newCompletedState = !task.completed;
    handleUpdate({ completed: newCompletedState });
    if (newCompletedState) {
      onClose();
    }
  };

  return (
    <Modal 
      testID="task_details_modal"
      isVisible={isVisible} 
      onSwipeComplete={handleClose}
      swipeDirection={scrollOffset > 0 ? undefined : ['down']}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      propagateSwipe={true}
      scrollTo={(p) => scrollViewRef.current?.scrollTo(p)}
      scrollOffset={scrollOffset}
      scrollOffsetMax={Math.max(0, scrollContentHeight - scrollViewHeight)}
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: colors.textSecondary }]} />
          </View>
          
          <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', justifyContent: 'flex-end' }]}>
            
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity 
                accessible={true} accessibilityRole="button" accessibilityLabel="Share task"
                onPress={handleShare} style={styles.headerBtn}
              >
                <IconShare color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                testID="task_details_close_btn" 
                accessible={true} accessibilityRole="button" accessibilityLabel="Close task details"
                onPress={handleClose} style={styles.headerBtn}
              >
                <IconClose color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            ref={scrollViewRef}
            onScroll={(e) => setScrollOffset(e.nativeEvent.contentOffset.y)}
            onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
            onContentSizeChange={(_, h) => setScrollContentHeight(h)}
            scrollEventThrottle={16}
            style={styles.body} 
            contentContainerStyle={styles.bodyContent} 
            keyboardShouldPersistTaps="handled"
          >
            
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}>{t('TASK NAME')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <TouchableOpacity 
                accessible={true} accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} accessibilityLabel="Toggle task completion"
                onPress={toggleComplete} style={{ marginTop: 12 }}
              >
                {task.completed ? <IconCheckCircle color={colors.primary} /> : <IconCircle color={colors.textSecondary} />}
              </TouchableOpacity>
              
              <TextInput
                testID="task_details_name_input"
                accessible={true} accessibilityLabel="Task Name"
                style={[styles.input, { flex: 1, color: colors.textPrimary, borderColor: colors.borderColor, backgroundColor: surfaceLighter, height: Math.max(46, inputHeight) }]}
                value={taskName}
                onChangeText={setTaskName}
                onBlur={handleNameBlur}
                onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)}
                placeholder={t("What needs to be done?")}
                placeholderTextColor={colors.textSecondary}
                multiline={true}
                scrollEnabled={false}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.twoColumnRow}>
              <View style={styles.column}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('DUE DATE')}</Text>
                <TouchableOpacity 
                  accessible={true} accessibilityRole="button" accessibilityLabel={`Due date, ${selectedDate ? dayjs(selectedDate).format('MM/DD/YYYY') : 'Not set'}`}
                  style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}
                  onPress={() => { setDatePickerType('due'); setShowDatePicker(true); }}
                >
                  <IconCalendar color={colors.textPrimary} />
                  <Text style={[styles.dateText, { color: colors.textPrimary }]} numberOfLines={1}>
                    {selectedDate ? dayjs(selectedDate).format('MM/DD/YYYY') : t('Select')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.column}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('TIME')}</Text>
                <TouchableOpacity 
                  accessible={true} accessibilityRole="button" accessibilityLabel={`Time, ${formatDisplayTime(selectedTime)}`}
                  style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <IconClock color={colors.textPrimary} />
                  <Text style={[styles.dateText, { color: colors.textPrimary }]} numberOfLines={1}>
                    {formatDisplayTime(selectedTime)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.threeColumnRow}>
              <View style={styles.column}>
                <CustomDropdown label={t("PRIORITY")} value={priority === 'none' ? 'None' : priority} options={[{label: t('None'), value: 'None'}, {label: t('Low'), value: 'Low'}, {label: t('Medium'), value: 'Medium'}, {label: t('High'), value: 'High'}]} onSelect={handlePrioritySelect} colors={colors} customBtnStyle={{ height: 46, borderRadius: 8 }} />
              </View>
              <View style={styles.column}>
                <CustomDropdown label={t("REMINDER")} value={reminder} options={[{label: t('None'), value: 'None'}, {label: t('15 min before'), value: '15 min before'}, {label: t('30 min before'), value: '30 min before'}, {label: t('1 hr before'), value: '1 hr before'}, {label: t('1 day before'), value: '1 day before'}, {label: t('Day of'), value: 'Day of'}]} onSelect={setReminder} colors={colors} customBtnStyle={{ height: 46, borderRadius: 8 }} />
              </View>
              <View style={styles.column}>
                <CustomDropdown label={t("REPEAT")} value={repeatFrequency} options={[{label: t('None'), value: 'None'}, {label: t('Daily'), value: 'Daily'}, {label: t('Weekly'), value: 'Weekly'}, {label: t('Monthly'), value: 'Monthly'}]} onSelect={setRepeatFrequency} colors={colors} customBtnStyle={{ height: 46, borderRadius: 8 }} />
              </View>
            </View>

            {reminder !== 'None' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 15 }}>
                <Switch value={isAlarm} onValueChange={setIsAlarm} trackColor={{ true: colors.primary }} />
                <Text style={{ color: colors.textPrimary, marginLeft: 8, fontWeight: 'bold' }}>{t('Play Reminder as Alarm')}</Text>
              </View>
            )}

            {repeatFrequency !== 'None' && (
              <View style={[styles.repeatConfigBox, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}>
                <Text style={[styles.repeatConfigTitle, { color: colors.textSecondary }]}>{t('REPEAT CONFIGURATION')}</Text>
                <View style={styles.twoColumnRow}>
                  <View style={styles.column}>
                    <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>{t('FROM')}</Text>
                    <TouchableOpacity 
                      style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}
                      onPress={() => { setDatePickerType('repeatStart'); setShowDatePicker(true); }}
                    >
                      <IconCalendar color={colors.textPrimary} />
                      <Text style={[styles.dateText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {repeatStartDate || selectedDate ? dayjs(repeatStartDate || selectedDate).format('MM/DD/YYYY') : t('Select')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.column}>
                    <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>{t('TO')}</Text>
                    <TouchableOpacity 
                      style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}
                      onPress={() => { setDatePickerType('repeatEnd'); setShowDatePicker(true); }}
                    >
                      <IconCalendar color={colors.textPrimary} />
                      <Text style={[styles.dateText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {repeatEndDate ? dayjs(repeatEndDate).format('MM/DD/YYYY') : t('Select')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {showTimePicker && (
              <CustomWheelTimePicker
                visible={showTimePicker}
                value={selectedTime}
                colors={colors}
                isDark={isDark}
                onClose={() => setShowTimePicker(false)}
                onSave={(timeStr) => {
                  setSelectedTime(timeStr);
                  handleUpdate({ time: timeStr });
                  setShowTimePicker(false);
                }}
              />
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0, marginBottom: 0 }]}>{t('NOTES')}</Text>
              <TouchableOpacity 
                accessible={true} accessibilityRole="button" accessibilityLabel="Add Photo"
                onPress={pickImage} hitSlop={{top:10,bottom:10,left:10,right:10}} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <IconImage color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('Add Photo')}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.descContainer, { borderColor: colors.borderColor, backgroundColor: surfaceLighter, padding: 0, minHeight: 100 }]}>
              <TextInput
                accessible={true} accessibilityLabel="Task Notes"
                style={{ flex: 1, padding: 15, color: colors.textPrimary, fontSize: 15 }}
                value={notes}
                onChangeText={setNotes}
                onBlur={handleNotesBlur}
                placeholder={t("Add extra details or notes...")}
                placeholderTextColor={colors.textSecondary}
                multiline={true}
                textAlignVertical="top"
              />
              {noteImage ? (
                <View style={styles.imagePreviewContainer}>
                  <TouchableOpacity onPress={() => setFullscreenImageVisible(true)} activeOpacity={0.8}>
                    <Image source={{ uri: noteImage }} style={styles.imagePreview} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    accessible={true} accessibilityRole="button" accessibilityLabel="Remove Photo"
                    style={styles.imageRemoveBtn} 
                    onPress={() => {
                      setNoteImage('');
                      handleUpdate({ description: { text: notes, img: '', url: '' } });
                    }}
                  >
                    <IconClose color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 10 }}>
              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0, marginBottom: 0 }]}>{t('SUBTASKS')}</Text>
              <TouchableOpacity 
                accessible={true} accessibilityRole="button" accessibilityLabel="Add new subtask"
                onPress={addSubtask} hitSlop={{top:10,bottom:10,left:10,right:10}}
              >
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('+ Add Subtask')}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={{ gap: 8 }}>
              {subtasks.map((subtask) => (
                <View key={subtask.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <TouchableOpacity 
                    accessible={true} accessibilityRole="checkbox" accessibilityState={{ checked: subtask.completed }} accessibilityLabel="Toggle subtask completion"
                    onPress={() => toggleSubtask(subtask.id)} style={{ marginTop: 2 }}
                  >
                    {subtask.completed ? <IconCheckCircle color={colors.primary} /> : <IconCircle color={colors.textSecondary} />}
                  </TouchableOpacity>
                  <TextInput
                    accessible={true} accessibilityLabel="Subtask text"
                    style={[{ flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 2 }, subtask.completed && { textDecorationLine: 'line-through', opacity: 0.5 }]}
                    value={subtask.text}
                    onChangeText={(text) => updateSubtask(subtask.id, text)}
                    placeholder={t("Subtask...")}
                    placeholderTextColor={colors.textSecondary}
                    blurOnSubmit={true}
                    multiline={true}
                  />
                  <TouchableOpacity 
                    accessible={true} accessibilityRole="button" accessibilityLabel="Delete subtask"
                    onPress={() => removeSubtask(subtask.id)} style={{ padding: 4 }}
                  >
                    <IconClose color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 30 }}>
              <TouchableOpacity 
                testID="task_details_delete_btn_bottom"
                accessible={true} accessibilityRole="button" accessibilityLabel="Delete task"
                onPress={handleDelete} 
                style={{ flex: 1, padding: 15, backgroundColor: 'rgba(244, 67, 54, 0.1)', borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#f44336', fontWeight: 'bold', fontSize: 16 }}>{t('Delete')}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                testID="task_details_save_btn_bottom"
                onPress={handleSave} 
                style={{ flex: 1, padding: 15, backgroundColor: colors.primary, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: colors.textInverse, fontWeight: 'bold', fontSize: 16 }}>{t('Save Changes')}</Text>
              </TouchableOpacity>
            </View>
            
          </ScrollView>

        </View>

        <ConfirmModal
          isVisible={confirmConfig.isVisible}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmText={confirmConfig.confirmText}
          isDestructive={confirmConfig.isDestructive}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isVisible: false }))}
          onConfirm={confirmConfig.onConfirm}
        />

        <RNModal visible={showDatePicker} transparent animationType="fade">
          <View style={styles.calendarOverlay}>
            <View style={[styles.calendarContainer, { backgroundColor: colors.bgCard }]}>
              <Calendar
                key={i18n.language}
                current={
                  datePickerType === 'due' 
                    ? (selectedDate || dayjs().format('YYYY-MM-DD'))
                    : datePickerType === 'repeatStart'
                    ? (repeatStartDate || selectedDate || dayjs().format('YYYY-MM-DD'))
                    : (repeatEndDate || repeatStartDate || selectedDate || dayjs().format('YYYY-MM-DD'))
                }
                onDayPress={(day) => handleDateSelect(day.dateString)}
                markedDates={
                  datePickerType === 'due' 
                    ? (selectedDate ? { [selectedDate]: { selected: true, selectedColor: colors.primary, selectedTextColor: colors.textInverse } } : {})
                    : datePickerType === 'repeatStart'
                    ? (repeatStartDate ? { [repeatStartDate]: { selected: true, selectedColor: colors.primary, selectedTextColor: colors.textInverse } } : {})
                    : (repeatEndDate ? { [repeatEndDate]: { selected: true, selectedColor: colors.primary, selectedTextColor: colors.textInverse } } : {})
                }
                theme={{
                  backgroundColor: colors.bgCard,
                  calendarBackground: colors.bgCard,
                  textSectionTitleColor: colors.textSecondary,
                  selectedDayBackgroundColor: colors.primary,
                  selectedDayTextColor: colors.textInverse,
                  todayTextColor: colors.primary,
                  dayTextColor: colors.textPrimary,
                  textDisabledColor: colors.surfaceContainerHigh,
                  dotColor: colors.primary,
                  selectedDotColor: colors.textInverse,
                  arrowColor: colors.textPrimary,
                  monthTextColor: colors.textPrimary,
                  indicatorColor: colors.primary,
                  textDayFontWeight: '500',
                  textMonthFontWeight: 'bold',
                  textDayHeaderFontWeight: '500',
                  textDayFontSize: 14,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 12,
                  'stylesheet.calendar.header': {
                    header: {
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingLeft: 10,
                      paddingRight: 10,
                      marginTop: 6,
                      alignItems: 'center'
                    }
                  }
                }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15, paddingRight: 10 }}>
                <TouchableOpacity 
                  style={{ padding: 10, paddingHorizontal: 20 }} 
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('Cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>

        <RNModal visible={isFullscreenImageVisible} transparent={true} animationType="fade" onRequestClose={() => setFullscreenImageVisible(false)}>
          <View style={styles.fullscreenImageOverlay}>
            <View style={styles.fullscreenImageHeader}>
              <TouchableOpacity 
                style={styles.headerBtn} 
                onPress={() => setFullscreenImageVisible(false)}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <IconClose color="#fff" />
              </TouchableOpacity>
            </View>
            <Image 
              source={{ uri: noteImage }} 
              style={styles.fullscreenImage} 
              resizeMode="contain" 
            />
          </View>
        </RNModal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '92%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    paddingTop: 10,
  },
  dragHandleContainer: {
    paddingBottom: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerBtn: {
    padding: 8,
    marginLeft: 8,
  },
  body: {
    flexGrow: 1,
  },
  bodyContent: {
    padding: 20,
    flexGrow: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 20,
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  descContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  toolBtn: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolIcon: {
    fontSize: 16,
  },
  separator: {
    width: 1,
    height: 20,
    marginHorizontal: 10,
  },
  inputArea: {
    padding: 15,
    fontSize: 15,
    height: 150,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  dateText: {
    fontSize: 15,
  },

  twoColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 15,
  },
  threeColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  column: {
    flex: 1,
    minWidth: '28%',
  },
  timeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46, // Match typical dateBtn height
  },
  timeIconBtn: {
    paddingRight: 10,
    paddingVertical: 10,
  },
  timeInput: {
    flex: 1,
    fontSize: 15,
  },
  repeatConfigBox: {
    marginTop: 20,
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
  },
  repeatConfigTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  closeCalBtn: {
    marginTop: 10,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    width: 320,
    borderRadius: 24,
    padding: 16,
    overflow: 'hidden',
  },
  imagePreviewContainer: {
    padding: 10,
    position: 'relative',
    alignItems: 'flex-start'
  },
  imagePreview: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 5,
    left: 190,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
    padding: 4,
  },
  fullscreenImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImageHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  }
});
