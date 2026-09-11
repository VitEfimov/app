import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const loadThemeFromLocalStorage = () => "light";
const loadShowWeatherFromLocalStorage = () => false;
const loadIsGuestFromLocalStorage = () => false;
const loadLayoutVersionFromLocalStorage = () => "v1";
const loadBoardsFromLocalStorage = () => [{ id: 'main', name: 'Main', type: 'standard' }];

export const checkAuth = createAsyncThunk('user/checkAuth', async (_, thunkAPI) => {
    try {
        const response = await axios.get('/api/auth/me', { withCredentials: true });
        return response.data;
    } catch (err) {
        return thunkAPI.rejectWithValue(err.response?.data?.message || err.message);
    }
});

export const loginUser = createAsyncThunk('user/login', async ({ email, password, rememberMe }, thunkAPI) => {
    try {
        const response = await axios.post('/api/auth/login', { email, password, rememberMe }, { withCredentials: true });
        if (rememberMe) {
            await AsyncStorage.setItem('rememberedUser', JSON.stringify({ email, rememberMe: true }));
        } else {
            await AsyncStorage.removeItem('rememberedUser');
        }
        return response.data;
    } catch (err) {
        const msg = err.response?.data?.message || (err.message === 'Network Error' ? 'Network / CORS Error: Cross-origin requests from localhost are blocked by backend CORS policy.' : err.message);
        return thunkAPI.rejectWithValue(msg);
    }
});

export const registerUser = createAsyncThunk('user/register', async ({ email, password }, thunkAPI) => {
    try {
        const response = await axios.post('/api/auth/register', { email, password }, { withCredentials: true });
        return response.data;
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

export const addBoardAsync = createAsyncThunk('user/addBoard', async ({ id, name, type = 'standard', color }, thunkAPI) => {
    const state = thunkAPI.getState().userReducer;
    if (state.isAuthenticated) {
        try {
            const response = await axios.post('/api/boards', { id, name, type, color }, { withCredentials: true });
            return response.data;
        } catch (e) {
            // Optimistic fallback
        }
    }
    return { id, name, type, color };
});

export const renameBoardAsync = createAsyncThunk('user/renameBoard', async ({ id, name }, thunkAPI) => {
    const state = thunkAPI.getState().userReducer;
    if (state.isAuthenticated) {
        try {
            const response = await axios.put(`/api/boards/${id}`, { name }, { withCredentials: true });
            return response.data;
        } catch (e) {
            // Optimistic fallback
        }
    }
    return { id, name };
});

export const deleteBoardAsync = createAsyncThunk('user/deleteBoard', async (id, thunkAPI) => {
    const state = thunkAPI.getState().userReducer;
    if (state.isAuthenticated) {
        try {
            await axios.delete(`/api/boards/${id}`, { withCredentials: true });
        } catch (e) {
            // Optimistic fallback
        }
    }
    return id;
});

const mergeBoards = (currentBoards = [], incomingBoards = []) => {
    const boardMap = new Map();
    (currentBoards || []).forEach(b => {
        if (b && (b.id || b.name)) {
            const key = b.id || b.name;
            boardMap.set(key, b);
        }
    });
    (incomingBoards || []).forEach(b => {
        if (b && (b.id || b.name)) {
            const key = b.id || b.name;
            const existing = boardMap.get(key) || boardMap.get(b.id);
            boardMap.set(b.id || key, { ...(existing || {}), ...b });
        }
    });
    return Array.from(boardMap.values());
};

const syncUnsyncedBoards = async (mergedBoards = [], remoteBoards = []) => {
    const remoteIds = new Set((remoteBoards || []).map(b => b.id || b._id));
    const remoteNames = new Set((remoteBoards || []).map(b => b.name));
    for (const b of mergedBoards) {
        if (b && (b.id || b.name) && !remoteIds.has(b.id) && !remoteNames.has(b.name)) {
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
    activeBoardId: 'main',
    dashboardFilterType: 'all',
    layoutVersion: loadLayoutVersionFromLocalStorage(),
};

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        hydrateUserState: (state, action) => {
            const newState = { ...state, ...action.payload };
            if (action.payload && action.payload.boards && Array.isArray(action.payload.boards)) {
                newState.boards = mergeBoards(state.boards, action.payload.boards);
            }
            return newState;
        },
        logout: (state) => {
            state.isAuthenticated = false;
            state.userEmail = null;
            state.isGuest = false;
            state.boards = loadBoardsFromLocalStorage();
            state.activeBoardId = 'main';
            state.dashboardFilterType = 'all';
            AsyncStorage.removeItem('isGuest');
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
                const merged = mergeBoards(state.boards, remoteBoards);
                state.boards = merged;
                AsyncStorage.setItem('boards', JSON.stringify(merged));
                syncUnsyncedBoards(merged, remoteBoards);
                if (action.payload?.theme) {
                    state.theme = action.payload.theme;
                    AsyncStorage.setItem('theme', action.payload.theme);
                }
            })
            .addCase(checkAuth.rejected, (state) => {
                state.loading = false;
                // If not guest, stay unauthenticated
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
                const merged = mergeBoards(state.boards, remoteBoards);
                state.boards = merged;
                AsyncStorage.setItem('boards', JSON.stringify(merged));
                syncUnsyncedBoards(merged, remoteBoards);
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
                const merged = mergeBoards(state.boards, remoteBoards);
                state.boards = merged;
                AsyncStorage.setItem('boards', JSON.stringify(merged));
                syncUnsyncedBoards(merged, remoteBoards);
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
                state.isGuest = false;
                state.boards = loadBoardsFromLocalStorage();
                state.activeBoardId = 'main';
            })
            .addCase(addBoardAsync.pending, (state, action) => {
                const { id, name, type = 'standard', color } = action.meta.arg;
                if (!state.boards.find(b => b.id === id)) {
                    state.boards.push({ id, name, type, color });
                }
                AsyncStorage.setItem('boards', JSON.stringify(state.boards));
            })
            .addCase(addBoardAsync.fulfilled, (state, action) => {
                if (action.payload?.boards && Array.isArray(action.payload.boards)) {
                    const merged = mergeBoards(state.boards, action.payload.boards);
                    state.boards = merged;
                    AsyncStorage.setItem('boards', JSON.stringify(merged));
                } else if (action.payload && action.payload.id) {
                    const merged = mergeBoards(state.boards, [action.payload]);
                    state.boards = merged;
                    AsyncStorage.setItem('boards', JSON.stringify(merged));
                }
            })
            .addCase(renameBoardAsync.fulfilled, (state, action) => {
                const board = state.boards.find(b => b.id === action.payload.id);
                if (board) board.name = action.payload.name;
                AsyncStorage.setItem('boards', JSON.stringify(state.boards));
            })
            .addCase(deleteBoardAsync.fulfilled, (state, action) => {
                state.boards = state.boards.filter(b => b.id !== action.payload);
                if (state.activeBoardId === action.payload) {
                    state.activeBoardId = 'main';
                }
                AsyncStorage.setItem('boards', JSON.stringify(state.boards));
            });
    }
});

export const { hydrateUserState, logout, continueAsGuest, updateUserTheme, updateShowWeather, setActiveBoardId, setDashboardFilterType, toggleLayoutVersion } = userSlice.actions;
export default userSlice.reducer;

