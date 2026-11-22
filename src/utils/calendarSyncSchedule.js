/**
 * Pure deterministic scheduling & safety helpers for 3x/day automatic local & Google
 * calendar synchronization (8:00 AM, 12:00 PM noon, 5:00 PM) plus crash-safe
 * window chunking and change-detection fingerprinting.
 *
 * Kept free of React Native / Expo native imports so it can be unit-tested
 * directly under Node.js as well as executed in foreground & headless tasks.
 */

export const DAILY_CALENDAR_SYNC_HOURS = [8, 12, 17]; // 08:00, 12:00 (noon), 17:00
export const DAILY_CALENDAR_SYNC_SLOTS = ['08:00', '12:00', '17:00'];
export const CALENDAR_SYNC_STATE_KEY = 'calendar_sync_schedule_state';

// Fetch-Only Default Mode:
// TaskFlow is the primary task manager; calendar synchronization defaults to fetching external
// calendar events/meetings into TaskFlow while keeping task pushing turned OFF (code preserved).
export const CALENDAR_PUSH_DEFAULT_ENABLED = false;

/**
 * Normalizes a multi-calendar selection array (and optional legacy single `selectedCalendarId`)
 * into a deduplicated array of non-empty string calendar IDs.
 * An empty array `[]` represents "Auto (Default / Primary Calendar)".
 */
export function normalizeSelectedCalendarIds(selectedCalendarIds = [], legacySelectedCalendarId = null) {
  const result = [];
  const seen = new Set();
  const addId = (raw) => {
    if (raw === null || raw === undefined) return;
    const str = String(raw).trim();
    if (!str || str === 'null' || str === 'undefined' || seen.has(str)) return;
    seen.add(str);
    result.push(str);
  };

  if (Array.isArray(selectedCalendarIds)) {
    selectedCalendarIds.forEach(addId);
  } else if (selectedCalendarIds) {
    addId(selectedCalendarIds);
  }

  if (result.length === 0 && legacySelectedCalendarId) {
    addId(legacySelectedCalendarId);
  }

  return result;
}

// Rolling sync window & Android cursor-safety caps
export const SYNC_PAST_DAYS = 14;
export const SYNC_FUTURE_DAYS = 60;
export const SYNC_CHUNK_DAYS = 14;
export const MAX_EVENTS_PER_SYNC_BATCH = 50;
export const MAX_IMPORTS_PER_SYNC = 150;
export const RECENT_TASK_GHOST_GRACE_MS = 2 * 60 * 1000; // 2-minute write propagation grace window

// Smart default calendar sync policy by board type:
// - Date-driven boards (standard/Main, events/birthdays, expenses/payments) sync ON by default.
// - Checklists & trackers (grocery, books/media, travel/packing, habits) sync OFF by default (toggleable).
// - Quick List (simple_list / quick_list) is a pure undated checklist — ALWAYS excluded from calendar & sync.
export const CALENDAR_SYNC_AUTO_BOARD_TYPES = ['standard', 'birthdays', 'events', 'expenses'];
export const CALENDAR_SYNC_OFF_BOARD_TYPES = ['grocery', 'shopping', 'media', 'packing', 'habits', 'simple_list', 'quick_list'];
export const QUICK_LIST_BOARD_TYPES = ['simple_list', 'quick_list'];
const CALENDAR_SYNC_OFF_BOARD_TYPE_SET = new Set(CALENDAR_SYNC_OFF_BOARD_TYPES);
const QUICK_LIST_BOARD_TYPE_SET = new Set(QUICK_LIST_BOARD_TYPES);

export function isQuickListBoardType(boardOrType) {
  if (!boardOrType) return false;
  const rawType = typeof boardOrType === 'object' ? boardOrType.type : boardOrType;
  if (typeof rawType !== 'string') return false;
  return QUICK_LIST_BOARD_TYPE_SET.has(rawType.trim().toLowerCase());
}

/**
 * Returns false for pure undated Quick List boards which never participate in Calendar or Google Calendar Sync.
 */
export function isCalendarSyncSupportedForBoard(board) {
  if (!board) return true;
  return !isQuickListBoardType(board);
}

/**
 * Returns the default calendar sync state for a board based on its board type.
 */
