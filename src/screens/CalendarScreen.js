import React, { useState, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, SectionList, Text, Animated, PanResponder, Keyboard, Platform, TouchableOpacity, ScrollView, Share } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Calendar } from 'react-native-calendars';
import { useTheme } from '../styles/ThemeContext';
import { useToast } from '../styles/ToastContext';
import TaskRow from '../components/TaskRow';
import InlineAddTask from '../components/InlineAddTask';
import TaskDetailsModal from '../components/TaskDetailsModal';
import TaskQuickMenuModal from '../components/TaskQuickMenuModal';
import SnoozeModal from '../components/SnoozeModal';
import PremiumModal from '../components/PremiumModal';
import ConfirmModal from '../components/ConfirmModal';
import Modal from 'react-native-modal';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { updateTask, deleteTask, addTask } from '../features/taskSlice';

export default function CalendarScreen() {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const tasks = useSelector(state => state.taskReducer.tasks || []);
  const boards = useSelector(state => state.userReducer.boards || []);
  const isPremium = useSelector(state => state.entitlementReducer?.isPremium);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsVisible, setDetailsVisible] = useState(false);
  const [isQuickMenuVisible, setQuickMenuVisible] = useState(false);
  const [isSnoozeVisible, setSnoozeVisible] = useState(false);
  const [isPremiumModalVisible, setPremiumModalVisible] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');

  const dispatch = useDispatch();

  // Selection & Options State
  const [sectionOptionsConfig, setSectionOptionsConfig] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ isVisible: false, title: '', message: '', onConfirm: null, confirmText: 'Confirm', isDestructive: false });
  const [selectionMode, setSelectionMode] = useState({ isActive: false, selectedTaskIds: [] });
  const [sortConfig, setSortConfig] = useState('time'); // 'time' or 'priority'

  // Custom Bottom Sheet State
  const MIN_Y = 0; // Fully expanded (covers calendar)
  const maxYRef = useRef(360); // Default, updated onLayout
  const isInitialized = useRef(false);
  
  const panY = useRef(new Animated.Value(360)).current;
  const lastY = useRef(360);

  const handleCalendarLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    if (Math.abs(maxYRef.current - height) > 5) {
      maxYRef.current = height;
      if (!isInitialized.current) {
        panY.setValue(height);
        lastY.current = height;
        isInitialized.current = true;
      }
    }
  };

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      Animated.timing(panY, {
        toValue: MIN_Y,
        duration: 300,
        useNativeDriver: false,
      }).start();
      lastY.current = MIN_Y;
    });

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        panY.stopAnimation((value) => {
          lastY.current = value;
        });
      },
      onPanResponderMove: (evt, gestureState) => {
        let newY = lastY.current + gestureState.dy;
        if (newY < MIN_Y) newY = MIN_Y;
        if (newY > maxYRef.current) newY = maxYRef.current;
        panY.setValue(newY);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const currentY = lastY.current + gestureState.dy;
        let targetY = maxYRef.current;
        
        // Snap to nearest position
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
          duration: 300,
          useNativeDriver: false,
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
    const taskIds = selectedTasks.map(t => t.id);
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
        const ids = [...selectionMode.selectedTaskIds];
        ids.forEach(id => {
          dispatch(updateTask({ taskId: id, completed: true }));
        });
        setSelectionMode({ isActive: false, selectedTaskIds: [] });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
        
        showToast(
          `${ids.length} ${t('tasks completed')}`,
          t('Undo'),
          () => {
            ids.forEach(id => {
              const task = selectedTasks.find(t => t.id === id);
              if (task) {
                dispatch(updateTask({ taskId: id, completed: task.completed }));
              }
            });
          }
        );
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
        const ids = [...selectionMode.selectedTaskIds];
        const tasksToDelete = selectedTasks.filter(t => ids.includes(t.id));
        
        ids.forEach(id => dispatch(deleteTask({ taskId: id })));
        setSelectionMode({ isActive: false, selectedTaskIds: [] });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
        
        showToast(
          `${ids.length} ${t('tasks deleted')}`,
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

  const handleShareSelected = async () => {
    try {
      const selectedTasksObjects = selectedTasks.filter(t => selectionMode.selectedTaskIds.includes(t.id));
      const shareText = selectedTasksObjects.map(t => {
        const taskName = t.taskname;
        const taskDate = t.completionDate;
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

  // Section Options Logic
  const handleCompleteSection = () => {
    setConfirmConfig({
      isVisible: true,
      title: 'Complete All',
      message: `Are you sure you want to complete all tasks for this day?`,
      confirmText: 'Complete',
      isDestructive: false,
      onConfirm: () => {
        const uncompletedTasks = selectedTasks.filter(t => !t.completed);
        
        uncompletedTasks.forEach(task => {
          dispatch(updateTask({ taskId: task.id, completed: true }));
        });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
        
        showToast(
          `${uncompletedTasks.length} ${t('tasks completed')}`,
          t('Undo'),
          () => {
            uncompletedTasks.forEach(task => {
              dispatch(updateTask({ taskId: task.id, completed: false }));
            });
          }
        );
      }
    });
  };

  const handleMoveForward = () => {
    setConfirmConfig({
      isVisible: true,
      title: 'Move Forward',
      message: `Are you sure you want to move all tasks to the next day?`,
      confirmText: 'Move',
      isDestructive: false,
      onConfirm: () => {
        const nextDate = dayjs(selectedDate).add(1, 'day').toISOString();
        selectedTasks.forEach(task => {
          if (!task.completed) {
            dispatch(updateTask({ taskId: task.id, completionDate: nextDate, completed: false }));
          }
        });
        setConfirmConfig(prev => ({ ...prev, isVisible: false }));
      }
    });
  };

  const handleDeleteSection = () => {
    setConfirmConfig({
      isVisible: true,
      title: 'Delete All',
      message: `Are you sure you want to delete all tasks for this day?`,
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: () => {
        const tasksToDelete = [...selectedTasks];
        
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

  // Prepare marked dates
  const markedDates = useMemo(() => {
    const marks = {};
    tasks.forEach(task => {
      if (task.completionDate) {
        const dateStr = dayjs(task.completionDate).format('YYYY-MM-DD');
        if (!marks[dateStr]) {
          marks[dateStr] = { tasks: [] };
        }
        marks[dateStr].tasks.push(task);
      }
    });

    const finalMarks = {};
    Object.keys(marks).forEach(dateStr => {
      const dayTasks = marks[dateStr].tasks;
      const allCompleted = dayTasks.every(t => t.completed);
      const anyMissed = dayTasks.some(t => !t.completed && dayjs(t.completionDate).isBefore(dayjs(), 'day'));
      const anyNotes = dayTasks.some(t => !t.completed && t.description?.text && t.description.text.trim() !== '');

      let dotColor = colors.primary;
      if (allCompleted) dotColor = '#ffffff';
      else if (anyMissed) dotColor = '#f44336';
      else if (anyNotes) dotColor = '#ff9800';

      finalMarks[dateStr] = { marked: true, dotColor: dotColor, textColor: dotColor === '#ffffff' ? colors.textSecondary : dotColor };
    });

    // Mark the currently selected date
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
      if (!task.completionDate) return false;
      return dayjs(task.completionDate).format('YYYY-MM-DD') === selectedDate;
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
      
      return parseInt(a.id || '0') - parseInt(b.id || '0');
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
          const boardName = boards.find(b => b.id === bId)?.name || 'Board';
          groups[bId] = { title: boardName, data: [] };
       }
       groups[bId].data.push(task);
    });
    
    return Object.values(groups).filter(g => g.data.length > 0);
  }, [selectedTasks, boards]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgMain }]}>
      <View onLayout={handleCalendarLayout}>
        <Calendar
          testID="task_calendar"
          key={`${colors.bgMain}-${isDark}-${i18n.language}`}
          current={selectedDate}
          onDayPress={(day) => {
            setSelectedDate(day.dateString);
            setSelectionMode({ isActive: false, selectedTaskIds: [] });
          }}
          markedDates={markedDates}
          enableSwipeMonths={true}
          theme={{
            backgroundColor: colors.bgMain,
            calendarBackground: colors.bgMain,
            textSectionTitleColor: colors.textSecondary,
            selectedDayBackgroundColor: colors.primary,
            selectedDayTextColor: colors.textInverse,
            todayTextColor: colors.primary,
            dayTextColor: colors.textPrimary,
            textDisabledColor: colors.surfaceContainerHigh,
            dotColor: colors.primary,
            selectedDotColor: colors.textInverse,
            arrowColor: colors.primary,
            monthTextColor: colors.textPrimary,
            indicatorColor: colors.primary,
            textDayFontWeight: '500',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 16,
            textMonthFontSize: 18,
            textDayHeaderFontSize: 14
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
                style={styles.ellipsisBtn} 
                onPress={() => setSectionOptionsConfig(true)}
              >
                <Text style={[styles.ellipsisText, { color: colors.textSecondary }]}>⋮</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {groupedTasks.length > 0 ? (
          <SectionList
            style={{ flex: 1 }}
            sections={groupedTasks}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TaskRow 
                task={item} 
                hideDate={true} 
                disableInlineEdit={true} 
                testIDPrefix="calendar_"
                isSelectionMode={selectionMode.isActive}
                isSelected={selectionMode.selectedTaskIds.includes(item.id)}
                onToggleSelect={() => toggleTaskSelection(item.id)}
                onPressSnooze={(t) => { setSelectedTask(t); setSnoozeVisible(true); }}
                onPressMore={(t) => { setSelectedTask(t); setQuickMenuVisible(true); }}
                onPress={() => {
                  setSelectedTask(item);
                  setDetailsVisible(true);
                }}
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
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('No tasks scheduled for this day.')}</Text>
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

      <TaskQuickMenuModal 
        isVisible={isQuickMenuVisible}
        onClose={() => setQuickMenuVisible(false)}
        task={selectedTask}
        colors={colors}
        isDark={colors.background === '#121212'}
        onPressEdit={(t) => { setSelectedTask(t); setDetailsVisible(true); }}
        onPressSnooze={(t) => { setSelectedTask(t); setSnoozeVisible(true); }}
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
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Sort by Time')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setSortConfig('priority'); setSectionOptionsConfig(false); }}>
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Sort by Priority')}</Text>
          </TouchableOpacity>

          {isPremium && (
            <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { 
              setSelectionMode({ isActive: true, selectedTaskIds: [] }); 
              setSectionOptionsConfig(false); 
            }}>
              <Text style={[styles.optionText, { color: colors.primary }]}>{t('Select Tasks')}</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setSectionOptionsConfig(false); setTimeout(() => handleCompleteSection(), 400); }}>
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Complete all')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setSectionOptionsConfig(false); setTimeout(() => handleMoveForward(), 400); }}>
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>{t('Move forward')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.borderColor }]} onPress={() => { setSectionOptionsConfig(false); setTimeout(() => handleDeleteSection(), 400); }}>
            <Text style={{ color: '#f44336', fontSize: 16, fontWeight: 'bold' }}>{t('Delete all')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionBtn, { borderBottomWidth: 0 }]} onPress={() => setSectionOptionsConfig(false)}>
            <Text style={[styles.optionText, { color: colors.textSecondary }]}>{t('Cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {selectionMode.isActive && (
        <View style={[styles.actionBar, { backgroundColor: colors.bgCard, borderTopColor: colors.borderColor }]}>
          <Text style={[styles.actionBarText, { color: colors.textPrimary }]}>{selectionMode.selectedTaskIds.length} {t('Selected')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionBarButtons} style={{ flex: 1, marginLeft: 10 }}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.actionBtn}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('All')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShareSelected} style={styles.actionBtn}>
              <Text style={{ color: '#2196f3', fontWeight: 'bold' }}>{t('Share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCompleteSelected} style={styles.actionBtn}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('Complete')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteSelected} style={styles.actionBtn}>
              <Text style={{ color: '#f44336', fontWeight: 'bold' }}>{t('Delete')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectionMode({ isActive: false, selectedTaskIds: [] })} style={styles.actionBtn}>
              <Text style={{ color: colors.textSecondary, fontWeight: 'bold' }}>{t('Cancel')}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  calendar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  taskListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  taskListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  ellipsisBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ellipsisText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  listContent: {
    paddingVertical: 15,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
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
    shadowRadius: 5,
    elevation: 5,
  },
  dragHandleContainer: {
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.5,
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
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginTop: 10,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)'
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
