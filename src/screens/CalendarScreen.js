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
  Share,
  useWindowDimensions,
  TextInput
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Calendar } from 'react-native-calendars';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import Modal from 'react-native-modal';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

import { useTheme } from '../styles/ThemeContext';
import { useToast } from '../styles/ToastContext';
import TaskRow, { closeOpenSwipeableRow } from '../components/TaskRow';
import InlineAddTask from '../components/InlineAddTask';
import TaskDetailsModal from '../components/TaskDetailsModal';
import TaskQuickMenuModal from '../components/TaskQuickMenuModal';
import ConfirmModal from '../components/ConfirmModal';
import GoogleDrawer from '../components/calendar/GoogleDrawer';
import CreateBoardModal from '../components/CreateBoardModal';
import CalendarDayOptionsModal from '../components/calendar/CalendarDayOptionsModal';
import YearPickerModal from '../components/YearPickerModal';
import { updateTask, updateMultipleTasks, deleteTask, deleteMultipleTasks } from '../features/taskSlice';
import { setGoogleDrawerOpen, setThemeMode } from '../features/themeSlice';
import { addBoardAsync } from '../features/userSlice';
import { getBoardColor } from '../utils/boardColors';
import ScreenErrorBoundary from '../components/ScreenErrorBoundary';

const IconSearch = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="11" cy="11" r="8" />
    <Line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Svg>
);

