import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

export function isTaskMissed(task, refNow) {
    if (task.completed) return false;
    if (!task.completionDate) return false;
    const now = refNow || dayjs();
    const taskDate = dayjs(task.completionDate);
    if (taskDate.isBefore(now, 'day')) return true;
    if (taskDate.isSame(now, 'day') && task.time && task.time !== 'None' && task.time !== '--:--') {
        const [hours, minutes] = task.time.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
            const taskDateTime = now.hour(hours).minute(minutes).second(0);
            if (taskDateTime.isBefore(now)) return true;
        }
    }
    return false;
}

export function isTaskToday(task, refNow) {
    if (task.completed) return false;
    if (!task.completionDate) return false;
    const now = refNow || dayjs();
    if (!dayjs(task.completionDate).isSame(now, 'day')) return false;
    return !isTaskMissed(task, now);
}

export default function getFilters(refNow) {
    const now = refNow || dayjs();
    return {
        today: now.startOf('day'),
        tomorrow: now.add(1, 'day').startOf('day'),
        'on-this-week': now.endOf('isoWeek'),
        'on-next-week': now.add(1, 'week').startOf('day').endOf('isoWeek'),
        later: now.add(2, 'week').startOf('day')
    };
}
