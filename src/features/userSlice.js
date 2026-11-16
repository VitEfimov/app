import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import axios from 'axios';
import { sanitizeAuthCredentials, sanitizeId, sanitizeForStorage } from '../utils/securitySanitizer';
import { CryptoStorage } from '../utils/cryptoStorage';

const memoryDeletedBoardIds = new Set();

const persistBoards = async (boards) => {
    const clean = (boards || []).map(b => sanitizeForStorage(b));
    const serialized = JSON.stringify(clean);
    try {
        if (CryptoStorage && typeof CryptoStorage.setItem === 'function') {
            await CryptoStorage.setItem('boards', serialized);
        }
    } catch (e) {}
    try {
        await AsyncStorage.setItem('boards', serialized);
    } catch (e) {}
};

const persistDeletedBoardIds = async (deletedIds) => {
    const serialized = JSON.stringify(Array.from(new Set(deletedIds || [])));
    try {
        if (CryptoStorage && typeof CryptoStorage.setItem === 'function') {
            await CryptoStorage.setItem('deleted_boards', serialized);
        }
    } catch (e) {}
    try {
        await AsyncStorage.setItem('deleted_boards', serialized);
    } catch (e) {}
};

const loadThemeFromLocalStorage = () => "light";
const loadShowWeatherFromLocalStorage = () => false;
const loadIsGuestFromLocalStorage = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem('isGuest');
        if (val !== null) return val === 'true';
    }
    return true;
};
const loadTaskOptionsCollapsedFromLocalStorage = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem('isTaskOptionsCollapsed');
        if (val !== null) return val === 'true';
    }
    return true; // hidden by default
};
const loadLayoutVersionFromLocalStorage = () => "v1";
const loadBoardsFromLocalStorage = () => [{ id: 'main', name: 'Main', type: 'standard' }];

export const checkAuth = createAsyncThunk('user/checkAuth', async (_, thunkAPI) => {
    try {
        const fullState = thunkAPI.getState();
        const dbSyncEnabled = fullState.themeReducer?.dbSyncEnabled !== false;
        if (!dbSyncEnabled || Platform.OS === 'web') {
            return { dbSyncDisabled: true };
        }
        const response = await axios.get('/api/auth/me', { withCredentials: true });
        return { ...response.data, dbSyncDisabled: false };
    } catch (err) {
        return thunkAPI.rejectWithValue(err.response?.data?.message || err.message);
    }
});

export const loginUser = createAsyncThunk('user/login', async ({ email, password, rememberMe }, thunkAPI) => {
    try {
        const sanitized = sanitizeAuthCredentials({ email, password, rememberMe });
        const fullState = thunkAPI.getState();
        const dbSyncEnabled = fullState.themeReducer?.dbSyncEnabled !== false;
        const response = await axios.post('/api/auth/login', sanitized, { withCredentials: true });
        if (sanitized.rememberMe) {
            await AsyncStorage.setItem('rememberedUser', JSON.stringify({ email: sanitized.email, rememberMe: true }));
        } else {
            await AsyncStorage.removeItem('rememberedUser');
        }
        return { ...response.data, dbSyncDisabled: !dbSyncEnabled };
    } catch (err) {
        const msg = err.response?.data?.message || (err.message === 'Network Error' ? 'Network / CORS Error: Cross-origin requests from localhost are blocked by backend CORS policy.' : err.message);
        return thunkAPI.rejectWithValue(msg);
    }
});

export const registerUser = createAsyncThunk('user/register', async ({ email, password }, thunkAPI) => {
    try {
        const sanitized = sanitizeAuthCredentials({ email, password, rememberMe: false });
        const fullState = thunkAPI.getState();
        const dbSyncEnabled = fullState.themeReducer?.dbSyncEnabled !== false;
        const response = await axios.post('/api/auth/register', { email: sanitized.email, password: sanitized.password }, { withCredentials: true });
        return { ...response.data, dbSyncDisabled: !dbSyncEnabled };
    } catch (err) {
        const msg = err.response?.data?.message || (err.message === 'Network Error' ? 'Network / CORS Error: Cross-origin requests from localhost are blocked by backend CORS policy.' : err.message);
        return thunkAPI.rejectWithValue(msg);
    }
});

export const updateThemeAsync = createAsyncThunk('user/updateTheme', async (theme, thunkAPI) => {
    try {
        const response = await axios.put('/api/user/theme', { theme }, { withCredentials: true });
        return response.data;
    } catch (err) {
        return thunkAPI.rejectWithValue(err.response?.data?.message || err.message);
    }
});

