import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

export function getTaskDateStr(task) {
    if (!task) return '';
    const dateVal = task.completionDate || task.dateString;
    if (!dateVal) return '';
    
    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        return dateVal;
    }
    if (typeof dateVal === 'string' && dateVal.includes('T')) {
        const part = dateVal.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
    }
    const parsed = dayjs(dateVal);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

export function isTaskMissed(task, refNow, refNowDateStr) {
    if (!task || task.completed) return false;
    
    const taskDateStr = getTaskDateStr(task);
    if (!taskDateStr) return false;
    
    const now = refNow || dayjs();
    const nowDateStr = refNowDateStr || now.format('YYYY-MM-DD');

    return taskDateStr < nowDateStr;
}

export function isTaskToday(task, refNow, refNowDateStr) {
    if (!task || task.completed) return false;
    
    const now = refNow || dayjs();
    const nowDateStr = refNowDateStr || now.format('YYYY-MM-DD');
    const taskDateStr = getTaskDateStr(task);
    
    // Tasks without any date default to Today so they are never lost/missing
    if (!task.completionDate && !task.dateString) return true;
    
    return taskDateStr === nowDateStr;
}

export function isTaskUpcoming(task, refNow) {
    if (!task || task.completed) return false;
    const taskDateStr = getTaskDateStr(task);
    if (!taskDateStr) return true;
    const now = refNow || dayjs();
    const filters = getFilters(now);
    return taskDateStr > filters['on-next-week'];
}

export function isTaskOnBoard(task, activeBoardId, mainBoardId, boards = []) {
    if (!task) return false;
    
    const rawBId = task.boardId || task.board_id;
    const effectiveTargetId = activeBoardId || 'all';
    
    if (effectiveTargetId === 'all') return true;

    const mainId = mainBoardId || (boards[0]?.id || 'main');
    const isTargetMain = (effectiveTargetId === 'main' || effectiveTargetId === 'tasks' || effectiveTargetId === mainId);
    
    if (isTargetMain) {
        if (!rawBId || rawBId === 'main' || rawBId === 'tasks' || rawBId === mainId) return true;
        if (boards.length > 0 && boards[0]) {
            const firstB = boards[0];
            if (String(rawBId) === String(firstB.id) || (firstB._id && String(rawBId) === String(firstB._id)) || (firstB.name && String(rawBId).toLowerCase() === String(firstB.name).toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    const targetBoard = boards.find(b => 
        String(b.id) === String(effectiveTargetId) || 
        (b._id && String(b._id) === String(effectiveTargetId)) ||
        (b.name && String(b.name).toLowerCase() === String(effectiveTargetId).toLowerCase())
    );

    if (String(rawBId) === String(effectiveTargetId)) return true;
    if (targetBoard) {
        if (targetBoard.id && String(rawBId) === String(targetBoard.id)) return true;
        if (targetBoard._id && String(rawBId) === String(targetBoard._id)) return true;
        if (targetBoard.name && String(rawBId).toLowerCase() === String(targetBoard.name).toLowerCase()) return true;
    }

    return false;
}

export default function getFilters(refNow) {
    const now = refNow || dayjs();
    return {
        today: now.startOf('day').format('YYYY-MM-DD'),
        tomorrow: now.add(1, 'day').startOf('day').format('YYYY-MM-DD'),
        'on-this-week': now.endOf('isoWeek').format('YYYY-MM-DD'),
        'on-next-week': now.add(1, 'week').startOf('day').endOf('isoWeek').format('YYYY-MM-DD'),
        later: now.add(2, 'week').startOf('day').format('YYYY-MM-DD')
    };
}

export const DAY_SECTIONS = {
    MISSED: 'missed',
    TODAY: 'today',
    TOMORROW: 'tomorrow',
    THIS_WEEK: 'on-this-week',
    NEXT_WEEK: 'on-next-week',
    LATER: 'later',
    COMPLETED: 'completed'
};

export const PRIORITY_SCORES = { high: 3, medium: 2, low: 1, none: 0 };

export function getDateThresholds(refNow) {
    const now = refNow || dayjs();
    return {
        today: now.format('YYYY-MM-DD'),
        tomorrow: now.add(1, 'day').format('YYYY-MM-DD'),
        thisWeek: now.endOf('isoWeek').format('YYYY-MM-DD'),
        nextWeek: now.add(1, 'week').startOf('day').endOf('isoWeek').format('YYYY-MM-DD')
    };
}

export function classifyTaskDate(taskDateStr, thresholds, hasDate = true) {
    if (!hasDate) return DAY_SECTIONS.TODAY;
    if (taskDateStr < thresholds.today) return DAY_SECTIONS.MISSED;
    if (taskDateStr === thresholds.today) return DAY_SECTIONS.TODAY;
    if (taskDateStr === thresholds.tomorrow) return DAY_SECTIONS.TOMORROW;
    if (taskDateStr <= thresholds.thisWeek) return DAY_SECTIONS.THIS_WEEK;
    if (taskDateStr <= thresholds.nextWeek) return DAY_SECTIONS.NEXT_WEEK;
    return DAY_SECTIONS.LATER;
}

export function compareTasks(aItem, bItem, sortBy = 'time') {
    const a = aItem.task || aItem;
    const b = bItem.task || bItem;
    
    if (sortBy === 'priority') {
        const pA = aItem.priorityScore !== undefined ? aItem.priorityScore : (PRIORITY_SCORES[a.priority?.toLowerCase()] || 0);
        const pB = bItem.priorityScore !== undefined ? bItem.priorityScore : (PRIORITY_SCORES[b.priority?.toLowerCase()] || 0);
        if (pA !== pB) return pB - pA;
    }

    const dayA = aItem.dateStr || (a.completionDate ? a.completionDate.substring(0, 10) : '9999-12-31');
    const dayB = bItem.dateStr || (b.completionDate ? b.completionDate.substring(0, 10) : '9999-12-31');
    const dateCompare = dayA.localeCompare(dayB);
    if (dateCompare !== 0) return dateCompare;
    
    const hasTimeA = !!a.time;
    const hasTimeB = !!b.time;
    
    if (hasTimeA && !hasTimeB) return -1;
    if (!hasTimeA && hasTimeB) return 1;
    if (hasTimeA && hasTimeB) return a.time.localeCompare(b.time);
    
    const idA = aItem.idNum !== undefined ? aItem.idNum : parseInt(a.id || '0');
    const idB = bItem.idNum !== undefined ? bItem.idNum : parseInt(b.id || '0');
    return idA - idB;
}



