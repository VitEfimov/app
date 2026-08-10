import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { updateTask, deleteTask, addTask } from '../features/taskSlice';
import { useToast } from '../styles/ToastContext';
import dayjs from 'dayjs';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { Alert, Platform } from 'react-native';
import { shareTaskAsync } from '../../modules/expo-task-alarm';

let RNShare;
if (Platform.OS !== 'web') {
  RNShare = require('react-native-share').default;
}

export default function TaskQuickMenuModal({ 
  isVisible, 
  onClose, 
  task, 
  colors, 
  isDark,
  onPressEdit,
  onPressSnooze
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { showToast } = useToast();

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
        
        Alert.alert(
          t('Sharing with Attachments'),
          t('Task text copied to clipboard! You can paste it into your message after selecting where to share.'),
          [
            { text: t('Cancel'), style: 'cancel' },
            {
              text: t('Continue'),
              onPress: async () => {
                try {
                  const urlsToShare = await prepareAttachmentsForShare(attachments);
                  
                  if (urlsToShare.length === 0) {
                    return;
                  }

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
                        Alert.alert("Error sharing", err.message);
                      }
                    }
                  });
                } catch (err) {
                  Alert.alert("Error sharing", err.message);
                }
              }
            }
          ]
        );
      } else {
        await Share.share({
          message,
          title: t('Share Task')
        });
      }
    } catch (error) {
      Alert.alert(error.message);
    }
    onClose();
  };

  const actionItems = [
    { label: t('Edit'), icon: '✏️', onPress: () => { onClose(); onPressEdit(task); } },
    { label: task.completed ? t('Mark Uncomplete') : t('Complete'), icon: '✓', onPress: handleComplete },
    { label: t('Snooze'), icon: '💤', onPress: () => { onClose(); onPressSnooze(task); } },
    { label: t('Duplicate'), icon: '📋', onPress: handleDuplicate },
    { label: t('Share'), icon: '📤', onPress: handleShare },
    { label: t('Delete'), icon: '🗑️', onPress: handleDelete, danger: true },
  ];

  return (
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
              style={[styles.actionRow, { borderBottomColor: colors.borderColor }]} 
              onPress={item.onPress}
            >
              <Text style={styles.actionIcon}>{item.icon}</Text>
              <Text style={[styles.actionLabel, { color: item.danger ? '#f44336' : colors.textPrimary }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
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
  actionIcon: {
    fontSize: 22,
    marginRight: 15,
    width: 30,
    textAlign: 'center'
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500'
  }
});
