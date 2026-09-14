import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Platform, Alert } from 'react-native';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { updateRecurringAutomations, cancelNotification, scheduleTaskReminder } from '../utils/notifications';
import axios from 'axios';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

export const getTaskStorageKey = (state) => {
    const userState = state?.userReducer || state;
    if (userState?.isAuthenticated && userState?.userEmail) {
        return `tasks_${userState.userEmail.toLowerCase().trim()}`;
    }
    if (userState?.isGuest) {
        return 'tasks_guest';
    }
    return 'tasks';
};

const mergeTasks = (currentTasks = [], incomingTasks = []) => {
    const taskMap = new Map();
    (currentTasks || []).forEach(t => {
        if (t) {
            const normalized = { ...t };
            if (!normalized.id && normalized._id) normalized.id = normalized._id;
            if (!normalized.boardId && normalized.board_id) normalized.boardId = normalized.board_id;
            const key = normalized.id || `${normalized.taskname}_${normalized.completionDate}_${normalized.boardId}`;
            taskMap.set(key, normalized);
        }
    });
    (incomingTasks || []).forEach(t => {
        if (t) {
            const normalized = { ...t };
            if (!normalized.id && normalized._id) normalized.id = normalized._id;
            if (!normalized.boardId && normalized.board_id) normalized.boardId = normalized.board_id;
            const key = normalized.id || `${normalized.taskname}_${normalized.completionDate}_${normalized.boardId}`;
            const existing = taskMap.get(key);
            taskMap.set(key, { ...(existing || {}), ...normalized });
        }
    });
    return Array.from(taskMap.values());
};

export const purgeOrphanedTasks = (tasks = [], boards = []) => {
    if (!Array.isArray(tasks) || tasks.length === 0) return [];
    if (!Array.isArray(boards) || boards.length === 0) return tasks;
    const validSet = new Set(['main', 'tasks']);
    boards.forEach(b => {
        if (b.id) validSet.add(String(b.id));
        if (b._id) validSet.add(String(b._id));
        if (b.name) validSet.add(String(b.name).toLowerCase());
    });

    return tasks.filter(t => {
        if (!t) return false;
        const rawBId = t.boardId || t.board_id;
        if (!rawBId || rawBId === 'main' || rawBId === 'tasks') return true;
        const strId = String(rawBId);
        const lowerName = String(rawBId).toLowerCase();
        return validSet.has(strId) || validSet.has(lowerName);
    });
};

export const fetchTasks = createAsyncThunk('task/fetchTasks', async (_, thunkAPI) => {
    const state = thunkAPI.getState();
    const userState = state.userReducer;
    const isAuthenticated = userState?.isAuthenticated;
    const boards = userState?.boards || [];
    
    const taskKey = getTaskStorageKey(state);

    let localTasks = [];
    try {
        const tasksJson = (await AsyncStorage.getItem(taskKey)) || (await AsyncStorage.getItem('tasks'));
        if (tasksJson) localTasks = JSON.parse(tasksJson);
    } catch (e) {}

    if (state.taskReducer?.tasks?.length > 0) {
        localTasks = mergeTasks(localTasks, state.taskReducer.tasks);
    }

    localTasks = purgeOrphanedTasks(localTasks, boards);

    if (isAuthenticated) {
        try {
            const response = await axios.get('/api/tasks', { withCredentials: true });
            if (Array.isArray(response.data)) {
                const remoteTasks = response.data.map(t => {
                    const updated = { ...t };
                    if (!updated.id && updated._id) updated.id = updated._id;
                    if (!updated.boardId && updated.board_id) updated.boardId = updated.board_id;
                    return updated;
                });

                const remoteIds = new Set(remoteTasks.map(t => t.id || t._id));
                const remoteKeys = new Set(remoteTasks.map(t => `${(t.taskname || '').trim().toLowerCase()}_${t.boardId || 'main'}`));
                
                const unsyncedTasks = localTasks.filter(t => {
                    if (!t) return false;
                    const isLocalDraft = t.isLocalDraft === true || (t.id && String(t.id).startsWith('temp_'));
                    const key = `${(t.taskname || '').trim().toLowerCase()}_${t.boardId || 'main'}`;
                    return isLocalDraft && !remoteIds.has(t.id) && !remoteIds.has(t._id) && !remoteKeys.has(key);
                });

                if (unsyncedTasks.length > 0) {
                    try {
                        await axios.post('/api/tasks/bulk', { tasks: unsyncedTasks }, { withCredentials: true });
                    } catch (bulkErr) {
                        for (const task of unsyncedTasks) {
                            try {
                                await axios.post('/api/tasks', task, { withCredentials: true });
                            } catch (singleErr) {
                                console.warn("Failed to sync single task to DB:", task.taskname, singleErr.message);
                            }
                        }
                    }
                }

                const mergedTasks = purgeOrphanedTasks(mergeTasks(unsyncedTasks, remoteTasks), boards);
                await AsyncStorage.setItem(taskKey, JSON.stringify(mergedTasks));
                await AsyncStorage.setItem('tasks', JSON.stringify(mergedTasks));
                return mergedTasks;
            }
        } catch (err) {
            console.warn("Failed to fetch tasks from remote Vercel DB, using local storage fallback:", err.message);
        }
    }

    await AsyncStorage.setItem(taskKey, JSON.stringify(localTasks));
    await AsyncStorage.setItem('tasks', JSON.stringify(localTasks));
    return localTasks;
});

