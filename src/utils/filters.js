import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

export function getTaskDateStr(task) {
    if (!task) return '';
    if (task.dateString) return task.dateString;
    if (!task.completionDate) return '';
    if (typeof task.completionDate === 'string') {
        return task.completionDate.split('T')[0];
    }
    const parsed = dayjs(task.completionDate);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

export function isTaskMissed(task, refNow, refNowDateStr) {
    if (!task || task.completed) return false;
    
    const taskDateStr = getTaskDateStr(task);
    if (!taskDateStr) return false;
    
    const now = refNow || dayjs();
    const nowDateStr = refNowDateStr || now.format('YYYY-MM-DD');

    if (taskDateStr < nowDateStr) return true;
    if (taskDateStr === nowDateStr && task.time && task.time !== 'None' && task.time !== '--:--') {
        const [hours, minutes] = task.time.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
            const nowTimeStr = now.format('HH:mm');
            const formattedTaskTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            if (formattedTaskTime < nowTimeStr) return true;
        }
    }
    return false;
}

export function isTaskToday(task, refNow, refNowDateStr) {
    if (!task || task.completed) return false;
    
    const now = refNow || dayjs();
    const nowDateStr = refNowDateStr || now.format('YYYY-MM-DD');
    const taskDateStr = getTaskDateStr(task);
    
    // Tasks without a completionDate default to Today so they are never lost/missing
    if (!task.completionDate || !taskDateStr) return true;
    
    if (taskDateStr !== nowDateStr) return false;
    return !isTaskMissed(task, now, nowDateStr);
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

