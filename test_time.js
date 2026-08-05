const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const completionDateStr = '2026-07-21T04:00:00.000Z';
const timeStr = '18:59';

let targetDate = dayjs(completionDateStr);
const dateOnly = targetDate.format('YYYY-MM-DD');
const parsedTime = dayjs(`${dateOnly} ${timeStr}`, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD H:mm', 'YYYY-MM-DD h:mm A', 'YYYY-MM-DD hh:mm A'], true);

console.log('Parsed Valid:', parsedTime.isValid());
console.log('Parsed Format:', parsedTime.format('YYYY-MM-DD HH:mm:ss'));
