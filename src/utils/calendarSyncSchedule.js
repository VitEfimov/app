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

// Rolling sync window & Android cursor-safety caps
export const SYNC_PAST_DAYS = 14;
export const SYNC_FUTURE_DAYS = 60;
export const SYNC_CHUNK_DAYS = 14;
export const MAX_EVENTS_PER_SYNC_BATCH = 50;
export const MAX_IMPORTS_PER_SYNC = 150;

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
 * Extracts a normalized 'YYYY-MM-DD' date string from a task object.
 */
export function extractTaskDateKey(task) {
  if (!task) return '';
  if (typeof task.dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.dateString)) {
    return task.dateString;
  }
  if (typeof task.completionDate === 'string') {
    const part = task.completionDate.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
  }
  if (task.completionDate) {
    return formatLocalDateKey(task.completionDate);
  }
  return '';
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
 * Splits [now - pastDays, now + futureDays] into small chunkDays slices so Android's
 * native CalendarContract.Instances query never leaks hundreds of CursorWindows at once.
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
  const safeChunk = Math.max(1, Number(chunkDays) || 14);
  const chunks = [];

  for (let offset = -pastDays; offset <= futureDays; offset += safeChunk) {
    const sliceEndOffset = Math.min(futureDays, offset + safeChunk - 1);
    const start = new Date(y, m, d + offset, 0, 0, 0, 0);
    const end = new Date(y, m, d + sliceEndOffset, 23, 59, 59, 999);
    chunks.push({ start, end });
  }
  return chunks;
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
  return `${title}|${dateKey}|${time}|${completed}|${reminder}|${notes}`;
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