export const logoutUser = createAsyncThunk('user/logout', async (_, thunkAPI) => {
    try {
        await axios.post('/api/auth/logout', {}, { withCredentials: true });
    } catch (err) {
        // Silently catch network error on logout
    }
    await AsyncStorage.removeItem('isGuest');
    await AsyncStorage.removeItem('rememberedUser');
    thunkAPI.dispatch({ type: 'task/clearTasks' });
    return true;
});

export const changePassword = createAsyncThunk('user/changePassword', async ({ currentPassword, newPassword }, thunkAPI) => {
    try {
        const response = await axios.post('/api/auth/change-password', { currentPassword, newPassword }, { withCredentials: true });
        return response.data;
    } catch (err) {
        return thunkAPI.rejectWithValue(err.response?.data?.message || err.message);
    }
});

export const addBoardAsync = createAsyncThunk('user/addBoard', async ({ id, name, type = 'standard', color, repeatConfig, repeatDuration }, thunkAPI) => {
    const fullState = thunkAPI.getState();
    const state = fullState.userReducer;
    const dbSyncEnabled = fullState.themeReducer?.dbSyncEnabled !== false;
    const safeId = sanitizeId(id);
    const safePayload = sanitizeForStorage({ id: safeId, name, type, color, repeatConfig, repeatDuration });
    if (state.isAuthenticated && dbSyncEnabled) {
        try {
            const response = await axios.post('/api/boards', safePayload, { withCredentials: true });
            return response.data;
        } catch (e) {
            // Optimistic fallback
        }
    }
    return safePayload;
});

export const renameBoardAsync = createAsyncThunk('user/renameBoard', async ({ id, name }, thunkAPI) => {
    const fullState = thunkAPI.getState();
    const state = fullState.userReducer;
    const dbSyncEnabled = fullState.themeReducer?.dbSyncEnabled !== false;
    const safeId = sanitizeId(id);
    const safePayload = sanitizeForStorage({ name });
    if (state.isAuthenticated && dbSyncEnabled) {
        try {
            const response = await axios.put(`/api/boards/${safeId}`, safePayload, { withCredentials: true });
            return response.data;
        } catch (e) {
            // Optimistic fallback
        }
    }
    return { id: safeId, name: safePayload.name };
});

export const updateBoardColorAsync = createAsyncThunk('user/updateBoardColor', async ({ id, color }, thunkAPI) => {
    const fullState = thunkAPI.getState();
    const state = fullState.userReducer;
    const dbSyncEnabled = fullState.themeReducer?.dbSyncEnabled !== false;
    const safeId = sanitizeId(id);
    const safePayload = sanitizeForStorage({ color });
    if (state.isAuthenticated && dbSyncEnabled) {
        try {
            const response = await axios.put(`/api/boards/${safeId}`, safePayload, { withCredentials: true });
            return response.data;
        } catch (e) {
            // Optimistic fallback
        }
    }
    return { id: safeId, color: safePayload.color };
});

export const deleteBoardAsync = createAsyncThunk('user/deleteBoard', async (arg, thunkAPI) => {
    const fullState = thunkAPI.getState();
    const state = fullState.userReducer;
    const dbSyncEnabled = fullState.themeReducer?.dbSyncEnabled !== false;

    let rawId = null;
    let rawName = null;
    if (typeof arg === 'object' && arg !== null) {
        rawId = arg.id || arg._id || arg.boardId;
        rawName = arg.name || arg.boardName;
    } else {
        rawId = arg;
    }

    const safeId = sanitizeId(rawId);

    if (state.isAuthenticated && dbSyncEnabled && safeId && safeId !== 'main') {
        try {
            await axios.delete(`/api/boards/${safeId}`, { withCredentials: true });
        } catch (e) {
            // Optimistic fallback
        }
    }
    return { id: safeId || (rawId ? String(rawId) : ''), name: rawName };
});

