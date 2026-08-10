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
    { label: t('Edit'), icon: IconEdit, onPress: () => { onClose(); onPressEdit(task); } },
    { label: task.completed ? t('Mark Uncomplete') : t('Complete'), icon: IconComplete, onPress: handleComplete },
    { label: t('Snooze'), icon: IconSnooze, onPress: () => { onClose(); onPressSnooze(task); } },
    { label: t('Duplicate'), icon: IconDuplicate, onPress: handleDuplicate },
    { label: t('Share'), icon: IconShare, onPress: handleShare },
    { label: t('Delete'), icon: IconDelete, onPress: handleDelete, danger: true },
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
