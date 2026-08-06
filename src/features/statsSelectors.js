import { createSelector } from '@reduxjs/toolkit';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);

// Base Selectors
const selectTasks = state => state.taskReducer.tasks || [];
const selectDailyStats = state => state.statsReducer.dailyStats || {};
const selectGoals = state => state.statsReducer.goals || [];

// Rebuild daily dataset dynamically incorporating tasks and existing persisted stats
export const selectNormalizedDailyStats = createSelector(
  [selectTasks, selectDailyStats],
  (tasks, persistedStats) => {
    // Start with the incrementally maintained stats to preserve pomodoro/historical data
    const dailyDataset = { ...persistedStats };

    // Deep copy to prevent mutation
    Object.keys(dailyDataset).forEach(key => {
      dailyDataset[key] = { ...dailyDataset[key] };
    });

    // Re-verify tasksCreated and tasksCompleted from actual task list (in case of deletions/edits)
    // Clear out counts that will be recalculated
    Object.keys(dailyDataset).forEach(date => {
      dailyDataset[date].tasksCreated = 0;
      dailyDataset[date].tasksCompleted = 0;
      dailyDataset[date].tasksDue = 0;
      dailyDataset[date].tasksCompletedOnTime = 0;
      dailyDataset[date].tasksCompletedLate = 0;
      dailyDataset[date].overdueTasks = 0;
    });

    const today = dayjs().startOf('day');

    tasks.forEach(task => {
      // 1. Created
      let createdDate = task.createdAt ? dayjs(task.createdAt).format('YYYY-MM-DD') : null;
      if (createdDate) {
        if (!dailyDataset[createdDate]) {
          dailyDataset[createdDate] = { tasksCreated: 0, tasksCompleted: 0, pomodoroSessions: 0, pomodoroMinutes: 0, tasksDue: 0, tasksCompletedOnTime: 0, tasksCompletedLate: 0, overdueTasks: 0 };
        }
        dailyDataset[createdDate].tasksCreated += 1;
      }

      // 2. Due Date handling
      let dueDateStr = null;
      if (task.completionDate) {
        dueDateStr = dayjs(task.completionDate).format('YYYY-MM-DD');
        if (!dailyDataset[dueDateStr]) {
          dailyDataset[dueDateStr] = { tasksCreated: 0, tasksCompleted: 0, pomodoroSessions: 0, pomodoroMinutes: 0, tasksDue: 0, tasksCompletedOnTime: 0, tasksCompletedLate: 0, overdueTasks: 0 };
        }
        dailyDataset[dueDateStr].tasksDue += 1;
      }

      // 3. Completed
      if (task.completed) {
        // If there's no completedAt, fallback to updatedAt or dueDate or createdDate
        let completedDateObj = task.completedAt ? dayjs(task.completedAt) : (task.updatedAt ? dayjs(task.updatedAt) : null);
        
        if (!completedDateObj && dueDateStr && dayjs(dueDateStr).isSameOrBefore(today, 'day')) {
           completedDateObj = dayjs(dueDateStr);
        }

        if (completedDateObj) {
          const completedDateStr = completedDateObj.format('YYYY-MM-DD');
          if (!dailyDataset[completedDateStr]) {
            dailyDataset[completedDateStr] = { tasksCreated: 0, tasksCompleted: 0, pomodoroSessions: 0, pomodoroMinutes: 0, tasksDue: 0, tasksCompletedOnTime: 0, tasksCompletedLate: 0, overdueTasks: 0 };
          }
          dailyDataset[completedDateStr].tasksCompleted += 1;

          if (dueDateStr) {
             if (completedDateObj.isSameOrBefore(dayjs(dueDateStr).endOf('day'))) {
                dailyDataset[completedDateStr].tasksCompletedOnTime += 1;
             } else {
                dailyDataset[completedDateStr].tasksCompletedLate += 1;
             }
          }
        }
      } else {
        // Overdue task logic (Not completed, and past due)
        if (dueDateStr && dayjs(dueDateStr).isBefore(today, 'day')) {
           dailyDataset[dueDateStr].overdueTasks += 1;
        }
      }
    });

    return dailyDataset;
  }
);