const mergeBoards = (currentBoards = [], incomingBoards = [], deletedIds = []) => {
    const tombstoneSet = new Set((deletedIds || []).map(String));
    const boardMap = new Map();

    (currentBoards || []).forEach(b => {
        if (!b) return;
        const id = b.id || b._id;
        const strId = id ? String(id).trim() : null;
        if (strId && tombstoneSet.has(strId)) return;
        const key = strId || (b.name ? String(b.name).trim().toLowerCase() : null);
        if (key) {
            boardMap.set(key, { ...b, id: id || b.name });
        }
    });

    (incomingBoards || []).forEach(b => {
        if (!b) return;
        const id = b.id || b._id;
        const strId = id ? String(id).trim() : null;
        if (strId && tombstoneSet.has(strId)) return;

        // Check if existing by ID
        let existingKey = (strId && boardMap.has(strId)) ? strId : null;
        // If not by ID, check by matching name (case-insensitive) to prevent duplicate boards (e.g. 2 Payments)
        if (!existingKey && b.name) {
            const cleanName = String(b.name).trim().toLowerCase();
            for (const [k, v] of boardMap.entries()) {
                if (v.name && String(v.name).trim().toLowerCase() === cleanName) {
                    existingKey = k;
                    break;
                }
            }
        }

        if (existingKey) {
            const existing = boardMap.get(existingKey);
            boardMap.set(existingKey, {
                ...existing,
                ...b,
                id: existing.id || id || existingKey,
                _id: b._id || existing._id,
            });
        } else {
            const finalKey = strId || (b.name ? String(b.name).trim().toLowerCase() : 'board_' + Date.now());
            boardMap.set(finalKey, { ...b, id: id || finalKey });
        }
    });

    const result = Array.from(boardMap.values());
    if (!result.some(b => (b.id || b._id) === 'main' || b.name === 'Main')) {
        result.unshift({ id: 'main', name: 'Main', type: 'standard' });
    }
    return result;
};

const syncUnsyncedBoards = async (mergedBoards = [], remoteBoards = [], dbSyncEnabled = true, deletedBoardIds = []) => {
    if (!dbSyncEnabled) return;
    const tombstoneSet = new Set((deletedBoardIds || []).map(String));

    for (const delId of tombstoneSet) {
        if (delId && delId !== 'main') {
            try {
                await axios.delete(`/api/boards/${delId}`, { withCredentials: true });
            } catch (err) {
                // Ignore if already deleted on backend
            }
        }
    }

    const remoteIds = new Set((remoteBoards || []).map(b => String(b.id || b._id)));
    const remoteNames = new Set((remoteBoards || []).map(b => b.name));
    for (const b of mergedBoards) {
        const bId = String(b.id || b._id || '');
        if (b && (b.id || b.name) && !tombstoneSet.has(bId) && !remoteIds.has(bId) && !remoteNames.has(b.name)) {
            try {
                await axios.post('/api/boards', { id: b.id, name: b.name, type: b.type, color: b.color }, { withCredentials: true });
            } catch (err) {
                console.warn("Failed to sync local board to DB:", b.name, err.message);
            }
        }
    }
};

const initialState = {
    isAuthenticated: false,
    userEmail: null,
    loading: false,
    error: null,
    theme: loadThemeFromLocalStorage(),
    showWeather: loadShowWeatherFromLocalStorage(),
    isGuest: loadIsGuestFromLocalStorage(),
    boards: loadBoardsFromLocalStorage(),
    deletedBoardIds: [],
    activeBoardId: 'main',
    dashboardFilterType: 'all',
    layoutVersion: loadLayoutVersionFromLocalStorage(),
    isTaskOptionsCollapsed: loadTaskOptionsCollapsedFromLocalStorage(),
};

