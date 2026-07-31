import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice } from '@reduxjs/toolkit';

const loadThemeState = () => undefined;

const loaded = loadThemeState();
const initialState = {
  colors: loaded?.colors || {
    sidebarBg: null,
    mainBg: null,
    textColor: null
  },
  fontSize: loaded?.fontSize || 'normal', // 'small', 'normal', 'big'
  columnWidths: loaded?.columnWidths || {
    taskName: 55,
    dueDate: 15,
    priority: 10
  },
  defaultTaskLimit: loaded?.defaultTaskLimit !== undefined ? loaded.defaultTaskLimit : 10,
  isSettingsOpen: false,
  dateFormat: loaded?.dateFormat || 'short',
  taskNameWrap: loaded?.taskNameWrap || 'wrap',
  timeFormat: loaded?.timeFormat || '12h',
  userPicture: loaded?.userPicture || null,
  headerBackgroundFit: loaded?.headerBackgroundFit || 'cover',
  sourceColor: loaded?.sourceColor || '#6750A4',
  themeMode: loaded?.themeMode || 'dark',
  calendarPanePosition: loaded?.calendarPanePosition || null,
  progressMode: loaded?.progressMode || 'daily',
  defaultSnoozeTime: loaded?.defaultSnoozeTime || 30,
  isBoardsCollapsed: loaded?.isBoardsCollapsed || false,
  
  // Auto-Manage settings
  autoTransferMode: loaded?.autoTransferMode || 'none', // 'none', 'today', 'tomorrow', 'next_workday'
  increasePriorityWhenOverdue: loaded?.increasePriorityWhenOverdue || false,
  priorityFrequency: loaded?.priorityFrequency || 'never', // 'daily', 'weekly', 'never'
  removePriorityWhenCompleted: loaded?.removePriorityWhenCompleted || false,
  autoDeleteOverdueDays: loaded?.autoDeleteOverdueDays !== undefined ? loaded.autoDeleteOverdueDays : 0,
  autoDeleteCompletedDays: loaded?.autoDeleteCompletedDays !== undefined ? loaded.autoDeleteCompletedDays : 0,
  confirmBeforeDeletion: loaded?.confirmBeforeDeletion !== undefined ? loaded.confirmBeforeDeletion : true,
  
  // Reminders
  morningReminder: loaded?.morningReminder || false,
  morningReminderTime: loaded?.morningReminderTime || '08:00',
  eveningReminder: loaded?.eveningReminder || false,
  eveningReminderTime: loaded?.eveningReminderTime || '20:00',
  summaryReminder: loaded?.summaryReminder || false,
  summaryReminderTime: loaded?.summaryReminderTime || '09:00',
  
  // Notification Settings
  alarmSound: loaded?.alarmSound || 'bass_alarm.mp3',
  notificationSound: loaded?.notificationSound || 'notification.wav',
  vibrationEnabled: loaded?.vibrationEnabled !== undefined ? loaded.vibrationEnabled : true,
  
  // Security
  appPin: loaded?.appPin || null
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    hydrateThemeState: (state, action) => {
      return { ...state, ...action.payload };
    },
    setThemeColor: (state, action) => {
      const { key, value } = action.payload;
      state.colors[key] = value;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setFontSize: (state, action) => {
      state.fontSize = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setSourceColor: (state, action) => {
      state.sourceColor = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setThemeMode: (state, action) => {
      state.themeMode = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setColumnWidth: (state, action) => {
      const { key, value } = action.payload;
      state.columnWidths[key] = value;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    toggleSettingsOpen: (state, action) => {
      if (action.payload !== undefined) {
        state.isSettingsOpen = action.payload;
      } else {
        state.isSettingsOpen = !state.isSettingsOpen;
      }
    },
    setAppPin: (state, action) => {
      state.appPin = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setAlarmSound: (state, action) => {
      state.alarmSound = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setNotificationSound: (state, action) => {
      state.notificationSound = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setVibrationEnabled: (state, action) => {
      state.vibrationEnabled = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    resetTheme: (state) => {
      state.colors = {
        sidebarBg: null,
        mainBg: null,
        textColor: null
      };
      state.fontSize = 'normal';
      state.columnWidths = {
        taskName: 55,
        dueDate: 15,
        priority: 10
      };
      state.defaultTaskLimit = 10;
      state.dateFormat = 'short';
      state.taskNameWrap = 'wrap';
      state.timeFormat = '12h';
      state.sourceColor = '#6750A4';
      state.themeMode = 'dark';
      state.userPicture = null;
      state.headerBackgroundFit = 'cover';
      state.calendarPanePosition = null;
      state.progressMode = 'daily';
      state.defaultSnoozeTime = 30;
      state.isBoardsCollapsed = false;
      
      // Reset auto-manage settings
      state.autoTransferMode = 'none';
      state.increasePriorityWhenOverdue = false;
      state.priorityFrequency = 'never';
      state.removePriorityWhenCompleted = false;
      state.autoDeleteOverdueDays = 0;
      state.autoDeleteCompletedDays = 0;
      state.confirmBeforeDeletion = true;
      state.morningReminder = false;
      state.morningReminderTime = '08:00';
      state.eveningReminder = false;
      state.eveningReminderTime = '20:00';
      state.summaryReminder = false;
      state.summaryReminderTime = '09:00';

      AsyncStorage.removeItem('customTheme');
    },
    setDefaultTaskLimit: (state, action) => {
      state.defaultTaskLimit = Math.max(1, Number(action.payload) || 1);
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setDateFormat: (state, action) => {
      state.dateFormat = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setTaskNameWrap: (state, action) => {
      state.taskNameWrap = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setTimeFormat: (state, action) => {
      state.timeFormat = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setUserPicture: (state, action) => {
      state.userPicture = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setHeaderBackgroundFit: (state, action) => {
      state.headerBackgroundFit = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setCalendarPanePosition: (state, action) => {
      state.calendarPanePosition = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setProgressMode: (state, action) => {
      state.progressMode = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setDefaultSnoozeTime: (state, action) => {
      state.defaultSnoozeTime = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setAutoManageSettings: (state, action) => {
      Object.keys(action.payload).forEach(key => {
        state[key] = action.payload[key];
      });
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    },
    setBoardsCollapsed: (state, action) => {
      state.isBoardsCollapsed = action.payload;
      AsyncStorage.setItem('customTheme', JSON.stringify(state));
    }
  }
});

export const {
  hydrateThemeState, setThemeColor, setFontSize, setSourceColor, setThemeMode, setColumnWidth, toggleSettingsOpen, resetTheme,
  setUserPicture, setHeaderBackgroundFit, setCalendarPanePosition, setProgressMode, setDefaultSnoozeTime,
  setAutoManageSettings, setBoardsCollapsed, setAppPin, setAlarmSound, setNotificationSound, setVibrationEnabled,
  setDefaultTaskLimit, setDateFormat, setTaskNameWrap, setTimeFormat
} = themeSlice.actions;

export default themeSlice.reducer;
