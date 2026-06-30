import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useDispatch } from 'react-redux';
import { addTask } from '../features/taskSlice';
import { useTheme } from '../styles/ThemeContext';
import dayjs from 'dayjs';
import Svg, { Path } from 'react-native-svg';
import { Calendar } from 'react-native-calendars';
import getFilters from '../utils/filters';

const IconPlus = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);

const IconCalendar = ({ color }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18" />
  </Svg>
);

export default function InlineAddTask({ sectionId }) {
  const [isEditing, setIsEditing] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const { colors } = useTheme();
  const dispatch = useDispatch();

  const getCompletionDate = (id) => {
    const FILTERS = getFilters();
    switch (id) {
      case 'today': return dayjs().format('YYYY-MM-DD');
      case 'tomorrow': return dayjs(FILTERS.tomorrow).format('YYYY-MM-DD');
      case 'on-this-week': return dayjs(FILTERS['on-this-week']).format('YYYY-MM-DD');
      case 'on-next-week': return dayjs(FILTERS['on-next-week']).format('YYYY-MM-DD');
      case 'later': return dayjs(FILTERS['on-next-week']).add(1, 'week').format('YYYY-MM-DD');
      case 'missed': return dayjs().subtract(1, 'day').format('YYYY-MM-DD');
      default: return dayjs().format('YYYY-MM-DD');
    }
  };

  const [selectedDate, setSelectedDate] = useState(getCompletionDate(sectionId));

  const handleAdd = () => {
    if (!taskName.trim()) return;

    const newTask = {
      id: new Date().getTime().toString(),
      boardId: 'main',
      taskname: taskName,
      creationDate: new Date().toLocaleDateString(),
      lastUpdatedDate: null,
      completionDate: dayjs(selectedDate).toISOString(),
      priority: 'none',
      completed: false,
      description: { text: '', img: '', url: '' }
    };

    dispatch(addTask({ task: newTask }));
    setTaskName('');
    setSelectedDate(getCompletionDate(sectionId));
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <TouchableOpacity 
        style={[styles.addBtn, { borderBottomColor: colors.borderColor }]} 
        onPress={() => setIsEditing(true)}
      >
        <IconPlus color={colors.textSecondary} />
        <Text style={[styles.addText, { color: colors.textSecondary }]}>Add task</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.editContainer, { backgroundColor: colors.bgCard, borderBottomColor: colors.borderColor }]}>
      <TextInput
        style={[styles.input, { color: colors.textPrimary, borderBottomColor: colors.primary }]}
        placeholder="Enter task name..."
        placeholderTextColor={colors.textSecondary}
        value={taskName}
        onChangeText={setTaskName}
        autoFocus
        onSubmitEditing={handleAdd}
      />
      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={[styles.dateBtn, { backgroundColor: colors.surfaceContainer }]} 
          onPress={() => setShowDatePicker(true)}
        >
          <IconCalendar color={colors.textPrimary} />
          <Text style={[styles.dateText, { color: colors.textPrimary }]}>
            {dayjs(selectedDate).format('MMM D')}
          </Text>
        </TouchableOpacity>

        <View style={styles.rightActions}>
          <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleAdd} style={[styles.submitBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.submitText, { color: colors.textInverse }]}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.calendarContainer, { backgroundColor: colors.bgCard }]}>
            <Calendar
              current={selectedDate}
              onDayPress={(day) => {
                setSelectedDate(day.dateString);
                setShowDatePicker(false);
              }}
              markedDates={{
                [selectedDate]: { selected: true, selectedColor: colors.primary, selectedTextColor: colors.textInverse }
              }}
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
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    width: '90%',
    alignSelf: 'center',
  },
  addText: {
    marginLeft: 10,
    fontSize: 15,
  },
  editContainer: {
    padding: 15,
    borderBottomWidth: 1,
  },
  input: {
    fontSize: 16,
    paddingVertical: 8,
    marginLeft: 34,
    marginBottom: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  submitText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalOverlay: {
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
  closeCalBtn: {
    marginTop: 10,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
  }
});
