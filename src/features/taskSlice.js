import AsyncStorage from '@react-native-async-storage/async-storage';
import { CryptoStorage } from '../utils/cryptoStorage';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Platform, Alert } from 'react-native';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { updateRecurringAutomations, cancelNotification, scheduleTaskReminder } from '../utils/notifications';
import { syncTaskToCalendarAsync, removeTaskFromCalendarAsync, removeTaskEventsFromCalendarImmediateAsync, removeBoardEventsFromCalendarAsync, syncAllTasksToCalendarAsync, importCalendarEventsAsync, performDifferentialCalendarSyncAsync, fetchCalendarWindowEventsAsync, buildTaskDeduplicationPlan, extractTaskDateKey, getTaskMatchTitle, isMainBoardId, isDateStrInSyncWindow, getTaskCalendarFingerprint, isTaskEligibleForCalendarSync, resolveTaskBoard, getBoardCalendarSyncKey, MAX_EVENTS_PER_SYNC_BATCH, addTombstoneAsync, getCalendarSyncScheduleStateAsync, markCalendarSyncCompletedAsync, isScheduledCalendarSyncDue } from '../utils/calendarSync';
import { setLastCalendarSyncAt, setBoardCalendarSync } from './themeSlice';
import { insertTaskSorted, sortTasksChronologically } from '../utils/binaryInsert';
import { sanitizeId, sanitizeForStorage } from '../utils/securitySanitizer';
import { computeHabitRolloverUpdates } from '../utils/habitHelper';
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
        const tasksJson = (await CryptoStorage.getItem(taskKey)) || (await CryptoStorage.getItem('tasks'));
        if (tasksJson) localTasks = JSON.parse(tasksJson);
    } catch (e) {}

    if (state.taskReducer?.tasks?.length > 0) {
        localTasks = mergeTasks(localTasks, state.taskReducer.tasks);
    }

    localTasks = purgeOrphanedTasks(localTasks, boards);

    const dbSyncEnabled = state.themeReducer?.dbSyncEnabled !== false && Platform.OS !== 'web';

    if (isAuthenticated && dbSyncEnabled) {
        try {
            const response = await axios.get('/api/tasks', { withCredentials: true });
            if (Array.isArray(response.data)) {
                const localMetaById = new Map();
                localTasks.forEach(lt => {
                    if (!lt) return;
                    const lid = lt.id || lt._id;
                    if (lid) localMetaById.set(String(lid), lt);
                });

                const remoteTasks = response.data.map(t => {
                    const updated = { ...t };
                    if (!updated.id && updated._id) updated.id = updated._id;
                    if (!updated.boardId && updated.board_id) updated.boardId = updated.board_id;
                    // Preserve device-local calendar & notification sync metadata if remote DB omits it
                    const cachedLocal = localMetaById.get(String(updated.id || updated._id));
                    if (cachedLocal) {
                        if (!updated.calendarEventId && cachedLocal.calendarEventId) {
                            updated.calendarEventId = cachedLocal.calendarEventId;
                        }
                        if (!updated.calendarSyncHash && cachedLocal.calendarSyncHash) {
                            updated.calendarSyncHash = cachedLocal.calendarSyncHash;
                        }
                        if (!updated.notificationId && cachedLocal.notificationId) {
                            updated.notificationId = cachedLocal.notificationId;
                        }
                    }
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

                const mergedTasks = sortTasksChronologically(purgeOrphanedTasks(mergeTasks(unsyncedTasks, remoteTasks), boards));
                const serializedMerged = JSON.stringify(mergedTasks);
                const keysToWrite = taskKey !== 'tasks' ? [taskKey, 'tasks'] : [taskKey];
                await CryptoStorage.setItemMultiKeys(keysToWrite, serializedMerged);
                return mergedTasks;
            }
        } catch (err) {
            console.warn("Failed to fetch tasks from remote Vercel DB, using local storage fallback:", err.message);
        }
    }

    const sortedLocal = sortTasksChronologically(localTasks);
    const serializedLocal = JSON.stringify(sortedLocal);
    const localKeysToWrite = (taskKey !== 'tasks' && Platform.OS !== 'web') ? [taskKey, 'tasks'] : [taskKey];
    await CryptoStorage.setItemMultiKeys(localKeysToWrite, serializedLocal);
    return sortedLocal;
});

export const addTaskAsync = createAsyncThunk('task/addTaskAsync', async (task, thunkAPI) => {
    try {
        const safeTask = sanitizeForStorage(task);
        const response = await axios.post('/api/tasks', safeTask, { withCredentials: true });
        return response.data;
    } catch (err) {
        return task;
    }
});

export const addMultipleTasksAsync = createAsyncThunk('task/addMultipleTasksAsync', async (tasks, thunkAPI) => {
    try {
        const safeTasks = Array.isArray(tasks) ? tasks.map(t => sanitizeForStorage(t)) : tasks;
        const response = await axios.post('/api/tasks/bulk', { tasks: safeTasks }, { withCredentials: true });
        return response.data;
    } catch (err) {
        return tasks;
    }
});

export const updateTaskAsync = createAsyncThunk('task/updateTaskAsync', async (updateData, thunkAPI) => {
    try {
        const { taskId, payload } = updateData;
        const safeId = sanitizeId(taskId);
        const safePayload = sanitizeForStorage(payload);
        await axios.put(`/api/tasks/${safeId}`, safePayload, { withCredentials: true });
        return { taskId: safeId, payload: safePayload };
    } catch (err) {
        return updateData;
    }
});