export function getDefaultBoardCalendarSync(board) {
  if (!board) return true;
  if (!isCalendarSyncSupportedForBoard(board)) return false;
  const rawType = typeof board.type === 'string' ? board.type.trim().toLowerCase() : '';
  if (rawType && CALENDAR_SYNC_OFF_BOARD_TYPE_SET.has(rawType)) {
    return false;
  }
  return true;
}

/**
 * Resolves the canonical key used to store a board's calendar sync override in themeReducer.boardCalendarSync.
 */
export function getBoardCalendarSyncKey(boardOrId) {
  if (!boardOrId) return 'main';
  const rawId = typeof boardOrId === 'object' ? (boardOrId.id || boardOrId._id || 'main') : boardOrId;
  const str = String(rawId || 'main').trim();
  if (!str || str.toLowerCase() === 'main' || str.toLowerCase() === 'tasks') return 'main';
  return str;
}

/**
 * Returns whether calendar sync is currently enabled for a given board,
 * honoring explicit per-board overrides in `boardCalendarSync` and falling back
 * to the board type's smart default.
 * Always returns false for Quick List boards.
 */
export function isBoardCalendarSyncEnabled(board, boardCalendarSync = {}) {
  if (!isCalendarSyncSupportedForBoard(board)) {
    return false;
  }
  const overrides = boardCalendarSync && typeof boardCalendarSync === 'object' ? boardCalendarSync : {};
  const canonicalKey = getBoardCalendarSyncKey(board);

  if (Object.prototype.hasOwnProperty.call(overrides, canonicalKey) && typeof overrides[canonicalKey] === 'boolean') {
    return overrides[canonicalKey];
  }

  if (board && typeof board === 'object') {
    const rawId = board.id !== undefined && board.id !== null ? String(board.id) : null;
    const rawMongoId = board._id !== undefined && board._id !== null ? String(board._id) : null;
    if (rawId && Object.prototype.hasOwnProperty.call(overrides, rawId) && typeof overrides[rawId] === 'boolean') {
      return overrides[rawId];
    }
    if (rawMongoId && Object.prototype.hasOwnProperty.call(overrides, rawMongoId) && typeof overrides[rawMongoId] === 'boolean') {
      return overrides[rawMongoId];
    }
  }

  return getDefaultBoardCalendarSync(board);
}

/**
 * Resolves the board object that owns a task.
 */
export function resolveTaskBoard(task, boards = []) {
  const list = Array.isArray(boards) ? boards : [];
  const mainBoard =
    list.find(b => b && (String(b.id || b._id || '').toLowerCase() === 'main' || String(b.name || '').toLowerCase() === 'main')) ||
    list[0] ||
    { id: 'main', name: 'Main', type: 'standard' };

  if (!task) return mainBoard;
  const rawBId = task.boardId || task.board_id;
  if (!rawBId || isMainBoardId(rawBId)) {
    return mainBoard;
  }

  const targetStr = String(rawBId);
  const targetLower = targetStr.toLowerCase();
  const matched = list.find(b =>
    b && (
      String(b.id) === targetStr ||
      (b._id && String(b._id) === targetStr) ||
      (b.name && String(b.name).toLowerCase() === targetLower)
    )
  );
  return matched || { id: targetStr, name: targetStr, type: 'standard' };
}

/**
 * Returns true if the task's owning board is enabled for Google / Device Calendar sync.
 */
export function isTaskEligibleForCalendarSync(task, boards = [], boardCalendarSync = {}) {
  if (!task) return false;
  const board = resolveTaskBoard(task, boards);
  return isBoardCalendarSyncEnabled(board, boardCalendarSync);
}

/**
 * Determines which board newly imported external Google Calendar events should land on.
 * Prefers 'main' if enabled; otherwise chooses the first calendar-synced board (falling back to 'main').
 */
