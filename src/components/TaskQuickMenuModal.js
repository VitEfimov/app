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
import { Alert } from 'react-native';

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
        dispatch(updateTask({ taskId: task.id, completed: !newCompletedState }));
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
        dispatch(addTask({ task }));
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

  const handleShare = async () => {
    try {
      if (task.description?.img) {
        await Clipboard.setStringAsync(`${task.taskname}\n\n${task.description.text || ''}`);
        Alert.alert(
          t('Text Copied'),
          t('Task text copied to clipboard! You can paste it into your message after selecting where to share the image.'),
          [
            {
              text: t('Continue'),
              onPress: async () => {
                try {
                  const base64Data = task.description.img.split(',')[1];
                  const fileUri = FileSystem.cacheDirectory + 'task-image.jpg';
                  await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
                  
                  await Sharing.shareAsync(fileUri, {
                    dialogTitle: t('Share Task')
                  });
                } catch (err) {
                  Alert.alert("Error sharing image", err.message);
                }
              }
            }
          ]
        );
      } else {
        await Share.share({
          message: `${task.taskname}\n\n${task.description?.text || ''}`,
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
