import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Animated, Keyboard } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useDispatch, useSelector } from 'react-redux';
import { updateTask, deleteTask, addTask } from '../features/taskSlice';
import { useTheme } from '../styles/ThemeContext';
import { useToast } from '../styles/ToastContext';
import dayjs from 'dayjs';
import * as Localization from 'expo-localization';
import Svg, { Path, Circle, Rect, Polyline } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

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

const TaskRow = React.memo(function TaskRow({ task, hideDate = false, onPress, disableInlineEdit = false, isSelectionMode = false, isSelected = false, onToggleSelect, onPressSnooze, onPressMore, testIDPrefix = "" }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const theme = useSelector(state => state.themeReducer);
  const taskNameWrap = theme?.taskNameWrap || 'nowrap';
  const fontSizeSetting = theme?.fontSize || 'normal';

  const titleFontSize = fontSizeSetting === 'small' ? 13 : fontSizeSetting === 'big' ? 18 : 15;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(task.taskname);
  const [cursorSelection, setCursorSelection] = useState(null);
  const swipeableRef = useRef(null);

  useEffect(() => {
    if (!isEditing) return;
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      if (editName.trim() !== '' && editName !== task.taskname) {
        dispatch(updateTask({ taskId: task.id, name: editName }));
      }
      setIsEditing(false);
    });
    return () => hideSub.remove();
  }, [isEditing, editName, task, dispatch]);

  const handleTextPress = () => {
    if (isSelectionMode) {
      if (onToggleSelect) onToggleSelect();
      return;
    }
    if (disableInlineEdit) {
      if (onPress) onPress();
      return;
    }
    setEditName(task.taskname);
    setCursorSelection({ start: task.taskname.length, end: task.taskname.length });
    setIsEditing(true);
  };

  const closeSwipeable = () => {
    if (swipeableRef.current) {
      swipeableRef.current.close();
    }
  };

  const handleSwipeComplete = () => {
    closeSwipeable();
    handleToggleComplete();
  };

  const handleSwipeDelete = () => {
    closeSwipeable();
    dispatch(deleteTask({ taskId: task.id }));
    showToast(
      t('Task Deleted'),
      t('Undo'),
      () => {
        dispatch(addTask({ task, isUndo: true }));
      }
    );
  };

  const handleSwipeSnooze = () => {
    closeSwipeable();
    if (onPressSnooze) onPressSnooze(task);
  };

  const handleSwipeMore = () => {
    closeSwipeable();
    if (onPressMore) onPressMore(task);
  };

  const renderLeftActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.leftAction, { backgroundColor: colors.surfaceContainer }]}>
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, { transform: [{ scale }] }]}>
          <SwipeIconComplete color={colors.textPrimary} />
          <Text style={[styles.actionText, { color: colors.textPrimary, marginLeft: 8 }]}>{t('Complete')}</Text>
        </Animated.View>
      </View>
    );
  };

  const renderRightActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <View style={styles.rightActionContainer}>
        <TouchableOpacity style={[styles.rightActionBtn, { backgroundColor: colors.surfaceContainer }]} onPress={handleSwipeSnooze}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <SwipeIconSnooze color={colors.textPrimary} />
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.rightActionBtn, { backgroundColor: colors.surfaceContainerHigh }]} onPress={handleSwipeDelete}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <SwipeIconDelete color="#f44336" />
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.rightActionBtn, { backgroundColor: colors.surfaceContainer }]} onPress={handleSwipeMore}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <SwipeIconMore color={colors.textPrimary} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  };

  const formatDisplayTime = (timeStr) => {
    if (!timeStr || timeStr === '--:--') return '--:--';
    try {
      const [h, m] = timeStr.split(':');
      if (!h || !m || isNaN(h) || isNaN(m)) return timeStr;
      
      const is24Hour = Localization.getCalendars()[0]?.uses24hourClock ?? false;
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

  const submitEdit = () => {
    setIsEditing(false);
    if (editName.trim() !== '' && editName !== task.taskname) {
      dispatch(updateTask({ taskId: task.id, name: editName }));
    }
  };

  const handleToggleComplete = () => {
    const newCompletedState = !task.completed;
    dispatch(updateTask({
      taskId: task.id,
      completed: newCompletedState
    }));
    
    showToast(
      newCompletedState ? t('Task Completed') : t('Task Uncompleted'),
      t('Undo'),
      () => {
        dispatch(updateTask({ taskId: task.id, completed: !newCompletedState, isUndo: true }));
      }
    );
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return '#B3261E';
      case 'medium': return '#d89415';
      case 'low': return '#3F7D3F';
      default: return null;
    }
  };

  const priorityColor = getPriorityColor(task.priority);
  const hasNotes = (task.description?.text && task.description.text.trim() !== '') || (task.description?.img && task.description.img.trim() !== '') || (task.description?.attachments && task.description.attachments.length > 0);
  const subtasks = task.subtasks || [];
  const totalSubtasksCount = subtasks.length;
  const completedSubtasksCount = subtasks.filter(s => s.completed).length;
  const hasSubtasks = totalSubtasksCount > 0;
  const isRepeatingTask = !!(task.recurringSeriesId || task.isRecurring || (task.repeatConfig && task.repeatConfig.preset && task.repeatConfig.preset !== 'None') || (task.repeatFrequency && task.repeatFrequency !== 'None'));

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableLeftOpen={handleSwipeComplete}
      friction={2}
      rightThreshold={40}
    >
      <TouchableOpacity
        testID={`task_row_${testIDPrefix}${task.taskname || task.name}`}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${t('Task')}: ${task.name}. ${task.completed ? t('Completed.') : t('Uncompleted.')} ${task.completionDate ? `${t('Due')} ${dayjs(task.completionDate).format('MMM D')}.` : ''} ${task.priority && task.priority !== 'none' ? `${t('Priority')} ${task.priority}.` : ''}`}
        accessibilityState={{ checked: task.completed }}
        style={[styles.container, { borderBottomColor: colors.borderColor, backgroundColor: colors.bgMain }]}
        onLongPress={() => {
           if (onToggleSelect) onToggleSelect();
        }}
        onPress={(e) => {
          if (isSelectionMode) {
            if (onToggleSelect) onToggleSelect();
            return;
          }
          if (isEditing) {
            submitEdit();
          }
          if (onPress) onPress(e);
        }}
        activeOpacity={0.7}
      >
        {priorityColor ? (
        <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]} />
      ) : null}

      {/* Region 2: Checkbox */}
      <TouchableOpacity
        testID="task_checkbox"
        accessible={true}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelectionMode ? isSelected : task.completed }}
        accessibilityLabel={isSelectionMode ? "Select task" : "Toggle task completion"}
        style={styles.checkbox}
        onPress={() => {
          if (isSelectionMode) {
            if (onToggleSelect) onToggleSelect();
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
                numberOfLines={taskNameWrap === 'nowrap' ? 1 : 3}
                style={[
                  styles.title,
                  { color: 'transparent', fontSize: titleFontSize, flexShrink: 1 }
                ]}
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
              />
            </View>
          ) : (
            <TouchableOpacity activeOpacity={0.7} onPress={handleTextPress} style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
              <Text
                testID="task_name_text"
                numberOfLines={taskNameWrap === 'nowrap' ? 1 : 3}
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

        {/* Indicators under task name */}
        {(hasSubtasks || hasNotes || (task.time && task.time.trim() !== '') || isRepeatingTask || (task.completionDate && dayjs(task.completionDate).year() !== dayjs().year())) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 12, paddingHorizontal: 8 }}>
            {task.completionDate && dayjs(task.completionDate).year() !== dayjs().year() ? (
              <View style={[styles.subtaskBadge, { backgroundColor: `${colors.primary}15`, borderColor: colors.primary, marginBottom: 0 }]}>
                <Text style={{ fontSize: 10, color: colors.primary, fontWeight: 'bold' }}>
                  {dayjs(task.completionDate).format('YYYY')}
                </Text>
              </View>
            ) : null}

            {isRepeatingTask ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <IconRepeat color={colors.primary} />
              </View>
            ) : null}

            {(task.time && task.time.trim() !== '') ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {task.reminder && task.reminder !== 'None' ? <IconAlarm color={colors.textSecondary} /> : null}
                <Text style={[styles.time, { color: colors.textSecondary, marginLeft: 0 }]}>
                  {formatDisplayTime(task.time)}
                </Text>
              </View>
            ) : null}

            {hasNotes ? <IconNote color={colors.primary} /> : null}

            {hasSubtasks ? (
              <View style={[styles.subtaskBadge, { backgroundColor: colors.bgCard, marginBottom: 0 }]}>
                <Text style={{ fontSize: 9, color: colors.textSecondary, fontWeight: 'bold' }}>{completedSubtasksCount}/{totalSubtasksCount}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Region 4: Metadata */}
      {(!hideDate && task.completionDate) ? (
        <View style={styles.metadata}>
          <Text style={[styles.date, { color: colors.textPrimary }]}>
            {dayjs(task.completionDate).format('MMM D')}
          </Text>
        </View>
      ) : null}

    </TouchableOpacity>
    </Swipeable>
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
    paddingVertical: 10,
    paddingRight: 10,
    paddingLeft: 20,
    position: 'relative',
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
    paddingLeft: 20
  },
  actionText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16
  },
  rightActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 150
  },
  rightActionBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%'
  },
  actionIcon: {
    color: 'white',
    fontSize: 20
  }
});