export function getImportTargetBoardId(boards = [], boardCalendarSync = {}) {
  const list = Array.isArray(boards) && boards.length > 0
    ? boards
    : [{ id: 'main', name: 'Main', type: 'standard' }];

  const mainBoard =
    list.find(b => b && (String(b.id || b._id || '').toLowerCase() === 'main' || String(b.name || '').toLowerCase() === 'main')) ||
    { id: 'main', name: 'Main', type: 'standard' };

  if (isBoardCalendarSyncEnabled(mainBoard, boardCalendarSync)) {
    return 'main';
  }

  const firstSynced = list.find(b => b && isBoardCalendarSyncEnabled(b, boardCalendarSync));
  if (firstSynced) {
    return String(firstSynced.id || firstSynced._id || 'main');
  }
  return 'main';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Formats a Date into local 'YYYY-MM-DD' without UTC day-shift drift.
 */
export function formatLocalDateKey(dateLike = new Date()) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Extracts a normalized 'YYYY-MM-DD' date string from a task object across all supported date fields.
 */
export function extractTaskDateKey(task) {
  if (!task) return '';
  const candidates = [task.dateString, task.completionDate, task.dueDate, task.date];
  for (const val of candidates) {
    if (!val) continue;
    if (typeof val === 'string') {
      const part = val.split('T')[0].trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
    }
    const formatted = formatLocalDateKey(val);
    if (formatted) return formatted;
  }
  return '';
}

/**
 * Normalizes a task or calendar event title for cross-board duplicate detection.
 * Strips completion checkmarks, control characters, collapses whitespace, and lowercases.
 */
export function normalizeCalendarTitle(title) {
  if (title === null || title === undefined) return '';
  return String(title)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/^[✓✔☑]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
    .toLowerCase();
}

export function getTaskMatchTitle(task) {
  if (!task) return '';
  return normalizeCalendarTitle(task.taskname || task.name || '');
}

export function isMainBoardId(boardId) {
  if (!boardId) return true;
  const s = String(boardId).trim().toLowerCase();
  return s === '' || s === 'main' || s === 'tasks';
}

export function shiftDateKeyByDays(dateKey, deltaDays) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const shifted = new Date(y, m - 1, d + deltaDays, 12, 0, 0, 0);
  return formatLocalDateKey(shifted);
}

/**
 * Sorts candidate tasks matching the same (title, date) so authoritative tasks
 * (user-created tasks and tasks on specialized boards like payments, birthdays, events)
 * always win over calendar-imported copies on 'main'.
 */
function compareTaskAuthority(a, b) {
  const aImported = a?.syncedFromCalendar === true ? 1 : 0;
  const bImported = b?.syncedFromCalendar === true ? 1 : 0;
  if (aImported !== bImported) return aImported - bImported;

  const aMain = isMainBoardId(a?.boardId || a?.board_id) ? 1 : 0;
  const bMain = isMainBoardId(b?.boardId || b?.board_id) ? 1 : 0;
  if (aMain !== bMain) return aMain - bMain;

  const aLinked = a?.calendarEventId ? 0 : 1;
  const bLinked = b?.calendarEventId ? 0 : 1;
  return aLinked - bLinked;
}

/**
 * Scans existing tasks across ALL boards and identifies duplicate `syncedFromCalendar`
 * copies on the 'main' board that duplicate an existing task on another board
 * (e.g. payments, birthdays, events, grocery, books, habits, packing) or a native task on 'main'.
 */
