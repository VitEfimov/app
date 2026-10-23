import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Text, Animated, PanResponder, Keyboard, Platform, TouchableOpacity, ScrollView, useWindowDimensions, Dimensions } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { CalendarList } from 'react-native-calendars';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../styles/ThemeContext';
import { useToast } from '../styles/ToastContext';
import { setThemeMode } from '../features/themeSlice';
import { updateTask, deleteTask, addTask, batchCalendarSyncComplete } from '../features/taskSlice';
import { addBoard } from '../features/userSlice';
import { getBoardColor } from '../utils/boardColors';
import { checkCalendarPermissionsAsync, requestCalendarPermissionsAsync, syncAllTasksToCalendarAsync } from '../utils/calendarSync';

// Google Calendar Components
import GoogleTopBar from '../components/calendar/GoogleTopBar';
import GoogleDrawer from '../components/calendar/GoogleDrawer';
import GoogleFAB from '../components/calendar/GoogleFAB';
import QuickAddTaskModal from '../components/calendar/QuickAddTaskModal';
import { IconCheckCircle, IconClock, IconDotsVertical } from '../components/calendar/CalendarIcons';

// Modals
import TaskDetailsModal from '../components/TaskDetailsModal';
import TaskQuickMenuModal from '../components/TaskQuickMenuModal';
import SnoozeModal from '../components/SnoozeModal';
import YearPickerModal from '../components/YearPickerModal';
import CreateBoardModal from '../components/CreateBoardModal';
import ConfirmModal from '../components/ConfirmModal';

const PAST_SCROLL_RANGE = 24;
const FUTURE_SCROLL_RANGE = 36;

