import { Platform } from 'react-native';
import dayjs from 'dayjs';
import {
  syncWidgetData,
  getPendingWidgetActions,
  clearPendingWidgetActions,
  getPendingWidgetLaunchAction,
  getActiveWidgetCounts,
  requestPinWidget,
  addWidgetActionListener,
} from '../../modules/expo-task-alarm';
import { CURRENCIES, resolveCurrencyCode, extractTaskAmountFromTitle } from './currencyHelper';
import { computeHabitStats } from './habitHelper';

export function inferHabitTimeOfDay(task) {
  if (!task) return 'Anytime';
  if (task.itemCategory && ['Morning', 'Afternoon', 'Evening', 'Anytime'].includes(task.itemCategory)) {
    if (task.itemCategory !== 'Anytime') return task.itemCategory;
  }
  if (task.time && typeof task.time === 'string' && task.time.includes(':')) {
    const hour = parseInt(task.time.split(':')[0], 10);
    if (!isNaN(hour)) {
      if (hour >= 4 && hour < 12) return 'Morning';
      if (hour >= 12 && hour < 17) return 'Afternoon';
      if (hour >= 17 && hour <= 23) return 'Evening';
    }
  }
  return task.itemCategory || 'Anytime';
}

let lastSyncedWidgetJson = null;

export function parseTaskTimeForWidget(timeStr, use24Hour = false) {
  if (!timeStr || typeof timeStr !== 'string') {
    return { timeLabel: '', sortTimeMinutes: 9999 };
  }
  const clean = timeStr.trim();
  const isPm = /pm/i.test(clean);
  const isAm = /am/i.test(clean);
  const numeric = clean.replace(/(am|pm)/i, '').trim();
  const parts = numeric.split(':').map((n) => parseInt(n, 10));
  if (isNaN(parts[0])) {
    return { timeLabel: clean, sortTimeMinutes: 9999 };
  }
  let hour = parts[0];
  const minute = !isNaN(parts[1]) ? parts[1] : 0;
  if (isPm && hour < 12) hour += 12;
  if (isAm && hour === 12) hour = 0;
  hour = Math.max(0, Math.min(23, hour));
  const safeMin = Math.max(0, Math.min(59, minute));
  const sortTimeMinutes = hour * 60 + safeMin;

  const minPadded = String(safeMin).padStart(2, '0');
  if (use24Hour) {
    return {
      timeLabel: `${String(hour).padStart(2, '0')}:${minPadded}`,
      sortTimeMinutes,
    };
  }
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return {
    timeLabel: `${hour12}:${minPadded} ${period}`,
    sortTimeMinutes,
  };
}

export function extractWidgetTaskDateKey(task, fallbackToday) {
  if (!task) return fallbackToday;
  const raw = task.dateString || task.completionDate || task.dueDate || task.date;
  if (!raw) return fallbackToday;
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.trim())) {
    return raw.trim().slice(0, 10);
  }
  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : fallbackToday;
}

