import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal as RNModal, ScrollView, Platform, Share, Image } from 'react-native';
import Modal from 'react-native-modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { updateTask, deleteTask } from '../features/taskSlice';
import { useTheme } from '../styles/ThemeContext';
import dayjs from 'dayjs';
import Svg, { Path, Circle } from 'react-native-svg';
import { Alert } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { scheduleTaskReminder, cancelNotification } from '../utils/notifications';
import { useTaskRepeat } from '../custom-hooks/useTaskRepeat';

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

const IconChevronDown = ({ color }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9l6 6 6-6" />
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
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </Svg>
);

const IconImage = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
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

  const [taskName, setTaskName] = useState('');
  const [notes, setNotes] = useState('');
  const [noteImage, setNoteImage] = useState('');
  const [subtasks, setSubtasks] = useState([]);
  const [priority, setPriority] = useState('none');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reminder, setReminder] = useState('None');
  const [repeatFrequency, setRepeatFrequency] = useState('None');
  const [repeatStartDate, setRepeatStartDate] = useState('');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const { generateRepeatingTasks } = useTaskRepeat();

  const [datePickerType, setDatePickerType] = useState(null);
  const [inputHeight, setInputHeight] = useState(46);

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
      const message = `Task: ${taskName}\nDue: ${selectedDate ? dayjs(selectedDate).format('MMM D, YYYY') : 'Not set'}${selectedTime ? ` at ${selectedTime}` : ''}\n\n${notes ? `Notes:\n${notes}\n\n` : ''}${subtasks.length > 0 ? `Subtasks:\n${subtasks.map(s => `- ${s.completed ? '☑️' : '🔲'} ${s.text}`).join('\n')}` : ''}`;
      
      await Share.share({
        message,
        title: 'Share Task'
      });
    } catch (error) {
      console.error(error.message);
    }
  };

  if (!task) return null;

  const handleUpdate = (updates) => {
    dispatch(updateTask({ taskId: task.id, ...updates }));
  };

  const handleClose = async () => {
    let updates = {};
    if (taskName !== task.taskname) updates.name = taskName;
    if (notes !== stripHtml(task.description?.text) || noteImage !== (task.description?.img || '')) {
      updates.description = { text: notes, img: noteImage, url: '' };
    }
    if (selectedTime !== (task.time || '')) updates.time = selectedTime;
    
    if (reminder !== (task.reminder || 'None')) {
      updates.reminder = reminder;
      // Schedule new reminder
      if (task.notificationId) {
        await cancelNotification(task.notificationId);
        updates.notificationId = null;
      }
      if (reminder !== 'None') {
        const notifId = await scheduleTaskReminder(taskName, reminder, selectedDate || dayjs().format('YYYY-MM-DD'), task.time);
        if (notifId) updates.notificationId = notifId;
      }
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

  const handleNameBlur = () => {
    if (taskName !== task.taskname) {
      handleUpdate({ name: taskName });
    }
  };

  const handleNotesBlur = () => {
    if (notes !== stripHtml(task.description?.text) || noteImage !== (task.description?.img || '')) {
      handleUpdate({ description: { text: notes, img: noteImage, url: '' } });
    }
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
      handleUpdate({ description: { text: notes, img: base64Img, url: '' } });
    }
  };

  const addSubtask = () => {
    const newSubtasks = [...subtasks, { id: Date.now().toString(), text: '', completed: false }];
    setSubtasks(newSubtasks);
    handleUpdate({ subtasks: newSubtasks });
  };

  const updateSubtask = (id, text) => {
    const newSubtasks = subtasks.map(s => s.id === id ? { ...s, text } : s);
    setSubtasks(newSubtasks);
  };

  const toggleSubtask = (id) => {
    const newSubtasks = subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s);
    setSubtasks(newSubtasks);
    handleUpdate({ subtasks: newSubtasks });
  };

  const removeSubtask = (id) => {
    const newSubtasks = subtasks.filter(s => s.id !== id);
    setSubtasks(newSubtasks);
    handleUpdate({ subtasks: newSubtasks });
  };



  const handlePrioritySelect = (level) => {
    setPriority(level);
    handleUpdate({ priority: level });
  };

  const handleDateSelect = (dateStr) => {
    if (datePickerType === 'due') {
      setSelectedDate(dateStr);
      handleUpdate({ completionDate: dayjs(dateStr).toISOString() });
    } else if (datePickerType === 'repeatStart') {
      setRepeatStartDate(dateStr);
    } else if (datePickerType === 'repeatEnd') {
      setRepeatEndDate(dateStr);
    }
    setShowDatePicker(false);
  };

  const handleDelete = () => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        dispatch(deleteTask({ taskId: task.id }));
        onClose();
      }}
    ]);
  };

  const toggleComplete = () => {
    handleUpdate({ completed: !task.completed });
  };

  const Dropdown = ({ label, value, options, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <View>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        <TouchableOpacity 
          style={[styles.dropdownBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}
          onPress={() => setIsOpen(true)}
        >
          <Text style={[styles.dropdownText, { color: colors.textPrimary }]}>{value}</Text>
          <IconChevronDown color={colors.textSecondary} />
        </TouchableOpacity>
        
        <RNModal visible={isOpen} transparent animationType="fade">
          <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setIsOpen(false)}>
            <View style={[styles.dropdownMenu, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
              {options.map(opt => (
                <TouchableOpacity 
                  key={opt} 
                  style={styles.dropdownItem} 
                  onPress={() => { onSelect(opt); setIsOpen(false); }}
                >
                  <Text style={[styles.dropdownItemText, { color: opt === value ? colors.primary : colors.textPrimary, fontWeight: opt === value ? 'bold' : 'normal' }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </RNModal>
      </View>
    );
  };

  return (
    <Modal 
      isVisible={isVisible} 
      onSwipeComplete={handleClose}
      swipeDirection={['down']}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: colors.textSecondary }]} />
          </View>
          
          <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Task Details</Text>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
                <IconShare color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
                <IconClose color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            
            <Text style={[styles.label, { color: colors.textSecondary }]}>TASK NAME</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <TouchableOpacity onPress={toggleComplete} style={{ marginTop: 12 }}>
                {task.completed ? <IconCheckCircle color={colors.primary} /> : <IconCircle color={colors.textSecondary} />}
              </TouchableOpacity>
              
              <TextInput
                style={[styles.input, { flex: 1, color: colors.textPrimary, borderColor: colors.borderColor, backgroundColor: surfaceLighter, height: Math.max(46, inputHeight) }]}
                value={taskName}
                onChangeText={setTaskName}
                onBlur={handleNameBlur}
                onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)}
                placeholder="What needs to be done?"
                placeholderTextColor={colors.textSecondary}
                multiline={true}
                scrollEnabled={false}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.twoColumnRow}>
              <View style={styles.column}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>DUE DATE</Text>
                <TouchableOpacity 
                  style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}
                  onPress={() => { setDatePickerType('due'); setShowDatePicker(true); }}
                >
                  <IconCalendar color={colors.textPrimary} />
                  <Text style={[styles.dateText, { color: colors.textPrimary }]} numberOfLines={1}>
                    {selectedDate ? dayjs(selectedDate).format('MM/DD/YYYY') : 'Select'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.column}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>TIME</Text>
                <TouchableOpacity 
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
                <Dropdown label="PRIORITY" value={priority === 'none' ? 'None' : priority} options={['None', 'Low', 'Medium', 'High']} onSelect={handlePrioritySelect} />
              </View>
              <View style={styles.column}>
                <Dropdown label="REMINDER" value={reminder} options={['None', '15 min before', '30 min before', '1 hr before', '1 day before', 'Day of']} onSelect={setReminder} />
              </View>
              <View style={styles.column}>
                <Dropdown label="REPEAT" value={repeatFrequency} options={['None', 'Daily', 'Weekly', 'Monthly']} onSelect={setRepeatFrequency} />
              </View>
            </View>

            {repeatFrequency !== 'None' && (
              <View style={[styles.repeatConfigBox, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}>
                <Text style={[styles.repeatConfigTitle, { color: colors.textSecondary }]}>REPEAT CONFIGURATION</Text>
                <View style={styles.twoColumnRow}>
                  <View style={styles.column}>
                    <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>FROM</Text>
                    <TouchableOpacity 
                      style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}
                      onPress={() => { setDatePickerType('repeatStart'); setShowDatePicker(true); }}
                    >
                      <IconCalendar color={colors.textPrimary} />
                      <Text style={[styles.dateText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {repeatStartDate || selectedDate ? dayjs(repeatStartDate || selectedDate).format('MM/DD/YYYY') : 'Select'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.column}>
                    <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>TO</Text>
                    <TouchableOpacity 
                      style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}
                      onPress={() => { setDatePickerType('repeatEnd'); setShowDatePicker(true); }}
                    >
                      <IconCalendar color={colors.textPrimary} />
                      <Text style={[styles.dateText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {repeatEndDate ? dayjs(repeatEndDate).format('MM/DD/YYYY') : 'Select'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {showTimePicker && (
              <DateTimePicker
                value={(() => {
                  if (!selectedTime || selectedTime === '--:--') return new Date();
                  const d = dayjs(`2000-01-01T${selectedTime}`);
                  return d.isValid() ? d.toDate() : new Date();
                })()}
                mode="time"
                display="default"
                themeVariant={isDark ? 'dark' : 'light'}
                onChange={(event, date) => {
                  if (Platform.OS !== 'ios') {
                    setShowTimePicker(false);
                  }
                  if (event.type === 'set' && date) {
                    const formattedTime = dayjs(date).format('HH:mm');
                    setSelectedTime(formattedTime);
                    handleUpdate({ time: formattedTime });
                  }
                }}
              />
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0, marginBottom: 0 }]}>NOTES</Text>
              <TouchableOpacity onPress={pickImage} hitSlop={{top:10,bottom:10,left:10,right:10}} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <IconImage color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Add Photo</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.descContainer, { borderColor: colors.borderColor, backgroundColor: surfaceLighter, padding: 0, minHeight: 100 }]}>
              <TextInput
                style={{ flex: 1, padding: 15, color: colors.textPrimary, fontSize: 15 }}
                value={notes}
                onChangeText={setNotes}
                onBlur={handleNotesBlur}
                placeholder="Add extra details or notes..."
                placeholderTextColor={colors.textSecondary}
                multiline={true}
                textAlignVertical="top"
              />
              {noteImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: noteImage }} style={styles.imagePreview} />
                  <TouchableOpacity 
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
              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0, marginBottom: 0 }]}>SUBTASKS</Text>
              <TouchableOpacity onPress={addSubtask} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>+ Add Subtask</Text>
              </TouchableOpacity>
            </View>
            
            <View style={{ gap: 8 }}>
              {subtasks.map((subtask) => (
                <View key={subtask.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <TouchableOpacity onPress={() => toggleSubtask(subtask.id)} style={{ marginTop: 2 }}>
                    {subtask.completed ? <IconCheckCircle color={colors.primary} /> : <IconCircle color={colors.textSecondary} />}
                  </TouchableOpacity>
                  <TextInput
                    style={[{ flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 2 }, subtask.completed && { textDecorationLine: 'line-through', opacity: 0.5 }]}
                    value={subtask.text}
                    onChangeText={(text) => updateSubtask(subtask.id, text)}
                    placeholder="Subtask..."
                    placeholderTextColor={colors.textSecondary}
                    blurOnSubmit={true}
                  />
                  <TouchableOpacity onPress={() => removeSubtask(subtask.id)} style={{ padding: 4 }}>
                    <IconClose color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <TouchableOpacity 
              onPress={handleDelete} 
              style={{ marginTop: 30, padding: 15, backgroundColor: 'rgba(244, 67, 54, 0.1)', borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#f44336', fontWeight: 'bold', fontSize: 16 }}>Delete Task</Text>
            </TouchableOpacity>
            
          </ScrollView>

        </View>

        <RNModal visible={showDatePicker} transparent animationType="fade">
          <View style={styles.calendarOverlay}>
            <View style={[styles.calendarContainer, { backgroundColor: colors.bgCard }]}>
              <Calendar
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
                  arrowColor: colors.primary,
                  monthTextColor: colors.textPrimary,
                  indicatorColor: colors.primary,
                }}
              />
              <TouchableOpacity 
                style={[styles.closeCalBtn, { backgroundColor: colors.surfaceContainerHigh }]} 
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>
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
    paddingBottom: 10,
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
    padding: 20,
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
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    height: 46,
  },
  dropdownText: {
    fontSize: 13,
    flex: 1,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    width: 250,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownItemText: {
    fontSize: 16,
  },
  twoColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  threeColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  column: {
    flex: 1,
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
    padding: 20,
  },
  calendarContainer: {
    borderRadius: 12,
    padding: 10,
    overflow: 'hidden',
  },
  imagePreviewContainer: {
    padding: 10,
    position: 'relative',
    alignItems: 'flex-start'
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 5,
    left: 90,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
    padding: 4,
  }
});
