import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal as RNModal, ScrollView, Platform } from 'react-native';
import Modal from 'react-native-modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useDispatch } from 'react-redux';
import { updateTask } from '../features/taskSlice';
import { useTheme } from '../styles/ThemeContext';
import dayjs from 'dayjs';
import Svg, { Path, Circle } from 'react-native-svg';
import { Calendar } from 'react-native-calendars';
import { scheduleTaskReminder, cancelNotification } from '../utils/notifications';
import { useTaskRepeat } from '../custom-hooks/useTaskRepeat';

const IconClose = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

const IconCalendar = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18" />
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

export default function TaskDetailsModal({ task, isVisible, onClose }) {
  const { colors } = useTheme();
  const dispatch = useDispatch();

  const [taskName, setTaskName] = useState('');
  const [description, setDescription] = useState('');
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

  const [datePickerType, setDatePickerType] = useState(null); // 'due', 'repeatStart', or 'repeatEnd'

  useEffect(() => {
    if (task) {
      setTaskName(task.taskname || '');
      setDescription(task.description?.text || '');
      setPriority(task.priority || 'none');
      setSelectedDate(task.completionDate ? dayjs(task.completionDate).format('YYYY-MM-DD') : '');
      setSelectedTime(task.time || '');
      setReminder(task.reminder || 'None');
      setRepeatFrequency('None');
      setRepeatStartDate('');
      setRepeatEndDate('');
    }
  }, [task, isVisible]);

  if (!task) return null;

  const handleUpdate = (updates) => {
    dispatch(updateTask({ taskId: task.id, ...updates }));
  };

  const handleClose = async () => {
    let updates = {};
    if (taskName !== task.taskname) updates.name = taskName;
    if (description !== task.description?.text) updates.description = { ...task.description, text: description };
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
    
    if (Object.keys(updates).length > 0) {
      dispatch(updateTask({ taskId: task.id, ...updates }));
    }

    if (repeatFrequency !== 'None' && repeatEndDate) {
      generateRepeatingTasks(task, { name: taskName, descriptionText: description, priority }, { frequency: repeatFrequency, startDate: repeatStartDate || selectedDate || dayjs().format('YYYY-MM-DD'), endDate: repeatEndDate });
    }

    onClose();
  };

  const handleNameBlur = () => {
    if (taskName !== task.taskname) {
      handleUpdate({ name: taskName });
    }
  };

  const handleDescBlur = () => {
    if (description !== task.description?.text) {
      handleUpdate({ description: { ...task.description, text: description } });
    }
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

  const Dropdown = ({ label, value, options, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <View>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        <TouchableOpacity 
          style={[styles.dropdownBtn, { borderColor: colors.borderColor, backgroundColor: colors.bgMain }]}
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
      propagateSwipe={true}
      onBackdropPress={handleClose}
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: colors.textSecondary }]} />
          </View>
          
          <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Task Details</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <IconClose color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            
            <Text style={[styles.label, { color: colors.textSecondary }]}>TASK NAME</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderColor, backgroundColor: colors.bgMain }]}
              value={taskName}
              onChangeText={setTaskName}
              onBlur={handleNameBlur}
              placeholder="What needs to be done?"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.twoColumnRow}>
              <View style={styles.column}>
                <Dropdown label="PRIORITY" value={priority === 'none' ? 'None' : priority} options={['None', 'Low', 'Medium', 'High']} onSelect={handlePrioritySelect} />
              </View>
              <View style={styles.column}>
                <Dropdown label="REPEAT" value={repeatFrequency} options={['None', 'Daily', 'Weekly', 'Monthly']} onSelect={setRepeatFrequency} />
              </View>
            </View>

            <View style={styles.twoColumnRow}>
              <View style={styles.column}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>DUE DATE</Text>
                <TouchableOpacity 
                  style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: colors.bgMain }]}
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
                <View style={[styles.timeInputWrapper, { borderColor: colors.borderColor, backgroundColor: colors.bgMain }]}>
                  <TouchableOpacity 
                    onPress={() => setShowTimePicker(true)} 
                    style={styles.timeIconBtn}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <IconClock color={colors.textPrimary} />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.timeInput, { color: colors.textPrimary }]}
                    value={selectedTime}
                    onChangeText={(val) => {
                      setSelectedTime(val);
                      handleUpdate({ time: val });
                    }}
                    placeholder="--:--"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>
            </View>

            <View style={styles.twoColumnRow}>
              <View style={[styles.column, { width: '100%' }]}>
                <Dropdown label="REMINDER" value={reminder} options={['None', '15 min before', '30 min before', '1 hr before', '1 day before', 'Day of']} onSelect={setReminder} />
              </View>
            </View>

            {repeatFrequency !== 'None' && (
              <View style={styles.repeatConfigBox}>
                <Text style={[styles.repeatConfigTitle, { color: colors.textSecondary }]}>REPEAT CONFIGURATION</Text>
                <View style={styles.twoColumnRow}>
                  <View style={styles.column}>
                    <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>FROM</Text>
                    <TouchableOpacity 
                      style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: colors.bgMain }]}
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
                      style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: colors.bgMain }]}
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
                value={selectedTime && selectedTime.includes(':') ? dayjs(`2000-01-01T${selectedTime}`).toDate() : new Date()}
                mode="time"
                display="default"
                onChange={(event, date) => {
                  if (Platform.OS !== 'ios') {
                    setShowTimePicker(false);
                  }
                  if (date) {
                    const formattedTime = dayjs(date).format('HH:mm');
                    setSelectedTime(formattedTime);
                    handleUpdate({ time: formattedTime });
                  }
                }}
              />
            )}

            <Text style={[styles.label, { color: colors.textSecondary }]}>DESCRIPTION</Text>
            <TextInput
              style={[styles.inputArea, { color: colors.textPrimary, borderColor: colors.borderColor, backgroundColor: colors.bgMain }]}
              value={description}
              onChangeText={setDescription}
              onBlur={handleDescBlur}
              placeholder="Add extra details here..."
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
            />
            
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
    maxHeight: '85%',
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
  closeBtn: {
    padding: 5,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: 20,
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
    fontSize: 16,
  },
  inputArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    height: 120,
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
    fontSize: 16,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  dropdownText: {
    fontSize: 14,
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
    fontSize: 14,
  },
  repeatConfigBox: {
    marginTop: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
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
  }
});
