# Features & User Documentation Guide

## 1. Overview of Feature Modules

TaskFlow Redux provides an end-to-end task management environment designed for high productivity, clean organization, and seamless customization.

---

## 2. Core Feature Breakdown

### A. Task Management & Editing (`TaskRow.js` & `TaskDetailsModal.js`)
- **Task Creation**: Quick inline task addition or full creation with title, notes, due date, time, priority, and subtasks.
- **Task Details Modal**: Edit task name, due date, execution time, priority (`High`, `Medium`, `Low`, `None`), reminder alarms, repeat schedules, subtasks, notes, and attachments.
- **Subtask Management**: Add subtasks with progress tracking (`X/Y completed`) and interactive checkbox toggling.
- **Inline Title Editing**: Double-tap / inline title edit option with single-line or multi-line wrap (`numberOfLines={2}`).

### B. Board & Section Organization (`BoardScreen.js`)
- **Categorized View Buckets**: Tasks automatically group into intuitive sections:
  - **Overdue**: Tasks past their completion date.
  - **Today**: Tasks scheduled for the current calendar day.
  - **Tomorrow**: Tasks scheduled for the next calendar day.
  - **Upcoming**: Tasks scheduled for future dates.
  - **Someday**: Tasks without a specified due date.
  - **Completed**: Archived finished tasks (collapsible to save screen space).
- **Multiple Custom Boards**: Create, rename, delete, and switch between separate boards (e.g. Work, Personal, Shopping, Projects).

### C. Gestures & Swipe Actions (`TaskRow.js`)
- **Swipe Left**: Instantly mark task as complete (green action badge).
- **Swipe Right**: Quick options menu:
  - **Snooze**: Postpone task reminder by preset minutes.
  - **Delete**: Remove task with immediate Toast Undo option.
  - **More**: Open quick action menu.

### D. Calendar Integration (`CalendarScreen.js`)
- **Interactive Month Grid**: View scheduled task density across dates.
- **Date Focus & Header Navigation**: Click any date to view tasks due on that day. Header dropdown allows fast year/month selection.

### E. Focus Pomodoro Timer (`PomodoroScreen.js`)
- **Interval Work Sessions**: 25-minute default work timer followed by short/long breaks.
- **Customizable Durations**: Configure work time, break time, auto-start breaks, and audio alarm chimes.

### F. Dynamic Theme & Material Engine (`ThemeContext.js`)
- **Light & Dark Mode**: Harmonious color palettes designed for maximum legibility.
- **Material You Dynamic Accents**: Dynamic color extraction for customized brand colors.
- **Font Scaling & Wrapping**: Customizable font sizes (`Small`, `Normal`, `Big`) and title wrapping mode (`Nowrap` / `2-line wrap`).

### G. Multi-Language Support (`src/i18n/`)
- Full internationalization support for English (`en`), Russian (`ru`), Spanish (`es`), and more.

---

## 3. User Workflows & How-to Guides

### How to Edit a Task
1. Tap on any task row or due date pill to open the **Edit Task Modal** (`TaskDetailsModal`).
2. Update title, date, priority, or notes.
3. Tap **Save Changes**.

### How to Change Task Due Date
1. Open the task in `TaskDetailsModal`.
2. Tap the **Due Date** selector field.
3. Select a date on the interactive calendar modal (the calendar automatically opens focused on the current due date or today).
4. Tap **Save Changes**.

### How to Create a Custom Board
1. Open the **Board** screen tab.
2. Tap the Board selector dropdown at the top header.
3. Select **+ Create New Board**.
4. Enter the board name and tap **Add**.