export function buildWidgetSnapshotFromState(state = {}) {
  const todayKey = dayjs().format('YYYY-MM-DD');
  const themeState = state?.themeReducer || {};
  const userState = state?.userReducer || {};
  const taskState = state?.taskReducer || {};

  const themeMode = themeState.themeMode || 'dark';
  const accentHex = themeState.sourceColor || '#6C5CE7';
  const use24Hour = themeState.timeFormat === '24h';
  const weekStartDay =
    themeState.weekStartDay === 1 ||
    String(themeState.firstDayOfWeek || '').toLowerCase() === 'monday'
      ? 1
      : 0;
  const rawCurrency = themeState.currency || themeState.currencyCode || 'USD';
  const currencyCode = resolveCurrencyCode({ settingCode: rawCurrency });
  const currencySymbol = CURRENCIES[currencyCode]?.symbol || '$';
  const habitStreakMode = themeState.habitStreakMode || 'strict';

  const boards = Array.isArray(userState.boards) ? userState.boards : [];
  const boardMap = new Map();
  for (const b of boards) {
    if (!b) continue;
    const bid = String(b.id || b._id || '');
    if (bid) boardMap.set(bid, b);
  }

  const activeBoardId = String(userState.activeBoardId || 'main');
  const activeBoardObj = boardMap.get(activeBoardId);
  const activeBoardName = activeBoardObj?.name || 'All Tasks';

  const rawTasks = Array.isArray(taskState.tasks) ? taskState.tasks : [];
  let bestHabitStreak = 0;
  let dueTodayCount = 0;
  let completedTodayCount = 0;
  let overdueCount = 0;

  const widgetTasks = [];

  for (const t of rawTasks) {
    if (!t) continue;
    const id = String(t.id || t._id || '');
    if (!id) continue;

    const rawBoardId = String(t.boardId || t.board_id || 'main');
    const boardObj = boardMap.get(rawBoardId);
    const boardName = boardObj?.name || (rawBoardId === 'main' || rawBoardId === 'tasks' ? 'Tasks' : rawBoardId);
    const boardType = String(boardObj?.type || t.boardType || 'standard').toLowerCase();
    const boardColor = boardObj?.color || accentHex;

    const dateKey = extractWidgetTaskDateKey(t, todayKey);
    const completed = Boolean(t.completed);
    const { timeLabel, sortTimeMinutes } = parseTaskTimeForWidget(t.time, use24Hour);
    const priority = String(t.priority || 'none').toLowerCase();

    const isListItem =
      boardType === 'grocery' ||
      boardType === 'shopping' ||
      boardType === 'packing' ||
      boardType === 'media' ||
      boardType === 'simple_list';

    if (dateKey === todayKey) {
      if (completed) completedTodayCount++;
      else dueTodayCount++;
    } else if (!completed && dateKey < todayKey && !isListItem) {
      overdueCount++;
    }

    const baseTitle = String(t.taskname || t.title || t.name || 'Untitled Task').trim();
    const qty = Math.max(1, Number(t.itemQuantity) || 1);
    const unitPrice =
      t.itemPrice !== undefined && t.itemPrice !== null && t.itemPrice !== ''
        ? Number(t.itemPrice) || 0
        : extractTaskAmountFromTitle(baseTitle, { boardType }) || 0;
    const priceTotal =
      boardType === 'grocery' || boardType === 'shopping' ? unitPrice * qty : unitPrice;

    const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
    const doneSubtasks = subtasks.filter((s) => s && s.completed).length;
    const subtaskSummary = subtasks.length > 0 ? `${doneSubtasks}/${subtasks.length}` : '';

    let streakDays = 0;
    if (boardType === 'habits' || Array.isArray(t.habitCompletedDates)) {
      const stats = computeHabitStats(t, todayKey, habitStreakMode);
      streakDays = Number(stats?.currentStreak) || 0;
      if (streakDays > bestHabitStreak) bestHabitStreak = streakDays;
      if (Number(stats?.bestStreak) > bestHabitStreak) bestHabitStreak = Number(stats.bestStreak);
    }

    const isRecurring = Boolean(
      (t.recurring && t.recurring !== 'none' && t.recurring !== 'None') ||
      (t.repeat && t.repeat !== 'none' && t.repeat !== 'None')
    );
    const isAlarm = Boolean(t.isAlarm);

    let displayTitle = baseTitle;
    let badgeText = '';
    let metaText = '';

    if (boardType === 'grocery' || boardType === 'shopping') {
      if (qty > 1 && !/×\d+|\bx\d+\b/i.test(displayTitle)) {
        displayTitle = `${displayTitle} ×${qty}`;
      }
      if (priceTotal > 0) {
        badgeText = `${currencySymbol}${priceTotal.toFixed(2)}`;
      } else if (qty > 1) {
        badgeText = `×${qty}`;
      }
      const metaParts = [];
      if (qty > 1 && unitPrice > 0) {
        metaParts.push(`${currencySymbol}${unitPrice.toFixed(2)} ea`);
      }
      if (t.itemCategory) metaParts.push(String(t.itemCategory));
      metaParts.push(boardName);
      metaText = metaParts.join(' • ');
    } else if (boardType === 'expenses') {
      if (priceTotal > 0) {
        badgeText = `${currencySymbol}${priceTotal.toFixed(2)}`;
      }
      const metaParts = [];
      if (dateKey < todayKey && !completed) metaParts.push('Overdue');
      else if (dateKey === todayKey) metaParts.push('Due Today');
      else metaParts.push(dateKey);
      if (isRecurring) metaParts.push('↻ Recurring');
      metaParts.push(boardName);
      metaText = metaParts.join(' • ');
    } else if (boardType === 'habits') {
      if (streakDays > 0) {
        badgeText = `🔥 ${streakDays}d`;
      }
      const tod = inferHabitTimeOfDay(t);
      const metaParts = [tod];
      if (timeLabel) metaParts.push(timeLabel);
      metaParts.push(boardName);
      metaText = metaParts.join(' • ');
    } else if (boardType === 'packing') {
      badgeText = t.itemCategory ? String(t.itemCategory) : (qty > 1 ? `×${qty}` : '');
      metaText = [qty > 1 ? `Qty ${qty}` : null, boardName].filter(Boolean).join(' • ');
    } else if (boardType === 'media') {
      const rating = Number(t.itemRating) || 0;
      badgeText = rating > 0 ? `★ ${rating}/5` : (t.itemCategory || '');
      metaText = [t.itemCategory || 'Media', t.itemProgress || null, boardName].filter(Boolean).join(' • ');
    } else {
      // Standard / Calendar task
      if (timeLabel) {
        badgeText = timeLabel;
      } else if (priority === 'high' || priority === 'urgent') {
        badgeText = 'HIGH';
      } else if (subtaskSummary) {
        badgeText = subtaskSummary;
      }
      const metaParts = [];
      if (dateKey < todayKey && !completed) metaParts.push('Overdue');
      if (timeLabel) metaParts.push(timeLabel);
      if (isAlarm) metaParts.push('⏰ Alarm');
      if (isRecurring) metaParts.push('↻');
      if (subtaskSummary) metaParts.push(`${subtaskSummary} subtasks`);
      metaParts.push(boardName);
      metaText = metaParts.join(' • ');
    }

    widgetTasks.push({
      id,
      title: displayTitle,
      dateKey,
      timeLabel,
      sortTimeMinutes,
      completed,
      priority,
      boardId: rawBoardId,
      boardName,
      boardType,
      isAlarm,
      isRecurring,
      subtaskSummary,
      badgeText,
      metaText,
      priceTotal,
      streakDays,
      accentHex: boardColor || accentHex,
    });
  }

  return {
    todayKey,
    themeMode,
    accentHex,
    weekStartDay,
    currencySymbol,
    activeBoardName,
    bestHabitStreak,
    dueTodayCount,
    completedTodayCount,
    overdueCount,
    tasks: widgetTasks,
  };
}