export const addTaskAsync = createAsyncThunk('task/addTaskAsync', async (task, thunkAPI) => {
    try {
        const response = await axios.post('/api/tasks', task, { withCredentials: true });
        return response.data;
    } catch (err) {
        return task;
    }
});

export const addMultipleTasksAsync = createAsyncThunk('task/addMultipleTasksAsync', async (tasks, thunkAPI) => {
    try {
        const response = await axios.post('/api/tasks/bulk', { tasks }, { withCredentials: true });
        return response.data;
    } catch (err) {
        return tasks;
    }
});

export const updateTaskAsync = createAsyncThunk('task/updateTaskAsync', async (updateData, thunkAPI) => {
    try {
        const { taskId, payload } = updateData;
        await axios.put(`/api/tasks/${taskId}`, payload, { withCredentials: true });
        return { taskId, payload };
    } catch (err) {
        return updateData;
    }
});

export const deleteTaskAsync = createAsyncThunk('task/deleteTaskAsync', async (taskId, thunkAPI) => {
    try {
        await axios.delete(`/api/tasks/${taskId}`, { withCredentials: true });
    } catch (err) {
        // Fallback
    }
    return taskId;
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
            state.tasks = action.payload.map(t => {
                const updated = { ...t };
                if (!updated.id && updated._id) updated.id = updated._id;
                if (!updated.boardId && updated.board_id) updated.boardId = updated.board_id;
                if (updated.completionDate) {
                    updated.dateString = typeof updated.completionDate === 'string' ? updated.completionDate.split('T')[0] : dayjs(updated.completionDate).format('YYYY-MM-DD');
                } else {
                    updated.dateString = null;
                }
                return updated;
            });
        },
        addTaskSync(state, action) {
            const { task } = action.payload;
            if (task.completionDate && !task.dateString) {
                task.dateString = typeof task.completionDate === 'string' ? task.completionDate.split('T')[0] : dayjs(task.completionDate).format('YYYY-MM-DD');
            }
            state.tasks.push(task); 
        },
        addMultipleTasksSync(state, action) {
            const { tasks } = action.payload;
            const updatedTasks = tasks.map(t => {
                if (t.completionDate && !t.dateString) {
                    return { ...t, dateString: typeof t.completionDate === 'string' ? t.completionDate.split('T')[0] : dayjs(t.completionDate).format('YYYY-MM-DD') };
                }
                return t;
            });
            state.tasks.push(...updatedTasks);
        },
        deleteTaskSync(state, action) {
             const { taskId } = action.payload;
             state.tasks = state.tasks.filter(t => t.id !== taskId);
        },
        purgeOrphanedTasksSync(state, action) {
            const boards = action.payload || [];
            if (Array.isArray(boards) && boards.length > 0) {
                state.tasks = purgeOrphanedTasks(state.tasks, boards);
            }
        },
        deleteTasksByBoardSync(state, action) {
            let targetId = null;
            let targetName = null;
            const payload = action.payload;
            if (typeof payload === 'object' && payload !== null) {
                const bObj = (payload.boardId && typeof payload.boardId === 'object') ? payload.boardId : payload;
                targetId = bObj.boardId || bObj.id || null;
                targetName = bObj.boardName || bObj.name || null;
                if (!targetId && typeof bObj === 'string') targetId = bObj;
            } else if (payload) {
                targetId = String(payload);
            }

            state.tasks = state.tasks.filter(t => {
                const bId = t.boardId || t.board_id;
                if (!bId || bId === 'main' || bId === 'tasks') return true;
                const strBId = String(bId);
                if (targetId && strBId === String(targetId)) return false;
                if (targetName && strBId.toLowerCase() === String(targetName).toLowerCase()) return false;
                return true;
            });
        },
        updateTaskSync(state, action) {
            const { taskId, name, priority, completed, description, completionDate, time, subtasks } = action.payload;
            const task = state.tasks.find(task => task.id === taskId);
            if (task) {
                task.taskname = name !== undefined ? name : task.taskname;
                task.priority = priority !== undefined ? priority : task.priority;
                task.completed = completed !== undefined ? completed : task.completed;
                if (task.completed) {
                  task.isNagMode = false;
                  task.escalationLevel = 'none';
                }
                if (completionDate !== undefined) {
                    task.completionDate = completionDate;
                    task.dateString = completionDate ? (typeof completionDate === 'string' ? completionDate.split('T')[0] : dayjs(completionDate).format('YYYY-MM-DD')) : null;
                }
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
                        if (updated.completionDate) {
                            updated.dateString = typeof updated.completionDate === 'string' ? updated.completionDate.split('T')[0] : dayjs(updated.completionDate).format('YYYY-MM-DD');
                        } else {
                            updated.dateString = null;
                        }
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
                state.tasks = action.payload.map(t => {
                    const updated = { ...t };
                    if (!updated.id && updated._id) updated.id = updated._id;
                    if (!updated.boardId && updated.board_id) updated.boardId = updated.board_id;
                    if (updated.completionDate) {
                        updated.dateString = typeof updated.completionDate === 'string' ? updated.completionDate.split('T')[0] : dayjs(updated.completionDate).format('YYYY-MM-DD');
                    } else {
                        updated.dateString = null;
                    }
                    return updated;
                });
            })
            .addCase(fetchTasks.rejected, (state, action) => { state.loading = false; state.error = action.error.message; })
            .addCase('user/deleteBoard/fulfilled', (state, action) => {
                const deletedBoardId = action.payload;
                if (deletedBoardId) {
                    state.tasks = state.tasks.filter(t => {
                        const bId = t.boardId || t.board_id;
                        return bId !== deletedBoardId;
                    });
                }
            });
    }
});

