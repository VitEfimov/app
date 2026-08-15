import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal as RNModal, ScrollView, Platform, Share, Image, KeyboardAvoidingView, Keyboard, Alert, Switch, AppState, Linking } from 'react-native';
import Modal from 'react-native-modal';
import CustomTimePicker from './CustomTimePicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as IntentLauncher from 'expo-intent-launcher';
import { useDispatch, useSelector } from 'react-redux';

let RNShare;
if (Platform.OS !== 'web') {
  RNShare = require('react-native-share').default;
}
import { updateTask, deleteTask, updateRecurringSeries, deleteRecurringSeries } from '../features/taskSlice';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../styles/ThemeContext';
import dayjs from 'dayjs';
import * as Localization from 'expo-localization';
import Svg, { Path, Circle, Rect, Polyline } from 'react-native-svg';
import { Calendar } from 'react-native-calendars';
import { scheduleTaskReminder, cancelNotification } from '../utils/notifications';
import { useTaskRepeat } from '../custom-hooks/useTaskRepeat';
import { takePhotoAsync, shareTaskAsync, openDocumentAsync as nativeOpenDocumentAsync } from '../../modules/expo-task-alarm';
import CustomDropdown from './CustomDropdown';
import CustomRepeatModal from './CustomRepeatModal';
import ConfirmModal from './ConfirmModal';
import { useTranslation } from 'react-i18next';

const MemoizedNotesInput = React.memo(React.forwardRef(({ initialValue, placeholder, placeholderTextColor, style }, ref) => {
  const [text, setText] = useState(initialValue || '');

  useEffect(() => {
    setText(initialValue || '');
  }, [initialValue]);

  React.useImperativeHandle(ref, () => ({
    getText: () => text
  }));

  return (
    <TextInput
      accessible={true} accessibilityLabel="Task Notes"
      style={style}
      value={text}
      onChangeText={setText}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      multiline={true}
      scrollEnabled={false}
      textAlignVertical="top"
    />
  );
}));

const IconClose = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

const IconShare = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
    <Path d="M16 6l-4-4-4 4" />
    <Path d="M12 2v13" />
  </Svg>
);

const IconCalendar = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18" />
  </Svg>
);

const IconCircle = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
  </Svg>
);

const IconCheckCircle = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M8 12l3 3 5-6" />
  </Svg>
);

const IconClock = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 6v6l4 2" />
  </Svg>
);

const IconList = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Svg>
);

const IconListNumbered = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M4 14h2M4 18h2" />
  </Svg>
);

const IconSquare = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </Svg>
);

const IconFile = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
    <Polyline points="13 2 13 9 20 9" />
  </Svg>
);

const IconAttachment = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
  </Svg>
);

const IconCamera = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <Circle cx="12" cy="13" r="4" />
  </Svg>
);

const IconImage = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <Circle cx="8.5" cy="8.5" r="1.5" />
    <Polyline points="21 15 16 10 5 21" />
  </Svg>
);

const IconCheckSquare = ({ color }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 11l3 3L22 4" />
    <Path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </Svg>
);

export default function TaskDetailsModal({ task, isVisible, onClose }) {
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();
  const themeState = useSelector(state => state.themeReducer);
  const isPremium = useSelector(state => state.entitlementReducer?.isPremium);
  const scrollViewRef = useRef(null);
  const notesRef = useRef(null);
  const { t, i18n } = useTranslation();
  const [scrollOffset, setScrollOffset] = useState(0);

  const [taskName, setTaskName] = useState('');
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [subtasks, setSubtasks] = useState(task ? (task.subtasks || []) : []);
  const [priority, setPriority] = useState('none');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reminder, setReminder] = useState('None');
  const [isAlarm, setIsAlarm] = useState(false);
  const [repeatConfig, setRepeatConfig] = useState({ preset: 'None' });
  const [isRepeatModalVisible, setIsRepeatModalVisible] = useState(false);
  const [repeatStartDate, setRepeatStartDate] = useState('');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [confirmConfig, setConfirmConfig] = useState({ isVisible: false, title: '', message: '', onConfirm: null, confirmText: 'Confirm', isDestructive: false, secondaryConfirmText: null, onSecondaryConfirm: null, hideCancel: false, cancelText: '' });
  const { generateRepeatingTasks } = useTaskRepeat();

  const [datePickerType, setDatePickerType] = useState(null);
  const [selectedFullscreenImage, setSelectedFullscreenImage] = useState(null);

  const surfaceLighter = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';

  const stripHtml = (html) => html ? html.replace(/<[^>]+>/g, '').trim() : '';

  useEffect(() => {
  if (isVisible && task) {
    setTaskName(task.taskname || '');
    setNotes(stripHtml(task.description?.text) || '');
    
    // Backwards compatibility for old base64 img
    const existingAttachments = task.description?.attachments ? [...task.description.attachments] : [];
    if (task.description?.img && existingAttachments.length === 0) {
      existingAttachments.push({
        id: 'legacy_img',
        type: 'image',
        uri: task.description.img,
        name: 'Attached Image',
        size: 0
      });
    }
    setAttachments(existingAttachments);
    
    setSubtasks(task.subtasks || []);
    setPriority((task.priority || 'none').toLowerCase());
    setSelectedDate(task.completionDate || '');

    // Saved user time or null.
    setSelectedTime(task.time || null);

    let config = task.repeatConfig || { preset: task.repeatFrequency || 'None' };
    if (typeof config === 'string') config = JSON.parse(config);
    setRepeatConfig(config);

    setRepeatStartDate(
      task.repeatStartDate ||
      task.completionDate ||
      ''
    );

    setRepeatEndDate(
      task.repeatEndDate || ''
    );

    setReminder(task.reminder || 'None');
    setIsAlarm(task.isAlarm || false);
  }
}, [isVisible, task?.id]);


