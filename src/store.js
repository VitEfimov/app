import { configureStore } from "@reduxjs/toolkit";

import taskReducer from "./features/taskSlice";
import weatherReducer from "./features/weatherSlice";
import pomodoroReducer from "./features/pomodoroSlice";
import userReducer from "./features/userSlice";
import themeReducer from "./features/themeSlice";

const reducer = {
    taskReducer: taskReducer,
    weatherReducer: weatherReducer,
    pomodoroReducer: pomodoroReducer,
    userReducer: userReducer,
    themeReducer: themeReducer
}

const store = configureStore({
    reducer: reducer,
});

export default store;