export default function CalendarScreen({ navigation }) {
  const { colors, mode, isDark } = useTheme();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();

  const { width: windowWidth } = useWindowDimensions();
  const calendarListRef = useRef(null);

  // Redux state
  const tasks = useSelector(state => state.taskReducer?.tasks || []);
  const boards = useSelector(state => state.userReducer?.boards || []);

  // Calendar State
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const initialDate = useMemo(() => selectedDate, []);
  const visibleMonthRef = useRef(dayjs(selectedDate).format('YYYY-MM'));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]); // Filtered categories

  // Modals state
  const [selectedTask, setSelectedTask] = useState(null);
  const [isQuickAddVisible, setIsQuickAddVisible] = useState(false);
  const [isDetailsVisible, setDetailsVisible] = useState(false);
  const [isQuickMenuVisible, setQuickMenuVisible] = useState(false);
  const [isSnoozeVisible, setSnoozeVisible] = useState(false);
  const [isYearPickerVisible, setYearPickerVisible] = useState(false);
  const [isCreateCategoryVisible, setCreateCategoryVisible] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ isVisible: false, title: '', message: '', onConfirm: null });

  // Custom Bottom Sheet Animation State
  const MIN_Y = 0; // Fully expanded (covers calendar)
  const maxYRef = useRef(355); // Default collapsed position below calendar
  const isInitialized = useRef(false);
  const panY = useRef(new Animated.Value(355)).current;
  const lastY = useRef(355);

  const handleCalendarLayout = useCallback((event) => {
    const { height } = event.nativeEvent.layout;
    if (height && Math.abs(maxYRef.current - height) > 5) {
      maxYRef.current = height;
      if (!isInitialized.current) {
        panY.setValue(height);
        lastY.current = height;
        isInitialized.current = true;
      }
    }
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
        if (newY > maxYRef.current) newY = maxYRef.current;
        panY.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentY = lastY.current + gestureState.dy;
        let targetY = maxYRef.current;
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
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    })
  ).current;

  // Month change sync
  const handleMonthChange = useCallback((monthObj) => {
    const newMonth = monthObj?.dateString 
      ? dayjs(monthObj.dateString).format('YYYY-MM') 
      : (monthObj?.year && monthObj?.month ? `${monthObj.year}-${String(monthObj.month).padStart(2, '0')}` : null);
    if (newMonth) visibleMonthRef.current = newMonth;
  }, []);

  // Category Toggle Handler
  const handleToggleCategory = (boardId) => {
    setSelectedCategoryIds(prev => {
      if (prev.length === 0) {
        const allIds = boards.map(b => b.id || b._id || 'main');
        return allIds.filter(id => id !== boardId);
      }
      if (prev.includes(boardId)) {
        return prev.filter(id => id !== boardId);
      } else {
        const next = [...prev, boardId];
        if (next.length === boards.length) return [];
        return next;
      }
    });
  };

  // Theme Toggle Handler
  const handleToggleTheme = () => {
    const modes = ['light', 'dark', 'contrast'];
    let currentIndex = modes.indexOf(mode);
    if (currentIndex === -1) currentIndex = isDark ? 1 : 0;
    const nextIndex = (currentIndex + 1) % modes.length;
    dispatch(setThemeMode(modes[nextIndex]));
  };

  // Task Completion Toggle
  const handleToggleComplete = (task) => {
    const newCompleted = !task.completed;
    dispatch(updateTask({ taskId: task.id || task._id, completed: newCompleted }));
    showToast(
      newCompleted ? (t('Task completed') || 'Task completed') : (t('Task marked incomplete') || 'Task marked incomplete'),
      t('Undo') || 'Undo',
      () => {
        dispatch(updateTask({ taskId: task.id || task._id, completed: !newCompleted }));
      }
    );
  };

  // Calendar Sync
  const handleSyncToCalendar = async () => {
    try {
      const hasPerm = await checkCalendarPermissionsAsync();
      if (!hasPerm) {
        const granted = await requestCalendarPermissionsAsync();
        if (!granted) {
          showToast(t('Calendar Permission Required') || 'Calendar Permission Required');
          return;
        }
      }
      const themeState = { calendarSyncEnabled: true };
      const { syncedCount, eventMap } = await syncAllTasksToCalendarAsync(tasks, themeState);
      if (eventMap && Object.keys(eventMap).length > 0) {
        dispatch(batchCalendarSyncComplete({ eventMap }));
      }
      showToast(`${syncedCount} ${t('tasks synced to your calendar.') || 'tasks synced to your calendar.'}`);
    } catch (e) {
      console.warn('Error syncing to calendar:', e);
    }
  };

  // Marked dates with category dots for the sliding calendar
  const markedDates = useMemo(() => {
    const marks = {};
    const boardColorMap = new Map();
    boards.forEach(b => {
      if (b && (b.id || b._id)) boardColorMap.set(b.id || b._id, getBoardColor(b, boards));
    });
    if (!boardColorMap.has('main')) boardColorMap.set('main', getBoardColor({ id: 'main', name: 'Main' }, boards));

    tasks.forEach(task => {
      const d = task.dateString || (typeof task.completionDate === 'string' ? task.completionDate.split('T')[0] : null);
      if (!d) return;
      if (!marks[d]) marks[d] = { dots: [] };
      
      const bId = task.boardId || 'main';
      const color = boardColorMap.get(bId) || '#4285F4';
      if (!marks[d].dots.some(dot => dot.color === color)) {
        marks[d].dots.push({ key: `${bId}_${d}`, color });
      }
    });

    const todayStr = dayjs().format('YYYY-MM-DD');
    if (!marks[selectedDate]) marks[selectedDate] = { dots: [] };
    if (!marks[todayStr]) marks[todayStr] = { dots: [] };

    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: colors.primary,
    };

    return marks;
  }, [tasks, boards, selectedDate, colors]);

  // TASKS JUST RELEVANT TO CHOSEN DATE (Strict date filter!)
  const dayTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task) return false;
      
      // Category filter
      if (selectedCategoryIds.length > 0) {
        const bId = task.boardId || 'main';
        if (!selectedCategoryIds.includes(bId)) return false;
      }

      // Date match: MUST be equal to chosen selectedDate
      const d = task.dateString || (typeof task.completionDate === 'string' ? task.completionDate.split('T')[0] : '');
      if (d !== selectedDate) return false;

      // Search query filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = task.taskname?.toLowerCase().includes(q);
        const descMatch = task.description?.text?.toLowerCase().includes(q);
        if (!nameMatch && !descMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      const hasTimeA = !!(a.time && a.time.trim() !== '');
      const hasTimeB = !!(b.time && b.time.trim() !== '');
      if (hasTimeA && !hasTimeB) return -1;
      if (!hasTimeA && hasTimeB) return 1;
      if (hasTimeA && hasTimeB) return a.time.localeCompare(b.time);
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [tasks, selectedDate, selectedCategoryIds, searchQuery]);

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.bgMain }]}>
      {/* Google Top Bar */}
      <GoogleTopBar
        currentDate={selectedDate}
        onPressMenu={() => setIsDrawerOpen(prev => !prev)}
        onPressToday={() => {
          const today = dayjs().format('YYYY-MM-DD');
          setSelectedDate(today);
          calendarListRef.current?.scrollToMonth(`${today.slice(0, 7)}-01`);
        }}
        onPressMonthPicker={() => setYearPickerVisible(true)}
        activeView="month"
        onSelectView={() => {}}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        colors={colors}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        onPressSettings={() => navigation && navigation.navigate('Settings')}
        isDesktop={false}
      />

      {/* Main Container */}
      <View style={styles.calendarContainer}>
        {/* Sliding Month Calendar */}
        <View onLayout={handleCalendarLayout} style={{ width: windowWidth, overflow: 'hidden' }}>
          <CalendarList
            ref={calendarListRef}
            testID="task_calendar"
            key={`${colors.bgMain}-${isDark}-${i18n.language}`}
            markingType={'multi-dot'}
            current={initialDate}
            firstDay={i18n.language === 'en' ? 0 : 1}
            horizontal={true}
            pagingEnabled={true}
            scrollEnabled={true}
            calendarWidth={windowWidth}
            calendarHeight={355}
            pastScrollRange={PAST_SCROLL_RANGE}
            futureScrollRange={FUTURE_SCROLL_RANGE}
            showScrollIndicator={false}
            onMonthChange={handleMonthChange}
            onDayPress={(day) => {
              setSelectedDate(day.dateString);
            }}
            markedDates={markedDates}
            theme={{
              backgroundColor: colors.bgMain,
              calendarBackground: colors.bgMain,
              textSectionTitleColor: colors.textSecondary,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: colors.textInverse || '#ffffff',
              todayTextColor: colors.primary,
              dayTextColor: colors.textPrimary,
              textDisabledColor: colors.surfaceContainerHigh || '#888',
              dotColor: colors.primary,
              selectedDotColor: colors.textInverse || '#ffffff',
              arrowColor: colors.primary,
              monthTextColor: colors.textPrimary,
              textDayFontWeight: '600',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '600',
            }}
          />
        </View>

        {/* Adjustable Collapsible Bottom Sheet with Tasks relevant JUST to chosen date */}
        <Animated.View 
          style={[
            styles.bottomSheet, 
            { backgroundColor: colors.bgCard, top: panY }
          ]}
        >
          {/* Drag Handle & Section Header */}
          <View {...panResponder.panHandlers}>
            <View style={styles.dragHandleContainer}>
              <View style={[styles.dragHandle, { backgroundColor: colors.textSecondary }]} />
            </View>

            <View style={[styles.sheetHeader, { borderBottomColor: colors.borderColor }]}>
              <View>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                  {dayjs(selectedDate).format('dddd, MMMM D, YYYY')}
                </Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                  {dayTasks.length} {dayTasks.length === 1 ? t('task') : t('tasks')}
                </Text>
              </View>
            </View>
          </View>

          {/* Task List for Chosen Date */}
          <ScrollView 
            style={styles.tasksScrollView}
            contentContainerStyle={styles.tasksScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {dayTasks.length > 0 ? (
              dayTasks.map(task => {
                const bId = task.boardId || 'main';
                const boardObj = boards.find(b => (b.id === bId || b._id === bId)) || { id: bId, name: 'Main' };
                const categoryColor = getBoardColor(boardObj, boards);
                const isCompleted = !!task.completed;

                return (
                  <TouchableOpacity
                    key={task.id || task._id}
                    activeOpacity={0.7}
                    style={[
                      styles.taskCard,
                      {
                        backgroundColor: isDark ? colors.surfaceContainer : colors.bgCard,
                        borderColor: colors.borderColor,
                        borderLeftColor: categoryColor,
                      }
                    ]}
                    onPress={() => {
                      setSelectedTask(task);
                      setDetailsVisible(true);
                    }}
                  >
                    <TouchableOpacity
                      style={styles.checkboxTouch}
                      onPress={() => handleToggleComplete(task)}
                    >
                      <IconCheckCircle checked={isCompleted} color={categoryColor} size={20} />
                    </TouchableOpacity>

                    <View style={styles.taskInfo}>
                      <Text
                        style={[
                          styles.taskTitle,
                          {
                            color: isCompleted ? colors.textSecondary : colors.textPrimary,
                            textDecorationLine: isCompleted ? 'line-through' : 'none',
                            opacity: isCompleted ? 0.6 : 1,
                          }
                        ]}
                        numberOfLines={2}
                      >
                        {task.taskname}
                      </Text>

                      <View style={styles.taskMetaRow}>
                        <View style={styles.timeBadge}>
                          <IconClock color={colors.textSecondary} size={12} />
                          <Text style={[styles.timeBadgeText, { color: colors.textSecondary }]}>
                            {task.time ? task.time : (t('All day') || 'All day')}
                          </Text>
                        </View>

                        <View style={styles.categoryDotPill}>
                          <View style={[styles.smallDot, { backgroundColor: categoryColor }]} />
                          <Text style={[styles.categoryPillText, { color: colors.textSecondary }]}>
                            {boardObj.name === 'Main' ? (t('Main') || 'Main') : boardObj.name}
                          </Text>
                        </View>

                        {task.priority && task.priority !== 'none' && (
                          <View style={[
                            styles.priorityChip,
                            {
                              backgroundColor: task.priority === 'high' 
                                ? (isDark ? 'rgba(234, 67, 53, 0.25)' : '#FCE8E6')
                                : (isDark ? 'rgba(251, 188, 4, 0.25)' : '#FEF7E0')
                            }
                          ]}>
                            <Text style={[
                              styles.priorityText,
                              { color: task.priority === 'high' ? '#D93025' : '#E37400' }
                            ]}>
                              {task.priority.toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.moreBtn}
                      onPress={() => {
                        setSelectedTask(task);
                        setQuickMenuVisible(true);
                      }}
                    >
                      <IconDotsVertical color={colors.textSecondary} size={16} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('No tasks scheduled for this day.') || 'No tasks scheduled for this day.'}
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.textTertiary || '#888' }]}>
                  {t('Tap the + button to add one.') || 'Tap the + button to add one.'}
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>

        {/* Google FAB */}
        <GoogleFAB
          onPress={() => setIsQuickAddVisible(true)}
          colors={colors}
          isDark={isDark}
        />
      </View>

      {/* Google Drawer (overlay on mobile) */}
      <GoogleDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentDate={selectedDate}
        onSelectDate={(date) => {
          setSelectedDate(date);
          calendarListRef.current?.scrollToMonth(`${date.slice(0, 7)}-01`);
        }}
        activeView="month"
        onSelectView={() => {}}
        boards={boards}
        selectedCategoryIds={selectedCategoryIds}
        onToggleCategory={handleToggleCategory}
        onOpenCreateCategory={(type) => {
          if (type === 'task') {
            setIsQuickAddVisible(true);
          } else {
            setCreateCategoryVisible(true);
          }
        }}
        onPressSettings={() => navigation && navigation.navigate('Settings')}
        onPressSync={handleSyncToCalendar}
        tasks={tasks}
        colors={colors}
        isDark={isDark}
        isDesktop={false}
      />

      {/* Quick Add Task Modal */}
      <QuickAddTaskModal
        isVisible={isQuickAddVisible}
        onClose={() => setIsQuickAddVisible(false)}
        initialDate={selectedDate}
        boards={boards}
        onOpenFullDetails={(draftTask) => {
          setSelectedTask(draftTask);
          setDetailsVisible(true);
        }}
        colors={colors}
        isDark={isDark}
      />

      {/* Refactored Google Tasks Plain-Text Edit Modal */}
      <TaskDetailsModal
        task={selectedTask}
        isVisible={isDetailsVisible}
        onClose={() => setDetailsVisible(false)}
      />

      {/* Quick Actions Menu */}
      <TaskQuickMenuModal
        isVisible={isQuickMenuVisible}
        onClose={() => setQuickMenuVisible(false)}
        task={selectedTask}
        colors={colors}
        isDark={isDark}
        onPressEdit={(t) => {
          setSelectedTask(t);
          setDetailsVisible(true);
        }}
        onPressSnooze={(t) => {
          setSelectedTask(t);
          setSnoozeVisible(true);
        }}
      />

      {/* Snooze Modal */}
      <SnoozeModal
        isVisible={isSnoozeVisible}
        onClose={() => setSnoozeVisible(false)}
        task={selectedTask}
        colors={colors}
        onOpenPremiumModal={() => {}}
      />

      {/* Year & Month Picker Modal */}
      <YearPickerModal
        isVisible={isYearPickerVisible}
        onClose={() => setYearPickerVisible(false)}
        currentYear={dayjs(selectedDate).year()}
        onSelectYear={(year) => {
          const month = dayjs(selectedDate).format('MM');
          const newDate = `${year}-${month}-01`;
          setSelectedDate(newDate);
          calendarListRef.current?.scrollToMonth(`${year}-${month}-01`);
          setYearPickerVisible(false);
        }}
        colors={colors}
      />

      {/* Create Category Modal */}
      <CreateBoardModal
        isVisible={isCreateCategoryVisible}
        onClose={() => setCreateCategoryVisible(false)}
        onSubmit={(boardData) => {
          dispatch(addBoard({ board: { id: Date.now().toString(), name: boardData.name || 'New Category', ...boardData } }));
          setCreateCategoryVisible(false);
          showToast(t('Category created') || 'Category created');
        }}
        colors={colors}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isVisible={confirmConfig.isVisible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isVisible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  calendarContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  tasksScrollView: {
    flex: 1,
  },
  tasksScrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 80,
    gap: 8,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  checkboxTouch: {
    paddingRight: 10,
    paddingVertical: 4,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  categoryDotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  smallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryPillText: {
    fontSize: 11,
  },
  priorityChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
  },
  moreBtn: {
    padding: 6,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});
