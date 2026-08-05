import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Keyboard, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { addTask } from '../features/taskSlice';
import { useTheme } from '../styles/ThemeContext';
import dayjs from 'dayjs';
import Svg, { Path } from 'react-native-svg';
import { Calendar } from 'react-native-calendars';
import getFilters from '../utils/filters';
import { useTranslation } from 'react-i18next';

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

export default function InlineAddTask({ sectionId, isActive, onToggle, onAddDetails }) {
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const isEditing = isActive !== undefined ? isActive : internalIsEditing;
  const setIsEditing = onToggle ? onToggle : setInternalIsEditing;
  const [taskName, setTaskName] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [inputHeight, setInputHeight] = useState(46);
  const inputRef = useRef(null);
  
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();
  const activeBoardId = useSelector(state => state.userReducer.activeBoardId || 'main');
  const { t, i18n } = useTranslation();

  const surfaceLighter = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';

  const getCompletionDate = (id) => {
    const FILTERS = getFilters();
    switch (id) {
      case 'today': return dayjs().format('YYYY-MM-DD');
      case 'tomorrow': return dayjs(FILTERS.tomorrow).format('YYYY-MM-DD');
      case 'on-this-week': return dayjs(FILTERS['on-this-week']).format('YYYY-MM-DD');
      case 'on-next-week': return dayjs(FILTERS['on-next-week']).format('YYYY-MM-DD');
      case 'later': return dayjs(FILTERS['on-next-week']).add(1, 'week').format('YYYY-MM-DD');
      case 'missed': return dayjs().subtract(1, 'day').format('YYYY-MM-DD');
      default: 
        if (dayjs(id).isValid()) return dayjs(id).format('YYYY-MM-DD');
        return dayjs().format('YYYY-MM-DD');
    }
  };

  const [selectedDate, setSelectedDate] = useState(getCompletionDate(sectionId));

  useEffect(() => {
    setSelectedDate(getCompletionDate(sectionId));
  }, [sectionId]);

  const handleAdd = () => {
    if (!taskName.trim()) return;

    const newTask = {
      id: new Date().getTime().toString(),
      boardId: activeBoardId,
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
    Keyboard.dismiss();
    return newTask;
  };

  const handleAddWithDetails = () => {
    const newTask = handleAdd();
    if (newTask && onAddDetails) {
      onAddDetails(newTask);
    }
  };

  if (!isEditing) {
    return (
      <TouchableOpacity 
        testID={`inline_add_btn_${sectionId}`}
        accessible={true} accessibilityRole="button" accessibilityLabel={`Create new task for ${sectionId}`}
        style={[styles.addBtn, { borderBottomColor: colors.borderColor }]} 
        onPress={() => setIsEditing(true)}
      >
        <View style={styles.iconWrapper}>
          <IconPlus color={colors.textSecondary} />
        </View>
        <View style={styles.textWrapper}>
          <Text style={[styles.addText, { color: colors.textSecondary }]}>{t('Add task')}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <React.Fragment>
    <Modal 
      visible={true} 
      transparent={true} 
      animationType="fade" 
      onRequestClose={() => setIsEditing(false)}
      onShow={() => {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 300);
      }}
    >
      <KeyboardAvoidingView 
        style={styles.modalOverlayInline} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={() => setIsEditing(false)}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>
        <View style={[styles.editContainer, { backgroundColor: colors.bgCard, borderBottomColor: colors.borderColor, borderTopLeftRadius: 12, borderTopRightRadius: 12 }]}>
          <TextInput
        ref={inputRef}
        testID="inline_task_input"
        accessible={true} accessibilityLabel="New task name"
        style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderColor, backgroundColor: surfaceLighter, height: Math.max(46, inputHeight), maxHeight: 150 }]}
        placeholder={t("Enter task name...")}
        placeholderTextColor={colors.textSecondary}
        value={taskName}
        onChangeText={setTaskName}
        onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)}
        multiline={true}
        scrollEnabled={true}
        blurOnSubmit={true}
        onSubmitEditing={handleAdd}
      />
      <View style={styles.actionsRow}>
        <View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
          <TouchableOpacity 
            accessible={true} accessibilityRole="button" accessibilityLabel={`Select date, currently ${dayjs(selectedDate).format('MM/DD/YYYY')}`}
            style={[styles.dateBtn, { backgroundColor: colors.surfaceContainer }]} 
            onPress={() => setShowDatePicker(true)}
          >
            <IconCalendar color={colors.textPrimary} />
            <Text style={[styles.dateText, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
              {dayjs(selectedDate).format('MMM D')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            accessible={true} accessibilityRole="button" accessibilityLabel="Add more details"
            style={[styles.dateBtn, { backgroundColor: colors.surfaceContainer, flexShrink: 1 }]} 
            onPress={handleAddWithDetails}
          >
            <Text style={[styles.dateText, { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('Add details')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rightActions}>
          <TouchableOpacity 
            accessible={true} accessibilityRole="button" accessibilityLabel="Cancel"
            onPress={() => setIsEditing(false)} style={styles.cancelBtn}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{t('Cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            testID="inline_submit_btn" 
            accessible={true} accessibilityRole="button" accessibilityLabel="Submit task"
            onPress={handleAdd} style={[styles.submitBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.submitText, { color: colors.textInverse }]} numberOfLines={1} adjustsFontSizeToFit>{t('Add')}</Text>
          </TouchableOpacity>
        </View>
      </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>

      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.calendarContainer, { backgroundColor: colors.bgCard }]}>
            <Calendar
              key={i18n.language}
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
              accessible={true} accessibilityRole="button" accessibilityLabel="Close calendar"
              style={[styles.closeCalBtn, { backgroundColor: colors.surfaceContainerHigh }]} 
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </React.Fragment>
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
  iconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 10,
  },
  textWrapper: {
    flex: 1,
    paddingHorizontal: 8,
  },
  addText: {
    fontSize: 15,
  },
  editContainer: {
    padding: 15,
    borderBottomWidth: 1,
  },
  input: {
    fontSize: 15,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderRadius: 8,
    textAlignVertical: 'top',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    flexShrink: 1,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    paddingHorizontal: 10,
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
  modalOverlayInline: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
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