export const { hydrateTaskState, addTaskSync, addMultipleTasksSync, deleteTaskSync, deleteTasksByBoardSync, purgeOrphanedTasksSync, updateTaskSync, updateRecurringSeriesSync, deleteRecurringSeriesSync, clearTasks, loadGuestTasks, setPendingCleanupTaskIds, clearPendingCleanupTaskIds } = taskSlice.actions;

let saveStorageTimeout = null;
let lastTasksToSave = null;
let syncAutomationsTimeout = null;

export const persistTasksToStorage = (tasks, getState) => {
    lastTasksToSave = tasks;
    if (saveStorageTimeout) {
        clearTimeout(saveStorageTimeout);
    }
    saveStorageTimeout = setTimeout(async () => {
        try {
            if (lastTasksToSave) {
                let key = 'tasks';
                if (getState) {
                    key = getTaskStorageKey(getState());
                }
                await AsyncStorage.setItem(key, JSON.stringify(lastTasksToSave));
                await AsyncStorage.setItem('tasks', JSON.stringify(lastTasksToSave));
            }
        } catch (e) {
            console.error('Error saving tasks to AsyncStorage:', e);
        }
    }, 200);
};

export const flushPendingTaskSaves = async (getState) => {
    if (saveStorageTimeout) {
        clearTimeout(saveStorageTimeout);
        saveStorageTimeout = null;
    }
    try {
        const tasks = getState ? getState().taskReducer.tasks : lastTasksToSave;
        if (tasks) {
            const key = getState ? getTaskStorageKey(getState()) : 'tasks';
            await AsyncStorage.setItem(key, JSON.stringify(tasks));
            await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
        }
    } catch (e) {
        console.error('Error flushing tasks to storage:', e);
    }
};

