const fs = require('fs');
const path = require('path');

const featuresDir = path.join(__dirname, 'features');
const files = fs.readdirSync(featuresDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
    const filePath = path.join(featuresDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Add import
    if (!content.includes('@react-native-async-storage/async-storage')) {
        content = `import AsyncStorage from '@react-native-async-storage/async-storage';\n` + content;
    }

    // Replace setItem and removeItem (these can be fire-and-forget)
    content = content.replace(/localStorage\.setItem/g, 'AsyncStorage.setItem');
    content = content.replace(/localStorage\.removeItem/g, 'AsyncStorage.removeItem');

    // For getItem, we can't easily make synchronous functions asynchronous globally.
    // So we will replace the synchronous initializations with default values, 
    // and we will handle the actual loading in App.js by dispatching an action.
    
    // In userSlice.js
    if (file === 'userSlice.js') {
        content = content.replace(/const loadThemeFromLocalStorage = \(\) => {[\s\S]*?};/, 'const loadThemeFromLocalStorage = () => "light";');
        content = content.replace(/const loadShowWeatherFromLocalStorage = \(\) => {[\s\S]*?};/, 'const loadShowWeatherFromLocalStorage = () => false;');
        content = content.replace(/const loadIsGuestFromLocalStorage = \(\) => {[\s\S]*?};/, 'const loadIsGuestFromLocalStorage = () => false;');
        content = content.replace(/const loadLayoutVersionFromLocalStorage = \(\) => {[\s\S]*?};/, 'const loadLayoutVersionFromLocalStorage = () => "v1";');
        content = content.replace(/const loadBoardsFromLocalStorage = \(\) => {[\s\S]*?};/, "const loadBoardsFromLocalStorage = () => [{ id: 'main', name: 'Main' }];");
        
        // Add hydrate action
        content = content.replace(/reducers: {/, "reducers: {\n        hydrateUserState: (state, action) => {\n            return { ...state, ...action.payload };\n        },");
        content = content.replace(/export const {/, "export const { hydrateUserState,");
    }

    if (file === 'taskSlice.js') {
        content = content.replace(/const loadGuestTasksFromLocalStorage = \(\) => {[\s\S]*?};/, 'const loadGuestTasksFromLocalStorage = () => [];');
        content = content.replace(/reducers: {/, "reducers: {\n        hydrateTaskState: (state, action) => {\n            state.tasks = action.payload;\n        },");
        content = content.replace(/export const {/, "export const { hydrateTaskState,");
    }

    if (file === 'themeSlice.js') {
        content = content.replace(/const loadThemeState = \(\) => {[\s\S]*?};/, 'const loadThemeState = () => undefined;');
        content = content.replace(/reducers: {/, "reducers: {\n    hydrateThemeState: (state, action) => {\n      return { ...state, ...action.payload };\n    },");
        content = content.replace(/export const {/, "export const { hydrateThemeState,");
    }

    if (file === 'pomodoroSlice.js') {
        content = content.replace(/const loadFromLocalStoragePomodoro = \(\) => {[\s\S]*?};/, `const loadFromLocalStoragePomodoro = () => {
  return [{
    time: 50 * 60,
    initialTime: 50 * 60,
    isActive: false,
    isBreak: false,
    breakInterval: 10 * 60,
    intervalCount: { count: 5, progress: 0, passed: 0 },
    workSound: 'default',
    breakSound: 'default',
  }];
};`);
        content = content.replace(/const savedData = JSON\.parse\(localStorage\.getItem\('pomodoro'\)\);/g, 'const savedData = null; // Replaced with AsyncStorage in hydrate');
        content = content.replace(/reducers: {/, "reducers: {\n    hydratePomodoroState: (state, action) => {\n      state.pomodoro = action.payload;\n    },");
        content = content.replace(/export const {/, "export const { hydratePomodoroState,");
    }

    if (file === 'weatherSlice.js') {
        content = content.replace(/const loadFromLocalStorageWeather = \(\) => {[\s\S]*?};/, `const loadFromLocalStorageWeather = () => {
  return [{ city: '', apiKey: '' }];
};`);
        content = content.replace(/reducers: {/, "reducers: {\n    hydrateWeatherState: (state, action) => {\n      state.weather = action.payload;\n    },");
        content = content.replace(/export const {/, "export const { hydrateWeatherState,");
    }

    // Fix remaining JSON.stringify(state) which works fine with AsyncStorage.setItem('key', JSON.stringify(state))
    fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Migration complete');
