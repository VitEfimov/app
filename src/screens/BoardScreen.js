import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform, Share, TextInput, LayoutAnimation, UIManager } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme } from '../styles/ThemeContext';
import { useToast } from '../styles/ToastContext';
import TaskRow, { closeOpenSwipeableRow } from '../components/TaskRow';
import TaskDetailsModal from '../components/TaskDetailsModal';
import TaskQuickMenuModal from '../components/TaskQuickMenuModal';
import SnoozeModal from '../components/SnoozeModal';
import PremiumModal from '../components/PremiumModal';
import PromptModal from '../components/PromptModal';
import ConfirmModal from '../components/ConfirmModal';
import MoveBoardModal from '../components/MoveBoardModal';
import CreateBoardModal from '../components/CreateBoardModal';
import InlineAddTask from '../components/InlineAddTask';
import AutoManageSettings from '../components/AutoManageSettings';
import Modal from 'react-native-modal';
import getFilters, { isTaskToday, isTaskMissed, getTaskDateStr, isTaskUpcoming, isTaskOnBoard, getDateThresholds, classifyTaskDate, compareTasks, PRIORITY_SCORES } from '../utils/filters';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { updateTask, updateMultipleTasks, deleteTask, deleteMultipleTasks, addTask, addMultipleTasks, deleteTasksByBoard, processAutoManageTasks, purgeOrphanedTasksThunk } from '../features/taskSlice';
import { addBoardAsync, renameBoardAsync, updateBoardColorAsync, deleteBoardAsync, setActiveBoardId } from '../features/userSlice';
import { setBoardsCollapsed, setGoogleDrawerOpen, setThemeMode } from '../features/themeSlice';
import GoogleDrawer from '../components/calendar/GoogleDrawer';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { getBoardColor, BOARD_COLORS } from '../utils/boardColors';
import * as FileSystem from 'expo-file-system';
import { shareTaskAsync } from '../../modules/expo-task-alarm';
import ScreenErrorBoundary from '../components/ScreenErrorBoundary';

let RNShare;
if (Platform.OS !== 'web') {
  RNShare = require('react-native-share').default;
}

dayjs.extend(isSameOrBefore);

const IconChevronDown = ({ color, isCollapsed }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '0deg' }] }}>
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

const IconMoreHorizontal = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="1.5" fill={color} />
    <Circle cx="19" cy="12" r="1.5" fill={color} />
    <Circle cx="5" cy="12" r="1.5" fill={color} />
  </Svg>
);