const syncRecurringAutomations = (getState) => {
    if (syncAutomationsTimeout) {
        clearTimeout(syncAutomationsTimeout);
    }
    syncAutomationsTimeout = setTimeout(() => {
        try {
            const state = getState();
            const themeState = state.themeReducer;
            const tasks = state.taskReducer.tasks;
            const isPremium = state.entitlementReducer?.isPremium;
            updateRecurringAutomations(themeState, tasks, isPremium);
        } catch (e) {
            // Silently catch in case of issues
        }
    }, 400);
};

export const addTask = (payload) => async (dispatch, getState) => {
    const state = getState();
    const themeState = state.themeReducer;
    const isPremium = state.entitlementReducer?.isPremium;
    if (payload?.task) {
        if (isPremium && themeState?.defaultReminderEnabled && (!payload.task.reminder || payload.task.reminder === 'None')) {
            payload.task.reminder = themeState.defaultReminderTime || '15 min before';
        }
        if (payload.task.reminder && payload.task.reminder !== 'None' && payload.task.completionDate && !payload.task.completed) {
            try {
                const notifIds = await scheduleTaskReminder(
                    payload.task.taskname,
                    payload.task.reminder,
                    payload.task.completionDate,
                    payload.task.time,
                    payload.task.id,
                    !!payload.task.isAlarm,
                    themeState
                );
                if (notifIds && notifIds.length > 0) {
                    payload.task.notificationId = notifIds;
                }
            } catch (e) {
                console.warn('Failed to schedule reminder on addTask:', e);
            }
        }
    }
    dispatch(addTaskSync(payload)); 
    const tasks = getState().taskReducer.tasks;
    persistTasksToStorage(tasks, getState);
    syncRecurringAutomations(getState);
    if (state.userReducer?.isAuthenticated && payload?.task) {
        dispatch(addTaskAsync(payload.task));
    }
};

export const addMultipleTasks = (payload) => async (dispatch, getState) => {
    const state = getState();
    const themeState = state.themeReducer;
    const isPremium = state.entitlementReducer?.isPremium;
    if (Array.isArray(payload?.tasks)) {
        for (const task of payload.tasks) {
            if (task) {
                if (isPremium && themeState?.defaultReminderEnabled && (!task.reminder || task.reminder === 'None')) {
                    task.reminder = themeState.defaultReminderTime || '15 min before';
                }
                if (task.reminder && task.reminder !== 'None' && task.completionDate && !task.completed) {
                    try {
                        const notifIds = await scheduleTaskReminder(
                            task.taskname,
                            task.reminder,
                            task.completionDate,
                            task.time,
                            task.id,
                            !!task.isAlarm,
                            themeState
                        );
                        if (notifIds && notifIds.length > 0) {
                            task.notificationId = notifIds;
                        }
                    } catch (e) {}
                }
            }
        }
    }
    dispatch(addMultipleTasksSync(payload));
    const tasks = getState().taskReducer.tasks;
    persistTasksToStorage(tasks, getState);
    syncRecurringAutomations(getState);
    if (state.userReducer?.isAuthenticated && Array.isArray(payload?.tasks)) {
        dispatch(addMultipleTasksAsync(payload.tasks));
    }
};

