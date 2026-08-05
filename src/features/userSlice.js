import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// import axios from 'axios';
import { clearTasks } from './taskSlice';

const loadThemeFromLocalStorage = () => "light";

const loadShowWeatherFromLocalStorage = () => false;

const loadIsGuestFromLocalStorage = () => false;

const loadLayoutVersionFromLocalStorage = () => "v1";

const loadBoardsFromLocalStorage = () => [{ id: 'main', name: 'Main' }];

/* --- VERCEL BACKEND THUNKS (COMMENTED OUT FOR LOCAL-ONLY MODE) ---
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
        return response.data;
    } catch (err) {
        return thunkAPI.rejectWithValue(err.response?.data?.message || err.message);
    }
});

export const registerUser = createAsyncThunk('user/register', async ({ email, password }, thunkAPI) => {
    try {
        const response = await axios.post('/api/auth/register', { email, password }, { withCredentials: true });
        return response.data;
    } catch (err) {
        return thunkAPI.rejectWithValue(err.response?.data?.message || err.message);
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
        thunkAPI.dispatch(clearTasks());
    } catch (err) {
        return thunkAPI.rejectWithValue(err.response?.data?.message || err.message);
    }
});

export const changePassword = createAsyncThunk('user/changePassword', async ({ currentPassword, newPassword }, thunkAPI) => {
    try {
        const response = await axios.post('/api/auth/change-password', { currentPassword, newPassword }, { withCredentials: true });
        return response.data;
    } catch (err) {
        return thunkAPI.rejectWithValue(err.response?.data?.message || err.message);
    }
});

export const addBoardAsync = createAsyncThunk('user/addBoard', async ({ id, name }, thunkAPI) => {
    const state = thunkAPI.getState().userReducer;
    if (state.isAuthenticated) {
        const response = await axios.post('/api/boards', { id, name }, { withCredentials: true });
        return response.data;
    }
    return { id, name };
});

export const renameBoardAsync = createAsyncThunk('user/renameBoard', async ({ id, name }, thunkAPI) => {
    const state = thunkAPI.getState().userReducer;
    if (state.isAuthenticated) {
        const response = await axios.put(`/api/boards/${id}`, { name }, { withCredentials: true });
        return response.data;
    }
    return { id, name };
});

export const deleteBoardAsync = createAsyncThunk('user/deleteBoard', async (id, thunkAPI) => {
    const state = thunkAPI.getState().userReducer;
    if (state.isAuthenticated) {
        await axios.delete(`/api/boards/${id}`, { withCredentials: true });
        return id;
    }
    return id;
});
--- */

export const addBoardAsync = createAsyncThunk('user/addBoard', async ({ id, name }, thunkAPI) => {
    return { id, name };
});

export const renameBoardAsync = createAsyncThunk('user/renameBoard', async ({ id, name }, thunkAPI) => {
    return { id, name };
});

export const deleteBoardAsync = createAsyncThunk('user/deleteBoard', async (id, thunkAPI) => {
    return id;
});

const initialState = {
    isAuthenticated: true, // DEFAULT TO TRUE FOR OFFLINE MODE
    loading: false,
    error: null,
    theme: loadThemeFromLocalStorage(),
    showWeather: loadShowWeatherFromLocalStorage(),
    isGuest: loadIsGuestFromLocalStorage(),
    boards: loadBoardsFromLocalStorage(),
    activeBoardId: 'main',
    layoutVersion: loadLayoutVersionFromLocalStorage(),
};

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        hydrateUserState: (state, action) => {
            return { ...state, ...action.payload };
        },
        logout: (state) => {
            state.isAuthenticated = false;
            state.isGuest = false;
            state.boards = loadBoardsFromLocalStorage();
            state.activeBoardId = 'main';
            AsyncStorage.removeItem('isGuest');
        },
        continueAsGuest: (state) => {
            state.isGuest = true;
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
        toggleLayoutVersion: (state) => {
            state.layoutVersion = state.layoutVersion === 'v1' ? 'v2' : 'v1';
            AsyncStorage.setItem('layoutVersion', state.layoutVersion);
        },
    },
    extraReducers: (builder) => {
        builder
            /* --- VERCEL BACKEND REDUCERS (COMMENTED OUT) ---
            .addCase(checkAuth.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(checkAuth.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = true;
                if (action.payload?.boards) {
                    state.boards = action.payload.boards;
                }
                if (action.payload?.theme) {
                    state.theme = action.payload.theme;
                    AsyncStorage.setItem('theme', action.payload.theme);
                }
            })
            .addCase(checkAuth.rejected, (state) => {
                state.loading = false;
                state.isAuthenticated = false;
            })
            .addCase(loginUser.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = true;
                if (action.payload?.boards) {
                    state.boards = action.payload.boards;
                }
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
                if (action.payload?.boards) {
                    state.boards = action.payload.boards;
                }
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
                state.isGuest = false;
                state.boards = loadBoardsFromLocalStorage();
                state.activeBoardId = 'main';
                AsyncStorage.removeItem('isGuest');
            })
            --- */
            .addCase(addBoardAsync.pending, (state, action) => {
                const { id, name } = action.meta.arg;
                state.boards.push({ id, name });
                AsyncStorage.setItem('boards', JSON.stringify(state.boards));
            })
            .addCase(addBoardAsync.fulfilled, (state, action) => {
                // Already added optimistically
            })
            .addCase(addBoardAsync.rejected, (state, action) => {
                const { id } = action.meta.arg;
                state.boards = state.boards.filter(b => b.id !== id);
                if (state.activeBoardId === id) {
                    state.activeBoardId = 'main';
                }
                AsyncStorage.setItem('boards', JSON.stringify(state.boards));
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

export const { hydrateUserState, logout, continueAsGuest, updateUserTheme, updateShowWeather, setActiveBoardId, toggleLayoutVersion } = userSlice.actions;
export default userSlice.reducer;
