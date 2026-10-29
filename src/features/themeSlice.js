import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice } from '@reduxjs/toolkit';

const loadThemeState = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem('customTheme');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
  }
  return undefined;
};

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
  themeMode: loaded?.themeMode || 'light',
  calendarPanePosition: loaded?.calendarPanePosition || null,
  progressMode: loaded?.progressMode || 'daily',
  defaultSnoozeTime: loaded?.defaultSnoozeTime || 30,
  autoRescheduleTime: loaded?.autoRescheduleTime || '23:59',
  isBoardsCollapsed: loaded?.isBoardsCollapsed || false,
  randomColorDaily: loaded?.randomColorDaily || false,
  lastRandomColorDate: loaded?.lastRandomColorDate || null,
  showRecurringTasksOnBoard: loaded?.showRecurringTasksOnBoard !== undefined ? loaded.showRecurringTasksOnBoard : false,
  
  // Auto-Manage settings
  autoTransferMode: loaded?.autoTransferMode || 'none', // 'none', 'today', 'tomorrow', 'next_workday'
  increasePriorityWhenOverdue: loaded?.increasePriorityWhenOverdue || false,
  priorityFrequency: loaded?.priorityFrequency || 'never', // 'daily', 'weekly', 'never'
  removePriorityWhenCompleted: loaded?.removePriorityWhenCompleted || false,
  autoDeleteOverdueDays: loaded?.autoDeleteOverdueDays !== undefined ? loaded.autoDeleteOverdueDays : 0,
  autoDeleteCompletedDays: loaded?.autoDeleteCompletedDays !== undefined ? loaded.autoDeleteCompletedDays : 0,
  confirmBeforeDeletion: loaded?.confirmBeforeDeletion !== undefined ? loaded.confirmBeforeDeletion : true,
  rescheduleTransferredReminders: loaded?.rescheduleTransferredReminders !== undefined ? loaded.rescheduleTransferredReminders : true,
  
  // Reminders
  morningReminder: loaded?.morningReminder || false,
  morningReminderTime: loaded?.morningReminderTime || '08:00',
  eveningReminder: loaded?.eveningReminder || false,
  eveningReminderTime: loaded?.eveningReminderTime || '20:00',
  summaryReminder: loaded?.summaryReminder || false,
  summaryReminderTime: loaded?.summaryReminderTime || '09:00',
  
  // Notification Settings
  alarmPresentationStyle: loaded?.alarmPresentationStyle || 'fullscreen', // 'fullscreen', 'popup', 'adaptive'
  alarmSound: loaded?.alarmSound || 'bass_alarm.mp3',
  notificationSound: loaded?.notificationSound || 'notification.wav',
  vibrationEnabled: loaded?.vibrationEnabled !== undefined ? loaded.vibrationEnabled : true,
  androidAutoEnabled: loaded?.androidAutoEnabled !== undefined ? loaded.androidAutoEnabled : true,
  
  // Security
  appPin: loaded?.appPin || null,

  // Default Reminder Settings for New Tasks
  defaultReminderEnabled: loaded?.defaultReminderEnabled || false,
  defaultReminderTime: loaded?.defaultReminderTime || '15 min before',

  // DB Sync
  dbSyncEnabled: loaded?.dbSyncEnabled !== undefined ? loaded.dbSyncEnabled : true,

  // Calendar Sync (expo-calendar)
  calendarSyncEnabled: loaded?.calendarSyncEnabled || false,
  calendarAlarmsEnabled: loaded?.calendarAlarmsEnabled || false,
  selectedCalendarId: loaded?.selectedCalendarId || null,

  // Per-Board Automations Map
  boardAutomations: loaded?.boardAutomations || {},

  // Navigation & Drawer
  isGoogleDrawerOpen: false,
  jumpToTodayTrigger: 0
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setGoogleDrawerOpen: (state, action) => {
      state.isGoogleDrawerOpen = action.payload;
    },
    triggerJumpToToday: (state) => {
      state.jumpToTodayTrigger = Date.now();
    },
    hydrateThemeState: (state, action) => {
      return { ...state, ...action.payload };
    },
    setThemeColor: (state, action) => {
      const { key, value } = action.payload;
      state.colors[key] = value;
    },
    setFontSize: (state, action) => {
      state.fontSize = action.payload;
    },
    setSourceColor: (state, action) => {
      state.sourceColor = action.payload;
    },
    setThemeMode: (state, action) => {
      state.themeMode = action.payload;
    },
    setColumnWidth: (state, action) => {
      const { key, value } = action.payload;
      state.columnWidths[key] = value;
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
    },
    setAlarmSound: (state, action) => {
      state.alarmSound = action.payload;
    },
    setAlarmPresentationStyle: (state, action) => {
      state.alarmPresentationStyle = action.payload;
    },
    setNotificationSound: (state, action) => {
      state.notificationSound = action.payload;
    },
    setVibrationEnabled: (state, action) => {
      state.vibrationEnabled = action.payload;
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
      state.themeMode = 'system';
      state.userPicture = null;
      state.headerBackgroundFit = 'cover';
      state.calendarPanePosition = null;
      state.progressMode = 'daily';
      state.defaultSnoozeTime = 30;
      state.autoRescheduleTime = '09:00';
      state.isBoardsCollapsed = false;
      state.randomColorDaily = false;
      state.lastRandomColorDate = null;
      state.showRecurringTasksOnBoard = false;
      
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
    },
    setDateFormat: (state, action) => {
      state.dateFormat = action.payload;
    },
    setTaskNameWrap: (state, action) => {
      state.taskNameWrap = action.payload;
    },
    setTimeFormat: (state, action) => {
      state.timeFormat = action.payload;
    },
    setUserPicture: (state, action) => {
      state.userPicture = action.payload;
    },
    setHeaderBackgroundFit: (state, action) => {
      state.headerBackgroundFit = action.payload;
    },
    setCalendarPanePosition: (state, action) => {
      state.calendarPanePosition = action.payload;
    },
    setProgressMode: (state, action) => {
      state.progressMode = action.payload;
    },
    setDefaultSnoozeTime: (state, action) => {
      state.defaultSnoozeTime = action.payload;
    },
    setAutoRescheduleTime: (state, action) => {
      state.autoRescheduleTime = action.payload;
    },
    setAutoManageSettings: (state, action) => {
      Object.keys(action.payload).forEach(key => {
        state[key] = action.payload[key];
      });
    },
    setBoardAutoManageSettings: (state, action) => {
      const { boardId, settings } = action.payload;
      if (!state.boardAutomations) {
        state.boardAutomations = {};
      }
      state.boardAutomations[boardId] = settings;
    },
    removeBoardAutoManageSettings: (state, action) => {
      const { boardId } = action.payload;
      if (state.boardAutomations && state.boardAutomations[boardId]) {
        delete state.boardAutomations[boardId];
      }
    },
    setBoardsCollapsed: (state, action) => {
      state.isBoardsCollapsed = action.payload;
    },
    setRandomColorDaily: (state, action) => {
      state.randomColorDaily = action.payload;
    },
    setLastRandomColorDate: (state, action) => {
      state.lastRandomColorDate = action.payload;
    },
    setShowRecurringTasksOnBoard: (state, action) => {
      state.showRecurringTasksOnBoard = action.payload;
    },
    setAndroidAutoEnabled: (state, action) => {
      state.androidAutoEnabled = action.payload;
    },
    setDefaultReminderEnabled: (state, action) => {
      state.defaultReminderEnabled = action.payload;
    },
    setDefaultReminderTime: (state, action) => {
      state.defaultReminderTime = action.payload;
    },
    setDbSyncEnabled: (state, action) => {
      state.dbSyncEnabled = action.payload;
    },
    setCalendarSyncEnabled: (state, action) => {
      state.calendarSyncEnabled = action.payload;
    },
    setCalendarAlarmsEnabled: (state, action) => {
      state.calendarAlarmsEnabled = action.payload;
    },
    setSelectedCalendarId: (state, action) => {
      state.selectedCalendarId = action.payload;
    }
  }
});

