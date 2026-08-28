import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Platform, Alert } from 'react-native';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { updateRecurringAutomations } from '../utils/notifications';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

// import axios from 'axios';

/* --- VERCEL BACKEND THUNKS (COMMENTED OUT FOR LOCAL-ONLY MODE) ---
export const fetchTasks = createAsyncThunk('task/fetchTasks', async (_) => {
    const response = await axios.get('/api/tasks', { withCredentials: true });
    return response.data;
});

export const addTaskAsync = createAsyncThunk('task/addTaskAsync', async (task) => {
    const response = await axios.post('/api/tasks', task, { withCredentials: true });
    return response.data;
});

export const addMultipleTasksAsync = createAsyncThunk('task/addMultipleTasksAsync', async (tasks) => {
    const response = await axios.post('/api/tasks/bulk', { tasks }, { withCredentials: true });
    return response.data;
});

export const updateTaskAsync = createAsyncThunk('task/updateTaskAsync', async (updateData) => {
    const { taskId, name, priority, completed, description, completionDate, time } = updateData;

    const payload = {};
    if (name !== undefined) payload.taskname = name;
    if (priority !== undefined) payload.priority = priority;
    if (completed !== undefined) payload.completed = completed;
    if (completionDate !== undefined) payload.completionDate = completionDate;
    if (time !== undefined) payload.time = time;
    if (updateData.reminder !== undefined) payload.reminder = updateData.reminder;
    if (updateData.notificationId !== undefined) payload.notificationId = updateData.notificationId;
    if (description !== undefined) {
        payload.description = { text: description.text || '', img: description.img || '', url: description.url || '' };
    }
    payload.lastUpdatedDate = new Date().toISOString();

    await axios.put(`/api/tasks/${taskId}`, payload, { withCredentials: true });
    
    return { taskId, payload };
});

export const deleteTaskAsync = createAsyncThunk('task/deleteTaskAsync', async (taskId) => {
    await axios.delete(`/api/tasks/${taskId}`, { withCredentials: true });
    return taskId;
});
--- */

export const fetchTasks = createAsyncThunk('task/fetchTasks', async (_) => {
    try {
        const tasksJson = await AsyncStorage.getItem('tasks');
        return tasksJson ? JSON.parse(tasksJson) : [];
    } catch (e) {
        return [];
    }
});

const loadGuestTasksFromLocalStorage = () => [];

const initialState = {
    tasks: [], // Initially empty, will be loaded on boot based on auth state
    loading: false,
    error: null,
    pendingCleanupTaskIds: [],
};

