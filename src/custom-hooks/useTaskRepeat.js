import { useDispatch } from 'react-redux';
import { addMultipleTasks } from '../features/taskSlice';
import dayjs from 'dayjs';
import { Alert } from 'react-native';

export const useTaskRepeat = () => {
    const dispatch = useDispatch();

    const generateRepeatingTasks = (originalTask, formData, repeatConfig) => {
        const { frequency, startDate, endDate } = repeatConfig;
        if (!frequency || frequency === 'None') return false;
        if (!startDate || !endDate) {
            Alert.alert('Error', 'Please select both a start date and an end date for the repetition.');
            return false;
        }

        const tasksToGenerate = [];
        const end = dayjs(endDate).endOf('day');
        let currentIterDate = dayjs(startDate);

        if (currentIterDate.isAfter(end)) {
            Alert.alert('Error', 'End date must be after the start date.');
            return false;
        }

        while (true) {
            if (frequency === 'Daily') {
                currentIterDate = currentIterDate.add(1, 'day');
            } else if (frequency === 'Weekly') {
                currentIterDate = currentIterDate.add(1, 'week');
            } else if (frequency === 'Monthly') {
                currentIterDate = currentIterDate.add(1, 'month');
            }

            if (currentIterDate.isAfter(end)) break;

            const newTaskId = new Date().getTime().toString() + Math.random().toString(36).substr(2, 9);
            tasksToGenerate.push({
                id: newTaskId,
                boardId: originalTask.boardId || 'main',
                taskname: formData.name || originalTask.taskname,
                priority: formData.priority === 'None' ? '' : formData.priority || originalTask.priority,
                completed: false,
                completionDate: currentIterDate.toISOString(),
                time: formData.time || originalTask.time,
                description: {
                    text: formData.descriptionText || originalTask.description?.text || '',
                    img: formData.descriptionImg || originalTask.description?.img || '',
                    url: formData.descriptionUrl || originalTask.description?.url || '',
                },
                lastUpdatedDate: new Date().toISOString()
            });
        }

        if (tasksToGenerate.length > 0) {
            dispatch(addMultipleTasks({ tasks: tasksToGenerate }));
            Alert.alert('Success', `Successfully generated ${tasksToGenerate.length} recurring tasks!`);
            return true;
        } else {
            Alert.alert('Notice', 'No tasks were generated. The end date might be too close to the start date.');
            return false;
        }
    };

    return { generateRepeatingTasks };
};