let saveThemeTimeout = null;
let lastThemeToSave = null;

const sanitizeThemeForStorage = (themeState) => {
  if (!themeState) return null;
  const { isSettingsOpen, isGoogleDrawerOpen, jumpToTodayTrigger, ...persisted } = themeState;
  return persisted;
};

export const persistThemeToStorage = (themeState) => {
  lastThemeToSave = themeState;
  if (saveThemeTimeout) {
    clearTimeout(saveThemeTimeout);
  }
  saveThemeTimeout = setTimeout(async () => {
    try {
      const clean = sanitizeThemeForStorage(lastThemeToSave);
      if (clean) {
        await AsyncStorage.setItem('customTheme', JSON.stringify(clean));
      }
    } catch (e) {
      console.error('Error saving theme to AsyncStorage:', e);
    }
  }, 300);
};

export const flushPendingThemeSaves = async (getState) => {
  if (saveThemeTimeout) {
    clearTimeout(saveThemeTimeout);
    saveThemeTimeout = null;
  }
  try {
    const raw = getState ? getState().themeReducer : lastThemeToSave;
    const clean = sanitizeThemeForStorage(raw);
    if (clean) {
      await AsyncStorage.setItem('customTheme', JSON.stringify(clean));
    }
  } catch (e) {
    console.error('Error flushing theme to storage:', e);
  }
};

export const {
  hydrateThemeState, setThemeColor, setFontSize, setSourceColor, setThemeMode, setColumnWidth, toggleSettingsOpen, resetTheme,
  setUserPicture, setHeaderBackgroundFit, setCalendarPanePosition, setProgressMode, setDefaultSnoozeTime, setAutoRescheduleTime,
  setAutoManageSettings, setBoardAutoManageSettings, removeBoardAutoManageSettings, setBoardsCollapsed, setAppPin, setAlarmSound, setAlarmPresentationStyle, setNotificationSound, setVibrationEnabled,
  setDefaultTaskLimit, setDateFormat, setTaskNameWrap, setTimeFormat, setRandomColorDaily, setLastRandomColorDate,
  setShowRecurringTasksOnBoard, setAndroidAutoEnabled, setDefaultReminderEnabled, setDefaultReminderTime, setDbSyncEnabled,
  setCalendarSyncEnabled, setCalendarAlarmsEnabled, setSelectedCalendarId,
  setGoogleDrawerOpen, triggerJumpToToday
} = themeSlice.actions;

export default themeSlice.reducer;
