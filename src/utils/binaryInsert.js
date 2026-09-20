import dayjs from 'dayjs';

/**
 * Compare two tasks chronologically:
 * 1. Dated tasks come before undated (Someday) tasks.
 * 2. Completion dates are compared in ascending order (YYYY-MM-DD).
 * 3. Timed tasks come before untimed tasks on the same day.
 * 4. Times are compared in ascending order (HH:mm).
 * 5. Task IDs / creation timestamps serve as tie-breaker.
 */
export const compareTaskOrder = (a, b) => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const hasDateA = !!(a.completionDate || a.dateString);
  const hasDateB = !!(b.completionDate || b.dateString);

  // Dated tasks come before undated tasks
  if (hasDateA && !hasDateB) return -1;
  if (!hasDateA && hasDateB) return 1;

  if (hasDateA && hasDateB) {
    const dateStrA = a.dateString || (typeof a.completionDate === 'string' ? a.completionDate.split('T')[0] : '');
    const dateStrB = b.dateString || (typeof b.completionDate === 'string' ? b.completionDate.split('T')[0] : '');
    
    if (dateStrA !== dateStrB) {
      return dateStrA.localeCompare(dateStrB);
    }
  }

  // Same date (or both undated): compare time
  const hasTimeA = !!(a.time && a.time.trim() !== '' && a.time !== '--:--');
  const hasTimeB = !!(b.time && b.time.trim() !== '' && b.time !== '--:--');

  if (hasTimeA && !hasTimeB) return -1;
  if (!hasTimeA && hasTimeB) return 1;

  if (hasTimeA && hasTimeB) {
    const timeCompare = a.time.localeCompare(b.time);
    if (timeCompare !== 0) return timeCompare;
  }

  // Tie-breaker: ID / creation order
  const idA = String(a.id || '');
  const idB = String(b.id || '');
  return idA.localeCompare(idB);
};

/**
 * Binary search to find the exact insertion index for newTask in a pre-sorted tasks array.
 * Runs in O(log N) time complexity.
 */
export const findBinaryInsertIndex = (tasksArray = [], newTask) => {
  if (!tasksArray || tasksArray.length === 0) return 0;

  let low = 0;
  let high = tasksArray.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const cmp = compareTaskOrder(newTask, tasksArray[mid]);

    if (cmp < 0) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return low;
};

/**
 * Inserts newTask into pre-sorted tasksArray using O(log N) binary search.
 * Returns a new pre-sorted array instance.
 */
export const insertTaskSorted = (tasksArray = [], newTask) => {
  if (!newTask) return [...tasksArray];
  const index = findBinaryInsertIndex(tasksArray, newTask);
  const result = [...tasksArray];
  result.splice(index, 0, newTask);
  return result;
};

/**
 * Sorts an entire array of tasks chronologically.
 * Used for initial state hydration / migration.
 */
export const sortTasksChronologically = (tasksArray = []) => {
  if (!Array.isArray(tasksArray)) return [];
  return [...tasksArray].sort(compareTaskOrder);
};
