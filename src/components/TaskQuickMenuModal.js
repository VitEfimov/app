import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { updateTask, deleteTask, addTask } from '../features/taskSlice';
import { useToast } from '../styles/ToastContext';
import { useTheme } from '../styles/ThemeContext';
import dayjs from 'dayjs';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { Alert, Platform } from 'react-native';
import { shareTaskAsync } from '../../modules/expo-task-alarm';
import Svg, { Path, Circle, Polyline, Rect } from 'react-native-svg';

const IconEdit = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);

const IconComplete = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

const IconSnooze = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Polyline points="12 6 12 12 16 14" />
  </Svg>
);

const IconDuplicate = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);

const IconShare = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="18" cy="5" r="3" />
    <Circle cx="6" cy="12" r="3" />
    <Circle cx="18" cy="19" r="3" />
    <Path d="M8.59 13.51l6.83 3.98" />
    <Path d="M15.41 6.51l-6.82 3.98" />
  </Svg>
);

const IconDelete = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18" />
    <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

const IconFolder = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </Svg>
);

const IconMoveForward = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="13 17 18 12 13 7" />
    <Polyline points="6 17 11 12 6 7" />
  </Svg>
);

const IconMoveBackward = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="11 17 6 12 11 7" />
    <Polyline points="18 17 13 12 18 7" />
  </Svg>
);

import MoveBoardModal from './MoveBoardModal';
import ConfirmModal from './ConfirmModal';

let RNShare;
if (Platform.OS !== 'web') {
  RNShare = require('react-native-share').default;
}

