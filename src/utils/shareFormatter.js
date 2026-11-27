import dayjs from 'dayjs';
import {
  extractTaskAmountFromTitle,
  formatCurrency,
  isPriceBoardType,
  resolveCurrencyCode,
  convertCurrency,
  getCachedTaskCurrency,
} from './currencyHelper';
import { computeHabitStats } from './habitHelper';

function tr(t, key, fallback) {
  if (typeof t === 'function') {
    const res = t(key);
    if (res && res !== key) return res;
  }
  return fallback !== undefined ? fallback : key;
}

export function stripShareHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]+>/g, '').trim();
}

export function resolveTaskBoard(task, { board = null, boards = [] } = {}) {
  if (board) return board;
  const rawBoardId = task?.boardId || task?.board_id || 'main';
  const safeBoards = Array.isArray(boards) ? boards : [];
  return (
    safeBoards.find(
      (b) =>
        b &&
        (String(b.id) === String(rawBoardId) ||
          String(b._id) === String(rawBoardId) ||
          (b.name && String(b.name).toLowerCase() === String(rawBoardId).toLowerCase()))
    ) || null
  );
}

export function resolveShareBoardType(task, board) {
  if (board?.type) return String(board.type).toLowerCase();
  if (task?.isQuickListItem) return 'simple_list';
  return 'standard';
}

export function extractShareItemAmount(task, boardType) {
  if (!task) return 0;
  if (
    task.itemPrice !== undefined &&
    task.itemPrice !== null &&
    task.itemPrice !== '' &&
    !isNaN(Number(task.itemPrice))
  ) {
    return Number(task.itemPrice);
  }
  if (
    task.amount !== undefined &&
    task.amount !== null &&
    task.amount !== '' &&
    !isNaN(Number(task.amount))
  ) {
    return Number(task.amount);
  }
  const title = String(task.taskname || task.name || '');
  if (!title) return 0;
  return (
    extractTaskAmountFromTitle(title, {
      allowBareTrailing: isPriceBoardType(boardType),
      boardType,
    }) || 0
  );
}

export function extractShareItemQuantity(task) {
  if (!task) return 1;
  if (
    task.itemQuantity !== undefined &&
    task.itemQuantity !== null &&
    !isNaN(Number(task.itemQuantity))
  ) {
    return Math.max(1, Number(task.itemQuantity));
  }
  return 1;
}