const IconMoreHorizontal = ({ color = '#000', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="1.5" fill={color} />
    <Circle cx="19" cy="12" r="1.5" fill={color} />
    <Circle cx="5" cy="12" r="1.5" fill={color} />
  </Svg>
);

const IconChevronRight = ({ color = '#000', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18l6-6-6-6" />
  </Svg>
);

const IconCategoryGrid = ({ color = '#000', size = 14 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="7" height="7" rx="1.5" />
    <Rect x="14" y="3" width="7" height="7" rx="1.5" />
    <Rect x="14" y="14" width="7" height="7" rx="1.5" />
    <Rect x="3" y="14" width="7" height="7" rx="1.5" />
  </Svg>
);

const IconSubtasksLines = ({ color = '#888', size = 14 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="4" y1="6" x2="20" y2="6" />
    <Line x1="4" y1="12" x2="20" y2="12" />
    <Line x1="4" y1="18" x2="14" y2="18" />
  </Svg>
);

export default function CalendarScreen({ navigation }) {
  const { colors, isDark, mode } = useTheme();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast ? useToast() : { showToast: () => {} };
  const dispatch = useDispatch();

  const tasks = useSelector(state => state.taskReducer?.tasks || []);
  const boards = useSelector(state => state.userReducer?.boards || []);
  const jumpToTodayTrigger = useSelector(state => state.themeReducer?.jumpToTodayTrigger);
  const isGoogleDrawerOpen = useSelector(state => state.themeReducer?.isGoogleDrawerOpen || false);
  const isPremium = useSelector(state => state.entitlementReducer?.isPremium);

  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [calendarMonth, setCalendarMonth] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsVisible, setDetailsVisible] = useState(false);
  const [filterBoardId, setFilterBoardId] = useState(null); // null = all
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isInlineAddActive, setIsInlineAddActive] = useState(false);
  const [isYearPickerVisible, setIsYearPickerVisible] = useState(false);

  const handleSelectYear = (year) => {
    const currentMonthMoment = dayjs(calendarMonth);
    const newMonthStr = currentMonthMoment.set('year', year).format('YYYY-MM-DD');
    setCalendarMonth(newMonthStr);
    const newSelectedDate = dayjs(selectedDate).set('year', year).format('YYYY-MM-DD');
    setSelectedDate(newSelectedDate);
    setIsYearPickerVisible(false);
  };

  const handleToggleTheme = () => {
    const modes = ['light', 'dark', 'contrast'];
    let currentIndex = modes.indexOf(mode);
    if (currentIndex === -1) {
      currentIndex = isDark ? 1 : 0; 
    }
    const nextIndex = (currentIndex + 1) % modes.length;
    dispatch(setThemeMode(modes[nextIndex]));
  };

  const renderThemeIcon = () => {
    if (mode === 'contrast') {
      return (
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth="2">
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 2a10 10 0 0 0 0 20V2z" fill={colors.textPrimary} />
        </Svg>
      );
    }
    if (isDark) {
      return (
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill={`${colors.primary}33`} />
        </Svg>
      );
    }
    return (
      <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="12" cy="12" r="5" fill={`${colors.primary}33`} />
        <Line x1="12" y1="1" x2="12" y2="3" />
        <Line x1="12" y1="21" x2="12" y2="23" />
        <Line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <Line x1="1" y1="12" x2="3" y2="12" />
        <Line x1="21" y1="12" x2="23" y2="12" />
        <Line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <Line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </Svg>
    );
  };

  // Jump to today whenever header Today button is pressed
  useEffect(() => {
    if (jumpToTodayTrigger) {
      const todayStr = dayjs().format('YYYY-MM-DD');
      setSelectedDate(todayStr);
      setCalendarMonth(todayStr);
    }
  }, [jumpToTodayTrigger]);

  const todayStr = useMemo(() => dayjs().format('YYYY-MM-DD'), []);

  // Selection & Options State
  const [isDayOptionsVisible, setIsDayOptionsVisible] = useState(false);
  const [isCreateCategoryVisible, setCreateCategoryVisible] = useState(false);
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
  const [isQuickMenuVisible, setQuickMenuVisible] = useState(false);

  const handleTaskPress = useCallback((task) => {
    setSelectedTask(task);
    setDetailsVisible(true);
  }, []);

  const handleQuickMenuPress = useCallback((task) => {
    setSelectedTask(task);
    setQuickMenuVisible(true);
  }, []);

  const handleLongPressTask = useCallback((task) => {
    const taskId = task.id || task._id;
    setSelectionMode({
      isActive: true,
      selectedTaskIds: [taskId],
    });
  }, []);

  const toggleTaskSelection = useCallback((taskId) => {
    setSelectionMode(prev => {
      const isSelected = prev.selectedTaskIds.includes(taskId);
      const newSelected = isSelected
        ? prev.selectedTaskIds.filter(id => id !== taskId)
        : [...prev.selectedTaskIds, taskId];
      return {
        ...prev,
        selectedTaskIds: newSelected,
        isActive: newSelected.length > 0 ? true : false,
      };
    });
  }, []);

  const selectedTaskIdsSet = useMemo(() => new Set(selectionMode.selectedTaskIds), [selectionMode.selectedTaskIds]);

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
        dispatch(updateMultipleTasks({ taskIds: selectionMode.selectedTaskIds, changes: { completed: true } }));
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
        dispatch(deleteMultipleTasks({ taskIds: selectionMode.selectedTaskIds }));
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

  const handleOpenCreateCategory = () => {
    const boardLimit = isPremium ? 20 : 10;
    if ((boards || []).length >= boardLimit) {
      setConfirmConfig({
        isVisible: true,
        title: t('Limit Reached') || 'Limit Reached',
        message: `${t('You have reached the maximum number of boards')} (${boardLimit}).`,
        confirmText: t('OK'),
        hideCancel: true,
        onConfirm: () => setConfirmConfig(prev => ({ ...prev, isVisible: false }))
      });
      return;
    }
    setCreateCategoryVisible(true);
  };

  const handleCreateCategorySubmit = ({ name, type, color, repeatConfig, repeatDuration }) => {
    if (name && name.trim()) {
      const id = new Date().getTime().toString();
      dispatch(addBoardAsync({ id, name: name.trim(), type: type || 'standard', color, repeatConfig, repeatDuration }));
      if (showToast) showToast(t('Category created') || 'Category created');
    }
    setCreateCategoryVisible(false);
  };

  // Custom Day Component: date circle wraps number with solid accent when selected
  const renderCustomDay = useCallback(({ date, state, marking }) => {
    if (!date) return null;
    const dateStr = date.dateString;
    const isSelected = dateStr === selectedDate;
    const isToday = dateStr === todayStr;
    const isDisabled = state === 'disabled';
    const dayDots = marking?.dots || [];
    const visibleDots = dayDots.slice(0, 4);

    return (
      <TouchableOpacity
        testID={`calendar_day_${dateStr}`}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${dateStr}${isSelected ? ', selected' : ''}${isToday ? ', today' : ''}`}
        activeOpacity={0.7}
        onPress={() => {
          setSelectedDate(dateStr);
          setCalendarMonth(dateStr);
          setSelectionMode({ isActive: false, selectedTaskIds: [] });
        }}
        style={styles.dayCellContainer}
      >
        <View
          style={[
            styles.dayCircle,
            isSelected ? {
              backgroundColor: colors.primary || '#5D45DB',
            } : isToday ? {
              backgroundColor: isDark ? 'rgba(93, 69, 219, 0.28)' : 'rgba(93, 69, 219, 0.16)',
            } : null,
          ]}
        >
          <Text
            style={[
              styles.dayText,
              {
                color: isSelected
                  ? '#FFFFFF'
                  : isToday
                  ? (colors.primary || '#5D45DB')
                  : isDisabled
                  ? (colors.textSecondary || '#AAA')
                  : colors.textPrimary,
                fontWeight: isSelected || isToday ? '700' : '500',
              },
            ]}
          >
            {date.day}
          </Text>
        </View>

        {visibleDots.length > 0 && (
          <View style={styles.dotsRow}>
            {visibleDots.map((dot, idx) => (
              <View
                key={dot.key || idx}
                style={[
                  styles.boardDot, 
                  { backgroundColor: isSelected ? (colors.primary || '#5D45DB') : (dot.color || colors.primary) }
                ]}
              />
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedDate, todayStr, colors, isDark]);

  // Prepare marked dates with category-colored dots (cached for peak stress performance)
  const markedDates = useMemo(() => {
    const marks = {};
    if (!Array.isArray(tasks) || tasks.length === 0) return marks;

    const safeBoards = Array.isArray(boards) ? boards : [];
    const boardMap = new Map();
    const boardColorMap = new Map();
    safeBoards.forEach(b => {
      if (b) {
        const id = b.id || b._id;
        if (id) {
          boardMap.set(String(id), b);
          boardColorMap.set(String(id), getBoardColor(b, safeBoards));
        }
      }
    });

    tasks.forEach(task => {
      if (!task) return;
      let dateStr = task.dateString;
      if (!dateStr && task.completionDate) {
        try {
          const parsed = dayjs(task.completionDate);
          if (parsed.isValid()) dateStr = parsed.format('YYYY-MM-DD');
        } catch (e) {}
      }
      if (dateStr) {
        if (!marks[dateStr]) {
          marks[dateStr] = { tasks: [] };
        }
        marks[dateStr].tasks.push(task);
      }
    });

    const finalMarks = {};
    Object.keys(marks).forEach(dateStr => {
      const dayTasks = marks[dateStr].tasks;
      const uniqueBoardIds = Array.from(new Set(dayTasks.map(t => String(t?.boardId || 'main'))));
      const dots = uniqueBoardIds.map(bId => {
        let color = boardColorMap.get(bId);
        if (!color) {
          const boardObj = boardMap.get(bId) || { id: bId, name: bId === 'main' ? 'Main' : 'Category' };
          color = getBoardColor(boardObj, safeBoards);
          boardColorMap.set(bId, color);
        }
        return {
          key: `${bId}_${dateStr}`,
          color,
        };
      });

      finalMarks[dateStr] = {
        dots,
        marked: dots.length > 0,
      };
    });

    if (!finalMarks[selectedDate]) {
      finalMarks[selectedDate] = { dots: [] };
    }

    return finalMarks;
  }, [tasks, boards, selectedDate]);

  // Get tasks for selected date
  const selectedTasks = useMemo(() => {
    if (!Array.isArray(tasks)) return [];
    let filteredTasks = tasks.filter(task => {
      if (!task) return false;
      let d = task.dateString;
      if (!d && task.completionDate) {
        try {
          const parsed = dayjs(task.completionDate);
          if (parsed.isValid()) d = parsed.format('YYYY-MM-DD');
        } catch (e) {}
      }
      const matchesDate = d === selectedDate;
      const matchesBoard = !filterBoardId || String(task.boardId) === String(filterBoardId);
      const matchesSearch = !searchQuery || (task.taskname && String(task.taskname).toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesDate && matchesBoard && matchesSearch;
    });

    return filteredTasks.sort((a, b) => {
      if (!a || !b) return 0;
      if (sortConfig === 'priority') {
        const pValues = { high: 3, medium: 2, low: 1, none: 0 };
        const pA = pValues[a.priority?.toLowerCase()] || 0;
        const pB = pValues[b.priority?.toLowerCase()] || 0;
        if (pA !== pB) return pB - pA;
      }

      const hasTimeA = !!(a.time && String(a.time).trim() !== '');
      const hasTimeB = !!(b.time && String(b.time).trim() !== '');

      if (hasTimeA && !hasTimeB) return -1;
      if (!hasTimeA && hasTimeB) return 1;
      if (hasTimeA && hasTimeB) {
        const timeCompare = String(a.time || '').localeCompare(String(b.time || ''));
        if (timeCompare !== 0) return timeCompare;
      }

      return String(b.id || b._id || '').localeCompare(String(a.id || a._id || ''));
    });
  }, [tasks, selectedDate, filterBoardId, searchQuery, sortConfig]);

  const activeBoard = useMemo(() => {
    if (!filterBoardId) return null;
    return (boards || []).find(b => b && (String(b.id) === String(filterBoardId) || String(b._id) === String(filterBoardId)));
  }, [filterBoardId, boards]);

  const groupedTasks = useMemo(() => {
    if (!selectedTasks.length) return [];
    
    const safeBoards = Array.isArray(boards) ? boards : [];
    const groups = {};
    selectedTasks.forEach(task => {
      if (!task) return;
      const bId = String(task.boardId || 'main');
      if (!groups[bId]) {
        const boardObj = safeBoards.find(b => b && (String(b.id) === bId || String(b._id) === bId)) || { id: bId, name: bId === 'main' ? 'Main' : 'Category' };
        groups[bId] = {
          id: bId,
          title: boardObj.name === 'Main' ? (t('Main') || 'Main') : boardObj.name,
          color: getBoardColor(boardObj, safeBoards),
          data: []
        };
      }
      groups[bId].data.push(task);
    });

    return Object.values(groups);
  }, [selectedTasks, boards, t]);

  const formattedDayTitle = useMemo(() => {
    return dayjs(selectedDate).format('dddd, MMMM D');
  }, [selectedDate]);

  const formattedDaySubtitle = useMemo(() => {
    const isToday = selectedDate === todayStr;
    const isTomorrow = selectedDate === dayjs().add(1, 'day').format('YYYY-MM-DD');
    const prefix = isToday ? (t('Today') || 'Today') : isTomorrow ? (t('Tomorrow') || 'Tomorrow') : dayjs(selectedDate).format('MMMM D');
    const taskCountStr = selectedTasks.length === 1 
      ? `1 ${t('task') || 'task'}` 
      : `${selectedTasks.length} ${t('tasks') || 'tasks'}`;
    return `${prefix} · ${taskCountStr}`;
  }, [selectedDate, todayStr, selectedTasks.length, t]);

  const primaryAccent = colors.primary || '#5D45DB';

  return (
    <ScreenErrorBoundary screenName="CalendarScreen">
      <View style={[styles.container, { backgroundColor: colors.bgMain || (isDark ? '#141419' : '#FAF9F6') }]}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.mainScrollContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={closeOpenSwipeableRow}
        >
        {/* Screen Header */}
        <View style={styles.topHeaderRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
              {t('Calendar') || 'Calendar'}
            </Text>
            <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
              {t('Make room for what matters.') || 'Make room for what matters.'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleToggleTheme}
              style={[styles.headerIconCircle, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}
              accessibilityRole="button"
              accessibilityLabel="Toggle theme"
            >
              {renderThemeIcon()}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setIsSearchActive(!isSearchActive)}
              style={[styles.headerIconCircle, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}
              accessibilityRole="button"
              accessibilityLabel="Search tasks"
            >
              <IconSearch color={colors.textPrimary} size={18} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar when toggled */}
        {isSearchActive && (
          <View style={[styles.searchBarWrapper, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
            <IconSearch color={colors.textSecondary} size={16} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder={t('Search day tasks...') || 'Search day tasks...'}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Calendar Card (enclosed in clean white card matching Image 5) */}
        <View style={[styles.calendarCard, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
          <Calendar
            testID="task_calendar"
            key={`cal-${calendarMonth}-${colors.bgCard}-${isDark}-${i18n.language}`}
            current={calendarMonth}
            onDayPress={(day) => {
              setSelectedDate(day.dateString);
              setCalendarMonth(day.dateString);
              setSelectionMode({ isActive: false, selectedTaskIds: [] });
            }}
            onMonthChange={(month) => {
              setCalendarMonth(month.dateString);
            }}
            markingType={'multi-dot'}
            markedDates={markedDates}
            dayComponent={renderCustomDay}
            renderHeader={(date) => {
              let dateObj = dayjs(date ? (date.dateString || date.toString()) : calendarMonth);
              if (!dateObj.isValid()) {
                dateObj = dayjs(calendarMonth);
              }
              const monthYearStr = dateObj.format('MMMM YYYY');
              return (
                <TouchableOpacity
                  testID="calendar_month_year_header"
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Select year, current month ${monthYearStr}`}
                  activeOpacity={0.7}
                  style={styles.monthYearHeaderBtn}
                  onPress={() => setIsYearPickerVisible(true)}
                >
                  <Text style={[styles.monthYearHeaderText, { color: colors.textPrimary }]}>
                    {monthYearStr}
                  </Text>
                  <Text style={[styles.monthYearChevron, { color: primaryAccent }]}>▾</Text>
                </TouchableOpacity>
              );
            }}
            enableSwipeMonths={true}
            hideExtraDays={true}
            theme={{
              backgroundColor: colors.bgCard,
              calendarBackground: colors.bgCard,
              textSectionTitleColor: colors.textSecondary,
              selectedDayBackgroundColor: primaryAccent,
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: primaryAccent,
              dayTextColor: colors.textPrimary,
              textDisabledColor: colors.textSecondary ? `${colors.textSecondary}60` : '#AAA',
              dotColor: primaryAccent,
              selectedDotColor: '#FFFFFF',
              arrowColor: primaryAccent,
              monthTextColor: colors.textPrimary,
              indicatorColor: primaryAccent,
              textDayFontWeight: '600',
              textMonthFontWeight: '700',
              textDayFontSize: 15,
              textMonthFontSize: 17,
              textDayHeaderFontSize: 12,
              weekVerticalMargin: 0,
              'stylesheet.calendar.main': {
                week: {
                  marginVertical: 1,
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                },
              },
              'stylesheet.calendar.header': {
                header: {
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingLeft: 4,
                  paddingRight: 4,
                  marginTop: 0,
                  marginBottom: 6,
                  alignItems: 'center',
                  height: 38,
                },
                week: {
                  marginTop: 2,
                  marginBottom: 6,
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                },
              },
            }}
            style={styles.calendar}
          />
        </View>

        {/* Filter pill & Back to today row */}
        <View style={styles.calendarSubRow}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => dispatch(setGoogleDrawerOpen(true))}
            style={[styles.categoryPill, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}
          >
            <IconCategoryGrid color={activeBoard ? getBoardColor(activeBoard, boards) : primaryAccent} />
            <Text style={[styles.categoryPillText, { color: colors.textPrimary }]}>
              {activeBoard ? activeBoard.name : (t('All Categories') || 'All categories')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setSelectedDate(todayStr);
              setCalendarMonth(todayStr);
            }}
          >
            <Text style={[styles.backToTodayText, { color: primaryAccent }]}>
              {t('Back to today') || 'Back to today'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tasks List Card matching user picture */}
        <View style={[styles.dayTaskListCard, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
          {/* Header row: Tasks for Oct 26, 2026 ... */}
          <View style={[styles.taskListHeader, { borderBottomColor: colors.borderColor }]}>
            <Text style={[styles.taskListTitle, { color: colors.textPrimary }]}>
              {t('Tasks for')} {dayjs(selectedDate).format('MMM D, YYYY')}
            </Text>
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Day options"
              style={styles.ellipsisBtn}
              onPress={() => setIsDayOptionsVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.ellipsisText, { color: colors.textSecondary }]}>⋯</Text>
            </TouchableOpacity>
          </View>

          {/* Grouped by Category */}
          {groupedTasks.length > 0 ? (
            groupedTasks.map((group, groupIndex) => (
              <View key={group.id} style={styles.categorySectionGroup}>
                {/* Category Header: 🟠 DCFGH */}
                <View style={[styles.categorySectionHeader, { borderBottomColor: colors.borderColor }]}>
                  <View style={[styles.categoryHeaderDot, { backgroundColor: group.color }]} />
                  <Text style={[styles.categoryHeaderText, { color: colors.textSecondary }]}>
                    {group.title.toUpperCase()}
                  </Text>
                </View>

                {/* Tasks in Category */}
                {group.data.map((task, taskIndex) => {
                  const isLastTaskOverall =
                    groupIndex === groupedTasks.length - 1 &&
                    taskIndex === group.data.length - 1;
                  return (
                    <View
                      key={task.id || task._id}
                      style={[
                        styles.taskRowWrapper,
                        { borderBottomColor: colors.borderColor },
                        isLastTaskOverall && { borderBottomWidth: 0 }
                      ]}
                    >
                      <TaskRow
                        task={task}
                        hideUnderline={true}
                        hideDate={true}
                        hideBoardBadge={false}
                        disableInlineEdit={true}
                        testIDPrefix="calendar_"
                        isSelectionMode={selectionMode.isActive}
                        isSelected={selectedTaskIdsSet.has(task.id || task._id)}
                        onToggleSelect={toggleTaskSelection}
                        onLongPress={handleLongPressTask}
                        onPressSnooze={handleTaskPress}
                        onPressMore={handleQuickMenuPress}
                        onPress={handleTaskPress}
                      />
                    </View>
                  );
                })}
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('No tasks scheduled for this day.') || 'No tasks scheduled for this day.'}
              </Text>
            </View>
          )}

          {/* Bottom + Add task */}
          <View style={[styles.inlineAddWrapper, { borderTopColor: colors.borderColor }]}>
            <InlineAddTask
              sectionId={selectedDate}
              hideUnderline={true}
              onAddDetails={(task) => {
                setSelectedTask(task);
                setDetailsVisible(true);
              }}
            />
          </View>
        </View>
      </ScrollView>

      {/* Multi-Selection Action Bar */}
      {selectionMode.isActive && (
        <View style={[styles.actionBar, { backgroundColor: colors.bgCard, borderTopColor: colors.borderColor }]}>
          <Text style={[styles.actionBarText, { color: colors.textPrimary }]}>{selectionMode.selectedTaskIds.length} {t('Selected') || 'Selected'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionBarButtons} style={{ flex: 1, marginLeft: 10 }}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.actionBtn}>
              <Text style={{ color: primaryAccent, fontWeight: 'bold' }}>{t('All') || 'All'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShareSelected} style={styles.actionBtn}>
              <Text style={{ color: '#2196f3', fontWeight: 'bold' }}>{t('Share') || 'Share'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCompleteSelected} style={styles.actionBtn}>
              <Text style={{ color: primaryAccent, fontWeight: 'bold' }}>{t('Complete') || 'Complete'}</Text>
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

      {/* Task Details Modal */}
      <TaskDetailsModal
        task={selectedTask}
        isVisible={isDetailsVisible}
        onClose={() => setDetailsVisible(false)}
      />

      {/* Task Quick Menu Modal */}
      <TaskQuickMenuModal
        isVisible={isQuickMenuVisible}
        onClose={() => setQuickMenuVisible(false)}
        task={selectedTask}
        onEdit={(task) => {
          setSelectedTask(task);
          setDetailsVisible(true);
        }}
        onSnooze={(task) => {
          setSelectedTask(task);
          setDetailsVisible(true);
        }}
      />

      {/* Day Options Modal */}
      <CalendarDayOptionsModal
        isVisible={isDayOptionsVisible}
        onClose={() => setIsDayOptionsVisible(false)}
        dateFormatted={dayjs(selectedDate).format('dddd, MMMM D, YYYY')}
        onSortTime={() => setSortConfig('time')}
        onSortPriority={() => setSortConfig('priority')}
        onAddTask={() => setIsInlineAddActive(true)}
        onSelectTasks={() => {
          setSelectionMode({ isActive: true, selectedTaskIds: [] });
        }}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isVisible={confirmConfig.isVisible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        isDestructive={confirmConfig.isDestructive}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isVisible: false }))}
        onConfirm={confirmConfig.onConfirm}
      />

      {/* Google Navigation Drawer (Category switcher) */}
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
        onOpenCreateCategory={handleOpenCreateCategory}
        onPressSettings={() => {
          dispatch(setGoogleDrawerOpen(false));
          navigation.navigate('Settings');
        }}
      />

      {/* Create Category Modal */}
      <CreateBoardModal
        isVisible={isCreateCategoryVisible}
        onClose={() => setCreateCategoryVisible(false)}
        onSubmit={handleCreateCategorySubmit}
        colors={colors}
      />

      {/* Year Picker Modal (total 18 years from current year) */}
      <YearPickerModal
        isVisible={isYearPickerVisible}
        onClose={() => setIsYearPickerVisible(false)}
        currentYear={dayjs(calendarMonth).year()}
        minYear={Math.min(dayjs().year(), dayjs(calendarMonth).year())}
        maxYear={Math.max(dayjs().year() + 17, dayjs(calendarMonth).year())}
        onSelectYear={handleSelectYear}
        colors={colors}
      />
      </View>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  screenSubtitle: {
    fontSize: 13,
  },
  headerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  calendarCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  calendar: {
    borderRadius: 16,
  },
  monthYearHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  monthYearHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  monthYearChevron: {
    fontSize: 11,
    marginLeft: 5,
    fontWeight: '700',
  },
  dayCellContainer: {
    width: 36,
    height: 38,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 1,
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginTop: 2,
  },
  boardDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  calendarSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  backToTodayText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  dayTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  daySubtitle: {
    fontSize: 12,
  },
  optionsDotBtn: {
    padding: 6,
  },
  dayTaskListCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  taskListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  taskListTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  ellipsisBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ellipsisText: {
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  categorySectionGroup: {
    borderBottomWidth: 0,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
    borderBottomWidth: 1,
  },
  categoryHeaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  taskRowWrapper: {
    borderBottomWidth: 1,
  },
  inlineAddWrapper: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  emptyContainer: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  actionBarText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionBarButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
