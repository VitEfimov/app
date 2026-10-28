import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal as RNModal, ScrollView, Platform, Share, Image, KeyboardAvoidingView, Keyboard, Alert, Switch, AppState, Linking, useWindowDimensions } from 'react-native';
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
import { useTheme, hexToRgba } from '../styles/ThemeContext';
import dayjs from 'dayjs';
import * as Localization from 'expo-localization';
import Svg, { Path, Circle, Rect, Polyline } from 'react-native-svg';
import { Calendar } from 'react-native-calendars';
import { scheduleTaskReminder, cancelNotification } from '../utils/notifications';
import { useTaskRepeat } from '../custom-hooks/useTaskRepeat';
import { takePhotoAsync, shareTaskAsync, openDocumentAsync as nativeOpenDocumentAsync } from '../../modules/expo-task-alarm';
import CustomDropdown from './CustomDropdown';
import CustomRepeatModal from './CustomRepeatModal';
import CustomReminderModal from './CustomReminderModal';
import YearPickerModal from './YearPickerModal';
import ConfirmModal from './ConfirmModal';
import PremiumModal from './PremiumModal';
import { toggleTaskOptionsCollapsed, setTaskOptionsCollapsed } from '../features/userSlice';
import { useTranslation } from 'react-i18next';
import { getBoardColor } from '../utils/boardColors';

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
      style={[{ outlineStyle: 'none', outlineWidth: 0, borderWidth: 0, backgroundColor: 'transparent' }, style]}
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

const IconClose = ({ color, size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

const IconCircle = ({ color, size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
  </Svg>
);

const IconCheckCircle = ({ color, size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

const IconTune = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  </Svg>
);

const IconFlag = ({ color }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
  </Svg>
);

const IconCheck = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

const IconTrash = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
  </Svg>
);

const IconPlus = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);

const IconChevronDown = ({ color, isCollapsed }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: isCollapsed ? '0deg' : '180deg' }] }}>
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

