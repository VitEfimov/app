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
        if (payload[0].breakInterval === undefined) {
          payload[0].breakInterval = 5 * 60; // default to 5 minutes
        }
        if (payload[0].initialTime === undefined) {
          payload[0].initialTime = 25 * 60;
        }
        if (typeof payload[0].intervalCount !== 'object' || payload[0].intervalCount === null) {
          const count = parseInt(payload[0].intervalCount, 10) || 5;
          payload[0].intervalCount = { count, progress: 0, passed: 0 };
        }
        if (payload[0].isBreak && !payload[0].time) {
          payload[0].time = payload[0].breakInterval;
        }
      }
      state.pomodoro = payload;
    },
    startTimer: (state) => {
      state.pomodoro[0].isActive = true;
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    pauseTimer: (state) => {
      state.pomodoro[0].isActive = false;
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    resetTimer: (state) => {
      const p = state.pomodoro[0];
      p.isActive = false;
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
    updateTime: (state, action) => {
      state.pomodoro[0].time = action.payload;

      const initial = state.pomodoro[0].initialTime || 1500;
      if (typeof state.pomodoro[0].intervalCount !== 'object' || state.pomodoro[0].intervalCount === null) {
        state.pomodoro[0].intervalCount = { count: 5, progress: 0, passed: 0 };
      }
      state.pomodoro[0].intervalCount.progress =
        100 - Math.round((action.payload / Math.max(1, initial)) * 100);

      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    toggleBreak: (state) => {
      state.pomodoro[0].isBreak = !state.pomodoro[0].isBreak;
      if (state.pomodoro[0].isBreak) {
        state.pomodoro[0].time = state.pomodoro[0].breakInterval || 300;
      } else {
        state.pomodoro[0].time = state.pomodoro[0].initialTime || 1500;
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
      if (typeof state.pomodoro[0].intervalCount !== 'object' || state.pomodoro[0].intervalCount === null) {
        state.pomodoro[0].intervalCount = {
          count: 5,
          progress: 0,
          passed: 0,
        };
      }

      if (state.pomodoro[0].intervalCount.passed < state.pomodoro[0].intervalCount.count) {
        state.pomodoro[0].intervalCount.passed += 1;
        state.pomodoro[0].isBreak = true;
        state.pomodoro[0].time = state.pomodoro[0].breakInterval || 300;
      }
      AsyncStorage.setItem('pomodoro', JSON.stringify(state.pomodoro));
    },
    completeBreakInterval: (state) => {
      state.pomodoro[0].isBreak = false;
      state.pomodoro[0].time = state.pomodoro[0].initialTime || 1500;
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
