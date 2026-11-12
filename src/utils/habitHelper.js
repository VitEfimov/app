import dayjs from 'dayjs';

export const HABIT_SCHEDULE_PRESETS = ['daily', 'weekdays', 'weekends', 'custom_days'];

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toDateKey(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    const head = val.trim().slice(0, 10);
    if (DATE_KEY_RE.test(head)) {
      const parsed = dayjs(head);
      if (parsed.isValid()) return head;
    }
  }
  const d = dayjs(val);
  return d.isValid() ? d.format('YYYY-MM-DD') : null;
}

export function normalizeHabitSchedule(raw) {
  if (!raw || typeof raw !== 'object') {
    return { preset: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
  }
  const preset = HABIT_SCHEDULE_PRESETS.includes(raw.preset) ? raw.preset : 'daily';
  if (preset === 'weekdays') {
    return { preset: 'weekdays', daysOfWeek: [1, 2, 3, 4, 5] };
  }
  if (preset === 'weekends') {
    return { preset: 'weekends', daysOfWeek: [0, 6] };
  }
  if (preset === 'custom_days') {
    const rawDays = Array.isArray(raw.daysOfWeek) ? raw.daysOfWeek : [];
    const clean = Array.from(
      new Set(
        rawDays
          .map(d => Number(d))
          .filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
      )
    ).sort((a, b) => a - b);
    return {
      preset: 'custom_days',
      daysOfWeek: clean.length > 0 ? clean : [1, 2, 3, 4, 5],
    };
  }
  return { preset: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
}

export function isHabitScheduledOnDate(schedule, dateStr) {
  const norm = normalizeHabitSchedule(schedule);
  if (norm.preset === 'daily') return true;
  const d = dayjs(dateStr);
  if (!d.isValid()) return true;
  const dow = d.day();
  if (norm.preset === 'weekdays') return dow >= 1 && dow <= 5;
  if (norm.preset === 'weekends') return dow === 0 || dow === 6;
  return norm.daysOfWeek.includes(dow);
}

export function isHabitTask(task, board = null) {
  if (!task) return false;
  if (board && board.type === 'habits') return true;
  return (
    Array.isArray(task.habitCompletedDates) ||
    task.habitStreak !== undefined ||
    task.habitBestStreak !== undefined ||
    Boolean(task.habitSchedule)
  );
}

/**
 * Returns sorted unique YYYY-MM-DD completion dates for a habit task.
 * Migrates legacy { habitLastCompleted, habitStreak, completed } tasks seamlessly
 * without losing historical streak counts.
 */
export function normalizeHabitCompletedDates(task, todayStr = dayjs().format('YYYY-MM-DD')) {
  const today = toDateKey(todayStr) || dayjs().format('YYYY-MM-DD');
  const schedule = normalizeHabitSchedule(task?.habitSchedule);

  if (Array.isArray(task?.habitCompletedDates)) {
    const valid = new Set();
    for (let i = 0; i < task.habitCompletedDates.length; i++) {
      const k = toDateKey(task.habitCompletedDates[i]);
      if (k) valid.add(k);
    }
    return Array.from(valid).sort();
  }

  const dates = new Set();
  const lastKey = toDateKey(task?.habitLastCompleted);
  const legacyStreak = Math.min(Math.max(Number(task?.habitStreak) || 0, 0), 3650);

  if (lastKey) {
    dates.add(lastKey);
    if (legacyStreak > 1) {
      let added = 1;
      let cursor = dayjs(lastKey);
      let guard = 0;
      while (added < legacyStreak && guard < 4000) {
        cursor = cursor.subtract(1, 'day');
        guard++;
        const k = cursor.format('YYYY-MM-DD');
        if (isHabitScheduledOnDate(schedule, k)) {
          dates.add(k);
          added++;
        }
      }
    }
  } else if (task?.completed) {
    const fallbackKey = toDateKey(task?.dateString || task?.completionDate) || today;
    dates.add(fallbackKey);
  }

  return Array.from(dates).sort();
}

function computeHistoricalLongestStreak(completedDates, schedule) {
  if (!completedDates || completedDates.length === 0) return 0;
  const completedSet = new Set(completedDates);
  const firstDate = dayjs(completedDates[0]);
  const lastDate = dayjs(completedDates[completedDates.length - 1]);
  if (!firstDate.isValid() || !lastDate.isValid()) return completedDates.length;

  const totalSpan = Math.min(Math.max(lastDate.diff(firstDate, 'day'), 0), 1500);
  let best = 0;
  let run = 0;

  for (let i = 0; i <= totalSpan; i++) {
    const dStr = firstDate.add(i, 'day').format('YYYY-MM-DD');
    if (completedSet.has(dStr)) {
      run++;
      if (run > best) best = run;
    } else if (isHabitScheduledOnDate(schedule, dStr)) {
      run = 0;
    }
  }

  return best;
}

/**
 * Computes deterministic habit streak, best streak, missed scheduled days,
 * freeze status, and 7-day consistency dot states.
 */
export function computeHabitStats(
  task,
  todayStr = dayjs().format('YYYY-MM-DD'),
  streakMode = 'grace'
) {
  const today = toDateKey(todayStr) || dayjs().format('YYYY-MM-DD');
  const todayObj = dayjs(today);
  const schedule = normalizeHabitSchedule(task?.habitSchedule);
  const completedDates = normalizeHabitCompletedDates(task, today);
  const completedSet = new Set(completedDates);

  const completedToday = completedSet.has(today);
  const yesterdayStr = todayObj.subtract(1, 'day').format('YYYY-MM-DD');
  const completedYesterday = completedSet.has(yesterdayStr);
  const isScheduledToday = isHabitScheduledOnDate(schedule, today);

  // Earliest known tracking boundary so newly created habits don't show false past misses
  const candidates = [];
  if (completedDates.length > 0) candidates.push(completedDates[0]);
  const createdKey = toDateKey(task?.habitCreatedAt);
  if (createdKey) candidates.push(createdKey);
  const taskDateKey = toDateKey(task?.dateString || task?.completionDate);
  if (taskDateKey) candidates.push(taskDateKey);
  candidates.push(today);
  candidates.sort();
  const trackingStart = candidates[0];

  // 1. Current streak (strict = 0 missed scheduled days allowed; grace = 1 freeze skip allowed)
  const maxGraceSkips = streakMode === 'strict' ? 0 : 1;
  let skipsUsed = 0;
  let streak = completedToday ? 1 : 0;

  for (let offset = 1; offset <= 730; offset++) {
    const dStr = todayObj.subtract(offset, 'day').format('YYYY-MM-DD');
    if (completedSet.has(dStr)) {
      streak++;
      continue;
    }
    if (dStr < trackingStart && completedDates.length === 0) {
      break;
    }
    const scheduled = isHabitScheduledOnDate(schedule, dStr);
    if (!scheduled) {
      // Rest day does not break streak
      continue;
    }
    if (skipsUsed < maxGraceSkips && dStr >= trackingStart) {
      skipsUsed++;
      continue;
    }
    break;
  }

  // Ensure grace skip alone without any real completions in window doesn't yield streak > 0
  if (streak === 0) {
    skipsUsed = 0;
  }

  // Latest completed date <= today
  let lastCompletedDate = null;
  for (let i = completedDates.length - 1; i >= 0; i--) {
    if (completedDates[i] <= today) {
      lastCompletedDate = completedDates[i];
      break;
    }
  }
  if (!lastCompletedDate && completedDates.length > 0) {
    lastCompletedDate = completedDates[completedDates.length - 1];
  }

  // 2. Count consecutive missed scheduled days strictly before today
  let missedScheduledDays = 0;
  for (let offset = 1; offset <= 365; offset++) {
    const dStr = todayObj.subtract(offset, 'day').format('YYYY-MM-DD');
    if (completedSet.has(dStr)) {
      break;
    }
    if (dStr < trackingStart) {
      break;
    }
    if (isHabitScheduledOnDate(schedule, dStr)) {
      missedScheduledDays++;
    }
  }

  const daysSinceLastCompleted = lastCompletedDate
    ? Math.max(0, todayObj.diff(dayjs(lastCompletedDate), 'day'))
    : null;

  // 3. Best streak across all history
  const historicalBest = computeHistoricalLongestStreak(completedDates, schedule);
  const storedBest = Number(task?.habitBestStreak) || 0;
  const bestStreak = Math.max(storedBest, historicalBest, streak);

  // 4. 7-day consistency dots (6 days ago -> today)
  const last7Days = [];
  for (let offset = 6; offset >= 0; offset--) {
    const dObj = todayObj.subtract(offset, 'day');
    const dateStr = dObj.format('YYYY-MM-DD');
    const isToday = offset === 0;
    const isScheduled = isHabitScheduledOnDate(schedule, dateStr);
    const isCompleted = completedSet.has(dateStr);

    let state = 'rest';
    if (isCompleted) {
      state = 'done';
    } else if (isToday) {
      state = isScheduled ? 'pending_today' : 'rest';
    } else if (!isScheduled) {
      state = 'rest';
    } else if (dateStr < trackingStart) {
      state = 'pre_start';
    } else {
      state = 'missed';
    }

    last7Days.push({
      dateStr,
      dayIndex: dObj.day(),
      isToday,
      isScheduled,
      isCompleted,
      state,
    });
  }

  let status = 'due_today';
  if (completedToday) {
    status = 'done_today';
  } else if (!isScheduledToday) {
    status = 'rest_day';
  } else if (missedScheduledDays === 1) {
    status = 'missed_yesterday';
  } else if (missedScheduledDays > 1) {
    status = 'missed_days';
  }

  return {
    schedule,
    completedDates,
    completedToday,
    completedYesterday,
    isScheduledToday,
    currentStreak: streak,
    bestStreak,
    freezeActive: skipsUsed > 0 && streak > 0,
    lastCompletedDate,
    daysSinceLastCompleted,
    missedScheduledDays,
    status,
    last7Days,
    trackingStart,
  };
}

/**
 * Deterministically toggles completion for a specific date (today or yesterday)
 * and returns both forward patch and exact undoPatch.
 */
export function toggleHabitCompletionForDate(
  task,
  targetDateStr = dayjs().format('YYYY-MM-DD'),
  todayStr = dayjs().format('YYYY-MM-DD'),
  streakMode = 'grace'
) {
  const targetKey = toDateKey(targetDateStr) || dayjs().format('YYYY-MM-DD');
  const today = toDateKey(todayStr) || dayjs().format('YYYY-MM-DD');
  const beforeStats = computeHabitStats(task, today, streakMode);

  const nextSet = new Set(beforeStats.completedDates);
  const wasCompletedOnTarget = nextSet.has(targetKey);
  if (wasCompletedOnTarget) {
    nextSet.delete(targetKey);
  } else {
    nextSet.add(targetKey);
  }
  const nextDatesSorted = Array.from(nextSet).sort();
  const nextTask = {
    ...(task || {}),
    habitCompletedDates: nextDatesSorted,
    habitSchedule: beforeStats.schedule,
  };
  const nextStats = computeHabitStats(nextTask, today, streakMode);

  const patch = {
    completed: nextStats.completedToday,
    habitCompletedDates: nextDatesSorted,
    habitStreak: nextStats.currentStreak,
    habitBestStreak: nextStats.bestStreak,
    habitLastCompleted: nextStats.lastCompletedDate,
    habitSchedule: beforeStats.schedule,
    habitLastRolloverDate: today,
  };

  if (task && !task.habitCreatedAt) {
    patch.habitCreatedAt = beforeStats.trackingStart;
  }

  const undoPatch = {
    completed: Boolean(task?.completed),
    habitCompletedDates: Array.isArray(task?.habitCompletedDates) ? beforeStats.completedDates : beforeStats.completedDates,
    habitStreak: task?.habitStreak !== undefined ? task.habitStreak : beforeStats.currentStreak,
    habitBestStreak: task?.habitBestStreak !== undefined ? task.habitBestStreak : beforeStats.bestStreak,
    habitLastCompleted: task?.habitLastCompleted !== undefined ? task.habitLastCompleted : beforeStats.lastCompletedDate,
    habitSchedule: task?.habitSchedule || beforeStats.schedule,
  };

  return {
    wasCompletedOnTarget,
    nowCompletedOnTarget: !wasCompletedOnTarget,
    patch,
    undoPatch,
    nextStats,
  };
}

/**
 * Builds idempotent daily rollover updates for all habit tasks across boards
 * when the calendar date changes or stats/completed flags drift.
 */
export function computeHabitRolloverUpdates(
  tasks = [],
  boards = [],
  todayStr = dayjs().format('YYYY-MM-DD'),
  streakMode = 'grace'
) {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];
  const today = toDateKey(todayStr) || dayjs().format('YYYY-MM-DD');

  const boardById = new Map();
  if (Array.isArray(boards)) {
    for (let i = 0; i < boards.length; i++) {
      const b = boards[i];
      if (!b) continue;
      if (b.id !== undefined) boardById.set(String(b.id), b);
      if (b._id !== undefined) boardById.set(String(b._id), b);
    }
  }

  const updates = [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t) continue;
    const b = boardById.get(String(t.boardId || t.board_id || 'main')) || null;
    if (!isHabitTask(t, b)) continue;

    const stats = computeHabitStats(t, today, streakMode);
    const currentDateKey = toDateKey(t.dateString || t.completionDate);
    const shouldMoveDateToToday = !currentDateKey || currentDateKey < today;

    const datesChanged =
      !Array.isArray(t.habitCompletedDates) ||
      t.habitCompletedDates.length !== stats.completedDates.length ||
      t.habitCompletedDates.some((d, idx) => d !== stats.completedDates[idx]);

    const needsUpdate =
      Boolean(t.completed) !== stats.completedToday ||
      t.habitLastRolloverDate !== today ||
      Number(t.habitStreak || 0) !== stats.currentStreak ||
      Number(t.habitBestStreak || 0) !== stats.bestStreak ||
      (t.habitLastCompleted || null) !== (stats.lastCompletedDate || null) ||
      datesChanged ||
      !t.habitSchedule ||
      shouldMoveDateToToday;

    if (needsUpdate) {
      const patch = {
        taskId: t.id || t._id,
        completed: stats.completedToday,
        habitCompletedDates: stats.completedDates,
        habitStreak: stats.currentStreak,
        habitBestStreak: stats.bestStreak,
        habitLastCompleted: stats.lastCompletedDate,
        habitSchedule: stats.schedule,
        habitLastRolloverDate: today,
      };
      if (!t.habitCreatedAt) {
        patch.habitCreatedAt = stats.trackingStart;
      }
      if (shouldMoveDateToToday) {
        patch.completionDate = today;
      }
      updates.push(patch);
    }
  }

  return updates;
}