export const deleteTaskAsync = createAsyncThunk('task/deleteTaskAsync', async (taskId, thunkAPI) => {
    try {
        const safeId = sanitizeId(taskId);
        await axios.delete(`/api/tasks/${safeId}`, { withCredentials: true });
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
            const normalized = action.payload.map(t => {
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
            state.tasks = sortTasksChronologically(normalized);
        },
        addTaskSync(state, action) {
            const rawTask = action.payload?.task;
            if (!rawTask) return;
            const task = { ...rawTask };
            if (!task.id && task._id) task.id = task._id;
            if (!task.boardId && task.board_id) task.boardId = task.board_id;
            if (!task.creationDate) {
                task.creationDate = task.createdAt || new Date().toISOString();
            }
            if (!task.createdAt) {
                task.createdAt = task.creationDate;
            }
            if (!task.dateString || !/^\d{4}-\d{2}-\d{2}$/.test(String(task.dateString))) {
                const extractedDate = extractTaskDateKey(task);
                if (extractedDate) {
                    task.dateString = extractedDate;
                } else if (task.completionDate) {
                    task.dateString = typeof task.completionDate === 'string'
                        ? task.completionDate.split('T')[0]
                        : dayjs(task.completionDate).format('YYYY-MM-DD');
                }
            }
            const effId = task.id || task._id;
            if (effId) {
                const existingIdx = state.tasks.findIndex(t => t && String(t.id || t._id) === String(effId));
                if (existingIdx !== -1) {
                    state.tasks[existingIdx] = { ...state.tasks[existingIdx], ...task };
                    state.tasks = sortTasksChronologically(state.tasks);
                    return;
                }
            }
            state.tasks = insertTaskSorted(state.tasks, task);
        },
        addMultipleTasksSync(state, action) {
            const { tasks } = action.payload;
            if (!Array.isArray(tasks) || tasks.length === 0) return;

            let currentTasks = [...state.tasks];
            if (tasks.length > 15) {
                for (const t of tasks) {
                    if (t) {
                        const updated = { ...t };
                        if (updated.completionDate && !updated.dateString) {
                            updated.dateString = typeof updated.completionDate === 'string' ? updated.completionDate.split('T')[0] : dayjs(updated.completionDate).format('YYYY-MM-DD');
                        }
                        currentTasks.push(updated);
                    }
                }
                state.tasks = sortTasksChronologically(currentTasks);
            } else {
                for (const t of tasks) {
                    if (t) {
                        const updated = { ...t };
                        if (updated.completionDate && !updated.dateString) {
                            updated.dateString = typeof updated.completionDate === 'string' ? updated.completionDate.split('T')[0] : dayjs(updated.completionDate).format('YYYY-MM-DD');
                        }
                        currentTasks = insertTaskSorted(currentTasks, updated);
                    }
                }
                state.tasks = currentTasks;
            }
        },
        deleteTaskSync(state, action) {
             const { taskId } = action.payload;
             state.tasks = state.tasks.filter(t => (t.id || t._id) !== taskId);
        },
        deleteMultipleTasksSync(state, action) {
             const { taskIds } = action.payload || {};
             if (!Array.isArray(taskIds) || taskIds.length === 0) return;
             const idSet = new Set(taskIds.map(String));
             state.tasks = state.tasks.filter(t => t && !idSet.has(String(t.id || t._id)));
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
            const task = state.tasks.find(t => t && String(t.id || t._id) === String(taskId));
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
                if (action.payload.calendarEventId !== undefined) task.calendarEventId = action.payload.calendarEventId;
                if (action.payload.calendarSyncHash !== undefined) task.calendarSyncHash = action.payload.calendarSyncHash;
                if (action.payload.recurringSeriesId !== undefined) task.recurringSeriesId = action.payload.recurringSeriesId;
                if (action.payload.isRecurring !== undefined) task.isRecurring = action.payload.isRecurring;
                if (action.payload.repeatFrequency !== undefined) task.repeatFrequency = action.payload.repeatFrequency;
                if (action.payload.repeatConfig !== undefined) task.repeatConfig = action.payload.repeatConfig;
                if (action.payload.repeatStartDate !== undefined) task.repeatStartDate = action.payload.repeatStartDate;
                if (action.payload.repeatEndDate !== undefined) task.repeatEndDate = action.payload.repeatEndDate;
                if (action.payload.isNagMode !== undefined) task.isNagMode = action.payload.isNagMode;
                if (action.payload.escalationLevel !== undefined) task.escalationLevel = action.payload.escalationLevel;
                if (action.payload.keepNotificationAllDay !== undefined) task.keepNotificationAllDay = action.payload.keepNotificationAllDay;
                if (action.payload.itemPrice !== undefined) task.itemPrice = action.payload.itemPrice;
                if (action.payload.itemCurrency !== undefined) task.itemCurrency = action.payload.itemCurrency;
                if (action.payload.itemQuantity !== undefined) task.itemQuantity = action.payload.itemQuantity;
                if (action.payload.itemUnit !== undefined) task.itemUnit = action.payload.itemUnit;
                if (action.payload.itemCategory !== undefined) task.itemCategory = action.payload.itemCategory;
                if (action.payload.itemRating !== undefined) task.itemRating = action.payload.itemRating;
                if (action.payload.itemProgress !== undefined) task.itemProgress = action.payload.itemProgress;
                if (action.payload.habitStreak !== undefined) task.habitStreak = action.payload.habitStreak;
                if (action.payload.habitLastCompleted !== undefined) task.habitLastCompleted = action.payload.habitLastCompleted;
                if (action.payload.habitCompletedDates !== undefined) task.habitCompletedDates = action.payload.habitCompletedDates;
                if (action.payload.habitBestStreak !== undefined) task.habitBestStreak = action.payload.habitBestStreak;
                if (action.payload.habitSchedule !== undefined) task.habitSchedule = action.payload.habitSchedule;
                if (action.payload.habitLastRolloverDate !== undefined) task.habitLastRolloverDate = action.payload.habitLastRolloverDate;
                if (action.payload.habitCreatedAt !== undefined) task.habitCreatedAt = action.payload.habitCreatedAt;
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

                if (completionDate !== undefined || time !== undefined) {
                    state.tasks = sortTasksChronologically(state.tasks);
                }
            }
        },
        updateMultipleTasksSync(state, action) {
            const { updates, taskIds, changes } = action.payload || {};
            const nowIso = new Date().toISOString();
            let needsSort = false;

            const applyChangesToTask = (task, patch) => {
                if (!task || !patch) return;
                if (patch.name !== undefined) task.taskname = patch.name;
                if (patch.priority !== undefined) task.priority = patch.priority;
                if (patch.completed !== undefined) {
                    task.completed = patch.completed;
                    if (task.completed) {
                        task.isNagMode = false;
                        task.escalationLevel = 'none';
                    }
                }
                if (patch.completionDate !== undefined) {
                    task.completionDate = patch.completionDate;
                    task.dateString = patch.completionDate
                        ? (typeof patch.completionDate === 'string' ? patch.completionDate.split('T')[0] : dayjs(patch.completionDate).format('YYYY-MM-DD'))
                        : null;
                    needsSort = true;
                }
                if (patch.time !== undefined) {
                    task.time = patch.time;
                    needsSort = true;
                }
                if (patch.reminder !== undefined) task.reminder = patch.reminder;
                if (patch.boardId !== undefined) task.boardId = patch.boardId;
                if (patch.isAlarm !== undefined) task.isAlarm = patch.isAlarm;
                if (patch.notificationId !== undefined) task.notificationId = patch.notificationId;
                if (patch.calendarEventId !== undefined) task.calendarEventId = patch.calendarEventId;
                if (patch.calendarSyncHash !== undefined) task.calendarSyncHash = patch.calendarSyncHash;
                if (patch.isNagMode !== undefined) task.isNagMode = patch.isNagMode;
                if (patch.escalationLevel !== undefined) task.escalationLevel = patch.escalationLevel;
                if (patch.keepNotificationAllDay !== undefined) task.keepNotificationAllDay = patch.keepNotificationAllDay;
                if (patch.itemPrice !== undefined) task.itemPrice = patch.itemPrice;
                if (patch.itemCurrency !== undefined) task.itemCurrency = patch.itemCurrency;
                if (patch.itemQuantity !== undefined) task.itemQuantity = patch.itemQuantity;
                if (patch.itemUnit !== undefined) task.itemUnit = patch.itemUnit;
                if (patch.itemCategory !== undefined) task.itemCategory = patch.itemCategory;
                if (patch.itemRating !== undefined) task.itemRating = patch.itemRating;
                if (patch.itemProgress !== undefined) task.itemProgress = patch.itemProgress;
                if (patch.habitStreak !== undefined) task.habitStreak = patch.habitStreak;
                if (patch.habitLastCompleted !== undefined) task.habitLastCompleted = patch.habitLastCompleted;
                if (patch.habitCompletedDates !== undefined) task.habitCompletedDates = patch.habitCompletedDates;
                if (patch.habitBestStreak !== undefined) task.habitBestStreak = patch.habitBestStreak;
                if (patch.habitSchedule !== undefined) task.habitSchedule = patch.habitSchedule;
                if (patch.habitLastRolloverDate !== undefined) task.habitLastRolloverDate = patch.habitLastRolloverDate;
                if (patch.habitCreatedAt !== undefined) task.habitCreatedAt = patch.habitCreatedAt;
                if (patch.description) {
                    task.description = {
                        text: patch.description.text !== undefined ? patch.description.text : (task.description?.text || ''),
                        img: patch.description.img !== undefined ? patch.description.img : (task.description?.img || ''),
                        url: patch.description.url !== undefined ? patch.description.url : (task.description?.url || ''),
                        attachments: patch.description.attachments !== undefined ? patch.description.attachments : (task.description?.attachments || []),
                    };
                }
                if (patch.subtasks !== undefined) task.subtasks = patch.subtasks;
                task.lastUpdatedDate = nowIso;
            };

            if (Array.isArray(taskIds) && taskIds.length > 0 && changes) {
                const idSet = new Set(taskIds.map(String));
                for (let i = 0; i < state.tasks.length; i++) {
                    const t = state.tasks[i];
                    if (t && idSet.has(String(t.id || t._id))) {
                        applyChangesToTask(t, changes);
                    }
                }
            } else if (Array.isArray(updates) && updates.length > 0) {
                const updateMap = new Map();
                for (let i = 0; i < updates.length; i++) {
                    const u = updates[i];
                    if (u && u.taskId !== undefined) {
                        updateMap.set(String(u.taskId), u);
                    }
                }
                for (let i = 0; i < state.tasks.length; i++) {
                    const t = state.tasks[i];
                    if (t) {
                        const patch = updateMap.get(String(t.id || t._id));
                        if (patch) {
                            applyChangesToTask(t, patch);
                        }
                    }
                }
            }

            if (needsSort) {
                state.tasks = sortTasksChronologically(state.tasks);
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
                        if (updates.keepNotificationAllDay !== undefined) updated.keepNotificationAllDay = updates.keepNotificationAllDay;
                        if (updates.itemPrice !== undefined) updated.itemPrice = updates.itemPrice;
                        if (updates.itemCurrency !== undefined) updated.itemCurrency = updates.itemCurrency;
                        if (updates.itemQuantity !== undefined) updated.itemQuantity = updates.itemQuantity;
                        if (updates.itemUnit !== undefined) updated.itemUnit = updates.itemUnit;
                        if (updates.itemCategory !== undefined) updated.itemCategory = updates.itemCategory;
                        if (updates.itemRating !== undefined) updated.itemRating = updates.itemRating;
                        if (updates.itemProgress !== undefined) updated.itemProgress = updates.itemProgress;
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
            const { seriesId, fromDate, excludeTaskId } = action.payload || {};
            if (!seriesId) return;
            const fromDay = fromDate ? dayjs(fromDate).startOf('day') : null;
            state.tasks = state.tasks.filter(task => {
                if (task.recurringSeriesId === seriesId) {
                    if (excludeTaskId && task.id === excludeTaskId) return true;
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
        },
        batchCalendarSyncComplete(state, action) {
            const { eventMap, hashMap, newTasks, updatedTasks, deletedTaskIds, clearedEventTaskIds } = action.payload || {};
            
            // 0. Remove ghost-deleted tasks or duplicate imported copies identified by differential sync
            if (Array.isArray(deletedTaskIds) && deletedTaskIds.length > 0) {
                const delSet = new Set(deletedTaskIds.map(String));
                state.tasks = state.tasks.filter(t => t && !delSet.has(String(t.id || t._id)));
            }

            // 0b. Clear calendar links for tasks on boards whose calendar sync is OFF (keep tasks intact!)
            if (Array.isArray(clearedEventTaskIds) && clearedEventTaskIds.length > 0) {
                const clearSet = new Set(clearedEventTaskIds.map(String));
                state.tasks.forEach(t => {
                    if (t && clearSet.has(String(t.id || t._id))) {
                        t.calendarEventId = null;
                        t.calendarSyncHash = null;
                    }
                });
            }

            // 1. Update calendarEventIds & fingerprints from eventMap/hashMap
            if (eventMap && typeof eventMap === 'object') {
                Object.entries(eventMap).forEach(([tId, calId]) => {
                    const task = state.tasks.find(t => t && String(t.id || t._id) === String(tId));
                    if (task) {
                        task.calendarEventId = calId;
                        if (hashMap && hashMap[tId]) {
                            task.calendarSyncHash = hashMap[tId];
                        }
                    }
                });
            }

            // 2. Update existing tasks with updates from calendar
            if (Array.isArray(updatedTasks) && updatedTasks.length > 0) {
                updatedTasks.forEach(u => {
                    const task = state.tasks.find(t => t && String(t.id || t._id) === String(u.taskId));
                    if (task) {
                        if (u.calendarEventId !== undefined) task.calendarEventId = u.calendarEventId;
                        if (u.calendarSyncHash !== undefined) task.calendarSyncHash = u.calendarSyncHash;
                        if (u.name !== undefined) task.taskname = u.name;
                        if (u.completionDate !== undefined) {
                            task.completionDate = u.completionDate;
                            task.dateString = u.completionDate;
                        }
                        if (u.time !== undefined) task.time = u.time;
                        if (u.completed !== undefined) task.completed = u.completed;
                        if (u.description !== undefined) task.description = u.description;
                        task.lastUpdatedDate = new Date().toISOString();
                    }
                });
            }

            // 3. Add new tasks imported from calendar
            if (Array.isArray(newTasks) && newTasks.length > 0) {
                for (const nt of newTasks) {
                    if (nt) {
                        state.tasks.push(nt);
                    }
                }
            }

            // 4. Sort tasks chronologically
            state.tasks = sortTasksChronologically(state.tasks);
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchTasks.pending, (state) => { state.loading = true; })
            .addCase(fetchTasks.fulfilled, (state, action) => {
                state.loading = false;
                const normalized = action.payload.map(t => {
                    const updated = { ...t };
                    if (!updated.id && updated._id) updated.id = updated._id;
                    if (!updated.boardId && updated.board_id) updated.boardId = updated.board_id;
                    if (!updated.dateString || !/^\d{4}-\d{2}-\d{2}$/.test(String(updated.dateString))) {
                        if (updated.completionDate) {
                            updated.dateString = typeof updated.completionDate === 'string' ? updated.completionDate.split('T')[0] : dayjs(updated.completionDate).format('YYYY-MM-DD');
                        } else {
                            updated.dateString = null;
                        }
                    }
                    return updated;
                });
                state.tasks = sortTasksChronologically(normalized);
            })
            .addCase(fetchTasks.rejected, (state, action) => { state.loading = false; state.error = action.error.message; })
            .addCase('user/deleteBoard/pending', (state, action) => {
                const deletedTarget = action.meta?.arg;
                const deletedId = (typeof deletedTarget === 'object' && deletedTarget !== null)
                    ? (deletedTarget.id || deletedTarget._id || deletedTarget.boardId)
                    : deletedTarget;
                if (deletedId) {
                    const strDelId = String(deletedId);
                    state.tasks = state.tasks.filter(t => {
                        const bId = t.boardId || t.board_id;
                        return String(bId) !== strDelId;
                    });
                }
            })
            .addCase('user/deleteBoard/fulfilled', (state, action) => {
                const deletedTarget = action.payload || action.meta?.arg;
                const deletedId = (typeof deletedTarget === 'object' && deletedTarget !== null)
                    ? (deletedTarget.id || deletedTarget._id || deletedTarget.boardId)
                    : deletedTarget;
                if (deletedId) {
                    const strDelId = String(deletedId);
                    state.tasks = state.tasks.filter(t => {
                        const bId = t.boardId || t.board_id;
                        return String(bId) !== strDelId;
                    });
                }
            });
    }
});

export const { hydrateTaskState, addTaskSync, addMultipleTasksSync, deleteTaskSync, deleteMultipleTasksSync, deleteTasksByBoardSync, purgeOrphanedTasksSync, updateTaskSync, updateMultipleTasksSync, updateRecurringSeriesSync, deleteRecurringSeriesSync, clearTasks, loadGuestTasks, setPendingCleanupTaskIds, clearPendingCleanupTaskIds, batchCalendarSyncComplete } = taskSlice.actions;

let saveStorageTimeout = null;
let lastTasksToSave = null;
let lastPersistedJsonByKey = new Map();
let syncAutomationsTimeout = null;

// Per-task serialized calendar write lock so addTask + immediate updateTask / sync
// can never race to create duplicate events in Google Calendar.
const inFlightCalendarWrites = new Map();
const runSerializedTaskCalendarWrite = (taskId, fn) => {
    const key = taskId ? String(taskId) : null;
    if (!key) return Promise.resolve().then(fn);
    const prev = inFlightCalendarWrites.get(key) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    const tracked = next.finally(() => {
        if (inFlightCalendarWrites.get(key) === tracked) {
            inFlightCalendarWrites.delete(key);
        }
    });
    inFlightCalendarWrites.set(key, tracked);
    return next;
};

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
                const serialized = JSON.stringify(lastTasksToSave);
                if (lastPersistedJsonByKey.get(key) === serialized) {
                    return;
                }
                const keysToSave = (key !== 'tasks' && Platform.OS !== 'web') ? [key, 'tasks'] : [key];
                await CryptoStorage.setItemMultiKeys(keysToSave, serialized);
                keysToSave.forEach(k => lastPersistedJsonByKey.set(k, serialized));
            }
        } catch (e) {
            console.error('Error saving tasks to storage:', e);
        }
    }, 300);
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
            const serialized = JSON.stringify(tasks);
            if (lastPersistedJsonByKey.get(key) === serialized) {
                return;
            }
            const keysToSave = key !== 'tasks' ? [key, 'tasks'] : [key];
            await CryptoStorage.setItemMultiKeys(keysToSave, serialized);
            keysToSave.forEach(k => lastPersistedJsonByKey.set(k, serialized));
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
        if (payload.isUndo && payload.task.calendarEventId) {
            payload = {
                ...payload,
                task: {
                    ...payload.task,
                    calendarEventId: null,
                    calendarSyncHash: null,
                }
            };
        }
        if (isPremium && themeState?.defaultReminderEnabled && (!payload.task.reminder || payload.task.reminder === 'None')) {
            payload.task.reminder = themeState.defaultReminderTime || '15 min before';
        }
    }

    // 1. Optimistic UI update: instantaneous 0ms response
    dispatch(addTaskSync(payload)); 
    const tasks = getState().taskReducer.tasks;
    persistTasksToStorage(tasks, getState);
    syncRecurringAutomations(getState);

    // 2. Non-blocking OS reminder scheduling
    if (payload?.task) {
        const hasReminder = payload.task.reminder && payload.task.reminder !== 'None';
        const isKeepAllDay = !!payload.task.keepNotificationAllDay;
        const isAlarm = !!payload.task.isAlarm;
        const effectiveTaskId = payload.task.id || payload.task._id;
        if ((hasReminder || isKeepAllDay || isAlarm) && payload.task.completionDate && !payload.task.completed) {
            scheduleTaskReminder(
                payload.task.taskname,
                payload.task.reminder,
                payload.task.completionDate,
                payload.task.time,
                effectiveTaskId,
                isAlarm,
                themeState,
                {
                    dateString: payload.task.dateString,
                    isNagMode: payload.task.isNagMode,
                    escalationLevel: payload.task.escalationLevel,
                    keepNotificationAllDay: payload.task.keepNotificationAllDay
                }
            )
                .then(notifIds => {
                    if (notifIds && notifIds.length > 0) {
                        dispatch(updateTaskSync({ taskId: effectiveTaskId, notificationId: notifIds }));
                        persistTasksToStorage(getState().taskReducer.tasks, getState);
                    }
                })
                .catch(e => {
                    console.warn('Failed to schedule reminder on addTask:', e);
                });
        }
    }

    // 3. Non-blocking bi-directional write to native Google / device calendar (only for synced boards)
    const boards = state.userReducer?.boards || [];
    const addedDateKey = payload?.task ? extractTaskDateKey(payload.task) : '';
    if (
        themeState?.calendarSyncEnabled &&
        payload?.task &&
        !payload.task.completed &&
        addedDateKey &&
        isTaskEligibleForCalendarSync(payload.task, boards, themeState?.boardCalendarSync)
    ) {
        const effId = payload.task.id || payload.task._id;
        const taskSnapshot = { ...payload.task, dateString: addedDateKey };
        runSerializedTaskCalendarWrite(effId, async () => {
            try {
                const liveBefore = (getState().taskReducer.tasks || []).find(
                    t => t && String(t.id || t._id) === String(effId)
                );
                if (!liveBefore) return;
                const taskToSync = { ...taskSnapshot, ...liveBefore };
                const calEventId = await syncTaskToCalendarAsync(taskToSync, getState().themeReducer || themeState);
                if (!calEventId || !effId) return;

                // If user deleted this task while the native write was in flight, clean up orphan event
                const stillPresent = (getState().taskReducer.tasks || []).some(
                    t => t && String(t.id || t._id) === String(effId)
                );
                if (!stillPresent) {
                    await addTombstoneAsync(calEventId);
                    await removeTaskFromCalendarAsync(calEventId);
                    return;
                }

                dispatch(updateTaskSync({
                    taskId: effId,
                    calendarEventId: calEventId,
                    calendarSyncHash: getTaskCalendarFingerprint(taskToSync, Boolean((getState().themeReducer || themeState)?.calendarAlarmsEnabled))
                }));
                // Flush immediately so calendarEventId & hash survive quick app switches to Google Calendar
                await flushPendingTaskSaves(getState);
            } catch (calErr) {
                console.warn('Background calendar sync error on addTask:', calErr);
            }
        });
    }

    const dbSyncEnabled = state.themeReducer?.dbSyncEnabled !== false && Platform.OS !== 'web';
    if (state.userReducer?.isAuthenticated && dbSyncEnabled && payload?.task) {
        dispatch(addTaskAsync(payload.task));
    }
};

