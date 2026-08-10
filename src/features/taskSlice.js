import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Platform, Alert } from 'react-native';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isSameOrBefore);

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
                if (action.payload.isAlarm !== undefined) task.isAlarm = action.payload.isAlarm;
                task.notificationId = action.payload.notificationId !== undefined ? action.payload.notificationId : task.notificationId;
                if (action.payload.repeatFrequency !== undefined) task.repeatFrequency = action.payload.repeatFrequency;
                if (action.payload.repeatConfig !== undefined) task.repeatConfig = action.payload.repeatConfig;
                if (action.payload.repeatStartDate !== undefined) task.repeatStartDate = action.payload.repeatStartDate;
                if (action.payload.repeatEndDate !== undefined) task.repeatEndDate = action.payload.repeatEndDate;
                if (action.payload.isNagMode !== undefined) task.isNagMode = action.payload.isNagMode;
                if (action.payload.escalationLevel !== undefined) task.escalationLevel = action.payload.escalationLevel;
                if (description) {
                    task.description = {
                        text: description.text || '',
                        img: description.img || '',
                        url: description.url || '',
                        attachments: description.attachments || task.description?.attachments || [],
                    };
                }
                if (subtasks !== undefined) {
                    task.subtasks = subtasks;
                }
                task.lastUpdatedDate = new Date().toISOString();
            }
        },
        clearTasks(state) {
            state.tasks = [];
        },
        loadGuestTasks(state) {
            state.tasks = loadGuestTasksFromLocalStorage();
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

export const { hydrateTaskState, addTaskSync, addMultipleTasksSync, deleteTaskSync, deleteTasksByBoardSync, updateTaskSync, clearTasks, loadGuestTasks } = taskSlice.actions;



export const addTask = (payload) => async (dispatch, getState) => {
    dispatch(addTaskSync(payload)); 
    const tasks = getState().taskReducer.tasks;
    await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
    // dispatch(addTaskAsync(payload.task)); 
};

export const addMultipleTasks = (payload) => async (dispatch, getState) => {
    dispatch(addMultipleTasksSync(payload));
    const tasks = getState().taskReducer.tasks;
    await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
    // dispatch(addMultipleTasksAsync(payload.tasks));
};

export const deleteTask = (payload) => async (dispatch, getState) => {
    dispatch(deleteTaskSync(payload));
    const tasks = getState().taskReducer.tasks;
    await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
    // dispatch(deleteTaskAsync(payload.taskId));
};

export const deleteTasksByBoard = (boardId) => async (dispatch, getState) => {
    dispatch(deleteTasksByBoardSync({ boardId }));
    const tasks = getState().taskReducer.tasks;
    await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
};

export const updateTask = (payload) => async (dispatch, getState) => {
    dispatch(updateTaskSync(payload));
    const tasks = getState().taskReducer.tasks;
    await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
    // dispatch(updateTaskAsync(payload));
};

export const processAutoManageTasks = () => async (dispatch, getState) => {
    const state = getState();
    const tasks = state.taskReducer.tasks;
    const themeState = state.themeReducer;
    
    const {
        autoTransferMode,
        increasePriorityWhenOverdue,
        priorityFrequency,
        removePriorityWhenCompleted,
        autoDeleteOverdueDays,
        autoDeleteCompletedDays,
        confirmBeforeDeletion
    } = themeState;
    
    const today = dayjs().startOf('day');
    let hasChanges = false;
    let newTasks = [...tasks];
    let tasksToDelete = [];
    
    newTasks = newTasks.map(task => {
        let updatedTask = { ...task };
        let taskChanged = false;
        const taskDate = dayjs(task.completionDate).startOf('day');
        
        if (updatedTask.completed) {
            if (removePriorityWhenCompleted && updatedTask.priority !== 'none') {
                updatedTask.priority = 'none';
                taskChanged = true;
            }
            if (autoDeleteCompletedDays > 0) {
                const daysOld = today.diff(taskDate, 'day');
                if (daysOld >= autoDeleteCompletedDays) {
                    tasksToDelete.push(updatedTask.id);
                }
            }
        } 
        else if (taskDate.isBefore(today)) {
            const daysOverdue = today.diff(taskDate, 'day');
            if (autoDeleteOverdueDays > 0 && daysOverdue >= autoDeleteOverdueDays) {
                tasksToDelete.push(updatedTask.id);
            } 
            else {
                let priorityDidIncrease = false;

                if (increasePriorityWhenOverdue) {
                    // Logic based on accumulating days overdue
                    if (priorityFrequency === 'daily') {
                        if (daysOverdue >= 2 && updatedTask.priority !== 'high') {
                            updatedTask.priority = 'high';
                            taskChanged = true;
                            priorityDidIncrease = true;
                        } else if (daysOverdue === 1 && (updatedTask.priority === 'none' || updatedTask.priority === 'low')) {
                            updatedTask.priority = 'medium';
                            taskChanged = true;
                            priorityDidIncrease = true;
                        }
                    } else if (priorityFrequency === 'weekly') {
                        if (daysOverdue >= 14 && updatedTask.priority !== 'high') {
                            updatedTask.priority = 'high';
                            taskChanged = true;
                            priorityDidIncrease = true;
                        } else if (daysOverdue >= 7 && (updatedTask.priority === 'none' || updatedTask.priority === 'low')) {
                            updatedTask.priority = 'medium';
                            taskChanged = true;
                            priorityDidIncrease = true;
                        }
                    } else if (priorityFrequency === 'never' || !priorityFrequency) {
                        if (updatedTask.priority === 'none' || updatedTask.priority === 'low') {
                            updatedTask.priority = 'medium';
                            taskChanged = true;
                            priorityDidIncrease = true;
                        }
                    }
                }
                
                if (autoTransferMode && autoTransferMode !== 'none') {
                    // If we are auto-transferring an overdue task, immediately bump its priority 
                    // (since it won't be able to accumulate daysOverdue).
                    if (increasePriorityWhenOverdue && !priorityDidIncrease && updatedTask.priority !== 'high') {
                        if (updatedTask.priority === 'none' || updatedTask.priority === 'low') {
                            updatedTask.priority = 'medium';
                        } else if (updatedTask.priority === 'medium') {
                            updatedTask.priority = 'high';
                        }
                        taskChanged = true;
                    }

                    let targetDate = today;
                    if (autoTransferMode === 'tomorrow') {
                        targetDate = targetDate.add(1, 'day');
                    } else if (autoTransferMode === 'next_workday') {
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
        Alert.alert(
            "Automatic Cleanup",
            `You have ${tasksToDelete.length} old task(s) scheduled for automatic deletion based on your settings. Do you want to delete them?`,
            [
                { text: "Keep Them", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive", 
                    onPress: async () => {
                        const finalTasks = newTasks.filter(t => !tasksToDelete.includes(t.id));
                        dispatch(hydrateTaskState(finalTasks));
                        await AsyncStorage.setItem('tasks', JSON.stringify(finalTasks));
                    }
                }
            ]
        );
    }
};

export default taskSlice.reducer;
