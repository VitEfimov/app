import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme } from '../styles/ThemeContext';
import TaskRow from '../components/TaskRow';
import TaskDetailsModal from '../components/TaskDetailsModal';
import PromptModal from '../components/PromptModal';
import ConfirmModal from '../components/ConfirmModal';
import InlineAddTask from '../components/InlineAddTask';
import Modal from 'react-native-modal';
import getFilters from '../utils/filters';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import Svg, { Path } from 'react-native-svg';
import { updateTask, deleteTask, deleteTasksByBoard } from '../features/taskSlice';
import { addBoardAsync, renameBoardAsync, deleteBoardAsync, setActiveBoardId } from '../features/userSlice';

dayjs.extend(isSameOrBefore);

const IconChevronDown = ({ color, isCollapsed }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '0deg' }] }}>
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

export default function BoardScreen({ route }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeAddSectionId, setActiveAddSectionId] = useState(null);

  const { colors } = useTheme();
  const dispatch = useDispatch();
  const tasks = useSelector(state => state.taskReducer.tasks || []);
  const boards = useSelector(state => state.userReducer.boards || [{ id: 'main', name: 'Main' }]);
  const activeBoardId = useSelector(state => state.userReducer.activeBoardId || 'main');
  const isAuthenticated = useSelector(state => state.userReducer.isAuthenticated);
  
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsVisible, setDetailsVisible] = useState(false);
  
  const [promptConfig, setPromptConfig] = useState({ isVisible: false, type: null, targetBoard: null });
  const [confirmConfig, setConfirmConfig] = useState({ isVisible: false, title: '', message: '', onConfirm: null, confirmText: 'Confirm', isDestructive: false });
  const [sectionOptionsConfig, setSectionOptionsConfig] = useState({ isVisible: false, section: null });
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

  const toggleSection = (sectionId) => {
    if (collapsedSections.includes(sectionId)) {
      setCollapsedSections(collapsedSections.filter(id => id !== sectionId));
    } else {
      setCollapsedSections([...collapsedSections, sectionId]);
    }
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

        return `Task: ${taskName}\nDue: ${selectedDate ? dayjs(selectedDate).format('MMM D, YYYY') : 'Not set'}${selectedTime ? ` at ${selectedTime}` : ''}${priority ? `\nPriority: ${priority}` : ''}\n\n${notes ? `Notes:\n${notes}\n\n` : ''}${img ? `Image attached:\n${img}\n\n` : ''}${subtasks.length > 0 ? `Subtasks:\n${subtasks.map(s => `- ${s.completed ? '☑️' : '🔲'} ${s.text}`).join('\n')}` : ''}`.trim();
      }).join('\n\n------------------------\n\n');
      
      await Share.share({
        message: `Tasks:\n\n${shareText}`,
      });
      setSelectionMode({ isActive: false, sectionId: null, selectedTaskIds: [] });
    } catch (error) {
      console.log(error);
    }
  };

  const handleTaskPress = (task) => {
    setSelectedTask(task);
    setDetailsVisible(true);
  };

  // Group tasks
  const FILTERS = getFilters();
  const boardTasks = tasks.filter(task => (task.boardId || 'main') === activeBoardId);
  const sortTasks = (tasksArr, sectionId) => {
    const sortBy = sortConfig[sectionId] || 'time';
    return tasksArr.sort((a, b) => {
      if (sortBy === 'priority') {
        const pValues = { high: 3, medium: 2, low: 1, none: 0 };
        const pA = pValues[a.priority?.toLowerCase()] || 0;
        const pB = pValues[b.priority?.toLowerCase()] || 0;
        if (pA !== pB) return pB - pA; // Higher priority first
      }

      const dateA = a.completionDate || '9999-12-31';
      const dateB = b.completionDate || '9999-12-31';
      const dateCompare = dateA.localeCompare(dateB);
      if (dateCompare !== 0) return dateCompare;
      
      const hasTimeA = !!a.time;
      const hasTimeB = !!b.time;
      
      if (hasTimeA && !hasTimeB) return -1;
      if (!hasTimeA && hasTimeB) return 1;
      if (hasTimeA && hasTimeB) return a.time.localeCompare(b.time);
      
      return parseInt(a.id || '0') - parseInt(b.id || '0');
    });
  };

  const todayTasks = sortTasks(boardTasks.filter(task => dayjs(task.completionDate).isSame(dayjs(), 'day') && !task.completed), 'today');
  const tomorrowTasks = sortTasks(boardTasks.filter(task => dayjs(task.completionDate).isSame(FILTERS.tomorrow, 'day') && !task.completed), 'tomorrow');
  const thisWeekTasks = sortTasks(boardTasks.filter(task =>
    !dayjs(task.completionDate).isSameOrBefore(FILTERS.today, 'day') &&
    !dayjs(task.completionDate).isSame(FILTERS.tomorrow, 'day') &&
    dayjs(task.completionDate).isSameOrBefore(FILTERS['on-this-week'], 'day') && !task.completed
  ), 'on-this-week');
  const nextWeekTasks = sortTasks(boardTasks.filter(task =>
    !dayjs(task.completionDate).isSame(FILTERS.tomorrow, 'day') &&
    dayjs(task.completionDate).isAfter(FILTERS['on-this-week'], 'day') &&
    dayjs(task.completionDate).isSameOrBefore(FILTERS['on-next-week'], 'day') && !task.completed
  ), 'on-next-week');
  const laterTasks = sortTasks(boardTasks.filter(task => dayjs(task.completionDate).isAfter(FILTERS['on-next-week'], 'day') && !task.completed), 'later');
  const missedTasks = sortTasks(boardTasks.filter(task => dayjs(task.completionDate).isBefore(dayjs(), 'day') && !task.completed), 'missed');
  const completedTasks = boardTasks.filter(task => task.completed);

  const sections = [
    ...(missedTasks.length > 0 ? [{ id: 'missed', title: 'Missed tasks', data: collapsedSections.includes('missed') ? [] : missedTasks, count: missedTasks.length, color: '#f44336' }] : []),
    { id: 'today', title: 'Today', data: collapsedSections.includes('today') ? [] : todayTasks, count: todayTasks.length, color: '#ff9800' },
    { id: 'tomorrow', title: 'Tomorrow', data: collapsedSections.includes('tomorrow') ? [] : tomorrowTasks, count: tomorrowTasks.length, color: '#2196f3' },
    { id: 'on-this-week', title: 'This week', data: collapsedSections.includes('on-this-week') ? [] : thisWeekTasks, count: thisWeekTasks.length, color: '#9c27b0' },
    { id: 'on-next-week', title: 'Next week', data: collapsedSections.includes('on-next-week') ? [] : nextWeekTasks, count: nextWeekTasks.length, color: '#009688' },
    { id: 'later', title: 'Upcoming', data: collapsedSections.includes('later') ? [] : laterTasks, count: laterTasks.length, color: '#795548' },
    ...(completedTasks.length > 0 ? [{ id: 'completed', title: 'Completed', data: collapsedSections.includes('completed') ? [] : completedTasks, count: completedTasks.length, color: '#4caf50' }] : []),
  ];

  React.useEffect(() => {
    if (route?.params?.sectionId) {
      setCollapsedSections(allSectionIds.filter(id => id !== route.params.sectionId));
    } else {
      setCollapsedSections(['tomorrow', 'on-this-week', 'on-next-week', 'later', 'completed']);
    }
  }, [route?.params?.sectionId]);

  const handleCompleteSection = (section) => {
    setConfirmConfig({
      isVisible: true,
      title: 'Complete All',
      message: `Are you sure you want to complete all tasks in "${section.title}"?`,
      confirmText: 'Complete',
      isDestructive: false,
      onConfirm: () => {
        section.data.forEach(task => {
          dispatch(updateTask({ taskId: task.id, completed: true }));
        });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
      }
    });
  };

  const handleMoveForward = (section) => {
    setConfirmConfig({
      isVisible: true,
      title: 'Move Forward',
      message: `Are you sure you want to move all tasks in "${section.title}" forward?`,
      confirmText: 'Move',
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

  const handleDeleteSection = (section) => {
    setConfirmConfig({
      isVisible: true,
      title: 'Delete All',
      message: `Are you sure you want to delete all tasks in "${section.title}"?`,
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: () => {
        section.data.forEach(task => {
          dispatch(deleteTask({ taskId: task.id }));
        });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
      }
    });
  };

  const handleMenuPress = (section) => {
    setSectionOptionsConfig({ isVisible: true, section });
  };

  const handleAddBoard = () => {
    const boardLimit = isAuthenticated ? 6 : 2;
    if (boards.length >= boardLimit) {
      Alert.alert('Limit Reached', `You have reached the maximum number of boards (${boardLimit}).`);
      return;
    }
    setPromptConfig({ isVisible: true, type: 'add', targetBoard: null });
  };

  const handleBoardOptions = (board) => {
    if (board.id === 'main') return;
    Alert.alert(`Board: ${board.name}`, 'What would you like to do?', [
      { text: 'Rename', onPress: () => {
        setPromptConfig({ isVisible: true, type: 'rename', targetBoard: board });
      }},
      { text: 'Delete', style: 'destructive', onPress: () => {
        Alert.alert('Delete Board', 'Are you sure? All tasks will be deleted.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => {
            dispatch(deleteBoardAsync(board.id));
            dispatch(deleteTasksByBoard(board.id));
          }}
        ]);
      }},
      { text: 'Cancel', style: 'cancel' }
    ]);
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
    return (
      <View style={[styles.sectionHeader, { backgroundColor: colors.bgMain, borderBottomColor: colors.borderColor }]}>
        <TouchableOpacity style={styles.sectionHeaderLeft} onPress={() => toggleSection(section.id)}>
          <IconChevronDown color={colors.textSecondary} isCollapsed={collapsedSections.includes(section.id)} />
          <Text testID={`section_title_${section.id}`} style={[styles.sectionTitle, { color: colors.textPrimary }]}>{section.title}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.badge, { backgroundColor: `${section.color}20` }]}
          onPress={() => handleMenuPress(section)}
        >
          <Text style={[styles.badgeText, { color: section.color }]}>{section.count}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          testID={`section_menu_${section.id}`}
          style={styles.ellipsisBtn} 
          onPress={() => handleMenuPress(section)}
        >
          <Text style={[styles.ellipsisText, { color: colors.textSecondary }]}>⋮</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSectionFooter = ({ section }) => {
    if (section.id === 'completed' || section.id === 'missed' || collapsedSections.includes(section.id)) return null;
    return (
      <InlineAddTask 
        sectionId={section.id} 
        isActive={activeAddSectionId === section.id}
        onToggle={(active) => setActiveAddSectionId(active ? section.id : null)}
        onAddDetails={(task) => {
          setSelectedTask(task);
          setDetailsVisible(true);
        }}
      />
    );
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      
      {/* Top Tabs */}
      <View style={[styles.topBar, { borderBottomColor: colors.borderColor }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boardsScroll}>
          {boards.map(board => (
            <TouchableOpacity 
              key={board.id} 
              style={[
                styles.mainTab, 
                activeBoardId === board.id && { borderBottomColor: colors.primary }
              ]}
              onPress={() => dispatch(setActiveBoardId(board.id))}
              onLongPress={() => handleBoardOptions(board)}
            >
              <Text style={[
                styles.mainTabText, 
                { color: activeBoardId === board.id ? colors.primary : colors.textSecondary }
              ]}>{board.name}</Text>
            </TouchableOpacity>
          ))}
          {boards.length < (isAuthenticated ? 6 : 2) && (
            <TouchableOpacity style={styles.addBoardBtn} onPress={handleAddBoard}>
              <Text style={[styles.addBoardText, { color: colors.textSecondary }]}>+</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, section }) => (
          <TaskRow 
            task={item} 
            onPress={() => handleTaskPress(item)} 
            isSelectionMode={selectionMode.isActive && selectionMode.sectionId === section.id}
            isSelected={selectionMode.selectedTaskIds.includes(item.id)}
            onToggleSelect={() => toggleTaskSelection(item.id)}
          />
        )}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={true}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'ios'}
      />

      <TaskDetailsModal 
        task={selectedTask}
        isVisible={isDetailsVisible}
        onClose={() => setDetailsVisible(false)}
      />

      <PromptModal
        isVisible={promptConfig.isVisible}
        title={promptConfig.type === 'add' ? 'New Board' : 'Rename Board'}
        message={promptConfig.type === 'add' ? 'Enter board name:' : 'Enter new name:'}
        defaultValue={promptConfig.type === 'rename' ? promptConfig.targetBoard?.name : ''}
        submitText={promptConfig.type === 'add' ? 'Add' : 'Rename'}
        onCancel={() => setPromptConfig({ isVisible: false, type: null, targetBoard: null })}
        onSubmit={handlePromptSubmit}
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
            Options for {sectionOptionsConfig.section?.title}
          </Text>
          
          <TouchableOpacity testID="section_option_sort_time" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setSortConfig(prev => ({...prev, [sectionOptionsConfig.section?.id]: 'time'})); setSectionOptionsConfig({ isVisible: false, section: null }); }}>
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>Sort by Time</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="section_option_sort_priority" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setSortConfig(prev => ({...prev, [sectionOptionsConfig.section?.id]: 'priority'})); setSectionOptionsConfig({ isVisible: false, section: null }); }}>
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>Sort by Priority</Text>
          </TouchableOpacity>

          <TouchableOpacity testID="section_option_select_tasks" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { 
            setSelectionMode({ isActive: true, sectionId: sectionOptionsConfig.section?.id, selectedTaskIds: [] }); 
            setSectionOptionsConfig({ isVisible: false, section: null }); 
          }}>
            <Text style={[styles.optionText, { color: colors.primary }]}>Select Tasks</Text>
          </TouchableOpacity>
          
          {sectionOptionsConfig.section?.id !== 'completed' && sectionOptionsConfig.section?.id !== 'later' && (
            <TouchableOpacity testID="section_option_complete_all" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { const s = sectionOptionsConfig.section; setSectionOptionsConfig({ isVisible: false, section: null }); setTimeout(() => handleCompleteSection(s), 400); }}>
              <Text style={[styles.optionText, { color: colors.textPrimary }]}>Complete all</Text>
            </TouchableOpacity>
          )}

          {sectionOptionsConfig.section?.id !== 'completed' && sectionOptionsConfig.section?.id !== 'later' && (
            <TouchableOpacity testID="section_option_move_forward" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { const s = sectionOptionsConfig.section; setSectionOptionsConfig({ isVisible: false, section: null }); setTimeout(() => handleMoveForward(s), 400); }}>
              <Text style={[styles.optionText, { color: colors.textPrimary }]}>Move forward</Text>
            </TouchableOpacity>
          )}

          {sectionOptionsConfig.section?.id === 'later' && (
            <TouchableOpacity testID="section_option_complete_all" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { const s = sectionOptionsConfig.section; setSectionOptionsConfig({ isVisible: false, section: null }); setTimeout(() => handleCompleteSection(s), 400); }}>
              <Text style={[styles.optionText, { color: colors.textPrimary }]}>Complete all</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity testID="section_option_delete_all" style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { const s = sectionOptionsConfig.section; setSectionOptionsConfig({ isVisible: false, section: null }); setTimeout(() => handleDeleteSection(s), 400); }}>
            <Text style={{ color: '#f44336', fontSize: 16, fontWeight: 'bold' }}>Delete all</Text>
          </TouchableOpacity>

          <TouchableOpacity testID="section_option_cancel" style={[styles.optionBtn, { borderBottomWidth: 0 }]} onPress={() => setSectionOptionsConfig({ isVisible: false, section: null })}>
            <Text style={[styles.optionText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {selectionMode.isActive && (
        <View style={[styles.actionBar, { backgroundColor: colors.bgCard, borderTopColor: colors.borderColor }]}>
          <Text style={[styles.actionBarText, { color: colors.textPrimary }]}>{selectionMode.selectedTaskIds.length} Selected</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionBarButtons} style={{ flex: 1, marginLeft: 10 }}>
            <TouchableOpacity testID="action_bar_all" onPress={handleSelectAll} style={styles.actionBtn}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="action_bar_share" onPress={handleShareSelected} style={styles.actionBtn}>
              <Text style={{ color: '#2196f3', fontWeight: 'bold' }}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="action_bar_complete" onPress={handleCompleteSelected} style={styles.actionBtn}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="action_bar_delete" onPress={handleDeleteSelected} style={styles.actionBtn}>
              <Text style={{ color: '#f44336', fontWeight: 'bold' }}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="action_bar_cancel" onPress={() => setSelectionMode({ isActive: false, sectionId: null, selectedTaskIds: [] })} style={styles.actionBtn}>
              <Text style={{ color: colors.textSecondary, fontWeight: 'bold' }}>Cancel</Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    paddingTop: 10,
    borderBottomWidth: 1,
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