export const addMultipleTasks = (payload) => async (dispatch, getState) => {
    const state = getState();
    const themeState = state.themeReducer;
    const isPremium = state.entitlementReducer?.isPremium;
    if (Array.isArray(payload?.tasks)) {
        for (const task of payload.tasks) {
            if (task && isPremium && themeState?.defaultReminderEnabled && (!task.reminder || task.reminder === 'None')) {
                task.reminder = themeState.defaultReminderTime || '15 min before';
            }
        }
    }

    // 1. Optimistic UI update (immediate 0ms response)
    dispatch(addMultipleTasksSync(payload));
    const tasks = getState().taskReducer.tasks;
    persistTasksToStorage(tasks, getState);
    syncRecurringAutomations(getState);

    // 2. Non-blocking background scheduling of OS notifications (rolling 60-day window cap)
    if (Array.isArray(payload?.tasks) && payload.tasks.length > 0) {
        setTimeout(async () => {
            const horizon = dayjs().add(60, 'day').endOf('day');
            const notifUpdates = [];
            let scheduledCount = 0;

            for (const task of payload.tasks) {
                if (!task || task.completed || !task.completionDate) continue;
                if (scheduledCount >= 50) break; // Guard against OS alarm quota exhaustion
                const hasReminder = task.reminder && task.reminder !== 'None';
                const isKeepAllDay = !!task.keepNotificationAllDay;
                const isAlarm = !!task.isAlarm;
                const effectiveTaskId = task.id || task._id;
                if (!hasReminder && !isKeepAllDay && !isAlarm) continue;
                if (dayjs(task.completionDate).isAfter(horizon)) continue;

                try {
                    const notifIds = await scheduleTaskReminder(
                        task.taskname,
                        task.reminder,
                        task.completionDate,
                        task.time,
                        effectiveTaskId,
                        isAlarm,
                        themeState,
                        {
                            isNagMode: task.isNagMode,
                            escalationLevel: task.escalationLevel,
                            keepNotificationAllDay: task.keepNotificationAllDay
                        }
                    );
                    if (notifIds && notifIds.length > 0) {
                        notifUpdates.push({ taskId: effectiveTaskId, notificationId: notifIds });
                        scheduledCount++;
                    }
                } catch (e) {}
            }

            if (notifUpdates.length > 0) {
                dispatch(updateMultipleTasksSync({ updates: notifUpdates }));
                persistTasksToStorage(getState().taskReducer.tasks, getState);
            }
        }, 0);
    }

    // 3. Non-blocking background push to native Google / device calendar (scoped to rolling sync window & synced boards)
    const boardsForBatch = state.userReducer?.boards || [];
    if (themeState?.calendarSyncEnabled && Array.isArray(payload?.tasks)) {
        setTimeout(async () => {
            const calUpdates = [];
            const now = new Date();
            let pushedCount = 0;
            for (const task of payload.tasks) {
                if (pushedCount >= MAX_EVENTS_PER_SYNC_BATCH) break;
                if (!task || task.completed) continue;
                if (!isTaskEligibleForCalendarSync(task, boardsForBatch, themeState?.boardCalendarSync)) continue;
                const dateKey = extractTaskDateKey(task);
                if (!dateKey || !isDateStrInSyncWindow(dateKey, now)) continue;
                const tid = task.id || task._id;
                if (!tid) continue;
                try {
                    const calEventId = await syncTaskToCalendarAsync(task, themeState);
                    if (calEventId) {
                        calUpdates.push({
                            taskId: tid,
                            calendarEventId: calEventId,
                            calendarSyncHash: getTaskCalendarFingerprint(task, Boolean(themeState?.calendarAlarmsEnabled)),
                        });
                        pushedCount++;
                    }
                } catch (calErr) {}
            }
            if (calUpdates.length > 0) {
                dispatch(updateMultipleTasksSync({ updates: calUpdates }));
                persistTasksToStorage(getState().taskReducer.tasks, getState);
            }
        }, 0);
    }

    const dbSyncEnabled = state.themeReducer?.dbSyncEnabled !== false && Platform.OS !== 'web';
    if (state.userReducer?.isAuthenticated && dbSyncEnabled && Array.isArray(payload?.tasks)) {
        dispatch(addMultipleTasksAsync(payload.tasks));
    }
};

