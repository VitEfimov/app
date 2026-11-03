import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Animated, Keyboard, Platform, Dimensions } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { Path, Circle, Polyline, Rect } from 'react-native-svg';
import { useDispatch, useSelector } from 'react-redux';
import { updateTask, deleteTask, addTask, deleteRecurringSeries } from '../features/taskSlice';
import ConfirmModal from './ConfirmModal';
import { useTheme } from '../styles/ThemeContext';
import { useToast } from '../styles/ToastContext';
import dayjs from 'dayjs';
import * as Localization from 'expo-localization';
import { useTranslation } from 'react-i18next';
import { getBoardColor } from '../utils/boardColors';
import { A11yHelper } from '../utils/a11yHelper';
import { HapticHelper } from '../utils/hapticHelper';

const inlineEditingListeners = new Set();

export function cancelAllInlineEditing() {
  inlineEditingListeners.forEach(fn => {
    try { fn(); } catch (e) {}
  });
  Keyboard.dismiss();
}

const SwipeIconComplete = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

const SwipeIconSnooze = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Polyline points="12 6 12 12 16 14" />
  </Svg>
);

const SwipeIconDelete = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18" />
    <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

const SwipeIconMore = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="1" />
    <Circle cx="12" cy="5" r="1" />
    <Circle cx="12" cy="19" r="1" />
  </Svg>
);

const IconDotsVertical = ({ color = '#666', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="5" r="1.5" fill={color} />
    <Circle cx="12" cy="12" r="1.5" fill={color} />
    <Circle cx="12" cy="19" r="1.5" fill={color} />
  </Svg>
);

const IconClock = ({ color = '#666', size = 13 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Polyline points="12 6 12 12 16 14" />
  </Svg>
);

const IconNote = ({ color }) => (
  <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Path d="M14 2v6h6" />
    <Path d="M16 13H8" />
    <Path d="M16 17H8" />
    <Path d="M10 9H8" />
  </Svg>
);

const IconAlarm = ({ color }) => (
  <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="13" r="8" />
    <Path d="M12 9v4l2 2" />
    <Path d="M5 3L2 6" />
    <Path d="M19 3l3 3" />
  </Svg>
);

const IconRepeat = ({ color }) => (
  <Svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="17 1 21 5 17 9" />
    <Path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <Polyline points="7 23 3 19 7 15" />
    <Path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Svg>
);

const IconSquare = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </Svg>
);

const IconCheckSquare = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <Path d="M9 12l2 2 4-4" />
  </Svg>
);

const IconCircle = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
  </Svg>
);

const IconCheckCircle = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M8 12l3 3 5-6" />
  </Svg>
);

const EMPTY_BOARDS = [];
const SYSTEM_USES_24H = (() => {
  try {
    return Localization.getCalendars?.()?.[0]?.uses24hourClock ?? false;
  } catch {
    return false;
  }
})();

let activeOpenSwipeable = null;
export const closeOpenSwipeableRow = () => {
  if (activeOpenSwipeable) {
    try {
      activeOpenSwipeable.close();
    } catch (e) {}
    activeOpenSwipeable = null;
  }
};

