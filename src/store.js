import { configureStore } from "@reduxjs/toolkit";

import taskReducer from "./features/taskSlice";
import weatherReducer from "./features/weatherSlice";
import pomodoroReducer from "./features/pomodoroSlice";
import userReducer from "./features/userSlice";
import themeReducer, { persistThemeToStorage } from "./features/themeSlice";
import statsReducer from "./features/statsSlice";
import entitlementReducer from "./features/entitlementSlice";

const NON_PERSISTED_THEME_ACTIONS = new Set([
    'theme/hydrateThemeState',
    'theme/setGoogleDrawerOpen',
    'theme/triggerJumpToToday',
    'theme/toggleSettingsOpen',
    'theme/resetTheme',
]);

const themePersistenceMiddleware = (storeApi) => (next) => (action) => {
    const result = next(action);
    if (action?.type?.startsWith('theme/') && !NON_PERSISTED_THEME_ACTIONS.has(action.type)) {
        persistThemeToStorage(storeApi.getState().themeReducer);
    }
    return result;
};

const reducer = {
    taskReducer: taskReducer,
    weatherReducer: weatherReducer,
    pomodoroReducer: pomodoroReducer,
    userReducer: userReducer,
    themeReducer: themeReducer,
    statsReducer: statsReducer,
    entitlementReducer: entitlementReducer
};

const store = configureStore({
    reducer: reducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
            immutableCheck: false,
        }).concat(themePersistenceMiddleware),
});

export default store;