export const deleteTask = (payload) => async (dispatch, getState) => {
    const state = getState();
    const taskId = payload?.taskId || (typeof payload === 'string' ? payload : null);
    const existingTask = taskId ? state.taskReducer.tasks.find(t => t && String(t.id || t._id) === String(taskId)) : null;

    // Immediately record tombstone and delete from Google / Device Calendar (0ms delay)
    if (existingTask) {
        if (existingTask.calendarEventId) {
            addTombstoneAsync(existingTask.calendarEventId);
        }
        removeTaskEventsFromCalendarImmediateAsync([existingTask], state.themeReducer).catch(() => {});
    }

    // 1. Optimistic UI update: Remove from Redux immediately (0ms delay)
    dispatch(deleteTaskSync(payload));

    // 2. Persist local storage immediately
    const remainingTasks = getState().taskReducer.tasks;
    persistTasksToStorage(remainingTasks, getState);
    syncRecurringAutomations(getState);

    // 3. Background async cancellation of OS notifications (with Undo grace check)
    if (taskId) {
        setTimeout(async () => {
            try {
                // Verify if the user tapped Undo during the 5s toast window
                const currentTasks = getState().taskReducer.tasks;
                const isRestored = currentTasks.some(t => t && String(t.id || t._id) === String(taskId));
                if (!isRestored) {
                    if (existingTask) {
                        await cancelNotification(existingTask.notificationId, existingTask.id || existingTask._id);
                    } else {
                        await cancelNotification(null, taskId);
                    }
                }
            } catch (e) {}
        }, 5000);
    }

    // 4. Background DB sync for authenticated users
    const dbSyncEnabled = state.themeReducer?.dbSyncEnabled !== false && Platform.OS !== 'web';
    if (state.userReducer?.isAuthenticated && dbSyncEnabled && taskId) {
        dispatch(deleteTaskAsync(taskId));
    }
};

