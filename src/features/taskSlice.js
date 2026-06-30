import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import axios from 'axios';

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
        updateTaskSync(state, action) {
            const { taskId, name, priority, completed, description, completionDate, time } = action.payload;
            const task = state.tasks.find(task => task.id === taskId);
            if (task) {
                task.taskname = name !== undefined ? name : task.taskname;
                task.priority = priority !== undefined ? priority : task.priority;
                task.completed = completed !== undefined ? completed : task.completed;
                task.completionDate = completionDate !== undefined ? completionDate : task.completionDate;
                task.time = time !== undefined ? time : task.time;
                task.reminder = action.payload.reminder !== undefined ? action.payload.reminder : task.reminder;
                task.notificationId = action.payload.notificationId !== undefined ? action.payload.notificationId : task.notificationId;
                if (description) {
                    task.description = {
                        text: description.text || '',
                        img: description.img || '',
                        url: description.url || '',
                    };
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

export const { hydrateTaskState, addTaskSync, addMultipleTasksSync, deleteTaskSync, updateTaskSync, clearTasks, loadGuestTasks } = taskSlice.actions;

export const addTask = (payload) => (dispatch) => {
    dispatch(addTaskSync(payload)); 
    dispatch(addTaskAsync(payload.task)); 
};

export const addMultipleTasks = (payload) => (dispatch) => {
    dispatch(addMultipleTasksSync(payload));
    dispatch(addMultipleTasksAsync(payload.tasks));
};

export const deleteTask = (payload) => (dispatch) => {
    dispatch(deleteTaskSync(payload));
    dispatch(deleteTaskAsync(payload.taskId));
};

export const updateTask = (payload) => (dispatch) => {
    dispatch(updateTaskSync(payload));
    dispatch(updateTaskAsync(payload));
};

export default taskSlice.reducer;
