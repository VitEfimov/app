import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Switch, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import Modal from 'react-native-modal';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { addTask } from '../../features/taskSlice';
import { getBoardColor } from '../../utils/boardColors';
import { useToast } from '../../styles/ToastContext';
import { IconClock, IconCalendar, IconClose } from './CalendarIcons';
import useTaskRepeat from '../../custom-hooks/useTaskRepeat';

export default function QuickAddTaskModal({
  isVisible,
  onClose,
  initialDate,
  initialHour,
  boards = [],
  onOpenFullDetails,
  onTaskCreated,
  colors,
  isDark
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const dispatch = useDispatch();
  const [taskName, setTaskName] = useState('');
  const [selectedDate, setSelectedDate] = useState(initialDate || dayjs().format('YYYY-MM-DD'));
  const [isAllDay, setIsAllDay] = useState(initialHour === undefined);
  const [timeStr, setTimeStr] = useState(
    initialHour !== undefined 
      ? `${String(initialHour).padStart(2, '0')}:00` 
      : '09:00'
  );
  const [selectedBoardId, setSelectedBoardId] = useState('main');
  const [priority, setPriority] = useState('none');
  const { generateRepeatingTasks } = useTaskRepeat();
  const inputRef = useRef(null);

  useEffect(() => {
    if (isVisible) {
      setTaskName('');
      setSelectedDate(initialDate || dayjs().format('YYYY-MM-DD'));
      if (initialHour !== undefined) {
        setIsAllDay(false);
        setTimeStr(`${String(initialHour).padStart(2, '0')}:00`);
      } else {
        setIsAllDay(true);
        setTimeStr('09:00');
      }
      setSelectedBoardId(boards[0]?.id || boards[0]?._id || 'main');
      setPriority('none');
    }
  }, [isVisible, initialDate, initialHour, boards]);

  const handleSave = () => {
    const finalTitle = taskName.trim() || t('New Task') || 'New Task';
    const targetBoardId = selectedBoardId || 'main';
    const targetBoard = boards.find(b => (b.id === targetBoardId || b._id === targetBoardId));
    const isEventsBoard = targetBoard?.type === 'birthdays' || targetBoard?.type === 'events' || (targetBoard?.name && targetBoard.name.toLowerCase() === 'events');
    const boardRepeatConfig = targetBoard?.repeatConfig || (isEventsBoard ? { preset: 'every_year' } : null);
    const hasDefaultRepeat = Boolean(boardRepeatConfig && boardRepeatConfig.preset && boardRepeatConfig.preset !== 'None');

    const startDateStr = dayjs(selectedDate).format('YYYY-MM-DD');
    let endDateStr = startDateStr;
    if (hasDefaultRepeat) {
      const dur = targetBoard?.repeatDuration || { count: 10, unit: 'year' };
      const count = parseInt(dur.count, 10) || (boardRepeatConfig.preset === 'every_year' ? 10 : 1);
      const unit = dur.unit || (boardRepeatConfig.preset === 'every_year' ? 'year' : 'month');
      endDateStr = dayjs(selectedDate).add(count, unit).format('YYYY-MM-DD');
    }

    const seriesId = hasDefaultRepeat ? ('series_' + Date.now().toString() + Math.random().toString(36).substr(2, 9)) : undefined;

    const newTask = {
      id: Date.now().toString(),
      taskname: finalTitle,
      completionDate: dayjs(selectedDate).toISOString(),
      dateString: selectedDate,
      time: isAllDay ? '' : timeStr,
      boardId: targetBoardId,
      priority: priority || 'none',
      completed: false,
      createdAt: new Date().toISOString(),
      description: { text: '' },
      ...(hasDefaultRepeat ? {
        repeat: boardRepeatConfig.preset === 'every_year' ? 'yearly' : boardRepeatConfig.preset,
        repeatFrequency: boardRepeatConfig.preset,
        repeatConfig: boardRepeatConfig,
        repeatStartDate: startDateStr,
        repeatEndDate: endDateStr,
        recurringSeriesId: seriesId,
        isRecurring: true
      } : {})
    };

    dispatch(addTask({ task: newTask }));
    if (hasDefaultRepeat) {
      generateRepeatingTasks(
        newTask,
        {
          name: finalTitle,
          priority: priority || 'none',
          time: isAllDay ? null : timeStr,
          reminder: 'None',
          isAlarm: false,
          description: { text: '' },
          subtasks: []
        },
        {
          ...boardRepeatConfig,
          startDate: startDateStr,
          endDate: endDateStr
        }
      );
    }
    if (showToast) {
      showToast(t('Task created') || 'Task created');
    }
    if (onTaskCreated) {
      onTaskCreated(selectedDate);
    }
    onClose();
  };

  const handleMoreOptions = () => {
    const draftTask = {
      id: Date.now().toString(),
      taskname: taskName.trim() || 'New Task',
      completionDate: dayjs(selectedDate).toISOString(),
      dateString: selectedDate,
      time: isAllDay ? '' : timeStr,
      boardId: selectedBoardId,
      priority: priority,
      completed: false,
      createdAt: new Date().toISOString(),
      description: { text: '' },
    };
    onClose();
    if (onOpenFullDetails) onOpenFullDetails(draftTask);
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      propagateSwipe={true}
      style={styles.modal}
      avoidKeyboard={true}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={[styles.modalContent, { backgroundColor: colors.bgCard }]}
      >
        {/* Header Drag Handle */}
        <View style={styles.dragHandleContainer}>
          <View style={[styles.dragHandle, { backgroundColor: colors.borderColor }]} />
        </View>

        {/* Modal Top Bar */}
        <View style={styles.topBar}>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {t('New Task') || 'New Task'}
          </Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <IconClose color={colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
          {/* Title Input */}
          <TextInput
            ref={inputRef}
            style={[styles.titleInput, { color: colors.textPrimary, borderBottomColor: colors.borderColor }]}
            placeholder={t('Add title') || 'Add title'}
            placeholderTextColor={colors.textSecondary}
            value={taskName}
            onChangeText={setTaskName}
            autoFocus={true}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          {/* Date Selector Row */}
          <View style={styles.row}>
            <View style={styles.rowLabelGroup}>
              <IconCalendar color={colors.primary} size={18} />
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                {dayjs(selectedDate).format('ddd, MMM D, YYYY')}
              </Text>
            </View>

            {/* Quick date jumps */}
            <View style={styles.quickDateRow}>
              {[
                { label: t('Today') || 'Today', date: dayjs().format('YYYY-MM-DD') },
                { label: t('Tomorrow') || 'Tomorrow', date: dayjs().add(1, 'day').format('YYYY-MM-DD') }
              ].map(q => (
                <TouchableOpacity
                  key={q.label}
                  style={[
                    styles.quickDatePill,
                    selectedDate === q.date ? { backgroundColor: colors.primary } : { borderColor: colors.borderColor, borderWidth: 1 }
                  ]}
                  onPress={() => setSelectedDate(q.date)}
                >
                  <Text style={[
                    styles.quickDateText,
                    { color: selectedDate === q.date ? '#fff' : colors.textSecondary }
                  ]}>
                    {q.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* All Day Toggle */}
          <View style={styles.row}>
            <View style={styles.rowLabelGroup}>
              <IconClock color={colors.textSecondary} size={18} />
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                {t('All-day') || 'All-day'}
              </Text>
            </View>
            <Switch
              value={isAllDay}
              onValueChange={val => setIsAllDay(val)}
              trackColor={{ false: colors.borderColor, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {/* Time Picker Row (if not all day) */}
          {!isAllDay && (
            <View style={styles.timeSelectRow}>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
                {t('Time') || 'Time'}:
              </Text>
              <TextInput
                style={[styles.timeInput, { color: colors.textPrimary, borderColor: colors.borderColor }]}
                value={timeStr}
                onChangeText={setTimeStr}
                placeholder="HH:MM"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          )}

          {/* Categories / Calendars Selector */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
              {t('Category') || 'Category'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPillsScroll}>
              {boards.map(b => {
                const bId = b.id || b._id || 'main';
                const isSelected = selectedBoardId === bId;
                const bColor = getBoardColor(b, boards);

                return (
                  <TouchableOpacity
                    key={bId}
                    style={[
                      styles.categoryPill,
                      {
                        borderColor: isSelected ? bColor : colors.borderColor,
                        backgroundColor: isSelected ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : 'transparent',
                      }
                    ]}
                    onPress={() => setSelectedBoardId(bId)}
                  >
                    <View style={[styles.catColorDot, { backgroundColor: bColor }]} />
                    <Text style={[
                      styles.catPillText,
                      { color: isSelected ? colors.textPrimary : colors.textSecondary, fontWeight: isSelected ? '700' : '500' }
                    ]}>
                      {b.name === 'Main' ? (t('Main') || 'Main') : b.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Priority Selector */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
              {t('Priority') || 'Priority'}
            </Text>
            <View style={styles.priorityRow}>
              {[
                { id: 'none', label: t('None') || 'None' },
                { id: 'low', label: t('Low') || 'Low' },
                { id: 'medium', label: t('Medium') || 'Medium' },
                { id: 'high', label: t('High') || 'High' }
              ].map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.priorityPill,
                    priority === p.id 
                      ? { backgroundColor: colors.primary } 
                      : { borderColor: colors.borderColor, borderWidth: 1 }
                  ]}
                  onPress={() => setPriority(p.id)}
                >
                  <Text style={[
                    styles.priorityPillText,
                    { color: priority === p.id ? '#fff' : colors.textSecondary, fontWeight: priority === p.id ? '700' : '500' }
                  ]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Modal Action Buttons */}
        <View style={[styles.actionsRow, { borderTopColor: colors.borderColor }]}>
          <TouchableOpacity style={styles.moreOptionsBtn} onPress={handleMoreOptions}>
            <Text style={[styles.moreOptionsText, { color: colors.primary }]}>
              {t('More details') || 'More details'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="quick_add_save_btn"
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary }
            ]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={[styles.saveBtnText, { color: colors.textInverse || '#ffffff' }]}>
              {t('Save') || 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    maxHeight: '85%',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickDatePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  quickDateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingLeft: 28,
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
    width: 100,
  },
  sectionBlock: {
    marginTop: 14,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  categoryPillsScroll: {
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  catColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catPillText: {
    fontSize: 13,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  priorityPillText: {
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  moreOptionsBtn: {
    paddingVertical: 8,
    cursor: 'pointer',
  },
  moreOptionsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    cursor: 'pointer',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
