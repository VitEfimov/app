import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, FlatList, KeyboardAvoidingView, Platform, Share, TextInput, LayoutAnimation, UIManager, useWindowDimensions, Keyboard, Modal as RNModal } from 'react-native';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme } from '../styles/ThemeContext';
import { useToast } from '../styles/ToastContext';
import TaskRow, { closeOpenSwipeableRow, cancelAllInlineEditing, getCachedTaskAmount } from '../components/TaskRow';
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
import { TaskEditDiagnostics } from '../utils/taskEditDiagnostics';
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
import { getBoardColor, BOARD_COLORS, BOARD_COLOR_NAMES } from '../utils/boardColors';
import * as FileSystem from 'expo-file-system';
import { shareTaskAsync } from '../../modules/expo-task-alarm';
import ScreenErrorBoundary from '../components/ScreenErrorBoundary';
import { A11yHelper } from '../utils/a11yHelper';
import { ResponsiveHelper } from '../utils/responsiveHelper';
import { SecurityLockHelper } from '../utils/securityLockHelper';
import { MemoryPressureGuard } from '../utils/memoryPressureGuard';

function getRNShare() {
  if (Platform.OS === 'web' || Platform.OS === 'android') return null;
  try {
    return require('react-native-share').default;
  } catch (e) {
    return null;
  }
}

// Resolve @shopify/flash-list v2 when running on React Native New Architecture (Fabric).
// Explicitly verifies v2+ (exports useLayoutState) so a legacy v1 binary/package can never
// crash native Android ScrollView with v2-only props; falls back cleanly to ScrollView / FlatList.
let FabricFlashList = null;
const isNativeFabricActive =
  Platform.OS !== 'web' &&
  typeof global !== 'undefined' &&
  (Boolean(global.nativeFabricUIManager) ||
    Boolean(global.__turboModuleProxy) ||
    global.RN$Bridgeless === true);
if (isNativeFabricActive) {
  try {
    const flashListPkg = require('@shopify/flash-list');
    if (flashListPkg && typeof flashListPkg.useLayoutState === 'function') {
      FabricFlashList = flashListPkg.FlashList;
    }
  } catch (e) {
    FabricFlashList = null;
  }
}

// Responsive Web CSS for ultra-narrow screens (< 300px)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  try {
    if (!document.getElementById('responsive-expenses-css')) {
      const style = document.createElement('style');
      style.id = 'responsive-expenses-css';
      style.textContent = `@media (max-width: 300px) { #expenses-title-label { display: none !important; } }`;
      document.head.appendChild(style);
    }
  } catch (e) {}
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
        accessible={true} 
        accessibilityRole="header" 
        accessibilityLabel={`${section.title} section, ${section.count} ${section.count === 1 ? 'task' : 'tasks'}`} 
        accessibilityState={{ expanded: !isCollapsed }}
        accessibilityHint={isCollapsed ? 'Double tap to expand section' : 'Double tap to collapse section'}
        style={[styles.sectionHeaderLeft, { flexDirection: 'row', alignItems: 'center' }]} 
        onPress={() => onToggleSection(section.id)}
      >
        <Text testID={`section_title_${section.id}`} style={[styles.sectionTitle, { color: colors.textPrimary, marginLeft: 0 }]}>
          {section.title}
        </Text>
        <View style={[styles.badge, { backgroundColor: `${section.color}20` }]} accessible={false} importantForAccessibility="no">
          <Text style={[styles.badgeText, { color: section.color }]}>{section.count}</Text>
        </View>
        <View style={{ padding: 5, marginLeft: 10 }} accessible={false} importantForAccessibility="no">
          <IconChevronDown color={isCollapsed ? section.color : colors.textSecondary} isCollapsed={isCollapsed} />
        </View>
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

const DEFAULT_COLLAPSED_SECTIONS = ['missed', 'on-this-week', 'on-next-week', 'later', 'completed'];
let currentSessionCollapsedSections = [...DEFAULT_COLLAPSED_SECTIONS];

const NATIVE_SCROLL_ROW_LIMIT = 150;
const PROGRESSIVE_INITIAL_BATCH = 32;
const PROGRESSIVE_FRAME_STEP = 32;

