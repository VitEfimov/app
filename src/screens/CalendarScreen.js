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
import TaskRow from '../components/TaskRow';
import InlineAddTask from '../components/InlineAddTask';
import TaskDetailsModal from '../components/TaskDetailsModal';
import ConfirmModal from '../components/ConfirmModal';
import GoogleDrawer from '../components/calendar/GoogleDrawer';
import CreateBoardModal from '../components/CreateBoardModal';
import CalendarDayOptionsModal from '../components/calendar/CalendarDayOptionsModal';
import { updateTask, deleteTask } from '../features/taskSlice';
import { setGoogleDrawerOpen } from '../features/themeSlice';
import { addBoardAsync } from '../features/userSlice';
import { getBoardColor } from '../utils/boardColors';

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
  const [filterBoardId, setFilterBoardId] = useState(null); // null = all
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isInlineAddActive, setIsInlineAddActive] = useState(false);

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

  const handleTaskPress = (task) => {
    setSelectedTask(task);
    setDetailsVisible(true);
  };

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

  // Prepare marked dates with category-colored dots
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
      const dayTasks = marks[dateStr].tasks;
      const uniqueBoardIds = Array.from(new Set(dayTasks.map(t => t.boardId || 'main')));
      const dots = uniqueBoardIds.map(bId => {
        const boardObj = boards.find(b => b && (b.id === bId || b._id === bId)) || { id: bId, name: bId === 'main' ? 'Main' : 'Category' };
        return {
          key: `${bId}_${dateStr}`,
          color: getBoardColor(boardObj, boards),
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
    let filteredTasks = tasks.filter(task => {
      const d = task.dateString || (task.completionDate ? dayjs(task.completionDate).format('YYYY-MM-DD') : '');
      const matchesDate = d === selectedDate;
      const matchesBoard = !filterBoardId || task.boardId === filterBoardId;
      const matchesSearch = !searchQuery || (task.taskname && task.taskname.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesDate && matchesBoard && matchesSearch;
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
  }, [tasks, selectedDate, filterBoardId, searchQuery, sortConfig]);

  const activeBoard = useMemo(() => {
    if (!filterBoardId) return null;
    return boards.find(b => b.id === filterBoardId || b._id === filterBoardId);
  }, [filterBoardId, boards]);

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
    <View style={[styles.container, { backgroundColor: colors.bgMain || (isDark ? '#141419' : '#FAF9F6') }]}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.mainScrollContent}
        keyboardShouldPersistTaps="handled"
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

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setIsSearchActive(!isSearchActive)}
            style={[styles.headerIconCircle, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}
          >
            <IconSearch color={colors.textPrimary} size={18} />
          </TouchableOpacity>
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

        {/* Day Header */}
        <View style={styles.dayHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dayTitle, { color: colors.textPrimary }]}>
              {formattedDayTitle}
            </Text>
            <Text style={[styles.daySubtitle, { color: colors.textSecondary }]}>
              {formattedDaySubtitle}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsDayOptionsVisible(true)}
            style={styles.optionsDotBtn}
          >
            <IconMoreHorizontal color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Tasks List */}
        {selectedTasks.length > 0 ? (
          <View style={styles.tasksListContainer}>
            {selectedTasks.map(task => {
              const taskBoard = boards.find(b => (b.id === task.boardId || b._id === task.boardId)) || { name: 'Main' };
              const boardColor = getBoardColor(taskBoard, boards);
              const isSelected = selectionMode.selectedTaskIds.includes(task.id || task._id);

              return (
                <TouchableOpacity
                  key={task.id || task._id}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (selectionMode.isActive) {
                      toggleTaskSelection(task.id || task._id);
                    } else {
                      handleTaskPress(task);
                    }
                  }}
                  style={[
                    styles.taskCard,
                    {
                      backgroundColor: colors.bgCard,
                      borderColor: isSelected ? primaryAccent : (colors.borderColor || '#ECECEF'),
                    }
                  ]}
                >
                  {/* Round Checkbox */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      dispatch(updateTask({ taskId: task.id || task._id, completed: !task.completed }));
                    }}
                    style={[
                      styles.taskCheckbox,
                      {
                        borderColor: task.completed ? primaryAccent : (colors.textSecondary || '#BBB'),
                        backgroundColor: task.completed ? primaryAccent : 'transparent',
                      }
                    ]}
                  >
                    {task.completed && (
                      <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M20 6L9 17l-5-5" />
                      </Svg>
                    )}
                  </TouchableOpacity>

                  {/* Task details */}
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <Text 
                      style={[
                        styles.taskName, 
                        { 
                          color: task.completed ? colors.textSecondary : colors.textPrimary,
                          textDecorationLine: task.completed ? 'line-through' : 'none',
                        }
                      ]}
                      numberOfLines={1}
                    >
                      {task.taskname}
                    </Text>

                    {/* Metadata Sub-row */}
                    <View style={styles.taskMetaRow}>
                      <View style={[styles.boardDotSmall, { backgroundColor: boardColor }]} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        {taskBoard.name}
                      </Text>
                      <Text style={[styles.metaText, { color: colors.textSecondary, marginHorizontal: 4 }]}>
                        •
                      </Text>
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        {task.time || t('No time') || 'No time'}
                      </Text>
                      {task.subtasks && task.subtasks.length > 0 && (
                        <View style={{ marginLeft: 6 }}>
                          <IconSubtasksLines color={colors.textSecondary} size={12} />
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Right Chevron */}
                  <IconChevronRight color={colors.textSecondary} size={16} />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyBox, { borderColor: colors.borderColor }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('No tasks scheduled for this day.') || 'No tasks scheduled for this day.'}
            </Text>
          </View>
        )}

        {/* Inline Add Task when opened */}
        {isInlineAddActive && (
          <View style={{ marginTop: 10 }}>
            <InlineAddTask
              sectionId={selectedDate}
              onAddDetails={(task) => {
                setSelectedTask(task);
                setDetailsVisible(true);
                setIsInlineAddActive(false);
              }}
            />
          </View>
        )}

        {/* + Add task for this day Button (Light lavender pill matching Image 5) */}
        {!isInlineAddActive && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsInlineAddActive(true)}
            style={[
              styles.addTaskDayBtn,
              { backgroundColor: isDark ? 'rgba(93, 69, 219, 0.22)' : 'rgba(93, 69, 219, 0.10)' }
            ]}
          >
            <Text style={[styles.addTaskDayText, { color: primaryAccent }]}>
              + {t('Add task for this day') || 'Add task for this day'}
            </Text>
          </TouchableOpacity>
        )}
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

      {/* Day Options Modal */}
      <CalendarDayOptionsModal
        isVisible={isDayOptionsVisible}
        onClose={() => setIsDayOptionsVisible(false)}
        dateFormatted={dayjs(selectedDate).format('dddd, MMMM D, YYYY')}
        onSortTime={() => setSortConfig('time')}
        onSortPriority={() => setSortConfig('priority')}
        onAddTask={() => setIsInlineAddActive(true)}
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
        onOpenCreateCategory={() => setCreateCategoryVisible(true)}
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
    </View>
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
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  calendar: {
    borderRadius: 16,
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
    marginBottom: 20,
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
  tasksListContainer: {
    gap: 8,
    marginBottom: 14,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  taskCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boardDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  metaText: {
    fontSize: 12,
  },
  emptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 13,
  },
  addTaskDayBtn: {
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTaskDayText: {
    fontSize: 14,
    fontWeight: '700',
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
