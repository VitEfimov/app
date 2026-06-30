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
  calendarPanePosition: loaded?.calendarPanePosition || null
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
    }
  }
});

export const { hydrateThemeState, setThemeColor, setFontSize, setColumnWidth, toggleSettingsOpen, resetTheme, setDefaultTaskLimit, setDateFormat, setTaskNameWrap, setTimeFormat, setUserPicture, setHeaderBackgroundFit, setSourceColor, setThemeMode, setCalendarPanePosition } = themeSlice.actions;
export default themeSlice.reducer;