function inferHabitTimeOfDay(task) {
  if (!task) return 'Anytime';
  if (
    task.itemCategory &&
    ['Morning', 'Afternoon', 'Evening', 'Anytime'].includes(task.itemCategory) &&
    task.itemCategory !== 'Anytime'
  ) {
    return task.itemCategory;
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

function formatSubtasksBlock(subtasks, t, indent = '') {
  const list = Array.isArray(subtasks) ? subtasks.filter((s) => s && String(s.text || '').trim()) : [];
  if (list.length === 0) return '';
  return list
    .map((s) => `${indent}- ${s.completed ? '☑️' : '🔲'} ${String(s.text).trim()}`)
    .join('\n');
}

function formatSingleLineListEntry(task, boardType, context) {
  const {
    t,
    boardCurrencyCode,
    habitStreakMode = 'grace',
  } = context;
  const name = String(task?.taskname || task?.name || '').trim() || tr(t, 'Untitled', 'Untitled');
  const check = task?.completed ? '☑️' : '☐';
  const qty = extractShareItemQuantity(task);
  const unitPrice = extractShareItemAmount(task, boardType);
  const itemCurrency = getCachedTaskCurrency(task, boardType) || task?.itemCurrency || boardCurrencyCode || 'USD';
  const notes = stripShareHtml(task?.description?.text);
  const subtasksText = formatSubtasksBlock(task?.subtasks, t, '   ');

  let mainLine = `${check} ${name}`;

  if (boardType === 'grocery' || boardType === 'shopping') {
    const qtyPart = qty > 1 ? ` ×${qty}` : '';
    let pricePart = '';
    if (unitPrice > 0) {
      const total = unitPrice * qty;
      pricePart =
        qty > 1
          ? ` — ${formatCurrency(total, itemCurrency)} (${formatCurrency(unitPrice, itemCurrency)} ${tr(t, 'ea', 'ea')})`
          : ` — ${formatCurrency(unitPrice, itemCurrency)}`;
    }
    mainLine = `${check} ${name}${qtyPart}${pricePart}`;
  } else if (boardType === 'expenses') {
    const pricePart = unitPrice > 0 ? ` — ${formatCurrency(unitPrice, itemCurrency)}` : '';
    const rawDate = task?.completionDate || task?.dateString || task?.dueDate || task?.date;
    const datePart =
      rawDate && dayjs(rawDate).isValid()
        ? `${tr(t, 'Due', 'Due')}: ${dayjs(rawDate).format('MMM D, YYYY')}`
        : '';
    const statusPart = task?.completed ? `${tr(t, 'Paid', 'Paid')} ✅` : datePart;
    mainLine = `${check} ${name}${pricePart}${statusPart ? ` (${statusPart})` : ''}`;
  } else if (boardType === 'packing') {
    const qtyPart = qty > 1 ? ` ×${qty}` : '';
    const cat = task?.itemCategory || 'Carry-On';
    const catPart = cat ? ` [${tr(t, cat, cat)}]` : '';
    mainLine = `${check} ${name}${qtyPart}${catPart}`;
  } else if (boardType === 'habits') {
    const tod = inferHabitTimeOfDay(task);
    const todPart = tod ? ` [${tr(t, tod, tod)}]` : '';
    const stats = computeHabitStats(task, dayjs().format('YYYY-MM-DD'), habitStreakMode);
    const streakPart = stats?.currentStreak > 0 ? ` — 🔥 ${stats.currentStreak}d` : '';
    mainLine = `${check} ${name}${todPart}${streakPart}`;
  } else if (boardType === 'media') {
    const cat = task?.itemCategory || 'Books';
    const catPart = cat ? ` [${tr(t, cat, cat)}]` : '';
    const rating = Number(task?.itemRating) || 0;
    const ratingPart = rating > 0 ? ` — ${'⭐'.repeat(rating)} (${rating}/5)` : '';
    const progressPart = task?.itemProgress ? ` • ${task.itemProgress}` : '';
    mainLine = `${check} ${name}${catPart}${ratingPart}${progressPart}`;
  } else if (boardType === 'simple_list') {
    mainLine = `${check} ${name}`;
  } else if (boardType === 'birthdays') {
    const rawDate = task?.completionDate || task?.dateString || task?.dueDate || task?.date;
    const datePart =
      rawDate && dayjs(rawDate).isValid()
        ? ` — ${dayjs(rawDate).format('MMM D, YYYY')}${task?.time ? ` ${tr(t, 'at', 'at')} ${task.time}` : ''}`
        : '';
    mainLine = `🎉 ${name}${datePart}`;
  } else {
    const rawDate = task?.completionDate || task?.dateString || task?.dueDate || task?.date;
    const datePart =
      rawDate && dayjs(rawDate).isValid()
        ? ` (${dayjs(rawDate).format('MMM D, YYYY')}${task?.time ? ` ${task.time}` : ''})`
        : '';
    const priority =
      task?.priority && task.priority !== 'none'
        ? ` [${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}]`
        : '';
    mainLine = `${check} ${name}${datePart}${priority}`;
  }

  const extras = [];
  if (notes) extras.push(`   ${ notes.replace(/\n/g, '\n   ') }`);
  if (subtasksText) extras.push(subtasksText);
  return extras.length > 0 ? `${mainLine}\n${extras.join('\n')}` : mainLine;
}

/**
 * Formats a single board item or task for sharing (from Edit modal or Left-Swipe Quick Menu).
 * Adapts labels and fields to the board's domain (Grocery, Expenses, Packing, Habits, Media, Quick List, Events, or Standard Task).
 */
export function formatSingleItemForShare(task, options = {}) {
  if (!task) return '';
  const {
    board: explicitBoard = null,
    boards = [],
    currencyCode = 'auto',
    boardCurrencies = {},
    habitStreakMode = 'grace',
    langCode = 'en',
    t,
  } = options;

  const board = resolveTaskBoard(task, { board: explicitBoard, boards });
  const boardType = resolveShareBoardType(task, board);
  const boardId = board?.id || board?._id || task?.boardId || task?.board_id || 'main';
  const boardName = board?.name
    ? board.name === 'Main'
      ? tr(t, 'Main', 'Main')
      : board.name
    : '';
  const boardCurrencyCode = resolveCurrencyCode({
    boardCurrencyCode: boardCurrencies?.[boardId],
    settingCode: currencyCode,
    langCode,
  });

  const name = String(task.taskname || task.name || '').trim() || tr(t, 'Untitled', 'Untitled');
  const notes =
    options.notesOverride !== undefined
      ? String(options.notesOverride || '').trim()
      : stripShareHtml(task.description?.text);
  const subtasks = options.subtasksOverride !== undefined ? options.subtasksOverride : task.subtasks;
  const subtasksBlock = formatSubtasksBlock(subtasks, t);

  const lines = [];

  if (boardType === 'grocery' || boardType === 'shopping') {
    const qty = extractShareItemQuantity(task);
    const unitPrice = extractShareItemAmount(task, boardType);
    const itemCurrency = getCachedTaskCurrency(task, boardType) || task.itemCurrency || boardCurrencyCode;
    const headerTitle = boardName || tr(t, 'Grocery & Shopping', 'Grocery List');
    lines.push(`🛒 ${headerTitle}`);
    lines.push(
      formatSingleLineListEntry(task, boardType, {
        t,
        boardCurrencyCode,
        habitStreakMode,
      })
    );
    if (qty > 1) {
      lines.push(`${tr(t, 'Quantity', 'Qty')}: ${qty}`);
    }
    if (unitPrice > 0) {
      const total = unitPrice * qty;
      lines.push(
        qty > 1
          ? `${tr(t, 'Price', 'Price')}: ${formatCurrency(unitPrice, itemCurrency)} (${tr(t, 'Total', 'Total')}: ${formatCurrency(total, itemCurrency)})`
          : `${tr(t, 'Price', 'Price')}: ${formatCurrency(unitPrice, itemCurrency)}`
      );
    }
  } else if (boardType === 'expenses') {
    const unitPrice = extractShareItemAmount(task, boardType);
    const itemCurrency = getCachedTaskCurrency(task, boardType) || task.itemCurrency || boardCurrencyCode;
    const rawDate = task.completionDate || task.dateString || task.dueDate || task.date;
    lines.push(`🧾 ${name}${unitPrice > 0 ? ` — ${formatCurrency(unitPrice, itemCurrency)}` : ''}`);
    lines.push(
      `${tr(t, 'Status', 'Status')}: ${
        task.completed ? `${tr(t, 'Paid', 'Paid')} ✅` : tr(t, 'Remaining Due', 'Due')
      }`
    );
    if (rawDate && dayjs(rawDate).isValid()) {
      lines.push(
        `${tr(t, 'Due', 'Due')}: ${dayjs(rawDate).format('MMM D, YYYY')}${
          task.time ? ` ${tr(t, 'at', 'at')} ${task.time}` : ''
        }`
      );
    }
  } else if (boardType === 'packing') {
    const qty = extractShareItemQuantity(task);
    const cat = task.itemCategory || 'Carry-On';
    const headerTitle = boardName || tr(t, 'Travel & Packing', 'Packing List');
    lines.push(`🧳 ${headerTitle}`);
    lines.push(`${task.completed ? '☑️' : '☐'} ${name}${qty > 1 ? ` ×${qty}` : ''} [${tr(t, cat, cat)}]`);
  } else if (boardType === 'habits') {
    const tod = inferHabitTimeOfDay(task);
    const stats = computeHabitStats(task, dayjs().format('YYYY-MM-DD'), habitStreakMode);
    lines.push(`🔥 ${name}`);
    lines.push(`${tr(t, 'Time of Day', 'Time of Day')}: ${tr(t, tod, tod)}${task.time ? ` (${task.time})` : ''}`);
    if (stats?.currentStreak > 0) {
      lines.push(`${tr(t, 'Streak', 'Streak')}: 🔥 ${stats.currentStreak}d`);
    }
  } else if (boardType === 'media') {
    const cat = task.itemCategory || 'Books';
    const rating = Number(task.itemRating) || 0;
    lines.push(`📚 ${name} [${tr(t, cat, cat)}]`);
    if (rating > 0) {
      lines.push(`${tr(t, 'Rating', 'Rating')}: ${'⭐'.repeat(rating)} (${rating}/5)`);
    }
    if (task.itemProgress) {
      lines.push(`${tr(t, 'In Progress', 'Progress')}: ${task.itemProgress}`);
    }
  } else if (boardType === 'simple_list') {
    const headerTitle = boardName || tr(t, 'Quick List', 'List');
    lines.push(`📋 ${headerTitle}`);
    lines.push(`${task.completed ? '☑️' : '☐'} ${name}`);
  } else if (boardType === 'birthdays') {
    const rawDate = task.completionDate || task.dateString || task.dueDate || task.date;
    lines.push(`🎉 ${name}`);
    if (rawDate && dayjs(rawDate).isValid()) {
      lines.push(
        `${tr(t, 'Date', 'Date')}: ${dayjs(rawDate).format('MMM D, YYYY')}${
          task.time ? ` ${tr(t, 'at', 'at')} ${task.time}` : ''
        }`
      );
    }
  } else {
    const rawDate = task.completionDate || task.dateString || task.dueDate || task.date;
    const priorityStr =
      task.priority && task.priority !== 'none'
        ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1)
        : '';
    lines.push(`${tr(t, 'Task', 'Task')}: ${name}`);
    if (rawDate && dayjs(rawDate).isValid()) {
      lines.push(
        `${tr(t, 'Due', 'Due')}: ${dayjs(rawDate).format('MMM D, YYYY')}${
          task.time ? ` ${tr(t, 'at', 'at')} ${task.time}` : ''
        }`
      );
    }
    if (priorityStr) {
      lines.push(`${tr(t, 'Priority', 'Priority')}: ${priorityStr}`);
    }
  }

  if (notes && boardType !== 'grocery' && boardType !== 'shopping') {
    lines.push(`\n${tr(t, 'Notes', 'Notes')}:\n${notes}`);
  }
  if (subtasksBlock && boardType !== 'grocery' && boardType !== 'shopping') {
    lines.push(`\n${tr(t, 'Subtasks', 'Items')}:\n${subtasksBlock}`);
  }

  return lines.join('\n').trim();
}

/**
 * Formats multiple selected items or tasks for sharing (from BoardScreen or CalendarScreen selection bar).
 * Shares items as a unified, clean list appropriate for the board type (e.g. Grocery list with quantities, prices, and total).
 */
export function formatMultipleItemsForShare(tasks = [], options = {}) {
  const validTasks = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
  if (validTasks.length === 0) return '';

  const {
    board: explicitBoard = null,
    boards = [],
    currencyCode = 'auto',
    boardCurrencies = {},
    habitStreakMode = 'grace',
    langCode = 'en',
    t,
  } = options;

  const primaryBoard =
    explicitBoard ||
    resolveTaskBoard(validTasks[0], { boards });
  const primaryBoardType = resolveShareBoardType(validTasks[0], primaryBoard);
  const primaryBoardId =
    primaryBoard?.id || primaryBoard?._id || validTasks[0]?.boardId || validTasks[0]?.board_id || 'main';
  const boardCurrencyCode = resolveCurrencyCode({
    boardCurrencyCode: boardCurrencies?.[primaryBoardId],
    settingCode: currencyCode,
    langCode,
  });

  const boardTitle = primaryBoard?.name
    ? primaryBoard.name === 'Main'
      ? tr(t, 'Tasks', 'Tasks')
      : primaryBoard.name
    : tr(t, 'List', 'List');

  const headerIconMap = {
    grocery: '🛒',
    shopping: '🛒',
    expenses: '🧾',
    packing: '🧳',
    habits: '🔥',
    media: '📚',
    simple_list: '📋',
    birthdays: '🎉',
    standard: '📋',
  };
  const headerIcon = headerIconMap[primaryBoardType] || '📋';

  const itemLines = validTasks.map((item) => {
    const itemBoard = explicitBoard || resolveTaskBoard(item, { boards }) || primaryBoard;
    const itemBoardType = resolveShareBoardType(item, itemBoard);
    const itemBoardId = itemBoard?.id || itemBoard?._id || item?.boardId || primaryBoardId;
    const itemBoardCurrency = resolveCurrencyCode({
      boardCurrencyCode: boardCurrencies?.[itemBoardId],
      settingCode: currencyCode,
      langCode,
    });
    return formatSingleLineListEntry(item, itemBoardType, {
      t,
      boardCurrencyCode: itemBoardCurrency,
      habitStreakMode,
    });
  });

  const lines = [`${headerIcon} ${boardTitle}:`, ...itemLines];

  if (primaryBoardType === 'grocery' || primaryBoardType === 'shopping') {
    let grandTotal = 0;
    validTasks.forEach((item) => {
      const qty = extractShareItemQuantity(item);
      const unitPrice = extractShareItemAmount(item, primaryBoardType);
      if (unitPrice > 0) {
        const itemCur = getCachedTaskCurrency(item, primaryBoardType) || item.itemCurrency || boardCurrencyCode;
        const convertedUnit = convertCurrency(unitPrice, itemCur, boardCurrencyCode);
        grandTotal += convertedUnit * qty;
      }
    });
    if (grandTotal > 0) {
      lines.push('');
      lines.push(`${tr(t, 'Total', 'Total')}: ${formatCurrency(grandTotal, boardCurrencyCode)}`);
    }
  } else if (primaryBoardType === 'expenses') {
    let totalBills = 0;
    let totalPaid = 0;
    validTasks.forEach((item) => {
      const unitPrice = extractShareItemAmount(item, primaryBoardType);
      if (unitPrice > 0) {
        const itemCur = getCachedTaskCurrency(item, primaryBoardType) || item.itemCurrency || boardCurrencyCode;
        const converted = convertCurrency(unitPrice, itemCur, boardCurrencyCode);
        totalBills += converted;
        if (item.completed) totalPaid += converted;
      }
    });
    if (totalBills > 0) {
      const remaining = Math.max(0, totalBills - totalPaid);
      lines.push('');
      lines.push(
        `${tr(t, 'Total', 'Total')}: ${formatCurrency(totalBills, boardCurrencyCode)} (${tr(t, 'Paid', 'Paid')}: ${formatCurrency(totalPaid, boardCurrencyCode)} • ${tr(t, 'Remaining Due', 'Due')}: ${formatCurrency(remaining, boardCurrencyCode)})`
      );
    }
  }

  return lines.join('\n').trim();
}
