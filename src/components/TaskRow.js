import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { updateTask } from '../features/taskSlice';
import { useTheme } from '../styles/ThemeContext';
import dayjs from 'dayjs';
import Svg, { Path, Circle } from 'react-native-svg';

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

export default function TaskRow({ task, hideDate = false, onPress }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();

  const theme = useSelector(state => state.themeReducer);
  const taskNameWrap = theme?.taskNameWrap || 'wrap';
  const fontSizeSetting = theme?.fontSize || 'normal';

  const titleFontSize = fontSizeSetting === 'small' ? 13 : fontSizeSetting === 'big' ? 18 : 15;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(task.taskname);
  const [cursorSelection, setCursorSelection] = useState(null);

  const handleTextPress = () => {
    setEditName(task.taskname);
    setCursorSelection({ start: task.taskname.length, end: task.taskname.length });
    setIsEditing(true);
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
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4caf50';
      default: return null;
    }
  };

  const priorityColor = getPriorityColor(task.priority);

  return (
    <TouchableOpacity 
      style={[styles.container, { borderBottomColor: colors.borderColor }]} 
      onPress={(e) => {
        if (isEditing) {
          // Prevent opening modal while saving inline edit to avoid race condition
          return;
        }
        if (onPress) onPress(e);
      }}
      activeOpacity={0.7}
    >
      <TouchableOpacity 
        style={styles.checkbox} 
        onPress={handleToggleComplete}
      >
        {task.completed ? <IconCheckCircle color={colors.primary} /> : <IconCircle color={colors.textSecondary} />}
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={[
          styles.taskNameBox, 
          priorityColor && { backgroundColor: `${priorityColor}15` }
        ]}>
          {isEditing ? (
            <TextInput
              style={[
                styles.title,
                styles.titleInput,
                { color: colors.textPrimary, fontSize: titleFontSize }
              ]}
              value={editName}
              onChangeText={setEditName}
              onBlur={submitEdit}
              onSubmitEditing={submitEdit}
              autoFocus={true}
              selection={cursorSelection}
              onSelectionChange={(e) => setCursorSelection(e.nativeEvent.selection)}
              multiline={false}
              returnKeyType="done"
            />
          ) : (
            <TouchableOpacity activeOpacity={0.7} onPress={handleTextPress} style={{ alignSelf: 'flex-start' }}>
              <Text 
                numberOfLines={taskNameWrap === 'nowrap' ? 1 : undefined}
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

      {(!hideDate && task.completionDate) ? (
        <View style={styles.dateContainer}>
          <Text style={[styles.date, { color: colors.textPrimary }]}>
            {dayjs(task.completionDate).format('MMM D')}
          </Text>
          {task.time ? (
            <Text style={[styles.time, { color: colors.textSecondary }]}>
              {task.time}
            </Text>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    width: '90%',
    alignSelf: 'center',
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
    justifyContent: 'center',
  },
  taskNameBox: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  title: {
    fontSize: 15,
  },
  titleInput: {
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    outlineStyle: 'none',
    minHeight: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  dateContainer: {
    alignItems: 'flex-end',
    marginLeft: 15,
  },
  date: {
    fontSize: 13,
  },
  time: {
    fontSize: 11,
    marginTop: 2,
  }
});