const taskSlice = createSlice({
    name: 'task',
    initialState,
    reducers: {
        hydrateTaskState: (state, action) => {
            state.tasks = action.payload;
        },
        addTaskSync(state, action) {
            const { task } = action.payload;
            state.tasks.push(task); 
        },
        addMultipleTasksSync(state, action) {
            const { tasks } = action.payload;
            state.tasks.push(...tasks);
        },
        deleteTaskSync(state, action) {
             const { taskId } = action.payload;
             state.tasks = state.tasks.filter(t => t.id !== taskId);
        },
        deleteTasksByBoardSync(state, action) {
            const { boardId } = action.payload;
            state.tasks = state.tasks.filter(t => (t.boardId || 'main') !== boardId);
        },
        updateTaskSync(state, action) {
            const { taskId, name, priority, completed, description, completionDate, time, subtasks } = action.payload;
            const task = state.tasks.find(task => task.id === taskId);
            if (task) {
                task.taskname = name !== undefined ? name : task.taskname;
                task.priority = priority !== undefined ? priority : task.priority;
                task.completed = completed !== undefined ? completed : task.completed;
                task.completionDate = completionDate !== undefined ? completionDate : task.completionDate;
                task.time = time !== undefined ? time : task.time;
                task.reminder = action.payload.reminder !== undefined ? action.payload.reminder : task.reminder;
                if (action.payload.boardId !== undefined) task.boardId = action.payload.boardId;
                if (action.payload.isAlarm !== undefined) task.isAlarm = action.payload.isAlarm;
                task.notificationId = action.payload.notificationId !== undefined ? action.payload.notificationId : task.notificationId;
                if (action.payload.recurringSeriesId !== undefined) task.recurringSeriesId = action.payload.recurringSeriesId;
                if (action.payload.isRecurring !== undefined) task.isRecurring = action.payload.isRecurring;
                if (action.payload.repeatFrequency !== undefined) task.repeatFrequency = action.payload.repeatFrequency;
                if (action.payload.repeatConfig !== undefined) task.repeatConfig = action.payload.repeatConfig;
                if (action.payload.repeatStartDate !== undefined) task.repeatStartDate = action.payload.repeatStartDate;
                if (action.payload.repeatEndDate !== undefined) task.repeatEndDate = action.payload.repeatEndDate;
                if (action.payload.isNagMode !== undefined) task.isNagMode = action.payload.isNagMode;
                if (action.payload.escalationLevel !== undefined) task.escalationLevel = action.payload.escalationLevel;
                if (description) {
                    task.description = {
                        text: description.text !== undefined ? description.text : (task.description?.text || ''),
                        img: description.img !== undefined ? description.img : (task.description?.img || ''),
                        url: description.url !== undefined ? description.url : (task.description?.url || ''),
                        attachments: description.attachments !== undefined ? description.attachments : (task.description?.attachments || []),
                    };
                }
                if (subtasks !== undefined) {
                    task.subtasks = subtasks;
                }
                task.lastUpdatedDate = new Date().toISOString();
            }
        },
        updateRecurringSeriesSync(state, action) {
            const { seriesId, fromDate, updates } = action.payload;
            if (!seriesId) return;
            const fromDay = fromDate ? dayjs(fromDate).startOf('day') : null;
            
            state.tasks = state.tasks.map(task => {
                if (task.recurringSeriesId === seriesId) {
                    const taskDay = task.completionDate ? dayjs(task.completionDate).startOf('day') : null;
                    if (!fromDay || (taskDay && (taskDay.isSame(fromDay, 'day') || taskDay.isAfter(fromDay)))) {
                        const updated = { ...task };
                        if (updates.name !== undefined) updated.taskname = updates.name;
                        if (updates.priority !== undefined) updated.priority = updates.priority;
                        if (updates.time !== undefined) updated.time = updates.time;
                        if (updates.reminder !== undefined) updated.reminder = updates.reminder;
                        if (updates.boardId !== undefined) updated.boardId = updates.boardId;
                        if (updates.isAlarm !== undefined) updated.isAlarm = updates.isAlarm;
                        if (updates.description !== undefined) {
                            updated.description = {
                                text: updates.description.text !== undefined ? updates.description.text : (task.description?.text || ''),
                                img: updates.description.img !== undefined ? updates.description.img : (task.description?.img || ''),
                                url: updates.description.url !== undefined ? updates.description.url : (task.description?.url || ''),
                                attachments: updates.description.attachments ? JSON.parse(JSON.stringify(updates.description.attachments)) : (task.description?.attachments || [])
                            };
                        }
                        if (updates.subtasks !== undefined) {
                            updated.subtasks = updates.subtasks.map(s => ({
                                id: Date.now().toString() + Math.random().toString(36).substring(7),
                                text: s.text,
                                completed: false
                            }));
                        }
                        if (updates.repeatConfig !== undefined) updated.repeatConfig = updates.repeatConfig;
                        if (updates.repeatFrequency !== undefined) updated.repeatFrequency = updates.repeatFrequency;
                        if (updates.repeatStartDate !== undefined) updated.repeatStartDate = updates.repeatStartDate;
                        if (updates.repeatEndDate !== undefined) updated.repeatEndDate = updates.repeatEndDate;
                        updated.lastUpdatedDate = new Date().toISOString();
                        return updated;
                    }
                }
                return task;
            });
        },
        deleteRecurringSeriesSync(state, action) {
            const { seriesId, fromDate } = action.payload;
            if (!seriesId) return;
            const fromDay = fromDate ? dayjs(fromDate).startOf('day') : null;
            state.tasks = state.tasks.filter(task => {
                if (task.recurringSeriesId === seriesId) {
                    if (!fromDay) return false;
                    const taskDay = task.completionDate ? dayjs(task.completionDate).startOf('day') : null;
                    if (taskDay && (taskDay.isSame(fromDay, 'day') || taskDay.isAfter(fromDay))) {
                        return false;
                    }
                }
                return true;
            });
        },
        clearTasks(state) {
            state.tasks = [];
        },
        loadGuestTasks(state) {
            state.tasks = loadGuestTasksFromLocalStorage();
        },
        setPendingCleanupTaskIds(state, action) {
            state.pendingCleanupTaskIds = action.payload;
        },
        clearPendingCleanupTaskIds(state) {
            state.pendingCleanupTaskIds = [];
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchTasks.pending, (state) => { state.loading = true; })
            .addCase(fetchTasks.fulfilled, (state, action) => {
                state.loading = false;
                state.tasks = action.payload;
            })
            .addCase(fetchTasks.rejected, (state, action) => { state.loading = false; state.error = action.error.message; });
    }
});

