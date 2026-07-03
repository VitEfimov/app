import React, { useState, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, Text, Animated, PanResponder, Keyboard, Platform } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Calendar } from 'react-native-calendars';
import { useTheme } from '../styles/ThemeContext';
import TaskRow from '../components/TaskRow';
import InlineAddTask from '../components/InlineAddTask';
import TaskDetailsModal from '../components/TaskDetailsModal';
import dayjs from 'dayjs';

export default function CalendarScreen() {
  const { colors, isDark } = useTheme();
  const tasks = useSelector(state => state.taskReducer.tasks || []);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsVisible, setDetailsVisible] = useState(false);

  const dispatch = useDispatch();

  // Custom Bottom Sheet State
  const MIN_Y = 0; // Fully expanded (covers calendar)
  const maxYRef = useRef(360); // Default, updated onLayout
  const isInitialized = useRef(false);
  
  const panY = useRef(new Animated.Value(360)).current;
  const lastY = useRef(360);

  const handleCalendarLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    if (Math.abs(maxYRef.current - height) > 5) {
      maxYRef.current = height;
      if (!isInitialized.current) {
        panY.setValue(height);
        lastY.current = height;
        isInitialized.current = true;
      }
    }
  };

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      Animated.timing(panY, {
        toValue: MIN_Y,
        duration: 300,
        useNativeDriver: false,
      }).start();
      lastY.current = MIN_Y;
    });

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        panY.stopAnimation((value) => {
          lastY.current = value;
        });
      },
      onPanResponderMove: (evt, gestureState) => {
        let newY = lastY.current + gestureState.dy;
        if (newY < MIN_Y) newY = MIN_Y;
        if (newY > maxYRef.current) newY = maxYRef.current;
        panY.setValue(newY);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const currentY = lastY.current + gestureState.dy;
        let targetY = maxYRef.current;
        
        // Snap to nearest position
        const distToMin = Math.abs(currentY - MIN_Y);
        const distToMax = Math.abs(currentY - maxYRef.current);

        if (distToMin < distToMax) {
          targetY = MIN_Y;
        } else {
          targetY = maxYRef.current;
        }

        lastY.current = targetY;

        Animated.timing(panY, {
          toValue: targetY,
          duration: 300,
          useNativeDriver: false,
        }).start();
      }
    })
  ).current;

  const handleTaskPress = (task) => {
    setSelectedTask(task);
    setDetailsVisible(true);
  };

  // Prepare marked dates
  const markedDates = useMemo(() => {
    const marks = {};
    tasks.forEach(task => {
      if (task.completionDate) {
        const dateStr = dayjs(task.completionDate).format('YYYY-MM-DD');
        if (!marks[dateStr]) {
          marks[dateStr] = { tasks: [] };
        }
        marks[dateStr].tasks.push(task);
      }
    });

    const finalMarks = {};
    Object.keys(marks).forEach(dateStr => {
      const dayTasks = marks[dateStr].tasks;
      const allCompleted = dayTasks.every(t => t.completed);
      const anyMissed = dayTasks.some(t => !t.completed && dayjs(t.completionDate).isBefore(dayjs(), 'day'));

      let dotColor = colors.primary;
      if (allCompleted) dotColor = '#ffffff';
      else if (anyMissed) dotColor = '#f44336';

      finalMarks[dateStr] = { marked: true, dotColor: dotColor };
    });

    // Mark the currently selected date
    if (finalMarks[selectedDate]) {
      finalMarks[selectedDate].selected = true;
      finalMarks[selectedDate].selectedColor = colors.primary;
    } else {
      finalMarks[selectedDate] = { selected: true, selectedColor: colors.primary };
    }

    return finalMarks;
  }, [tasks, selectedDate, colors]);

  // Get tasks for selected date
  const selectedTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task.completionDate) return false;
      return dayjs(task.completionDate).format('YYYY-MM-DD') === selectedDate;
    });
  }, [tasks, selectedDate]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      <View onLayout={handleCalendarLayout}>
        <Calendar
          key={`${colors.bgMain}-${isDark}`}
          current={selectedDate}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={markedDates}
          theme={{
            backgroundColor: colors.bgMain,
            calendarBackground: colors.bgMain,
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
            textDayFontWeight: '500',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 16,
            textMonthFontSize: 18,
            textDayHeaderFontSize: 14
          }}
          style={styles.calendar}
        />
      </View>
      
      {/* Custom Bottom Sheet */}
      <Animated.View 
        style={[
          styles.bottomSheet, 
          { backgroundColor: colors.bgCard, top: panY }
        ]}
      >
        <View {...panResponder.panHandlers}>
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: colors.textSecondary }]} />
          </View>

          <View style={[styles.taskListHeader, { borderBottomColor: colors.borderColor }]}>
            <Text style={[styles.taskListTitle, { color: colors.textPrimary }]}>
              Tasks for {dayjs(selectedDate).format('MMM D, YYYY')}
            </Text>
          </View>
        </View>

        {selectedTasks.length > 0 ? (
          <FlatList
            style={{ flex: 1 }}
            data={selectedTasks}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => <TaskRow task={item} hideDate={true} disableInlineEdit={true} onPress={() => handleTaskPress(item)} />}
            contentContainerStyle={styles.listContent}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={3}
            removeClippedSubviews={Platform.OS === 'ios'}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No tasks scheduled for this day.</Text>
          </View>
        )}
        
        <View style={{ marginBottom: 20 }}>
          <InlineAddTask sectionId={selectedDate} />
        </View>
      </Animated.View>

      <TaskDetailsModal 
        task={selectedTask}
        isVisible={isDetailsVisible}
        onClose={() => setDetailsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  calendar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  taskListHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  taskListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContent: {
    paddingVertical: 15,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  dragHandleContainer: {
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.5,
  }
});