export default function TaskQuickMenuModal({
  isVisible,
  onClose,
  task,
  onEdit,
  onSnooze,
  onPressEdit,
  onPressSnooze,
  onMoveForward,
  onMoveBackward,
}) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();
  const { showToast } = useToast();
  const boards = useSelector(state => state.userReducer.boards || []);
  const [isMoveBoardVisible, setMoveBoardVisible] = React.useState(false);
  const [confirmConfig, setConfirmConfig] = React.useState({ isVisible: false, title: '', message: '', confirmText: 'Confirm', cancelText: 'Cancel', isDestructive: false, hideCancel: false, onConfirm: null });

  if (!task) return null;

  const handleComplete = () => {
    const newCompletedState = !task.completed;
    dispatch(updateTask({ taskId: task.id, completed: newCompletedState }));
    onClose();
    
    showToast(
      newCompletedState ? t('Task Completed') : t('Task Uncompleted'),
      t('Undo'),
      () => {
        dispatch(updateTask({ taskId: task.id, completed: !newCompletedState, isUndo: true }));
      }
    );
  };

  const handleDelete = () => {
    dispatch(deleteTask({ taskId: task.id }));
    onClose();
    
    showToast(
      t('Task Deleted'),
      t('Undo'),
      () => {
        dispatch(addTask({ task, isUndo: true }));
      }
    );
  };

  const handleDuplicate = () => {
    const newTask = {
      ...task,
      id: Math.random().toString(36).substr(2, 9),
      completed: false
    };
    dispatch(addTask({ task: newTask }));
    onClose();
  };

  const prepareAttachmentsForShare = async (attachmentsToShare) => {
    const urls = [];
    for (let i = 0; i < attachmentsToShare.length; i++) {
      const attachment = attachmentsToShare[i];
      let uri = attachment.uri;

      if (attachment.type === 'image' && uri.startsWith('data:image')) {
        const comma = uri.indexOf(',');
        const base64Data = uri.substring(comma + 1);
        const ext = attachment.name?.split('.').pop() || 'jpg';
        const tempUri = `${FileSystem.cacheDirectory}share-${Date.now()}-${i}.${ext}`;

        await FileSystem.writeAsStringAsync(tempUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        uri = tempUri;
      }

      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        console.warn('Skipping missing attachment:', attachment.name, uri);
        continue;
      }
      urls.push(uri);
    }
    return urls;
  };

  const handleShare = async () => {
    try {
      const attachments = task.description?.attachments ? [...task.description.attachments] : [];
      if (task.description?.img && attachments.length === 0) {
        attachments.push({ uri: task.description.img, type: 'image', name: 'image.jpg' });
      }

      const message = `${task.taskname}\n\n${task.description?.text || ''}`;

      if (attachments.length > 0 && Platform.OS !== 'web') {
        await Clipboard.setStringAsync(message);
        
        setConfirmConfig({
          isVisible: true,
          title: t('Sharing with Attachments'),
          message: t('Task text copied to clipboard! You can paste it into your message after selecting where to share.'),
          confirmText: t('Continue'),
          cancelText: t('Cancel'),
          hideCancel: false,
          onConfirm: async () => {
            setConfirmConfig(prev => ({ ...prev, isVisible: false }));
            try {
              const urlsToShare = await prepareAttachmentsForShare(attachments);
              if (urlsToShare.length === 0) return;

              requestAnimationFrame(async () => {
                try {
                  if (Platform.OS === 'android') {
                    await shareTaskAsync(message, urlsToShare);
                  } else {
                    await RNShare.open({
                      urls: urlsToShare,
                      type: '*/*',
                      title: t('Share Task'),
                      failOnCancel: false
                    });
                  }
                } catch (err) {
                  if (err.message !== 'User did not share') {
                    setConfirmConfig({
                      isVisible: true,
                      title: t("Error sharing") || "Error sharing",
                      message: err.message,
                      confirmText: t("OK"),
                      hideCancel: true,
                      onConfirm: () => setConfirmConfig(prev => ({ ...prev, isVisible: false }))
                    });
                  }
                }
              });
            } catch (err) {
              setConfirmConfig({
                isVisible: true,
                title: t("Error sharing") || "Error sharing",
                message: err.message,
                confirmText: t("OK"),
                hideCancel: true,
                onConfirm: () => setConfirmConfig(prev => ({ ...prev, isVisible: false }))
              });
            }
          }
        });
      } else {
        await Share.share({
          message,
          title: t('Share Task')
        });
        onClose();
      }
    } catch (error) {
      setConfirmConfig({
        isVisible: true,
        title: t("Error") || "Error",
        message: error.message,
        confirmText: t("OK"),
        hideCancel: true,
        onConfirm: () => setConfirmConfig(prev => ({ ...prev, isVisible: false }))
      });
    }
  };

  const handleSelectBoard = (targetBoardId) => {
    const prevBoardId = task.boardId || 'main';
    dispatch(updateTask({ taskId: task.id, boardId: targetBoardId }));
    const targetBoard = boards.find(b => b.id === targetBoardId);
    const boardName = targetBoard ? (targetBoard.name === 'Main' ? t('Main') : targetBoard.name) : t('Board');
    
    showToast(
      `${t('Moved to')} ${boardName}`,
      t('Undo'),
      () => {
        dispatch(updateTask({ taskId: task.id, boardId: prevBoardId, isUndo: true }));
      }
    );
  };

  const handleMoveTaskDate = (direction) => {
    const today = dayjs().startOf('day');
    const taskDate = task.completionDate ? dayjs(task.completionDate).startOf('day') : today;
    let newDate;

    if (direction === 'forward') {
      if (taskDate.isBefore(today)) {
        newDate = today.toISOString();
      } else if (taskDate.isSame(today)) {
        newDate = today.add(1, 'day').toISOString();
      } else if (taskDate.isSame(today.add(1, 'day'))) {
        newDate = today.endOf('isoWeek').toISOString();
      } else if (taskDate.isBefore(today.add(1, 'week').startOf('isoWeek'))) {
        newDate = today.add(1, 'week').startOf('isoWeek').toISOString();
      } else {
        newDate = today.add(2, 'week').startOf('isoWeek').toISOString();
      }
    } else {
      // backward
      if (taskDate.isAfter(today.add(1, 'week').startOf('isoWeek'))) {
        newDate = today.add(1, 'week').startOf('isoWeek').toISOString();
      } else if (taskDate.isAfter(today.endOf('isoWeek'))) {
        newDate = today.endOf('isoWeek').toISOString();
      } else if (taskDate.isAfter(today.add(1, 'day'))) {
        newDate = today.add(1, 'day').toISOString();
      } else if (taskDate.isSame(today.add(1, 'day'))) {
        newDate = today.toISOString();
      } else if (taskDate.isSame(today)) {
        newDate = today.subtract(1, 'day').toISOString();
      } else {
        newDate = taskDate.subtract(1, 'day').toISOString();
      }
    }

    const prevDateStr = task.completionDate ? dayjs(task.completionDate).format('YYYY-MM-DD') : '';
    const newDateStr = dayjs(newDate).format('YYYY-MM-DD');

    if (prevDateStr === newDateStr) {
      onClose();
      showToast(t('Date unchanged. You can change the date on the edit task page.'));
      return;
    }

    const prevDate = task.completionDate;
    dispatch(updateTask({ taskId: task.id, completionDate: newDate }));
    onClose();
    showToast(
      direction === 'forward' ? t('Task moved forward') : t('Task moved backward'),
      t('Undo'),
      () => {
        dispatch(updateTask({ taskId: task.id, completionDate: prevDate, isUndo: true }));
      }
    );
  };

  const handleEditAction = onPressEdit || onEdit;
  const handleSnoozeAction = onPressSnooze || onSnooze;

  const actionItems = [
    { label: t('Edit'), icon: IconEdit, onPress: () => { onClose(); if (typeof handleEditAction === 'function') handleEditAction(task); } },
    { label: task.completed ? t('Mark Uncomplete') : t('Complete'), icon: IconComplete, onPress: handleComplete },
    { label: t('Move Forward'), icon: IconMoveForward, onPress: () => handleMoveTaskDate('forward') },
    { label: t('Move Backward'), icon: IconMoveBackward, onPress: () => handleMoveTaskDate('backward') },
    { label: t('Move to Board'), icon: IconFolder, onPress: () => { onClose(); setTimeout(() => setMoveBoardVisible(true), 300); } },
    { label: t('Snooze'), icon: IconSnooze, onPress: () => { onClose(); if (typeof handleSnoozeAction === 'function') handleSnoozeAction(task); } },
    { label: t('Duplicate'), icon: IconDuplicate, onPress: handleDuplicate },
    { label: t('Share'), icon: IconShare, onPress: handleShare },
    { label: t('Delete'), icon: IconDelete, onPress: handleDelete, danger: true },
  ];

  return (
    <>
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      propagateSwipe={true}
      onBackdropPress={onClose}
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
        <View style={styles.dragHandle} />
        
        <View style={styles.header}>
          <Text style={[styles.taskTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {task.taskname}
          </Text>
        </View>

        <ScrollView style={styles.actionList}>
          {actionItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              testID={`quick_menu_action_${item.label.toLowerCase().replace(/\s+/g, '_')}`}
              style={[styles.actionRow, { borderBottomColor: colors.borderColor }]} 
              onPress={item.onPress}
            >
              <View style={styles.actionIconContainer}>
                <item.icon color={item.danger ? '#f44336' : colors.textPrimary} />
              </View>
              <Text style={[styles.actionLabel, { color: item.danger ? '#f44336' : colors.textPrimary }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
    <MoveBoardModal
      isVisible={isMoveBoardVisible}
      onClose={() => setMoveBoardVisible(false)}
      onSelectBoard={handleSelectBoard}
      boards={boards}
      currentBoardId={task?.boardId || 'main'}
      taskCount={1}
      colors={colors}
    />
    <ConfirmModal
      isVisible={confirmConfig.isVisible}
      title={confirmConfig.title}
      message={confirmConfig.message}
      confirmText={confirmConfig.confirmText}
      cancelText={confirmConfig.cancelText}
      isDestructive={confirmConfig.isDestructive}
      hideCancel={confirmConfig.hideCancel}
      onConfirm={confirmConfig.onConfirm}
      onCancel={() => setConfirmConfig(prev => ({ ...prev, isVisible: false }))}
    />
    </>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 15,
    paddingBottom: 30,
    paddingHorizontal: 20,
    maxHeight: '70%'
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#888',
    borderRadius: 3,
    marginBottom: 20,
    alignSelf: 'center'
  },
  header: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)'
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionList: {
    width: '100%'
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  actionIconContainer: {
    marginRight: 15,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500'
  }
});
