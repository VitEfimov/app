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

