import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { updateTask } from '../features/taskSlice';
import { useTheme } from '../styles/ThemeContext';
import dayjs from 'dayjs';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

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

export default function TaskRow({ task, hideDate = false, onPress, disableInlineEdit = false, isSelectionMode = false, isSelected = false, onToggleSelect }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();

  const theme = useSelector(state => state.themeReducer);
  const taskNameWrap = theme?.taskNameWrap || 'nowrap';
  const fontSizeSetting = theme?.fontSize || 'normal';

  const titleFontSize = fontSizeSetting === 'small' ? 13 : fontSizeSetting === 'big' ? 18 : 15;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(task.taskname);
  const [cursorSelection, setCursorSelection] = useState(null);

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

  const formatDisplayTime = (timeStr) => {
    if (!timeStr) return '';
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

  const submitEdit = () => {
    setIsEditing(false);
    if (editName.trim() !== '' && editName !== task.taskname) {
      dispatch(updateTask({ taskId: task.id, name: editName }));
    }
  };

  const handleToggleComplete = () => {
    dispatch(updateTask({
      taskId: task.id,
      completed: !task.completed
    }));
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return '#B3261E';
      case 'medium': return '#A15C00';
      case 'low': return '#3F7D3F';
      default: return null;
    }
  };

  const priorityColor = getPriorityColor(task.priority);
  const hasNotes = task.description?.text && task.description.text.trim() !== '';
  const subtasks = task.subtasks || [];
  const totalSubtasksCount = subtasks.length;
  const completedSubtasksCount = subtasks.filter(s => s.completed).length;
  const hasSubtasks = totalSubtasksCount > 0;

  return (
    <TouchableOpacity
      style={[styles.container, { borderBottomColor: colors.borderColor }]}
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
      ) : (
        <View style={styles.priorityPlaceholder} />
      )}

      <View style={styles.innerContainer}>
        <TouchableOpacity
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
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.rightStack}>
            {hasSubtasks && (
              <View style={[styles.subtaskBadge, { backgroundColor: colors.bgCard }]}>
                <Text style={{ fontSize: 9, color: colors.textSecondary, fontWeight: 'bold' }}>{completedSubtasksCount}/{totalSubtasksCount}</Text>
              </View>
            )}
            {(!hideDate && task.completionDate) && (
              <Text style={[styles.date, { color: colors.textPrimary }]}>
                {dayjs(task.completionDate).format('MMM D')}
              </Text>
            )}
            {task.time && (
              <Text style={[styles.time, { color: colors.textSecondary }]}>
                {formatDisplayTime(task.time)}
              </Text>
            )}
          </View>
          {hasNotes && <View style={styles.descIndicatorRelative} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    width: '95%',
    alignSelf: 'center',
  },
  innerContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 20,
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
  rightColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
    marginRight: 10,
    position: 'relative',
  },
  rightStack: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  date: {
    fontSize: 13,
  },
  time: {
    fontSize: 11,
    marginTop: 2,
  },
  priorityIndicator: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 16,
  },
  priorityPlaceholder: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 16,
  },
  descIndicatorRelative: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#5e7d68',
    marginLeft: 6,
  },
  subtaskBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    marginBottom: 4,
  }
});