export const { hydrateTaskState, addTaskSync, addMultipleTasksSync, deleteTaskSync, deleteTasksByBoardSync, updateTaskSync, updateRecurringSeriesSync, deleteRecurringSeriesSync, clearTasks, loadGuestTasks, setPendingCleanupTaskIds, clearPendingCleanupTaskIds } = taskSlice.actions;

const syncRecurringAutomations = (getState) => {
    try {
        const state = getState();
        const themeState = state.themeReducer;
        const tasks = state.taskReducer.tasks;
        updateRecurringAutomations(themeState, tasks);
    } catch (e) {
        // Silently catch in case of issues
    }
};

export const addTask = (payload) => async (dispatch, getState) => {
    const state = getState();
    const themeState = state.themeReducer;
    if (themeState?.defaultReminderEnabled && payload?.task && (!payload.task.reminder || payload.task.reminder === 'None')) {
        payload.task.reminder = themeState.defaultReminderTime || '15 min before';
    }
    dispatch(addTaskSync(payload)); 
    const tasks = getState().taskReducer.tasks;
    await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
    syncRecurringAutomations(getState);
};

export const addMultipleTasks = (payload) => async (dispatch, getState) => {
    const state = getState();
    const themeState = state.themeReducer;
    if (themeState?.defaultReminderEnabled && Array.isArray(payload?.tasks)) {
        payload.tasks.forEach(task => {
            if (task && (!task.reminder || task.reminder === 'None')) {
                task.reminder = themeState.defaultReminderTime || '15 min before';
            }
        });
    }
    dispatch(addMultipleTasksSync(payload));
    const tasks = getState().taskReducer.tasks;
    await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
    syncRecurringAutomations(getState);
};

export const deleteTask = (payload) => async (dispatch, getState) => {
    dispatch(deleteTaskSync(payload));
    const tasks = getState().taskReducer.tasks;
    await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
    syncRecurringAutomations(getState);
    // dispatch(deleteTaskAsync(payload.taskId));
};

export const deleteTasksByBoard = (boardId) => async (dispatch, getState) => {
    dispatch(deleteTasksByBoardSync({ boardId }));
    const tasks = getState().taskReducer.tasks;
    await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
    syncRecurringAutomations(getState);
};

export const updateTask = (payload) => async (dispatch, getState) => {
    dispatch(updateTaskSync(payload));
    const tasks = getState().taskReducer.tasks;
    await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
    syncRecurringAutomations(getState);
    // dispatch(updateTaskAsync(payload));
};

export const updateRecurringSeries = (payload) => async (dispatch, getState) => {
    dispatch(updateRecurringSeriesSync(payload));
    const tasks = getState().taskReducer.tasks;
    await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
    syncRecurringAutomations(getState);
};

export const deleteRecurringSeries = (payload) => async (dispatch, getState) => {
    dispatch(deleteRecurringSeriesSync(payload));
    const tasks = getState().taskReducer.tasks;
    await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
    syncRecurringAutomations(getState);
};

