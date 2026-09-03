import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme } from '../styles/ThemeContext';
import { useToast } from '../styles/ToastContext';
import TaskRow from '../components/TaskRow';
import TaskDetailsModal from '../components/TaskDetailsModal';
import TaskQuickMenuModal from '../components/TaskQuickMenuModal';
import SnoozeModal from '../components/SnoozeModal';
import PremiumModal from '../components/PremiumModal';
import PromptModal from '../components/PromptModal';
import ConfirmModal from '../components/ConfirmModal';
import MoveBoardModal from '../components/MoveBoardModal';
import InlineAddTask from '../components/InlineAddTask';
import AutoManageSettings from '../components/AutoManageSettings';
import Modal from 'react-native-modal';
import getFilters, { isTaskToday, isTaskMissed } from '../utils/filters';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import Svg, { Path } from 'react-native-svg';
import { updateTask, deleteTask, addTask, deleteTasksByBoard, processAutoManageTasks } from '../features/taskSlice';
import { addBoardAsync, renameBoardAsync, deleteBoardAsync, setActiveBoardId } from '../features/userSlice';
import { setBoardsCollapsed } from '../features/themeSlice';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { shareTaskAsync } from '../../modules/expo-task-alarm';

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

export default function BoardScreen({ route, navigation }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeAddSectionId, setActiveAddSectionId] = useState(null);
  
  const isBoardsCollapsed = useSelector(state => state.themeReducer.isBoardsCollapsed);
  const showRecurringTasksOnBoard = useSelector(state => state.themeReducer.showRecurringTasksOnBoard || false);

  const toggleBoardsCollapsed = () => {
    dispatch(setBoardsCollapsed(!isBoardsCollapsed));
  };

  const { colors } = useTheme();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const tasks = useSelector(state => state.taskReducer.tasks || []);
  const boards = useSelector(state => state.userReducer.boards || [{ id: 'main', name: 'Main' }]);
  const activeBoardId = useSelector(state => state.userReducer.activeBoardId || 'main');
  const isAuthenticated = useSelector(state => state.userReducer.isAuthenticated);
  const isPremium = useSelector(state => state.entitlementReducer?.isPremium);
  
  const themeState = useSelector(state => state.themeReducer);
  const boardAutomations = useSelector(state => state.themeReducer.boardAutomations || {});

  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsVisible, setDetailsVisible] = useState(false);
  const [isQuickMenuVisible, setQuickMenuVisible] = useState(false);
  const [isSnoozeVisible, setSnoozeVisible] = useState(false);
  const [isPremiumModalVisible, setPremiumModalVisible] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');
  
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
    return ['tomorrow', 'on-this-week', 'on-next-week', 'later', 'completed'];
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

  const toggleSection = (sectionId) => {
    if (collapsedSections.includes(sectionId)) {
      setCollapsedSections(collapsedSections.filter(id => id !== sectionId));
    } else {
      setCollapsedSections([...collapsedSections, sectionId]);
    }
  };

  const toggleTaskSelection = useCallback((taskId) => {
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
    
    selectedIds.forEach(id => {
      dispatch(updateTask({ taskId: id, boardId: targetBoardId }));
    });
    
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
        selectionMode.selectedTaskIds.forEach(id => {
          dispatch(updateTask({ taskId: id, completed: true }));
        });
        setSelectionMode({ isActive: false, sectionId: null, selectedTaskIds: [] });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
      }
    });
  };

  const handleDeleteSelected = () => {
    setConfirmConfig({
      isVisible: true,
      title: 'Delete Tasks',
      message: `Are you sure you want to delete ${selectionMode.selectedTaskIds.length} tasks?`,
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: () => {
        selectionMode.selectedTaskIds.forEach(id => dispatch(deleteTask({ taskId: id })));
        setSelectionMode({ isActive: false, sectionId: null, selectedTaskIds: [] });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
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

  // Group tasks
  const boardTasks = useMemo(() => tasks.filter(task => (task.boardId || 'main') === activeBoardId), [tasks, activeBoardId]);
  
  const hiddenRecurringTaskIds = useMemo(() => {
    if (showRecurringTasksOnBoard) return new Set();

    // Group uncompleted tasks by recurringSeriesId
    const seriesMap = new Map();

    boardTasks.forEach(task => {
      if (task.completed) return;
      const seriesId = task.recurringSeriesId;
      if (!seriesId) return;

      if (!seriesMap.has(seriesId)) {
        seriesMap.set(seriesId, []);
      }
      seriesMap.get(seriesId).push(task);
    });

    const hiddenIds = new Set();

    seriesMap.forEach(taskList => {
      // Sort tasks in this series chronologically
      taskList.sort((a, b) => {
        const dayA = a.completionDate ? dayjs(a.completionDate).valueOf() : Infinity;
        const dayB = b.completionDate ? dayjs(b.completionDate).valueOf() : Infinity;
        if (dayA !== dayB) return dayA - dayB;
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;
        return parseInt(a.id || '0') - parseInt(b.id || '0');
      });

      // Missed tasks are always shown in Missed section
      // Among the non-missed uncompleted tasks, show only the first (earliest upcoming) one
      let hasFoundFirstActiveNonMissed = false;

      taskList.forEach(task => {
        if (isTaskMissed(task)) {
          // Missed task is NOT hidden (stays visible on board in missed section)
          return;
        }

        if (!hasFoundFirstActiveNonMissed) {
          // This is the earliest upcoming/today active task in the series -> show it
          hasFoundFirstActiveNonMissed = true;
        } else {
          // Subsequent upcoming tasks in the series are hidden until this one is completed or missed
          hiddenIds.add(task.id);
        }
      });
    });

    return hiddenIds;
  }, [boardTasks, showRecurringTasksOnBoard]);

  const { todayTasks, tomorrowTasks, thisWeekTasks, nextWeekTasks, laterTasks, missedTasks, completedTasks } = useMemo(() => {
    const now = dayjs();
    const FILTERS = getFilters(now);

    const sortTasks = (tasksArr, sectionId) => {
      const sortBy = sortConfig[sectionId] || 'time';
      return [...tasksArr].sort((a, b) => {
        if (sortBy === 'priority') {
          const pValues = { high: 3, medium: 2, low: 1, none: 0 };
          const pA = pValues[a.priority?.toLowerCase()] || 0;
          const pB = pValues[b.priority?.toLowerCase()] || 0;
          if (pA !== pB) return pB - pA; // Higher priority first
        }

        const dayA = a.completionDate ? a.completionDate.substring(0, 10) : '9999-12-31';
        const dayB = b.completionDate ? b.completionDate.substring(0, 10) : '9999-12-31';
        const dateCompare = dayA.localeCompare(dayB);
        if (dateCompare !== 0) return dateCompare;
        
        const hasTimeA = !!a.time;
        const hasTimeB = !!b.time;
        
        if (hasTimeA && !hasTimeB) return -1;
        if (!hasTimeA && hasTimeB) return 1;
        if (hasTimeA && hasTimeB) return a.time.localeCompare(b.time);
        
        return parseInt(a.id || '0') - parseInt(b.id || '0');
      });
    };

    return {
      todayTasks: sortTasks(boardTasks.filter(task => isTaskToday(task, now) && !hiddenRecurringTaskIds.has(task.id)), 'today'),
      tomorrowTasks: sortTasks(boardTasks.filter(task => dayjs(task.completionDate).isSame(FILTERS.tomorrow, 'day') && !task.completed && !hiddenRecurringTaskIds.has(task.id)), 'tomorrow'),
      thisWeekTasks: sortTasks(boardTasks.filter(task => !dayjs(task.completionDate).isSameOrBefore(FILTERS.today, 'day') && !dayjs(task.completionDate).isSame(FILTERS.tomorrow, 'day') && dayjs(task.completionDate).isSameOrBefore(FILTERS['on-this-week'], 'day') && !task.completed && !hiddenRecurringTaskIds.has(task.id)), 'on-this-week'),
      nextWeekTasks: sortTasks(boardTasks.filter(task => !dayjs(task.completionDate).isSame(FILTERS.tomorrow, 'day') && dayjs(task.completionDate).isAfter(FILTERS['on-this-week'], 'day') && dayjs(task.completionDate).isSameOrBefore(FILTERS['on-next-week'], 'day') && !task.completed && !hiddenRecurringTaskIds.has(task.id)), 'on-next-week'),
      laterTasks: sortTasks(boardTasks.filter(task => dayjs(task.completionDate).isAfter(FILTERS['on-next-week'], 'day') && !task.completed && !hiddenRecurringTaskIds.has(task.id)), 'later'),
      missedTasks: sortTasks(boardTasks.filter(task => isTaskMissed(task, now)), 'missed'),
      completedTasks: sortTasks(boardTasks.filter(task => task.completed), 'completed')
    };
  }, [boardTasks, sortConfig, hiddenRecurringTaskIds]);

  const sections = useMemo(() => {
    return [
      ...(missedTasks.length > 0 ? [{ id: 'missed', title: t('Missed tasks'), data: collapsedSections.includes('missed') ? [] : missedTasks, count: missedTasks.length, color: '#f44336' }] : []),
      { id: 'today', title: t('Today'), data: collapsedSections.includes('today') ? [] : todayTasks, count: todayTasks.length, color: '#ff9800' },
      { id: 'tomorrow', title: t('Tomorrow'), data: collapsedSections.includes('tomorrow') ? [] : tomorrowTasks, count: tomorrowTasks.length, color: '#2196f3' },
      { id: 'on-this-week', title: t('This week'), data: collapsedSections.includes('on-this-week') ? [] : thisWeekTasks, count: thisWeekTasks.length, color: '#9c27b0' },
      { id: 'on-next-week', title: t('Next week'), data: collapsedSections.includes('on-next-week') ? [] : nextWeekTasks, count: nextWeekTasks.length, color: '#009688' },
      { id: 'later', title: t('Upcoming'), data: collapsedSections.includes('later') ? [] : laterTasks, count: laterTasks.length, color: '#795548' },
      ...(completedTasks.length > 0 ? [{ id: 'completed', title: t('Completed'), data: collapsedSections.includes('completed') ? [] : completedTasks, count: completedTasks.length, color: '#4caf50' }] : []),
    ];
  }, [missedTasks, todayTasks, tomorrowTasks, thisWeekTasks, nextWeekTasks, laterTasks, completedTasks, collapsedSections, t]);

  React.useEffect(() => {
    if (route?.params?.sectionId) {
      setCollapsedSections(allSectionIds.filter(id => id !== route.params.sectionId));
    } else {
      setCollapsedSections(['tomorrow', 'on-this-week', 'on-next-week', 'later', 'completed']);
    }
  }, [route?.params?.sectionId]);

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

  const stickyHeaderIndices = useMemo(() => {
    return flattenedData.map((item, index) => item.type === 'header' ? index : -1).filter(i => i !== -1);
  }, [flattenedData]);

  const handleCompleteSection = (section) => {
    setConfirmConfig({
      isVisible: true,
      title: 'Complete All',
      message: `Are you sure you want to complete all tasks in "${section.title}"?`,
      confirmText: 'Complete',
      isDestructive: false,
      onConfirm: () => {
        const tasksToComplete = [...section.data];
        tasksToComplete.forEach(task => {
          dispatch(updateTask({ taskId: task.id, completed: true }));
        });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
        
        showToast(
          `${tasksToComplete.length} ${t('tasks completed')}`,
          t('Undo'),
          () => {
            tasksToComplete.forEach(task => {
              dispatch(updateTask({ taskId: task.id, completed: task.completed }));
            });
          }
        );
      }
    });
  };

  const handleMoveForward = (section) => {
    setConfirmConfig({
      isVisible: true,
      title: t('Move Forward'),
      message: `${t('Are you sure you want to move all tasks in')} "${section.title}" ${t('forward')}?`,
      confirmText: t('Move'),
      isDestructive: false,
      onConfirm: () => {
        const today = dayjs();
        let newDate;
        switch (section.id) {
            case 'missed': newDate = today.toISOString(); break;
            case 'today': newDate = today.add(1, 'day').toISOString(); break;
            case 'tomorrow': newDate = today.endOf('isoWeek').toISOString(); break;
            case 'on-this-week': newDate = today.add(1, 'week').startOf('isoWeek').toISOString(); break;
            case 'on-next-week': newDate = today.add(2, 'week').startOf('isoWeek').toISOString(); break;
            default: return;
        }
        section.data.forEach(task => {
          dispatch(updateTask({ taskId: task.id, completionDate: newDate, completed: false }));
        });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
      }
    });
  };

  const handleMoveBackward = (section) => {
    setConfirmConfig({
      isVisible: true,
      title: t('Move Backward'),
      message: `${t('Are you sure you want to move all tasks in')} "${section.title}" ${t('backward')}?`,
      confirmText: t('Move'),
      isDestructive: false,
      onConfirm: () => {
        const today = dayjs();
        let newDate;
        switch (section.id) {
            case 'today': newDate = today.subtract(1, 'day').toISOString(); break;
            case 'tomorrow': newDate = today.toISOString(); break;
            case 'on-this-week': newDate = today.add(1, 'day').toISOString(); break;
            case 'on-next-week': newDate = today.endOf('isoWeek').toISOString(); break;
            case 'later': newDate = today.add(1, 'week').startOf('isoWeek').toISOString(); break;
            default: return;
        }
        section.data.forEach(task => {
          dispatch(updateTask({ taskId: task.id, completionDate: newDate, completed: false }));
        });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
      }
    });
  };

  const handleDeleteSection = (section) => {
    let tasksToDelete = [];
    switch (section.id) {
      case 'missed': tasksToDelete = missedTasks; break;
      case 'today': tasksToDelete = todayTasks; break;
      case 'tomorrow': tasksToDelete = tomorrowTasks; break;
      case 'on-this-week': tasksToDelete = thisWeekTasks; break;
      case 'on-next-week': tasksToDelete = nextWeekTasks; break;
      case 'later': tasksToDelete = laterTasks; break;
      case 'completed': tasksToDelete = completedTasks; break;
      default: tasksToDelete = section.data || [];
    }

    setConfirmConfig({
      isVisible: true,
      title: 'Delete All',
      message: `Are you sure you want to delete all tasks in "${section.title}"?`,
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: () => {
        tasksToDelete.forEach(task => {
          dispatch(deleteTask({ taskId: task.id }));
        });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
        
        showToast(
          `${tasksToDelete.length} ${t('tasks deleted')}`,
          t('Undo'),
          () => {
            tasksToDelete.forEach(task => {
              dispatch(addTask({ task }));
            });
          }
        );
      }
    });
  };

  const handleMenuPress = (section) => {
    setSectionOptionsConfig({ isVisible: true, section });
  };

  const handleAddBoard = () => {
    const boardLimit = isAuthenticated ? 6 : 2;
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
    setPromptConfig({ isVisible: true, type: 'add', targetBoard: null });
  };

  const handleBoardOptions = (board) => {
    if (board.id === 'main') return;
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

  const renderSectionHeader = ({ section }) => {
    const isCollapsed = collapsedSections.includes(section.id);
    return (
      <View style={[styles.sectionHeader, { backgroundColor: colors.bgMain, borderBottomColor: `${section.color}33` }]}>
        <TouchableOpacity 
          accessible={true} accessibilityRole="button" accessibilityLabel={`${section.title} section, ${section.count} tasks`} accessibilityState={{ expanded: !isCollapsed }}
          style={styles.sectionHeaderLeft} onPress={() => toggleSection(section.id)}
        >
          <Text testID={`section_title_${section.id}`} style={[styles.sectionTitle, { color: colors.textPrimary, marginLeft: 0 }]}>{section.title}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.badge, { backgroundColor: `${section.color}20` }]}
          onPress={() => toggleSection(section.id)}
        >
          <Text style={[styles.badgeText, { color: section.color }]}>{section.count}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          accessible={true} accessibilityRole="button" accessibilityLabel={`Toggle ${section.title} section`}
          onPress={() => toggleSection(section.id)} style={{ padding: 5, marginLeft: 10 }}
        >
          <IconChevronDown color={isCollapsed ? section.color : colors.textSecondary} isCollapsed={isCollapsed} />
        </TouchableOpacity>

        <TouchableOpacity 
          testID={`section_menu_${section.id}`}
          accessible={true} accessibilityRole="button" accessibilityLabel={`Options for ${section.title} section`}
          style={styles.ellipsisBtn} 
          onPress={() => handleMenuPress(section)}
        >
          <Text style={[styles.ellipsisText, { color: colors.textSecondary }]}>⋮</Text>
        </TouchableOpacity>
      </View>
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

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.bgMain }} 
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      
      {/* Top Tabs */}
      <Animated.View layout={LinearTransition.duration(300)} style={[styles.topBar, { borderBottomColor: colors.borderColor, paddingTop: isBoardsCollapsed ? 0 : 10, alignItems: 'center' }]}>
        <View style={{ flex: 1, overflow: 'hidden' }}>
          {isBoardsCollapsed ? (
            <TouchableOpacity onPress={toggleBoardsCollapsed} activeOpacity={0.8} style={{ flex: 1, justifyContent: 'center' }}>
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.miniBoardsContainer}>
                {boards.map(board => (
                  <View 
                    key={board.id} 
                    style={[
                      styles.miniBoardLine, 
                      { 
                        backgroundColor: activeBoardId === board.id ? colors.primary : colors.textSecondary,
                        flex: activeBoardId === board.id ? 2 : 1, 
                      }
                    ]} 
                  />
                ))}
              </Animated.View>
            </TouchableOpacity>
          ) : (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boardsScroll}>
                {boards.map(board => (
                  <TouchableOpacity 
                    key={board.id} 
                    accessible={true} accessibilityRole="tab" accessibilityLabel={`Board ${board.name === 'Main' ? t('Main') : board.name}`} accessibilityState={{ selected: activeBoardId === board.id }}
                    style={[
                      styles.mainTab, 
                      activeBoardId === board.id && { borderBottomColor: colors.primary },
                      { flexDirection: 'row', alignItems: 'center' }
                    ]}
                    onPress={() => dispatch(setActiveBoardId(board.id))}
                    onLongPress={() => handleBoardOptions(board)}
                  >
                    <Text style={[
                      styles.mainTabText, 
                      { color: activeBoardId === board.id ? colors.primary : colors.textSecondary }
                    ]}>{board.name === 'Main' ? t('Main') : board.name}</Text>
                    {(() => {
                      const count = tasks.filter(t => (t.boardId || 'main') === board.id && !t.completed).length;
                      if (count > 0) {
                        return (
                          <View style={{
                            backgroundColor: activeBoardId === board.id ? `${colors.primary}20` : `${colors.textSecondary}20`,
                            borderRadius: 10,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            marginLeft: 6
                          }}>
                            <Text style={{
                              color: activeBoardId === board.id ? colors.primary : colors.textSecondary,
                              fontSize: 10,
                              fontWeight: 'bold'
                            }}>{count}</Text>
                          </View>
                        );
                      }
                      return null;
                    })()}
                  </TouchableOpacity>
                ))}
                {boards.length < 3 && (
                  <TouchableOpacity 
                    accessible={true} accessibilityRole="button" accessibilityLabel="Add new board"
                    style={styles.addBoardBtn} onPress={handleAddBoard}
                  >
                    <Text style={[styles.addBoardText, { color: colors.textSecondary }]}>+</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </Animated.View>
          )}
        </View>

      </Animated.View>

      <FlashList
        data={flattenedData}
        keyExtractor={(item, index) => item.type === 'task' ? `task_${item.task.id}` : `${item.type}_${item.section.id}_${index}`}
        getItemType={(item) => item.type}
        renderItem={({ item }) => {
          if (item.type === 'header') return renderSectionHeader({ section: item.section });
          if (item.type === 'footer') return renderSectionFooter({ section: item.section });
          if (item.type === 'task') {
            const task = item.task;
            const section = item.section;
            return (
              <TaskRow 
                task={task} 
                isSelectionMode={selectionMode.isActive}
                isSelected={selectionMode.selectedTaskIds.includes(task.id)}
                onToggleSelect={() => {
                  if (!selectionMode.isActive) {
                    setSelectionMode({ isActive: true, sectionId: section.id, selectedTaskIds: [task.id] });
                  } else {
                    toggleTaskSelection(task.id);
                  }
                }}
                onPressSnooze={(t) => { setSelectedTask(t); setSnoozeVisible(true); }}
                onPressMore={(t) => { setSelectedTask(t); setQuickMenuVisible(true); }}
                onPress={() => {
                  setSelectedTask(task);
                  setDetailsVisible(true);
                }}
              />
            );
          }
          return null;
        }}
        extraData={[collapsedSections, activeAddSectionId, tasks.length, colors]}
        contentContainerStyle={styles.listContent}
        stickyHeaderIndices={stickyHeaderIndices}
        keyboardShouldPersistTaps="handled"
        estimatedItemSize={70}
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
          
          <TouchableOpacity testID="section_option_sort_time" accessible={true} accessibilityRole="button" accessibilityLabel="Sort by Time" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setSortConfig(prev => ({...prev, [sectionOptionsConfig.section?.id]: 'time'})); setSectionOptionsConfig({ isVisible: false, section: null }); }}>
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Sort by Time')}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="section_option_sort_priority" accessible={true} accessibilityRole="button" accessibilityLabel="Sort by Priority" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setSortConfig(prev => ({...prev, [sectionOptionsConfig.section?.id]: 'priority'})); setSectionOptionsConfig({ isVisible: false, section: null }); }}>
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Sort by Priority')}</Text>
          </TouchableOpacity>

          {isPremium && (
            <TouchableOpacity testID="section_option_select_tasks" accessible={true} accessibilityRole="button" accessibilityLabel="Select Tasks" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { 
              setSelectionMode({ isActive: true, sectionId: sectionOptionsConfig.section?.id, selectedTaskIds: [] }); 
              setSectionOptionsConfig({ isVisible: false, section: null }); 
            }}>
              <Text style={[styles.optionText, { color: colors.primary }]}>{t('Select Tasks')}</Text>
            </TouchableOpacity>
          )}
          
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

          {sectionOptionsConfig.section?.id !== 'completed' && sectionOptionsConfig.section?.id !== 'missed' && (
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
          <Text style={[styles.optionsModalTitle, { color: colors.textPrimary }]}>
            {t('Board')}: {boardOptionsConfig.board?.name}
          </Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 15, paddingHorizontal: 20 }}>
            {t('What would you like to do?')}
          </Text>
          
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
                  dispatch(deleteTasksByBoard(board.id));
                  setConfirmConfig(prev => ({ ...prev, isVisible: false }));
                }
              });
            }, 400);
          }}>
            <Text style={{ color: '#f44336', fontSize: 16, fontWeight: 'bold' }}>{t('Delete')}</Text>
          </TouchableOpacity>

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
        <View style={[styles.actionBar, { backgroundColor: colors.bgCard, borderTopColor: colors.borderColor }]}>
          <Text style={[styles.actionBarText, { color: colors.textPrimary }]}>{selectionMode.selectedTaskIds.length} {t('Selected')}</Text>
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
    </KeyboardAvoidingView>
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