export default function BoardScreen({ route, navigation }) {
  const { width: windowWidth } = useWindowDimensions();
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
  const [listFilterCategory, setListFilterCategory] = useState('All');
  const [expensesPeriodFilter, setExpensesPeriodFilter] = useState('month');

  useEffect(() => {
    setListFilterCategory('All');
    setExpensesPeriodFilter('month');
  }, [activeBoardId]);

  const getTaskAmount = getCachedTaskAmount;

  const getHabitTimeCategory = useCallback((task) => {
    if (!task) return 'Anytime';
    if (task.itemCategory && ['Morning', 'Afternoon', 'Evening', 'Anytime'].includes(task.itemCategory)) {
      if (task.itemCategory !== 'Anytime') return task.itemCategory;
    }
    if (task.time && typeof task.time === 'string' && task.time.includes(':')) {
      const [h] = task.time.split(':');
      const hour = parseInt(h, 10);
      if (!isNaN(hour)) {
        if (hour >= 4 && hour < 12) return 'Morning';
        if (hour >= 12 && hour < 17) return 'Afternoon';
        if (hour >= 17 && hour <= 23) return 'Evening';
      }
    }
    return task.itemCategory || 'Anytime';
  }, []);

  const allSectionIds = ['missed', 'today', 'tomorrow', 'on-this-week', 'on-next-week', 'later', 'completed'];
  const INITIAL_SECTION_PAGE_SIZE = 30;
  const SECTION_PAGE_INCREMENT = 40;

  const [sectionVisibleCounts, setSectionVisibleCounts] = useState({});

  const [collapsedSections, setCollapsedSections] = useState(() => {
    if (route?.params?.sectionId) {
      const target = allSectionIds.filter(id => id !== route.params.sectionId);
      currentSessionCollapsedSections = target;
      return target;
    }
    return currentSessionCollapsedSections;
  });

  useEffect(() => {
    if (route?.params?.sectionId) {
      const target = allSectionIds.filter(id => id !== route.params.sectionId);
      currentSessionCollapsedSections = target;
      setCollapsedSections(target);
    }
  }, [route?.params?.sectionId]);

  useFocusEffect(
    useCallback(() => {
      dispatch(processAutoManageTasks());
    }, [dispatch])
  );

  // Security & Privacy Shield: Immediately dismiss all modals and inline editing when device locks
  useEffect(() => {
    const unsubscribe = SecurityLockHelper.subscribeLock(() => {
      setDetailsVisible(false);
      setSnoozeVisible(false);
      setQuickMenuVisible(false);
      cancelAllInlineEditing();
      try { Keyboard?.dismiss?.(); } catch (e) {}
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unregisterGuard = MemoryPressureGuard.registerCleanupHook('BoardScreen', () => {
      closeOpenSwipeableRow?.();
      cancelAllInlineEditing?.();
      setQuickMenuVisible(prev => (prev ? false : prev));
      setSectionOptionsConfig(prev => (prev.isVisible ? { isVisible: false, section: null } : prev));
    });
    return unregisterGuard;
  }, []);

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
    // FlashList + Android native LayoutAnimation on large datasets (> 15 items) causes native SIGSEGV/crash
    const isLargeList = (tasks && tasks.length > 30);
    if (!isLargeList && Platform.OS !== 'android') {
      try {
        if (Platform.OS !== 'web' && UIManager.setLayoutAnimationEnabledExperimental) {
          UIManager.setLayoutAnimationEnabledExperimental(true);
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch (e) {
        // Safe fallback on layout mutations
      }
    }
    setCollapsedSections(prev => {
      const willCollapse = !prev.includes(sectionId);
      A11yHelper.announce(willCollapse ? `${sectionId} section collapsed` : `${sectionId} section expanded`);
      if (willCollapse) {
        setSectionVisibleCounts(counts => {
          if (!counts[sectionId]) return counts;
          const nextCounts = { ...counts };
          delete nextCounts[sectionId];
          return nextCounts;
        });
      }
      const next = prev.includes(sectionId) ? prev.filter(id => id !== sectionId) : [...prev, sectionId];
      currentSessionCollapsedSections = next;
      return next;
    });
  }, [tasks]);

  const toggleTaskSelection = useCallback((taskId) => {
    if (Platform.OS !== 'android') {
      try {
        if (Platform.OS !== 'web' && UIManager.setLayoutAnimationEnabledExperimental) {
          UIManager.setLayoutAnimationEnabledExperimental(true);
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch (e) {}
    }
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
          const rnShare = getRNShare();
          if (rnShare) {
            await rnShare.open({ urls: urlsToShare, type: '*/*', title: 'Share Tasks', failOnCancel: false });
          } else {
            await Share.share({ message: `Tasks:\n\n${shareText}` });
          }
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
    TaskEditDiagnostics.record('BOARD_SCREEN_HANDLE_TASK_PRESS', {
      taskId: task?.id || task?._id,
      name: task?.taskname || task?.name,
    });
    cancelAllInlineEditing();
    setActiveAddSectionId(null);
    try { Keyboard?.dismiss?.(); } catch (e) {}
    setSelectedTask(task);
    setDetailsVisible(true);
  }, []);

  const handleSnoozePress = useCallback((task) => {
    cancelAllInlineEditing();
    setActiveAddSectionId(null);
    try { Keyboard?.dismiss?.(); } catch (e) {}
    setSelectedTask(task);
    setSnoozeVisible(true);
  }, []);

  const handleQuickMenuPress = useCallback((task) => {
    cancelAllInlineEditing();
    setActiveAddSectionId(null);
    try { Keyboard?.dismiss?.(); } catch (e) {}
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

  const isRepeatingTask = useCallback((task) => {
    if (!task) return false;
    return !!(
      task.recurringSeriesId ||
      task.isRecurring === true || task.isRecurring === 'true' || task.isRecurring === 1 ||
      (task.repeatConfig && task.repeatConfig.preset && task.repeatConfig.preset !== 'None' && task.repeatConfig.preset !== 'none') ||
      (task.repeatFrequency && task.repeatFrequency !== 'None' && task.repeatFrequency !== 'none') ||
      (task.repeat && task.repeat !== 'none' && task.repeat !== 'None')
    );
  }, []);

  // Single-pass O(N) deduplication of recurring tasks (eliminates per-series sorting allocations)
  const hiddenRecurringTaskIds = useMemo(() => {
    const hiddenIds = new Set();
    const todayStr = dayjs().format('YYYY-MM-DD');

    const addToHidden = (id) => {
      if (id === undefined || id === null) return;
      hiddenIds.add(id);
      hiddenIds.add(String(id));
      const num = Number(id);
      if (!isNaN(num)) hiddenIds.add(num);
    };

    // When toggle is ON ('Show recurring tasks'): Show ALL recurring tasks!
    if (showRecurringTasksOnBoard) {
      return hiddenIds; // empty Set -> show all tasks
    }

    // When toggle is OFF ('Do not show recurring tasks'): Show JUST NEXT ONE!
    // Deduplicate each recurring series so only the single next (earliest upcoming) occurrence appears
    const earliestSeriesMap = new Map();
    for (const task of boardTasks) {
      if (!task || task.completed) continue;
      const isRepeating = isRepeatingTask(task);
      const titleKey = String(task.taskname || task.name || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const rawBId = String(task.boardId || task.board_id || 'main');
      const seriesKey = task.recurringSeriesId
        ? ('series_' + task.recurringSeriesId)
        : (isRepeating && titleKey ? (`title_${rawBId}_${titleKey}`) : null);
      if (!seriesKey) continue;

      const dateStr = getTaskDateStr(task);
      if (dateStr && dateStr < todayStr) continue; // Missed tasks remain visible in Missed section

      const existing = earliestSeriesMap.get(seriesKey);
      const taskId = task.id || task._id;

      if (!existing) {
        earliestSeriesMap.set(seriesKey, { task, taskId, dateStr: dateStr || '9999-12-31' });
      } else {
        const taskVal = dateStr || '9999-12-31';
        const existingVal = existing.dateStr;

        if (taskVal < existingVal) {
          addToHidden(existing.taskId);
          earliestSeriesMap.set(seriesKey, { task, taskId, dateStr: taskVal });
        } else {
          addToHidden(taskId);
        }
      }
    }

    return hiddenIds;
  }, [boardTasks, showRecurringTasksOnBoard, activeBoard, isRepeatingTask]);

  const isCompletedCollapsed = collapsedSections.includes('completed');

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
      const hasDate = !!(task.completionDate || task.dateString || task.dueDate || task.date);
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
        const taskId = task.id || task._id;
        const isHidden = hiddenRecurringTaskIds.has(taskId) || 
          (taskId !== undefined && taskId !== null && hiddenRecurringTaskIds.has(String(taskId))) ||
          (!isNaN(Number(taskId)) && hiddenRecurringTaskIds.has(Number(taskId)));

        if (isHidden) continue;

        buckets.todo.push(item);

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
  }, [boardTasks, sortConfig, hiddenRecurringTaskIds, isCompletedCollapsed]);

  const sections = useMemo(() => {
    const isCompletedCollapsed = collapsedSections.includes('completed');
    const actualCompletedCount = completedTasks.length > 0 ? completedTasks.length : completedCount;

    if (['simple_list', 'shopping', 'grocery', 'packing', 'habits', 'media'].includes(activeBoard?.type)) {
      const missedIdSet = new Set(missedTasks.map(m => m.id || m._id));
      let listUncompleted = todoTasks.filter(t => !missedIdSet.has(t.id || t._id));
      if (['packing', 'habits', 'media'].includes(activeBoard?.type) && listFilterCategory !== 'All') {
        listUncompleted = listUncompleted.filter(t => {
          if (activeBoard?.type === 'packing') return (t.itemCategory || 'Carry-On') === listFilterCategory;
          if (activeBoard?.type === 'habits') return getHabitTimeCategory(t) === listFilterCategory;
          if (activeBoard?.type === 'media') return (t.itemCategory || 'Books') === listFilterCategory;
          return true;
        });
      }

      let todoTitle = t('List') || 'List';
      let doneTitle = t('Completed') || 'Completed';

      if (activeBoard?.type === 'grocery' || activeBoard?.type === 'shopping') {
        todoTitle = t('To Buy') || 'To Buy';
        doneTitle = t('In Cart') || 'In Cart';
      } else if (activeBoard?.type === 'packing') {
        todoTitle = t('To Pack') || 'To Pack';
        doneTitle = t('Packed') || 'Packed';
      } else if (activeBoard?.type === 'habits') {
        todoTitle = t("Today's Habits") || "Today's Habits";
        doneTitle = t('Done Today') || 'Done Today';
      } else if (activeBoard?.type === 'media') {
        todoTitle = t('Watchlist & Reading') || 'Watchlist & Reading';
        doneTitle = t('Finished') || 'Finished';
      }

      return [
        ...(missedTasks.length > 0 ? [{ id: 'missed', title: t('Missed tasks'), data: collapsedSections.includes('missed') ? [] : missedTasks, count: missedTasks.length, color: '#f44336' }] : []),
        { id: 'today', title: todoTitle, data: collapsedSections.includes('today') ? [] : listUncompleted, count: listUncompleted.length, color: activeBoard?.color || '#10B981' },
        ...(actualCompletedCount > 0 ? [{ id: 'completed', title: doneTitle, data: isCompletedCollapsed ? [] : completedTasks, count: actualCompletedCount, color: '#4CAF50' }] : [])
      ];
    }

    const isExpenses = activeBoard?.type === 'expenses';

    return [
      ...(missedTasks.length > 0 ? [{
        id: 'missed',
        title: isExpenses ? (t('Overdue Bills') || 'Overdue Bills') : t('Missed tasks'),
        data: collapsedSections.includes('missed') ? [] : missedTasks,
        count: missedTasks.length,
        color: '#f44336'
      }] : []),
      {
        id: 'today',
        title: t('Today'),
        data: collapsedSections.includes('today') ? [] : todayTasks,
        count: todayTasks.length,
        color: '#ff9800'
      },
      {
        id: 'tomorrow',
        title: t('Tomorrow'),
        data: collapsedSections.includes('tomorrow') ? [] : tomorrowTasks,
        count: tomorrowTasks.length,
        color: '#2196f3'
      },
      {
        id: 'on-this-week',
        title: t('This week'),
        data: collapsedSections.includes('on-this-week') ? [] : thisWeekTasks,
        count: thisWeekTasks.length,
        color: '#9c27b0'
      },
      {
        id: 'on-next-week',
        title: t('Next week'),
        data: collapsedSections.includes('on-next-week') ? [] : nextWeekTasks,
        count: nextWeekTasks.length,
        color: '#009688'
      },
      {
        id: 'later',
        title: t('Upcoming'),
        data: collapsedSections.includes('later') ? [] : laterTasks,
        count: laterTasks.length,
        color: '#795548'
      },
      ...(actualCompletedCount > 0 ? [{
        id: 'completed',
        title: isExpenses ? (t('Paid Bills') || 'Paid Bills') : (t('Completed') || 'Completed'),
        data: isCompletedCollapsed ? [] : completedTasks,
        count: actualCompletedCount,
        color: '#4caf50'
      }] : []),
    ];
  }, [activeBoard?.type, activeBoard?.color, listFilterCategory, missedTasks, todayTasks, tomorrowTasks, thisWeekTasks, nextWeekTasks, laterTasks, completedTasks, completedCount, todoTasks, upcomingBirthdayTasks, needToBuyTasks, collapsedSections, t]);

  const flattenedData = useMemo(() => {
    const result = [];
    sections.forEach(section => {
      result.push({ type: 'header', section, uniqueKey: `header_${section.id}` });
      if (section.data && section.data.length > 0) {
        const visibleLimit = sectionVisibleCounts[section.id] || INITIAL_SECTION_PAGE_SIZE;
        const visibleTasks = section.data.length > visibleLimit
          ? section.data.slice(0, visibleLimit)
          : section.data;
        const seenTaskIds = new Map();
        visibleTasks.forEach((task, idx) => {
          const rawId = task?.id || task?._id || `idx_${idx}`;
          const baseKey = `task_${rawId}_${section.id}`;
          const count = seenTaskIds.get(baseKey) || 0;
          seenTaskIds.set(baseKey, count + 1);
          const uniqueKey = count === 0 ? baseKey : `${baseKey}_dup_${count}`;
          result.push({ type: 'task', task, section, uniqueKey });
        });
        if (section.data.length > visibleLimit) {
          result.push({
            type: 'show_more',
            section,
            remainingCount: section.data.length - visibleLimit,
            totalCount: section.data.length,
            uniqueKey: `show_more_${section.id}`,
          });
        }
      }
      if (section.id !== 'completed' && section.id !== 'missed' && !collapsedSections.includes(section.id)) {
        result.push({ type: 'footer', section, uniqueKey: `footer_${section.id}` });
      }
    });
    return result;
  }, [sections, sectionVisibleCounts, collapsedSections]);

  const allHiddenRecurringTaskIds = useMemo(() => {
    if (showRecurringTasksOnBoard) return new Set();
    const hiddenIds = new Set();
    const todayStr = dayjs().format('YYYY-MM-DD');

    const addToHidden = (id) => {
      if (id === undefined || id === null) return;
      hiddenIds.add(id);
      hiddenIds.add(String(id));
      const num = Number(id);
      if (!isNaN(num)) hiddenIds.add(num);
    };

    const earliestSeriesMap = new Map();
    for (const task of tasks) {
      if (!task || task.completed) continue;
      const isRepeating = isRepeatingTask(task);
      const titleKey = String(task.taskname || task.name || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const rawBId = String(task.boardId || task.board_id || 'main');
      const seriesKey = task.recurringSeriesId
        ? ('series_' + task.recurringSeriesId)
        : (isRepeating && titleKey ? (`title_${rawBId}_${titleKey}`) : null);
      if (!seriesKey) continue;

      const dateStr = getTaskDateStr(task);
      if (dateStr && dateStr < todayStr) continue;

      const existing = earliestSeriesMap.get(seriesKey);
      const taskId = task.id || task._id;
      if (!existing) {
        earliestSeriesMap.set(seriesKey, { task, taskId, dateStr: dateStr || '9999-12-31' });
      } else {
        const taskVal = dateStr || '9999-12-31';
        const existingVal = existing.dateStr;
        if (taskVal < existingVal) {
          addToHidden(existing.taskId);
          earliestSeriesMap.set(seriesKey, { task, taskId, dateStr: taskVal });
        } else {
          addToHidden(taskId);
        }
      }
    }
    return hiddenIds;
  }, [tasks, showRecurringTasksOnBoard, isRepeatingTask]);

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
      const tid = t.id || t._id;
      if (!showRecurringTasksOnBoard && (allHiddenRecurringTaskIds.has(tid) || allHiddenRecurringTaskIds.has(String(tid)))) continue;
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
  }, [tasks, boards, mainBoardId, showRecurringTasksOnBoard, allHiddenRecurringTaskIds]);

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

  const selectedTaskIdsSet = useMemo(() => new Set(selectionMode.selectedTaskIds), [selectionMode.selectedTaskIds]);

  const renderSectionHeader = useCallback(({ section }) => {
    const isCollapsed = collapsedSections.includes(section.id);
    let isAllSectionSelected = false;
    let isPartiallySelected = false;

    if (selectionMode.isActive) {
      const sectionTasks = getSectionTasks(section);
      const sectionTaskIds = sectionTasks.map(t => t.id || t._id);
      const selectedCountInSection = sectionTaskIds.filter(id => selectedTaskIdsSet.has(id)).length;
      isAllSectionSelected = sectionTasks.length > 0 && selectedCountInSection === sectionTasks.length;
      isPartiallySelected = selectedCountInSection > 0 && !isAllSectionSelected;
    }

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
  }, [collapsedSections, selectionMode.isActive, getSectionTasks, selectedTaskIdsSet, toggleSection, handleMenuPress, handleToggleSelectSection]);

  const handleInlineAddToggle = useCallback((sectionId, active) => {
    setActiveAddSectionId(active ? sectionId : null);
    if (active) setSelectionMode({ isActive: false, sectionId: null, selectedTaskIds: [] });
  }, []);

  const handleInlineAddDetails = useCallback((task) => {
    setSelectedTask(task);
    setDetailsVisible(true);
  }, []);

  const renderSectionFooter = useCallback(({ section }) => {
    return (
      <InlineAddTask 
        sectionId={section.id} 
        isActive={activeAddSectionId === section.id}
        onToggleSection={handleInlineAddToggle}
        onAddDetails={handleInlineAddDetails}
      />
    );
  }, [activeAddSectionId, handleInlineAddToggle, handleInlineAddDetails]);

  const renderShowMoreRow = useCallback((item) => {
    const sectionId = item.section?.id;
    const remaining = item.remainingCount || 0;
    const nextBatch = Math.min(remaining, SECTION_PAGE_INCREMENT);
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          paddingVertical: 10,
          paddingHorizontal: 16,
          width: '95%',
          alignSelf: 'center',
          borderBottomWidth: 1,
          borderBottomColor: colors.borderColor,
        }}
      >
        <TouchableOpacity
          testID={`show_more_btn_${sectionId}`}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Show ${nextBatch} more tasks in ${item.section?.title}`}
          onPress={() => {
            setSectionVisibleCounts(prev => ({
              ...prev,
              [sectionId]: (prev[sectionId] || INITIAL_SECTION_PAGE_SIZE) + SECTION_PAGE_INCREMENT,
            }));
          }}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 14,
            backgroundColor: colors.bgCard,
            borderWidth: 1,
            borderColor: colors.primary,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
            {`${t('Show more') || 'Show more'} (+${nextBatch} / ${remaining} ${t('left') || 'left'})`}
          </Text>
        </TouchableOpacity>

        {remaining > SECTION_PAGE_INCREMENT && (
          <TouchableOpacity
            testID={`show_all_btn_${sectionId}`}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Show all ${item.totalCount} tasks in ${item.section?.title}`}
            onPress={() => {
              setSectionVisibleCounts(prev => ({
                ...prev,
                [sectionId]: item.totalCount,
              }));
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 14,
              backgroundColor: colors.bgCard,
              borderWidth: 1,
              borderColor: colors.borderColor,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textSecondary }}>
              {`${t('Show all') || 'Show all'} (${item.totalCount})`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [colors.bgCard, colors.borderColor, colors.primary, colors.textSecondary, t]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'header') return renderSectionHeader({ section: item.section });
    if (item.type === 'footer') return renderSectionFooter({ section: item.section });
    if (item.type === 'show_more') return renderShowMoreRow(item);
    if (item.type === 'task') {
      const task = item.task;
      const section = item.section;
      const activeType = activeBoard?.type || 'standard';
      const isListBoard = ['simple_list', 'shopping', 'grocery', 'packing', 'habits', 'media'].includes(activeType);
      return (
        <TaskRow 
          task={task} 
          sectionId={section.id}
          boardTypeProp={activeType}
          hideDate={isListBoard}
          hideBoardBadge={true}
          isSelectionMode={selectionMode.isActive}
          isSelected={selectedTaskIdsSet.has(task.id) || selectedTaskIdsSet.has(task._id)}
          onToggleSelect={handleToggleSelectTask}
          onPressSnooze={handleSnoozePress}
          onPressMore={isListBoard ? undefined : handleQuickMenuPress}
          onPress={handleTaskPress}
        />
      );
    }
    return null;
  }, [renderSectionHeader, renderSectionFooter, renderShowMoreRow, activeBoard?.type, selectionMode.isActive, selectedTaskIdsSet, handleToggleSelectTask, handleSnoozePress, handleQuickMenuPress, handleTaskPress]);

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
    expensesPeriodFilter,
    listFilterCategory,
    isNarrow: windowWidth < 300,
  }), [activeBoardId, activeAddSectionId, tasks.length, boardTasks, collapsedSections, sortConfig, selectionMode.isActive, selectedTaskIdsSet.size, flattenedData.length, mode, isDark, colors.bgMain, colors.textPrimary, expensesPeriodFilter, listFilterCategory, windowWidth]);

  const flashListRef = useRef(null);
  const nativeScrollRef = useRef(null);
  const flatListRef = useRef(null);
  const prevScrolledBoardRef = useRef(activeBoardId);
  const [progressiveRenderState, setProgressiveRenderState] = useState(() => ({
    boardId: activeBoardId,
    limit: PROGRESSIVE_INITIAL_BATCH,
  }));

  const useFabricFlashList = Boolean(FabricFlashList);
  const useNativeScroll = !useFabricFlashList && flattenedData.length <= NATIVE_SCROLL_ROW_LIMIT;
  const effectiveProgressiveLimit =
    progressiveRenderState.boardId === activeBoardId
      ? progressiveRenderState.limit
      : PROGRESSIVE_INITIAL_BATCH;

  useEffect(() => {
    if (prevScrolledBoardRef.current !== activeBoardId) {
      prevScrolledBoardRef.current = activeBoardId;
      try {
        flashListRef.current?.scrollToOffset?.({ offset: 0, animated: false });
        nativeScrollRef.current?.scrollTo?.({ y: 0, animated: false });
        flatListRef.current?.scrollToOffset?.({ offset: 0, animated: false });
      } catch (e) {}
    }
  }, [activeBoardId]);

  useEffect(() => {
    if (!useNativeScroll) return;

    if (progressiveRenderState.boardId !== activeBoardId) {
      const rafId = requestAnimationFrame(() => {
        setProgressiveRenderState({
          boardId: activeBoardId,
          limit: Math.min(
            Math.max(PROGRESSIVE_INITIAL_BATCH, flattenedData.length),
            PROGRESSIVE_INITIAL_BATCH + PROGRESSIVE_FRAME_STEP
          ),
        });
      });
      return () => cancelAnimationFrame(rafId);
    }

    if (progressiveRenderState.limit < flattenedData.length) {
      const rafId = requestAnimationFrame(() => {
        setProgressiveRenderState(prev => ({
          boardId: activeBoardId,
          limit: Math.min(flattenedData.length, prev.limit + PROGRESSIVE_FRAME_STEP),
        }));
      });
      return () => cancelAnimationFrame(rafId);
    }

    if (progressiveRenderState.limit > flattenedData.length + PROGRESSIVE_FRAME_STEP) {
      setProgressiveRenderState({
        boardId: activeBoardId,
        limit: Math.max(PROGRESSIVE_INITIAL_BATCH, flattenedData.length),
      });
    }
  }, [useNativeScroll, activeBoardId, flattenedData.length, progressiveRenderState.boardId, progressiveRenderState.limit]);

  const extractBoardItemKey = useCallback((item, index) => {
    if (item?.uniqueKey) return item.uniqueKey;
    if (item?.type === 'task') {
      const taskId = item.task?.id || item.task?._id || `task_${index}`;
      return `task_${taskId}_${item.section?.id || 'sec'}`;
    }
    return `${item?.type || 'item'}_${item?.section?.id || 'sec'}`;
  }, []);

  const visibleNativeItems = useMemo(() => {
    if (!useNativeScroll) return [];
    if (effectiveProgressiveLimit >= flattenedData.length) return flattenedData;
    return flattenedData.slice(0, effectiveProgressiveLimit);
  }, [useNativeScroll, flattenedData, effectiveProgressiveLimit]);

  const remainingUnmountedCount = useNativeScroll
    ? Math.max(0, flattenedData.length - visibleNativeItems.length)
    : 0;

  const isAnyModalOpen = isDetailsVisible || 
    isQuickMenuVisible || 
    isSnoozeVisible || 
    isPremiumModalVisible || 
    isCreateBoardVisible || 
    promptConfig.isVisible || 
    confirmConfig.isVisible || 
    sectionOptionsConfig.isVisible || 
    boardOptionsConfig.isVisible || 
    boardAutomationModal.isVisible || 
    isMoveBoardVisible || 
    isGoogleDrawerOpen;

  const renderListSummaryBar = useCallback(() => {
    const type = activeBoard?.type;
    if (!['grocery', 'shopping', 'expenses', 'packing', 'habits', 'media'].includes(type)) {
      return null;
    }

    const totalCount = boardTasks.length;
    const completedList = boardTasks.filter(t => t.completed);
    const uncompletedList = boardTasks.filter(t => !t.completed);
    const completedCount = completedList.length;

    if (type === 'grocery' || type === 'shopping') {
      let grandTotal = 0;
      let inCartSpent = 0;
      boardTasks.forEach(t => {
        const qty = t.itemQuantity !== undefined && !isNaN(Number(t.itemQuantity)) ? Math.max(1, Number(t.itemQuantity)) : 1;
        const price = getTaskAmount(t);
        const itemTot = qty * price;
        grandTotal += itemTot;
        if (t.completed) inCartSpent += itemTot;
      });
      const remaining = Math.max(0, grandTotal - inCartSpent);
      const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return (
        <View style={{ backgroundColor: colors.bgCard || '#FFFFFF', marginHorizontal: 16, marginTop: 4, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.borderColor || '#E5E7EB' }}>
          {/* Top Row: Grand Total & Cart summary */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary }}>${grandTotal.toFixed(2)}</Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' }}>{t('Grand Total') || 'Grand Total'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {t('In Cart') || 'In Cart'}: <Text style={{ fontWeight: '700', color: '#10B981' }}>${inCartSpent.toFixed(2)}</Text>
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>•</Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {t('Remaining') || 'Due'}: <Text style={{ fontWeight: '700', color: '#F59E0B' }}>${remaining.toFixed(2)}</Text>
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={{ height: 4, width: '100%', backgroundColor: colors.borderColor || '#E5E7EB', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
            <View style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: '#10B981', borderRadius: 2 }} />
          </View>

          {/* Sub Row: Items count and Reset */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: colors.textSecondary }}>
              {completedCount}/{totalCount} {t('In Cart') || 'In Cart'} ({progressPercent}%)
            </Text>
            {completedCount > 0 && (
              <TouchableOpacity
                onPress={() => {
                  const completedIds = completedList.map(t => t.id || t._id).filter(Boolean);
                  dispatch(updateMultipleTasks({ taskIds: completedIds, changes: { completed: false } }));
                  showToast(t('All items reset') || 'All items reset');
                }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.primary }}>
                  {t('Uncheck All') || 'Uncheck All'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    if (type === 'expenses') {
      const currentMonthStr = dayjs().format('YYYY-MM');
      const todayStr = dayjs().format('YYYY-MM-DD');

      let allTotal = 0;
      let allPaid = 0;
      let monthlyTotal = 0;
      let monthlyPaid = 0;

      boardTasks.forEach(t => {
        const amt = getTaskAmount(t);
        allTotal += amt;
        if (t.completed) allPaid += amt;

        const dateStr = getTaskDateStr(t);
        const isCurrentMonth = dateStr ? dateStr.startsWith(currentMonthStr) : true;
        const isOverdueUnpaid = dateStr && dateStr < todayStr && !t.completed;

        if (isCurrentMonth || isOverdueUnpaid) {
          monthlyTotal += amt;
          if (t.completed) monthlyPaid += amt;
        }
      });

      const isMonthlyView = expensesPeriodFilter === 'month';
      const displayTotal = isMonthlyView ? monthlyTotal : allTotal;
      const displayPaid = isMonthlyView ? monthlyPaid : allPaid;
      const displayRemaining = Math.max(0, displayTotal - displayPaid);
      const titleLabel = isMonthlyView
        ? (t("This Month's Bills") || 'This Month')
        : (t('Total Bills') || 'Total Bills');

      return (
        <View style={{ backgroundColor: colors.bgCard || '#FFFFFF', marginHorizontal: 16, marginTop: 4, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.borderColor || '#E5E7EB' }}>
          {/* Top Row: Amount & Label on Left, Sleek Compact Segmented Toggle on Right */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontSize: 19, fontWeight: 'bold', color: colors.textPrimary }}>${displayTotal.toFixed(2)}</Text>
              <Text 
                nativeID="expenses-title-label"
                style={{ 
                  fontSize: 10, 
                  color: colors.textSecondary, 
                  textTransform: 'uppercase', 
                  fontWeight: '600',
                  display: windowWidth < 300 ? 'none' : 'flex',
                }}
              >
                {titleLabel}
              </Text>
            </View>

            {/* Compact Segmented Switcher */}
            <View style={{
              flexDirection: 'row',
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              borderRadius: 8,
              padding: 2,
            }}>
              <TouchableOpacity
                onPress={() => setExpensesPeriodFilter('month')}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: isMonthlyView ? '#EF4444' : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 11,
                  fontWeight: isMonthlyView ? '700' : '500',
                  color: isMonthlyView ? '#FFFFFF' : colors.textSecondary,
                }}>
                  {t('Month') || 'Month'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setExpensesPeriodFilter('all')}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: !isMonthlyView ? '#EF4444' : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 11,
                  fontWeight: !isMonthlyView ? '700' : '500',
                  color: !isMonthlyView ? '#FFFFFF' : colors.textSecondary,
                }}>
                  {t('All') || 'All'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sub Row: Paid & Due Chips */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {t('Paid') || 'Paid'}: <Text style={{ fontWeight: '700', color: '#10B981' }}>${displayPaid.toFixed(2)}</Text>
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>•</Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {t('Remaining Due') || 'Due'}: <Text style={{ fontWeight: '700', color: '#EF4444' }}>${displayRemaining.toFixed(2)}</Text>
              </Text>
            </View>

            {isMonthlyView && allTotal > monthlyTotal ? (
              <TouchableOpacity onPress={() => setExpensesPeriodFilter('all')}>
                <Text style={{ fontSize: 10, color: colors.textSecondary, textDecorationLine: 'underline' }}>
                  {t('All scheduled:') || 'All:'} ${allTotal.toFixed(2)} →
                </Text>
              </TouchableOpacity>
            ) : !isMonthlyView && monthlyTotal > 0 ? (
              <TouchableOpacity onPress={() => setExpensesPeriodFilter('month')}>
                <Text style={{ fontSize: 10, color: colors.textSecondary, textDecorationLine: 'underline' }}>
                  {t('This month:') || 'Month:'} ${monthlyTotal.toFixed(2)} →
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      );
    }

    if (type === 'packing') {
      const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      const categories = ['All', 'Carry-On', 'Checked Bag', 'Backpack', 'Essentials'];

      return (
        <View style={{ backgroundColor: colors.bgCard || '#FFFFFF', marginHorizontal: 16, marginTop: 4, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.borderColor || '#E5E7EB' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textPrimary }}>
              🧳 {t('Packed') || 'Packed'}: {completedCount}/{totalCount} ({progressPercent}%)
            </Text>
            {completedCount > 0 && (
              <TouchableOpacity
                onPress={() => {
                  const completedIds = completedList.map(t => t.id || t._id).filter(Boolean);
                  dispatch(updateMultipleTasks({ taskIds: completedIds, changes: { completed: false } }));
                  showToast(t('Ready for your next trip!') || 'Ready for your next trip!');
                }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.primary }}>
                  {t('Reset for Next Trip') || 'Reset for Next Trip'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 4, width: '100%', backgroundColor: colors.borderColor || '#E5E7EB', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
            <View style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: '#3B82F6', borderRadius: 2 }} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5 }}>
            {categories.map((cat) => {
              const isSelected = listFilterCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setListFilterCategory(cat)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 10,
                    backgroundColor: isSelected ? '#3B82F6' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                    borderWidth: 1,
                    borderColor: isSelected ? '#3B82F6' : (isDark ? 'rgba(255,255,255,0.12)' : (colors.borderColor || '#E5E7EB'))
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? '#FFFFFF' : (isDark ? '#E5E7EB' : colors.textPrimary) }}>
                    {t(cat) || cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    if (type === 'habits') {
      const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      const timesOfDay = ['All', 'Morning', 'Afternoon', 'Evening', 'Anytime'];
      const bestStreak = boardTasks.reduce((max, t) => Math.max(max, Number(t.habitStreak) || 0), 0);

      return (
        <View style={{ backgroundColor: colors.bgCard || '#FFFFFF', marginHorizontal: 16, marginTop: 4, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.borderColor || '#E5E7EB' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textPrimary }}>
              ⚡ {t("Today's Habits") || 'Habits'}: {completedCount}/{totalCount} ({progressPercent}%)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#D97706' }}>
                🔥 {t('Best Streak') || 'Best Streak'}: {bestStreak} {t('days') || 'd'}
              </Text>
            </View>
          </View>

          <View style={{ height: 4, width: '100%', backgroundColor: colors.borderColor || '#E5E7EB', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
            <View style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: '#F59E0B', borderRadius: 2 }} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5 }}>
            {timesOfDay.map((tod) => {
              const isSelected = listFilterCategory === tod;
              return (
                <TouchableOpacity
                  key={tod}
                  onPress={() => setListFilterCategory(tod)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 10,
                    backgroundColor: isSelected ? '#F59E0B' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                    borderWidth: 1,
                    borderColor: isSelected ? '#F59E0B' : (isDark ? 'rgba(255,255,255,0.12)' : (colors.borderColor || '#E5E7EB'))
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? '#FFFFFF' : (isDark ? '#E5E7EB' : colors.textPrimary) }}>
                    {t(tod) || tod}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    if (type === 'media') {
      const inProgressCount = uncompletedList.filter(t => t.itemProgress || t.itemRating).length;
      const ratedTasks = boardTasks.filter(t => Number(t.itemRating) > 0);
      const avgRating = ratedTasks.length > 0
        ? (ratedTasks.reduce((sum, t) => sum + Number(t.itemRating), 0) / ratedTasks.length).toFixed(1)
        : null;
      const mediaTypes = ['All', 'Books', 'Movies/TV', 'Courses'];

      return (
        <View style={{ backgroundColor: colors.bgCard || '#FFFFFF', marginHorizontal: 16, marginTop: 4, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.borderColor || '#E5E7EB' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary }}>{totalCount}</Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' }}>{t('Watchlist & Reading') || 'Media'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {t('In Progress') || 'In Progress'}: <Text style={{ fontWeight: '700', color: '#8B5CF6' }}>{inProgressCount}</Text>
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>•</Text>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#F59E0B' }}>
                {avgRating ? `⭐ ${avgRating}` : '—'}
              </Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5 }}>
            {mediaTypes.map((mt) => {
              const isSelected = listFilterCategory === mt;
              return (
                <TouchableOpacity
                  key={mt}
                  onPress={() => setListFilterCategory(mt)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 10,
                    backgroundColor: isSelected ? '#8B5CF6' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                    borderWidth: 1,
                    borderColor: isSelected ? '#8B5CF6' : (isDark ? 'rgba(255,255,255,0.12)' : (colors.borderColor || '#E5E7EB'))
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? '#FFFFFF' : (isDark ? '#E5E7EB' : colors.textPrimary) }}>
                    {t(mt) || mt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    return null;
  }, [activeBoard?.type, boardTasks, colors.bgCard, colors.borderColor, colors.primary, colors.textPrimary, colors.textSecondary, dispatch, expensesPeriodFilter, getTaskAmount, isDark, listFilterCategory, showToast, t, windowWidth]);

  return (
    <ScreenErrorBoundary screenName="BoardScreen">
      <KeyboardAvoidingView 
        style={{ flex: 1, backgroundColor: colors.bgMain }} 
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
      >
        <View 
          style={[styles.container, { backgroundColor: colors.bgMain }, ResponsiveHelper.getCenteredContainerStyle(windowWidth, 880)]}
          {...A11yHelper.getModalFocusTrapProps(isAnyModalOpen)}
        >
      
        {/* Screen Header matching new design */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', letterSpacing: -0.5, color: colors.textPrimary }}>
              {t('Tasks') || 'Tasks'}
              {activeBoard && activeBoard.name !== 'Main' && (
                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }}>  • {activeBoard.name}</Text>
              )}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity 
              accessible={true} 
              accessibilityRole="button" 
              accessibilityLabel="Toggle theme"
              style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center' }}
              onPress={handleToggleTheme}
            >
              {renderThemeIcon()}
            </TouchableOpacity>

            <TouchableOpacity 
              testID="add_board_btn"
              accessible={true} 
              accessibilityRole="button" 
              accessibilityLabel="Add new board"
              style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center' }}
              onPress={handleAddBoard}
            >
              <Text style={{ fontSize: 20, color: colors.textPrimary, fontWeight: '400' }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Board Pills Horizontal Scroll */}
        <View style={{ marginBottom: 6 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
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
                  accessibilityLabel={`${board.name === 'Main' ? (t('Main') || 'Main') : board.name} board, ${count} ${count === 1 ? 'task' : 'tasks'}`} 
                  accessibilityHint={t('Double tap to switch to this board') || 'Double tap to switch to this board'}
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 16,
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
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: boardColor, marginRight: 5 }} />
                  <Text style={[
                    { 
                      fontSize: 12,
                      fontWeight: isSelected ? '700' : '500',
                      color: isSelected ? colors.textPrimary : colors.textSecondary 
                    }
                  ]}>
                    {board.name === 'Main' ? (t('Main') || 'Main') : board.name}
                  </Text>
                  {count > 0 && (
                    <View style={{
                      backgroundColor: `${boardColor}25`,
                      borderRadius: 8,
                      paddingHorizontal: 5,
                      paddingVertical: 0.5,
                      marginLeft: 5
                    }}>
                      <Text style={{
                        color: boardColor,
                        fontSize: 10,
                        fontWeight: 'bold'
                      }}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

      {useFabricFlashList ? (
        <FabricFlashList
          ref={flashListRef}
          style={{ flex: 1 }}
          data={flattenedData}
          extraData={flashListExtraData}
          ListHeaderComponent={renderListSummaryBar}
          keyExtractor={(item, index) => extractBoardItemKey(item, index)}
          getItemType={(item) => item.type}
          renderItem={renderItem}
          drawDistance={1500}
          maintainVisibleContentPosition={{ disabled: true }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={closeOpenSwipeableRow}
        />
      ) : useNativeScroll ? (
        <ScrollView
          ref={nativeScrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          {...(Platform.OS === 'web' ? {} : { keyboardShouldPersistTaps: 'handled' })}
          onScrollBeginDrag={closeOpenSwipeableRow}
          removeClippedSubviews={false}
        >
          {renderListSummaryBar()}
          {visibleNativeItems.map((item, index) => (
            <React.Fragment key={extractBoardItemKey(item, index)}>
              {renderItem({ item, index })}
            </React.Fragment>
          ))}
          {remainingUnmountedCount > 0 ? (
            <View style={{ height: remainingUnmountedCount * 62 }} />
          ) : null}
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={flattenedData}
          extraData={flashListExtraData}
          ListHeaderComponent={renderListSummaryBar}
          keyExtractor={(item, index) => extractBoardItemKey(item, index)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          {...(Platform.OS === 'web' ? {} : { keyboardShouldPersistTaps: 'handled' })}
          onScrollBeginDrag={closeOpenSwipeableRow}
          initialNumToRender={32}
          maxToRenderPerBatch={24}
          updateCellsBatchingPeriod={16}
          windowSize={21}
          removeClippedSubviews={false}
        />
      )}

      <TaskDetailsModal 
        task={selectedTask}
        isVisible={isDetailsVisible}
        onClose={() => {
          cancelAllInlineEditing();
          try { Keyboard?.dismiss?.(); } catch (e) {}
          setDetailsVisible(false);
        }}
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

      <RNModal 
        visible={Boolean(sectionOptionsConfig.isVisible)} 
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setSectionOptionsConfig({ isVisible: false, section: null })}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity 
            activeOpacity={1}
            style={StyleSheet.absoluteFillObject}
            onPress={() => setSectionOptionsConfig({ isVisible: false, section: null })}
          />
          <View style={[styles.optionsModalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.optionsModalDragHandle} />
          <Text style={[styles.optionsModalTitle, { color: colors.textPrimary }]}>
            {t('Options for')} {sectionOptionsConfig.section?.title}
          </Text>
          
          {(['simple_list', 'shopping', 'grocery', 'packing', 'habits', 'media'].includes(activeBoard?.type)) ? (
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
        </View>
      </RNModal>

      <RNModal 
        visible={Boolean(boardOptionsConfig.isVisible)} 
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setBoardOptionsConfig({ isVisible: false, board: null })}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity 
            activeOpacity={1}
            style={StyleSheet.absoluteFillObject}
            onPress={() => setBoardOptionsConfig({ isVisible: false, board: null })}
          />
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
                    accessibilityLabel={t(BOARD_COLOR_NAMES[c] || 'Color')}
                    accessibilityState={{ selected: isSelected }}
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
        </View>
      </RNModal>

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
        onPressEdit={(t) => {
          TaskEditDiagnostics.record('BOARD_SCREEN_ON_PRESS_EDIT', {
            taskId: t?.id || t?._id,
            name: t?.taskname || t?.name,
          });
          setSelectedTask(t);
          setDetailsVisible(true);
        }}
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
        onSelectCategory={(boardId) => {
          dispatch(setGoogleDrawerOpen(false));
          navigation.navigate('Calendar', { focusBoardId: boardId });
        }}
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
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
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