export const deleteMultipleTasks = (payload) => async (dispatch, getState) => {
    const taskIds = Array.isArray(payload) ? payload : payload?.taskIds;
    if (!Array.isArray(taskIds) || taskIds.length === 0) return;

    const state = getState();
    const idSet = new Set(taskIds.map(String));
    const existingTasks = (state.taskReducer.tasks || []).filter(t => t && idSet.has(String(t.id || t._id)));

    for (const t of existingTasks) {
        if (t.calendarEventId) {
            addTombstoneAsync(t.calendarEventId);
        }
    }
    if (existingTasks.length > 0) {
        removeTaskEventsFromCalendarImmediateAsync(existingTasks, state.themeReducer).catch(() => {});
    }

    // 1. Single batched optimistic UI update
    dispatch(deleteMultipleTasksSync({ taskIds }));

    // 2. Persist local storage once
    const remainingTasks = getState().taskReducer.tasks;
    persistTasksToStorage(remainingTasks, getState);
    syncRecurringAutomations(getState);

    // 3. Background async cancellation of OS notifications (with Undo grace check)
    setTimeout(async () => {
        try {
            const currentTasks = getState().taskReducer.tasks || [];
            const currentIds = new Set(currentTasks.map(t => t && String(t.id || t._id)));
            for (const existing of existingTasks) {
                const effId = existing.id || existing._id;
                if (!currentIds.has(String(effId))) {
                    await cancelNotification(existing.notificationId, effId);
                }
            }
        } catch (e) {}
    }, 5000);

    // 4. Background DB sync for authenticated users
    const dbSyncEnabled = state.themeReducer?.dbSyncEnabled !== false && Platform.OS !== 'web';
    if (state.userReducer?.isAuthenticated && dbSyncEnabled) {
        for (const id of taskIds) {
            dispatch(deleteTaskAsync(id));
        }
    }
};

export const deleteTasksByBoard = (payload) => async (dispatch, getState) => {
    const state = getState();
    const tasks = state.taskReducer.tasks || [];
    let targetId = null;
    let targetName = null;
    if (typeof payload === 'object' && payload !== null) {
        const bObj = (payload.boardId && typeof payload.boardId === 'object') ? payload.boardId : payload;
        targetId = bObj.boardId || bObj.id || bObj._id || null;
        targetName = bObj.boardName || bObj.name || null;
        if (!targetId && typeof bObj === 'string') targetId = bObj;
    } else if (payload) {
        targetId = String(payload);
    }

    const affected = tasks.filter(t => {
        if (!t) return false;
        const bId = t.boardId || t.board_id;
        if (!bId || bId === 'main' || bId === 'tasks') return false;
        const strBId = String(bId);
        if (targetId && strBId === String(targetId)) return true;
        if (targetName && strBId.toLowerCase() === String(targetName).toLowerCase()) return true;
        return false;
    });

    // Record tombstones & immediately remove all calendar events for this board (including unlinked title matches)
    for (const t of affected) {
        if (t?.calendarEventId) {
            addTombstoneAsync(t.calendarEventId);
        }
    }
    if (affected.length > 0) {
        removeBoardEventsFromCalendarAsync(affected, state.themeReducer).catch(() => {});
    }

    // 1. Optimistic UI update
    dispatch(deleteTasksByBoardSync(payload));

    const newTasks = getState().taskReducer.tasks;
    persistTasksToStorage(newTasks, getState);
    syncRecurringAutomations(getState);

    // 2. Background async cancellation of OS notifications
    if (affected.length > 0) {
        setTimeout(async () => {
            for (const t of affected) {
                try {
                    await cancelNotification(t.notificationId, t.id || t._id);
                } catch (e) {}
            }
        }, 0);
    }
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
    const existingTask = taskId ? state.taskReducer.tasks.find(t => t && String(t.id || t._id) === String(taskId)) : null;

    // 1. Optimistic 0ms UI update & immediate storage persistence
    dispatch(updateTaskSync(payload));
    const immediateTasks = getState().taskReducer.tasks;
    persistTasksToStorage(immediateTasks, getState);
    syncRecurringAutomations(getState);

    const updatedTask = taskId ? immediateTasks.find(t => t && String(t.id || t._id) === String(taskId)) : null;

    // 2. Non-blocking background notification & calendar sync so UI / modal close never lags
    setTimeout(async () => {
        if (updatedTask) {
            const effectiveId = updatedTask.id || updatedTask._id;
            const scheduleFieldChanged = Boolean(
                payload &&
                !payload.skipReschedule &&
                payload.notificationId === undefined &&
                (
                    payload.completionDate !== undefined ||
                    payload.time !== undefined ||
                    payload.reminder !== undefined ||
                    payload.isAlarm !== undefined ||
                    payload.isNagMode !== undefined ||
                    payload.escalationLevel !== undefined ||
                    payload.keepNotificationAllDay !== undefined ||
                    payload.name !== undefined
                )
            );
            const justUncompleted = Boolean(existingTask && existingTask.completed && !updatedTask.completed);

            try {
                if (updatedTask.completed) {
                    await cancelNotification(updatedTask.notificationId, effectiveId);
                } else if (justUncompleted || scheduleFieldChanged) {
                    if (scheduleFieldChanged) {
                        await cancelNotification(existingTask?.notificationId || updatedTask.notificationId, effectiveId);
                    }
                    const hasReminder = updatedTask.reminder && updatedTask.reminder !== 'None';
                    const isKeepAllDay = !!updatedTask.keepNotificationAllDay;
                    const isAlarm = !!updatedTask.isAlarm;
                    if ((hasReminder || isKeepAllDay || isAlarm) && updatedTask.completionDate) {
                        try {
                            const notifIds = await scheduleTaskReminder(
                                updatedTask.taskname,
                                updatedTask.reminder,
                                updatedTask.completionDate,
                                updatedTask.time,
                                effectiveId,
                                isAlarm,
                                state.themeReducer,
                                {
                                    dateString: updatedTask.dateString,
                                    isNagMode: updatedTask.isNagMode,
                                    escalationLevel: updatedTask.escalationLevel,
                                    keepNotificationAllDay: updatedTask.keepNotificationAllDay
                                }
                            );
                            dispatch(updateTaskSync({ taskId: effectiveId, notificationId: Array.isArray(notifIds) ? notifIds : [] }));
                            persistTasksToStorage(getState().taskReducer.tasks, getState);
                        } catch (e) {}
                    } else if (scheduleFieldChanged) {
                        dispatch(updateTaskSync({ taskId: effectiveId, notificationId: [] }));
                        persistTasksToStorage(getState().taskReducer.tasks, getState);
                    }
                }
            } catch (e) {}
        }

        if (state.themeReducer?.calendarSyncEnabled && updatedTask) {
            const effUpdatedId = updatedTask.id || updatedTask._id;
            await runSerializedTaskCalendarWrite(effUpdatedId, async () => {
                const liveState = getState();
                const liveTheme = liveState.themeReducer || state.themeReducer;
                const liveBoards = liveState.userReducer?.boards || [];
                const liveTask = (liveState.taskReducer.tasks || []).find(
                    t => t && String(t.id || t._id) === String(effUpdatedId)
                );
                if (!liveTask) return;

                const boardEligible = isTaskEligibleForCalendarSync(liveTask, liveBoards, liveTheme?.boardCalendarSync);
                const liveDateKey = extractTaskDateKey(liveTask);
                try {
                    if (!boardEligible) {
                        if (liveTask.calendarEventId && !liveTask.syncedFromCalendar) {
                            await addTombstoneAsync(liveTask.calendarEventId);
                            await removeTaskFromCalendarAsync(liveTask.calendarEventId);
                            dispatch(updateTaskSync({ taskId: effUpdatedId, calendarEventId: null, calendarSyncHash: null }));
                        }
                    } else if (liveTask.completed) {
                        if (liveTask.calendarEventId) {
                            await syncTaskToCalendarAsync(liveTask, liveTheme);
                            dispatch(updateTaskSync({
                                taskId: effUpdatedId,
                                calendarSyncHash: getTaskCalendarFingerprint(liveTask, Boolean(liveTheme?.calendarAlarmsEnabled))
                            }));
                        }
                    } else if (liveDateKey) {
                        const newCalId = await syncTaskToCalendarAsync(liveTask, liveTheme);
                        if (newCalId) {
                            dispatch(updateTaskSync({
                                taskId: effUpdatedId,
                                calendarEventId: newCalId,
                                calendarSyncHash: getTaskCalendarFingerprint(liveTask, Boolean(liveTheme?.calendarAlarmsEnabled))
                            }));
                        }
                    } else if (!liveDateKey && liveTask.calendarEventId) {
                        await addTombstoneAsync(liveTask.calendarEventId);
                        await removeTaskFromCalendarAsync(liveTask.calendarEventId);
                        dispatch(updateTaskSync({ taskId: effUpdatedId, calendarEventId: null, calendarSyncHash: null }));
                    }
                    persistTasksToStorage(getState().taskReducer.tasks, getState);
                } catch (e) {
                    console.warn('Calendar sync error on updateTask:', e);
                }
            });
        }
    }, 0);

    const dbSyncEnabled = state.themeReducer?.dbSyncEnabled !== false && Platform.OS !== 'web';
    if (state.userReducer?.isAuthenticated && dbSyncEnabled && payload?.taskId) {
        dispatch(updateTaskAsync({ taskId: payload.taskId, payload }));
    }
};