export const deleteTask = (payload) => async (dispatch, getState) => {
    const state = getState();
    const taskId = payload?.taskId || (typeof payload === 'string' ? payload : null);
    if (taskId) {
        const existingTask = state.taskReducer.tasks.find(t => t && String(t.id) === String(taskId));
        if (existingTask) {
            await cancelNotification(existingTask.notificationId, existingTask.id);
        } else {
            await cancelNotification(null, taskId);
        }
    }
    dispatch(deleteTaskSync(payload));
    const tasks = getState().taskReducer.tasks;
    persistTasksToStorage(tasks, getState);
    syncRecurringAutomations(getState);
    if (state.userReducer?.isAuthenticated && taskId) {
        dispatch(deleteTaskAsync(taskId));
    }
};

export const deleteTasksByBoard = (payload) => async (dispatch, getState) => {
    const state = getState();
    const tasks = state.taskReducer.tasks || [];
    let targetId = payload?.boardId || (typeof payload === 'string' ? payload : null);
    if (targetId) {
        const affected = tasks.filter(t => t && String(t.boardId || t.board_id) === String(targetId));
        for (const t of affected) {
            await cancelNotification(t.notificationId, t.id);
        }
    }
    dispatch(deleteTasksByBoardSync(payload));
    const newTasks = getState().taskReducer.tasks;
    persistTasksToStorage(newTasks, getState);
    syncRecurringAutomations(getState);
};

export const purgeOrphanedTasksThunk = (boards) => async (dispatch, getState) => {
    dispatch(purgeOrphanedTasksSync(boards));
    const tasks = getState().taskReducer.tasks;
    persistTasksToStorage(tasks, getState);
    syncRecurringAutomations(getState);
};

export const updateTask = (payload) => async (dispatch, getState) => {
    const state = getState();
    const taskId = payload?.taskId;
    const existingTask = taskId ? state.taskReducer.tasks.find(t => t && String(t.id) === String(taskId)) : null;

    dispatch(updateTaskSync(payload));
    const updatedTask = taskId ? getState().taskReducer.tasks.find(t => t && String(t.id) === String(taskId)) : null;

    if (updatedTask) {
        if (updatedTask.completed) {
            await cancelNotification(updatedTask.notificationId, updatedTask.id);
        } else if (existingTask && existingTask.completed && !updatedTask.completed && updatedTask.reminder && updatedTask.reminder !== 'None') {
            try {
                const notifIds = await scheduleTaskReminder(
                    updatedTask.taskname,
                    updatedTask.reminder,
                    updatedTask.completionDate,
                    updatedTask.time,
                    updatedTask.id,
                    !!updatedTask.isAlarm,
                    state.themeReducer
                );
                if (notifIds && notifIds.length > 0) {
                    dispatch(updateTaskSync({ taskId: updatedTask.id, notificationId: notifIds }));
                }
            } catch (e) {}
        }
    }

    const tasks = getState().taskReducer.tasks;
    persistTasksToStorage(tasks, getState);
    syncRecurringAutomations(getState);
    if (state.userReducer?.isAuthenticated && payload?.taskId) {
        dispatch(updateTaskAsync({ taskId: payload.taskId, payload }));
    }
};

export const updateRecurringSeries = (payload) => async (dispatch, getState) => {
    dispatch(updateRecurringSeriesSync(payload));
    const tasks = getState().taskReducer.tasks;
    persistTasksToStorage(tasks, getState);
    syncRecurringAutomations(getState);
};