useEffect(() => {
  if (Platform.OS !== 'android') return;
  const recoverPickerResult = async () => {
    try {
      const pending = await ImagePicker.getPendingResultAsync();
      if (pending && !pending.canceled && pending.assets) {
        await processPickedImages(pending);
      }
    } catch (error) {
      console.error('Pending ImagePicker recovery failed:', error);
    }
  };
  recoverPickerResult();
}, []);

  const formatDisplayTime = (timeStr) => {
    if (!timeStr || timeStr === '--:--') return '--:--';
    try {
      const [h, m] = timeStr.split(':');
      if (!h || !m || isNaN(h) || isNaN(m)) return timeStr;
      
      const is24Hour = Localization.getCalendars()[0]?.uses24hourClock ?? false;
      let hour = parseInt(h, 10);
      let ampm = '';
      
      if (!is24Hour) {
        ampm = hour >= 12 ? ' PM' : ' AM';
        if (hour > 12) hour -= 12;
        if (hour === 0) hour = 12;
      } else {
        hour = hour.toString().padStart(2, '0');
      }
      
      return `${hour}:${m.padStart(2, '0')}${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const prepareAttachmentsForShare = async () => {
    const urls = [];

    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i];
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
      const priorityStr = priority && priority !== 'none' ? priority.charAt(0).toUpperCase() + priority.slice(1) : '';
      const currentNotes = notesRef.current ? notesRef.current.getText() : notes;
      const message = `${t('Task')}: ${taskName}\n${t('Due')}: ${selectedDate ? dayjs(selectedDate).format('MMM D, YYYY') : t('Not set')}${selectedTime ? ` ${t('at')} ${selectedTime}` : ''}${priorityStr ? `\n${t('Priority')}: ${priorityStr}` : ''}\n\n${currentNotes ? `${t('Notes')}:\n${currentNotes}\n\n` : ''}${subtasks.length > 0 ? `${t('Subtasks')}:\n${subtasks.map(s => `- ${s.completed ? '☑️' : '🔲'} ${s.text}`).join('\n')}` : ''}`;
      
      if (attachments.length > 0 && Platform.OS !== 'web') {
        await Clipboard.setStringAsync(message);
        
        setConfirmConfig({
          isVisible: true,
          title: t('Sharing with Attachments'),
          message: t('Task text copied to clipboard! You can paste it into your message after selecting where to share.'),
          hideCancel: true,
          confirmText: t('Continue'),
          onConfirm: async () => {
            setConfirmConfig(prev => ({ ...prev, isVisible: false }));
            try {
              const urlsToShare = await prepareAttachmentsForShare();
              
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
                } catch (e) {
                  if (e.message !== 'User did not share') {
                    console.error(e);
                  }
                }
              });
            } catch (e) {
              console.error(e);
            }
          }
        });
      } else {
        await Share.share({
          message,
          title: t('Share Task')
        });
      }
    } catch (error) {
      console.error(error.message);
    }
  };

  if (!task) return null;

  const handleUpdate = (updates) => {
    // Only used for immediate local updates like priority or subtask check
    dispatch(updateTask({ taskId: task.id, ...updates }));
  };

  const hasUnsavedChanges = () => {
    if (!task) return false;
    const currentNotes = notesRef.current ? notesRef.current.getText() : notes;
    if (taskName !== task.taskname) return true;
    
    const initialAttachments = task.description?.attachments || (task.description?.img ? [{ id: 'legacy_img', type: 'image', uri: task.description.img }] : []);
    if (currentNotes !== (stripHtml(task.description?.text) || '') || JSON.stringify(attachments) !== JSON.stringify(initialAttachments)) return true;
    
    if ((selectedTime || '') !== (task.time || '')) return true;
    if (reminder !== (task.reminder || 'None')) return true;
    if (isAlarm !== (task.isAlarm || false)) return true;
    if (priority !== (task.priority || 'none').toLowerCase()) return true;
    if (selectedDate !== (task.completionDate || '')) return true;
    
    const initialConfig = task.repeatConfig || { preset: task.repeatFrequency || 'None' };
    if (JSON.stringify(repeatConfig) !== JSON.stringify(initialConfig)) return true;
    
    if (repeatStartDate !== (task.repeatStartDate || task.completionDate || '')) return true;
    if (repeatEndDate !== (task.repeatEndDate || '')) return true;
    if (JSON.stringify(subtasks) !== JSON.stringify(task.subtasks || [])) return true;
    return false;
  };

  const executeSave = async ({ updateSeries = false } = {}) => {
    const currentNotes = notesRef.current ? notesRef.current.getText() : notes;
    let updates = {};
    if (taskName !== task.taskname) updates.name = taskName;
    
    const initialAttachments = task.description?.attachments || (task.description?.img ? [{ id: 'legacy_img', type: 'image', uri: task.description.img }] : []);
    if (currentNotes !== stripHtml(task.description?.text) || JSON.stringify(attachments) !== JSON.stringify(initialAttachments)) {
      updates.description = { 
        text: currentNotes, 
        img: attachments.length > 0 && attachments[0].type === 'image' ? attachments[0].uri : '', // keep first img for legacy support
        attachments: attachments,
        url: '' 
      };
    }
    
    if (selectedTime !== (task.time || '')) updates.time = selectedTime;
    if (selectedDate !== (task.completionDate || '')) updates.completionDate = selectedDate;
    if (priority !== (task.priority || 'none').toLowerCase()) updates.priority = priority;
    
    const initialConfig = task.repeatConfig || { preset: task.repeatFrequency || 'None' };
    const repeatConfigChanged = JSON.stringify(repeatConfig) !== JSON.stringify(initialConfig);
    if (repeatConfigChanged) {
      updates.repeatConfig = repeatConfig;
      updates.repeatFrequency = repeatConfig.preset; // backwards compatibility
    }
    
    if (repeatStartDate !== (task.repeatStartDate || task.completionDate || '')) updates.repeatStartDate = repeatStartDate;
    if (repeatEndDate !== (task.repeatEndDate || '')) updates.repeatEndDate = repeatEndDate;
    
    const timeChanged = selectedTime !== (task.time || '');
    const dateChanged = selectedDate !== (task.completionDate || '');
    const reminderChanged = reminder !== (task.reminder || 'None');
    const isAlarmChanged = isAlarm !== (task.isAlarm || false);
    const nameChanged = taskName !== task.taskname;

    if (isAlarmChanged) updates.isAlarm = isAlarm;

    if (timeChanged || dateChanged || reminderChanged || isAlarmChanged || nameChanged) {
      if (reminder !== (task.reminder || 'None')) updates.reminder = reminder;
      // Schedule new notifications
      if (task.notificationId) {
        await cancelNotification(task.notificationId);
        updates.notificationId = null;
      }
      const notifIds = await scheduleTaskReminder(taskName, reminder, selectedDate || dayjs().format('YYYY-MM-DD'), selectedTime, task.id, isAlarm, themeState);
      if (notifIds && notifIds.length > 0) updates.notificationId = notifIds;
    }
    
    if (JSON.stringify(subtasks) !== JSON.stringify(task.subtasks || [])) {
      updates.subtasks = subtasks;
    }
    
    // If repeat is newly configured or task does not have a recurring series yet
    if (repeatConfig.preset !== 'None' && repeatEndDate && !task.recurringSeriesId) {
      const result = generateRepeatingTasks(
        task, 
        { 
          name: taskName, 
          priority, 
          time: selectedTime, 
          reminder, 
          isAlarm, 
          attachments, 
          subtasks, 
          description: { text: currentNotes, img: attachments.length > 0 && attachments[0].type === 'image' ? attachments[0].uri : '', url: '', attachments }
        }, 
        { ...repeatConfig, startDate: repeatStartDate || selectedDate || dayjs().format('YYYY-MM-DD'), endDate: repeatEndDate }
      );
      if (result && result.seriesId) {
        updates.recurringSeriesId = result.seriesId;
        updates.isRecurring = true;
      }
    } else if (task.recurringSeriesId && updateSeries) {
      // If user chose to update all upcoming tasks in this series:
      if (repeatConfigChanged && repeatConfig.preset === 'None') {
        // Stop repeat: delete future instances
        dispatch(deleteRecurringSeries({ seriesId: task.recurringSeriesId, fromDate: task.completionDate }));
        updates.recurringSeriesId = null;
        updates.isRecurring = false;
      } else if (repeatConfigChanged && repeatEndDate) {
        // Regenerate future instances
        dispatch(deleteRecurringSeries({ seriesId: task.recurringSeriesId, fromDate: dayjs(task.completionDate).add(1, 'day').toISOString() }));
        generateRepeatingTasks(
          task, 
          { 
            name: taskName, 
            priority, 
            time: selectedTime, 
            reminder, 
            isAlarm, 
            attachments, 
            subtasks, 
            description: { text: currentNotes, img: attachments.length > 0 && attachments[0].type === 'image' ? attachments[0].uri : '', url: '', attachments }
          }, 
          { ...repeatConfig, startDate: repeatStartDate || selectedDate || dayjs().format('YYYY-MM-DD'), endDate: repeatEndDate }
        );
      } else {
        // Update all upcoming instances with the modified fields!
        dispatch(updateRecurringSeries({
          seriesId: task.recurringSeriesId,
          fromDate: task.completionDate,
          updates: {
            name: taskName,
            priority: priority,
            time: selectedTime,
            reminder: reminder,
            isAlarm: isAlarm,
            description: {
              text: currentNotes,
              img: attachments.length > 0 && attachments[0].type === 'image' ? attachments[0].uri : '',
              url: '',
              attachments: attachments
            },
            subtasks: subtasks,
            repeatConfig: repeatConfig,
            repeatFrequency: repeatConfig.preset,
            repeatStartDate: repeatStartDate,
            repeatEndDate: repeatEndDate
          }
        }));
      }
    }

    if (Object.keys(updates).length > 0) {
      dispatch(updateTask({ taskId: task.id, ...updates }));
    }

    onClose();
  };

  const handleSave = () => {
    const isRecurring = !!(task.recurringSeriesId || (task.isRecurring && task.recurringSeriesId));
    if (isRecurring && hasUnsavedChanges()) {
      setConfirmConfig({
        isVisible: true,
        title: t('Recurring Task'),
        message: t('Do you want to apply changes to only this task or to all upcoming tasks in this series?'),
        confirmText: t('This task only'),
        isDestructive: false,
        onConfirm: () => {
          setConfirmConfig(prev => ({ ...prev, isVisible: false }));
          executeSave({ updateSeries: false });
        },
        secondaryConfirmText: t('All upcoming tasks'),
        onSecondaryConfirm: () => {
          setConfirmConfig(prev => ({ ...prev, isVisible: false }));
          executeSave({ updateSeries: true });
        }
      });
    } else {
      executeSave({ updateSeries: false });
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges()) {
      setConfirmConfig({
        isVisible: true,
        title: t('Unsaved Changes'),
        message: t('You have unsaved changes. Are you sure you want to discard them?'),
        confirmText: t('Discard'),
        isDestructive: true,
        onConfirm: () => {
          setConfirmConfig(prev => ({ ...prev, isVisible: false }));
          onClose();
        },
        secondaryConfirmText: t('Save'),
        onSecondaryConfirm: () => {
          setConfirmConfig(prev => ({ ...prev, isVisible: false }));
          handleSave();
        }
      });
    } else {
      onClose();
    }
  };

  const handleNameBlur = () => {
    // Removed auto-save
  };

  const handleNotesBlur = () => {
    // Removed auto-save
  };

  const saveFileToDocuments = async (uri, name) => {
    try {
      const fileExt = name.split('.').pop();
      const newFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const newUri = `${FileSystem.documentDirectory}${newFileName}`;
      await FileSystem.copyAsync({ from: uri, to: newUri });
      return newUri;
    } catch (e) {
      console.error(e);
      return uri; // fallback
    }
  };

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  const handleAttachPhoto = () => {
    launchCamera();
  };

  const handleAttachDocument = () => {
    requestAnimationFrame(() => pickDocument());
  };

  const processPickedImages = async (result) => {
    if (result?.canceled || !result?.assets?.length) {
      return;
    }

    const added = [];

    for (const asset of result.assets) {
      if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
        setConfirmConfig({
          isVisible: true,
          title: t('File Too Large'),
          message: t('Images must be less than 5MB.'),
          hideCancel: true,
          confirmText: t('OK'),
          onConfirm: () =>
            setConfirmConfig(prev => ({
              ...prev,
              isVisible: false,
            })),
        });

        continue;
      }

      const savedUri = await saveFileToDocuments(
        asset.uri,
        asset.fileName || `photo-${Date.now()}.jpg`
      );

      added.push({
        id:
          Date.now().toString() +
          Math.random().toString(36),
        type: 'image',
        uri: savedUri,
        name:
          asset.fileName ||
          `Photo-${Date.now()}.jpg`,
        size: asset.fileSize || 0,
        mimeType:
          asset.mimeType || 'image/jpeg',
      });
    }

    if (added.length) {
      setAttachments(prev => [
        ...prev,
        ...added,
      ]);
    }
  };

  const launchCamera = async () => {
    try {
      console.log('[Camera] start');
      let permission = await ImagePicker.getCameraPermissionsAsync();
      console.log('[Camera] current permission:', {
        status: permission.status,
        granted: permission.granted,
        canAskAgain: permission.canAskAgain,
      });

      if (!permission.granted) {
        const requested = await ImagePicker.requestCameraPermissionsAsync();
        console.log('[Camera] permission response:', {
          status: requested.status,
          granted: requested.granted,
          canAskAgain: requested.canAskAgain,
        });

        if (!requested.granted) {
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      console.log('[Camera] calling launchCameraAsync');
      let result;
      if (Platform.OS === 'android') {
        const uri = await takePhotoAsync();
        if (uri) {
           result = { canceled: false, assets: [{ uri }] };
        } else {
           result = { canceled: true };
        }
      } else {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.7,
        });
      }

      console.log('[Camera] picker returned', {
        canceled: result.canceled,
        assets: result.assets?.length ?? 0,
      });

      if (!result.canceled) {
        await processPickedImages(result);
      }
    } catch (error) {
      console.error('[Camera] exception', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      });
    }
  };

  const launchImageLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 0.7,
      });

      if (!result.canceled) {
        await processPickedImages(result);
      }
    } catch (error) {
      console.error('[Gallery] launch failed:', error);
    }
  };


  const pickDocument = async () => {
    try {
      const result =
        await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
          multiple: true,
        });

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      const added = [];

      for (const asset of result.assets) {
        if (
          asset.size &&
          asset.size > MAX_FILE_SIZE
        ) {
          setConfirmConfig({
            isVisible: true,
            title: t('File Too Large'),
            message:
              `${asset.name} ` +
              t('is larger than 5MB limit.'),
            hideCancel: true,
            confirmText: t('OK'),
            onConfirm: () =>
              setConfirmConfig(prev => ({
                ...prev,
                isVisible: false,
              })),
          });

          continue;
        }

        const savedUri =
          await saveFileToDocuments(
            asset.uri,
            asset.name
          );

        added.push({
          id:
            Date.now().toString() +
            Math.random().toString(36),
          type: 'document',
          uri: savedUri,
          name:
            asset.name ||
            `document-${Date.now()}`,
          size: asset.size || 0,
          mimeType:
            asset.mimeType ||
            'application/octet-stream',
        });
      }

      if (added.length) {
        setAttachments(prev => [
          ...prev,
          ...added,
        ]);
      }
    } catch (error) {
      console.error(
        'Error picking document:',
        error
      );
    }
  };

  const openDocument = async (uri, mimeType) => {
    try {
      if (Platform.OS === 'android') {
        await nativeOpenDocumentAsync(uri, mimeType);
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri);
        } else {
          Alert.alert(t('Error'), t('Sharing is not available on this device'));
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert(t('Error'), t('Could not open document.'));
    }
  };


  const removeAttachment = (id) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  const addSubtask = () => {
    const newSubtasks = [...subtasks, { id: Date.now().toString(), text: '', completed: false }];
    setSubtasks(newSubtasks);
  };

  const updateSubtask = (id, text) => {
    const newSubtasks = subtasks.map(s => s.id === id ? { ...s, text } : s);
    setSubtasks(newSubtasks);
  };

  const toggleSubtask = (id) => {
    const newSubtasks = subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s);
    setSubtasks(newSubtasks);
  };

  const removeSubtask = (id) => {
    const newSubtasks = subtasks.filter(s => s.id !== id);
    setSubtasks(newSubtasks);
  };

  const handlePrioritySelect = (level) => {
    setPriority(level.toLowerCase());
  };

  const handleDateSelect = (dateStr) => {
    if (datePickerType === 'due') {
      setSelectedDate(dateStr);
    } else if (datePickerType === 'repeatStart') {
      setRepeatStartDate(dateStr);
    } else if (datePickerType === 'repeatEnd') {
      setRepeatEndDate(dateStr);
    }
    setShowDatePicker(false);
  };

  const handleDelete = () => {
    const isRecurring = !!(task.recurringSeriesId || (task.isRecurring && task.recurringSeriesId));
    if (isRecurring) {
      setConfirmConfig({
        isVisible: true,
        title: t('Delete Recurring Task'),
        message: t('Do you want to delete only this task or all upcoming tasks in this series?'),
        confirmText: t('This task only'),
        isDestructive: true,
        onConfirm: () => {
          dispatch(deleteTask({ taskId: task.id }));
          setConfirmConfig(prev => ({ ...prev, isVisible: false }));
          onClose();
        },
        secondaryConfirmText: t('All upcoming tasks'),
        onSecondaryConfirm: () => {
          dispatch(deleteTask({ taskId: task.id }));
          dispatch(deleteRecurringSeries({ seriesId: task.recurringSeriesId, fromDate: task.completionDate }));
          setConfirmConfig(prev => ({ ...prev, isVisible: false }));
          onClose();
        }
      });
    } else {
      setConfirmConfig({
        isVisible: true,
        title: t('Delete Task'),
        message: t('Are you sure you want to delete this task?'),
        confirmText: t('Delete'),
        isDestructive: true,
        onConfirm: () => {
          dispatch(deleteTask({ taskId: task.id }));
          setConfirmConfig(prev => ({ ...prev, isVisible: false }));
          onClose();
        }
      });
    }
  };

  const toggleComplete = () => {
    const newCompletedState = !task.completed;
    handleUpdate({ completed: newCompletedState });
    if (newCompletedState) {
      onClose();
    }
  };

  return (
    <Modal 
      testID="task_details_modal"
      isVisible={isVisible} 
      onSwipeComplete={handleClose}
      swipeDirection={scrollOffset > 0 ? undefined : ['down']}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      propagateSwipe={true}
      scrollTo={(p) => scrollViewRef.current?.scrollTo(p)}
      scrollOffset={scrollOffset}
      scrollOffsetMax={Math.max(0, scrollContentHeight - scrollViewHeight)}
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: colors.textSecondary }]} />
          </View>
          
          <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', justifyContent: 'flex-end' }]}>
            
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity 
                accessible={true} accessibilityRole="button" accessibilityLabel="Share task"
                onPress={handleShare} style={styles.headerBtn}
              >
                <IconShare color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                testID="task_details_close_btn" 
                accessible={true} accessibilityRole="button" accessibilityLabel="Close task details"
                onPress={handleClose} style={styles.headerBtn}
              >
                <IconClose color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            ref={scrollViewRef}
            onScroll={(e) => setScrollOffset(e.nativeEvent.contentOffset.y)}
            onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
            onContentSizeChange={(_, h) => setScrollContentHeight(h)}
            scrollEventThrottle={16}
            style={styles.body} 
            contentContainerStyle={styles.bodyContent} 
            keyboardShouldPersistTaps="handled"
          >
            
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}>{t('TASK NAME')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <TouchableOpacity 
                accessible={true} accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} accessibilityLabel="Toggle task completion"
                onPress={toggleComplete} style={{ marginTop: 12 }}
              >
                {task.completed ? <IconCheckCircle color={colors.primary} /> : <IconCircle color={colors.textSecondary} />}
              </TouchableOpacity>
              
              <TextInput
                testID="task_details_name_input"
                accessible={true} accessibilityLabel="Task Name"
                style={[styles.input, { flex: 1, color: colors.textPrimary, borderColor: colors.borderColor, backgroundColor: surfaceLighter, minHeight: 46 }]}
                value={taskName}
                onChangeText={setTaskName}
                onBlur={handleNameBlur}
                placeholder={t("What needs to be done?")}
                placeholderTextColor={colors.textSecondary}
                multiline={true}
                scrollEnabled={false}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.twoColumnRow}>
              <View style={styles.column}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('DUE DATE')}</Text>
                <TouchableOpacity 
                  accessible={true} accessibilityRole="button" accessibilityLabel={`Due date, ${selectedDate ? dayjs(selectedDate).format('MM/DD/YYYY') : 'Not set'}`}
                  style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}
                  onPress={() => { setDatePickerType('due'); setShowDatePicker(true); }}
                >
                  <IconCalendar color={colors.textPrimary} />
                  <Text style={[styles.dateText, { color: colors.textPrimary }]} numberOfLines={1}>
                    {selectedDate ? dayjs(selectedDate).format('MM/DD/YYYY') : t('Select')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.column}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>{t('TIME')}</Text>
                </View>
                <TouchableOpacity 
                  accessible={true} accessibilityRole="button" accessibilityLabel={`Time, ${formatDisplayTime(selectedTime)}`}
                  style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <IconClock color={colors.textPrimary} />
                  <Text style={[styles.dateText, { color: colors.textPrimary }]} numberOfLines={1}>
                    {formatDisplayTime(selectedTime)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.threeColumnRow}>
              <View style={styles.column}>
                <CustomDropdown label={t("PRIORITY")} value={priority.charAt(0).toUpperCase() + priority.slice(1)} options={[{label: t('None'), value: 'None'}, {label: t('Low'), value: 'Low'}, {label: t('Medium'), value: 'Medium'}, {label: t('High'), value: 'High'}]} onSelect={handlePrioritySelect} colors={colors} customBtnStyle={{ height: 46, borderRadius: 8 }} />
              </View>
              <View style={styles.column}>
                <CustomDropdown label={t("REMINDER")} value={reminder} options={[{label: t('None'), value: 'None'}, {label: t('15 min before'), value: '15 min before'}, {label: t('30 min before'), value: '30 min before'}, {label: t('1 hr before'), value: '1 hr before'}, {label: t('1 day before'), value: '1 day before'}, {label: t('Day of'), value: 'Day of'}]} onSelect={setReminder} colors={colors} customBtnStyle={{ height: 46, borderRadius: 8 }} />
              </View>
              {isPremium && (
                <View style={styles.column}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>{t('REPEAT')}</Text>
                  <TouchableOpacity 
                    style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter, height: 46, borderRadius: 8 }]}
                    onPress={() => setIsRepeatModalVisible(true)}
                  >
                    <Text style={{ color: colors.textPrimary }}>
                      {repeatConfig.preset === 'custom' ? t('Custom...') : 
                       repeatConfig.preset === 'None' ? t('None') : 
                       repeatConfig.preset.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {isPremium && reminder !== 'None' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 15 }}>
                <Switch value={isAlarm} onValueChange={setIsAlarm} trackColor={{ true: colors.primary }} />
                <Text style={{ color: colors.textPrimary, marginLeft: 8, fontWeight: 'bold' }}>{t('Play Reminder as Alarm')}</Text>
              </View>
            )}

            {repeatConfig.preset !== 'None' && (
              <View style={[styles.repeatConfigBox, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}>
                <Text style={[styles.repeatConfigTitle, { color: colors.textSecondary }]}>{t('REPEAT CONFIGURATION')}</Text>
                <View style={styles.twoColumnRow}>
                  <View style={styles.column}>
                    <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>{t('FROM')}</Text>
                    <TouchableOpacity 
                      style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}
                      onPress={() => { setDatePickerType('repeatStart'); setShowDatePicker(true); }}
                    >
                      <IconCalendar color={colors.textPrimary} />
                      <Text style={[styles.dateText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {repeatStartDate || selectedDate ? dayjs(repeatStartDate || selectedDate).format('MM/DD/YYYY') : t('Select')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.column}>
                    <Text style={[styles.label, { color: colors.textSecondary, marginTop: 10 }]}>{t('TO')}</Text>
                    <TouchableOpacity 
                      style={[styles.dateBtn, { borderColor: colors.borderColor, backgroundColor: surfaceLighter }]}
                      onPress={() => { setDatePickerType('repeatEnd'); setShowDatePicker(true); }}
                    >
                      <IconCalendar color={colors.textPrimary} />
                      <Text style={[styles.dateText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {repeatEndDate ? dayjs(repeatEndDate).format('MM/DD/YYYY') : t('Select')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {showTimePicker && (
              <CustomTimePicker
                visible={showTimePicker}
                value={selectedTime}
                colors={colors}
                isDark={isDark}
                onClose={() => setShowTimePicker(false)}
                onSave={(newTime) => {
                  setSelectedTime(newTime);
                  handleUpdate({
                    time: newTime,
                    hasUserSelectedTime: true,
                  });
                  setShowTimePicker(false);
                }}
              />
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0, marginBottom: 0 }]}>{t('NOTES & ATTACHMENTS')}</Text>
              {isPremium && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                  <TouchableOpacity 
                    accessible={true} accessibilityRole="button" accessibilityLabel="Add Photo"
                    onPress={handleAttachPhoto} hitSlop={{top:10,bottom:10,left:10,right:10}} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                  >
                    <IconCamera color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    accessible={true} accessibilityRole="button" accessibilityLabel="Add Document"
                    onPress={handleAttachDocument} hitSlop={{top:10,bottom:10,left:10,right:10}} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                  >
                    <IconAttachment color={colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View style={[styles.descContainer, { borderColor: colors.borderColor, backgroundColor: surfaceLighter, padding: 0, minHeight: 100 }]}>
              <MemoizedNotesInput
                ref={notesRef}
                initialValue={notes}
                placeholder={t("Add extra details or notes...")}
                placeholderTextColor={colors.textSecondary}
                style={{ flex: 1, padding: 15, color: colors.textPrimary, fontSize: 15 }}
              />
              
              {attachments.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentsScroll}>
                  {attachments.map(att => (
                    <View key={att.id} style={styles.attachmentItem}>
                      {att.type === 'image' ? (
                        <TouchableOpacity onPress={() => setSelectedFullscreenImage(att.uri)} activeOpacity={0.8}>
                          <Image source={{ uri: att.uri }} style={styles.attachmentThumb} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => openDocument(att.uri, att.mimeType)} activeOpacity={0.8}>
                          <View style={[styles.attachmentThumb, { backgroundColor: colors.bgMain, justifyContent: 'center', alignItems: 'center', borderColor: colors.borderColor, borderWidth: 1 }]}>
                            <IconFile color={colors.primary} />
                            <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4, textAlign: 'center', paddingHorizontal: 2 }} numberOfLines={1}>{att.name}</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity 
                        style={styles.attachmentRemoveBtn} 
                        onPress={() => removeAttachment(att.id)}
                      >
                        <IconClose color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 10 }}>
              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0, marginBottom: 0 }]}>{t('SUBTASKS')}</Text>
              <TouchableOpacity 
                accessible={true} accessibilityRole="button" accessibilityLabel="Add new subtask"
                onPress={addSubtask} hitSlop={{top:10,bottom:10,left:10,right:10}}
              >
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('+ Add Subtask')}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={{ gap: 8 }}>
              {subtasks.map((subtask) => (
                <View key={subtask.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <TouchableOpacity 
                    accessible={true} accessibilityRole="checkbox" accessibilityState={{ checked: subtask.completed }} accessibilityLabel="Toggle subtask completion"
                    onPress={() => toggleSubtask(subtask.id)} style={{ marginTop: 2 }}
                  >
                    {subtask.completed ? <IconCheckCircle color={colors.primary} /> : <IconCircle color={colors.textSecondary} />}
                  </TouchableOpacity>
                  <TextInput
                    accessible={true} accessibilityLabel="Subtask text"
                    style={[{ flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 2 }, subtask.completed && { textDecorationLine: 'line-through', opacity: 0.5 }]}
                    value={subtask.text}
                    onChangeText={(text) => updateSubtask(subtask.id, text)}
                    placeholder={t("Subtask...")}
                    placeholderTextColor={colors.textSecondary}
                    blurOnSubmit={true}
                    multiline={true}
                  />
                  <TouchableOpacity 
                    accessible={true} accessibilityRole="button" accessibilityLabel="Delete subtask"
                    onPress={() => removeSubtask(subtask.id)} style={{ padding: 4 }}
                  >
                    <IconClose color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 30 }}>
              <TouchableOpacity 
                testID="task_details_delete_btn_bottom"
                accessible={true} accessibilityRole="button" accessibilityLabel="Delete task"
                onPress={handleDelete} 
                style={{ flex: 1, padding: 15, backgroundColor: 'rgba(244, 67, 54, 0.1)', borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#f44336', fontWeight: 'bold', fontSize: 16 }}>{t('Delete')}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                testID="task_details_save_btn_bottom"
                onPress={handleSave} 
                style={{ flex: 1, padding: 15, backgroundColor: colors.primary, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: colors.textInverse, fontWeight: 'bold', fontSize: 16 }}>{t('Save Changes')}</Text>
              </TouchableOpacity>
            </View>
            
          </ScrollView>

        </View>

        <ConfirmModal
          isVisible={confirmConfig.isVisible}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmText={confirmConfig.confirmText}
          cancelText={confirmConfig.cancelText || t('Cancel')}
          hideCancel={confirmConfig.hideCancel}
          isDestructive={confirmConfig.isDestructive}
          secondaryConfirmText={confirmConfig.secondaryConfirmText}
          onSecondaryConfirm={confirmConfig.onSecondaryConfirm}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isVisible: false }))}
          onConfirm={confirmConfig.onConfirm}
        />


        <RNModal visible={showDatePicker} transparent animationType="fade">
          <View style={styles.calendarOverlay}>
            <View style={[styles.calendarContainer, { backgroundColor: colors.bgCard }]}>
              <Calendar
                key={i18n.language}
                firstDay={i18n.language === 'en' ? 0 : 1}
                current={
                  datePickerType === 'due' 
                    ? (selectedDate || dayjs().format('YYYY-MM-DD'))
                    : datePickerType === 'repeatStart'
                    ? (repeatStartDate || selectedDate || dayjs().format('YYYY-MM-DD'))
                    : (repeatEndDate || repeatStartDate || selectedDate || dayjs().format('YYYY-MM-DD'))
                }
                onDayPress={(day) => handleDateSelect(day.dateString)}
                markedDates={
                  datePickerType === 'due' 
                    ? (selectedDate ? { [selectedDate]: { selected: true, selectedColor: colors.primary, selectedTextColor: colors.textInverse } } : {})
                    : datePickerType === 'repeatStart'
                    ? (repeatStartDate ? { [repeatStartDate]: { selected: true, selectedColor: colors.primary, selectedTextColor: colors.textInverse } } : {})
                    : (repeatEndDate ? { [repeatEndDate]: { selected: true, selectedColor: colors.primary, selectedTextColor: colors.textInverse } } : {})
                }
                theme={{
                  backgroundColor: colors.bgCard,
                  calendarBackground: colors.bgCard,
                  textSectionTitleColor: colors.textSecondary,
                  selectedDayBackgroundColor: colors.primary,
                  selectedDayTextColor: colors.textInverse,
                  todayTextColor: colors.primary,
                  dayTextColor: colors.textPrimary,
                  textDisabledColor: colors.surfaceContainerHigh,
                  dotColor: colors.primary,
                  selectedDotColor: colors.textInverse,
                  arrowColor: colors.textPrimary,
                  monthTextColor: colors.textPrimary,
                  indicatorColor: colors.primary,
                  textDayFontWeight: '500',
                  textMonthFontWeight: 'bold',
                  textDayHeaderFontWeight: '500',
                  textDayFontSize: 14,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 12,
                  'stylesheet.calendar.header': {
                    header: {
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingLeft: 10,
                      paddingRight: 10,
                      marginTop: 6,
                      alignItems: 'center'
                    }
                  }
                }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15, paddingRight: 10 }}>
                <TouchableOpacity 
                  style={{ padding: 10, paddingHorizontal: 20 }} 
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('Cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>

        <RNModal visible={!!selectedFullscreenImage} transparent={true} animationType="fade" onRequestClose={() => setSelectedFullscreenImage(null)}>
          <View style={styles.fullscreenImageOverlay}>
            <View style={styles.fullscreenImageContainer}>
              <TouchableOpacity style={styles.fullscreenImageClose} onPress={() => setSelectedFullscreenImage(null)}>
                <IconClose color="#fff" />
              </TouchableOpacity>
              {selectedFullscreenImage && (
                <Image 
                  source={{ uri: selectedFullscreenImage }} 
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </View>
        </RNModal>
      <CustomRepeatModal
        isVisible={isRepeatModalVisible}
        onClose={() => setIsRepeatModalVisible(false)}
        initialConfig={repeatConfig}
        onSave={setRepeatConfig}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '92%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    paddingTop: 10,
  },
  dragHandleContainer: {
    paddingBottom: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerBtn: {
    padding: 8,
    marginLeft: 8,
  },
  body: {
    flexGrow: 1,
  },
  bodyContent: {
    padding: 20,
    flexGrow: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 20,
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  descContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  toolBtn: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolIcon: {
    fontSize: 16,
  },
  separator: {
    width: 1,
    height: 20,
    marginHorizontal: 10,
  },
  inputArea: {
    padding: 15,
    fontSize: 15,
    height: 150,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  dateText: {
    fontSize: 15,
  },

  twoColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 15,
  },
  threeColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  column: {
    flex: 1,
    minWidth: '28%',
  },
  timeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46, // Match typical dateBtn height
  },
  timeIconBtn: {
    paddingRight: 10,
    paddingVertical: 10,
  },
  timeInput: {
    flex: 1,
    fontSize: 15,
  },
  repeatConfigBox: {
    marginTop: 20,
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
  },
  repeatConfigTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  closeCalBtn: {
    marginTop: 10,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    width: 320,
    borderRadius: 24,
    padding: 16,
    overflow: 'hidden',
  },
  imagePreviewContainer: {
    padding: 10,
    alignItems: 'center',
  },
  attachmentsScroll: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)'
  },
  attachmentItem: {
    marginRight: 15,
    position: 'relative'
  },
  attachmentThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    resizeMode: 'cover'
  },
  attachmentRemoveBtn: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#f44336',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff'
  },
  fullscreenImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImageClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  }
});