export const updateMultipleTasks = (payload) => async (dispatch, getState) => {
    const { updates, taskIds, changes } = payload || {};
    const state = getState();
    const targetIds = Array.isArray(taskIds) && taskIds.length > 0
        ? taskIds.map(String)
        : (Array.isArray(updates) ? updates.map(u => String(u.taskId)) : []);
    if (targetIds.length === 0) return;

    const idSet = new Set(targetIds);

    // 1. Single batched optimistic UI update
    dispatch(updateMultipleTasksSync(payload));

    const allTasks = getState().taskReducer.tasks || [];
    persistTasksToStorage(allTasks, getState);
    syncRecurringAutomations(getState);

    // 2. Non-blocking background notification & calendar sync for updated tasks
    const updatedTasks = allTasks.filter(t => t && idSet.has(String(t.id || t._id)));
    const themeState = state.themeReducer;
    const boardsForMulti = state.userReducer?.boards || [];

    setTimeout(async () => {
        const calUpdates = [];
        for (const ut of updatedTasks) {
            try {
                const effId = ut.id || ut._id;
                if (ut.completed) {
                    await cancelNotification(ut.notificationId, effId);
                }
                if (themeState?.calendarSyncEnabled) {
                    const boardEligible = isTaskEligibleForCalendarSync(ut, boardsForMulti, themeState?.boardCalendarSync);
                    if (!boardEligible) {
                        if (ut.calendarEventId && !ut.syncedFromCalendar) {
                            await addTombstoneAsync(ut.calendarEventId);
                            await removeTaskFromCalendarAsync(ut.calendarEventId);
                            calUpdates.push({ taskId: effId, calendarEventId: null, calendarSyncHash: null });
                        }
                    } else if (ut.completed) {
                        await syncTaskToCalendarAsync(ut, themeState);
                    } else if (ut.completionDate) {
                        const newCalId = await syncTaskToCalendarAsync(ut, themeState);
                        if (newCalId && newCalId !== ut.calendarEventId) {
                            calUpdates.push({
                                taskId: effId,
                                calendarEventId: newCalId,
                                calendarSyncHash: getTaskCalendarFingerprint(ut, Boolean(themeState?.calendarAlarmsEnabled))
                            });
                        }
                    } else if (!ut.completionDate && ut.calendarEventId) {
                        await addTombstoneAsync(ut.calendarEventId);
                        await removeTaskFromCalendarAsync(ut.calendarEventId);
                        calUpdates.push({ taskId: effId, calendarEventId: null, calendarSyncHash: null });
                    }
                }
            } catch (e) {}
        }
        if (calUpdates.length > 0) {
            dispatch(updateMultipleTasksSync({ updates: calUpdates }));
            persistTasksToStorage(getState().taskReducer.tasks, getState);
        }
    }, 0);

    // 3. Background DB sync for authenticated users
    const dbSyncEnabled = state.themeReducer?.dbSyncEnabled !== false && Platform.OS !== 'web';
    if (state.userReducer?.isAuthenticated && dbSyncEnabled) {
        if (Array.isArray(taskIds) && changes) {
            for (const id of taskIds) {
                dispatch(updateTaskAsync({ taskId: id, payload: { taskId: id, ...changes } }));
            }
        } else if (Array.isArray(updates)) {
            for (const u of updates) {
                if (u && u.taskId) {
                    dispatch(updateTaskAsync({ taskId: u.taskId, payload: u }));
                }
            }
        }
    }
};

let isCalendarSyncInProgress = false;
let lastSyncCompletedTimestamp = 0;

/**
 * Foreground differential calendar sync triggered on AppState active or interval.
 * Open to all users whenever calendarSyncEnabled is active.
 * Includes concurrency mutex, 10s cooldown throttle, and cloud DB deletion harmonization.
 */
export const performForegroundCalendarSync = (force = false) => async (dispatch, getState) => {
    const state = getState();
    const themeState = state.themeReducer;
    if (!themeState?.calendarSyncEnabled || Platform.OS === 'web') {
        return { hasChanges: false, totalSynced: 0 };
    }

    const now = Date.now();
    if (isCalendarSyncInProgress) {
        return { hasChanges: false, inProgress: true };
    }
    if (!force && (now - lastSyncCompletedTimestamp < 10000)) {
        return { hasChanges: false, throttled: true };
    }

    isCalendarSyncInProgress = true;
    try {
        const currentTasks = getState().taskReducer.tasks || [];
        const boards = getState().userReducer?.boards || [];

        // 0. Fetch calendar window ONCE and share between unlinked export self-healing & differential sync
        const prefetchedWindow = await fetchCalendarWindowEventsAsync(themeState);

        // 1. Self-healing export: push any eligible unlinked local tasks in the sync window
        //    (e.g. a task whose initial addTask background write was interrupted by app switching)
        //    excluding tasks with an active in-flight write to prevent duplicates.
        const unlinkedEligible = currentTasks.filter(t => {
            if (!t || t.completed || t.calendarEventId) return false;
            const tid = t.id || t._id;
            if (!tid || inFlightCalendarWrites.has(String(tid))) return false;
            if (!isTaskEligibleForCalendarSync(t, boards, themeState?.boardCalendarSync)) return false;
            const dateKey = extractTaskDateKey(t);
            return Boolean(dateKey && isDateStrInSyncWindow(dateKey, prefetchedWindow.now));
        });

        let fgEventMap = {};
        let fgHashMap = {};
        let fgSyncedCount = 0;
        let fgExportClearedIds = [];
        if (unlinkedEligible.length > 0 && prefetchedWindow?.calendarId) {
            const expRes = await syncAllTasksToCalendarAsync(
                unlinkedEligible,
                themeState,
                prefetchedWindow,
                boards
            );
            fgEventMap = expRes.eventMap || {};
            fgHashMap = expRes.hashMap || {};
            fgSyncedCount = expRes.syncedCount || 0;
            fgExportClearedIds = expRes.clearedEventTaskIds || [];
        }

        // Apply freshly linked IDs/hashes before running differential sync
        const tasksForDiff = (getState().taskReducer.tasks || []).map(t => {
            if (!t) return t;
            const tid = t.id || t._id;
            const nextCalId = (tid && fgEventMap[tid]) || t.calendarEventId;
            const nextHash = (tid && fgHashMap[tid]) || t.calendarSyncHash;
            if (nextCalId !== t.calendarEventId || nextHash !== t.calendarSyncHash) {
                return {
                    ...t,
                    ...(nextCalId ? { calendarEventId: nextCalId } : {}),
                    ...(nextHash ? { calendarSyncHash: nextHash } : {})
                };
            }
            return t;
        });

        const diffResult = await performDifferentialCalendarSyncAsync(themeState, tasksForDiff, prefetchedWindow, boards);
        const { hasChanges: diffHasChanges, newTasks, updatedTasks, deletedTaskIds, clearedEventTaskIds = [], importedCount = 0, deletedCount = 0 } = diffResult;
        const hasExportChanges = Object.keys(fgEventMap).length > 0 || fgExportClearedIds.length > 0;
        const mergedClearedIds = Array.from(new Set([...fgExportClearedIds, ...clearedEventTaskIds].map(String)));

        if (diffHasChanges || hasExportChanges) {
            dispatch(batchCalendarSyncComplete({
                eventMap: fgEventMap,
                hashMap: fgHashMap,
                newTasks,
                updatedTasks,
                deletedTaskIds,
                clearedEventTaskIds: mergedClearedIds
            }));

            const remainingTasks = getState().taskReducer.tasks;
            persistTasksToStorage(remainingTasks, getState);
            syncRecurringAutomations(getState);

            // Cloud DB sync for authenticated users: remove ghost-deleted tasks remotely
            const dbSyncEnabled = themeState?.dbSyncEnabled !== false && Platform.OS !== 'web';
            if (state.userReducer?.isAuthenticated && dbSyncEnabled && Array.isArray(deletedTaskIds) && deletedTaskIds.length > 0) {
                for (const delId of deletedTaskIds) {
                    dispatch(deleteTaskAsync(delId));
                }
            }
        }

        const nowIso = new Date().toISOString();
        lastSyncCompletedTimestamp = Date.now();
        dispatch(setLastCalendarSyncAt(nowIso));
        return {
            hasChanges: diffHasChanges || hasExportChanges,
            exportedCount: fgSyncedCount,
            importedCount,
            deletedCount,
            totalSynced: fgSyncedCount + importedCount + deletedCount + (updatedTasks?.length || 0)
        };
    } catch (error) {
        console.warn('Foreground calendar sync error:', error);
        return { hasChanges: false, error: error.message };
    } finally {
        isCalendarSyncInProgress = false;
    }
};