const removeBoardFromState = (state, target) => {
    let rawId = null;
    let rawName = null;
    if (typeof target === 'object' && target !== null) {
        rawId = target.id || target._id || target.boardId;
        rawName = target.name || target.boardName;
    } else {
        rawId = target;
    }

    const strId = rawId ? String(rawId).trim() : null;
    const strName = rawName ? String(rawName).trim().toLowerCase() : null;

    if (!strId && !strName) return;

    if (strId && strId !== 'main') {
        memoryDeletedBoardIds.add(strId);
        if (!state.deletedBoardIds) state.deletedBoardIds = [];
        if (!state.deletedBoardIds.includes(strId)) {
            state.deletedBoardIds.push(strId);
        }
        persistDeletedBoardIds(state.deletedBoardIds);
    }

    state.boards = (state.boards || []).filter(b => {
        if (!b) return false;
        const bId = b.id || b._id;
        const strBId = bId ? String(bId).trim() : null;
        const strBName = b.name ? String(b.name).trim().toLowerCase() : null;

        // Never delete Main
        if (strBId === 'main' || strBName === 'main') return true;

        // Match by ID
        if (strId && strBId === strId) return false;

        // If no ID matched but name matched and this was a name-only delete
        if (!strId && strName && strBName === strName) return false;

        return true;
    });

    if (strId && (state.activeBoardId === strId || String(state.activeBoardId) === strId)) {
        state.activeBoardId = 'main';
    }

    persistBoards(state.boards);
};

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        hydrateUserState: (state, action) => {
            const { boards, deletedBoardIds, ...rest } = action.payload || {};
            Object.assign(state, rest);

            if (deletedBoardIds && Array.isArray(deletedBoardIds)) {
                const combined = new Set([...(state.deletedBoardIds || []), ...deletedBoardIds.map(String)]);
                state.deletedBoardIds = Array.from(combined);
                state.deletedBoardIds.forEach(id => memoryDeletedBoardIds.add(id));
            }

            if (boards && Array.isArray(boards)) {
                const tombstoneSet = new Set((state.deletedBoardIds || []).map(String));
                let validBoards = boards.filter(b => {
                    if (!b) return false;
                    const bId = String(b.id || b._id || '');
                    return !tombstoneSet.has(bId);
                });
                if (!validBoards.some(b => (b.id || b._id) === 'main' || b.name === 'Main')) {
                    validBoards.unshift({ id: 'main', name: 'Main', type: 'standard' });
                }
                state.boards = validBoards;
            }
            return state;
        },
        logout: (state) => {
            state.isAuthenticated = false;
            state.userEmail = null;
            state.isGuest = true;
            state.boards = loadBoardsFromLocalStorage();
            state.deletedBoardIds = [];
            state.activeBoardId = 'main';
            state.dashboardFilterType = 'all';
            AsyncStorage.setItem('isGuest', 'true');
            AsyncStorage.removeItem('rememberedUser');
        },
        continueAsGuest: (state) => {
            state.isGuest = true;
            state.isAuthenticated = false;
            AsyncStorage.setItem('isGuest', 'true');
        },
        updateUserTheme: (state, action) => {
            state.theme = action.payload;
            AsyncStorage.setItem('theme', action.payload);
        },
        updateShowWeather: (state, action) => {
            state.showWeather = action.payload;
            AsyncStorage.setItem('showWeather', action.payload ? 'true' : 'false');
        },
        setActiveBoardId: (state, action) => {
            state.activeBoardId = action.payload;
        },
        setDashboardFilterType: (state, action) => {
            state.dashboardFilterType = action.payload;
            AsyncStorage.setItem('dashboardFilterType', action.payload);
        },
        toggleLayoutVersion: (state) => {
            state.layoutVersion = state.layoutVersion === 'v1' ? 'v2' : 'v1';
            AsyncStorage.setItem('layoutVersion', state.layoutVersion);
        },
        toggleTaskOptionsCollapsed: (state) => {
            state.isTaskOptionsCollapsed = !state.isTaskOptionsCollapsed;
            AsyncStorage.setItem('isTaskOptionsCollapsed', String(state.isTaskOptionsCollapsed));
        },
        setTaskOptionsCollapsed: (state, action) => {
            state.isTaskOptionsCollapsed = action.payload;
            AsyncStorage.setItem('isTaskOptionsCollapsed', String(action.payload));
        },
        updateBoardRepeatSettings: (state, action) => {
            const { boardId, repeatConfig, repeatDuration } = action.payload || {};
            const board = state.boards.find(b => b && (String(b.id) === String(boardId) || String(b._id) === String(boardId)));
            if (board) {
                if (repeatConfig !== undefined) board.repeatConfig = repeatConfig;
                if (repeatDuration !== undefined) board.repeatDuration = repeatDuration;
                persistBoards(state.boards);
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(checkAuth.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(checkAuth.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.isGuest = false;
                if (action.payload?.email) {
                    state.userEmail = action.payload.email;
                }
                const remoteBoards = action.payload?.boards || [];
                const tombstoneSet = new Set((state.deletedBoardIds || []).map(String));
                const filteredRemote = remoteBoards.filter(b => b && !tombstoneSet.has(String(b.id || b._id)));
                const merged = mergeBoards(state.boards, filteredRemote, state.deletedBoardIds);
                state.boards = merged;
                persistBoards(merged);
                syncUnsyncedBoards(merged, filteredRemote, !action.payload?.dbSyncDisabled, state.deletedBoardIds);
                if (action.payload?.theme) {
                    state.theme = action.payload.theme;
                    AsyncStorage.setItem('theme', action.payload.theme);
                }
            })
            .addCase(checkAuth.rejected, (state) => {
                state.loading = false;
                if (!state.isAuthenticated) {
                    state.isGuest = true;
                }
            })
            .addCase(loginUser.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.isGuest = false;
                if (action.payload?.email) {
                    state.userEmail = action.payload.email;
                }
                const remoteBoards = action.payload?.boards || [];
                const tombstoneSet = new Set((state.deletedBoardIds || []).map(String));
                const filteredRemote = remoteBoards.filter(b => b && !tombstoneSet.has(String(b.id || b._id)));
                const merged = mergeBoards(state.boards, filteredRemote, state.deletedBoardIds);
                state.boards = merged;
                persistBoards(merged);
                syncUnsyncedBoards(merged, filteredRemote, !action.payload?.dbSyncDisabled, state.deletedBoardIds);
                if (action.payload?.theme) {
                    state.theme = action.payload.theme;
                    AsyncStorage.setItem('theme', action.payload.theme);
                }
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(registerUser.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(registerUser.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.isGuest = false;
                if (action.payload?.email) {
                    state.userEmail = action.payload.email;
                }
                const remoteBoards = action.payload?.boards || [];
                const tombstoneSet = new Set((state.deletedBoardIds || []).map(String));
                const filteredRemote = remoteBoards.filter(b => b && !tombstoneSet.has(String(b.id || b._id)));
                const merged = mergeBoards(state.boards, filteredRemote, state.deletedBoardIds);
                state.boards = merged;
                persistBoards(merged);
                syncUnsyncedBoards(merged, filteredRemote, !action.payload?.dbSyncDisabled, state.deletedBoardIds);
                if (action.payload?.theme) {
                    state.theme = action.payload.theme;
                    AsyncStorage.setItem('theme', action.payload.theme);
                }
            })
            .addCase(registerUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(changePassword.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(changePassword.fulfilled, (state) => {
                state.loading = false;
                state.error = null;
            })
            .addCase(changePassword.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(logoutUser.fulfilled, (state) => {
                state.isAuthenticated = false;
                state.userEmail = null;
                state.isGuest = true;
                state.boards = loadBoardsFromLocalStorage();
                state.deletedBoardIds = [];
                state.activeBoardId = 'main';
            })
            .addCase(addBoardAsync.pending, (state, action) => {
                const { id, name, type = 'standard', color, repeatConfig, repeatDuration } = action.meta.arg;
                const safeId = sanitizeId(id);
                const existing = state.boards.find(b => (b.id && String(b.id) === String(safeId)) || (b.name && String(b.name).toLowerCase() === String(name).toLowerCase()));
                if (!existing) {
                    state.boards.push({ id: safeId, name, type, color, repeatConfig, repeatDuration });
                }
                persistBoards(state.boards);
            })
            .addCase(addBoardAsync.fulfilled, (state, action) => {
                if (action.payload?.boards && Array.isArray(action.payload.boards)) {
                    const merged = mergeBoards(state.boards, action.payload.boards, state.deletedBoardIds);
                    state.boards = merged;
                    persistBoards(merged);
                } else if (action.payload && (action.payload.id || action.payload._id || action.payload.name)) {
                    const merged = mergeBoards(state.boards, [action.payload], state.deletedBoardIds);
                    state.boards = merged;
                    persistBoards(merged);
                }
            })
            .addCase(renameBoardAsync.fulfilled, (state, action) => {
                const targetId = action.payload?.id || action.meta?.arg?.id;
                const board = state.boards.find(b => b && (String(b.id) === String(targetId) || String(b._id) === String(targetId)));
                if (board) board.name = action.payload.name;
                persistBoards(state.boards);
            })
            .addCase(updateBoardColorAsync.pending, (state, action) => {
                const { id, color } = action.meta.arg;
                const board = state.boards.find(b => b && (String(b.id) === String(id) || String(b._id) === String(id)));
                if (board) board.color = color;
                persistBoards(state.boards);
            })
            .addCase(updateBoardColorAsync.fulfilled, (state, action) => {
                const boardId = action.payload?.id || action.meta.arg.id;
                const color = action.payload?.color || action.meta.arg.color;
                const board = state.boards.find(b => b && (String(b.id) === String(boardId) || String(b._id) === String(boardId)));
                if (board) board.color = color;
                persistBoards(state.boards);
            })
            .addCase(deleteBoardAsync.pending, (state, action) => {
                removeBoardFromState(state, action.meta?.arg);
            })
            .addCase(deleteBoardAsync.fulfilled, (state, action) => {
                removeBoardFromState(state, action.payload || action.meta?.arg);
            });
    }
});

export const { hydrateUserState, logout, continueAsGuest, updateUserTheme, updateShowWeather, setActiveBoardId, setDashboardFilterType, toggleLayoutVersion, toggleTaskOptionsCollapsed, setTaskOptionsCollapsed, updateBoardRepeatSettings } = userSlice.actions;
export default userSlice.reducer;

