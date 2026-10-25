import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  Text,
  Animated,
  PanResponder,
  Keyboard,
  Platform,
  TouchableOpacity,
  ScrollView,
  Share
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Calendar } from 'react-native-calendars';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import Modal from 'react-native-modal';

import { useTheme } from '../styles/ThemeContext';
import { useToast } from '../styles/ToastContext';
import TaskRow from '../components/TaskRow';
import InlineAddTask from '../components/InlineAddTask';
import TaskDetailsModal from '../components/TaskDetailsModal';
import ConfirmModal from '../components/ConfirmModal';
import GoogleDrawer from '../components/calendar/GoogleDrawer';
import { updateTask, deleteTask } from '../features/taskSlice';
import { setGoogleDrawerOpen } from '../features/themeSlice';

export default function CalendarScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast ? useToast() : { showToast: () => {} };
  const dispatch = useDispatch();

  const tasks = useSelector(state => state.taskReducer?.tasks || []);
  const boards = useSelector(state => state.userReducer?.boards || []);
  const jumpToTodayTrigger = useSelector(state => state.themeReducer?.jumpToTodayTrigger);
  const isGoogleDrawerOpen = useSelector(state => state.themeReducer?.isGoogleDrawerOpen || false);

  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [calendarMonth, setCalendarMonth] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsVisible, setDetailsVisible] = useState(false);

  // Jump to today whenever header Today button is pressed
  useEffect(() => {
    if (jumpToTodayTrigger) {
      const todayStr = dayjs().format('YYYY-MM-DD');
      setSelectedDate(todayStr);
      setCalendarMonth(todayStr);
    }
  }, [jumpToTodayTrigger]);

  // Selection & Options State
  const [sectionOptionsConfig, setSectionOptionsConfig] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    isVisible: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirm',
    isDestructive: false
  });
  const [selectionMode, setSelectionMode] = useState({ isActive: false, selectedTaskIds: [] });
  const [sortConfig, setSortConfig] = useState('time'); // 'time' or 'priority'

  // FIXED Bottom Sheet State: strictly constant height so it never adjusts with month size
  // 380px allows full 6-row months (like April 2028) to display without bottom sheet cutoff
  const FIXED_CALENDAR_HEIGHT = 380;
  const MIN_Y = 0; // Fully expanded (covers calendar)
  const COLLAPSED_Y = FIXED_CALENDAR_HEIGHT;

  const panY = useRef(new Animated.Value(COLLAPSED_Y)).current;
  const lastY = useRef(COLLAPSED_Y);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      Animated.timing(panY, {
        toValue: MIN_Y,
        duration: 250,
        useNativeDriver: false,
      }).start();
      lastY.current = MIN_Y;
    });

    return () => {
      keyboardDidShowListener.remove();
    };
  }, [panY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        panY.stopAnimation((value) => {
          lastY.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        let newY = lastY.current + gestureState.dy;
        if (newY < MIN_Y) newY = MIN_Y;
        if (newY > COLLAPSED_Y) newY = COLLAPSED_Y;
        panY.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentY = lastY.current + gestureState.dy;
        let targetY = COLLAPSED_Y;

        // Snap to nearest position
        const distToMin = Math.abs(currentY - MIN_Y);
        const distToMax = Math.abs(currentY - COLLAPSED_Y);

        if (distToMin < distToMax) {
          targetY = MIN_Y;
        } else {
          targetY = COLLAPSED_Y;
        }

        if (gestureState.vy < -0.5) targetY = MIN_Y;
        if (gestureState.vy > 0.5) targetY = COLLAPSED_Y;

        lastY.current = targetY;

        Animated.spring(panY, {
          toValue: targetY,
          useNativeDriver: false,
          bounciness: 4,
        }).start();
      }
    })
  ).current;

  const handleTaskPress = (task) => {
    setSelectedTask(task);
    setDetailsVisible(true);
  };

  // Selection Logic
  const toggleTaskSelection = (taskId) => {
    setSelectionMode(prev => {
      const isSelected = prev.selectedTaskIds.includes(taskId);
      return {
        ...prev,
        selectedTaskIds: isSelected
          ? prev.selectedTaskIds.filter(id => id !== taskId)
          : [...prev.selectedTaskIds, taskId]
      };
    });
  };

  const handleSelectAll = () => {
    const taskIds = selectedTasks.map(t => t.id || t._id);
    setSelectionMode(prev => ({ ...prev, selectedTaskIds: taskIds }));
  };

  const handleCompleteSelected = () => {
    setConfirmConfig({
      isVisible: true,
      title: t('Complete Tasks') || 'Complete Tasks',
      message: `${t('Are you sure you want to complete')} ${selectionMode.selectedTaskIds.length} ${t('tasks')}?`,
      confirmText: t('Complete') || 'Complete',
      isDestructive: false,
      onConfirm: () => {
        selectionMode.selectedTaskIds.forEach(id => {
          dispatch(updateTask({ taskId: id, completed: true }));
        });
        setSelectionMode({ isActive: false, selectedTaskIds: [] });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
        if (showToast) showToast(t('Tasks completed') || 'Tasks completed');
      }
    });
  };

  const handleDeleteSelected = () => {
    setConfirmConfig({
      isVisible: true,
      title: t('Delete Tasks') || 'Delete Tasks',
      message: `${t('Are you sure you want to delete')} ${selectionMode.selectedTaskIds.length} ${t('tasks')}?`,
      confirmText: t('Delete') || 'Delete',
      isDestructive: true,
      onConfirm: () => {
        selectionMode.selectedTaskIds.forEach(id => dispatch(deleteTask({ taskId: id })));
        setSelectionMode({ isActive: false, selectedTaskIds: [] });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
        if (showToast) showToast(t('Tasks deleted') || 'Tasks deleted');
      }
    });
  };

  const handleShareSelected = async () => {
    try {
      const selectedTasksObjects = selectedTasks.filter(t => selectionMode.selectedTaskIds.includes(t.id || t._id));
      const shareText = selectedTasksObjects.map(t => {
        const taskName = t.taskname;
        const taskDate = t.dateString || t.completionDate;
        const taskTime = t.time;
        const notes = t.description?.text ? t.description.text.replace(/<[^>]+>/g, '').trim() : '';
        const priority = t.priority && t.priority !== 'none' ? t.priority.charAt(0).toUpperCase() + t.priority.slice(1) : '';

        return `Task: ${taskName}\nDue: ${taskDate ? dayjs(taskDate).format('MMM D, YYYY') : 'Not set'}${taskTime ? ` at ${taskTime}` : ''}${priority ? `\nPriority: ${priority}` : ''}${notes ? `\n\nNotes:\n${notes}` : ''}`.trim();
      }).join('\n\n------------------------\n\n');

      await Share.share({ message: `Tasks:\n\n${shareText}` });
      setSelectionMode({ isActive: false, selectedTaskIds: [] });
    } catch (error) {
      console.log(error);
    }
  };

  const handleCompleteSection = () => {
    setConfirmConfig({
      isVisible: true,
      title: t('Complete All') || 'Complete All',
      message: t('Are you sure you want to complete all tasks for this day?') || 'Are you sure you want to complete all tasks for this day?',
      confirmText: t('Complete') || 'Complete',
      isDestructive: false,
      onConfirm: () => {
        selectedTasks.forEach(task => {
          if (!task.completed) {
            dispatch(updateTask({ taskId: task.id || task._id, completed: true }));
          }
        });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
      }
    });
  };

  const handleMoveForward = () => {
    setConfirmConfig({
      isVisible: true,
      title: t('Move Forward') || 'Move Forward',
      message: t('Are you sure you want to move all tasks to the next day?') || 'Are you sure you want to move all tasks to the next day?',
      confirmText: t('Move') || 'Move',
      isDestructive: false,
      onConfirm: () => {
        const nextDate = dayjs(selectedDate).add(1, 'day').format('YYYY-MM-DD');
        selectedTasks.forEach(task => {
          if (!task.completed) {
            dispatch(updateTask({ taskId: task.id || task._id, dateString: nextDate, completionDate: nextDate, completed: false }));
          }
        });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
      }
    });
  };

  const handleDeleteSection = () => {
    setConfirmConfig({
      isVisible: true,
      title: t('Delete All') || 'Delete All',
      message: t('Are you sure you want to delete all tasks for this day?') || 'Are you sure you want to delete all tasks for this day?',
      confirmText: t('Delete') || 'Delete',
      isDestructive: true,
      onConfirm: () => {
        selectedTasks.forEach(task => {
          dispatch(deleteTask({ taskId: task.id || task._id }));
        });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
      }
    });
  };

  // Prepare marked dates
  const markedDates = useMemo(() => {
    const marks = {};
    tasks.forEach(task => {
      const dateStr = task.dateString || (task.completionDate ? dayjs(task.completionDate).format('YYYY-MM-DD') : null);
      if (dateStr) {
        if (!marks[dateStr]) {
          marks[dateStr] = { tasks: [] };
        }
        marks[dateStr].tasks.push(task);
      }
    });

    const finalMarks = {};
    Object.keys(marks).forEach(dateStr => {
      const dayTasksList = marks[dateStr].tasks;
      const allCompleted = dayTasksList.length > 0 && dayTasksList.every(t => t.completed);
      const anyMissed = dayTasksList.some(t => !t.completed && dayjs(t.dateString || t.completionDate).isBefore(dayjs(), 'day'));
      const anyNotes = dayTasksList.some(t => !t.completed && t.description?.text && t.description.text.trim() !== '');

      let dotColor = colors.primary;
      if (allCompleted) dotColor = '#4caf50';
      else if (anyMissed) dotColor = '#f44336';
      else if (anyNotes) dotColor = '#ff9800';

      finalMarks[dateStr] = {
        marked: true,
        dotColor: dotColor,
        textColor: allCompleted ? colors.textSecondary : colors.textPrimary
      };
    });

    // Highlight the currently selected date
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
    const filteredTasks = tasks.filter(task => {
      const d = task.dateString || (task.completionDate ? dayjs(task.completionDate).format('YYYY-MM-DD') : '');
      return d === selectedDate;
    });

    return filteredTasks.sort((a, b) => {
      if (sortConfig === 'priority') {
        const pValues = { high: 3, medium: 2, low: 1, none: 0 };
        const pA = pValues[a.priority?.toLowerCase()] || 0;
        const pB = pValues[b.priority?.toLowerCase()] || 0;
        if (pA !== pB) return pB - pA;
      }

      const hasTimeA = !!(a.time && a.time.trim() !== '');
      const hasTimeB = !!(b.time && b.time.trim() !== '');

      if (hasTimeA && !hasTimeB) return -1;
      if (!hasTimeA && hasTimeB) return 1;
      if (hasTimeA && hasTimeB) {
        const timeCompare = a.time.localeCompare(b.time);
        if (timeCompare !== 0) return timeCompare;
      }

      return (b.id || b._id || '').localeCompare(a.id || a._id || '');
    });
  }, [tasks, selectedDate, sortConfig]);

  const groupedTasks = useMemo(() => {
    if (!selectedTasks.length) return [];
    if (boards.length < 2) return [{ title: '', data: selectedTasks }];

    const groups = {};
    groups['main'] = { title: 'Main', data: [] };

    selectedTasks.forEach(task => {
      const bId = task.boardId || 'main';
      if (!groups[bId]) {
        const boardName = boards.find(b => (b.id === bId || b._id === bId))?.name || 'Board';
        groups[bId] = { title: boardName, data: [] };
      }
      groups[bId].data.push(task);
    });

    return Object.values(groups).filter(g => g.data.length > 0);
  }, [selectedTasks, boards]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      <View style={styles.calendarContainer}>
        <Calendar
          testID="task_calendar"
          key={`cal-${calendarMonth}-${colors.bgMain}-${isDark}-${i18n.language}`}
          current={calendarMonth}
          onDayPress={(day) => {
            setSelectedDate(day.dateString);
            setCalendarMonth(day.dateString);
            setSelectionMode({ isActive: false, selectedTaskIds: [] });
          }}
          onMonthChange={(month) => {
            setCalendarMonth(month.dateString);
          }}
          markedDates={markedDates}
          enableSwipeMonths={true}
          hideExtraDays={true}
          theme={{
            backgroundColor: colors.bgMain,
            calendarBackground: colors.bgMain,
            textSectionTitleColor: colors.textSecondary,
            selectedDayBackgroundColor: colors.primary,
            selectedDayTextColor: colors.textInverse || '#ffffff',
            todayTextColor: colors.primary,
            dayTextColor: colors.textPrimary,
            textDisabledColor: colors.surfaceContainerHigh || '#888888',
            dotColor: colors.primary,
            selectedDotColor: colors.textInverse || '#ffffff',
            arrowColor: colors.primary,
            monthTextColor: colors.textPrimary,
            indicatorColor: colors.primary,
            textDayFontWeight: '500',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 15,
            textMonthFontSize: 17,
            textDayHeaderFontSize: 13,
            'stylesheet.calendar.header': {
              header: {
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingLeft: 10,
                paddingRight: 10,
                marginTop: 2,
                alignItems: 'center',
                height: 38,
              },
            },
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
              {t('Tasks for')} {dayjs(selectedDate).format('MMM D, YYYY')}
            </Text>
            {selectedTasks.length > 0 && (
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Task list options"
                style={styles.ellipsisBtn}
                onPress={() => setSectionOptionsConfig(true)}
              >
                <Text style={[styles.ellipsisText, { color: colors.textSecondary }]}>⋯</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {groupedTasks.length > 0 ? (
          <SectionList
            style={{ flex: 1 }}
            sections={groupedTasks}
            keyExtractor={(item) => (item.id || item._id).toString()}
            renderItem={({ item }) => (
              <TaskRow
                task={item}
                hideDate={true}
                disableInlineEdit={true}
                testIDPrefix="calendar_"
                onPress={() => handleTaskPress(item)}
                onPressMore={() => handleTaskPress(item)}
                isSelectionMode={selectionMode.isActive}
                isSelected={selectionMode.selectedTaskIds.includes(item.id || item._id)}
                onToggleSelect={() => toggleTaskSelection(item.id || item._id)}
              />
            )}
            renderSectionHeader={({ section: { title } }) => (
              title ? (
                <View style={[styles.sectionHeader, { backgroundColor: colors.bgCard }]}>
                  <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>{title}</Text>
                </View>
              ) : null
            )}
            contentContainerStyle={styles.listContent}
            initialNumToRender={10}
            stickySectionHeadersEnabled={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('No tasks scheduled for this day.') || 'No tasks scheduled for this day.'}
            </Text>
          </View>
        )}

        <View style={{ marginBottom: selectionMode.isActive ? 70 : 20 }}>
          <InlineAddTask
            sectionId={selectedDate}
            onAddDetails={(task) => {
              setSelectedTask(task);
              setDetailsVisible(true);
            }}
          />
        </View>
      </Animated.View>

      <TaskDetailsModal
        task={selectedTask}
        isVisible={isDetailsVisible}
        onClose={() => setDetailsVisible(false)}
      />

      {/* Options Modal */}
      <Modal
        isVisible={sectionOptionsConfig}
        onSwipeComplete={() => setSectionOptionsConfig(false)}
        swipeDirection={['down']}
        propagateSwipe={true}
        onBackdropPress={() => setSectionOptionsConfig(false)}
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <View style={[styles.optionsModalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.optionsModalDragHandle} />
          <Text style={[styles.optionsModalTitle, { color: colors.textPrimary }]}>
            {t('Options for')} {dayjs(selectedDate).format('MMM D, YYYY')}
          </Text>

          <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setSortConfig('time'); setSectionOptionsConfig(false); }}>
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Sort by Time') || 'Sort by Time'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setSortConfig('priority'); setSectionOptionsConfig(false); }}>
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Sort by Priority') || 'Sort by Priority'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => {
            setSelectionMode({ isActive: true, selectedTaskIds: [] });
            setSectionOptionsConfig(false);
          }}>
            <Text style={[styles.optionText, { color: colors.primary }]}>{t('Select Tasks') || 'Select Tasks'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setSectionOptionsConfig(false); setTimeout(() => handleCompleteSection(), 400); }}>
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Complete all') || 'Complete all'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setSectionOptionsConfig(false); setTimeout(() => handleMoveForward(), 400); }}>
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Move forward') || 'Move forward'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setSectionOptionsConfig(false); setTimeout(() => handleDeleteSection(), 400); }}>
            <Text style={{ color: '#f44336', fontSize: 16, fontWeight: 'bold' }}>{t('Delete all') || 'Delete all'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionBtn, { borderBottomWidth: 0 }]} onPress={() => setSectionOptionsConfig(false)}>
            <Text style={[styles.optionText, { color: colors.textSecondary }]}>{t('Cancel') || 'Cancel'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Multi-Selection Action Bar */}
      {selectionMode.isActive && (
        <View style={[styles.actionBar, { backgroundColor: colors.bgCard, borderTopColor: colors.borderColor }]}>
          <Text style={[styles.actionBarText, { color: colors.textPrimary }]}>{selectionMode.selectedTaskIds.length} {t('Selected') || 'Selected'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionBarButtons} style={{ flex: 1, marginLeft: 10 }}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.actionBtn}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('All') || 'All'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShareSelected} style={styles.actionBtn}>
              <Text style={{ color: '#2196f3', fontWeight: 'bold' }}>{t('Share') || 'Share'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCompleteSelected} style={styles.actionBtn}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('Complete') || 'Complete'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteSelected} style={styles.actionBtn}>
              <Text style={{ color: '#f44336', fontWeight: 'bold' }}>{t('Delete') || 'Delete'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectionMode({ isActive: false, selectedTaskIds: [] })} style={styles.actionBtn}>
              <Text style={{ color: colors.textSecondary, fontWeight: 'bold' }}>{t('Cancel') || 'Cancel'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      <ConfirmModal
        isVisible={confirmConfig.isVisible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        isDestructive={confirmConfig.isDestructive}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isVisible: false }))}
        onConfirm={confirmConfig.onConfirm}
      />

      {/* Google Navigation Drawer */}
      <GoogleDrawer
        isOpen={isGoogleDrawerOpen}
        onClose={() => dispatch(setGoogleDrawerOpen(false))}
        currentDate={selectedDate}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setCalendarMonth(date);
          dispatch(setGoogleDrawerOpen(false));
        }}
        onSelectView={(view) => {
          dispatch(setGoogleDrawerOpen(false));
          if (view === 'board') {
            navigation.navigate('Board');
          }
        }}
        boards={boards}
        tasks={tasks}
        colors={colors}
        isDark={isDark}
        isDesktop={false}
        onPressSettings={() => {
          dispatch(setGoogleDrawerOpen(false));
          navigation.navigate('Settings');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  calendarContainer: {
    height: 380,
    overflow: 'hidden',
  },
  calendar: {
    paddingBottom: 4,
  },
  taskListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  taskListTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  ellipsisBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ellipsisText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  listContent: {
    paddingVertical: 10,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
  },
  emptyText: {
    fontSize: 15,
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
    shadowRadius: 6,
    elevation: 6,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 0,
  },
  dragHandleContainer: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  optionsModalContent: {
    padding: 20,
    paddingBottom: 36,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: 'center',
  },
  optionsModalDragHandle: {
    width: 38,
    height: 4,
    backgroundColor: '#999',
    borderRadius: 2,
    marginBottom: 16,
    opacity: 0.5,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)'
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  optionsModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  optionBtn: {
    width: '100%',
    paddingVertical: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderTopWidth: 1,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  actionBarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionBarButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  }
});