export const batchSyncCalendarTasks = () => async (dispatch, getState) => {
    const state = getState();
    const themeState = state.themeReducer || {};
    if (!themeState?.calendarSyncEnabled || Platform.OS === 'web') {
        return {
            exportedCount: 0,
            importedCount: 0,
            deletedCount: 0,
            totalSynced: 0
        };
    }
    if (isCalendarSyncInProgress) {
        return {
            exportedCount: 0,
            importedCount: 0,
            deletedCount: 0,
            totalSynced: 0,
            inProgress: true
        };
    }

    isCalendarSyncInProgress = true;
    try {
        const tasks = state.taskReducer.tasks || [];
        const boards = state.userReducer?.boards || [];

        // 0. Prefetch Google / device calendar window ONCE (safe 14-day chunks)
        //    so export can match & link existing calendar events instead of duplicating them.
        const prefetchedWindow = await fetchCalendarWindowEventsAsync(themeState);

        // 0b. Deduplicate any previously imported 'main' calendar copies that duplicate tasks on
        //     other boards (payments, birthdays, events, grocery, habits, etc.) BEFORE exporting.
        const dedupPlan = buildTaskDeduplicationPlan(tasks, boards, themeState?.boardCalendarSync);
        const dupIdSet = new Set(dedupPlan.duplicateTaskIds.map(String));
        const transferMap = new Map(dedupPlan.linkTransfers.map(tr => [String(tr.taskId), tr.calendarEventId]));

        for (const orphanCalId of dedupPlan.orphanCalendarEventIds) {
            addTombstoneAsync(orphanCalId).catch(() => {});
            removeTaskFromCalendarAsync(orphanCalId).catch(() => {});
            if (prefetchedWindow?.activeNativeEventMap) {
                prefetchedWindow.activeNativeEventMap.delete(String(orphanCalId));
            }
            if (prefetchedWindow?.activeNativeIds) {
                prefetchedWindow.activeNativeIds.delete(String(orphanCalId));
            }
        }

        const tasksBeforeExport = tasks
            .filter(t => {
                if (!t) return false;
                const tid = t.id || t._id;
                if (tid && dupIdSet.has(String(tid))) return false;
                // Skip tasks whose immediate addTask/updateTask calendar write is still in-flight
                if (tid && !t.calendarEventId && inFlightCalendarWrites.has(String(tid))) return false;
                return true;
            })
            .map(t => {
                const tid = t.id || t._id;
                if (tid && transferMap.has(String(tid))) {
                    return { ...t, calendarEventId: transferMap.get(String(tid)) };
                }
                return t;
            });

        // 1. Export/link eligible board tasks & remove old [Synced from TaskFlow] events for unsynced boards
        const {
            syncedCount = 0,
            removedCount = 0,
            eventMap = {},
            hashMap = {},
            clearedEventTaskIds: exportClearedIds = []
        } = await syncAllTasksToCalendarAsync(
            tasksBeforeExport,
            themeState,
            prefetchedWindow,
            boards
        );

        const exportClearedSet = new Set((exportClearedIds || []).map(String));

        // Merge newly linked/created eventMap IDs & cleared unsynced links before differential sync
        const tasksWithUpdatedEventIds = tasks.map(t => {
            if (!t) return t;
            const tid = t.id || t._id;
            if (tid && exportClearedSet.has(String(tid))) {
                return { ...t, calendarEventId: null, calendarSyncHash: null };
            }
            const nextCalId = (tid && eventMap && eventMap[tid]) || (tid && transferMap.get(String(tid))) || t.calendarEventId;
            const nextHash = (tid && hashMap && hashMap[tid]) || t.calendarSyncHash;
            if (nextCalId !== t.calendarEventId || nextHash !== t.calendarSyncHash) {
                return {
                    ...t,
                    ...(nextCalId ? { calendarEventId: nextCalId } : {}),
                    ...(nextHash ? { calendarSyncHash: nextHash } : {})
                };
            }
            return t;
        });

        // 2. Differential sync from Google / device calendar to local tasks (reusing prefetchedWindow)
        const {
            newTasks = [],
            updatedTasks = [],
            deletedTaskIds = [],
            clearedEventTaskIds: diffClearedIds = [],
            importedCount = 0
        } = await performDifferentialCalendarSyncAsync(themeState, tasksWithUpdatedEventIds, prefetchedWindow, boards);

        // Merge pre-export link transfers, cleared unsynced board links & duplicate removals
        const mergedDeletedIds = Array.from(new Set([...dedupPlan.duplicateTaskIds, ...deletedTaskIds].map(String)));
        const mergedClearedIds = Array.from(new Set([...(exportClearedIds || []), ...(diffClearedIds || [])].map(String)));
        const mergedUpdatedTasks = [...dedupPlan.linkTransfers, ...updatedTasks];

        // 3. Atomically update Redux in ONE single dispatch
        dispatch(batchCalendarSyncComplete({
            eventMap,
            hashMap,
            newTasks,
            updatedTasks: mergedUpdatedTasks,
            deletedTaskIds: mergedDeletedIds,
            clearedEventTaskIds: mergedClearedIds
        }));

        // 4. Persist to storage once
        persistTasksToStorage(getState().taskReducer.tasks, getState);
        syncRecurringAutomations(getState);

        // 5. Harmonize with remote DB
        const dbSyncEnabled = themeState?.dbSyncEnabled !== false && Platform.OS !== 'web';
        if (state.userReducer?.isAuthenticated && dbSyncEnabled && mergedDeletedIds.length > 0) {
            for (const delId of mergedDeletedIds) {
                dispatch(deleteTaskAsync(delId));
            }
        }

        const summary = {
            exportedCount: syncedCount || 0,
            importedCount: importedCount || 0,
            removedCount: removedCount || 0,
            deletedCount: mergedDeletedIds.length,
            totalSynced: (syncedCount || 0) + (importedCount || 0) + mergedDeletedIds.length + (removedCount || 0)
        };

        const nowDate = new Date();
        lastSyncCompletedTimestamp = nowDate.getTime();
        await markCalendarSyncCompletedAsync(summary, nowDate);
        dispatch(setLastCalendarSyncAt(nowDate.toISOString()));

        return summary;
    } catch (error) {
        console.warn('batchSyncCalendarTasks error:', error);
        return {
            exportedCount: 0,
            importedCount: 0,
            deletedCount: 0,
            totalSynced: 0,
            error: error.message
        };
    } finally {
        isCalendarSyncInProgress = false;
    }
};

/**
 * Checks whether a 3x/day scheduled calendar sync slot (08:00, 12:00, 17:00) is due
 * and runs a full bi-directional calendar sync if due (or when forced).
 */
export const performScheduledCalendarSync = (force = false) => async (dispatch, getState) => {
    const state = getState();
    const themeState = state.themeReducer;
    if (!themeState?.calendarSyncEnabled || Platform.OS === 'web') {
        return { ran: false, totalSynced: 0 };
    }

    try {
        const scheduleState = await getCalendarSyncScheduleStateAsync();
        const dueInfo = isScheduledCalendarSyncDue(scheduleState.lastSyncedSlotKey, new Date());

        if (!force && !dueInfo.isDue) {
            return {
                ran: false,
                dueSlotKey: dueInfo.dueSlotKey,
                nextSyncTime: dueInfo.nextSyncTime,
                totalSynced: 0
            };
        }

        const result = await dispatch(batchSyncCalendarTasks());
        return {
            ran: !result?.inProgress,
            dueSlotKey: dueInfo.dueSlotKey,
            nextSyncTime: dueInfo.nextSyncTime,
            ...result
        };
    } catch (error) {
        console.warn('performScheduledCalendarSync error:', error);
        return { ran: false, totalSynced: 0, error: error.message };
    }
};

