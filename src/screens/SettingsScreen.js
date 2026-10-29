import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal as RNModal, Switch, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { clearTasks, updateTask, batchSyncCalendarTasks } from '../features/taskSlice';
import { rescheduleAllActiveTasks, testAndroidDefaultNotification, scheduleLocalNotification } from '../utils/notifications';
import { setTaskNameWrap, setFontSize, setProgressMode, setDefaultSnoozeTime, setThemeMode, setAppPin, setAlarmSound, setNotificationSound, setVibrationEnabled, setShowRecurringTasksOnBoard, setAndroidAutoEnabled, setDefaultReminderEnabled, setDefaultReminderTime, setDbSyncEnabled, setCalendarSyncEnabled, setCalendarAlarmsEnabled, setSelectedCalendarId } from '../features/themeSlice';
import { checkCalendarPermissionsAsync, requestCalendarPermissionsAsync, getWritableCalendarsAsync } from '../utils/calendarSync';
import { togglePomodoroSettings } from '../features/pomodoroSlice';
import { toggleDevPremium } from '../features/entitlementSlice';
import { useTheme } from '../styles/ThemeContext';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import ThemeSettingsModal from '../components/ThemeSettingsModal';
import ChooseLanguageModal from '../components/ChooseLanguageModal';
import AutoManageSettings from '../components/AutoManageSettings';
import ConfirmModal from '../components/ConfirmModal';
import PremiumModal from '../components/PremiumModal';
import CustomDropdown from '../components/CustomDropdown';
import PromptModal from '../components/PromptModal';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { logoutUser, logout } from '../features/userSlice';

const SOUND_ASSETS = {
  'pisk.mp3': require('../../assets/audio/pisk.mp3'),
  'tucktuck.mp3': require('../../assets/audio/tucktuck.mp3'),
  'alarm_02.mp3': require('../../assets/audio/alarm_02.mp3'),
  'bass_alarm.mp3': require('../../assets/audio/bass_alarm.mp3'),
  'bell.mp3': require('../../assets/audio/bell.mp3'),
  'bell01.mp3': require('../../assets/audio/bell01.mp3'),
  'bonjo.mp3': require('../../assets/audio/bonjo.mp3'),
  'cellos_pizz.mp3': require('../../assets/audio/cellos_pizz.mp3'),
  'cellos_pizzdgg.mp3': require('../../assets/audio/cellos_pizzdgg.mp3'),
  'cellos_pizzedf.mp3': require('../../assets/audio/cellos_pizzedf.mp3'),
  'cellos_tremolo.mp3': require('../../assets/audio/cellos_tremolo.mp3'),
  'chime.wav': require('../../assets/audio/chime.wav'),
  'fireworks.mp3': require('../../assets/audio/fireworks.mp3'),
  'keys.mp3': require('../../assets/audio/keys.mp3'),
  'keys2.mp3': require('../../assets/audio/keys2.mp3'),
  'koto.mp3': require('../../assets/audio/koto.mp3'),
  'koto_notification.mp3': require('../../assets/audio/koto_notification.mp3'),
  'koto_shamisen.mp3': require('../../assets/audio/koto_shamisen.mp3'),
  'light_ping.mp3': require('../../assets/audio/light_ping.mp3'),
  'light_scrub.mp3': require('../../assets/audio/light_scrub.mp3'),
  'low_piano.mp3': require('../../assets/audio/low_piano.mp3'),
  'marinba.mp3': require('../../assets/audio/marinba.mp3'),
  'marinbaeefge.mp3': require('../../assets/audio/marinbaeefge.mp3'),
  'notification.wav': require('../../assets/audio/notification.wav'),
  'overdue_nudge.wav': require('../../assets/audio/overdue_nudge.wav'),
  'shamisen.mp3': require('../../assets/audio/shamisen.mp3'),
  'viola_solo_pizzicatoegabeb.mp3': require('../../assets/audio/viola_solo_pizzicatoegabeb.mp3'),
  'viola_solo_pizzicatoegag.mp3': require('../../assets/audio/viola_solo_pizzicatoegag.mp3'),
  'violin_pizzicatobefe.mp3': require('../../assets/audio/violin_pizzicatobefe.mp3'),
  'violla_pizzicatoegf.mp3': require('../../assets/audio/violla_pizzicatoegf.mp3'),
  'vpizzicato.mp3': require('../../assets/audio/vpizzicato.mp3'),
  'xelod.mp3': require('../../assets/audio/xelod.mp3'),
  'xelodfs.mp3': require('../../assets/audio/xelodfs.mp3'),
  'xelof.mp3': require('../../assets/audio/xelof.mp3'),
  'xylo.mp3': require('../../assets/audio/xylo.mp3'),
};