const IconSquare = ({ color, size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </Svg>
);

const IconCheckSquare = ({ color, size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <Path d="M9 12l2 2 4-4" />
  </Svg>
);

const IconMinusSquare = ({ color, size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <Path d="M8 12h8" />
  </Svg>
);

const SectionHeader = React.memo(function SectionHeader({
  section,
  isCollapsed,
  onToggleSection,
  onMenuPress,
  isSelectionActive,
  isAllSectionSelected,
  isPartiallySelected,
  onToggleSelectSection,
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.sectionHeader, { backgroundColor: colors.bgMain, borderBottomColor: `${section.color}33` }]}>
      <TouchableOpacity 
        accessible={true} accessibilityRole="button" accessibilityLabel={`${section.title} section, ${section.count} tasks`} accessibilityState={{ expanded: !isCollapsed }}
        style={styles.sectionHeaderLeft} onPress={() => onToggleSection(section.id)}
      >
        <Text testID={`section_title_${section.id}`} style={[styles.sectionTitle, { color: colors.textPrimary, marginLeft: 0 }]}>{section.title}</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.badge, { backgroundColor: `${section.color}20` }]}
        onPress={() => onToggleSection(section.id)}
      >
        <Text style={[styles.badgeText, { color: section.color }]}>{section.count}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        accessible={true} accessibilityRole="button" accessibilityLabel={`Toggle ${section.title} section`}
        onPress={() => onToggleSection(section.id)} style={{ padding: 5, marginLeft: 10 }}
      >
        <IconChevronDown color={isCollapsed ? section.color : colors.textSecondary} isCollapsed={isCollapsed} />
      </TouchableOpacity>

      {isSelectionActive ? (
        <TouchableOpacity
          testID={`section_select_all_${section.id}`}
          accessible={true}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isAllSectionSelected }}
          accessibilityLabel={`Select all tasks in ${section.title}`}
          style={styles.sectionCheckboxBtn}
          onPress={() => onToggleSelectSection(section)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isAllSectionSelected ? (
            <IconCheckSquare color={colors.primary} size={20} />
          ) : isPartiallySelected ? (
            <IconMinusSquare color={colors.primary} size={20} />
          ) : (
            <IconSquare color={colors.textSecondary} size={20} />
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          testID={`section_menu_${section.id}`}
          accessible={true} accessibilityRole="button" accessibilityLabel={`Options for ${section.title} section`}
          style={styles.ellipsisBtn} 
          onPress={() => onMenuPress(section)}
        >
          <IconMoreHorizontal color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
});

export default function BoardScreen({ route, navigation }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeAddSectionId, setActiveAddSectionId] = useState(null);
  
  const isBoardsCollapsed = useSelector(state => state.themeReducer.isBoardsCollapsed);
  const showRecurringTasksOnBoard = useSelector(state => state.themeReducer.showRecurringTasksOnBoard || false);

  const toggleBoardsCollapsed = () => {
    dispatch(setBoardsCollapsed(!isBoardsCollapsed));
  };

  const { colors, isDark, mode } = useTheme();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const dispatch = useDispatch();

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
  const isGoogleDrawerOpen = useSelector(state => state.themeReducer?.isGoogleDrawerOpen || false);
  const tasks = useSelector(state => state.taskReducer.tasks || []);
  const boards = useSelector(state => state.userReducer.boards || [{ id: 'main', name: 'Main' }]);
  const activeBoardId = useSelector(state => state.userReducer.activeBoardId || 'main');
  const isPremium = useSelector(state => state.entitlementReducer?.isPremium);

  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsVisible, setDetailsVisible] = useState(false);
  const [isQuickMenuVisible, setQuickMenuVisible] = useState(false);
  const [isSnoozeVisible, setSnoozeVisible] = useState(false);
  const [isPremiumModalVisible, setPremiumModalVisible] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');
  
  const [isCreateBoardVisible, setCreateBoardVisible] = useState(false);
  const [promptConfig, setPromptConfig] = useState({ isVisible: false, type: null, targetBoard: null });
  const [confirmConfig, setConfirmConfig] = useState({ isVisible: false, title: '', message: '', onConfirm: null, confirmText: 'Confirm', isDestructive: false });
  const [sectionOptionsConfig, setSectionOptionsConfig] = useState({ isVisible: false, section: null });
  const [boardOptionsConfig, setBoardOptionsConfig] = useState({ isVisible: false, board: null });
  const [boardAutomationModal, setBoardAutomationModal] = useState({ isVisible: false, boardId: null, boardName: '' });
  const [isMoveBoardVisible, setMoveBoardVisible] = useState(false);
  const [sortConfig, setSortConfig] = useState({});
  const [selectionMode, setSelectionMode] = useState({ isActive: false, sectionId: null, selectedTaskIds: [] });

  const allSectionIds = ['missed', 'today', 'tomorrow', 'on-this-week', 'on-next-week', 'later', 'completed'];

  const [collapsedSections, setCollapsedSections] = useState(() => {
    if (route?.params?.sectionId) {
      return allSectionIds.filter(id => id !== route.params.sectionId);
    }
    return ['completed'];
  });

  useEffect(() => {
    if (route?.params?.sectionId) {
      setCollapsedSections(allSectionIds.filter(id => id !== route.params.sectionId));
    }
  }, [route?.params?.sectionId]);

  useFocusEffect(
    useCallback(() => {
      dispatch(processAutoManageTasks());
    }, [dispatch])
  );

  useEffect(() => {
    if (route?.params?.editTaskId) {
      const t = tasks.find(tsk => tsk.id === route.params.editTaskId);
      if (t) {
         setSelectedTask(t);
         setDetailsVisible(true);
      }
      navigation.setParams({ editTaskId: undefined });
    }
  }, [route?.params?.editTaskId, tasks, navigation]);

  const boardIdsKey = useMemo(() => {
    return (boards || []).map(b => b?.id || b?._id).join(',');
  }, [boards]);

  useEffect(() => {
    if (boards && boards.length > 0) {
      dispatch(purgeOrphanedTasksThunk(boards));
    }
  }, [boardIdsKey, dispatch]);

  const toggleSection = useCallback((sectionId) => {
    if (Platform.OS !== 'web' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedSections(prev =>
      prev.includes(sectionId) ? prev.filter(id => id !== sectionId) : [...prev, sectionId]
    );
  }, []);

  const toggleTaskSelection = useCallback((taskId) => {
    if (Platform.OS !== 'web' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectionMode(prev => {
      const isSelected = prev.selectedTaskIds.includes(taskId);
      return {
        ...prev,
        selectedTaskIds: isSelected 
          ? prev.selectedTaskIds.filter(id => id !== taskId)
          : [...prev.selectedTaskIds, taskId]
      };
    });
  }, []);

  const handleBatchMoveBoard = (targetBoardId) => {
    const selectedIds = [...selectionMode.selectedTaskIds];
    if (selectedIds.length === 0) return;

    dispatch(updateMultipleTasks({ taskIds: selectedIds, changes: { boardId: targetBoardId } }));
    
    const targetBoard = boards.find(b => b.id === targetBoardId);
    const boardName = targetBoard ? (targetBoard.name === 'Main' ? t('Main') : targetBoard.name) : t('Board');
    setSelectionMode({ isActive: false, sectionId: null, selectedTaskIds: [] });
    
    showToast(`${t('Moved')} ${selectedIds.length} ${t('Tasks to')} ${boardName}`);
  };

  const handleSelectAll = () => {
    const section = sections.find(s => s.id === selectionMode.sectionId);
    if (!section) return;
    const taskIds = section.data.map(t => t.id);
    setSelectionMode(prev => ({ ...prev, selectedTaskIds: taskIds }));
  };

  const handleCompleteSelected = () => {
    setConfirmConfig({
      isVisible: true,
      title: 'Complete Tasks',
      message: `Are you sure you want to complete ${selectionMode.selectedTaskIds.length} tasks?`,
      confirmText: 'Complete',
      isDestructive: false,
      onConfirm: () => {
        if (Platform.OS !== 'web' && UIManager.setLayoutAnimationEnabledExperimental) {
          UIManager.setLayoutAnimationEnabledExperimental(true);
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        dispatch(updateMultipleTasks({ taskIds: selectionMode.selectedTaskIds, changes: { completed: true } }));
        setSelectionMode({ isActive: false, sectionId: null, selectedTaskIds: [] });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
      }
    });
  };

  const handleDeleteSelected = () => {
    const selectedTasksObjects = boardTasks.filter(t => selectionMode.selectedTaskIds.includes(t.id));
    const count = selectedTasksObjects.length;
    setConfirmConfig({
      isVisible: true,
      title: t('Delete Tasks') || 'Delete Tasks',
      message: `${t('Are you sure you want to delete')} ${count} ${t('tasks')}?`,
      confirmText: t('Delete') || 'Delete',
      isDestructive: true,
      onConfirm: () => {
        if (Platform.OS !== 'web' && UIManager.setLayoutAnimationEnabledExperimental) {
          UIManager.setLayoutAnimationEnabledExperimental(true);
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        dispatch(deleteMultipleTasks({ taskIds: selectionMode.selectedTaskIds }));
        setSelectionMode({ isActive: false, sectionId: null, selectedTaskIds: [] });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));

        showToast(
          `${count} ${t('tasks deleted')}`,
          t('Undo'),
          () => {
            dispatch(addMultipleTasks({ tasks: selectedTasksObjects }));
          }
        );
      }
    });
  };

  const handleShareSelected = async () => {
    try {
      const selectedTasksObjects = boardTasks.filter(t => selectionMode.selectedTaskIds.includes(t.id));
      const shareText = selectedTasksObjects.map(t => {
        const taskName = t.taskname;
        const selectedDate = t.completionDate;
        const selectedTime = t.time;
        const notes = t.description?.text ? t.description.text.replace(/<[^>]+>/g, '').trim() : '';
        const img = t.description?.img ? t.description.img : '';
        const subtasks = t.subtasks || [];
        const priority = t.priority && t.priority !== 'none' ? t.priority.charAt(0).toUpperCase() + t.priority.slice(1) : '';

        return `Task: ${taskName}\nDue: ${selectedDate ? dayjs(selectedDate).format('MMM D, YYYY') : 'Not set'}${selectedTime ? ` at ${selectedTime}` : ''}${priority ? `\nPriority: ${priority}` : ''}\n\n${notes ? `Notes:\n${notes}\n\n` : ''}${img ? `[Image Attached]\n\n` : ''}${subtasks.length > 0 ? `Subtasks:\n${subtasks.map(s => `- ${s.completed ? '☑️' : '🔲'} ${s.text}`).join('\n')}` : ''}`.trim();
      }).join('\n\n------------------------\n\n');
      
      const allAttachments = [];
      selectedTasksObjects.forEach(t => {
        const atts = t.description?.attachments ? [...t.description.attachments] : [];
        if (t.description?.img && atts.length === 0) {
          atts.push({ uri: t.description.img, type: 'image', name: 'image.jpg' });
        }
        allAttachments.push(...atts);
      });

      if (allAttachments.length > 0 && Platform.OS !== 'web') {
        const urlsToShare = [];
        for (let i = 0; i < allAttachments.length; i++) {
          const attachment = allAttachments[i];
          let uri = attachment.uri;
          if (attachment.type === 'image' && uri.startsWith('data:image')) {
            const comma = uri.indexOf(',');
            const base64Data = uri.substring(comma + 1);
            const ext = attachment.name?.split('.').pop() || 'jpg';
            const tempUri = `${FileSystem.cacheDirectory}share-${Date.now()}-${i}.${ext}`;
            await FileSystem.writeAsStringAsync(tempUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
            uri = tempUri;
          }
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists) urlsToShare.push(uri);
        }

        if (Platform.OS === 'android') {
          await shareTaskAsync(`Tasks:\n\n${shareText}`, urlsToShare);
        } else {
          await RNShare.open({ urls: urlsToShare, type: '*/*', title: 'Share Tasks', failOnCancel: false });
        }
      } else {
        await Share.share({
          message: `Tasks:\n\n${shareText}`,
        });
      }
      setSelectionMode({ isActive: false, sectionId: null, selectedTaskIds: [] });
    } catch (error) {
      if (error.message !== 'User did not share') {
        console.log(error);
      }
    }
  };

  const handleTaskPress = useCallback((task) => {
    setSelectedTask(task);
    setDetailsVisible(true);
  }, []);

  const handleSnoozePress = useCallback((task) => {
    setSelectedTask(task);
    setSnoozeVisible(true);
  }, []);

  const handleQuickMenuPress = useCallback((task) => {
    setSelectedTask(task);
    setQuickMenuVisible(true);
  }, []);

  const handleToggleSelectTask = useCallback((taskId, sectionId) => {
    if (Platform.OS !== 'web' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setSelectionMode(prev => {
      if (!prev.isActive) {
        return { isActive: true, sectionId, selectedTaskIds: [taskId] };
      }
      const exists = prev.selectedTaskIds.includes(taskId);
      const newSelected = exists
        ? prev.selectedTaskIds.filter(id => id !== taskId)
        : [...prev.selectedTaskIds, taskId];
      return {
        ...prev,
        selectedTaskIds: newSelected,
        isActive: newSelected.length > 0 ? prev.isActive : false
      };
    });
  }, []);

  const mainBoardId = useMemo(() => boards[0]?.id || 'main', [boards]);

  // Group tasks for current active board
  const boardTasks = useMemo(() => {
    return tasks.filter(task => task && isTaskOnBoard(task, activeBoardId, mainBoardId, boards));
  }, [tasks, activeBoardId, mainBoardId, boards]);

  const activeBoard = useMemo(() => {
    return boards.find(b => b.id === activeBoardId) || { id: 'main', name: 'Main', type: 'standard' };
  }, [boards, activeBoardId]);

  // Single-pass O(N) deduplication of recurring tasks (eliminates per-series sorting allocations)
  const hiddenRecurringTaskIds = useMemo(() => {
    if (showRecurringTasksOnBoard || activeBoard?.type === 'birthdays') return new Set();

    const earliestSeriesMap = new Map();
    const hiddenIds = new Set();
    const todayStr = dayjs().format('YYYY-MM-DD');

    for (const task of boardTasks) {
      if (task.completed || !task.recurringSeriesId) continue;
      const dateStr = getTaskDateStr(task);
      if (dateStr && dateStr < todayStr) continue; // Missed tasks remain visible in Missed section

      const seriesId = task.recurringSeriesId;
      const existing = earliestSeriesMap.get(seriesId);

      if (!existing) {
        earliestSeriesMap.set(seriesId, { task, dateStr: dateStr || '9999-12-31' });
      } else {
        const taskVal = dateStr || '9999-12-31';
        const existingVal = existing.dateStr;

        if (taskVal < existingVal) {
          hiddenIds.add(existing.task.id);
          earliestSeriesMap.set(seriesId, { task, dateStr: taskVal });
        } else {
          hiddenIds.add(task.id);
        }
      }
    }

    return hiddenIds;
  }, [boardTasks, showRecurringTasksOnBoard, activeBoard]);

  const { todayTasks, tomorrowTasks, thisWeekTasks, nextWeekTasks, laterTasks, missedTasks, completedTasks, completedCount, todoTasks, upcomingBirthdayTasks, needToBuyTasks } = useMemo(() => {
    const thresholds = getDateThresholds();

    const buckets = {
      missed: [],
      today: [],
      tomorrow: [],
      'on-this-week': [],
      'on-next-week': [],
      later: [],
      completed: [],
      todo: []
    };

    const processedTasks = boardTasks.map(task => {
      const hasDate = !!(task.completionDate || task.dateString);
      const dateStr = getTaskDateStr(task);
      const priorityScore = PRIORITY_SCORES[task.priority?.toLowerCase()] || 0;
      const idNum = parseInt(task.id || '0');
      return {
        task,
        dateStr,
        hasDate,
        priorityScore,
        idNum,
        isCompleted: !!task.completed
      };
    });

    for (const item of processedTasks) {
      const task = item.task;
      if (item.isCompleted) {
        buckets.completed.push(item);
      } else {
        buckets.todo.push(item);
        if (hiddenRecurringTaskIds.has(task.id)) continue;

        const section = classifyTaskDate(item.dateStr, thresholds, item.hasDate);
        if (buckets[section]) {
          buckets[section].push(item);
        }
      }
    }

    const sortBucket = (arr, sectionId) => {
      const sortBy = sortConfig[sectionId] || 'time';
      return [...arr].sort((a, b) => compareTasks(a, b, sortBy)).map(item => item.task);
    };

    const isCompletedCollapsed = collapsedSections.includes('completed');

    const sortedToday = sortBucket(buckets.today, 'today');
    const sortedTomorrow = sortBucket(buckets.tomorrow, 'tomorrow');
    const sortedThisWeek = sortBucket(buckets['on-this-week'], 'on-this-week');
    const sortedNextWeek = sortBucket(buckets['on-next-week'], 'on-next-week');
    const sortedLater = sortBucket(buckets.later, 'later');
    const sortedMissed = sortBucket(buckets.missed, 'missed');
    const sortedCompleted = isCompletedCollapsed ? [] : sortBucket(buckets.completed, 'completed');
    const sortedTodo = sortBucket(buckets.todo, 'today');
    const completedCount = buckets.completed.length;

    return {
      todayTasks: sortedToday,
      tomorrowTasks: sortedTomorrow,
      thisWeekTasks: sortedThisWeek,
      nextWeekTasks: sortedNextWeek,
      laterTasks: sortedLater,
      missedTasks: sortedMissed,
      completedTasks: sortedCompleted,
      completedCount,
      todoTasks: sortedTodo,
      upcomingBirthdayTasks: sortedTodo,
      needToBuyTasks: sortedTodo
    };
  }, [boardTasks, sortConfig, hiddenRecurringTaskIds, collapsedSections]);

  const sections = useMemo(() => {
    const isCompletedCollapsed = collapsedSections.includes('completed');
    const actualCompletedCount = completedTasks.length > 0 ? completedTasks.length : completedCount;

    if (activeBoard?.type === 'simple_list' || activeBoard?.type === 'shopping') {
      const listUncompleted = todoTasks.filter(t => !missedTasks.some(m => m.id === t.id));
      return [
        ...(missedTasks.length > 0 ? [{ id: 'missed', title: t('Missed tasks'), data: collapsedSections.includes('missed') ? [] : missedTasks, count: missedTasks.length, color: '#f44336' }] : []),
        { id: 'today', title: t('List') || 'List', data: collapsedSections.includes('today') ? [] : listUncompleted, count: listUncompleted.length, color: '#10B981' },
        ...(actualCompletedCount > 0 ? [{ id: 'completed', title: t('Completed') || 'Completed', data: isCompletedCollapsed ? [] : completedTasks, count: actualCompletedCount, color: '#4CAF50' }] : [])
      ];
    }

    return [
      ...(missedTasks.length > 0 ? [{ id: 'missed', title: t('Missed tasks'), data: collapsedSections.includes('missed') ? [] : missedTasks, count: missedTasks.length, color: '#f44336' }] : []),
      { id: 'today', title: t('Today'), data: collapsedSections.includes('today') ? [] : todayTasks, count: todayTasks.length, color: '#ff9800' },
      { id: 'tomorrow', title: t('Tomorrow'), data: collapsedSections.includes('tomorrow') ? [] : tomorrowTasks, count: tomorrowTasks.length, color: '#2196f3' },
      { id: 'on-this-week', title: t('This week'), data: collapsedSections.includes('on-this-week') ? [] : thisWeekTasks, count: thisWeekTasks.length, color: '#9c27b0' },
      { id: 'on-next-week', title: t('Next week'), data: collapsedSections.includes('on-next-week') ? [] : nextWeekTasks, count: nextWeekTasks.length, color: '#009688' },
      { id: 'later', title: t('Upcoming'), data: collapsedSections.includes('later') ? [] : laterTasks, count: laterTasks.length, color: '#795548' },
      ...(actualCompletedCount > 0 ? [{ id: 'completed', title: t('Completed'), data: isCompletedCollapsed ? [] : completedTasks, count: actualCompletedCount, color: '#4caf50' }] : []),
    ];
  }, [activeBoard.type, missedTasks, todayTasks, tomorrowTasks, thisWeekTasks, nextWeekTasks, laterTasks, completedTasks, completedCount, todoTasks, upcomingBirthdayTasks, needToBuyTasks, collapsedSections, t]);

  const flattenedData = useMemo(() => {
    const result = [];
    sections.forEach(section => {
      result.push({ type: 'header', section });
      if (section.data && section.data.length > 0) {
        section.data.forEach(task => {
          result.push({ type: 'task', task, section });
        });
      }
      if (section.id !== 'completed' && section.id !== 'missed' && !collapsedSections.includes(section.id)) {
        result.push({ type: 'footer', section });
      }
    });
    return result;
  }, [sections]);

  const boardCounts = useMemo(() => {
    const counts = {};
    const keyMap = new Map();
    const fallbackMainId = mainBoardId || boards[0]?.id || 'main';
    boards.forEach(b => {
      if (!b) return;
      counts[b.id] = 0;
      if (b.id) keyMap.set(String(b.id), b.id);
      if (b._id) keyMap.set(String(b._id), b.id);
      if (b.name) keyMap.set(String(b.name).toLowerCase(), b.id);
    });
    keyMap.set('main', fallbackMainId);
    keyMap.set('tasks', fallbackMainId);

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!t || t.completed) continue;
      const rawBId = t.boardId || t.board_id;
      if (!rawBId) {
        if (counts[fallbackMainId] !== undefined) counts[fallbackMainId]++;
      } else {
        const strId = String(rawBId);
        const resolvedId = keyMap.get(strId) || keyMap.get(strId.toLowerCase());
        if (resolvedId && counts[resolvedId] !== undefined) {
          counts[resolvedId]++;
        }
      }
    }
    return counts;
  }, [tasks, boards, mainBoardId]);

  const getSectionTasks = useCallback((section) => {
    if (!section) return [];
    switch (section.id) {
      case 'missed': return missedTasks;
      case 'today': return todayTasks;
      case 'tomorrow': return tomorrowTasks;
      case 'on-this-week': return thisWeekTasks;
      case 'on-next-week': return nextWeekTasks;
      case 'later': return laterTasks;
      case 'completed': return completedTasks.length > 0 ? completedTasks : boardTasks.filter(t => t && t.completed);
      default: return section.data || [];
    }
  }, [missedTasks, todayTasks, tomorrowTasks, thisWeekTasks, nextWeekTasks, laterTasks, completedTasks]);

  const handleCompleteSection = (section) => {
    const tasksToComplete = getSectionTasks(section);
    setConfirmConfig({
      isVisible: true,
      title: 'Complete All',
      message: `Are you sure you want to complete all tasks in "${section.title}"?`,
      confirmText: 'Complete',
      isDestructive: false,
      onConfirm: () => {
        if (Platform.OS !== 'web' && UIManager.setLayoutAnimationEnabledExperimental) {
          UIManager.setLayoutAnimationEnabledExperimental(true);
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        dispatch(updateMultipleTasks({ taskIds: tasksToComplete.map(t => t.id), changes: { completed: true } }));
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
        
        showToast(
          `${tasksToComplete.length} ${t('tasks completed')}`,
          t('Undo'),
          () => {
            dispatch(updateMultipleTasks({
              updates: tasksToComplete.map(task => ({ taskId: task.id, completed: task.completed }))
            }));
          }
        );
      }
    });
  };

  const handleMoveForward = (section) => {
    const targetTasks = getSectionTasks(section);
    if (!targetTasks || targetTasks.length === 0) return;
    setConfirmConfig({
      isVisible: true,
      title: t('Move Forward'),
      message: `${t('Are you sure you want to move all tasks in')} "${section.title}" ${t('forward')}?`,
      confirmText: t('Move'),
      isDestructive: false,
      onConfirm: () => {
        if (Platform.OS !== 'web' && UIManager.setLayoutAnimationEnabledExperimental) {
          UIManager.setLayoutAnimationEnabledExperimental(true);
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const today = dayjs().startOf('day');
        let newDate;
        switch (section.id) {
            case 'missed': newDate = today.toISOString(); break;
            case 'today': newDate = today.add(1, 'day').toISOString(); break;
            case 'tomorrow': newDate = today.add(2, 'day').toISOString(); break;
            case 'on-this-week': newDate = today.add(1, 'week').startOf('isoWeek').toISOString(); break;
            case 'on-next-week': newDate = today.add(2, 'week').startOf('isoWeek').toISOString(); break;
            default: newDate = today.add(1, 'week').toISOString(); break;
        }
        const newDateStr = dayjs(newDate).format('YYYY-MM-DD');
        const idsToMove = [];
        targetTasks.forEach(task => {
          const prevDateStr = task.completionDate ? dayjs(task.completionDate).format('YYYY-MM-DD') : '';
          if (prevDateStr !== newDateStr) {
            idsToMove.push(task.id);
          }
        });
        if (idsToMove.length > 0) {
          dispatch(updateMultipleTasks({ taskIds: idsToMove, changes: { completionDate: newDate, completed: false } }));
        }
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
        if (idsToMove.length === 0) {
          showToast(t('Date unchanged. You can change the date on the edit task page.'));
        } else {
          showToast(`${idsToMove.length} ${t('tasks moved forward')}`);
        }
      }
    });
  };

  const handleMoveBackward = (section) => {
    const targetTasks = getSectionTasks(section);
    if (!targetTasks || targetTasks.length === 0) return;
    setConfirmConfig({
      isVisible: true,
      title: t('Move Backward'),
      message: `${t('Are you sure you want to move all tasks in')} "${section.title}" ${t('backward')}?`,
      confirmText: t('Move'),
      isDestructive: false,
      onConfirm: () => {
        if (Platform.OS !== 'web' && UIManager.setLayoutAnimationEnabledExperimental) {
          UIManager.setLayoutAnimationEnabledExperimental(true);
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const today = dayjs().startOf('day');
        let newDate;
        switch (section.id) {
            case 'missed': newDate = today.subtract(2, 'day').toISOString(); break;
            case 'today': newDate = today.subtract(1, 'day').toISOString(); break;
            case 'tomorrow': newDate = today.toISOString(); break;
            case 'on-this-week': newDate = today.add(1, 'day').toISOString(); break;
            case 'on-next-week': newDate = today.endOf('isoWeek').toISOString(); break;
            case 'later': newDate = today.add(1, 'week').startOf('isoWeek').toISOString(); break;
            default: newDate = today.subtract(1, 'day').toISOString(); break;
        }
        const newDateStr = dayjs(newDate).format('YYYY-MM-DD');
        const idsToMove = [];
        targetTasks.forEach(task => {
          const prevDateStr = task.completionDate ? dayjs(task.completionDate).format('YYYY-MM-DD') : '';
          if (prevDateStr !== newDateStr) {
            idsToMove.push(task.id);
          }
        });
        if (idsToMove.length > 0) {
          dispatch(updateMultipleTasks({ taskIds: idsToMove, changes: { completionDate: newDate, completed: false } }));
        }
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
        if (idsToMove.length === 0) {
          showToast(t('Date unchanged. You can change the date on the edit task page.'));
        } else {
          showToast(`${idsToMove.length} ${t('tasks moved backward')}`);
        }
      }
    });
  };

  const handleDeleteSection = (section) => {
    const tasksToDelete = getSectionTasks(section);

    setConfirmConfig({
      isVisible: true,
      title: 'Delete All',
      message: `Are you sure you want to delete all tasks in "${section.title}"?`,
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: () => {
        dispatch(deleteMultipleTasks({ taskIds: tasksToDelete.map(t => t.id) }));
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
        
        showToast(
          `${tasksToDelete.length} ${t('tasks deleted')}`,
          t('Undo'),
          () => {
            dispatch(addMultipleTasks({ tasks: tasksToDelete }));
          }
        );
      }
    });
  };

  const handleMenuPress = useCallback((section) => {
    setSectionOptionsConfig({ isVisible: true, section });
  }, []);

  const handleAddBoard = () => {
    const boardLimit = isPremium ? 20 : 10;
    if (boards.length >= boardLimit) {
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
    setCreateBoardVisible(true);
  };

  const handleCreateBoardSubmit = ({ name, type, color, repeatConfig, repeatDuration }) => {
    if (name && name.trim()) {
      const id = new Date().getTime().toString();
      dispatch(addBoardAsync({ id, name: name.trim(), type: type || 'standard', color, repeatConfig, repeatDuration }));
      dispatch(setActiveBoardId(id));
    }
    setCreateBoardVisible(false);
  };

  const handleBoardOptions = (board) => {
    setBoardOptionsConfig({ isVisible: true, board });
  };

  const handlePromptSubmit = (value) => {
    if (value && value.trim()) {
      if (promptConfig.type === 'add') {
        const id = new Date().getTime().toString();
        dispatch(addBoardAsync({ id, name: value.trim() }));
        dispatch(setActiveBoardId(id));
      } else if (promptConfig.type === 'rename' && promptConfig.targetBoard) {
        dispatch(renameBoardAsync({ id: promptConfig.targetBoard.id, name: value.trim() }));
      }
    }
    setPromptConfig({ isVisible: false, type: null, targetBoard: null });
  };

  const handleToggleSelectSection = useCallback((section) => {
    if (Platform.OS !== 'web' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const sectionTasks = getSectionTasks(section);
    const sectionTaskIds = sectionTasks.map(t => t.id);
    if (sectionTaskIds.length === 0) return;

    setSelectionMode(prev => {
      const allSelected = sectionTaskIds.every(id => prev.selectedTaskIds.includes(id));
      let newSelected;
      if (allSelected) {
        newSelected = prev.selectedTaskIds.filter(id => !sectionTaskIds.includes(id));
      } else {
        newSelected = Array.from(new Set([...prev.selectedTaskIds, ...sectionTaskIds]));
      }
      return {
        ...prev,
        isActive: true,
        sectionId: section.id,
        selectedTaskIds: newSelected
      };
    });
  }, [getSectionTasks]);

  const renderSectionHeader = ({ section }) => {
    const isCollapsed = collapsedSections.includes(section.id);
    const sectionTasks = getSectionTasks(section);
    const sectionTaskIds = sectionTasks.map(t => t.id);
    const selectedCountInSection = sectionTaskIds.filter(id => selectedTaskIdsSet.has(id)).length;
    const isAllSectionSelected = sectionTasks.length > 0 && selectedCountInSection === sectionTasks.length;
    const isPartiallySelected = selectedCountInSection > 0 && !isAllSectionSelected;

    return (
      <SectionHeader
        section={section}
        isCollapsed={isCollapsed}
        onToggleSection={toggleSection}
        onMenuPress={handleMenuPress}
        isSelectionActive={selectionMode.isActive}
        isAllSectionSelected={isAllSectionSelected}
        isPartiallySelected={isPartiallySelected}
        onToggleSelectSection={handleToggleSelectSection}
      />
    );
  };

  const renderSectionFooter = ({ section }) => {
    return (
      <InlineAddTask 
        sectionId={section.id} 
        isActive={activeAddSectionId === section.id}
        onToggle={(active) => {
          setActiveAddSectionId(active ? section.id : null);
          if (active) setSelectionMode({ isActive: false, sectionId: null, selectedTaskIds: [] });
        }}
        onAddDetails={(task) => {
          setSelectedTask(task);
          setDetailsVisible(true);
        }}
      />
    );
  };

  const selectedTaskIdsSet = useMemo(() => new Set(selectionMode.selectedTaskIds), [selectionMode.selectedTaskIds]);

  const flashListExtraData = useMemo(() => ({
    activeBoardId,
    activeAddSectionId,
    tasksCount: tasks.length,
    boardTasksRef: boardTasks,
    collapsedKey: collapsedSections.join(','),
    sortKey: JSON.stringify(sortConfig),
    selectionActive: selectionMode.isActive,
    selectedCount: selectedTaskIdsSet.size,
    flattenedLength: flattenedData.length,
    themeMode: mode,
    themeIsDark: isDark,
    themeBg: colors.bgMain,
    themeText: colors.textPrimary,
  }), [activeBoardId, activeAddSectionId, tasks.length, boardTasks, collapsedSections, sortConfig, selectionMode.isActive, selectedTaskIdsSet.size, flattenedData.length, mode, isDark, colors.bgMain, colors.textPrimary]);

  return (
    <ScreenErrorBoundary screenName="BoardScreen">
      <KeyboardAvoidingView 
        style={{ flex: 1, backgroundColor: colors.bgMain }} 
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
      >
        <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      
        {/* Screen Header matching new design */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: colors.textPrimary, marginBottom: 2 }}>
              {t('Tasks') || 'Tasks'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              {activeBoard ? (activeBoard.name === 'Main' ? (t('Focus on what matters most.') || 'Focus on what matters most.') : activeBoard.name) : (t('Focus on what matters most.') || 'Focus on what matters most.')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity 
              accessible={true} 
              accessibilityRole="button" 
              accessibilityLabel="Toggle theme"
              style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center' }}
              onPress={handleToggleTheme}
            >
              {renderThemeIcon()}
            </TouchableOpacity>

            <TouchableOpacity 
              testID="add_board_btn"
              accessible={true} 
              accessibilityRole="button" 
              accessibilityLabel="Add new board"
              style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center' }}
              onPress={handleAddBoard}
            >
              <Text style={{ fontSize: 22, color: colors.textPrimary, fontWeight: '400' }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Board Pills Horizontal Scroll */}
        <View style={{ marginBottom: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {boards.map(board => {
              const isSelected = activeBoardId === board.id;
              const boardColor = getBoardColor(board, boards);
              const count = boardCounts[board.id] || 0;

              return (
                <TouchableOpacity 
                  key={board.id} 
                  testID={`board_tab_${board.id}`}
                  accessible={true} 
                  accessibilityRole="tab" 
                  accessibilityLabel={`Board ${board.name === 'Main' ? t('Main') : board.name}`} 
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 18,
                      borderWidth: 1.5,
                      borderColor: isSelected ? (boardColor || colors.primary) : (colors.borderColor || '#E5E5EA'),
                      backgroundColor: isSelected 
                        ? `${boardColor || colors.primary}18` 
                        : colors.bgCard,
                    }
                  ]}
                  onPress={() => dispatch(setActiveBoardId(board.id))}
                  onLongPress={() => handleBoardOptions(board)}
                  onContextMenu={(e) => {
                    if (e && e.preventDefault) e.preventDefault();
                    handleBoardOptions(board);
                  }}
                >
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: boardColor, marginRight: 6 }} />
                  <Text style={[
                    { 
                      fontSize: 13,
                      fontWeight: isSelected ? '700' : '500',
                      color: isSelected ? colors.textPrimary : colors.textSecondary 
                    }
                  ]}>
                    {board.name === 'Main' ? (t('Main') || 'Main') : board.name}
                  </Text>
                  {count > 0 && (
                    <View style={{
                      backgroundColor: `${boardColor}25`,
                      borderRadius: 10,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      marginLeft: 6
                    }}>
                      <Text style={{
                        color: boardColor,
                        fontSize: 11,
                        fontWeight: 'bold'
                      }}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

      <FlashList
        key={activeBoardId}
        data={flattenedData}
        extraData={flashListExtraData}
        keyExtractor={(item) => item.type === 'task' ? `task_${item.task?.id || ''}_${item.section?.id || ''}` : `${item.type}_${item.section?.id || ''}_${item.section?.count ?? 0}`}
        getItemType={(item) => item.type}
        renderItem={({ item }) => {
          if (item.type === 'header') return renderSectionHeader({ section: item.section });
          if (item.type === 'footer') return renderSectionFooter({ section: item.section });
          if (item.type === 'task') {
            const task = item.task;
            const section = item.section;
            const isListBoard = activeBoard?.type === 'simple_list' || activeBoard?.type === 'shopping';
            return (
              <TaskRow 
                task={task} 
                sectionId={section.id}
                hideDate={isListBoard}
                hideBoardBadge={true}
                isSelectionMode={selectionMode.isActive}
                isSelected={selectedTaskIdsSet.has(task.id)}
                onToggleSelect={handleToggleSelectTask}
                onPressSnooze={handleSnoozePress}
                onPressMore={isListBoard ? undefined : handleQuickMenuPress}
                onPress={handleTaskPress}
              />
            );
          }
          return null;
        }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={undefined}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={closeOpenSwipeableRow}
        estimatedItemSize={65}
        drawDistance={1200}
      />

      <TaskDetailsModal 
        task={selectedTask}
        isVisible={isDetailsVisible}
        onClose={() => setDetailsVisible(false)}
      />

      <PromptModal
        isVisible={promptConfig.isVisible}
        title={promptConfig.type === 'add' ? t('New Board') : t('Rename Board')}
        message={promptConfig.type === 'add' ? t('Enter board name:') : t('Enter new name:')}
        defaultValue={promptConfig.type === 'rename' ? promptConfig.targetBoard?.name : ''}
        submitText={promptConfig.type === 'add' ? t('Add') : t('Rename')}
        onCancel={() => setPromptConfig({ isVisible: false, type: null, targetBoard: null })}
        onSubmit={handlePromptSubmit}
        maxLength={20}
      />

      <Modal 
        isVisible={sectionOptionsConfig.isVisible} 
        onSwipeComplete={() => setSectionOptionsConfig({ isVisible: false, section: null })}
        swipeDirection={['down']}
        propagateSwipe={true}
        onBackdropPress={() => setSectionOptionsConfig({ isVisible: false, section: null })}
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <View style={[styles.optionsModalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.optionsModalDragHandle} />
          <Text style={[styles.optionsModalTitle, { color: colors.textPrimary }]}>
            {t('Options for')} {sectionOptionsConfig.section?.title}
          </Text>
          
          {(activeBoard?.type === 'simple_list' || activeBoard?.type === 'shopping') ? (
            <>
              <TouchableOpacity testID="section_option_select_tasks" accessible={true} accessibilityRole="button" accessibilityLabel="Select Tasks" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { 
                setSelectionMode({ isActive: true, sectionId: sectionOptionsConfig.section?.id, selectedTaskIds: [] }); 
                setSectionOptionsConfig({ isVisible: false, section: null }); 
              }}>
                <Text style={[styles.optionText, { color: colors.primary }]}>{t('Select Tasks')}</Text>
              </TouchableOpacity>

              {sectionOptionsConfig.section?.id !== 'completed' && (
                <TouchableOpacity testID="section_option_complete_all" accessible={true} accessibilityRole="button" accessibilityLabel="Complete all tasks" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { const s = sectionOptionsConfig.section; setSectionOptionsConfig({ isVisible: false, section: null }); setTimeout(() => handleCompleteSection(s), 400); }}>
                  <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Complete all')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity testID="section_option_delete_all" accessible={true} accessibilityRole="button" accessibilityLabel="Delete all tasks" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { const s = sectionOptionsConfig.section; setSectionOptionsConfig({ isVisible: false, section: null }); setTimeout(() => handleDeleteSection(s), 400); }}>
                <Text style={{ color: '#f44336', fontSize: 16, fontWeight: 'bold' }}>{t('Delete all')}</Text>
              </TouchableOpacity>

              <TouchableOpacity testID="section_option_cancel" style={[styles.optionBtn, { borderBottomWidth: 0 }]} onPress={() => setSectionOptionsConfig({ isVisible: false, section: null })}>
                <Text style={[styles.optionText, { color: colors.textSecondary }]}>{t('Cancel')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>

              <TouchableOpacity testID="section_option_select_tasks" accessible={true} accessibilityRole="button" accessibilityLabel="Select Tasks" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { 
                setSelectionMode({ isActive: true, sectionId: sectionOptionsConfig.section?.id, selectedTaskIds: [] }); 
                setSectionOptionsConfig({ isVisible: false, section: null }); 
              }}>
                <Text style={[styles.optionText, { color: colors.primary }]}>{t('Select Tasks')}</Text>
              </TouchableOpacity>
              
              
              {sectionOptionsConfig.section?.id !== 'completed' && sectionOptionsConfig.section?.id !== 'later' && (
                <TouchableOpacity testID="section_option_complete_all" accessible={true} accessibilityRole="button" accessibilityLabel="Complete all tasks" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { const s = sectionOptionsConfig.section; setSectionOptionsConfig({ isVisible: false, section: null }); setTimeout(() => handleCompleteSection(s), 400); }}>
                  <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Complete all')}</Text>
                </TouchableOpacity>
              )}

              {sectionOptionsConfig.section?.id !== 'completed' && sectionOptionsConfig.section?.id !== 'later' && (
                <TouchableOpacity testID="section_option_move_forward" accessible={true} accessibilityRole="button" accessibilityLabel="Move tasks forward" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { const s = sectionOptionsConfig.section; setSectionOptionsConfig({ isVisible: false, section: null }); setTimeout(() => handleMoveForward(s), 400); }}>
                  <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Move forward')}</Text>
                </TouchableOpacity>
              )}

              {sectionOptionsConfig.section?.id !== 'completed' && (
                <TouchableOpacity testID="section_option_move_backward" accessible={true} accessibilityRole="button" accessibilityLabel="Move tasks backward" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { const s = sectionOptionsConfig.section; setSectionOptionsConfig({ isVisible: false, section: null }); setTimeout(() => handleMoveBackward(s), 400); }}>
                  <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Move backward')}</Text>
                </TouchableOpacity>
              )}

              {sectionOptionsConfig.section?.id === 'later' && (
                <TouchableOpacity testID="section_option_complete_all" accessible={true} accessibilityRole="button" accessibilityLabel="Complete all tasks" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { const s = sectionOptionsConfig.section; setSectionOptionsConfig({ isVisible: false, section: null }); setTimeout(() => handleCompleteSection(s), 400); }}>
                  <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Complete all')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity testID="section_option_delete_all" accessible={true} accessibilityRole="button" accessibilityLabel="Delete all tasks" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { const s = sectionOptionsConfig.section; setSectionOptionsConfig({ isVisible: false, section: null }); setTimeout(() => handleDeleteSection(s), 400); }}>
                <Text style={{ color: '#f44336', fontSize: 16, fontWeight: 'bold' }}>{t('Delete all')}</Text>
              </TouchableOpacity>

              <TouchableOpacity testID="section_option_cancel" style={[styles.optionBtn, { borderBottomWidth: 0 }]} onPress={() => setSectionOptionsConfig({ isVisible: false, section: null })}>
                <Text style={[styles.optionText, { color: colors.textSecondary }]}>{t('Cancel')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      <Modal 
        isVisible={boardOptionsConfig.isVisible} 
        onSwipeComplete={() => setBoardOptionsConfig({ isVisible: false, board: null })}
        swipeDirection={['down']}
        propagateSwipe={true}
        onBackdropPress={() => setBoardOptionsConfig({ isVisible: false, board: null })}
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <View style={[styles.optionsModalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.optionsModalDragHandle} />
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
            <View style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: getBoardColor(boardOptionsConfig.board, boards),
              marginRight: 10,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)'
            }} />
            <Text style={[styles.optionsModalTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
              {t('Category') || 'Category'}: {boardOptionsConfig.board?.name === 'Main' ? (t('Main') || 'Main') : boardOptionsConfig.board?.name}
            </Text>
          </View>
          
          <Text style={{ color: colors.textSecondary, marginBottom: 16, paddingHorizontal: 20, textAlign: 'center' }}>
            {t('What would you like to do?')}
          </Text>

          {/* Color Palette (Palitra) with Custom Color Picker */}
          <View style={{ width: '100%', marginBottom: 18, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '90%', marginBottom: 10 }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>
                {t('Category Color') || 'Category Color'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.borderColor, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, gap: 6, backgroundColor: colors.bgMain }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: getBoardColor(boardOptionsConfig.board, boards) }} />
                <TextInput
                  style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', padding: 0, width: 65 }}
                  value={boardOptionsConfig.board?.color || getBoardColor(boardOptionsConfig.board, boards)}
                  onChangeText={(val) => {
                    let formatted = val.trim();
                    if (!formatted.startsWith('#') && formatted.length > 0) formatted = `#${formatted}`;
                    if (boardOptionsConfig.board) {
                      const boardId = boardOptionsConfig.board.id;
                      dispatch(updateBoardColorAsync({ id: boardId, color: formatted }));
                      setBoardOptionsConfig(prev => ({
                        ...prev,
                        board: prev.board ? { ...prev.board, color: formatted } : null
                      }));
                    }
                  }}
                  maxLength={9}
                  placeholder="#HEX"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, gap: 10, alignItems: 'center' }}>
              {BOARD_COLORS.map(c => {
                const currentColor = getBoardColor(boardOptionsConfig.board, boards);
                const isSelected = currentColor.toLowerCase() === c.toLowerCase();
                return (
                  <TouchableOpacity
                    key={c}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Color ${c}`}
                    onPress={() => {
                      if (boardOptionsConfig.board) {
                        const boardId = boardOptionsConfig.board.id;
                        dispatch(updateBoardColorAsync({ id: boardId, color: c }));
                        setBoardOptionsConfig(prev => ({
                          ...prev,
                          board: prev.board ? { ...prev.board, color: c } : null
                        }));
                      }
                    }}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: c,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: isSelected ? 3 : 0,
                      borderColor: colors.textPrimary,
                      shadowColor: c,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 3,
                      elevation: 3,
                    }}
                  >
                    {isSelected && <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              {Platform.OS === 'web' && (
                <label 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: 'rgba(128,128,128,0.12)',
                    border: '2px dashed ' + (colors.borderColor || '#999'),
                    cursor: 'pointer',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                  title={t('Custom Color') || 'Custom Color'}
                >
                  <span style={{ fontSize: 16 }}>🎨</span>
                  <input
                    type="color"
                    value={getBoardColor(boardOptionsConfig.board, boards)}
                    onChange={(e) => {
                      const newColor = e.target.value;
                      if (boardOptionsConfig.board) {
                        const boardId = boardOptionsConfig.board.id;
                        dispatch(updateBoardColorAsync({ id: boardId, color: newColor }));
                        setBoardOptionsConfig(prev => ({
                          ...prev,
                          board: prev.board ? { ...prev.board, color: newColor } : null
                        }));
                      }
                    }}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer'
                    }}
                  />
                </label>
              )}
            </ScrollView>
          </View>
          
          {isPremium && (
            <TouchableOpacity 
              accessible={true} accessibilityRole="button" accessibilityLabel="Board automations" 
              style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} 
              onPress={() => { 
                const board = boardOptionsConfig.board;
                setBoardOptionsConfig({ isVisible: false, board: null }); 
                setTimeout(() => {
                  setBoardAutomationModal({ isVisible: true, boardId: board.id, boardName: board.name });
                }, 300);
              }}
            >
              <Text style={[styles.optionText, { color: colors.primary, fontWeight: 'bold' }]}>{t('Board Automations')}</Text>
            </TouchableOpacity>
          )}

          {boardOptionsConfig.board?.repeatConfig && (
            <View style={[styles.optionBtn, { borderBottomColor: colors.borderColor, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <Text style={[styles.optionText, { color: colors.textSecondary }]}>{t('Auto-Repeat')}</Text>
              <View style={{ backgroundColor: 'rgba(236, 72, 153, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                <Text style={{ color: '#EC4899', fontSize: 12, fontWeight: '700' }}>
                  🔁 {boardOptionsConfig.board.repeatConfig.preset.replace(/_/g, ' ')} ({boardOptionsConfig.board.repeatDuration?.count || 10} {boardOptionsConfig.board.repeatDuration?.unit || 'yr'}s)
                </Text>
              </View>
            </View>
          )}

          {boardOptionsConfig.board?.id !== 'main' && (
            <>
              <TouchableOpacity accessible={true} accessibilityRole="button" accessibilityLabel="Rename board" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setPromptConfig({ isVisible: true, type: 'rename', targetBoard: boardOptionsConfig.board }); setBoardOptionsConfig({ isVisible: false, board: null }); }}>
                <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Rename')}</Text>
              </TouchableOpacity>

              <TouchableOpacity accessible={true} accessibilityRole="button" accessibilityLabel="Delete board" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { 
                const board = boardOptionsConfig.board;
                setBoardOptionsConfig({ isVisible: false, board: null }); 
                setTimeout(() => {
                  setConfirmConfig({
                    isVisible: true,
                    title: t('Delete Board'),
                    message: t('Are you sure? All tasks will be deleted.'),
                    confirmText: t('Delete'),
                    isDestructive: true,
                    onConfirm: () => {
                      dispatch(deleteBoardAsync(board.id));
                      dispatch(deleteTasksByBoard({ boardId: board.id, boardName: board.name }));
                      setConfirmConfig(prev => ({ ...prev, isVisible: false }));
                    }
                  });
                }, 400);
              }}>
                <Text style={{ color: '#f44336', fontSize: 16, fontWeight: 'bold' }}>{t('Delete')}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={[styles.optionBtn, { borderBottomWidth: 0 }]} onPress={() => setBoardOptionsConfig({ isVisible: false, board: null })}>
            <Text style={[styles.optionText, { color: colors.textSecondary }]}>{t('Cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <AutoManageSettings
        isVisible={boardAutomationModal.isVisible}
        boardId={boardAutomationModal.boardId}
        boardName={boardAutomationModal.boardName}
        onClose={() => setBoardAutomationModal({ isVisible: false, boardId: null, boardName: '' })}
      />

      {selectionMode.isActive && (
        <View testID="selection_action_bar" style={[styles.actionBar, { backgroundColor: colors.bgCard, borderTopColor: colors.borderColor }]}>
          <Text testID="selection_count_text" style={[styles.actionBarText, { color: colors.textPrimary }]}>{selectionMode.selectedTaskIds.length} {t('Selected')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionBarButtons} style={{ flex: 1, marginLeft: 10 }}>
            <TouchableOpacity testID="action_bar_all" accessible={true} accessibilityRole="button" accessibilityLabel="Select all" onPress={handleSelectAll} style={styles.actionBtn}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('All')}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="action_bar_move" accessible={true} accessibilityRole="button" accessibilityLabel="Move selected" onPress={() => setMoveBoardVisible(true)} style={styles.actionBtn}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('Move')}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="action_bar_share" accessible={true} accessibilityRole="button" accessibilityLabel="Share selected" onPress={handleShareSelected} style={styles.actionBtn}>
              <Text style={{ color: '#2196f3', fontWeight: 'bold' }}>{t('Share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="action_bar_complete" accessible={true} accessibilityRole="button" accessibilityLabel="Complete selected" onPress={handleCompleteSelected} style={styles.actionBtn}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('Complete')}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="action_bar_delete" accessible={true} accessibilityRole="button" accessibilityLabel="Delete selected" onPress={handleDeleteSelected} style={styles.actionBtn}>
              <Text style={{ color: '#f44336', fontWeight: 'bold' }}>{t('Delete')}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="action_bar_cancel" accessible={true} accessibilityRole="button" accessibilityLabel="Cancel selection" onPress={() => setSelectionMode({ isActive: false, sectionId: null, selectedTaskIds: [] })} style={styles.actionBtn}>
              <Text style={{ color: colors.textSecondary, fontWeight: 'bold' }}>{t('Cancel')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      </View>
      <ConfirmModal
        isVisible={confirmConfig.isVisible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        isDestructive={confirmConfig.isDestructive}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isVisible: false }))}
        onConfirm={confirmConfig.onConfirm}
      />
      
      <TaskQuickMenuModal 
        isVisible={isQuickMenuVisible}
        onClose={() => setQuickMenuVisible(false)}
        task={selectedTask}
        colors={colors}
        isDark={colors.background === '#121212'}
        onPressEdit={(t) => { setSelectedTask(t); setDetailsVisible(true); }}
        onPressSnooze={(t) => { setSelectedTask(t); setSnoozeVisible(true); }}
      />

      <MoveBoardModal
        isVisible={isMoveBoardVisible}
        onClose={() => setMoveBoardVisible(false)}
        onSelectBoard={handleBatchMoveBoard}
        boards={boards}
        taskCount={selectionMode.selectedTaskIds.length}
        colors={colors}
      />

      <CreateBoardModal
        isVisible={isCreateBoardVisible}
        onClose={() => setCreateBoardVisible(false)}
        onSubmit={handleCreateBoardSubmit}
        colors={colors}
      />

      <SnoozeModal 
        isVisible={isSnoozeVisible}
        onClose={() => setSnoozeVisible(false)}
        task={selectedTask}
        colors={colors}
        onOpenPremiumModal={(feature) => { setPremiumFeatureName(feature); setPremiumModalVisible(true); }}
      />

      <PremiumModal 
        isVisible={isPremiumModalVisible}
        onClose={() => setPremiumModalVisible(false)}
        featureName={premiumFeatureName}
      />

      {/* Google Navigation Drawer */}
      <GoogleDrawer
        isOpen={isGoogleDrawerOpen}
        onClose={() => dispatch(setGoogleDrawerOpen(false))}
        currentDate={dayjs().format('YYYY-MM-DD')}
        onSelectDate={(date) => {
          dispatch(setGoogleDrawerOpen(false));
          navigation.navigate('Calendar');
        }}
        onSelectView={(view) => {
          dispatch(setGoogleDrawerOpen(false));
          if (view === 'calendar') {
            navigation.navigate('Calendar');
          }
        }}
        boards={boards}
        tasks={tasks}
        colors={colors}
        isDark={isDark}
        isDesktop={false}
        onOpenCreateCategory={() => handleAddBoard()}
        onPressSettings={() => {
          dispatch(setGoogleDrawerOpen(false));
          navigation.navigate('Settings');
        }}
      />
    </KeyboardAvoidingView>
  </ScreenErrorBoundary>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    minHeight: 1, // Prevents total collapse
  },
  miniBoardsContainer: {
    flexDirection: 'row',
    height: 1,
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 1,
  },
  miniBoardLine: {
    height: '10%',
    borderRadius: 2,
  },
  boardsScroll: {
    paddingHorizontal: 15,
  },
  mainTab: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 10,
  },
  mainTabText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  addBoardBtn: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBoardText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  columnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  columnText: {
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    width: '95%',
    alignSelf: 'center',
    zIndex: 10,
  },
  sectionHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  ellipsisBtn: {
    padding: 5,
    marginLeft: 10,
  },
  sectionCheckboxBtn: {
    padding: 5,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ellipsisText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  optionsModalContent: {
    padding: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: 'center',
  },
  optionsModalDragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#999',
    borderRadius: 3,
    marginBottom: 20,
    opacity: 0.5,
  },
  optionsModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  optionBtn: {
    width: '100%',
    paddingVertical: 18,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderTopWidth: 1,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  actionBarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionBarButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  actionBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  }
});
