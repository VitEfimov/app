import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice } from '@reduxjs/toolkit';

const DEFAULT_WORK_TIME = 25 * 60; // 25 minutes in seconds
const DEFAULT_BREAK_TIME = 5 * 60; // 5 minutes in seconds

const loadFromLocalStoragePomodoro = () => {
  return [{
    time: 25 * 60,
    initialTime: 25 * 60,
    isActive: false,
    isBreak: false,
    breakInterval: 5 * 60,
    intervalCount: { count: 5, progress: 0, passed: 0 },
    workSound: 'default',
    breakSound: 'default',
    isSettingsOpen: false,
    targetEndTime: null,
  }];
};

const initialState = {
  pomodoro: loadFromLocalStoragePomodoro(),
  loading: false,
  error: null,
};

export const pomodoroSlice = createSlice({
  name: 'pomodoro',
  initialState,
  reducers: {
    hydratePomodoroState: (state, action) => {
      const payload = action.payload;
      if (payload && payload[0]) {
        const p = payload[0];
        if (p.breakInterval === undefined) {
          p.breakInterval = 5 * 60; // default to 5 minutes
        }
        if (p.initialTime === undefined) {
          p.initialTime = 25 * 60;
        }
        if (typeof p.intervalCount !== 'object' || p.intervalCount === null) {
          const count = parseInt(p.intervalCount, 10) || 5;
          p.intervalCount = { count, progress: 0, passed: 0 };
        }
        // Check if timer was running when app was closed/suspended
        if (p.isActive && p.targetEndTime) {
          const remaining = Math.round((p.targetEndTime - Date.now()) / 1000);
          if (remaining > 0) {
            p.time = remaining;
          } else {
            p.time = 0;
            p.isActive = false;
            p.targetEndTime = null;
          }
        } else if (p.isActive && !p.targetEndTime) {
          p.isActive = false;
        }
        if (p.isBreak && !p.time) {
          p.time = p.breakInterval;
        }
      }
      state.pomodoro = payload;
    },
    startTimer: (state, action) => {
      const p = state.pomodoro[0];
      p.isActive = true;
      p.targetEndTime = (action && action.payload && action.payload.targetEndTime)
        ? action.payload.targetEndTime
        : (Date.now() + (p.time * 1000));
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    pauseTimer: (state) => {
      const p = state.pomodoro[0];
      if (p.isActive && p.targetEndTime) {
        p.time = Math.max(0, Math.round((p.targetEndTime - Date.now()) / 1000));
      }
      p.isActive = false;
      p.targetEndTime = null;
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    resetTimer: (state) => {
      const p = state.pomodoro[0];
      p.isActive = false;
      p.targetEndTime = null;
      p.isBreak = false;
      p.time = p.initialTime || 25 * 60;
      const currentCount = typeof p.intervalCount === 'object' ? (p.intervalCount.count || 5) : 5;
      p.intervalCount = {
        count: currentCount,
        progress: 0,
        passed: 0,
      };

      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    tickTimer: (state, action) => {
      const p = state.pomodoro[0];
      if (!p) return;
      const newTime = typeof action.payload === 'number' ? action.payload : action.payload?.time;
      if (typeof newTime === 'number') {
        p.time = Math.max(0, newTime);
        const initial = p.isBreak ? (p.breakInterval || 300) : (p.initialTime || 1500);
        if (typeof p.intervalCount !== 'object' || p.intervalCount === null) {
          p.intervalCount = { count: 5, progress: 0, passed: 0 };
        }
        p.intervalCount.progress =
          100 - Math.round((p.time / Math.max(1, initial)) * 100);
      }
    },
    updateTime: (state, action) => {
      const p = state.pomodoro[0];
      p.time = action.payload;

      const initial = p.initialTime || 1500;
      if (typeof p.intervalCount !== 'object' || p.intervalCount === null) {
        p.intervalCount = { count: 5, progress: 0, passed: 0 };
      }
      p.intervalCount.progress =
        100 - Math.round((action.payload / Math.max(1, initial)) * 100);

      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    toggleBreak: (state) => {
      const p = state.pomodoro[0];
      p.isActive = false;
      p.targetEndTime = null;
      p.isBreak = !p.isBreak;
      if (p.isBreak) {
        p.time = p.breakInterval || 300;
      } else {
        p.time = p.initialTime || 1500;
      }
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    togglePomodoroSettings: (state, action) => {
      state.isSettingsOpen = action.payload;
    },
    updatePomodoroSettings: (state, action) => {
      const { workTime, breakTime, intervalCount, workSound, breakSound } = action.payload;
      const p = state.pomodoro[0];
      if (!p) return;

      if (workTime !== undefined) {
        p.initialTime = workTime;
      }
      if (breakTime !== undefined) {
        p.breakInterval = breakTime;
      }
      if (intervalCount !== undefined) {
        const currentPassed = typeof p.intervalCount === 'object' ? (p.intervalCount.passed || 0) : 0;
        p.intervalCount = {
          count: intervalCount,
          progress: 0,
          passed: Math.min(currentPassed, intervalCount),
        };
      }
      if (workSound !== undefined) p.workSound = workSound;
      if (breakSound !== undefined) p.breakSound = breakSound;

      p.isActive = false;
      if (p.isBreak) {
        p.time = p.breakInterval || 300;
      } else {
        p.time = p.initialTime || 1500;
      }

      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    setBreakInterval: (state, action) => {
      const breakTimeInSeconds = action.payload;
      state.pomodoro[0].breakInterval = breakTimeInSeconds;
      state.pomodoro[0].isActive = false;
      if (state.pomodoro[0].isBreak) {
        state.pomodoro[0].time = breakTimeInSeconds;
      }
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    setIntervalCount: (state, action) => {
      const currentPassed = typeof state.pomodoro[0].intervalCount === 'object' ? (state.pomodoro[0].intervalCount.passed || 0) : 0;
      state.pomodoro[0].intervalCount = {
        count: action.payload,
        progress: 0,
        passed: Math.min(currentPassed, action.payload),
      };
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    setInitialTime: (state, action) => {
      state.pomodoro[0].initialTime = action.payload;
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    setTime: (state, action) => {
      const workTimeInSeconds = action.payload;
      state.pomodoro[0].initialTime = workTimeInSeconds;
      state.pomodoro[0].isActive = false;
      if (!state.pomodoro[0].isBreak) {
        state.pomodoro[0].time = workTimeInSeconds;
      }
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    completeWorkInterval: (state) => {
      const p = state.pomodoro[0];
      if (typeof p.intervalCount !== 'object' || p.intervalCount === null) {
        p.intervalCount = {
          count: 5,
          progress: 0,
          passed: 0,
        };
      }

      if (p.intervalCount.passed < p.intervalCount.count) {
        p.intervalCount.passed += 1;
      }
      p.isBreak = true;
      p.isActive = false;
      p.targetEndTime = null;
      p.time = p.breakInterval || 300;
      p.intervalCount.progress = 0;
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    completeBreakInterval: (state) => {
      const p = state.pomodoro[0];
      p.isBreak = false;
      p.isActive = false;
      p.targetEndTime = null;
      p.time = p.initialTime || 1500;
      if (typeof p.intervalCount === 'object' && p.intervalCount !== null) {
        p.intervalCount.progress = 0;
      }
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    setWorkSound: (state, action) => {
      state.pomodoro[0].workSound = action.payload;
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    setBreakSound: (state, action) => {
      state.pomodoro[0].breakSound = action.payload;
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
  },
});

export const { hydratePomodoroState,
  startTimer,
  pauseTimer,
  resetTimer,
  tickTimer,
  updateTime,
  toggleBreak,
  updatePomodoroSettings,
  setBreakInterval,
  setIntervalCount,
  setTime,
  setInitialTime,
  completeWorkInterval,
  completeBreakInterval,
  setWorkSound,
  setBreakSound,
  togglePomodoroSettings,
} = pomodoroSlice.actions;

export default pomodoroSlice.reducer;
