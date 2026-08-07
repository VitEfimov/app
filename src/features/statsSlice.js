import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice } from '@reduxjs/toolkit';
import dayjs from 'dayjs';

const initialState = {
  dailyStats: {}, // { 'YYYY-MM-DD': { tasksCreated: 0, tasksCompleted: 0, pomodoroSessions: 0, pomodoroMinutes: 0 } }
  goals: [],
  selectedRange: 'week',
  selectedMetric: 'completed',
  selectedDate: dayjs().format('YYYY-MM-DD'),
};

export const statsSlice = createSlice({
  name: 'stats',
  initialState,
  reducers: {
    hydrateStatsState: (state, action) => {
      state.dailyStats = action.payload?.dailyStats || action.payload || {};
      state.goals = action.payload?.goals || [];
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
      state.goals = [];
      AsyncStorage.removeItem('stats');
    },
    addGoal: (state, action) => {
      state.goals.push(action.payload);
      AsyncStorage.setItem('stats', JSON.stringify({ dailyStats: state.dailyStats, goals: state.goals }));
    },
    updateGoal: (state, action) => {
      const index = state.goals.findIndex(g => g.id === action.payload.id);
      if (index !== -1) {
        state.goals[index] = action.payload;
        AsyncStorage.setItem('stats', JSON.stringify({ dailyStats: state.dailyStats, goals: state.goals }));
      }
    },
    deleteGoal: (state, action) => {
      state.goals = state.goals.filter(g => g.id !== action.payload);
      AsyncStorage.setItem('stats', JSON.stringify({ dailyStats: state.dailyStats, goals: state.goals }));
    },
    setSelectedRange: (state, action) => {
      state.selectedRange = action.payload;
    },
    setSelectedMetric: (state, action) => {
      state.selectedMetric = action.payload;
    },
    setSelectedDate: (state, action) => {
      state.selectedDate = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase('task/addTaskSync', (state, action) => {
        if (action.payload && action.payload.isUndo) return; // Undo delete shouldn't count as creation
        const today = dayjs().format('YYYY-MM-DD');
        if (!state.dailyStats[today]) state.dailyStats[today] = { tasksCreated: 0, tasksCompleted: 0, pomodoroSessions: 0, pomodoroMinutes: 0 };
        state.dailyStats[today].tasksCreated = (state.dailyStats[today].tasksCreated || 0) + 1;
        AsyncStorage.setItem('stats', JSON.stringify(state.dailyStats));
      })
      .addCase('task/updateTaskSync', (state, action) => {
        if (action.payload && action.payload.completed === true) {
          const today = dayjs().format('YYYY-MM-DD');
          if (!state.dailyStats[today]) state.dailyStats[today] = { tasksCreated: 0, tasksCompleted: 0, pomodoroSessions: 0, pomodoroMinutes: 0 };
          state.dailyStats[today].tasksCompleted = (state.dailyStats[today].tasksCompleted || 0) + 1;
          AsyncStorage.setItem('stats', JSON.stringify(state.dailyStats));
        } else if (action.payload && action.payload.completed === false) {
          const today = dayjs().format('YYYY-MM-DD');
          if (state.dailyStats[today] && state.dailyStats[today].tasksCompleted > 0) {
            state.dailyStats[today].tasksCompleted -= 1;
            AsyncStorage.setItem('stats', JSON.stringify(state.dailyStats));
          }
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

export const { 
  hydrateStatsState, 
  recordTaskCreated, 
  recordTaskCompleted, 
  recordPomodoroSession, 
  clearStats,
  addGoal,
  updateGoal,
  deleteGoal,
  setSelectedRange,
  setSelectedMetric,
  setSelectedDate
} = statsSlice.actions;

export default statsSlice.reducer;