const TaskRow = React.memo(function TaskRow({ task, sectionId, hideDate = false, hideBoardBadge = false, hideUnderline = false, onPress, onLongPress, disableInlineEdit = false, isSelectionMode = false, isSelected = false, onToggleSelect, onPressSnooze, onPressMore, testIDPrefix = "" }) {
  const dispatch = useDispatch();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const taskNameWrap = useSelector(state => state.themeReducer?.taskNameWrap || 'nowrap');
  const fontSizeSetting = useSelector(state => state.themeReducer?.fontSize || 'normal');
  const boards = useSelector(state => state.userReducer?.boards ?? EMPTY_BOARDS);
  const isPremium = useSelector(state => state.entitlementReducer?.isPremium);

  const titleFontSize = fontSizeSetting === 'small' ? 13 : fontSizeSetting === 'big' ? 18 : 15;

  const taskTitleText = task?.taskname || task?.name || '';

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(taskTitleText);
  const [cursorSelection, setCursorSelection] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const kebabOpacity = useRef(new Animated.Value(1)).current;
  const swipeableRef = useRef(null);

  useEffect(() => {
    return () => {
      if (activeOpenSwipeable === swipeableRef.current) {
        activeOpenSwipeable = null;
      }
    };
  }, []);

  const isRepeatingTask = !!(task?.recurringSeriesId || task?.isRecurring || (task?.repeatConfig && task?.repeatConfig?.preset && task?.repeatConfig?.preset !== 'None') || (task?.repeatFrequency && task?.repeatFrequency !== 'None'));

  const currentBoard = boards.find(b => b && (b.id === (task?.boardId || task?.board_id) || (b._id && b._id === (task?.boardId || task?.board_id))));
  const boardType = currentBoard?.type || 'standard';

  const getTaskAmount = useCallback((t) => {
    if (t?.itemPrice !== undefined && t?.itemPrice !== null && !isNaN(Number(t.itemPrice))) {
      return Number(t.itemPrice);
    }
    if (t?.amount !== undefined && t?.amount !== null && !isNaN(Number(t.amount))) {
      return Number(t.amount);
    }
    const name = t?.taskname || t?.name || '';
    const match = name.match(/\$(\d+(?:\.\d{1,2})?)/);
    if (match) {
      return parseFloat(match[1]);
    }
    return 0;
  }, []);

  const itemQty = task?.itemQuantity !== undefined && !isNaN(Number(task.itemQuantity)) ? Math.max(1, Number(task.itemQuantity)) : 1;
  const unitPrice = getTaskAmount(task);
  const itemTotal = unitPrice > 0 ? (itemQty * unitPrice).toFixed(2) : null;

  const [confirmConfig, setConfirmConfig] = useState({
    isVisible: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDestructive: false,
    secondaryIsDestructive: false,
    secondaryConfirmText: null,
    onSecondaryConfirm: null,
    onConfirm: null,
  });

  const closeSwipeable = useCallback(() => {
    Animated.timing(kebabOpacity, { toValue: 1, duration: 80, useNativeDriver: true }).start();
    if (swipeableRef.current) {
      swipeableRef.current.close();
    }
  }, [kebabOpacity]);

  const handleToggleComplete = useCallback(() => {
    if (!task) return;
    const newCompletedState = !task.completed;
    const habitUpdates = boardType === 'habits' ? (
      newCompletedState ? {
        habitStreak: (task.habitStreak || 0) + 1,
        habitLastCompleted: dayjs().format('YYYY-MM-DD')
      } : {
        habitStreak: Math.max(0, (task.habitStreak || 1) - 1)
      }
    ) : {};

    dispatch(updateTask({
      taskId: task.id || task._id,
      completed: newCompletedState,
      ...habitUpdates
    }));
    
    A11yHelper.announce(newCompletedState ? (t('Task Completed') || 'Task Completed') : (t('Task Uncompleted') || 'Task Uncompleted'));

    if (newCompletedState) {
      HapticHelper.success();
    } else {
      HapticHelper.light();
    }

    showToast(
      newCompletedState ? t('Task Completed') : t('Task Uncompleted'),
      t('Undo'),
      () => {
        const undoHabitUpdates = boardType === 'habits' ? {
          habitStreak: task.habitStreak || 0,
          habitLastCompleted: task.habitLastCompleted || null
        } : {};
        dispatch(updateTask({ taskId: task.id || task._id, completed: !newCompletedState, isUndo: true, ...undoHabitUpdates }));
      }
    );
  }, [task, boardType, dispatch, showToast, t]);

  const handleSwipeComplete = useCallback(() => {
    closeSwipeable();
    handleToggleComplete();
  }, [closeSwipeable, handleToggleComplete]);

  const handleSwipeDelete = useCallback(() => {
    if (!task) return;
    closeSwipeable();
    if (isRepeatingTask) {
      setConfirmConfig({
        isVisible: true,
        title: t('Delete Recurring Task'),
        message: t('Do you want to delete only this task or all recurring tasks?'),
        confirmText: t('This task only'),
        isDestructive: true,
        secondaryIsDestructive: true,
        onConfirm: () => {
          setConfirmConfig(prev => ({ ...prev, isVisible: false }));
          dispatch(deleteTask({ taskId: task.id }));
          showToast(
            t('Task Deleted'),
            t('Undo'),
            () => {
              dispatch(addTask({ task, isUndo: true }));
            }
          );
        },
        secondaryConfirmText: t('All recurring tasks'),
        onSecondaryConfirm: () => {
          setConfirmConfig(prev => ({ ...prev, isVisible: false }));
          dispatch(deleteTask({ taskId: task.id }));
          if (task.recurringSeriesId) {
            dispatch(deleteRecurringSeries({ seriesId: task.recurringSeriesId }));
          }
          showToast(t('Recurring tasks deleted'));
        }
      });
    } else {
      dispatch(deleteTask({ taskId: task.id }));
      showToast(
        t('Task Deleted'),
        t('Undo'),
        () => {
          dispatch(addTask({ task, isUndo: true }));
        }
      );
    }
  }, [closeSwipeable, dispatch, task, isRepeatingTask, showToast, t]);

  const handleSwipeSnooze = useCallback(() => {
    closeSwipeable();
    if (onPressSnooze && task) onPressSnooze(task);
  }, [closeSwipeable, onPressSnooze, task]);

  const handleSwipeMore = useCallback(() => {
    closeSwipeable();
    if (onPressMore && task) onPressMore(task);
  }, [closeSwipeable, onPressMore, task]);

  const screenWidth = Dimensions.get('window').width;
  // Trigger completion reliably at horizontal median (~35%-40% of screen width, max 160px)
  const middleCompleteThreshold = Math.min(160, Math.round(screenWidth * 0.38));

  const renderLeftActions = useCallback((progress, dragX) => {
    if (!dragX || typeof dragX.interpolate !== 'function') return null;
    const scale = dragX.interpolate({
      inputRange: [0, middleCompleteThreshold * 0.5, middleCompleteThreshold],
      outputRange: [0.75, 1, 1.1],
      extrapolate: 'clamp',
    });
    const opacity = dragX.interpolate({
      inputRange: [0, 20, 50],
      outputRange: [0, 0.4, 1],
      extrapolate: 'clamp',
    });
    const transX = dragX.interpolate({
      inputRange: [0, middleCompleteThreshold],
      outputRange: [-24, 0],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.leftAction, { backgroundColor: colors.surfaceContainer, borderBottomColor: colors.borderColor }, hideUnderline && { borderBottomWidth: 0 }]}>
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, { opacity, transform: [{ scale }, { translateX: transX }] }]}>
          <View style={styles.leftActionIconWrapper}>
            <SwipeIconComplete color={colors.primary} />
          </View>
          <Text style={[styles.actionText, { color: colors.primary, marginLeft: 8 }]}>{t('Complete')}</Text>
        </Animated.View>
      </View>
    );
  }, [colors.surfaceContainer, colors.borderColor, colors.primary, t, middleCompleteThreshold, hideUnderline]);

  const renderRightActions = useCallback((progress, dragX) => {
    if (!dragX || typeof dragX.interpolate !== 'function') return null;
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.rightActionContainer, { borderBottomColor: colors.borderColor }, hideUnderline && { borderBottomWidth: 0 }]}>
        <TouchableOpacity
          style={[styles.rightActionBtn, { backgroundColor: colors.surfaceContainer }]}
          onPress={handleSwipeSnooze}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={t('Snooze task') || 'Snooze task'}
          accessibilityHint={t('Opens menu to postpone or reschedule task') || 'Opens menu to postpone or reschedule task'}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <SwipeIconSnooze color={colors.textPrimary} />
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rightActionBtn, { backgroundColor: colors.surfaceContainerHigh }]}
          onPress={handleSwipeDelete}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={t('Delete task') || 'Delete task'}
          accessibilityHint={t('Permanently deletes this task') || 'Permanently deletes this task'}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <SwipeIconDelete color="#f44336" />
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rightActionKebabBtn, { backgroundColor: colors.surfaceContainer }]}
          onPress={handleSwipeMore}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('Task options') || 'Task options'}
          accessibilityHint={t('Opens actions menu') || 'Opens actions menu'}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <IconDotsVertical color={colors.textSecondary} size={18} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  }, [colors.surfaceContainer, colors.surfaceContainerHigh, colors.borderColor, colors.textPrimary, colors.textSecondary, handleSwipeSnooze, handleSwipeDelete, handleSwipeMore, hideUnderline]);

  const isCompletedSection = sectionId === 'completed' || !!task?.completed;

  const handleTextPress = useCallback(() => {
    if (isSelectionMode) {
      if (onToggleSelect && task) onToggleSelect(task.id, sectionId);
      return;
    }
    if (disableInlineEdit) {
      if (onPress) onPress(task);
      return;
    }
    cancelAllInlineEditing();
    setEditName(taskTitleText);
    setCursorSelection({ start: taskTitleText.length, end: taskTitleText.length });
    setIsEditing(true);
  }, [isSelectionMode, onToggleSelect, sectionId, disableInlineEdit, onPress, taskTitleText, task]);

  const submitEdit = useCallback(() => {
    setIsEditing(false);
    Keyboard.dismiss();
    if (editName.trim() !== '' && editName !== task?.taskname) {
      dispatch(updateTask({ taskId: task.id, name: editName }));
    }
  }, [editName, task, dispatch]);

  useEffect(() => {
    const handleCancel = () => {
      if (isEditing) {
        submitEdit();
      }
    };
    inlineEditingListeners.add(handleCancel);
    return () => {
      inlineEditingListeners.delete(handleCancel);
    };
  }, [isEditing, submitEdit]);

  if (!task) return null;

  const getEffectiveHabitCategory = useCallback(() => {
    if (task.itemCategory && ['Morning', 'Afternoon', 'Evening', 'Anytime'].includes(task.itemCategory)) {
      if (task.itemCategory !== 'Anytime') return task.itemCategory;
    }
    if (task.time && typeof task.time === 'string' && task.time.includes(':')) {
      const [h] = task.time.split(':');
      const hour = parseInt(h, 10);
      if (!isNaN(hour)) {
        if (hour >= 4 && hour < 12) return 'Morning';
        if (hour >= 12 && hour < 17) return 'Afternoon';
        if (hour >= 17 && hour <= 23) return 'Evening';
      }
    }
    return task.itemCategory || 'Anytime';
  }, [task.itemCategory, task.time]);

  const handleCycleHabitCategory = useCallback((e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const cycle = ['Morning', 'Afternoon', 'Evening', 'Anytime'];
    const current = getEffectiveHabitCategory();
    const nextIdx = (cycle.indexOf(current) + 1) % cycle.length;
    const nextCategory = cycle[nextIdx];
    dispatch(updateTask({
      taskId: task.id || task._id,
      itemCategory: nextCategory
    }));
  }, [getEffectiveHabitCategory, task.id, task._id, dispatch]);

  const formatDisplayTime = (timeStr) => {
    if (!timeStr || timeStr === '--:--') return '--:--';
    try {
      const [h, m] = timeStr.split(':');
      if (!h || !m || isNaN(h) || isNaN(m)) return timeStr;
      
      const is24Hour = SYSTEM_USES_24H;
      let hour = parseInt(h, 10);
      let ampm = '';
      
      if (!is24Hour) {
        ampm = hour >= 12 ? ' PM' : ' AM';
        if (hour > 12) hour -= 12;
        if (hour === 0) hour = 12;
      } else {
        hour = hour.toString().padStart(2, '0');
      }
      
      return `${hour}:${m.padStart(2, '0')}${ampm}`;
    } catch {
      return timeStr;
    }
  };



  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return '#B3261E';
      case 'medium': return '#d89415';
      case 'low': return '#3F7D3F';
      default: return null;
    }
  };

  const rawDueDate = task.completionDate || task.dateString || task.dueDate || task.date;
  const isDueDateValid = !!(rawDueDate && dayjs(rawDueDate).isValid());
  const priorityColor = getPriorityColor(task.priority);
  const hasNotes = (task.description?.text && task.description.text.trim() !== '') || (task.description?.img && task.description.img.trim() !== '') || (task.description?.attachments && task.description.attachments.length > 0);
  const subtasks = task.subtasks || [];
  const totalSubtasksCount = subtasks.length;
  const completedSubtasksCount = subtasks.filter(s => s.completed).length;
  const hasSubtasks = totalSubtasksCount > 0;

  const taskBoardId = task.boardId || 'main';
  const taskBoard = !hideBoardBadge ? boards.find(b => b.id === taskBoardId) : null;
  const boardName = !hideBoardBadge ? (taskBoard ? (taskBoard.name === 'Main' ? t('Main') : taskBoard.name) : (taskBoardId === 'main' ? t('Main') : 'Board')) : '';
  const boardColor = !hideBoardBadge ? getBoardColor(taskBoardId, boards) : null;

  const handleLongPress = useCallback(() => {
    closeOpenSwipeableRow();
    if (onLongPress) {
      onLongPress(task);
      return;
    }
    if (onToggleSelect) onToggleSelect(task.id, sectionId);
  }, [onLongPress, task, onToggleSelect, sectionId]);

  const taskRowContent = (
    <TouchableOpacity
      testID={testIDPrefix ? `${testIDPrefix}task_row_${task.taskname || task.name}` : `task_row_${task.taskname || task.name}`}
      accessible={true}
      accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
      accessibilityLabel={A11yHelper.formatTaskAccessibilityLabel(task, { t })}
      accessibilityHint={t('Double tap to view or edit task details') || 'Double tap to view or edit task details'}
      accessibilityState={{ checked: task.completed }}
      style={[
        styles.container,
        {
          borderBottomColor: colors.borderColor,
          backgroundColor: colors.bgMain || (isDark ? '#141419' : '#FAF9F6')
        },
        hideUnderline && { borderBottomWidth: 0 }
      ]}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onLongPress={handleLongPress}
      onPress={() => {
        closeOpenSwipeableRow();
        if (isSelectionMode) {
          if (onToggleSelect) onToggleSelect(task.id, sectionId);
          return;
        }
        if (isEditing) {
          submitEdit();
        }
        if (onPress) onPress(task);
      }}
      activeOpacity={0.7}
    >
      {priorityColor ? (
        <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]} accessible={false} importantForAccessibility="no" />
      ) : null}

      {/* Region 2: Checkbox */}
      <TouchableOpacity
        testID="task_checkbox"
        accessible={true}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelectionMode ? isSelected : task.completed }}
        accessibilityLabel={
          isSelectionMode 
            ? (isSelected ? (t('Deselect task') || 'Deselect task') : (t('Select task') || 'Select task'))
            : (task.completed ? (t('Mark task as incomplete') || 'Mark task as incomplete') : (t('Mark task as complete') || 'Mark task as complete'))
        }
        accessibilityHint={t('Toggles completion status for {{name}}', { name: task.taskname || task.name }) || `Toggles completion status for ${task.taskname || task.name}`}
        style={styles.checkbox}
        onPress={() => {
          closeOpenSwipeableRow();
          if (isSelectionMode) {
            if (onToggleSelect) onToggleSelect(task.id, sectionId);
          } else {
            handleToggleComplete();
          }
        }}
        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
      >
        {isSelectionMode ? (
          isSelected ? <IconCheckSquare color={colors.primary} /> : <IconSquare color={colors.textSecondary} />
        ) : (
          task.completed ? <IconCheckCircle color={colors.primary} /> : <IconCircle color={colors.textSecondary} />
        )}
      </TouchableOpacity>
      {/* Region 3: Content */}
      <View style={styles.content}>
        <View style={styles.taskNameBox}>
          {isEditing ? (
            <View style={{ position: 'relative', flexShrink: 1, justifyContent: 'center' }}>
              <Text
                numberOfLines={taskNameWrap === 'nowrap' ? 1 : 2}
                style={[
                  styles.title,
                  { color: 'transparent', fontSize: titleFontSize, flexShrink: 1 }
                ]}
                accessible={false}
                importantForAccessibility="no"
              >
                {editName}
              </Text>
              <TextInput
                style={[
                  styles.title,
                  styles.titleInput,
                  { color: colors.textPrimary, fontSize: titleFontSize, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }
                ]}
                value={editName}
                onChangeText={setEditName}
                onBlur={submitEdit}
                onSubmitEditing={submitEdit}
                autoFocus={true}
                selection={cursorSelection}
                onSelectionChange={(e) => setCursorSelection(e.nativeEvent.selection)}
                multiline={true}
                blurOnSubmit={true}
                returnKeyType="done"
                accessibilityRole="text"
                accessibilityLabel={t('Edit task name') || 'Edit task name'}
                accessibilityHint={t('Type new task name and submit') || 'Type new task name and submit'}
              />
            </View>
          ) : (
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={handleTextPress} 
              onLongPress={handleLongPress} 
              style={{ alignSelf: 'flex-start', maxWidth: '100%', justifyContent: 'center' }}
              accessibilityRole="button"
              accessibilityLabel={task.taskname || task.name}
              accessibilityHint={t('Double tap to edit task name') || 'Double tap to edit task name'}
            >
              <Text
                testID="task_name_text"
                numberOfLines={taskNameWrap === 'nowrap' ? 1 : 2}
                ellipsizeMode="tail"
                style={[
                  styles.title,
                  { color: colors.textPrimary, fontSize: titleFontSize },
                  task.completed && { textDecorationLine: 'line-through', opacity: 0.5 }
                ]}
              >
                {task.taskname}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Indicators under task name: Reminder/time, Category badge, Recurring, Notes, Subtasks */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 10, paddingHorizontal: 4, flexWrap: 'wrap' }}>
          {/* Due Time / Reminder: Shows due time with Alarm icon if reminder set, or Clock icon if no reminder */}
          {task.time && task.time.trim() !== '' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {task.reminder && task.reminder !== 'None' ? (
                <IconAlarm color={colors.textSecondary} />
              ) : (
                <IconClock color={colors.textSecondary} size={13} />
              )}
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {formatDisplayTime(task.time)}
              </Text>
            </View>
          ) : (task.reminder && task.reminder !== 'None') ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <IconAlarm color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {task.reminder}
              </Text>
            </View>
          ) : null}

          {/* Board badge with colored dot like Image 3 */}
          {!hideBoardBadge && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={[styles.categoryDot, { backgroundColor: boardColor }]} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {boardName}
              </Text>
            </View>
          )}

          {/* Interactive controls for specialized list types */}
          {boardType === 'grocery' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard || '#F3F4F6', borderRadius: 10, paddingHorizontal: 3, paddingVertical: 1, borderWidth: 1, borderColor: colors.borderColor || '#E5E7EB', gap: 2 }}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    const nextQty = Math.max(1, itemQty - 1);
                    dispatch(updateTask({ taskId: task.id || task._id, itemQuantity: nextQty }));
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}
                >
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textPrimary, lineHeight: 14 }}>-</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.textPrimary, minWidth: 16, textAlign: 'center' }}>
                  {itemQty}
                </Text>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    const nextQty = itemQty + 1;
                    dispatch(updateTask({ taskId: task.id || task._id, itemQuantity: nextQty }));
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}
                >
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textPrimary, lineHeight: 14 }}>+</Text>
                </TouchableOpacity>
              </View>

              {unitPrice > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B9811A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#10B981' }}>
                    {itemQty > 1 ? `$${unitPrice.toFixed(2)} ea · $${itemTotal}` : `$${unitPrice.toFixed(2)}`}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {boardType === 'expenses' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {unitPrice > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: task.completed ? '#10B9811A' : '#EF44441A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: task.completed ? '#10B981' : '#EF4444' }}>
                    ${unitPrice.toFixed(2)}
                  </Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: task.completed ? '#10B9811A' : '#F59E0B1A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: task.completed ? '#10B981' : '#D97706' }}>
                  {task.completed ? (t('Paid Bills') || 'Paid') : (t('Bills Due') || 'Due')}
                </Text>
              </View>
            </View>
          )}

          {boardType === 'packing' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F61A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#3B82F6' }}>
                  🎒 {t(task.itemCategory || 'Carry-On') || (task.itemCategory || 'Carry-On')}
                </Text>
              </View>
            </View>
          )}

          {boardType === 'habits' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F59E0B1A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#D97706' }}>
                  🔥 {task.habitStreak || 0} {t('days') || 'd'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCycleHabitCategory}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard || '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: colors.borderColor || '#E5E7EB' }}
              >
                <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary }}>
                  {t(getEffectiveHabitCategory()) || getEffectiveHabitCategory()}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {boardType === 'media' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    onPress={(e) => {
                      e.stopPropagation();
                      dispatch(updateTask({ taskId: task.id || task._id, itemRating: star === task.itemRating ? 0 : star }));
                    }}
                  >
                    <Text style={{ fontSize: 13, color: star <= (task.itemRating || 0) ? '#F59E0B' : (colors.borderColor || '#D1D5DB') }}>
                      ★
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {task.itemCategory ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#8B5CF61A', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#8B5CF6' }}>
                    {t(task.itemCategory) || task.itemCategory}
                  </Text>
                </View>
              ) : null}
              {task.itemProgress ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard || '#F3F4F6', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, borderWidth: 1, borderColor: colors.borderColor || '#E5E7EB' }}>
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                    {task.itemProgress}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {isRepeatingTask ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <IconRepeat color={colors.primary} />
            </View>
          ) : null}

          {hasNotes ? <IconNote color={colors.primary} /> : null}

          {hasSubtasks ? (
            <View style={[styles.subtaskBadge, { backgroundColor: colors.bgCard, marginBottom: 0 }]}>
              <Text style={{ fontSize: 9, color: colors.textSecondary, fontWeight: 'bold' }}>{completedSubtasksCount}/{totalSubtasksCount}</Text>
            </View>
          ) : null}

          {isDueDateValid && dayjs(rawDueDate).year() !== dayjs().year() ? (
            <Text style={{ fontSize: 10, color: colors.primary, fontWeight: 'bold' }}>
              {dayjs(rawDueDate).format('YYYY')}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Region 4: Metadata (Date) - Aligned with section header kebab menu */}
      {(!hideDate && isDueDateValid) ? (
        <TouchableOpacity
          style={styles.metadata}
          onPress={(e) => {
            e?.stopPropagation?.();
            closeOpenSwipeableRow();
            if (isSelectionMode) {
              if (onToggleSelect) onToggleSelect(task.id, sectionId);
              return;
            }
            if (isEditing) {
              submitEdit();
            }
            if (onPress) onPress(task);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`${t('Due') || 'Due'}: ${dayjs(rawDueDate).format('MMM D')}`}
        >
          <Text style={[styles.date, { color: colors.textPrimary }]}>
            {dayjs(rawDueDate).format('MMM D')}
          </Text>
        </TouchableOpacity>
      ) : null}

    </TouchableOpacity>
  );

  if (Platform.OS === 'web') {
    return (
      <>
        {taskRowContent}
        {confirmConfig.isVisible && (
          <ConfirmModal
            isVisible={confirmConfig.isVisible}
            title={confirmConfig.title}
            message={confirmConfig.message}
            confirmText={confirmConfig.confirmText}
            cancelText={confirmConfig.cancelText}
            isDestructive={confirmConfig.isDestructive}
            secondaryIsDestructive={confirmConfig.secondaryIsDestructive}
            secondaryConfirmText={confirmConfig.secondaryConfirmText}
            onSecondaryConfirm={confirmConfig.onSecondaryConfirm}
            onConfirm={confirmConfig.onConfirm}
            onCancel={() => setConfirmConfig(prev => ({ ...prev, isVisible: false }))}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Swipeable
        ref={swipeableRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        onSwipeableLeftOpen={handleSwipeComplete}
        onSwipeableWillOpen={(direction) => {
          if (activeOpenSwipeable && activeOpenSwipeable !== swipeableRef.current) {
            try {
              activeOpenSwipeable.close();
            } catch (e) {}
          }
          activeOpenSwipeable = swipeableRef.current;
          if (direction === 'right') {
            Animated.timing(kebabOpacity, { toValue: 0, duration: 80, useNativeDriver: true }).start();
          }
        }}
        onSwipeableOpen={() => {
          if (activeOpenSwipeable && activeOpenSwipeable !== swipeableRef.current) {
            try {
              activeOpenSwipeable.close();
            } catch (e) {}
          }
          activeOpenSwipeable = swipeableRef.current;
        }}
        onSwipeableWillClose={() => {
          Animated.timing(kebabOpacity, { toValue: 1, duration: 80, useNativeDriver: true }).start();
        }}
        onSwipeableClose={() => {
          if (activeOpenSwipeable === swipeableRef.current) {
            activeOpenSwipeable = null;
          }
          Animated.timing(kebabOpacity, { toValue: 1, duration: 50, useNativeDriver: true }).start();
        }}
        friction={1}
        leftThreshold={middleCompleteThreshold}
        rightThreshold={40}
      >
        {taskRowContent}
      </Swipeable>
      {confirmConfig.isVisible && (
        <ConfirmModal
          isVisible={confirmConfig.isVisible}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmText={confirmConfig.confirmText}
          cancelText={confirmConfig.cancelText}
          isDestructive={confirmConfig.isDestructive}
          secondaryIsDestructive={confirmConfig.secondaryIsDestructive}
          secondaryConfirmText={confirmConfig.secondaryConfirmText}
          onSecondaryConfirm={confirmConfig.onSecondaryConfirm}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isVisible: false }))}
        />
      )}
    </>
  );
});

export default TaskRow;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    width: '95%',
    alignSelf: 'center',
    paddingVertical: 8,
    paddingRight: 15,
    paddingLeft: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  priorityIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 10,
  },
  content: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    marginRight: 10,
  },
  taskNameBox: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  title: {
    fontSize: 15,
    includeFontPadding: false,
  },
  titleInput: {
    padding: 0,
    paddingTop: 0,
    paddingBottom: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    outlineStyle: 'none',
    outlineWidth: 0,
    minHeight: 22,
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 46,
  },
  metadataStack: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  date: {
    fontSize: 13,
  },
  time: {
    fontSize: 11,
    marginLeft: 3,
  },
  subtaskBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    marginBottom: 4,
  },
  leftAction: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: '2.5%',
    paddingLeft: 20,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  leftActionIconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  actionText: {
    fontWeight: '600',
    fontSize: 16,
  },
  rightActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: '2.5%',
    paddingRight: 10,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  rightActionBtn: {
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  rightActionKebabBtn: {
    width: 34,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    marginLeft: 4,
  },
  kebabBtnWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  kebabBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  }
});
