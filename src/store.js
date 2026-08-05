import { configureStore } from "@reduxjs/toolkit";

import taskReducer from "./features/taskSlice";
import weatherReducer from "./features/weatherSlice";
import pomodoroReducer from "./features/pomodoroSlice";
import userReducer from "./features/userSlice";
import themeReducer from "./features/themeSlice";
import statsReducer from "./features/statsSlice";
import entitlementReducer from "./features/entitlementSlice";

const reducer = {
    taskReducer: taskReducer,
    weatherReducer: weatherReducer,
    pomodoroReducer: pomodoroReducer,
    userReducer: userReducer,
    themeReducer: themeReducer,
    statsReducer: statsReducer,
    entitlementReducer: entitlementReducer
}

const store = configureStore({
    reducer: reducer,
});

export default store;