export const processAutoManageTasks = () => async (dispatch, getState) => {
    const state = getState();
    const tasks = state.taskReducer.tasks;
    const themeState = state.themeReducer;
    const boardAutomations = themeState.boardAutomations || {};
    
    const globalSettings = {
        autoTransferMode: themeState.autoTransferMode || 'none',
        increasePriorityWhenOverdue: themeState.increasePriorityWhenOverdue || false,
        priorityFrequency: themeState.priorityFrequency || 'never',
        removePriorityWhenCompleted: themeState.removePriorityWhenCompleted || false,
        autoDeleteOverdueDays: themeState.autoDeleteOverdueDays !== undefined ? themeState.autoDeleteOverdueDays : 0,
        autoDeleteCompletedDays: themeState.autoDeleteCompletedDays !== undefined ? themeState.autoDeleteCompletedDays : 0,
        confirmBeforeDeletion: themeState.confirmBeforeDeletion !== undefined ? themeState.confirmBeforeDeletion : true,
        autoRescheduleTime: themeState.autoRescheduleTime || '09:00'
    };
    
    const actualToday = dayjs().startOf('day');

    let hasChanges = false;
    let newTasks = [...tasks];
    let tasksToDelete = [];
    
    newTasks = newTasks.map(task => {
        let updatedTask = { ...task };
        let taskChanged = false;
        const taskDate = dayjs(task.completionDate).startOf('day');

        // Check if board has custom automation override
        const taskBoardId = task.boardId || 'main';
        const boardCustom = boardAutomations[taskBoardId];
        const isOverride = boardCustom && boardCustom.overrideGlobal !== false;

        const effectiveAutoTransferMode = isOverride ? boardCustom.autoTransferMode : globalSettings.autoTransferMode;
        const effectiveIncreasePriorityWhenOverdue = isOverride ? boardCustom.increasePriorityWhenOverdue : globalSettings.increasePriorityWhenOverdue;
        const effectivePriorityFrequency = isOverride ? boardCustom.priorityFrequency : globalSettings.priorityFrequency;
        const effectiveRemovePriorityWhenCompleted = isOverride ? boardCustom.removePriorityWhenCompleted : globalSettings.removePriorityWhenCompleted;
        const effectiveAutoDeleteOverdueDays = isOverride ? (boardCustom.autoDeleteOverdueDays !== undefined ? boardCustom.autoDeleteOverdueDays : 0) : globalSettings.autoDeleteOverdueDays;
        const effectiveAutoDeleteCompletedDays = isOverride ? (boardCustom.autoDeleteCompletedDays !== undefined ? boardCustom.autoDeleteCompletedDays : 0) : globalSettings.autoDeleteCompletedDays;
        const effectiveAutoRescheduleTime = isOverride ? (boardCustom.autoRescheduleTime || '09:00') : globalSettings.autoRescheduleTime;

        const [rescheduleHour, rescheduleMinute] = (effectiveAutoRescheduleTime || '00:00').split(':').map(Number);
        const rescheduleTimeToday = dayjs().hour(rescheduleHour || 0).minute(rescheduleMinute || 0).second(0).millisecond(0);
        const effectiveToday = dayjs().isBefore(rescheduleTimeToday) ? actualToday.subtract(1, 'day') : actualToday;

        if (updatedTask.completed) {
            if (effectiveRemovePriorityWhenCompleted && updatedTask.priority !== 'none') {
                updatedTask.priority = 'none';
                taskChanged = true;
            }
            if (effectiveAutoDeleteCompletedDays > 0) {
                const daysOld = actualToday.diff(taskDate, 'day');
                if (daysOld >= effectiveAutoDeleteCompletedDays) {
                    tasksToDelete.push(updatedTask.id);
                }
            }
        } 
        else if (taskDate.isBefore(effectiveToday)) {
            const daysOverdue = actualToday.diff(taskDate, 'day');
            if (effectiveAutoDeleteOverdueDays > 0 && daysOverdue >= effectiveAutoDeleteOverdueDays) {
                tasksToDelete.push(updatedTask.id);
            } 
            else {
                let priorityDidIncrease = false;

                if (effectiveIncreasePriorityWhenOverdue) {
                    // Logic based on accumulating days overdue
                    if (effectivePriorityFrequency === 'daily') {
                        if (daysOverdue >= 2 && updatedTask.priority !== 'high') {
                            updatedTask.priority = 'high';
                            taskChanged = true;
                            priorityDidIncrease = true;
                        } else if (daysOverdue === 1 && (updatedTask.priority === 'none' || updatedTask.priority === 'low')) {
                            updatedTask.priority = 'medium';
                            taskChanged = true;
                            priorityDidIncrease = true;
                        }
                    } else if (effectivePriorityFrequency === 'weekly') {
                        if (daysOverdue >= 14 && updatedTask.priority !== 'high') {
                            updatedTask.priority = 'high';
                            taskChanged = true;
                            priorityDidIncrease = true;
                        } else if (daysOverdue >= 7 && (updatedTask.priority === 'none' || updatedTask.priority === 'low')) {
                            updatedTask.priority = 'medium';
                            taskChanged = true;
                            priorityDidIncrease = true;
                        }
                    } else if (effectivePriorityFrequency === 'never' || !effectivePriorityFrequency) {
                        if (updatedTask.priority === 'none' || updatedTask.priority === 'low') {
                            updatedTask.priority = 'medium';
                            taskChanged = true;
                            priorityDidIncrease = true;
                        }
                    }
                }
                
                if (effectiveAutoTransferMode && effectiveAutoTransferMode !== 'none') {
                    // If we are auto-transferring an overdue task, immediately bump its priority 
                    // (since it won't be able to accumulate daysOverdue).
                    if (effectiveIncreasePriorityWhenOverdue && !priorityDidIncrease && updatedTask.priority !== 'high') {
                        if (updatedTask.priority === 'none' || updatedTask.priority === 'low') {
                            updatedTask.priority = 'medium';
                        } else if (updatedTask.priority === 'medium') {
                            updatedTask.priority = 'high';
                        }
                        taskChanged = true;
                    }

                    let targetDate = actualToday;
                    if (effectiveAutoTransferMode === 'tomorrow') {
                        targetDate = targetDate.add(1, 'day');
                    } else if (effectiveAutoTransferMode === 'next_workday') {
                        while (targetDate.day() === 0 || targetDate.day() === 6) {
                            targetDate = targetDate.add(1, 'day');
                        }
                    }
                    updatedTask.completionDate = targetDate.toISOString();
                    taskChanged = true;
                }
            }
        }
        
        if (taskChanged) {
            hasChanges = true;
            return updatedTask;
        }
        return task;
    });

    if (tasksToDelete.length > 0 && !confirmBeforeDeletion) {
        newTasks = newTasks.filter(t => !tasksToDelete.includes(t.id));
        hasChanges = true;
    }

    if (hasChanges) {
        dispatch(hydrateTaskState(newTasks));
        await AsyncStorage.setItem('tasks', JSON.stringify(newTasks));
    }

    if (tasksToDelete.length > 0 && confirmBeforeDeletion) {
        dispatch(setPendingCleanupTaskIds(tasksToDelete));
    }

    syncRecurringAutomations(getState);
};

export const executePendingCleanup = () => async (dispatch, getState) => {
    const state = getState();
    const tasksToDelete = state.taskReducer.pendingCleanupTaskIds;
    if (tasksToDelete && tasksToDelete.length > 0) {
        const currentTasks = state.taskReducer.tasks;
        const finalTasks = currentTasks.filter(t => !tasksToDelete.includes(t.id));
        dispatch(hydrateTaskState(finalTasks));
        await AsyncStorage.setItem('tasks', JSON.stringify(finalTasks));
        syncRecurringAutomations(getState);
    }
    dispatch(clearPendingCleanupTaskIds());
};

export const cancelPendingCleanup = () => (dispatch) => {
    dispatch(clearPendingCleanupTaskIds());
};

export default taskSlice.reducer;