// Helper to filter stats by range
const getStatsForRange = (dailyStats, start, end) => {
  const rangeStats = {
    tasksCreated: 0,
    tasksCompleted: 0,
    tasksDue: 0,
    tasksCompletedOnTime: 0,
    tasksCompletedLate: 0,
    overdueTasks: 0,
    pomodoroSessions: 0,
    pomodoroMinutes: 0,
    activeDays: 0,
    totalDays: Math.max(1, end.diff(start, 'day') + 1),
    daysWithCompletions: 0
  };

  let current = dayjs(start);
  while (current.isSameOrBefore(end, 'day')) {
    const key = current.format('YYYY-MM-DD');
    const dayStat = dailyStats[key];
    
    if (dayStat) {
      rangeStats.tasksCreated += dayStat.tasksCreated || 0;
      rangeStats.tasksCompleted += dayStat.tasksCompleted || 0;
      rangeStats.tasksDue += dayStat.tasksDue || 0;
      rangeStats.tasksCompletedOnTime += dayStat.tasksCompletedOnTime || 0;
      rangeStats.tasksCompletedLate += dayStat.tasksCompletedLate || 0;
      rangeStats.overdueTasks += dayStat.overdueTasks || 0;
      rangeStats.pomodoroSessions += dayStat.pomodoroSessions || 0;
      rangeStats.pomodoroMinutes += dayStat.pomodoroMinutes || 0;
      
      const isActive = (dayStat.tasksCompleted > 0) || (dayStat.pomodoroSessions > 0);
      if (isActive) rangeStats.activeDays += 1;
      
      if (dayStat.tasksCompleted > 0) rangeStats.daysWithCompletions += 1;
    }
    current = current.add(1, 'day');
  }

  rangeStats.completionRate = rangeStats.tasksDue > 0 ? (rangeStats.tasksCompleted / Math.max(rangeStats.tasksDue, rangeStats.tasksCreated, 1)) : 0;
  
  return rangeStats;
};

// Weekly Analytics Selector
export const selectWeeklyAnalytics = (date) => createSelector(
  [selectNormalizedDailyStats],
  (dailyStats) => {
    const start = dayjs(date).startOf('week');
    const end = dayjs(date).endOf('week');
    return getStatsForRange(dailyStats, start, end);
  }
);

// Monthly Analytics Selector
export const selectMonthlyAnalytics = (date) => createSelector(
  [selectNormalizedDailyStats],
  (dailyStats) => {
    const start = dayjs(date).startOf('month');
    const end = dayjs(date).endOf('month');
    return getStatsForRange(dailyStats, start, end);
  }
);

// Yearly Analytics Selector
export const selectYearlyAnalytics = (date) => createSelector(
  [selectNormalizedDailyStats],
  (dailyStats) => {
    const start = dayjs(date).startOf('year');
    const end = dayjs(date).endOf('year');
    return getStatsForRange(dailyStats, start, end);
  }
);

// Heat Map Selector (last 12 weeks)
export const selectHeatMapData = createSelector(
  [selectNormalizedDailyStats],
  (dailyStats) => {
    const end = dayjs().endOf('week');
    const start = end.subtract(11, 'week').startOf('week');
    
    const heatMap = [];
    let current = dayjs(start);
    
    while (current.isSameOrBefore(end, 'day')) {
      const key = current.format('YYYY-MM-DD');
      const dayStat = dailyStats[key] || {};
      
      const completed = dayStat.tasksCompleted || 0;
      const minutes = dayStat.pomodoroMinutes || 0;
      const sessions = dayStat.pomodoroSessions || 0;
      
      // Activity formula from specs
      const scoreRaw = completed + Math.min(minutes / 25, 4) + Math.min(sessions, 4);
      
      let intensity = 0;
      if (scoreRaw > 0) intensity = 1;
      if (scoreRaw >= 3) intensity = 2;
      if (scoreRaw >= 6) intensity = 3;
      if (scoreRaw >= 10) intensity = 4;
      
      heatMap.push({
        date: key,
        intensity,
        stats: dayStat
      });
      
      current = current.add(1, 'day');
    }
    
    return heatMap;
  }
);

