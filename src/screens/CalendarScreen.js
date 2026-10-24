import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Text, Animated, PanResponder, Keyboard, Platform, TouchableOpacity, ScrollView, useWindowDimensions, Dimensions, Easing } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Calendar } from 'react-native-calendars';
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
import { IconCheckCircle, IconClock, IconDotsVertical, IconChevronDown } from '../components/calendar/CalendarIcons';

// Modals
import TaskDetailsModal from '../components/TaskDetailsModal';
import TaskQuickMenuModal from '../components/TaskQuickMenuModal';
import SnoozeModal from '../components/SnoozeModal';
import YearPickerModal from '../components/YearPickerModal';
import CreateBoardModal from '../components/CreateBoardModal';
import ConfirmModal from '../components/ConfirmModal';

const safeFlushSync = (fn) => {
  if (Platform.OS === 'web') {
    try {
      const ReactDOM = require('react-dom');
      if (ReactDOM && typeof ReactDOM.flushSync === 'function') {
        ReactDOM.flushSync(fn);
        return;
      }
    } catch (e) {}
  }
  fn();
};

export default function CalendarScreen({ navigation }) {
  const { colors, mode, isDark } = useTheme();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();

  const { width: windowWidth } = useWindowDimensions();

  // Redux state
  const tasks = useSelector(state => state.taskReducer?.tasks || []);
  const boards = useSelector(state => state.userReducer?.boards || []);

  // Calendar State
  const todayDateStr = dayjs().format('YYYY-MM-DD');
  const [currentMonthStr, setCurrentMonthStr] = useState(dayjs().format('YYYY-MM-01'));
  const [selectedDate, setSelectedDate] = useState(todayDateStr);
  const visibleMonthRef = useRef(dayjs().format('YYYY-MM'));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]); // Filtered categories

  // 3-Month Animated Sliding Carousel State
  const initialWidth = windowWidth || Dimensions.get('window').width || 400;
  const [containerWidth, setContainerWidth] = useState(initialWidth);
  const containerWidthRef = useRef(initialWidth);
  useEffect(() => {
    containerWidthRef.current = containerWidth;
  }, [containerWidth]);

  const isAnimating = useRef(false);
  const panX = useRef(new Animated.Value(-initialWidth)).current;

  // Month strings for the 3 slots: [prev, current, next]
  const prevMonthStr = useMemo(() => dayjs(currentMonthStr).subtract(1, 'month').format('YYYY-MM-01'), [currentMonthStr]);
  const nextMonthStr = useMemo(() => dayjs(currentMonthStr).add(1, 'month').format('YYYY-MM-01'), [currentMonthStr]);

  // Smooth slide to prev/next month animation
  const slideToMonth = useCallback((direction) => {
    const w = containerWidthRef.current;
    if (isAnimating.current || w <= 0) return;
    isAnimating.current = true;
    const targetValue = direction === 'next' ? -2 * w : 0;

    Animated.timing(panX, {
      toValue: targetValue,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      safeFlushSync(() => {
        setCurrentMonthStr(prev => {
          const nextMonth = direction === 'next'
            ? dayjs(prev).add(1, 'month').format('YYYY-MM-01')
            : dayjs(prev).subtract(1, 'month').format('YYYY-MM-01');
          const newMonthPrefix = nextMonth.slice(0, 7);
          visibleMonthRef.current = newMonthPrefix;

          const today = dayjs().format('YYYY-MM-DD');
          if (today.startsWith(newMonthPrefix)) {
            setSelectedDate(today);
          } else {
            // FOCUS JUST ON TODAY DATE: remove focus from other months!
            setSelectedDate(null);
          }
          return nextMonth;
        });
      });
      panX.setValue(-w);
      isAnimating.current = false;
    });
  }, [panX]);

  // Calendar PanResponder for smooth animated swipe gestures
  const calendarPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        panX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        if (isAnimating.current) return;
        panX.setValue(-containerWidthRef.current + gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isAnimating.current) return;
        const w = containerWidthRef.current;
        const threshold = w * 0.18;
        const isFastSwipeLeft = gestureState.vx < -0.3;
        const isFastSwipeRight = gestureState.vx > 0.3;

        if (gestureState.dx < -threshold || isFastSwipeLeft) {
          slideToMonth('next');
        } else if (gestureState.dx > threshold || isFastSwipeRight) {
          slideToMonth('prev');
        } else {
          Animated.spring(panX, {
            toValue: -w,
            bounciness: 0,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (isAnimating.current) return;
        Animated.spring(panX, {
          toValue: -containerWidthRef.current,
          bounciness: 0,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

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
    const { height, width } = event.nativeEvent.layout;
    if (width && width > 0 && Math.abs(containerWidthRef.current - width) > 1) {
      containerWidthRef.current = width;
      setContainerWidth(width);
      if (!isAnimating.current) {
        panX.setValue(-width);
      }
    }
    if (height && Math.abs(maxYRef.current - height) > 5) {
      const wasCollapsed = Math.abs(lastY.current - maxYRef.current) < 20;
      maxYRef.current = height;
      if (!isInitialized.current || wasCollapsed) {
        panY.setValue(height);
        lastY.current = height;
        isInitialized.current = true;
      }
    }
  }, [panY, panX]);

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

    // ONLY focus today date (solid circle) when today is in the active month or selected
    if (todayStr.startsWith(currentMonthStr.slice(0, 7)) || selectedDate === todayStr) {
      if (!marks[todayStr]) marks[todayStr] = { dots: [] };
      marks[todayStr] = {
        ...marks[todayStr],
        selected: true,
        selectedColor: colors.primary,
      };
    }

    // If user explicitly clicked another date in this month, highlight it
    if (selectedDate && selectedDate !== todayStr && selectedDate.startsWith(currentMonthStr.slice(0, 7))) {
      if (!marks[selectedDate]) marks[selectedDate] = { dots: [] };
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: isDark ? 'rgba(66, 133, 244, 0.45)' : 'rgba(66, 133, 244, 0.25)',
      };
    }

    return marks;
  }, [tasks, boards, selectedDate, currentMonthStr, colors, isDark]);

  // TASKS JUST RELEVANT TO CHOSEN DATE (Strict date filter!)
  const dayTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task) return false;
      
      // Category filter
      if (selectedCategoryIds.length > 0) {
        const bId = task.boardId || 'main';
        if (!selectedCategoryIds.includes(bId)) return false;
      }

      // Date match: MUST be equal to chosen selectedDate, or match visible month if no date is focused
      const d = task.dateString || (typeof task.completionDate === 'string' ? task.completionDate.split('T')[0] : '');
      if (selectedDate) {
        if (d !== selectedDate) return false;
      } else {
        if (!d.startsWith(currentMonthStr.slice(0, 7))) return false;
      }

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
  }, [tasks, selectedDate, currentMonthStr, selectedCategoryIds, searchQuery]);

  // Memoized calendar theme
  const calendarTheme = useMemo(() => ({
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
  }), [colors]);

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.bgMain }]}>
      {/* Google Top Bar */}
      <GoogleTopBar
        currentDate={currentMonthStr}
        onPressMenu={() => setIsDrawerOpen(prev => !prev)}
        onPressToday={() => {
          const today = dayjs().format('YYYY-MM-DD');
          const todayMonth = dayjs().format('YYYY-MM-01');
          setCurrentMonthStr(todayMonth);
          setSelectedDate(today);
          visibleMonthRef.current = today.slice(0, 7);
          panX.setValue(-containerWidthRef.current);
        }}
        onPressPrevMonth={() => slideToMonth('prev')}
        onPressNextMonth={() => slideToMonth('next')}
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
        {/* Sliding Month Calendar Carousel */}
        <View 
          onLayout={handleCalendarLayout} 
          style={styles.calendarCarouselWrapper}
          {...calendarPanResponder.panHandlers}
        >
          <Animated.View
            style={[
              styles.calendarCarouselTrack,
              {
                width: containerWidth * 3,
                transform: [{ translateX: panX }],
              }
            ]}
          >
            {/* Slot 0: Previous Month */}
            <View style={{ width: containerWidth }}>
              <Calendar
                key={`prev-${colors.bgMain}-${isDark}-${prevMonthStr}-${i18n.language}`}
                markingType={'multi-dot'}
                current={prevMonthStr}
                firstDay={i18n.language === 'en' ? 0 : 1}
                enableSwipeMonths={false}
                hideArrows={false}
                showSixWeeks={false}
                hideExtraDays={true}
                onPressArrowLeft={() => slideToMonth('prev')}
                onPressArrowRight={() => slideToMonth('next')}
                renderHeader={() => (
                  <View style={styles.calendarHeaderTouchable}>
                    <Text style={[styles.calendarMonthTitle, { color: colors.textPrimary }]}>
                      {dayjs(prevMonthStr).format('MMMM YYYY')}
                    </Text>
                  </View>
                )}
                markedDates={markedDates}
                theme={calendarTheme}
                style={{ backgroundColor: colors.bgMain }}
              />
            </View>

            {/* Slot 1: Current Active Month */}
            <View style={{ width: containerWidth }}>
              <Calendar
                testID="task_calendar"
                key={`curr-${colors.bgMain}-${isDark}-${currentMonthStr}-${i18n.language}`}
                markingType={'multi-dot'}
                current={currentMonthStr}
                firstDay={i18n.language === 'en' ? 0 : 1}
                enableSwipeMonths={false}
                hideArrows={false}
                showSixWeeks={false}
                hideExtraDays={true}
                onPressArrowLeft={() => slideToMonth('prev')}
                onPressArrowRight={() => slideToMonth('next')}
                renderHeader={() => (
                  <TouchableOpacity
                    accessible={true}
                    accessibilityLabel="Select month and year"
                    accessibilityRole="button"
                    onPress={() => setYearPickerVisible(true)}
                    style={styles.calendarHeaderTouchable}
                  >
                    <Text style={[styles.calendarMonthTitle, { color: colors.textPrimary }]}>
                      {dayjs(currentMonthStr).format('MMMM YYYY')}
                    </Text>
                  </TouchableOpacity>
                )}
                onDayPress={(day) => {
                  const pressedMonth = day.dateString.slice(0, 7);
                  const activeMonth = currentMonthStr.slice(0, 7);
                  if (pressedMonth > activeMonth) {
                    slideToMonth('next');
                  } else if (pressedMonth < activeMonth) {
                    slideToMonth('prev');
                  } else {
                    setSelectedDate(day.dateString);
                  }
                }}
                markedDates={markedDates}
                theme={calendarTheme}
                style={{ backgroundColor: colors.bgMain }}
              />
            </View>

            {/* Slot 2: Next Month */}
            <View style={{ width: containerWidth }}>
              <Calendar
                key={`next-${colors.bgMain}-${isDark}-${nextMonthStr}-${i18n.language}`}
                markingType={'multi-dot'}
                current={nextMonthStr}
                firstDay={i18n.language === 'en' ? 0 : 1}
                enableSwipeMonths={false}
                hideArrows={false}
                showSixWeeks={false}
                hideExtraDays={true}
                onPressArrowLeft={() => slideToMonth('prev')}
                onPressArrowRight={() => slideToMonth('next')}
                renderHeader={() => (
                  <View style={styles.calendarHeaderTouchable}>
                    <Text style={[styles.calendarMonthTitle, { color: colors.textPrimary }]}>
                      {dayjs(nextMonthStr).format('MMMM YYYY')}
                    </Text>
                  </View>
                )}
                markedDates={markedDates}
                theme={calendarTheme}
                style={{ backgroundColor: colors.bgMain }}
              />
            </View>
          </Animated.View>
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
                  {selectedDate 
                    ? dayjs(selectedDate).format('dddd, MMMM D, YYYY') 
                    : dayjs(currentMonthStr).format('MMMM YYYY')}
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
                  {selectedDate 
                    ? (t('No tasks scheduled for this day.') || 'No tasks scheduled for this day.')
                    : (t('No tasks scheduled for this month.') || 'No tasks scheduled for this month.')}
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
        currentDate={selectedDate || currentMonthStr}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setCurrentMonthStr(dayjs(date).format('YYYY-MM-01'));
          visibleMonthRef.current = date.slice(0, 7);
          panX.setValue(-containerWidthRef.current);
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
        initialDate={selectedDate || (dayjs().format('YYYY-MM-DD').startsWith(currentMonthStr.slice(0, 7)) ? dayjs().format('YYYY-MM-DD') : `${currentMonthStr.slice(0, 7)}-01`)}
        boards={boards}
        onTaskCreated={(date) => {
          if (date) {
            setSelectedDate(date);
            setCurrentMonthStr(dayjs(date).format('YYYY-MM-01'));
            visibleMonthRef.current = date.slice(0, 7);
            panX.setValue(-containerWidthRef.current);
          }
        }}
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
        currentYear={dayjs(currentMonthStr).year()}
        onSelectYear={(year) => {
          const month = dayjs(currentMonthStr).format('MM');
          const newMonth = `${year}-${month}-01`;
          setCurrentMonthStr(newMonth);
          const today = dayjs().format('YYYY-MM-DD');
          if (today.startsWith(`${year}-${month}`)) {
            setSelectedDate(today);
          } else {
            setSelectedDate(null);
          }
          panX.setValue(-containerWidthRef.current);
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
  calendarCarouselWrapper: {
    width: '100%',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      userSelect: 'none',
      cursor: 'grab',
    } : {}),
  },
  calendarCarouselTrack: {
    flexDirection: 'row',
  },
  calendarHeaderTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  calendarMonthTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
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
