# Comprehensive Test Documentation & Quality Assurance Guide

## 1. Executive Summary & Testing Strategy

TaskFlow Redux utilizes a multi-tiered Quality Assurance architecture designed to ensure zero regressions across cross-platform Mobile (Android/iOS) and Web environments.

```
                    ┌─────────────────────────┐
                    │   Appium / WebdriverIO  │  Mobile Native E2E
                    │   (Native Android APK)  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │     Playwright E2E      │  Cross-Browser Web E2E
                    │    (React Native Web)   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   Redux & Hook Unit     │  Business Logic & State
                    │  (Slices & Filters.js)  │
                    └─────────────────────────┘
```

### Core Testing Objectives
- **Zero-Regression State Management**: Protect Redux slices (`taskSlice`, `themeSlice`, `userSlice`, `pomodoroSlice`) against state corruption.
- **Cross-Platform Parity**: Validate UI rendering, gesture handling, and modal behaviors identically across Web browsers and Android Emulators/Devices.
- **Performance Integrity**: Guarantee FlashList cell recycling, single-pass task categorization, and smooth $60\text{fps}$ rendering without UI thread blocking.

---

## 2. Test Suite Catalog & Coverage Matrix

| Test Suite File | Framework | Scope / Coverage Area | Critical Verification Points |
| :--- | :--- | :--- | :--- |
| `e2e/tasks-crud.spec.js` | Playwright (Web) | Task CRUD Lifecycle | Create task, edit name/notes, change due date, delete task, verify toast undo |
| `e2e/board-management.spec.js` | Playwright (Web) | Board & Section Workflows | Add new board, rename board, drag/move section, switch active board filter |
| `e2e/task-date-movement.spec.js` | Playwright (Web) | Date Bucketing & Filtering | Move task between Overdue, Today, Tomorrow, Upcoming, and Someday sections |
| `e2e/task-quick-actions.spec.js` | Playwright (Web) | Swipe & Quick Actions | Complete task checkbox toggle, snooze modal, quick menu modal trigger |
| `e2e/navigation-calendar.spec.js` | Playwright (Web) | Tab & Calendar Navigation | Navigate between Dashboard, Board, Calendar, Pomodoro, and Settings tabs |
| `e2e/theme-i18n.spec.js` | Playwright (Web) | Dynamic Theme & i18n | Toggle light/dark mode, switch language (EN, RU, ES), verify dynamic color tokens |
| `task/appium/specs/smoke.spec.js` | WebdriverIO (Mobile) | Native Smoke Suite | Cold app launch, initial screen mount, guest mode authorization check |
| `task/appium/specs/task.spec.js` | WebdriverIO (Mobile) | Native Task Operations | Touch interactions, checkbox toggle on Android native layout |
| `task/appium/specs/calendar.spec.js` | WebdriverIO (Mobile) | Native Date Picker & Calendar | Date selection modal, year picker overlay, day selection grid |
| `task/appium/specs/attachments.spec.js` | WebdriverIO (Mobile) | Native File & Camera | Photo & document picker flow, attachment preview modal, Pro tier restriction |
| `task/appium/specs/pomodoro.spec.js` | WebdriverIO (Mobile) | Focus Timer | Timer start, pause, reset, settings modal configuration |
| `task/appium/specs/settings.spec.js` | WebdriverIO (Mobile) | App Settings & Storage | Export/import data, app PIN lock, theme color picker |

---

## 3. Web E2E Testing with Playwright

Playwright tests the production web bundle rendered via `@expo/metro-runtime` and `react-native-web`.

### Prerequisites & Setup
Ensure dependencies are installed:
```bash
npm install
npx playwright install
```

### Execution Commands

```bash
# Run all Playwright E2E tests headlessly
npm run test:playwright

# Run tests with interactive Playwright UI mode
npx playwright test --ui

# Run a specific test file with browser visible (headed mode)
npx playwright test e2e/tasks-crud.spec.js --headed

# Debug a test step-by-step
npx playwright test e2e/board-management.spec.js --debug
```

### Playwright Configuration Overview (`playwright.config.js`)
- **Base URL**: `http://localhost:8081` (or live Vercel web URL)
- **Viewport**: $1280 \times 720$ (Desktop) and $390 \times 844$ (Mobile Web Viewport)
- **Artifacts**: Automatic screenshots on failure saved to `playwright-report/` and `test-results/`.

---

## 4. Native Mobile E2E Testing with Appium & WebdriverIO

Appium tests interact with the native compiled Android APK output (`app-debug.apk`) executing on an Android Emulator or connected physical device via `UiAutomator2`.

### Prerequisites
- Android Studio with Android SDK & Emulator installed (`API 30+`)
- Appium Server v2+ with `UiAutomator2` driver installed:
  ```bash
  npm install -g appium
  appium driver install uiautomator2
  ```

### Appium Execution Command
```bash
# Start native Android E2E test suite
npm run test:e2e
```

### Element Locator Strategy (`testID` & Accessibility IDs)
All interactive components (`TaskRow`, `TaskDetailsModal`, `Header`, buttons) declare explicit `testID` props:

```jsx
// Component implementation
<TouchableOpacity testID="task_checkbox" accessibilityLabel="Toggle task completion">
  <IconCircle color={colors.textSecondary} />
</TouchableOpacity>
```

```javascript
// WebdriverIO spec locator
const checkbox = await $('~task_checkbox');
await checkbox.waitForDisplayed({ timeout: 5000 });
await checkbox.click();
```

---

## 5. Unit & Utility Testing Guidelines

### Testing Logic Modules (`src/utils/filters.js`)
Utility pipelines must be tested for edge-case handling:
- **Date Categorization (`classifyTaskDate`)**: Validates past dates as `'overdue'`, today as `'today'`, tomorrow as `'tomorrow'`, future dates as `'upcoming'`, and null/unset dates as `'someday'`.
- **Sorting Logic (`compareTasks`)**: Verifies priority sorting (`High > Medium > Low > None`), due date ascending order, and completion status placement.

### Testing Redux Toolkit Slices (`src/features/taskSlice.js`)
Unit tests must verify immutability and payload execution:
- `addTask`: Appends new task with generated ID and default attributes.
- `updateTask`: Performs atomic mutations without breaking array references.
- `deleteTask`: Removes target task and maintains recurring series integrity.
- `addMultipleTasks`: Processes shared intent batch inputs correctly.

---

## 6. QA Checklist Before Release

Before building production bundles or submitting APKs:
- [ ] Run `node -c` syntax check on all core JavaScript components.
- [ ] Run `npm run test:playwright` — all web E2E scenarios must pass cleanly ($100\%$).
- [ ] Validate light mode and dark mode visual tokens across all screens.
- [ ] Verify that opening `TaskDetailsModal` populates valid task information (no empty fields).
- [ ] Verify due date calendar picker opens focused on the current task's due date (or today).
- [ ] Verify FlashList scrolling performance without frame drop or memory leakage.