// Productivity Score Selector (Last 30 days)
export const selectProductivityScore = createSelector(
  [selectNormalizedDailyStats],
  (dailyStats) => {
    const end = dayjs();
    const start = dayjs().subtract(29, 'day');
    
    const rangeStats = getStatsForRange(dailyStats, start, end);
    
    // Weighted formula components
    // A. Completion rate: 35 points
    const completionRateScore = Math.min(35, Math.max(0, rangeStats.completionRate * 35));
    
    // B. On-time completion rate: 25 points
    const tasksWithDueDate = rangeStats.tasksCompletedOnTime + rangeStats.tasksCompletedLate;
    const onTimeRate = tasksWithDueDate > 0 ? (rangeStats.tasksCompletedOnTime / tasksWithDueDate) : 1;
    const onTimeScore = Math.min(25, Math.max(0, onTimeRate * 25));
    
    // C. Focus consistency: 15 points
    const activeFocusDays = Object.keys(dailyStats).filter(k => dayjs(k).isBetween(start, end, 'day', '[]') && (dailyStats[k].pomodoroSessions > 0)).length;
    const focusConsistency = activeFocusDays / rangeStats.totalDays;
    const focusScore = Math.min(15, Math.max(0, focusConsistency * 15));
    
    // D. Task consistency: 15 points
    const taskConsistency = rangeStats.daysWithCompletions / rangeStats.totalDays;
    const taskScore = Math.min(15, Math.max(0, taskConsistency * 15));
    
    // E. Overdue-task control: 10 points
    const overdueRate = rangeStats.tasksDue > 0 ? (rangeStats.overdueTasks / rangeStats.tasksDue) : 0;
    const overdueControl = 1 - Math.min(overdueRate, 1);
    const overdueScore = Math.min(10, Math.max(0, overdueControl * 10));
    
    const totalScore = Math.round(completionRateScore + onTimeScore + focusScore + taskScore + overdueScore);
    
    let label = 'Needs Attention';
    if (totalScore >= 90) label = 'Outstanding';
    else if (totalScore >= 80) label = 'Excellent';
    else if (totalScore >= 70) label = 'Good';
    else if (totalScore >= 55) label = 'Fair';
    
    return {
      score: totalScore,
      label,
      breakdown: {
        completion: { score: Math.round(completionRateScore), max: 35 },
        onTime: { score: Math.round(onTimeScore), max: 25 },
        focus: { score: Math.round(focusScore), max: 15 },
        task: { score: Math.round(taskScore), max: 15 },
        overdue: { score: Math.round(overdueScore), max: 10 },
      },
      hasEnoughData: rangeStats.activeDays >= 3
    };
  }
);

// Streaks Selector
export const selectStreaks = createSelector(
  [selectNormalizedDailyStats],
  (dailyStats) => {
    // Sort all active dates chronologically
    const activeDates = Object.keys(dailyStats)
      .filter(k => (dailyStats[k].tasksCompleted > 0 || dailyStats[k].pomodoroSessions > 0))
      .sort((a, b) => dayjs(a).valueOf() - dayjs(b).valueOf());
      
    if (activeDates.length === 0) {
       return {
         taskStreak: { current: 0, longest: 0 },
         focusStreak: { current: 0, longest: 0 },
         productiveStreak: { current: 0, longest: 0 }
       };
    }

    const calculateStreak = (conditionFn) => {
      let current = 0;
      let longest = 0;
      let temp = 0;
      let lastDate = null;
      
      const dates = Object.keys(dailyStats).sort((a, b) => dayjs(a).valueOf() - dayjs(b).valueOf());
      
      for (const d of dates) {
        if (conditionFn(dailyStats[d])) {
          if (!lastDate || dayjs(d).diff(dayjs(lastDate), 'day') === 1) {
             temp += 1;
          } else {
             temp = 1; // broken streak
          }
          longest = Math.max(longest, temp);
          lastDate = d;
        } else if (lastDate && dayjs(d).diff(dayjs(lastDate), 'day') > 0) {
          temp = 0;
        }
      }
      
      // Calculate active current streak
      const today = dayjs().format('YYYY-MM-DD');
      const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
      
      if (lastDate === today) {
         current = temp;
      } else if (lastDate === yesterday) {
         current = temp; // preserved until today ends
      } else {
         current = 0;
      }
      
      return { current, longest };
    };

    return {
      taskStreak: calculateStreak((day) => (day.tasksCompleted > 0)),
      focusStreak: calculateStreak((day) => (day.pomodoroSessions > 0 || day.pomodoroMinutes >= 10)),
      productiveStreak: calculateStreak((day) => (day.tasksCompleted > 0 && (day.pomodoroSessions > 0 || day.pomodoroMinutes >= 10))),
    };
  }
);