/**
 * Toggles Google / Device Calendar synchronization for a single board (from Board Long-Tap menu or Settings).
 * - Immediately updates & persists the per-board override in themeReducer.boardCalendarSync.
 * - When turned OFF: automatically removes previously exported [Synced from TaskFlow] events
 *   for that board from Google Calendar while keeping every task intact in the app.
 * - When turned ON: syncs eligible tasks on that board within the rolling sync window to Google Calendar.
 */
export const toggleBoardCalendarSync = ({ boardId, enabled }) => async (dispatch, getState) => {
    const canonicalKey = getBoardCalendarSyncKey(boardId);
    dispatch(setBoardCalendarSync({ boardId: canonicalKey, enabled: Boolean(enabled) }));

    const state = getState();
    const themeState = state.themeReducer || {};
    if (Platform.OS === 'web' || !themeState.calendarSyncEnabled) {
        return { boardId: canonicalKey, enabled: Boolean(enabled), syncedCount: 0, removedCount: 0 };
    }

    const boards = state.userReducer?.boards || [];
    const allTasks = state.taskReducer?.tasks || [];
    const boardTasks = allTasks.filter(t => {
        if (!t) return false;
        const ownerBoard = resolveTaskBoard(t, boards);
        return getBoardCalendarSyncKey(ownerBoard) === canonicalKey;
    });

    try {
        if (!enabled) {
            // Also find any bogus `syncedFromCalendar: true` duplicate copies sitting on Main
            // whose normalized title matches a task on the board being turned OFF
            const boardTitles = new Set(boardTasks.map(getTaskMatchTitle).filter(Boolean));
            const mainDuplicates = canonicalKey !== 'main'
                ? allTasks.filter(t => {
                    if (!t) return false;
                    const tid = t.id || t._id;
                    const isCalImport = t.syncedFromCalendar === true || (tid && String(tid).startsWith('cal_'));
                    if (!isCalImport || !isMainBoardId(t.boardId || t.board_id)) return false;
                    const norm = getTaskMatchTitle(t);
                    return Boolean(norm && boardTitles.has(norm));
                })
                : [];
            const mainDupIds = mainDuplicates.map(t => t.id || t._id).filter(Boolean);

            const { removedCount = 0, clearedEventTaskIds = [] } = await removeBoardEventsFromCalendarAsync(
                [...boardTasks, ...mainDuplicates],
                themeState
            );
            if (clearedEventTaskIds.length > 0 || mainDupIds.length > 0) {
                dispatch(batchCalendarSyncComplete({
                    clearedEventTaskIds,
                    deletedTaskIds: mainDupIds
                }));
                persistTasksToStorage(getState().taskReducer.tasks, getState);
            }
            return { boardId: canonicalKey, enabled: false, syncedCount: 0, removedCount };
        } else {
            const prefetchedWindow = await fetchCalendarWindowEventsAsync(themeState);
            const { syncedCount = 0, eventMap = {}, hashMap = {} } = await syncAllTasksToCalendarAsync(
                boardTasks,
                themeState,
                prefetchedWindow,
                boards
            );
            if (Object.keys(eventMap).length > 0) {
                dispatch(batchCalendarSyncComplete({ eventMap, hashMap }));
                persistTasksToStorage(getState().taskReducer.tasks, getState);
            }
            return { boardId: canonicalKey, enabled: true, syncedCount, removedCount: 0 };
        }
    } catch (error) {
        console.warn('toggleBoardCalendarSync error:', error);
        return { boardId: canonicalKey, enabled: Boolean(enabled), syncedCount: 0, removedCount: 0, error: error.message };
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
    const { seriesId, fromDate, excludeTaskId } = payload || {};
    const fromDay = fromDate ? dayjs(fromDate).startOf('day') : null;
    const affected = seriesId ? (state.taskReducer.tasks || []).filter(t => {
        if (t && t.recurringSeriesId === seriesId) {
            if (excludeTaskId && t.id === excludeTaskId) return false;
            if (!fromDay) return true;
            const taskDay = t.completionDate ? dayjs(t.completionDate).startOf('day') : null;
            return taskDay && (taskDay.isSame(fromDay, 'day') || taskDay.isAfter(fromDay));
        }
        return false;
    }) : [];

    for (const t of affected) {
        if (t?.calendarEventId) {
            addTombstoneAsync(t.calendarEventId);
        }
    }

    // 1. Optimistic UI update: Remove series tasks from Redux state immediately
    dispatch(deleteRecurringSeriesSync(payload));

    // 2. Persist local storage immediately
    const tasks = getState().taskReducer.tasks;
    persistTasksToStorage(tasks, getState);
    syncRecurringAutomations(getState);

    // 3. Background async cancellation of OS notifications & linked calendar events
    if (affected.length > 0) {
        setTimeout(async () => {
            for (const t of affected) {
                try {
                    await cancelNotification(t.notificationId, t.id);
                    if (t.calendarEventId) {
                        await removeTaskFromCalendarAsync(t.calendarEventId);
                    }
                } catch (e) {}
            }
        }, 0);
    }

    // 4. Background DB sync for authenticated users
    const dbSyncEnabled = state.themeReducer?.dbSyncEnabled !== false && Platform.OS !== 'web';
    if (state.userReducer?.isAuthenticated && dbSyncEnabled && affected.length > 0) {
        for (const t of affected) {
            if (t && t.id) {
                dispatch(deleteTaskAsync(t.id));
            }
        }
    }
};

let lastAutoManageRun = 0;

export const rolloverHabitTasks = () => async (dispatch, getState) => {
    const state = getState();
    const tasks = state.taskReducer?.tasks || [];
    if (!tasks || tasks.length === 0) return [];
    const boards = state.userReducer?.boards || [];
    const streakMode = state.themeReducer?.habitStreakMode || 'grace';
    const todayStr = dayjs().format('YYYY-MM-DD');

    const patches = computeHabitRolloverUpdates(tasks, boards, todayStr, streakMode);
    if (patches.length === 0) return [];

    const updates = patches.map(({ taskId, ...rest }) => ({ taskId, ...rest }));
    dispatch(updateMultipleTasksSync({ updates }));
    persistTasksToStorage(getState().taskReducer.tasks, getState);
    return updates;
};

export const processAutoManageTasks = (force = false) => async (dispatch, getState) => {
    await dispatch(rolloverHabitTasks());
    const state = getState();
    const isPremium = state.entitlementReducer?.isPremium;
    if (!isPremium) return;

    const now = Date.now();
    if (!force && now - lastAutoManageRun < 60000) {
        return;
    }
    lastAutoManageRun = now;

    const tasks = state.taskReducer.tasks;
    if (!tasks || tasks.length === 0) return;

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

    const hasAnyGlobalAutomation = 
        (globalSettings.autoTransferMode && globalSettings.autoTransferMode !== 'none') ||
        globalSettings.increasePriorityWhenOverdue ||
        globalSettings.removePriorityWhenCompleted ||
        globalSettings.autoDeleteOverdueDays > 0 ||
        globalSettings.autoDeleteCompletedDays > 0;

    const hasBoardAutomationOverrides = Object.values(boardAutomations).some(
        b => b && b.overrideGlobal === true
    );

    if (!hasAnyGlobalAutomation && !hasBoardAutomationOverrides) {
        return;
    }
    
    const actualToday = dayjs().startOf('day');

    let hasChanges = false;
    let processedTasks = [];
    let tasksToDelete = [];
    
    for (const task of tasks) {
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
                                    { isNagMode: updatedTask.isNagMode, escalationLevel: updatedTask.escalationLevel, keepNotificationAllDay: updatedTask.keepNotificationAllDay }
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
            processedTasks.push(updatedTask);
        } else {
            processedTasks.push(task);
        }
    }

    let newTasks = processedTasks;

    if (tasksToDelete.length > 0 && !globalSettings.confirmBeforeDeletion) {
        for (const id of tasksToDelete) {
            const t = tasks.find(item => item && String(item.id) === String(id));
            if (t) {
                await cancelNotification(t.notificationId, t.id);
            }
        }
        newTasks = newTasks.filter(t => !tasksToDelete.includes(t.id));
        hasChanges = true;
    }

    if (hasChanges) {
        dispatch(hydrateTaskState(newTasks));
        persistTasksToStorage(newTasks, getState);
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
        persistTasksToStorage(finalTasks, getState);
        syncRecurringAutomations(getState);
    }
    dispatch(clearPendingCleanupTaskIds());
};

export const cancelPendingCleanup = () => (dispatch) => {
    dispatch(clearPendingCleanupTaskIds());
};

export default taskSlice.reducer;