export function syncWidgetsWithStore(state, force = false) {
  if (Platform.OS !== 'android') return false;
  try {
    const snapshot = buildWidgetSnapshotFromState(state);
    const json = JSON.stringify(snapshot);
    if (!force && json === lastSyncedWidgetJson) {
      return false;
    }
    lastSyncedWidgetJson = json;
    return syncWidgetData(json);
  } catch (e) {
    return false;
  }
}

export async function consumePendingWidgetActionsAsync(
  store,
  dispatch,
  updateTaskAction,
  cancelNotificationFn,
  addTaskAction = null
) {
  if (Platform.OS !== 'android') return 0;
  let processed = 0;
  try {
    const pending = getPendingWidgetActions();
    if (!Array.isArray(pending) || pending.length === 0) return 0;

    const state = store.getState();
    const tasks = state?.taskReducer?.tasks || [];

    for (const item of pending) {
      if (!item) continue;
      if (item.type === 'TOGGLE_TASK' && item.taskId) {
        const targetId = String(item.taskId);
        const completed = Boolean(item.completed);
        const existingTask = tasks.find(
          (t) => t && (String(t.id) === targetId || String(t._id) === targetId)
        );

        dispatch(updateTaskAction({ taskId: targetId, completed }));
        if (completed && typeof cancelNotificationFn === 'function') {
          try {
            await cancelNotificationFn(existingTask?.notificationId, targetId);
          } catch (e) {}
        }
        processed++;
      } else if (item.type === 'CREATE_TASK' && item.title) {
        const newId = String(item.taskId || `wtask_${Date.now()}`);
        const alreadyExists = tasks.some(
          (t) => t && (String(t.id) === newId || String(t._id) === newId)
        );
        if (!alreadyExists) {
          const resolveAddTask =
            typeof addTaskAction === 'function'
              ? addTaskAction
              : require('../features/taskSlice').addTask;
          const dateKey = item.dateKey || dayjs().format('YYYY-MM-DD');
          const newTask = {
            id: newId,
            taskname: String(item.title).trim(),
            completionDate: dateKey,
            dateString: dateKey,
            time: item.time || null,
            priority: item.priority || 'none',
            boardId: item.boardId || 'main',
            completed: false,
            isLocalDraft: true,
            itemQuantity: Number(item.itemQuantity) || 1,
            itemPrice: Number(item.itemPrice) || 0,
            description: { text: '', img: '', attachments: [], url: '' },
            subtasks: [],
            doNotOverrideDate: true,
          };
          dispatch(resolveAddTask({ task: newTask }));
          processed++;
        }
      }
    }

    if (processed > 0) {
      try {
        const { flushPendingTaskSaves } = require('../features/taskSlice');
        if (typeof flushPendingTaskSaves === 'function') {
          await flushPendingTaskSaves(store.getState);
        }
      } catch (e) {}
      syncWidgetsWithStore(store.getState(), true);
      clearPendingWidgetActions();
    } else if (pending.length > 0) {
      // All pending items were already present in Redux; flush and acknowledge
      syncWidgetsWithStore(store.getState(), true);
      clearPendingWidgetActions();
    }
  } catch (e) {}
  return processed;
}

export function consumePendingWidgetLaunchAction() {
  if (Platform.OS !== 'android') return null;
  try {
    return getPendingWidgetLaunchAction();
  } catch (e) {
    return null;
  }
}

export { getActiveWidgetCounts, requestPinWidget, addWidgetActionListener };
