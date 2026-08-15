import { useDispatch } from 'react-redux';
import { addMultipleTasks } from '../features/taskSlice';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { Alert } from 'react-native';

dayjs.extend(isoWeek);

export const useTaskRepeat = () => {
    const dispatch = useDispatch();

    const getNextDate = (current, config) => {
        let next = current.clone();
        const { preset, customFreq, customInterval, customDaysOfWeek, customMonthlyType, customNthWeekday } = config;

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
        if (preset === 'every_week') return next.add(1, 'week');
        if (preset === 'every_2_weeks') return next.add(2, 'week');
        if (preset === 'every_month') return next.add(1, 'month');
        if (preset === 'every_year') return next.add(1, 'year');

        // CUSTOM
        if (preset === 'custom') {
            const interval = parseInt(customInterval, 10) || 1;
            
            if (customFreq === 'days') return next.add(interval, 'day');
            if (customFreq === 'years') return next.add(interval, 'year');
            
            if (customFreq === 'weeks') {
                if (!customDaysOfWeek || customDaysOfWeek.length === 0) {
                    return next.add(interval, 'week');
                }
                
                // Find next matching day in the current week
                for (let i = 1; i <= 7; i++) {
                    let candidate = next.add(i, 'day');
                    // If we crossed into a new week, jump forward by (interval - 1) weeks
                    // dayjs week usually starts on Sunday, let's use isoWeek (Monday start) or just check if we passed a Sunday
                    if (candidate.day() === 1 && i > 1) { // Crossed into Monday
                        candidate = candidate.add((interval - 1), 'week');
                    }
                    
                    if (customDaysOfWeek.includes(candidate.day())) {
                        return candidate;
                    }
                }
                return next.add(interval, 'week'); // Fallback
            }

            if (customFreq === 'months') {
                const targetMonth = next.add(interval, 'month').startOf('month');
                
                if (customMonthlyType === 'same_day') {
                    // Try to preserve the original date (e.g., 31st), clamped to month length
                    const originalDate = config._originalStartDate ? dayjs(config._originalStartDate).date() : next.date();
                    const target = next.add(interval, 'month');
                    return target.date(Math.min(originalDate, target.daysInMonth())); 
                } 
                else if (customMonthlyType === 'last_day') {
                    return targetMonth.endOf('month').startOf('day');
                }
                else if (customMonthlyType === 'first_workday') {
                    let candidate = targetMonth.clone();
                    while (candidate.day() === 0 || candidate.day() === 6) {
                        candidate = candidate.add(1, 'day');
                    }
                    return candidate;
                }
                else if (customMonthlyType === 'nth_weekday' && customNthWeekday) {
                    const { n, weekday } = customNthWeekday; // e.g. 2nd (n=2) Tuesday (weekday=2)
                    let count = 0;
                    let candidate = targetMonth.clone();
                    while (candidate.month() === targetMonth.month()) {
                        if (candidate.day() === weekday) {
                            count++;
                            if (count === n) return candidate;
                        }
                        candidate = candidate.add(1, 'day');
                    }
                    return targetMonth; // Fallback
                }
                
                return next.add(interval, 'month');
            }
        }
        
        return next.add(1, 'day'); // Ultimate fallback
    };

    const generateRepeatingTasks = (originalTask, formData, repeatConfig) => {
        const { preset, startDate, endDate } = repeatConfig;
        if (!preset || preset === 'None') return false;
        if (!startDate || !endDate) {
            Alert.alert('Error', 'Please select both a start date and an end date for the repetition.');
            return false;
        }

        const tasksToGenerate = [];
        const end = dayjs(endDate).endOf('day');
        
        // Ensure config has a reference to the original date for exact monthly repeats
        const configWithContext = { ...repeatConfig, _originalStartDate: startDate };
        let currentIterDate = dayjs(startDate);

        if (currentIterDate.isAfter(end)) {
            Alert.alert('Error', 'End date must be after the start date.');
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
            
            safeguardCount++;
            if (safeguardCount > MAX_TASKS) {
                Alert.alert('Limit Reached', `Only the first ${MAX_TASKS} recurring tasks were generated to preserve performance.`);
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
            Alert.alert('Success', `Successfully generated ${tasksToGenerate.length} recurring tasks!`);
            return { success: true, seriesId };
        } else {
            Alert.alert('Notice', 'No tasks were generated. The end date might be too close to the start date.');
            return { success: false, seriesId };
        }
    };

    return { generateRepeatingTasks };
};
