import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice } from '@reduxjs/toolkit';
import dayjs from 'dayjs';

const initialState = {
  dailyStats: {}, // { 'YYYY-MM-DD': { tasksCreated: 0, tasksCompleted: 0, pomodoroSessions: 0, pomodoroMinutes: 0 } }
};

export const statsSlice = createSlice({
  name: 'stats',
  initialState,
  reducers: {
    hydrateStatsState: (state, action) => {
      state.dailyStats = action.payload || {};
    },
    recordTaskCreated: (state) => {
      const today = dayjs().format('YYYY-MM-DD');
      if (!state.dailyStats[today]) state.dailyStats[today] = { tasksCreated: 0, tasksCompleted: 0, pomodoroSessions: 0, pomodoroMinutes: 0 };
      state.dailyStats[today].tasksCreated = (state.dailyStats[today].tasksCreated || 0) + 1;
      AsyncStorage.setItem('stats', JSON.stringify(state.dailyStats));
    },
    recordTaskCompleted: (state) => {
      const today = dayjs().format('YYYY-MM-DD');
      if (!state.dailyStats[today]) state.dailyStats[today] = { tasksCreated: 0, tasksCompleted: 0, pomodoroSessions: 0, pomodoroMinutes: 0 };
      state.dailyStats[today].tasksCompleted = (state.dailyStats[today].tasksCompleted || 0) + 1;
      AsyncStorage.setItem('stats', JSON.stringify(state.dailyStats));
    },
    recordPomodoroSession: (state, action) => {
      const today = dayjs().format('YYYY-MM-DD');
      const minutes = action.payload || 25; // default 25 if not passed
      if (!state.dailyStats[today]) state.dailyStats[today] = { tasksCreated: 0, tasksCompleted: 0, pomodoroSessions: 0, pomodoroMinutes: 0 };
      state.dailyStats[today].pomodoroSessions = (state.dailyStats[today].pomodoroSessions || 0) + 1;
      state.dailyStats[today].pomodoroMinutes = (state.dailyStats[today].pomodoroMinutes || 0) + minutes;
      AsyncStorage.setItem('stats', JSON.stringify(state.dailyStats));
    },
    clearStats: (state) => {
      state.dailyStats = {};
      AsyncStorage.removeItem('stats');
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase('task/addTaskSync', (state) => {
        const today = dayjs().format('YYYY-MM-DD');
        if (!state.dailyStats[today]) state.dailyStats[today] = { tasksCreated: 0, tasksCompleted: 0, pomodoroSessions: 0, pomodoroMinutes: 0 };
        state.dailyStats[today].tasksCreated = (state.dailyStats[today].tasksCreated || 0) + 1;
        AsyncStorage.setItem('stats', JSON.stringify(state.dailyStats));
      })
      .addCase('task/updateTaskSync', (state, action) => {
        // Only count as completed if the payload explicitly sets completed to true
        if (action.payload && action.payload.completed === true) {
          const today = dayjs().format('YYYY-MM-DD');
          if (!state.dailyStats[today]) state.dailyStats[today] = { tasksCreated: 0, tasksCompleted: 0, pomodoroSessions: 0, pomodoroMinutes: 0 };
          state.dailyStats[today].tasksCompleted = (state.dailyStats[today].tasksCompleted || 0) + 1;
          AsyncStorage.setItem('stats', JSON.stringify(state.dailyStats));
        }
      })
      .addCase('pomodoro/completeWorkInterval', (state, action) => {
        const today = dayjs().format('YYYY-MM-DD');
        // action.payload should be the initial time in seconds
        const seconds = typeof action.payload === 'number' ? action.payload : 25 * 60;
        const minutes = Math.max(1, Math.round(seconds / 60));  
        if (!state.dailyStats[today]) state.dailyStats[today] = { tasksCreated: 0, tasksCompleted: 0, pomodoroSessions: 0, pomodoroMinutes: 0 };
        state.dailyStats[today].pomodoroSessions = (state.dailyStats[today].pomodoroSessions || 0) + 1;
        state.dailyStats[today].pomodoroMinutes = (state.dailyStats[today].pomodoroMinutes || 0) + minutes;
        AsyncStorage.setItem('stats', JSON.stringify(state.dailyStats));
      });
  }
});

export const { hydrateStatsState, recordTaskCreated, recordTaskCompleted, recordPomodoroSession, clearStats } = statsSlice.actions;

export default statsSlice.reducer;
