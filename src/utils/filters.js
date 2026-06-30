import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

export default function getFilters() {
    return {
        today: dayjs().startOf('day'),
        tomorrow: dayjs().add(1, 'day').startOf('day'),
        'on-this-week': dayjs().endOf('isoWeek'),
        'on-next-week': dayjs().add(1, 'week').startOf('day').endOf('isoWeek'),
        later: dayjs().add(2, 'week').startOf('day')
    };
}