const IconClock = ({ color = '#6246EA', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 6v6l4 2" />
  </Svg>
);

const IconSliders = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="4" y1="7" x2="20" y2="7" />
    <Line x1="4" y1="17" x2="20" y2="17" />
    <Circle cx="9" cy="7" r="2.5" fill="none" />
    <Circle cx="15" cy="17" r="2.5" fill="none" />
  </Svg>
);

const IconPalette = ({ color = '#6246EA', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="13.5" cy="6.5" r=".5" fill={color} />
    <Circle cx="17.5" cy="10.5" r=".5" fill={color} />
    <Circle cx="8.5" cy="7.5" r=".5" fill={color} />
    <Circle cx="6.5" cy="12.5" r=".5" fill={color} />
    <Path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z" />
  </Svg>
);

const IconTranslate = ({ color = '#6246EA', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1" />
    <Path d="M22 22l-5-10-5 10M14 18h6" />
  </Svg>
);

const IconRepeat = ({ color = '#6246EA', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17 1l4 4-4 4" />
    <Path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <Path d="M7 23l-4-4 4-4" />
    <Path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Svg>
);

const IconLock = ({ color = '#6246EA', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Svg>
);

const IconBell = ({ color = '#6246EA', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Svg>
);

const IconSpeaker = ({ color = '#6246EA', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 5L6 9H2v6h4l5 4V5z" />
    <Path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </Svg>
);

const IconAlarm = ({ color = '#6246EA', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="13" r="8" />
    <Path d="M12 9v4l2 2" />
    <Path d="M5 3L2 6" />
    <Path d="M19 3l3 3" />
  </Svg>
);

const IconInfo = ({ color = '#6246EA', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Line x1="12" y1="16" x2="12" y2="12" />
    <Line x1="12" y1="8" x2="12.01" y2="8" />
  </Svg>
);

const IconChevronRight = ({ color = '#888', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18l6-6-6-6" />
  </Svg>
);

export default function SettingsScreen({ navigation }) {
  const dispatch = useDispatch();
  const { colors, isDark, mode } = useTheme();
  const { t, i18n } = useTranslation();

  const theme = useSelector(state => state.themeReducer);
  const isPremium = useSelector(state => state.entitlementReducer?.isPremium);

  const [isThemeModalVisible, setThemeModalVisible] = useState(false);
  const [isLanguageModalVisible, setLanguageModalVisible] = useState(false);
  const [isNotificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [isSoundPickerOpen, setSoundPickerOpen] = useState(false);
  const [isAlarmSoundPickerOpen, setAlarmSoundPickerOpen] = useState(false);
  const [isAutoManageModalVisible, setAutoManageModalVisible] = useState(false);
  const [isPremiumModalVisible, setPremiumModalVisible] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');
  const [pinPromptVisible, setPinPromptVisible] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ isVisible: false, title: '', message: '', confirmText: 'Confirm', cancelText: 'Cancel', isDestructive: false, hideCancel: false, onConfirm: null });
  const defaultSnoozeTime = theme.defaultSnoozeTime || 30;
  const [isSnoozePickerOpen, setSnoozePickerOpen] = useState(false);

  const handleTogglePin = (value) => {
    if (value) {
      setPinPromptVisible(true);
    } else {
      dispatch(setAppPin(null));
    }
  };

  const handleSetPin = (pin) => {
    const cleaned = String(pin || '').replace(/[^0-9]/g, '');
    if (cleaned.length === 4) {
      dispatch(setAppPin(cleaned));
      setPinPromptVisible(false);
    } else {
      setConfirmConfig({
        isVisible: true,
        title: t('Invalid PIN') || 'Invalid PIN',
        message: t('Please enter a 4-digit PIN') || 'Please enter a 4-digit PIN',
        confirmText: t('OK') || 'OK',
        hideCancel: true,
        onConfirm: () => setConfirmConfig(prev => ({ ...prev, isVisible: false }))
      });
    }
  };

  const formatSnoozeTime = (val) => {
    if (val >= 1440) return `${val / 1440} ${t('day') || 'day'}`;
    if (val >= 60) return `${val / 60} ${val >= 120 ? (t('hours') || 'hours') : (t('hour') || 'hour')}`;
    return `${val} ${t('min') || 'min'}`;
  };

  const snoozeOptions = [
    { label: `5 ${t('min') || 'min'}`, value: 5 },
    { label: `10 ${t('min') || 'min'}`, value: 10 },
    { label: `15 ${t('min') || 'min'}`, value: 15 },
    { label: `30 ${t('min') || 'min'}`, value: 30 },
    { label: `1 ${t('hour') || 'hour'}`, value: 60 },
    { label: `2 ${t('hours') || 'hours'}`, value: 120 },
    { label: `1 ${t('day') || 'day'}`, value: 1440 },
  ];

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

  const currentSoundRef = useRef(null);
  useEffect(() => {
    return () => {
      if (currentSoundRef.current) {
        currentSoundRef.current.stopAsync().catch(() => {});
        currentSoundRef.current.unloadAsync().catch(() => {});
        currentSoundRef.current = null;
      }
    };
  }, []);
  const primaryAccent = colors.primary || '#5D45DB';
  const iconBg = isDark ? 'rgba(93, 69, 219, 0.22)' : 'rgba(93, 69, 219, 0.12)';

  const currentLanguageLabel = {
    en: 'English',
    ru: 'Русский',
    es: 'Español',
    zh: '中文',
    ja: '日本語',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano',
    hi: 'हिन्दी',
    ko: '한국어',
  }[i18n.language] || 'English';

  const currentThemeLabel = {
    system: t('System') || 'System',
    light: t('Light') || 'Light',
    dark: t('Dark') || 'Dark',
    contrast: t('Contrast') || 'Contrast',
  }[mode || 'light'] || 'Light';

  const ALL_SOUND_OPTIONS = [
    { label: t('Device Default') || 'Device Default', value: 'default' },
    { label: 'Alarm 02', value: 'alarm_02.mp3' },
    { label: 'Bass Alarm', value: 'bass_alarm.mp3' },
    { label: 'Bell', value: 'bell.mp3' },
    { label: 'Bell 01', value: 'bell01.mp3' },
    { label: 'Bonjo', value: 'bonjo.mp3' },
    { label: 'Cellos Pizzicato', value: 'cellos_pizz.mp3' },
    { label: 'Cellos Pizz DGG', value: 'cellos_pizzdgg.mp3' },
    { label: 'Cellos Pizz EDF', value: 'cellos_pizzedf.mp3' },
    { label: 'Cellos Tremolo', value: 'cellos_tremolo.mp3' },
    { label: 'Chime', value: 'chime.wav' },
    { label: 'Fireworks', value: 'fireworks.mp3' },
    { label: 'Keys', value: 'keys.mp3' },
    { label: 'Keys 2', value: 'keys2.mp3' },
    { label: 'Koto', value: 'koto.mp3' },
    { label: 'Koto Notification', value: 'koto_notification.mp3' },
    { label: 'Koto Shamisen', value: 'koto_shamisen.mp3' },
    { label: 'Light Ping', value: 'light_ping.mp3' },
    { label: 'Light Scrub', value: 'light_scrub.mp3' },
    { label: 'Low Piano', value: 'low_piano.mp3' },
    { label: 'Marimba', value: 'marinba.mp3' },
    { label: 'Marimba EEFGE', value: 'marinbaeefge.mp3' },
    { label: 'Notification', value: 'notification.wav' },
    { label: 'Overdue Nudge', value: 'overdue_nudge.wav' },
    { label: 'Pisk', value: 'pisk.mp3' },
    { label: 'Shamisen', value: 'shamisen.mp3' },
    { label: 'Tucktuck', value: 'tucktuck.mp3' },
    { label: 'Viola Solo Pizzicato EGABEB', value: 'viola_solo_pizzicatoegabeb.mp3' },
    { label: 'Viola Solo Pizzicato EGAG', value: 'viola_solo_pizzicatoegag.mp3' },
    { label: 'Violin Pizzicato BEFE', value: 'violin_pizzicatobefe.mp3' },
    { label: 'Viola Pizzicato EGF', value: 'violla_pizzicatoegf.mp3' },
    { label: 'V Pizzicato', value: 'vpizzicato.mp3' },
    { label: 'Xelod', value: 'xelod.mp3' },
    { label: 'Xelod FS', value: 'xelodfs.mp3' },
    { label: 'Xelof', value: 'xelof.mp3' },
    { label: 'Xylo', value: 'xylo.mp3' },
  ];

  const currentNotificationSoundName = theme.notificationSound === 'default' 
    ? (t('Device Default') || 'Device Default') 
    : (ALL_SOUND_OPTIONS.find(o => o.value === theme.notificationSound)?.label || (theme.notificationSound || 'notification.wav').replace(/\.(wav|mp3)$/i, ''));

  const currentAlarmSoundName = theme.alarmSound === 'default' 
    ? (t('Device Default') || 'Device Default') 
    : (ALL_SOUND_OPTIONS.find(o => o.value === theme.alarmSound)?.label || (theme.alarmSound || 'bass_alarm.mp3').replace(/\.(wav|mp3)$/i, ''));

  const playSoundPreview = async (soundFilename) => {
    try {
      if (currentSoundRef.current) {
        await currentSoundRef.current.stopAsync();
        await currentSoundRef.current.unloadAsync();
        currentSoundRef.current = null;
      }
      if (soundFilename === 'default') {
        if (Platform.OS === 'android') {
          testAndroidDefaultNotification();
        } else {
          scheduleLocalNotification(t('Sound Preview'), t('Device Default Sound'), 1, false);
        }
        return;
      }
      const asset = SOUND_ASSETS[soundFilename];
      if (asset) {
        const { sound } = await Audio.Sound.createAsync(asset);
        currentSoundRef.current = sound;
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            sound.unloadAsync();
            if (currentSoundRef.current === sound) {
              currentSoundRef.current = null;
            }
          }
        });
      }
    } catch (error) {
      console.log('Error playing sound preview:', error);
    }
  };

  const handleDeleteData = () => {
    setConfirmConfig({
      isVisible: true,
      title: t('Delete All Data'),
      message: t('Are you sure you want to clear all your tasks? This action cannot be undone.'),
      confirmText: t('Delete'),
      cancelText: t('Cancel'),
      isDestructive: true,
      hideCancel: false,
      onConfirm: () => {
        dispatch(clearTasks());
        setConfirmConfig({
          isVisible: true,
          title: t('Deleted'),
          message: t('All tasks have been cleared.'),
          confirmText: t('OK'),
          hideCancel: true,
          onConfirm: () => setConfirmConfig(prev => ({ ...prev, isVisible: false }))
        });
      }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgMain || (isDark ? '#141419' : '#FAF9F6') }]}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Top Header */}
        <View style={styles.topHeaderRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
              {t('Settings') || 'Settings'}
            </Text>
            <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
              {t('A planner that feels like you.') || 'A planner that feels like you.'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleToggleTheme}
              style={[styles.headerIconCircle, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}
              accessibilityRole="button"
              accessibilityLabel="Toggle theme"
            >
              {renderThemeIcon()}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setThemeModalVisible(true)}
              style={[styles.headerIconCircle, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}
              accessibilityRole="button"
              accessibilityLabel="Appearance settings"
            >
              <IconSliders color={colors.textPrimary} size={18} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 1: Make it yours */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          {t('Make it yours') || 'Make it yours'}
        </Text>

        <View style={[styles.groupedCard, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
          {/* Appearance Row */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setThemeModalVisible(true)}
            style={styles.cardItemRow}
          >
            <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
              <IconPalette color={primaryAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                {t('Appearance') || 'Appearance'}
              </Text>
              <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                {t('Theme, colors & contrast') || 'Theme, colors & contrast'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.itemValueText, { color: colors.textSecondary, marginRight: 6 }]}>
                {currentThemeLabel}
              </Text>
              <IconChevronRight color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.borderColor || '#F0F0F4' }]} />

          {/* Language Row */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setLanguageModalVisible(true)}
            style={styles.cardItemRow}
          >
            <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
              <IconTranslate color={primaryAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                {t('Language') || 'Language'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.itemValueText, { color: colors.textSecondary, marginRight: 6 }]}>
                {currentLanguageLabel}
              </Text>
              <IconChevronRight color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.borderColor || '#F0F0F4' }]} />

          {/* Show Recurring Tasks */}
          <View style={styles.cardItemRow}>
            <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
              <IconRepeat color={primaryAccent} />
            </View>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                {t('Show recurring tasks') || 'Show recurring tasks'}
              </Text>
            </View>
            <Switch
              value={theme.showRecurringTasksOnBoard || false}
              onValueChange={val => dispatch(setShowRecurringTasksOnBoard(val))}
              trackColor={{ false: colors.borderColor || '#CCC', true: primaryAccent }}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderColor || '#F0F0F4' }]} />

          {/* App PIN Lock */}
          <View style={styles.cardItemRow}>
            <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
              <IconLock color={primaryAccent} />
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setPinPromptVisible(true)}
              style={{ flex: 1, marginRight: 10 }}
            >
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                {t('App PIN Lock') || 'App PIN Lock'}
              </Text>
              <Text style={[styles.itemSubtitle, { color: theme.appPin ? primaryAccent : colors.textSecondary }]}>
                {theme.appPin
                  ? `PIN: ${theme.appPin} · ${t('Tap to change') || 'Tap to change'}`
                  : (t('Protect app with a 4-digit PIN') || 'Protect app with a 4-digit PIN')}
              </Text>
            </TouchableOpacity>
            <Switch
              value={!!theme.appPin}
              onValueChange={handleTogglePin}
              trackColor={{ false: colors.borderColor || '#CCC', true: primaryAccent }}
            />
          </View>
        </View>

        {/* Section 2: Notifications */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginTop: 24 }]}>
          {t('Notifications') || 'Notifications'}
        </Text>

        <View style={[styles.groupedCard, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
          {/* Notification settings */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setNotificationSettingsOpen(!isNotificationSettingsOpen)}
            style={styles.cardItemRow}
          >
            <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
              <IconBell color={primaryAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                {t('Notification settings') || 'Notification settings'}
              </Text>
            </View>
            <IconChevronRight color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Expanded notification options */}
          {isNotificationSettingsOpen && (
            <View style={styles.expandedSubOptions}>
              <View style={styles.subOptionRow}>
                <Text style={[styles.subOptionLabel, { color: colors.textPrimary }]}>
                  {t('Vibration') || 'Vibration'}
                </Text>
                <Switch
                  value={theme.vibrationEnabled !== false}
                  onValueChange={val => dispatch(setVibrationEnabled(val))}
                  trackColor={{ false: colors.borderColor || '#CCC', true: primaryAccent }}
                />
              </View>
              {isPremium && (
                <View style={styles.subOptionRow}>
                  <Text style={[styles.subOptionLabel, { color: colors.textPrimary }]}>
                    {t('Default reminder on new tasks') || 'Default reminder on new tasks'}
                  </Text>
                  <Switch
                    value={theme.defaultReminderEnabled || false}
                    onValueChange={val => dispatch(setDefaultReminderEnabled(val))}
                    trackColor={{ false: colors.borderColor || '#CCC', true: primaryAccent }}
                  />
                </View>
              )}
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: colors.borderColor || '#F0F0F4' }]} />

          {/* Notification sound */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => {
              setSoundPickerOpen(!isSoundPickerOpen);
              if (!isSoundPickerOpen) setAlarmSoundPickerOpen(false);
            }}
            style={styles.cardItemRow}
          >
            <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
              <IconSpeaker color={primaryAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                {t('Notification sound') || 'Notification sound'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.itemValueText, { color: colors.textSecondary, marginRight: 6 }]}>
                {currentNotificationSoundName}
              </Text>
              <IconChevronRight color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Expanded notification sound options */}
          {isSoundPickerOpen && (
            <ScrollView nestedScrollEnabled={true} style={[styles.expandedSubOptions, { maxHeight: 280 }]} showsVerticalScrollIndicator={true}>
              {ALL_SOUND_OPTIONS.map(snd => (
                <TouchableOpacity
                  key={`notif_${snd.value}`}
                  style={styles.soundItemRow}
                  onPress={() => {
                    dispatch(setNotificationSound(snd.value));
                    playSoundPreview(snd.value);
                  }}
                >
                  <Text style={[
                    styles.soundItemText, 
                    { 
                      color: (theme.notificationSound || 'notification.wav') === snd.value ? primaryAccent : colors.textPrimary,
                      fontWeight: (theme.notificationSound || 'notification.wav') === snd.value ? '700' : '500'
                    }
                  ]}>
                    {snd.label}
                  </Text>
                  {(theme.notificationSound || 'notification.wav') === snd.value && (
                    <Text style={{ color: primaryAccent, fontWeight: 'bold' }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={[styles.divider, { backgroundColor: colors.borderColor || '#F0F0F4' }]} />

          {/* Alarm sound */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => {
              setAlarmSoundPickerOpen(!isAlarmSoundPickerOpen);
              if (!isAlarmSoundPickerOpen) setSoundPickerOpen(false);
            }}
            style={styles.cardItemRow}
          >
            <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
              <IconAlarm color={primaryAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                {t('Alarm sound') || 'Alarm sound'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.itemValueText, { color: colors.textSecondary, marginRight: 6 }]}>
                {currentAlarmSoundName}
              </Text>
              <IconChevronRight color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Expanded alarm sound options */}
          {isAlarmSoundPickerOpen && (
            <ScrollView nestedScrollEnabled={true} style={[styles.expandedSubOptions, { maxHeight: 280 }]} showsVerticalScrollIndicator={true}>
              {ALL_SOUND_OPTIONS.map(snd => (
                <TouchableOpacity
                  key={`alarm_${snd.value}`}
                  style={styles.soundItemRow}
                  onPress={() => {
                    dispatch(setAlarmSound(snd.value));
                    playSoundPreview(snd.value);
                  }}
                >
                  <Text style={[
                    styles.soundItemText, 
                    { 
                      color: (theme.alarmSound || 'bass_alarm.mp3') === snd.value ? primaryAccent : colors.textPrimary,
                      fontWeight: (theme.alarmSound || 'bass_alarm.mp3') === snd.value ? '700' : '500'
                    }
                  ]}>
                    {snd.label}
                  </Text>
                  {(theme.alarmSound || 'bass_alarm.mp3') === snd.value && (
                    <Text style={{ color: primaryAccent, fontWeight: 'bold' }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={[styles.divider, { backgroundColor: colors.borderColor || '#F0F0F4' }]} />

          {/* Default snooze */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setSnoozePickerOpen(!isSnoozePickerOpen)}
            style={styles.cardItemRow}
          >
            <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
              <IconClock color={primaryAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                {t('Default Snooze') || 'Default snooze'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.itemValueText, { color: colors.textSecondary, marginRight: 6 }]}>
                {formatSnoozeTime(defaultSnoozeTime)}
              </Text>
              <IconChevronRight color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Expanded snooze options */}
          {isSnoozePickerOpen && (
            <View style={styles.expandedSubOptions}>
              {snoozeOptions.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.soundItemRow}
                  onPress={() => {
                    dispatch(setDefaultSnoozeTime(opt.value));
                    setSnoozePickerOpen(false);
                  }}
                >
                  <Text style={[
                    styles.soundItemText, 
                    { 
                      color: defaultSnoozeTime === opt.value ? primaryAccent : colors.textPrimary,
                      fontWeight: defaultSnoozeTime === opt.value ? '700' : '500'
                    }
                  ]}>
                    {opt.label}
                  </Text>
                  {defaultSnoozeTime === opt.value && (
                    <Text style={{ color: primaryAccent, fontWeight: 'bold' }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Tip Banner Card (matching Image 3 lavender card) */}
        <View style={[styles.tipBannerCard, { backgroundColor: isDark ? 'rgba(93, 69, 219, 0.20)' : 'rgba(93, 69, 219, 0.08)' }]}>
          <View style={styles.tipHeaderRow}>
            <IconInfo color={primaryAccent} size={18} />
            <Text style={[styles.tipTitle, { color: colors.textPrimary, marginLeft: 8 }]}>
              {t('Your day, your rhythm') || 'Your day, your rhythm'}
            </Text>
          </View>
          <Text style={[styles.tipBody, { color: colors.textSecondary }]}>
            {t("Set reminders on individual tasks. You're in control of when they notify you.") || "Set reminders on individual tasks. You're in control of when they notify you."}
          </Text>
        </View>

        {/* More Options / Advanced Card */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginTop: 24 }]}>
          {t('More') || 'More'}
        </Text>

        <View style={[styles.groupedCard, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setAutoManageModalVisible(true)}
            style={styles.cardItemRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                {t('Task Automations & Cleanup') || 'Task Automations & Cleanup'}
              </Text>
            </View>
            <IconChevronRight color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.borderColor || '#F0F0F4' }]} />

          <TouchableOpacity
            testID="settings_debugger_btn"
            activeOpacity={0.75}
            onPress={() => navigation.navigate('DevLogs')}
            style={styles.cardItemRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                {t('Debugger & System Logs') || 'Debugger & System Logs'}
              </Text>
              <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                {t('Diagnose notifications, alarms, scheduler & logs') || 'Diagnose notifications, alarms, scheduler & logs'}
              </Text>
            </View>
            <IconChevronRight color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.borderColor || '#F0F0F4' }]} />

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={handleDeleteData}
            style={styles.cardItemRow}
          >
            <Text style={{ color: '#E53935', fontSize: 15, fontWeight: '600' }}>
              {t('Delete All Data') || 'Delete All Data'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modals */}
      <ThemeSettingsModal
        isVisible={isThemeModalVisible}
        onClose={() => setThemeModalVisible(false)}
      />

      <ChooseLanguageModal
        isVisible={isLanguageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
      />

      <AutoManageSettings
        isVisible={isAutoManageModalVisible}
        onClose={() => setAutoManageModalVisible(false)}
      />

      <PromptModal
        isVisible={pinPromptVisible}
        title={t('Set PIN') || 'Set PIN'}
        message={t('Enter a 4-digit PIN') || 'Enter a 4-digit PIN'}
        defaultValue={theme.appPin || ''}
        onCancel={() => setPinPromptVisible(false)}
        onSubmit={handleSetPin}
        submitText={t('Save') || 'Save'}
        maxLength={4}
        keyboardType="numeric"
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  screenSubtitle: {
    fontSize: 13,
  },
  headerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    marginLeft: 4,
  },
  groupedCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
  },
  itemValueText: {
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginLeft: 68,
  },
  expandedSubOptions: {
    paddingLeft: 68,
    paddingRight: 16,
    paddingBottom: 12,
  },
  subOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  subOptionLabel: {
    fontSize: 13,
  },
  soundItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  soundItemText: {
    fontSize: 14,
  },
  tipBannerCard: {
    borderRadius: 20,
    padding: 16,
    marginTop: 8,
    marginBottom: 10,
  },
  tipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  tipBody: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 26,
  },
});
