# Technical Architecture & System Design Documentation

## 1. System Overview & Technology Stack

TaskFlow Redux is a state-of-the-art, cross-platform Task and Project Management application built using React Native Web and Expo SDK 51.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TaskFlow Redux App                            │
├─────────────────────────────────────────────────────────────────────────┤
│    React Native 0.74.5  │  Expo SDK 51  │  React Native Web 0.19    │
├─────────────────────────────────────────────────────────────────────────┤
│  State: Redux Toolkit   │  List: Shopify FlashList  │  I18n: i18next    │
├─────────────────────────────────────────────────────────────────────────┤
│  Styling: Dynamic HSL Theme Engine  │  Dates: Day.js  │ Axios Remote DB │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Stack Breakdown
- **UI Framework**: React Native `0.74.5`, Expo SDK `51.0.28`, `react-native-web` `0.19.13`.
- **State Architecture**: `@reduxjs/toolkit` `2.12.0`, `react-redux` `9.3.0`.
- **High-Performance Virtualization**: `@shopify/flash-list` `1.6.4`.
- **Navigation Engine**: `@react-navigation/native` `6.1.17`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`.
- **Theme & Color Engine**: `@material/material-color-utilities` (Material You dynamic theme extraction) + HSL Tailored Theme Tokens.
- **Date & Time Operations**: `dayjs` `1.11.21` with localization extensions.
- **Persistence & Offline Sync**: `@react-native-async-storage/async-storage` `1.23.1`, `axios` remote sync.

---

## 2. Component & Navigation Architecture

```
                                 App.js
                                   │
                             ErrorBoundary
                                   │
                            Provider (Redux)
                                   │
                             ThemeProvider
                                   │
                             ToastProvider
                                   │
                            RootWrapper (App)
                                   │
                           SafeAreaProvider
                                   │
                             InitApp Component
                                   │
                           NavigationContainer
                                   │
                         TabNavigator (Bottom Tabs)
      ┌──────────────┬──────────────┼──────────────┬──────────────┬──────────────┐
      │              │              │              │              │              │
DashboardScreen  BoardScreen  CalendarScreen PomodoroScreen SettingsScreen DevLogsScreen
```

### Primary Screens
- **DashboardScreen** (`src/screens/DashboardScreen.js`): High-level overview, productivity analytics, category breakdown, quick creation, urgent tasks summary.
- **BoardScreen** (`src/screens/BoardScreen.js`): Core Kanban & Task List workspace featuring FlashList section virtualization, drag/drop support, date-classified sections, and quick filters.
- **CalendarScreen** (`src/screens/CalendarScreen.js`): Interactive calendar grid displaying scheduled tasks, due date indicators, and single-day task filters.
- **PomodoroScreen** (`src/screens/PomodoroScreen.js`): Built-in focus timer with configurable work/break intervals, session tracking, and audio notifications.
- **SettingsScreen** (`src/screens/SettingsScreen.js`): Theme customization, backup/restore data, PIN security lock, language preferences, notification settings.
- **DevLogsScreen** (`src/screens/DevLogsScreen.js`): Developer diagnostics and notification debug console.

---

## 3. Redux State Management Architecture

State is decoupled into 6 domain-specific Redux Slices:

```
                            Redux Store Root
                                   │
     ┌──────────────┬──────────────┼──────────────┬──────────────┬──────────────┐
     │              │              │              │              │              │
 taskReducer   themeReducer   userReducer  pomodoroReducer statsReducer entitlementReducer
```

### Slice Descriptions
1. **`taskReducer` (`src/features/taskSlice.js`)**: Manages normalized task data (`tasksById` / `tasks`), active board configuration, filter criteria, search queries, and task CRUD actions.
2. **`themeReducer` (`src/features/themeSlice.js`)**: Manages theme mode (`light`/`dark`), source accent color, font size scaling, task title wrap settings (`nowrap`/`wrap`), app PIN lock, and default reminder preferences.
3. **`userReducer` (`src/features/userSlice.js`)**: Handles user authentication, guest mode state, boards list, and user preferences.
4. **`pomodoroReducer` (`src/features/pomodoroSlice.js`)**: Manages focus timer state, cycle durations, auto-start options, and session completion counters.
5. **`statsReducer` (`src/features/statsSlice.js`)**: Tracks task completion history, productivity streaks, and statistics.
6. **`entitlementReducer` (`src/features/entitlementSlice.js`)**: Manages Pro/Premium entitlement state for advanced features (e.g. file attachments, camera upload).

### Performance Selector Principles
To eliminate invalid component re-renders:
- Component selectors derive primitive fields directly (`state.themeReducer?.sourceColor`) rather than whole reducer objects.
- List selection lookup uses memoized `Set` structures (`selectedTaskIdsSet = new Set(...)`) providing $O(1)$ constant-time lookup during cell rendering.

---

## 4. Single-Pass Categorization & Data Pipeline

Task filtering and date classification execute via an optimized single-pass algorithm (`src/utils/filters.js`):

```
                        Input Task Array (N tasks)
                                     │
                        Single-Pass Iteration O(N)
                                     │
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                        ▼
     Overdue Bucket            Today Bucket            Tomorrow Bucket
            │                        │                        │
     Upcoming Bucket          Someday Bucket          Completed Bucket
            │                        │                        │
            └────────────────────────┼────────────────────────┘
                                     │
                     Bucket-Level Sorting O(K log K)
                                     │
                  Flattened FlashList Virtualized Data
```

### Key Performance Benefits
- **$O(N)$ Categorization**: Evaluates `getDateThresholds()` once per render cycle.
- **Deferred Evaluation**: When `completedSectionCollapsed` is `true`, completed task sorting is bypassed completely.
- **FlashList Cell Recycling**: `getItemType={(item) => item.type}` enables direct cell reuse between headers, task rows, and footers.

---

## 5. Offline-First Synchronization Architecture

- **Local Persistence**: All state mutations write immediately to `AsyncStorage` via Redux thunks and local hydration helpers.
- **Remote Synchronization**: Async Axios client syncs changes with the Vercel backend (`https://task-manager-v2-indol.vercel.app`) when network connectivity is available.
- **Share Intent & Background Tasks**: Processes shared content (text, files, dates) via `expo-share-intent` and schedules exact native notifications via `expo-notifications`.
