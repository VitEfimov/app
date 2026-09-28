import { useDispatch } from 'react-redux';
import { addMultipleTasks } from '../features/taskSlice';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { Alert } from 'react-native';
import { useToast } from '../styles/ToastContext';

dayjs.extend(isoWeek);

export const useTaskRepeat = () => {
    const dispatch = useDispatch();
    const { showToast } = useToast();

    const getNextDate = (current, config) => {
        let next = current.clone();
        const { preset, customFreq, customInterval, customDaysOfWeek, customMonthlyType, customNthWeekday, _anchorDate, _originalStartDate } = config;
        const interval = parseInt(customInterval, 10) || 1;
        const anchor = dayjs(_anchorDate || _originalStartDate || current);

        // PRESETS
        if (preset === 'every_day') return next.add(1, 'day');
        if (preset === 'every_weekday') {
            do { next = next.add(1, 'day'); } while (next.day() === 0 || next.day() === 6);
            return next;
        }
        if (preset === 'every_weekend') {
            do { next = next.add(1, 'day'); } while (next.day() !== 0 && next.day() !== 6);
            return next;
        }
        if (preset === 'every_week' || preset === 'every_2_weeks') {
            const weekStep = preset === 'every_week' ? 1 : 2;
            const anchorDayOfWeek = anchor.day();
            const targetWeek = current.add(weekStep, 'week');
            const diff = anchorDayOfWeek - targetWeek.day();
            return targetWeek.add(diff, 'day').hour(anchor.hour()).minute(anchor.minute()).second(anchor.second()).millisecond(anchor.millisecond());
        }

        // MONTHLY (every_month OR custom months with same_day)
        if (preset === 'every_month' || (preset === 'custom' && customFreq === 'months' && (!customMonthlyType || customMonthlyType === 'same_day'))) {
            const monthStep = preset === 'every_month' ? 1 : interval;
            const origDay = anchor.date();
            const nextMonth = current.startOf('month').add(monthStep, 'month');
            const chosenDay = Math.min(origDay, nextMonth.daysInMonth());
            return nextMonth.date(chosenDay).hour(anchor.hour()).minute(anchor.minute()).second(anchor.second()).millisecond(anchor.millisecond());
        }

        // YEARLY (every_year OR custom years)
        if (preset === 'every_year' || (preset === 'custom' && customFreq === 'years')) {
            const yearStep = preset === 'every_year' ? 1 : interval;
            const origMonth = anchor.month();
            const origDay = anchor.date();
            const nextYear = current.startOf('year').add(yearStep, 'year').month(origMonth);
            const chosenDay = Math.min(origDay, nextYear.daysInMonth());
            return nextYear.date(chosenDay).hour(anchor.hour()).minute(anchor.minute()).second(anchor.second()).millisecond(anchor.millisecond());
        }

        // CUSTOM
        if (preset === 'custom') {
            if (customFreq === 'days') return next.add(interval, 'day');

            if (customFreq === 'weeks') {
                const daysList = (customDaysOfWeek && customDaysOfWeek.length > 0) ? customDaysOfWeek : [anchor.day()];
                const sortedDays = [...daysList].sort((a, b) => a - b);
                const currentDay = next.day();
                const laterDay = sortedDays.find(d => d > currentDay);
                if (laterDay !== undefined) {
                    return next.add(laterDay - currentDay, 'day');
                }
                const firstDay = sortedDays[0];
                const daysToAdd = (7 - currentDay) + (interval - 1) * 7 + firstDay;
                return next.add(daysToAdd, 'day');
            }

            if (customFreq === 'months') {
                const targetMonth = current.startOf('month').add(interval, 'month');

                if (customMonthlyType === 'last_day') {
                    return targetMonth.endOf('month').startOf('day').hour(anchor.hour()).minute(anchor.minute()).second(anchor.second());
                }
                if (customMonthlyType === 'first_workday') {
                    let candidate = targetMonth.startOf('month');
                    while (candidate.day() === 0 || candidate.day() === 6) {
                        candidate = candidate.add(1, 'day');
                    }
                    return candidate.hour(anchor.hour()).minute(anchor.minute()).second(anchor.second());
                }
                if (customMonthlyType === 'nth_weekday' && customNthWeekday) {
                    const { n, weekday } = customNthWeekday;
                    const matches = [];
                    let candidate = targetMonth.startOf('month');
                    while (candidate.month() === targetMonth.month()) {
                        if (candidate.day() === weekday) {
                            matches.push(candidate.clone());
                        }
                        candidate = candidate.add(1, 'day');
                    }
                    if (matches.length > 0) {
                        const chosen = (n === 5) ? matches[matches.length - 1] : matches[Math.min(Math.max(0, n - 1), matches.length - 1)];
                        return chosen.hour(anchor.hour()).minute(anchor.minute()).second(anchor.second());
                    }
                    return targetMonth;
                }
            }
        }

        return next.add(1, 'day'); // Ultimate fallback
    };

    const generateRepeatingTasks = (originalTask, formData, repeatConfig) => {
        const { preset, startDate, endDate } = repeatConfig;
        if (!preset || preset === 'None') return false;
        if (!startDate || !endDate) {
            showToast('Please select both a start date and an end date for the repetition.');
            return false;
        }

        const tasksToGenerate = [];
        const end = dayjs(endDate).endOf('day');
        
        // Anchor to the original task's due date so day-of-month, day-of-week, etc. are preserved from the task
        const taskDueDate = formData?.completionDate || formData?.date || originalTask?.completionDate || originalTask?.dateString || startDate;
        const configWithContext = { ...repeatConfig, _anchorDate: taskDueDate, _originalStartDate: taskDueDate };
        let currentIterDate = dayjs(startDate);

        if (currentIterDate.isAfter(end)) {
            showToast('End date must be after the start date.');
            return false;
        }

        const seriesId = originalTask.recurringSeriesId || ('series_' + Date.now().toString() + Math.random().toString(36).substr(2, 9));

        // Deep copy description & attachments
        const descAttachments = formData.description?.attachments 
            ? JSON.parse(JSON.stringify(formData.description.attachments))
            : (formData.attachments 
                ? JSON.parse(JSON.stringify(formData.attachments))
                : (originalTask.description?.attachments 
                    ? JSON.parse(JSON.stringify(originalTask.description.attachments)) 
                    : []));

        const descText = formData.description?.text !== undefined 
            ? formData.description.text 
            : (formData.descriptionText !== undefined 
                ? formData.descriptionText 
                : (originalTask.description?.text || ''));

        const descImg = formData.description?.img !== undefined 
            ? formData.description.img 
            : (formData.descriptionImg !== undefined 
                ? formData.descriptionImg 
                : (originalTask.description?.img || ''));

        const descUrl = formData.description?.url !== undefined 
            ? formData.description.url 
            : (formData.descriptionUrl !== undefined 
                ? formData.descriptionUrl 
                : (originalTask.description?.url || ''));

        const sourceSubtasks = formData.subtasks !== undefined 
            ? formData.subtasks 
            : (originalTask.subtasks || []);

        // We do NOT want to spawn 10,000 tasks and crash the app. Set a hard limit.
        let safeguardCount = 0;
        const MAX_TASKS = 730; // Max 2 years of daily tasks

        while (true) {
            currentIterDate = getNextDate(currentIterDate, configWithContext);

            if (currentIterDate.isAfter(end)) break;

            // Skip duplicating the original task if an occurrence lands on the exact same date
            if (currentIterDate.isSame(dayjs(taskDueDate), 'day')) {
                continue;
            }
            
            safeguardCount++;
            if (safeguardCount > MAX_TASKS) {
                showToast(`Only the first ${MAX_TASKS} recurring tasks were generated to preserve performance.`);
                break;
            }

            const newTaskId = new Date().getTime().toString() + Math.random().toString(36).substr(2, 9);
            
            // Generate unique IDs for subtasks in new recurring instance
            const clonedSubtasks = sourceSubtasks.map(st => ({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 7),
                text: st.text,
                completed: false
            }));

            tasksToGenerate.push({
                id: newTaskId,
                boardId: originalTask.boardId || 'main',
                taskname: formData.name || originalTask.taskname,
                priority: formData.priority !== undefined ? (formData.priority === 'None' ? '' : formData.priority) : (originalTask.priority || ''),
                completed: false,
                completionDate: currentIterDate.toISOString(),
                dateString: currentIterDate.format('YYYY-MM-DD'),
                time: formData.time !== undefined ? formData.time : (originalTask.time || null),
                reminder: formData.reminder !== undefined ? formData.reminder : (originalTask.reminder || 'None'),
                isAlarm: formData.isAlarm !== undefined ? formData.isAlarm : (originalTask.isAlarm || false),
                description: {
                    text: descText,
                    img: descImg,
                    url: descUrl,
                    attachments: JSON.parse(JSON.stringify(descAttachments))
                },
                subtasks: clonedSubtasks,
                recurringSeriesId: seriesId,
                isRecurring: true,
                repeatFrequency: repeatConfig.preset,
                repeatConfig: repeatConfig,
                repeatStartDate: startDate,
                repeatEndDate: endDate,
                lastUpdatedDate: new Date().toISOString()
            });
        }

        if (tasksToGenerate.length > 0) {
            dispatch(addMultipleTasks({ tasks: tasksToGenerate }));
            showToast(`Successfully generated ${tasksToGenerate.length} recurring tasks!`);
            return { success: true, seriesId };
        } else {
            showToast('No tasks were generated. The end date might be too close to the start date.');
            return { success: false, seriesId };
        }
    };

    return { generateRepeatingTasks };
};
