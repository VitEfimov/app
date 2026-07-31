import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

export function isTaskMissed(task) {
    if (task.completed) return false;
    if (!task.completionDate) return false;
    const taskDate = dayjs(task.completionDate);
    if (taskDate.isBefore(dayjs(), 'day')) return true;
    if (taskDate.isSame(dayjs(), 'day') && task.time) {
        const [hours, minutes] = task.time.split(':').map(Number);
        const taskDateTime = dayjs().hour(hours).minute(minutes).second(0);
        if (taskDateTime.isBefore(dayjs())) return true;
    }
    return false;
}

export function isTaskToday(task) {
    if (task.completed) return false;
    if (!task.completionDate) return false;
    if (!dayjs(task.completionDate).isSame(dayjs(), 'day')) return false;
    return !isTaskMissed(task);
}

export default function getFilters() {
    return {
        today: dayjs().startOf('day'),
        tomorrow: dayjs().add(1, 'day').startOf('day'),
        'on-this-week': dayjs().endOf('isoWeek'),
        'on-next-week': dayjs().add(1, 'week').startOf('day').endOf('isoWeek'),
        later: dayjs().add(2, 'week').startOf('day')
    };
}