export const deleteRecurringSeries = (payload) => async (dispatch, getState) => {
    const state = getState();
    const { seriesId, fromDate } = payload || {};
    if (seriesId) {
        const fromDay = fromDate ? dayjs(fromDate).startOf('day') : null;
        const affected = (state.taskReducer.tasks || []).filter(t => {
            if (t && t.recurringSeriesId === seriesId) {
                if (!fromDay) return true;
                const taskDay = t.completionDate ? dayjs(t.completionDate).startOf('day') : null;
                return taskDay && (taskDay.isSame(fromDay, 'day') || taskDay.isAfter(fromDay));
            }
            return false;
        });
        for (const t of affected) {
            await cancelNotification(t.notificationId, t.id);
        }
    }
    dispatch(deleteRecurringSeriesSync(payload));
    const tasks = getState().taskReducer.tasks;
    persistTasksToStorage(tasks, getState);
    syncRecurringAutomations(getState);
};

export const processAutoManageTasks = () => async (dispatch, getState) => {
    const state = getState();
    const isPremium = state.entitlementReducer?.isPremium;
    if (!isPremium) return;
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
        autoRescheduleTime: (themeState.autoRescheduleTime && themeState.autoRescheduleTime !== '00:00') ? themeState.autoRescheduleTime : '23:59',
        rescheduleTransferredReminders: themeState.rescheduleTransferredReminders !== undefined ? themeState.rescheduleTransferredReminders : true
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
        const isOverride = !!(boardCustom && boardCustom.overrideGlobal === true);

        const effectiveAutoTransferMode = (isOverride && boardCustom?.autoTransferMode !== undefined) 
            ? boardCustom.autoTransferMode 
            : globalSettings.autoTransferMode;
            
        const effectiveIncreasePriorityWhenOverdue = (isOverride && boardCustom?.increasePriorityWhenOverdue !== undefined) 
            ? boardCustom.increasePriorityWhenOverdue 
            : globalSettings.increasePriorityWhenOverdue;
            
        const effectivePriorityFrequency = (isOverride && boardCustom?.priorityFrequency !== undefined) 
            ? boardCustom.priorityFrequency 
            : globalSettings.priorityFrequency;
            
        const effectiveRemovePriorityWhenCompleted = (isOverride && boardCustom?.removePriorityWhenCompleted !== undefined) 
            ? boardCustom.removePriorityWhenCompleted 
            : globalSettings.removePriorityWhenCompleted;
            
        const effectiveAutoDeleteOverdueDays = (isOverride && boardCustom?.autoDeleteOverdueDays !== undefined) 
            ? boardCustom.autoDeleteOverdueDays 
            : globalSettings.autoDeleteOverdueDays;
            
        const effectiveAutoDeleteCompletedDays = (isOverride && boardCustom?.autoDeleteCompletedDays !== undefined) 
            ? boardCustom.autoDeleteCompletedDays 
            : globalSettings.autoDeleteCompletedDays;
            
        const effectiveAutoRescheduleTime = (isOverride && boardCustom?.autoRescheduleTime && boardCustom?.autoRescheduleTime !== '00:00') 
            ? boardCustom.autoRescheduleTime 
            : globalSettings.autoRescheduleTime;

        const effectiveRescheduleReminders = (isOverride && boardCustom?.rescheduleTransferredReminders !== undefined)
            ? boardCustom.rescheduleTransferredReminders
            : globalSettings.rescheduleTransferredReminders;

        let rescheduleHour = 23;
        let rescheduleMinute = 59;
        if (effectiveAutoRescheduleTime && effectiveAutoRescheduleTime !== '00:00') {
            const timeStr = String(effectiveAutoRescheduleTime).trim();
            const isPm = /pm/i.test(timeStr);
            const isAm = /am/i.test(timeStr);
            const cleanStr = timeStr.replace(/(am|pm)/i, '').trim();
            const parts = cleanStr.split(':').map(n => parseInt(n, 10));
            if (!isNaN(parts[0])) rescheduleHour = parts[0];
            if (!isNaN(parts[1])) rescheduleMinute = parts[1];
            if (isPm && rescheduleHour < 12) rescheduleHour += 12;
            if (isAm && rescheduleHour === 12) rescheduleHour = 0;
        }

        const rescheduleTimeToday = dayjs().hour(rescheduleHour).minute(rescheduleMinute).second(0).millisecond(0);
        
        // Auto-transfer of uncompleted tasks only applies to tasks strictly in the past (before today)
        const isOverdueOrPastCutoff = taskDate.isBefore(actualToday);

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
        else if (isOverdueOrPastCutoff) {
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
                
                if (effectiveAutoTransferMode && effectiveAutoTransferMode !== 'none' && !task.isShared && !task.doNotOverrideDate) {
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
                    const isCurrentCutoffPassed = dayjs().isAfter(rescheduleTimeToday);

                    if (effectiveAutoTransferMode === 'today') {
                        if (isCurrentCutoffPassed) {
                            targetDate = targetDate.add(1, 'day');
                        }
                    } else if (effectiveAutoTransferMode === 'tomorrow') {
                        targetDate = targetDate.add(1, 'day');
                    } else if (effectiveAutoTransferMode === 'next_workday') {
                        if (isCurrentCutoffPassed || targetDate.day() === 0 || targetDate.day() === 6) {
                            targetDate = targetDate.add(1, 'day');
                            while (targetDate.day() === 0 || targetDate.day() === 6) {
                                targetDate = targetDate.add(1, 'day');
                            }
                        }
                    }
                    updatedTask.completionDate = targetDate.toISOString();
                    updatedTask.dateString = typeof updatedTask.completionDate === 'string' ? updatedTask.completionDate.split('T')[0] : targetDate.format('YYYY-MM-DD');
                    if (effectiveRescheduleReminders !== false && !updatedTask.completed) {
                        try {
                            const reminderValue = updatedTask.reminder || (themeState.defaultReminderEnabled ? themeState.defaultReminderTime : 'None');
                            if (updatedTask.time || (reminderValue && reminderValue !== 'None')) {
                                const newNotifIds = await scheduleTaskReminder(
                                    updatedTask.taskname,
                                    reminderValue,
                                    targetDate.format('YYYY-MM-DD'),
                                    updatedTask.time,
                                    updatedTask.id,
                                    !!updatedTask.isAlarm,
                                    themeState,
                                    { isNagMode: updatedTask.isNagMode, escalationLevel: updatedTask.escalationLevel }
                                );
                                if (newNotifIds && newNotifIds.length > 0) {
                                    updatedTask.notificationId = newNotifIds;
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to reschedule notification on auto-transfer:', e);
                        }
                    }
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

    if (tasksToDelete.length > 0) {
        for (const id of tasksToDelete) {
            const t = tasks.find(item => item && String(item.id) === String(id));
            if (t) {
                await cancelNotification(t.notificationId, t.id);
            }
        }
        if (!globalSettings.confirmBeforeDeletion) {
            newTasks = newTasks.filter(t => !tasksToDelete.includes(t.id));
            hasChanges = true;
        }
    }

    if (hasChanges) {
        dispatch(hydrateTaskState(newTasks));
        persistTasksToStorage(newTasks);
    }

    if (tasksToDelete.length > 0 && globalSettings.confirmBeforeDeletion) {
        dispatch(setPendingCleanupTaskIds(tasksToDelete));
    }

    syncRecurringAutomations(getState);
};

export const executePendingCleanup = () => async (dispatch, getState) => {
    const state = getState();
    const tasksToDelete = state.taskReducer.pendingCleanupTaskIds;
    if (tasksToDelete && tasksToDelete.length > 0) {
        const currentTasks = state.taskReducer.tasks;
        for (const id of tasksToDelete) {
            const task = currentTasks.find(t => t && String(t.id) === String(id));
            if (task) {
                await cancelNotification(task.notificationId, task.id);
            }
        }
        const finalTasks = currentTasks.filter(t => !tasksToDelete.includes(t.id));
        dispatch(hydrateTaskState(finalTasks));
        persistTasksToStorage(finalTasks);
        syncRecurringAutomations(getState);
    }
    dispatch(clearPendingCleanupTaskIds());
};

export const cancelPendingCleanup = () => (dispatch) => {
    dispatch(clearPendingCleanupTaskIds());
};

export default taskSlice.reducer;