export function buildTaskDeduplicationPlan(existingTasks = [], boards = [], boardCalendarSync = {}) {
  const groups = new Map();
  const nonMainByTitle = new Map();

  for (const t of existingTasks || []) {
    if (!t) continue;
    const title = getTaskMatchTitle(t);
    if (!title) continue;

    const bId = t.boardId || t.board_id;
    const tId = t.id || t._id;
    const isCalImport = t.syncedFromCalendar === true || (tId && String(tId).startsWith('cal_'));
    if (!isCalImport && !isMainBoardId(bId)) {
      if (!nonMainByTitle.has(title)) nonMainByTitle.set(title, []);
      nonMainByTitle.get(title).push(t);
    }

    const dateKey = extractTaskDateKey(t);
    if (!dateKey) continue;
    const key = `${title}_${dateKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  const duplicateTaskIds = [];
  const duplicateIdSet = new Set();
  const linkTransfers = [];
  const orphanCalendarEventIds = [];

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const sorted = [...group].sort(compareTaskAuthority);
    const authoritative = sorted[0];
    const authId = authoritative.id || authoritative._id;
    let authCalId = authoritative.calendarEventId ? String(authoritative.calendarEventId).trim() : null;
    const authEligible = Array.isArray(boards) && boards.length > 0
      ? isTaskEligibleForCalendarSync(authoritative, boards, boardCalendarSync)
      : true;

    for (let i = 1; i < sorted.length; i++) {
      const candidate = sorted[i];
      const candId = candidate.id || candidate._id;
      const candBoardId = candidate.boardId || candidate.board_id;
      const isCalendarImport = candidate.syncedFromCalendar === true || (candId && String(candId).startsWith('cal_'));

      // Only auto-remove calendar-imported duplicates on the main board;
      // never delete two distinct user-created tasks.
      if (!isCalendarImport || !isMainBoardId(candBoardId)) continue;

      if (candId && !duplicateIdSet.has(String(candId))) {
        duplicateTaskIds.push(candId);
        duplicateIdSet.add(String(candId));
      }

      const candCalId = candidate.calendarEventId ? String(candidate.calendarEventId).trim() : null;
      if (candCalId) {
        if (!authEligible) {
          orphanCalendarEventIds.push(candCalId);
        } else if (!authCalId && authId) {
          authCalId = candCalId;
          linkTransfers.push({ taskId: authId, calendarEventId: candCalId });
        } else if (authCalId && candCalId !== authCalId) {
          orphanCalendarEventIds.push(candCalId);
        }
      }
    }
  }

  // Cross-date / undated non-Main board protection:
  // If a calendar-imported copy on 'main' has the same normalized title as a user task
  // on any non-Main board (e.g. Grocery "Coffee 20", "Dishwasher cleaner 15", rolled-over Habits,
  // Books, Packing, or an unsynced board), remove the bogus Main copy and clean up its event if unsynced.
  for (const candidate of existingTasks || []) {
    if (!candidate) continue;
    const candId = candidate.id || candidate._id;
    if (!candId || duplicateIdSet.has(String(candId))) continue;
    const candBoardId = candidate.boardId || candidate.board_id;
    const isCalendarImport = candidate.syncedFromCalendar === true || String(candId).startsWith('cal_');
    if (!isCalendarImport || !isMainBoardId(candBoardId)) continue;

    const title = getTaskMatchTitle(candidate);
    if (!title || !nonMainByTitle.has(title)) continue;

    const owners = nonMainByTitle.get(title).sort(compareTaskAuthority);
    const owner = owners[0];
    if (!owner) continue;

    const ownerEligible = Array.isArray(boards) && boards.length > 0
      ? isTaskEligibleForCalendarSync(owner, boards, boardCalendarSync)
      : false;
    const ownerDateKey = extractTaskDateKey(owner);
    const candDateKey = extractTaskDateKey(candidate);

    // If the non-Main board is unsynced (Grocery, Habits, Books, Packing, or turned OFF)
    // OR the non-Main task is undated / on the same date, the Main calendar-imported copy is a bogus duplicate
    if (!ownerEligible || !ownerDateKey || ownerDateKey === candDateKey) {
      duplicateTaskIds.push(candId);
      duplicateIdSet.add(String(candId));
      const candCalId = candidate.calendarEventId ? String(candidate.calendarEventId).trim() : null;
      if (candCalId) {
        orphanCalendarEventIds.push(candCalId);
      }
    }
  }

  return { duplicateTaskIds, linkTransfers, orphanCalendarEventIds };
}

/**
 * Builds a multi-entry cross-board task lookup index for differential calendar sync.
 */
export function buildTaskCalendarIndex(existingTasks = []) {
  const byCalEventId = new Map();
  const byNameAndDate = new Map();
  const byTitleOnly = new Map();

  const sortedTasks = [...(existingTasks || [])].filter(Boolean).sort(compareTaskAuthority);

  for (const t of sortedTasks) {
    if (t.calendarEventId) {
      const calId = String(t.calendarEventId).trim();
      if (calId && !byCalEventId.has(calId)) {
        byCalEventId.set(calId, t);
      }
    }
    const title = getTaskMatchTitle(t);
    if (title) {
      if (!byTitleOnly.has(title)) byTitleOnly.set(title, []);
      byTitleOnly.get(title).push(t);
    }
    const dateKey = extractTaskDateKey(t);
    if (title && dateKey) {
      const key = `${title}_${dateKey}`;
      if (!byNameAndDate.has(key)) byNameAndDate.set(key, []);
      byNameAndDate.get(key).push(t);
    }
  }

  return { byCalEventId, byNameAndDate, byTitleOnly };
}

/**
 * Matches a native Google/Device calendar event against ALL tasks across ALL boards
 * (payments, birthdays, events, grocery, habits, books, packing, main, etc.)
 * so existing board tasks are never duplicated onto 'main'.
 */
export function findMatchingTaskForCalendarEvent(eventMeta, taskIndex, deletedIdSet = new Set()) {
  const { eventCalId, cleanTitle, dateStr, isFromTaskFlow = false } = eventMeta || {};
  const idStr = eventCalId ? String(eventCalId).trim() : '';

  // 1. Direct calendarEventId link across any board
  if (idStr && taskIndex.byCalEventId.has(idStr)) {
    const linked = taskIndex.byCalEventId.get(idStr);
    const linkedId = linked?.id || linked?._id;
    if (linked && (!linkedId || !deletedIdSet.has(String(linkedId)))) {
      return { matchType: 'linked', task: linked };
    }
  }

  const normTitle = normalizeCalendarTitle(cleanTitle);
  if (!normTitle || !dateStr) {
    return { matchType: 'none', task: null };
  }

  const matchInDateKey = (targetDateKey) => {
    const key = `${normTitle}_${targetDateKey}`;
    const candidates = (taskIndex.byNameAndDate.get(key) || []).filter(t => {
      const tid = t?.id || t?._id;
      return t && (!tid || !deletedIdSet.has(String(tid)));
    });
    if (candidates.length === 0) return null;

    // Prefer an unlinked matching task (on payments/birthdays/events/main) to bind calendarEventId in place
    const unlinked = candidates.find(t => !t.calendarEventId);
    if (unlinked) {
      return { matchType: 'unlinked', task: unlinked };
    }
    // Otherwise a matching task already exists on some board (possibly linked to another duplicate event)
    return { matchType: 'already_exists', task: candidates[0] };
  };

  // 2. Exact (normalizedTitle, date) across ALL boards
  const exact = matchInDateKey(dateStr);
  if (exact) return exact;

  // 3. Timezone boundary fallback (±1 day) and title-across-board fallback for events exported by TaskFlow
  if (isFromTaskFlow) {
    for (const delta of [-1, 1]) {
      const adjDate = shiftDateKeyByDays(dateStr, delta);
      if (!adjDate) continue;
      const shifted = matchInDateKey(adjDate);
      if (shifted) return shifted;
    }

    // 4. Title-only match across boards for [Synced from TaskFlow] events
    // (catches undated Grocery/Books/Packing items, rolled-over Habits, or rescheduled tasks)
    if (taskIndex.byTitleOnly && taskIndex.byTitleOnly.has(normTitle)) {
      const titleCandidates = (taskIndex.byTitleOnly.get(normTitle) || []).filter(t => {
        const tid = t?.id || t?._id;
        return t && !t.syncedFromCalendar && (!tid || !deletedIdSet.has(String(tid)));
      });
      if (titleCandidates.length > 0) {
        const nonMain = titleCandidates.find(t => !isMainBoardId(t.boardId || t.board_id));
        return { matchType: 'already_exists', task: nonMain || titleCandidates[0] };
      }
    }
  }

  return { matchType: 'none', task: null };
}

/**
 * Returns true if a 'YYYY-MM-DD' date falls inside [now - pastDays, now + futureDays].
 */
export function isDateStrInSyncWindow(
  dateStr,
  nowLike = new Date(),
  pastDays = SYNC_PAST_DAYS,
  futureDays = SYNC_FUTURE_DAYS
) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const now = nowLike instanceof Date ? nowLike : new Date(nowLike);
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - pastDays, 0, 0, 0, 0);
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + futureDays, 23, 59, 59, 999);
  const startKey = formatLocalDateKey(startDate);
  const endKey = formatLocalDateKey(endDate);
  return dateStr >= startKey && dateStr <= endKey;
}

/**
 * Splits [now - pastDays, now + futureDays] into overlapping <=chunkDays slices so Android's
 * native CalendarContract.Instances query:
 *  1. Never leaks hundreds of CursorWindows at once (each chunk <= chunkDays), AND
 *  2. Strictly contains every UTC all-day event [D 00:00Z .. (D+1) 00:00Z] across all
 *     timezones (UTC-12..UTC+14) including Today (offset = 0) and every chunk boundary,
 *     working around expo-calendar Android's strict `BEGIN >= start AND END <= end` SQL filter.
 */
export function buildSyncWindowChunks(
  nowLike = new Date(),
  pastDays = SYNC_PAST_DAYS,
  futureDays = SYNC_FUTURE_DAYS,
  chunkDays = SYNC_CHUNK_DAYS
) {
  const now = nowLike instanceof Date ? nowLike : new Date(nowLike);
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const safeChunk = Math.max(3, Number(chunkDays) || 14);
  // Pad outer bounds by ±1 full local day and overlap adjacent chunks by 2 days
  // so every day D in [-pastDays, +futureDays] has a chunk covering [D-1 00:00 .. D+1 23:59:59.999].
  const startBound = -pastDays - 1;
  const endBound = futureDays + 1;
  const step = Math.max(1, safeChunk - 2);
  const chunks = [];

  for (let offset = startBound; offset <= endBound; offset += step) {
    const sliceEndOffset = Math.min(endBound, offset + safeChunk - 1);
    const start = new Date(y, m, d + offset, 0, 0, 0, 0);
    const end = new Date(y, m, d + sliceEndOffset, 23, 59, 59, 999);
    chunks.push({ start, end });
    if (sliceEndOffset >= endBound) break;
  }
  return chunks;
}

/**
 * Returns true if a task was created or updated within `graceMs` so native CalendarProvider /
 * Google SyncAdapter propagation lag can never cause false ghost-deletion of a freshly added task.
 */
export function isTaskRecentlyCreatedOrUpdated(
  task,
  nowMs = Date.now(),
  graceMs = RECENT_TASK_GHOST_GRACE_MS
) {
  if (!task) return false;
  const candidates = [task.lastUpdatedDate, task.creationDate, task.createdAt];
  for (const raw of candidates) {
    if (!raw) continue;
    const ts = typeof raw === 'number' ? raw : Date.parse(raw);
    if (!Number.isNaN(ts) && ts <= nowMs + 60000 && (nowMs - ts) < graceMs) {
      return true;
    }
  }
  return false;
}

/**
 * Orders tasks for batch calendar export so that:
 *  1. Unlinked tasks from Today onward (Today, Tomorrow, Upcoming) export FIRST
 *  2. Linked Today+ tasks needing updates export second
 *  3. Past/missed tasks inside the rolling window export last
 * Prevents older missed tasks from starving Today/Tomorrow under MAX_EVENTS_PER_SYNC_BATCH.
 */
export function prioritizeTasksForCalendarExport(tasks = [], nowLike = new Date()) {
  const todayKey = formatLocalDateKey(nowLike);
  const rank = (task) => {
    const dateKey = extractTaskDateKey(task);
    const isTodayOrFuture = Boolean(dateKey && (!todayKey || dateKey >= todayKey));
    const isUnlinked = !task?.calendarEventId;
    if (isTodayOrFuture && isUnlinked) return 0;
    if (isTodayOrFuture) return 1;
    if (isUnlinked) return 2;
    return 3;
  };
  return [...(tasks || [])].filter(Boolean).sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    const da = extractTaskDateKey(a) || '9999-12-31';
    const db = extractTaskDateKey(b) || '9999-12-31';
    if (da !== db) return da.localeCompare(db);
    return String(a.id || a._id || '').localeCompare(String(b.id || b._id || ''));
  });
}

/**
 * Computes a deterministic fingerprint of a task's calendar-relevant fields so
 * already-synced unchanged tasks are skipped instead of hammering CalendarProvider.
 */
export function getTaskCalendarFingerprint(task, calendarAlarmsEnabled = false) {
  if (!task) return '';
  const dateKey = extractTaskDateKey(task);
  const title = (task.taskname ? String(task.taskname).trim() : 'Task') || 'Task';
  const time = typeof task.time === 'string' ? task.time.trim() : '';
  const completed = task.completed ? '1' : '0';
  const notes = task.description?.text
    ? String(task.description.text).replace(/<[^>]+>/g, '').trim().slice(0, 200)
    : '';
  const reminder = calendarAlarmsEnabled ? String(task.reminder || 'None') : 'off';
  return `v2|${title}|${dateKey}|${time}|${completed}|${reminder}|${notes}`;
}

/**
 * Returns the 3 scheduled sync slots (08:00, 12:00, 17:00) for a given local day.
 */
export function getDailySyncSlotsForDate(dateLike = new Date(), hours = DAILY_CALENDAR_SYNC_HOURS) {
  const base = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const y = base.getFullYear();
  const m = base.getMonth();
  const d = base.getDate();
  const dateKey = `${y}-${pad2(m + 1)}-${pad2(d)}`;

  return hours.map((hour) => {
    const label = `${pad2(hour)}:00`;
    return {
      hour,
      label,
      slotKey: `${dateKey}@${label}`,
      time: new Date(y, m, d, hour, 0, 0, 0),
    };
  });
}

/**
 * Returns the latest scheduled sync slot (08:00, 12:00, or 17:00) whose
 * local timestamp is <= `now`.
 * If `now` is before today's 08:00, returns yesterday's 17:00 slot.
 */
export function getMostRecentDueSyncSlot(nowLike = new Date(), hours = DAILY_CALENDAR_SYNC_HOURS) {
  const now = nowLike instanceof Date ? nowLike : new Date(nowLike);
  const nowMs = now.getTime();
  const todaySlots = getDailySyncSlotsForDate(now, hours);

  let latestDue = null;
  for (const slot of todaySlots) {
    if (slot.time.getTime() <= nowMs) {
      latestDue = slot;
    }
  }

  if (latestDue) {
    return latestDue;
  }

  // Before today's first slot (08:00): most recent due slot is yesterday's last slot (17:00)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0, 0);
  const yesterdaySlots = getDailySyncSlotsForDate(yesterday, hours);
  return yesterdaySlots[yesterdaySlots.length - 1];
}

/**
 * Returns the next upcoming scheduled sync slot strictly after `now`.
 * If `now` is at or after today's 17:00, returns tomorrow's 08:00 slot.
 */
export function getNextScheduledSyncTime(nowLike = new Date(), hours = DAILY_CALENDAR_SYNC_HOURS) {
  const now = nowLike instanceof Date ? nowLike : new Date(nowLike);
  const nowMs = now.getTime();
  const todaySlots = getDailySyncSlotsForDate(now, hours);

  for (const slot of todaySlots) {
    if (slot.time.getTime() > nowMs) {
      return slot;
    }
  }

  // At or past today's 17:00 slot: next sync is tomorrow at 08:00
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0, 0);
  const tomorrowSlots = getDailySyncSlotsForDate(tomorrow, hours);
  return tomorrowSlots[0];
}

/**
 * Evaluates whether a scheduled 3x/day sync slot is due compared to `lastSyncedSlotKey`.
 * Because `slotKey` uses zero-padded ISO date + 24h time ('YYYY-MM-DD@HH:mm'),
 * lexicographical comparison accurately tracks chronological order.
 */
export function isScheduledCalendarSyncDue(lastSyncedSlotKey, nowLike = new Date(), hours = DAILY_CALENDAR_SYNC_HOURS) {
  const now = nowLike instanceof Date ? nowLike : new Date(nowLike);
  const dueSlot = getMostRecentDueSyncSlot(now, hours);
  const nextSlot = getNextScheduledSyncTime(now, hours);
  const lastKey = lastSyncedSlotKey ? String(lastSyncedSlotKey) : '';
  const isDue = !lastKey || dueSlot.slotKey > lastKey;

  return {
    isDue,
    dueSlotKey: dueSlot.slotKey,
    dueSlotLabel: dueSlot.label,
    dueTime: dueSlot.time,
    nextSlotKey: nextSlot.slotKey,
    nextSlotLabel: nextSlot.label,
    nextSyncTime: nextSlot.time,
    msUntilNextSync: Math.max(1000, nextSlot.time.getTime() - now.getTime()),
  };
}
