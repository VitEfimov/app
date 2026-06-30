import React, { useState } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme } from '../styles/ThemeContext';
import TaskRow from '../components/TaskRow';
import InlineAddTask from '../components/InlineAddTask';
import TaskDetailsModal from '../components/TaskDetailsModal';
import PromptModal from '../components/PromptModal';
import getFilters from '../utils/filters';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import Svg, { Path } from 'react-native-svg';
import { updateTask, deleteTask } from '../features/taskSlice';
import { addBoardAsync, renameBoardAsync, deleteBoardAsync, setActiveBoardId } from '../features/userSlice';

dayjs.extend(isSameOrBefore);

const IconChevronDown = ({ color, isCollapsed }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '0deg' }] }}>
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

export default function BoardScreen() {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const tasks = useSelector(state => state.taskReducer.tasks || []);
  const boards = useSelector(state => state.userReducer.boards || [{ id: 'main', name: 'Main' }]);
  const activeBoardId = useSelector(state => state.userReducer.activeBoardId || 'main');
  const isAuthenticated = useSelector(state => state.userReducer.isAuthenticated);
  
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsVisible, setDetailsVisible] = useState(false);
  
  const [promptConfig, setPromptConfig] = useState({ isVisible: false, type: null, targetBoard: null });

  const [collapsedSections, setCollapsedSections] = useState([
    'missed', 'tomorrow', 'on-this-week', 'on-next-week', 'later', 'completed'
  ]);

  const toggleSection = (sectionId) => {
    if (collapsedSections.includes(sectionId)) {
      setCollapsedSections(collapsedSections.filter(id => id !== sectionId));
    } else {
      setCollapsedSections([...collapsedSections, sectionId]);
    }
  };

  const handleTaskPress = (task) => {
    setSelectedTask(task);
    setDetailsVisible(true);
  };

  // Group tasks
  const FILTERS = getFilters();
  const boardTasks = tasks.filter(task => (task.boardId || 'main') === activeBoardId);
  const todayTasks = boardTasks.filter(task => dayjs(task.completionDate).isSame(dayjs(), 'day') && !task.completed);
  const tomorrowTasks = boardTasks.filter(task => dayjs(task.completionDate).isSame(FILTERS.tomorrow, 'day') && !task.completed);
  const thisWeekTasks = boardTasks.filter(task =>
    !dayjs(task.completionDate).isSameOrBefore(FILTERS.today, 'day') &&
    !dayjs(task.completionDate).isSame(FILTERS.tomorrow, 'day') &&
    dayjs(task.completionDate).isSameOrBefore(FILTERS['on-this-week'], 'day') && !task.completed
  );
  const nextWeekTasks = boardTasks.filter(task =>
    !dayjs(task.completionDate).isSame(FILTERS.tomorrow, 'day') &&
    dayjs(task.completionDate).isAfter(FILTERS['on-this-week'], 'day') &&
    dayjs(task.completionDate).isSameOrBefore(FILTERS['on-next-week'], 'day') && !task.completed
  );
  const laterTasks = boardTasks.filter(task => dayjs(task.completionDate).isAfter(FILTERS['on-next-week'], 'day') && !task.completed);
  const missedTasks = boardTasks.filter(task => dayjs(task.completionDate).isBefore(dayjs(), 'day') && !task.completed);
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

  const handleCompleteSection = (section) => {
    section.data.forEach(task => {
      dispatch(updateTask({ taskId: task.id, completed: true }));
    });
  };

  const handleMoveForward = (section) => {
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
  };

  const handleDeleteSection = (section) => {
    section.data.forEach(task => {
      dispatch(deleteTask({ taskId: task.id }));
    });
  };

  const handleMenuPress = (section) => {
    const options = [];
    if (section.id !== 'completed' && section.id !== 'later') {
      options.push({ text: 'Complete all', onPress: () => handleCompleteSection(section) });
      options.push({ text: 'Move forward', onPress: () => handleMoveForward(section) });
    } else if (section.id === 'later') {
      options.push({ text: 'Complete all', onPress: () => handleCompleteSection(section) });
    }
    options.push({ text: 'Delete all', onPress: () => handleDeleteSection(section), style: 'destructive' });
    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(`Options for ${section.title}`, '', options);
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
            const boardTasks = tasks.filter(t => (t.boardId || 'main') === board.id);
            boardTasks.forEach(t => dispatch(deleteTask({ taskId: t.id })));
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
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{section.title}</Text>
        </TouchableOpacity>
        <View style={[styles.badge, { backgroundColor: `${section.color}20` }]}>
          <Text style={[styles.badgeText, { color: section.color }]}>{section.count}</Text>
        </View>
        <TouchableOpacity 
          style={styles.ellipsisBtn} 
          onPress={() => handleMenuPress(section)}
        >
          <Text style={[styles.ellipsisText, { color: colors.textSecondary }]}>⋮</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSectionFooter = ({ section }) => {
    if (section.id === 'completed' || collapsedSections.includes(section.id)) return null;
    return <InlineAddTask sectionId={section.id} />;
  };

  return (
    <TouchableOpacity 
      activeOpacity={1} 
      style={[styles.container, { backgroundColor: colors.bgMain }]}
    >
      
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

      {/* Columns */}
      <View style={[styles.columnsRow, { backgroundColor: colors.bgCard, borderBottomColor: colors.borderColor }]}>
        <Text style={[styles.columnText, { color: colors.textPrimary }]}>TASKS</Text>
        <Text style={[styles.columnText, { color: colors.textPrimary }]}>DUE DATE</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TaskRow 
            task={item} 
            onPress={() => handleTaskPress(item)} 
          />
        )}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={true}
        keyboardShouldPersistTaps="never"
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

    </TouchableOpacity>
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
    width: '90%',
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
  }
});
