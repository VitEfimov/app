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