export default function TaskDetailsModal({ task, isVisible, onClose }) {
  const { colors, isDark } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isCompact = windowHeight < 820;
  const isVeryCompact = windowHeight < 700;
  const isWideScreen = windowWidth >= 768;
  const dispatch = useDispatch();
  const themeState = useSelector(state => state.themeReducer);
  const boards = useSelector(state => state.userReducer.boards || []);
  const isPremium = useSelector(state => state.entitlementReducer?.isPremium);
  const isTaskOptionsCollapsed = useSelector(state => state.userReducer?.isTaskOptionsCollapsed !== undefined ? state.userReducer.isTaskOptionsCollapsed : true);
  const scrollViewRef = useRef(null);
  const notesRef = useRef(null);
  const initialSnapshotRef = useRef(null);
  const { t, i18n } = useTranslation();
  const [scrollOffset, setScrollOffset] = useState(0);

  const [taskName, setTaskName] = useState('');
  const [nameInputHeight, setNameInputHeight] = useState(48);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [subtasks, setSubtasks] = useState(task ? (task.subtasks || []) : []);
  const [priority, setPriority] = useState('none');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState('due');
  const [isYearPickerVisible, setYearPickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reminder, setReminder] = useState('None');
  const [isCustomReminderModalVisible, setIsCustomReminderModalVisible] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState('main');
  const [isAlarm, setIsAlarm] = useState(false);
  const [keepNotificationAllDay, setKeepNotificationAllDay] = useState(false);
  const [repeatConfig, setRepeatConfig] = useState({ preset: 'None' });
  const [isRepeatModalVisible, setIsRepeatModalVisible] = useState(false);
  const [repeatStartDate, setRepeatStartDate] = useState('');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [confirmConfig, setConfirmConfig] = useState({ isVisible: false, title: '', message: '', onConfirm: null, confirmText: 'Confirm', isDestructive: false, secondaryIsDestructive: false, secondaryConfirmText: null, onSecondaryConfirm: null, hideCancel: false, cancelText: '' });
  const { generateRepeatingTasks } = useTaskRepeat();

  const [isPremiumModalVisible, setPremiumModalVisible] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');
  const [selectedFullscreenImage, setSelectedFullscreenImage] = useState(null);
  const [isAttachmentOptionsVisible, setAttachmentOptionsVisible] = useState(false);

  const cardBg = colors.cardBg || (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)');
  const cardBorder = colors.cardBorder || colors.outlineVariant || colors.borderColor;
  const cardBgNested = colors.surfaceContainerHigh || (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)');

  const priorityBadgeStyle = useMemo(() => {
    switch (priority) {
      case 'high':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(220, 38, 38, 0.12)',
          text: isDark ? '#f87171' : (colors.danger || '#dc2626'),
        };
      case 'medium':
        return {
          bg: isDark ? 'rgba(251, 146, 60, 0.18)' : 'rgba(234, 88, 12, 0.12)',
          text: isDark ? '#fb923c' : '#ea580c',
        };
      case 'low':
        return {
          bg: isDark ? 'rgba(74, 222, 128, 0.18)' : 'rgba(22, 163, 74, 0.12)',
          text: isDark ? '#4ade80' : '#16a34a',
        };
      default:
        return {
          bg: colors.surfaceContainerHigh || (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
          text: colors.textSecondary,
        };
    }
  }, [priority, isDark, colors]);

  const selectedBoardName = useMemo(() => {
    const found = boards.find(b => b.id === selectedBoardId);
    if (!found) return 'Main';
    return found.name === 'Main' ? t('Main') : found.name;
  }, [boards, selectedBoardId, t]);

  const getValidDateString = (dateVal) => {
    if (!dateVal) return dayjs().format('YYYY-MM-DD');
    const d = dayjs(dateVal);
    if (!d.isValid() || d.year() < 2000 || d.year() > 2100) return dayjs().format('YYYY-MM-DD');
    return d.format('YYYY-MM-DD');
  };

  const getCalendarMarkedDates = () => {
    const rawActiveDate = datePickerType === 'due' 
      ? selectedDate 
      : datePickerType === 'repeatStart' 
      ? repeatStartDate 
      : repeatEndDate;

    const activeDate = rawActiveDate ? getValidDateString(rawActiveDate) : null;
    const todayStr = dayjs().format('YYYY-MM-DD');
    const marks = {};

    if (activeDate) {
      const isToday = activeDate === todayStr;
      marks[activeDate] = {
        customStyles: {
          container: {
            backgroundColor: colors.primary,
            borderRadius: 18,
            borderWidth: isToday ? 2 : 0,
            borderColor: isToday ? (colors.textInverse || '#ffffff') : 'transparent',
          },
          text: {
            color: colors.textInverse || '#ffffff',
            fontWeight: '900',
            fontSize: 15,
          }
        }
      };
    }

    if (!marks[todayStr]) {
      marks[todayStr] = {
        customStyles: {
          container: {
            borderWidth: 2,
            borderColor: colors.primary,
            borderRadius: 18,
            backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
          },
          text: {
            color: colors.primary,
            fontWeight: '900',
            fontSize: 15,
          }
        }
      };
    }

    return marks;
  };

  const stripHtml = (html) => html ? html.replace(/<[^>]+>/g, '').trim() : '';

  useEffect(() => {
    if (isVisible && task) {
      const initialTaskName = task.taskname || task.name || '';
      const initialNotesText = stripHtml(task.description?.text) || '';
      
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
      const initialSubtasks = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];
      const initialPriority = (task.priority || 'none').toLowerCase();
      const initialBoardId = task.boardId || 'main';
      const initialDate = task.completionDate || '';
      const initialTimeVal = task.time || null;

      let config = task.repeatConfig || { preset: task.repeatFrequency || (task.repeat === 'yearly' ? 'every_year' : 'None') };
      if (typeof config === 'string') {
        try { config = JSON.parse(config); } catch (e) { config = { preset: 'None' }; }
      }
      if ((!config || !config.preset || config.preset === 'None') && (task.repeat === 'yearly' || task.repeatFrequency === 'Every year')) {
        config = { preset: 'every_year' };
      }

      // Repeat start date should ALWAYS be in sync with the task's completion date (due date)
      const initialRepStartDate = initialDate || task.repeatStartDate || '';
      let initialRepEndDate = task.repeatEndDate || '';
      if (config && config.preset && config.preset !== 'None' && !initialRepEndDate && initialRepStartDate) {
        initialRepEndDate = dayjs(initialRepStartDate).add(1, 'year').format('YYYY-MM-DD');
      }

      let initialReminderVal = task.reminder || 'None';
      if (task.isNagMode) {
        initialReminderVal = 'Nag Mode (Every 10 min)';
      } else if (task.escalationLevel === 'active') {
        initialReminderVal = 'Escalating Reminder';
      }
      const initialAlarmVal = task.isAlarm || false;
      const initialKeepNotificationVal = task.keepNotificationAllDay || false;

      setTaskName(initialTaskName);
      setNameInputHeight(48);
      setNotes(initialNotesText);
      setAttachments(existingAttachments);
      setSubtasks(initialSubtasks);
      setPriority(initialPriority);
      setSelectedBoardId(initialBoardId);
      setSelectedDate(initialDate);
      setSelectedTime(initialTimeVal);
      setRepeatConfig(config);
      setRepeatStartDate(initialRepStartDate);
      setRepeatEndDate(initialRepEndDate);
      setReminder(initialReminderVal);
      setIsAlarm(initialAlarmVal);
      setKeepNotificationAllDay(initialKeepNotificationVal);
      dispatch(setTaskOptionsCollapsed(true));

      initialSnapshotRef.current = {
        taskName: initialTaskName,
        notes: initialNotesText,
        attachmentsJson: JSON.stringify(existingAttachments),
        subtasksJson: JSON.stringify(initialSubtasks),
        priority: initialPriority,
        boardId: initialBoardId,
        date: initialDate,
        time: initialTimeVal,
        repeatConfigJson: JSON.stringify(config),
        repeatStartDate: initialRepStartDate,
        repeatEndDate: initialRepEndDate,
        reminder: initialReminderVal,
        isAlarm: initialAlarmVal,
        keepNotificationAllDay: initialKeepNotificationVal,
      };
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
    if (!task || !initialSnapshotRef.current) return false;
    const currentNotes = notesRef.current ? notesRef.current.getText() : notes;
    const snap = initialSnapshotRef.current;

    if (taskName !== snap.taskName) return true;
    if ((currentNotes || '').trim() !== (snap.notes || '').trim()) return true;
    if (JSON.stringify(attachments) !== snap.attachmentsJson) return true;
    if (JSON.stringify(subtasks) !== snap.subtasksJson) return true;
    if (priority !== snap.priority) return true;
    if (selectedBoardId !== snap.boardId) return true;
    if (selectedDate !== snap.date) return true;
    if ((selectedTime || null) !== (snap.time || null)) return true;
    if (JSON.stringify(repeatConfig) !== snap.repeatConfigJson) return true;
    if (repeatStartDate !== snap.repeatStartDate) return true;
    if (repeatEndDate !== snap.repeatEndDate) return true;
    if (reminder !== snap.reminder) return true;
    if (isAlarm !== snap.isAlarm) return true;
    if (keepNotificationAllDay !== snap.keepNotificationAllDay) return true;

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
    if (selectedBoardId !== (task.boardId || 'main')) updates.boardId = selectedBoardId;
    
    const effectiveStartDate = selectedDate || repeatStartDate || dayjs().format('YYYY-MM-DD');
    const effectiveEndDate = repeatEndDate || dayjs(effectiveStartDate).add(1, 'year').format('YYYY-MM-DD');

    const initialConfig = task.repeatConfig || { preset: task.repeatFrequency || 'None' };
    const repeatConfigChanged = JSON.stringify(repeatConfig) !== JSON.stringify(initialConfig);
    const dateChanged = selectedDate !== (task.completionDate || '');
    const repeatStartDateChanged = repeatStartDate !== (task.repeatStartDate || task.completionDate || '');
    const repeatEndDateChanged = repeatEndDate !== (task.repeatEndDate || '');

    if (repeatConfigChanged) {
      updates.repeatConfig = repeatConfig;
      updates.repeatFrequency = repeatConfig.preset; // backwards compatibility
    }
    
    if (repeatStartDateChanged || effectiveStartDate !== (task.repeatStartDate || '')) updates.repeatStartDate = effectiveStartDate;
    if (repeatEndDateChanged || effectiveEndDate !== (task.repeatEndDate || '')) updates.repeatEndDate = effectiveEndDate;
    
    const timeChanged = selectedTime !== (task.time || '');
    const reminderChanged = reminder !== (task.reminder || 'None');
    const isAlarmChanged = isAlarm !== (task.isAlarm || false);
    const keepNotificationAllDayChanged = keepNotificationAllDay !== (task.keepNotificationAllDay || false);
    const nameChanged = taskName !== task.taskname;

    if (isAlarmChanged) updates.isAlarm = isAlarm;
    if (keepNotificationAllDayChanged) updates.keepNotificationAllDay = keepNotificationAllDay;

    if (timeChanged || dateChanged || reminderChanged || isAlarmChanged || keepNotificationAllDayChanged || nameChanged) {
      updates.reminder = reminder;
      updates.isNagMode = reminder === 'Nag Mode (Every 10 min)';
      updates.escalationLevel = reminder === 'Escalating Reminder' ? 'active' : 'none';
      updates.keepNotificationAllDay = keepNotificationAllDay;
      // Schedule new notifications
      if (task.notificationId) {
        await cancelNotification(task.notificationId, task.id);
        updates.notificationId = null;
      }
      const notifIds = await scheduleTaskReminder(
        taskName,
        reminder,
        selectedDate || dayjs().format('YYYY-MM-DD'),
        selectedTime,
        task.id,
        isAlarm,
        themeState,
        {
          isNagMode: updates.isNagMode,
          escalationLevel: updates.escalationLevel,
          keepNotificationAllDay: keepNotificationAllDay
        }
      );
      if (notifIds && notifIds.length > 0) updates.notificationId = notifIds;
    }
    
    if (JSON.stringify(subtasks) !== JSON.stringify(task.subtasks || [])) {
      updates.subtasks = subtasks;
    }
    
    // If repeat is newly configured or task does not have a recurring series yet
    if (repeatConfig.preset !== 'None' && effectiveEndDate && !task.recurringSeriesId) {
      const result = generateRepeatingTasks(
        task, 
        { 
          name: taskName, 
          priority, 
          date: selectedDate,
          completionDate: selectedDate,
          time: selectedTime, 
          reminder, 
          isAlarm, 
          keepNotificationAllDay,
          attachments, 
          subtasks, 
          description: { text: currentNotes, img: attachments.length > 0 && attachments[0].type === 'image' ? attachments[0].uri : '', url: '', attachments }
        }, 
        { ...repeatConfig, startDate: effectiveStartDate, endDate: effectiveEndDate }
      );
      if (result && result.seriesId) {
        updates.recurringSeriesId = result.seriesId;
        updates.isRecurring = true;
        updates.repeatStartDate = effectiveStartDate;
        updates.repeatEndDate = effectiveEndDate;
      }
    } else if (task.recurringSeriesId && updateSeries) {
      // If user chose to update all upcoming tasks in this series:
      if (repeatConfig.preset === 'None') {
        // Stop repeat: delete future instances
        dispatch(deleteRecurringSeries({ seriesId: task.recurringSeriesId, fromDate: task.completionDate, excludeTaskId: task.id }));
        updates.recurringSeriesId = null;
        updates.isRecurring = false;
        updates.repeatConfig = { preset: 'None' };
        updates.repeatFrequency = 'None';
        updates.repeatStartDate = '';
        updates.repeatEndDate = '';
      } else if (repeatConfigChanged || dateChanged || repeatStartDateChanged || repeatEndDateChanged) {
        // Schedule changed: delete upcoming instances and regenerate
        const oldDate = task.completionDate ? dayjs(task.completionDate) : dayjs(effectiveStartDate);
        const newDate = dayjs(effectiveStartDate);
        const earliestDate = oldDate.isBefore(newDate) ? oldDate : newDate;

        dispatch(deleteRecurringSeries({
          seriesId: task.recurringSeriesId,
          fromDate: earliestDate.toISOString(),
          excludeTaskId: task.id
        }));

        generateRepeatingTasks(
          task, 
          { 
            name: taskName, 
            priority, 
            date: selectedDate,
            completionDate: selectedDate,
            time: selectedTime, 
            reminder, 
            isAlarm, 
            keepNotificationAllDay,
            attachments, 
            subtasks, 
            description: { text: currentNotes, img: attachments.length > 0 && attachments[0].type === 'image' ? attachments[0].uri : '', url: '', attachments }
          }, 
          { ...repeatConfig, startDate: effectiveStartDate, endDate: effectiveEndDate }
        );

        updates.repeatConfig = repeatConfig;
        updates.repeatFrequency = repeatConfig.preset;
        updates.repeatStartDate = effectiveStartDate;
        updates.repeatEndDate = effectiveEndDate;
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
            keepNotificationAllDay: keepNotificationAllDay,
            description: {
              text: currentNotes,
              img: attachments.length > 0 && attachments[0].type === 'image' ? attachments[0].uri : '',
              url: '',
              attachments: attachments
            },
            subtasks: subtasks,
            repeatConfig: repeatConfig,
            repeatFrequency: repeatConfig.preset,
            repeatStartDate: effectiveStartDate,
            repeatEndDate: effectiveEndDate
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

  const handleReminderSelect = (selectedVal) => {
    if (selectedVal === 'custom') {
      setIsCustomReminderModalVisible(true);
      return;
    }
    setReminder(selectedVal);
    let updates = { 
      reminder: selectedVal, 
      isNagMode: selectedVal === 'Nag Mode (Every 10 min)', 
      escalationLevel: selectedVal === 'Escalating Reminder' ? 'active' : 'none' 
    };
    handleUpdate(updates);
  };

  const handleCustomReminderSave = (customReminderStr) => {
    setReminder(customReminderStr);
    let updates = {
      reminder: customReminderStr,
      isNagMode: false,
      escalationLevel: 'none'
    };
    handleUpdate(updates);
  };

  const handleNameBlur = () => {
    // Removed auto-save
  };

  const handleNotesBlur = () => {
    // Removed auto-save
  };

  const saveFileToDocuments = async (uri, name) => {
    if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
      return uri;
    }
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

  const handleOpenAttachmentOptions = () => {
    setAttachmentOptionsVisible(true);
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
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.open(uri, '_blank');
        }
        return;
      }
      if (Platform.OS === 'android') {
        await nativeOpenDocumentAsync(uri, mimeType);
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri);
        } else {
          setConfirmConfig({
            isVisible: true,
            title: t('Error'),
            message: t('Sharing is not available on this device'),
            confirmText: t('OK'),
            hideCancel: true,
            onConfirm: () => setConfirmConfig(prev => ({ ...prev, isVisible: false }))
          });
        }
      }
    } catch (e) {
      console.error(e);
      setConfirmConfig({
        isVisible: true,
        title: t('Error'),
        message: t('Could not open document.'),
        confirmText: t('OK'),
        hideCancel: true,
        onConfirm: () => setConfirmConfig(prev => ({ ...prev, isVisible: false }))
      });
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
      if (!repeatStartDate) {
        setRepeatStartDate(dateStr);
      }
      if (repeatEndDate && !dayjs(repeatEndDate).isAfter(dayjs(dateStr))) {
        setRepeatEndDate(dayjs(dateStr).add(1, 'year').format('YYYY-MM-DD'));
      }
    } else if (datePickerType === 'repeatStart') {
      setRepeatStartDate(dateStr);
      if (repeatEndDate && !dayjs(repeatEndDate).isAfter(dayjs(dateStr))) {
        setRepeatEndDate(dayjs(dateStr).add(1, 'year').format('YYYY-MM-DD'));
      }
    } else if (datePickerType === 'repeatEnd') {
      setRepeatEndDate(dateStr);
    }
    setShowDatePicker(false);
  };

  const handleDelete = () => {
    const isRecurring = !!(task.recurringSeriesId || task.isRecurring || (task.repeatConfig && task.repeatConfig.preset && task.repeatConfig.preset !== 'None') || (task.repeatFrequency && task.repeatFrequency !== 'None'));
    if (isRecurring) {
      setConfirmConfig({
        isVisible: true,
        title: t('Delete Recurring Task'),
        message: t('Do you want to delete only this task or all recurring tasks?'),
        confirmText: t('This task only'),
        isDestructive: true,
        secondaryIsDestructive: true,
        onConfirm: () => {
          dispatch(deleteTask({ taskId: task.id }));
          setConfirmConfig(prev => ({ ...prev, isVisible: false }));
          onClose();
        },
        secondaryConfirmText: t('All recurring tasks'),
        onSecondaryConfirm: () => {
          dispatch(deleteTask({ taskId: task.id }));
          if (task.recurringSeriesId) {
            dispatch(deleteRecurringSeries({ seriesId: task.recurringSeriesId }));
          }
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
      style={{ margin: 0, justifyContent: 'flex-end', height: '100%' }}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.bgCard, paddingTop: Platform.OS === 'ios' ? (isCompact ? 34 : 42) : (isVeryCompact ? 6 : 10) }]}>
          <View style={[styles.dragHandleContainer, { paddingBottom: isVeryCompact ? 2 : 4 }]}>
            <View style={[styles.dragHandle, { backgroundColor: colors.textSecondary }]} />
          </View>
          
          {/* Top navigation row with Back button and Cancel */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: isWideScreen ? 32 : 20, marginBottom: isVeryCompact ? 4 : (isCompact ? 6 : 10), maxWidth: isWideScreen ? 680 : '100%', width: '100%', alignSelf: 'center' }}>
            <TouchableOpacity 
              onPress={handleClose} 
              activeOpacity={0.7}
              style={{ width: isVeryCompact ? 32 : 36, height: isVeryCompact ? 32 : 36, borderRadius: 18, borderWidth: 1, borderColor: colors.borderColor || '#E5E5EA', backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center' }}
            >
              <Svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M19 12H5M12 19l-7-7 7-7" />
              </Svg>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={handleShare} activeOpacity={0.7} style={{ padding: 4 }}>
                <IconShare color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary }}>{t('Cancel') || 'Cancel'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            ref={scrollViewRef}
            onScroll={(e) => setScrollOffset(e.nativeEvent.contentOffset.y)}
            onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
            onContentSizeChange={(_, h) => setScrollContentHeight(h)}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            bounces={false}
            style={styles.body} 
            contentContainerStyle={[
              styles.bodyContent,
              {
                paddingHorizontal: isWideScreen ? 32 : 20,
                paddingTop: 2,
                paddingBottom: isVeryCompact ? 6 : 12,
                maxWidth: isWideScreen ? 680 : '100%',
                width: '100%',
                alignSelf: 'center',
                justifyContent: (isTaskOptionsCollapsed && subtasks.length === 0 && attachments.length === 0) ? 'space-between' : 'flex-start',
              }
            ]} 
            keyboardShouldPersistTaps="handled"
          >
            <View>
            {/* Screen Title: Edit task */}
            <Text style={{ fontSize: isVeryCompact ? 20 : (isCompact ? 22 : 25), fontWeight: '700', letterSpacing: -0.5, color: colors.textPrimary, marginBottom: isVeryCompact ? 6 : (isCompact ? 8 : 12) }}>
              {t('Edit task') || 'Edit task'}
            </Text>
            
            {/* Task Name Section */}
            <View style={{ marginBottom: isVeryCompact ? 8 : (isCompact ? 10 : 12) }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
                {t('Task name') || 'Task name'}
              </Text>
              
              <TextInput
                testID="task_details_name_input"
                accessible={true} accessibilityLabel="Task Name"
                rows={1}
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    borderColor: 'transparent',
                    borderWidth: 0,
                    backgroundColor: 'transparent',
                    minHeight: 26,
                    fontSize: isVeryCompact ? 18 : 20,
                    lineHeight: isVeryCompact ? 22 : 25,
                    fontWeight: '700',
                    padding: 0,
                    paddingHorizontal: 0,
                    paddingVertical: 0,
                    textAlignVertical: 'top',
                    overflow: 'hidden',
                    outlineStyle: 'none',
                    outlineWidth: 0,
                  },
                  Platform.OS === 'web' && { fieldSizing: 'content' },
                ]}
                value={taskName}
                onChangeText={setTaskName}
                onContentSizeChange={(e) => {
                  const h = e.nativeEvent?.contentSize?.height;
                  if (h && h > 0) {
                    setNameInputHeight(Math.ceil(h));
                  }
                }}
                onBlur={handleNameBlur}
                placeholder={t("What needs to be done?")}
                placeholderTextColor={colors.textSecondary}
                multiline={true}
                scrollEnabled={false}
              />

              {/* Category indicator below task name */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getBoardColor(boards.find(b => b.id === selectedBoardId || b._id === selectedBoardId), boards), marginRight: 6 }} />
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '500' }}>
                  {selectedBoardName}
                </Text>
              </View>
            </View>

            {/* Date and Time picker pills row */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: isVeryCompact ? 8 : (isCompact ? 10 : 12) }}>
              <TouchableOpacity 
                accessible={true} accessibilityRole="button" accessibilityLabel={`Due date, ${selectedDate ? dayjs(selectedDate).format('MMM D, YYYY') : 'Not set'}`}
                style={[styles.dateTimePill, { borderWidth: 1, borderColor: colors.borderColor || '#E5E5EA', backgroundColor: colors.bgCard, borderRadius: 12, height: isVeryCompact ? 38 : (isCompact ? 42 : 44), paddingHorizontal: 12, flex: 1, justifyContent: 'space-between', outlineStyle: 'none' }]}
                onPress={() => { setDatePickerType('due'); setShowDatePicker(true); }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <IconCalendar color={colors.primary} />
                  <Text style={[styles.dateTimeText, { color: colors.textPrimary, fontSize: 13, fontWeight: '600' }]} numberOfLines={1}>
                    {selectedDate ? dayjs(selectedDate).format('MMM D, YYYY') : t('Select date')}
                  </Text>
                </View>
                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2.5"><Path d="M6 9l6 6 6-6" /></Svg>
              </TouchableOpacity>

              <TouchableOpacity 
                accessible={true} accessibilityRole="button" accessibilityLabel={`Time, ${formatDisplayTime(selectedTime)}`}
                style={[styles.dateTimePill, { borderWidth: 1, borderColor: colors.borderColor || '#E5E5EA', backgroundColor: colors.bgCard, borderRadius: 12, height: isVeryCompact ? 38 : (isCompact ? 42 : 44), paddingHorizontal: 12, flex: 1, justifyContent: 'space-between', outlineStyle: 'none' }]}
                onPress={() => setShowTimePicker(true)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <IconClock color={colors.primary} />
                  <Text style={[styles.dateTimeText, { color: colors.textPrimary, fontSize: 13, fontWeight: '600' }]} numberOfLines={1}>
                    {formatDisplayTime(selectedTime) || t('No time') || 'No time'}
                  </Text>
                </View>
                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2.5"><Path d="M6 9l6 6 6-6" /></Svg>
              </TouchableOpacity>
            </View>

            {/* Collapsible Section Card: Priority, Reminder, Repeat */}
            <View style={[styles.optionsCard, { borderWidth: 0, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: 14, paddingVertical: isVeryCompact ? 8 : (isCompact ? 10 : 12), paddingHorizontal: 12, marginBottom: isVeryCompact ? 8 : (isCompact ? 10 : 12) }]}>
              <TouchableOpacity
                accessible={true}
                accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
                accessibilityLabel={`${t('Priority, Reminder, Repeat') || 'Priority, Reminder, Repeat'}, ${isTaskOptionsCollapsed ? 'collapsed' : 'expanded'}`}
                style={[styles.optionsCardHeader, { borderWidth: 0, backgroundColor: 'transparent', outlineStyle: 'none' }]}
                onPress={() => dispatch(toggleTaskOptionsCollapsed())}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                  <View style={[styles.tuneIconBadge, { width: 30, height: 30, borderRadius: 8, marginRight: 10, backgroundColor: hexToRgba(colors.primary, isDark ? 0.16 : 0.12) }]}>
                    <IconTune color={colors.primary} />
                  </View>
                  <Text style={[styles.optionsCardTitle, { color: colors.textPrimary, fontSize: 14 }]}>
                    {t('Priority, Reminder, Repeat') || 'Priority, Reminder, Repeat'}
                  </Text>
                </View>
                <IconChevronDown color={colors.textSecondary} isCollapsed={isTaskOptionsCollapsed} />
              </TouchableOpacity>

              {isTaskOptionsCollapsed ? (
                <View style={[styles.optionsSummaryRow, { marginTop: isVeryCompact ? 4 : 6 }]}>
                  {priority !== 'none' && (
                    <View style={[styles.priorityPillBadge, { backgroundColor: priorityBadgeStyle.bg }]}>
                      <Text style={[styles.priorityPillText, { color: priorityBadgeStyle.text }]}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.optionsSummaryText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {[
                      reminder !== 'None' ? (t(reminder) || reminder) : null,
                      selectedBoardName,
                      repeatConfig?.preset && repeatConfig.preset !== 'None' ? (t(repeatConfig.preset) || repeatConfig.preset) : null
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              ) : (
                <View style={styles.optionsExpandedContent}>
                  <View style={[styles.twoColumnRow, { marginBottom: 14 }]}>
                    <View style={styles.column}>
                      <CustomDropdown 
                        label={t("Priority")} 
                        value={priority.charAt(0).toUpperCase() + priority.slice(1)} 
                        options={[
                          {label: t('None'), value: 'None'}, 
                          {label: t('Low'), value: 'Low'}, 
                          {label: t('Medium'), value: 'Medium'}, 
                          {label: t('High'), value: 'High'}
                        ]} 
                        onSelect={handlePrioritySelect} 
                        colors={colors} 
                        leftIcon={<IconFlag color={priority === 'high' ? (colors.danger || '#f87171') : priority === 'medium' ? '#fb923c' : priority === 'low' ? '#4ade80' : colors.textSecondary} />}
                        customBtnStyle={{ height: 46, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderWidth: 0 }} 
                      />
                    </View>
                    <View style={styles.column}>
                      <CustomDropdown 
                        label={t("Reminder")} 
                        value={reminder === 'Nag Mode (Every 10 min)' ? t('Nag Mode (Every 10 min)') : reminder === 'Escalating Reminder' ? t('Escalating Reminder') : (t(reminder) || reminder)} 
                        options={[
                          {label: t('None'), value: 'None'}, 
                          {label: t('15 min before'), value: '15 min before'}, 
                          {label: t('30 min before'), value: '30 min before'}, 
                          {label: t('1 hr before'), value: '1 hr before'}, 
                          {label: t('1 day before'), value: '1 day before'}, 
                          {label: t('Day of'), value: 'Day of'},
                          {label: t('Custom...'), value: 'custom'}
                        ]} 
                        onSelect={handleReminderSelect} 
                        colors={colors} 
                        customBtnStyle={{ height: 46, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderWidth: 0 }} 
                      />
                    </View>
                  </View>

                  {boards.length > 1 && (
                    <View style={{ marginBottom: 14 }}>
                      <CustomDropdown 
                        label={t("Board")} 
                        value={selectedBoardName} 
                        options={boards.map(b => ({ label: b.name === 'Main' ? t('Main') : b.name, value: b.id }))} 
                        onSelect={(val) => setSelectedBoardId(val)} 
                        colors={colors} 
                        customBtnStyle={{ height: 46, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderWidth: 0 }} 
                      />
                    </View>
                  )}

                  <View style={{ marginBottom: 16 }}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('Repeat')}</Text>
                    <TouchableOpacity 
                      style={[styles.dropdownLikeBtn, { borderWidth: 0, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', height: 46, borderRadius: 12 }]}
                      onPress={() => setIsRepeatModalVisible(true)}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>
                        {repeatConfig.preset === 'custom' ? t('Custom...') : 
                         repeatConfig.preset === 'None' ? t('None') : 
                         (t(repeatConfig.preset) || repeatConfig.preset.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))}
                      </Text>
                      <IconChevronDown color={colors.textSecondary} isCollapsed={true} />
                    </TouchableOpacity>
                  </View>

                  {repeatConfig.preset !== 'None' && (
                    <View style={[styles.repeatConfigBox, { borderWidth: 0, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderRadius: 12, marginBottom: 16, padding: 14 }]}>
                      <Text style={[styles.repeatConfigTitle, { color: colors.textSecondary }]}>{t('Repeat configuration')}</Text>
                      <View style={styles.twoColumnRow}>
                        <View style={styles.column}>
                          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 6 }]}>{t('From')}</Text>
                          <TouchableOpacity 
                            style={[styles.dateBtn, { borderWidth: 0, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', height: 46, borderRadius: 10 }]}
                            onPress={() => { setDatePickerType('repeatStart'); setShowDatePicker(true); }}
                          >
                            <IconCalendar color={colors.textPrimary} />
                            <Text style={[styles.dateText, { color: colors.textPrimary }]} numberOfLines={1}>
                              {repeatStartDate || selectedDate ? dayjs(repeatStartDate || selectedDate).format('MM/DD/YYYY') : t('Select')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.column}>
                          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 6 }]}>{t('To')}</Text>
                          <TouchableOpacity 
                            style={[styles.dateBtn, { borderWidth: 0, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', height: 46, borderRadius: 10 }]}
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

                  <View style={[styles.cardDivider, { backgroundColor: colors.borderColor }]} />

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14 }}>
                        {t('Play Reminder as Alarm')}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                        {t('Use an alarm instead of a notification.')}
                      </Text>
                    </View>
                    <Switch 
                      value={isAlarm} 
                      onValueChange={setIsAlarm} 
                      trackColor={{ true: colors.primary, false: colors.borderColor }} 
                    />
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14 }}>
                        {t('Keep notification all day')}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                        {t('Cannot be closed until task is modified or completed')}
                      </Text>
                    </View>
                    <Switch
                      testID="keep_notification_all_day_switch"
                      value={keepNotificationAllDay}
                      onValueChange={setKeepNotificationAllDay}
                      trackColor={{ true: colors.primary, false: colors.borderColor }}
                    />
                  </View>
                </View>
              )}
            </View>

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

            {/* Notes & Attachments Card */}
            <View style={{ marginBottom: isVeryCompact ? 8 : (isCompact ? 10 : 12) }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>
                {t('Notes & attachments') || 'Notes & attachments'}
              </Text>
              
              <View style={{ borderWidth: 1, borderColor: colors.borderColor || '#E5E5EA', borderRadius: 14, paddingVertical: isVeryCompact ? 8 : 10, paddingHorizontal: 12, backgroundColor: colors.bgCard }}>
                <MemoizedNotesInput
                  ref={notesRef}
                  initialValue={notes}
                  placeholder={t("Add details") || t("Add notes...") || "Add details"}
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.notesInput, { color: colors.textPrimary, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, minHeight: isVeryCompact ? 32 : (isCompact ? 38 : 48) }]}
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

                <TouchableOpacity
                  accessible={true}
                  accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
                  accessibilityLabel="Add attachment"
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: isVeryCompact ? 4 : 6, gap: 6, borderWidth: 0, backgroundColor: 'transparent', outlineStyle: 'none' }}
                  onPress={handleOpenAttachmentOptions}
                >
                  <Svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </Svg>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                    {t('Add attachment') || 'Add attachment'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Section: Subtasks */}
            <View style={{ marginBottom: isVeryCompact ? 6 : (isCompact ? 8 : 10) }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                  {t('Subtasks') || 'Subtasks'}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {subtasks.length}
                </Text>
              </View>

              {subtasks.length > 0 && (
                <View style={{ marginBottom: 6 }}>
                  {subtasks.map((subtask) => (
                    <View 
                      key={subtask.id} 
                      style={[styles.subtaskPillRow, { borderWidth: 0, backgroundColor: 'transparent' }]}
                    >
                      <TouchableOpacity 
                        accessible={true} accessibilityRole="checkbox" accessibilityState={{ checked: subtask.completed }} accessibilityLabel="Toggle subtask completion"
                        onPress={() => toggleSubtask(subtask.id)} 
                        style={styles.subtaskCheckBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {subtask.completed ? <IconCheckCircle color={colors.primary} size={20} /> : <IconCircle color={colors.textSecondary} size={20} />}
                      </TouchableOpacity>
                      <TextInput
                        accessible={true} accessibilityLabel="Subtask text"
                        style={[
                          styles.subtaskTextInput,
                          { color: colors.textPrimary, borderWidth: 0, backgroundColor: 'transparent' },
                          subtask.completed && { textDecorationLine: 'line-through', opacity: 0.5 }
                        ]}
                        value={subtask.text}
                        onChangeText={(text) => updateSubtask(subtask.id, text)}
                        placeholder={t("Subtask...")}
                        placeholderTextColor={colors.textSecondary}
                        blurOnSubmit={true}
                      />
                      <TouchableOpacity 
                        accessible={true} accessibilityRole="button" accessibilityLabel="Delete subtask"
                        onPress={() => removeSubtask(subtask.id)} 
                        style={styles.subtaskDeleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <IconClose color={colors.textSecondary} size={18} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                accessible={true}
                accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
                accessibilityLabel="Add subtask"
                style={{ height: isVeryCompact ? 36 : (isCompact ? 40 : 42), borderRadius: 12, backgroundColor: isDark ? 'rgba(93, 69, 219, 0.22)' : 'rgba(93, 69, 219, 0.10)', justifyContent: 'center', alignItems: 'center', borderWidth: 0, outlineStyle: 'none' }}
                onPress={addSubtask}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
                  + {t('Add subtask') || 'Add subtask'}
                </Text>
              </TouchableOpacity>
            </View>
            </View>

            {/* Bottom Actions */}
            <View style={{ marginTop: isVeryCompact ? 6 : 10, marginBottom: 4 }}>
              <TouchableOpacity 
                testID="task_details_save_btn_bottom"
                onPress={handleSave} 
                style={[styles.saveBtnFull, { backgroundColor: colors.primary, height: isVeryCompact ? 42 : (isCompact ? 46 : 48), borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 0, outlineStyle: 'none' }]}
                activeOpacity={0.85}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <IconCheck color="#ffffff" />
                  <Text style={[styles.saveBtnText, { color: '#ffffff', fontSize: 15, fontWeight: '700' }]}>
                    {t('Save changes') || 'Save changes'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                testID="task_details_delete_btn_bottom"
                accessible={true} accessibilityRole={Platform.OS === 'web' ? undefined : 'button'} accessibilityLabel="Delete task"
                onPress={handleDelete} 
                style={[styles.deleteLink, { marginTop: isVeryCompact ? 4 : 6, marginBottom: 0, paddingVertical: isVeryCompact ? 4 : 6, borderWidth: 0, backgroundColor: 'transparent', outlineStyle: 'none' }]}
                activeOpacity={0.7}
              >
                <IconTrash color={colors.danger || '#f87171'} />
                <Text style={[styles.deleteLinkText, { color: colors.danger || '#f87171', fontSize: 13, fontWeight: '600', marginLeft: 6 }]}>
                  {t('Delete task') || 'Delete task'}
                </Text>
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
          secondaryIsDestructive={confirmConfig.secondaryIsDestructive}
          secondaryConfirmText={confirmConfig.secondaryConfirmText}
          onSecondaryConfirm={confirmConfig.onSecondaryConfirm}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isVisible: false }))}
          onConfirm={confirmConfig.onConfirm}
        />

        <PremiumModal
          isVisible={isPremiumModalVisible}
          onClose={() => setPremiumModalVisible(false)}
          featureName={premiumFeatureName}
        />

        <RNModal
          visible={isAttachmentOptionsVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAttachmentOptionsVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.calendarOverlay}
            onPress={() => setAttachmentOptionsVisible(false)}
          >
            <View
              style={[
                styles.calendarContainer,
                {
                  backgroundColor: colors.bgCard,
                  maxWidth: 360,
                  width: '90%',
                  padding: 18,
                  borderRadius: 20,
                }
              ]}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>
                {t('Add Attachment') || 'Add Attachment'}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 14 }}>
                {t('Choose an attachment type:') || 'Choose an attachment type:'}
              </Text>

              <TouchableOpacity
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  marginBottom: 8,
                  gap: 12,
                }}
                onPress={() => {
                  setAttachmentOptionsVisible(false);
                  setTimeout(() => launchCamera(), 150);
                }}
              >
                <IconCamera color={colors.primary} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                  {t('Take Photo') || 'Take Photo'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  marginBottom: 8,
                  gap: 12,
                }}
                onPress={() => {
                  setAttachmentOptionsVisible(false);
                  setTimeout(() => launchImageLibrary(), 150);
                }}
              >
                <IconImage color={colors.primary} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                  {t('Choose Image') || t('Choose from Gallery') || 'Choose Image'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  marginBottom: 12,
                  gap: 12,
                }}
                onPress={() => {
                  setAttachmentOptionsVisible(false);
                  setTimeout(() => pickDocument(), 150);
                }}
              >
                <IconFile color={colors.primary} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                  {t('Attach File') || t('Attach Document') || 'Attach File'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={{ alignItems: 'center', paddingVertical: 8 }}
                onPress={() => setAttachmentOptionsVisible(false)}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
                  {t('Cancel') || 'Cancel'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </RNModal>


        <RNModal visible={showDatePicker} transparent animationType="fade">
          <View style={styles.calendarOverlay}>
            <View style={[styles.calendarContainer, { backgroundColor: colors.bgCard }]}>
              {(() => {
                const activeCalendarDate = getValidDateString(
                  datePickerType === 'due' 
                    ? selectedDate 
                    : datePickerType === 'repeatStart'
                    ? (repeatStartDate || selectedDate)
                    : (repeatEndDate || repeatStartDate || selectedDate)
                );
                return (
                  <Calendar
                    key={`${activeCalendarDate}-${i18n.language}`}
                    markingType={'custom'}
                    firstDay={i18n.language === 'en' ? 0 : 1}
                    current={activeCalendarDate}
                    onDayPress={(day) => handleDateSelect(day.dateString)}
                    markedDates={getCalendarMarkedDates()}
                    enableSwipeMonths={true}
                    renderHeader={(date) => {
                      let dateObj;
                      if (date) {
                        if (typeof date.toDate === 'function') {
                          dateObj = dayjs(date.toDate());
                        } else if (typeof date === 'string') {
                          dateObj = dayjs(date);
                        } else if (date instanceof Date) {
                          dateObj = dayjs(date);
                        } else {
                          dateObj = dayjs(activeCalendarDate);
                        }
                      } else {
                        dateObj = dayjs(activeCalendarDate);
                      }
                      if (!dateObj.isValid() || dateObj.year() < 2000 || dateObj.year() > 2100) {
                        dateObj = dayjs(activeCalendarDate);
                      }
                      const monthStr = dateObj.format('MMMM YYYY');
                      return (
                        <TouchableOpacity
                          accessible={true}
                          accessibilityRole="button"
                          accessibilityLabel={`Select year`}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: cardBgNested }}
                          onPress={() => setYearPickerVisible(true)}
                        >
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginRight: 6 }}>
                            {monthStr}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.primary }}>▼</Text>
                        </TouchableOpacity>
                      );
                    }}
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
                  textDayFontWeight: '600',
                  todayButtonFontWeight: 'bold',
                  textMonthFontWeight: 'bold',
                  textDayHeaderFontWeight: '600',
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
              );
            })()}
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

        <YearPickerModal
          isVisible={isYearPickerVisible}
          onClose={() => setYearPickerVisible(false)}
          currentYear={dayjs(
            datePickerType === 'due' 
              ? (selectedDate || dayjs().format('YYYY-MM-DD'))
              : datePickerType === 'repeatStart'
              ? (repeatStartDate || selectedDate || dayjs().format('YYYY-MM-DD'))
              : (repeatEndDate || repeatStartDate || selectedDate || dayjs().format('YYYY-MM-DD'))
          ).year()}
          onSelectYear={(year) => {
            if (datePickerType === 'due') {
              const newDate = dayjs(selectedDate || dayjs()).year(year).format('YYYY-MM-DD');
              setSelectedDate(newDate);
              if (!repeatStartDate) {
                setRepeatStartDate(newDate);
              }
              if (repeatEndDate && !dayjs(repeatEndDate).isAfter(dayjs(newDate))) {
                setRepeatEndDate(dayjs(newDate).add(1, 'year').format('YYYY-MM-DD'));
              }
            } else if (datePickerType === 'repeatStart') {
              const newDate = dayjs(repeatStartDate || selectedDate || dayjs()).year(year).format('YYYY-MM-DD');
              setRepeatStartDate(newDate);
              if (repeatEndDate && !dayjs(repeatEndDate).isAfter(dayjs(newDate))) {
                setRepeatEndDate(dayjs(newDate).add(1, 'year').format('YYYY-MM-DD'));
              }
            } else if (datePickerType === 'repeatEnd') {
              const newDate = dayjs(repeatEndDate || repeatStartDate || selectedDate || dayjs()).year(year).format('YYYY-MM-DD');
              setRepeatEndDate(newDate);
            }
          }}
          colors={colors}
        />

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
        onSave={(newConfig) => {
          setRepeatConfig(newConfig);
          if (newConfig && newConfig.preset && newConfig.preset !== 'None') {
            const currentStart = selectedDate || repeatStartDate || dayjs().format('YYYY-MM-DD');
            setRepeatStartDate(currentStart);
            if (!repeatEndDate || !dayjs(repeatEndDate).isAfter(dayjs(currentStart))) {
              setRepeatEndDate(dayjs(currentStart).add(1, 'year').format('YYYY-MM-DD'));
            }
          }
        }}
      />
      <CustomReminderModal
        isVisible={isCustomReminderModalVisible}
        initialValue={reminder}
        onClose={() => setIsCustomReminderModalVisible(false)}
        onSave={handleCustomReminderSave}
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
    height: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'hidden',
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
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
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 0,
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
    paddingHorizontal: 10,
    paddingVertical: 0,
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    includeFontPadding: false,
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
    paddingTop: 6,
    paddingRight: 6,
    position: 'relative'
  },
  attachmentThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    resizeMode: 'cover'
  },
  attachmentRemoveBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#f44336',
    borderRadius: 11,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
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
  },
  optionsCollapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionsCollapsibleTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionsSummaryBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  collapsibleContent: {
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8b9bb4',
    marginBottom: 8,
    marginTop: 18,
  },
  dateTimePill: {
    flex: 1,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  dateTimeText: {
    fontSize: 15,
    fontWeight: '500',
  },
  optionsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  optionsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tuneIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionsCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  priorityPillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priorityPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  optionsSummaryText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  optionsExpandedContent: {
    marginTop: 16,
  },
  dropdownLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },
  notesCard: {
    borderRadius: 8,
    borderWidth: 0,
    padding: 0,
    minHeight: 120,
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  notesInput: {
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    outlineStyle: 'none',
    outlineWidth: 0,
  },
  addAttachmentBtn: {
    display: 'none',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
  },
  addAttachmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtaskPillRow: {
    height: 44,
    borderRadius: 8,
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    marginBottom: 4,
  },
  subtaskCheckBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  subtaskTextInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    outlineStyle: 'none',
    outlineWidth: 0,
  },
  subtaskDeleteBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  addSubtaskPill: {
    height: 44,
    borderRadius: 8,
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    gap: 10,
    marginBottom: 8,
  },
  addSubtaskText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtnFull: {
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  saveBtnText: {
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 6,
    marginBottom: 10,
    gap: 6,
  },
  deleteLinkText: {
    color: '#f87171',
    fontWeight: '600',
    fontSize: 15,
  },
});
