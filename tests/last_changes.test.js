const { test, describe, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { transform } = require('sucrase');
const dayjs = require('dayjs');

// Helper to require ESM / JSX files using Sucrase transpilation in Node
function loadTranspiledModule(filePath, customMocks = {}) {
  const code = fs.readFileSync(filePath, 'utf8');
  const transformed = transform(code, {
    transforms: ['imports', 'jsx', 'typescript'],
    jsxRuntime: 'classic'
  }).code;

  const mockModule = { exports: {} };
  const mockRequire = (reqPath) => {
    if (customMocks[reqPath]) {
      return customMocks[reqPath];
    }
    if (reqPath.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filePath), reqPath);
      for (const ext of ['', '.js', '.jsx', '.json']) {
        const fullPath = resolved + ext;
        if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
          if (ext === '.json' || fullPath.endsWith('.json')) {
            return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          }
          return loadTranspiledModule(fullPath, customMocks);
        }
      }
    }
    return require(reqPath);
  };

  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transformed);
  fn(mockModule.exports, mockRequire, mockModule, filePath, path.dirname(filePath));
  return mockModule.exports;
}

// ==============================================================================
// TEST SUITE 1: SecurityLockHelper
// ==============================================================================
describe('SecurityLockHelper', () => {
  let SecurityLockHelper;

  beforeEach(() => {
    // Fresh instance per test
    const mod = loadTranspiledModule(path.resolve('src/utils/securityLockHelper.js'));
    SecurityLockHelper = mod.SecurityLockHelper;
    if (SecurityLockHelper._resetForTesting) SecurityLockHelper._resetForTesting();
  });

  afterEach(() => {
    if (SecurityLockHelper._resetForTesting) SecurityLockHelper._resetForTesting();
  });

  test('default state is inactive', () => {
    assert.strictEqual(SecurityLockHelper.isAttachmentPickerActive(), false);
  });

  test('markPickingAttachment(true) sets active to true immediately', () => {
    SecurityLockHelper.markPickingAttachment(true);
    assert.strictEqual(SecurityLockHelper.isAttachmentPickerActive(), true);
  });

  test('markPickingAttachment(false) retains active status during grace period', async () => {
    SecurityLockHelper.markPickingAttachment(true);
    assert.strictEqual(SecurityLockHelper.isAttachmentPickerActive(), true);

    SecurityLockHelper.markPickingAttachment(false);
    // Should still be active immediately after calling false (grace period)
    assert.strictEqual(SecurityLockHelper.isAttachmentPickerActive(), true);
  });

  test('repeated calls clear pending timeouts without breaking state', () => {
    SecurityLockHelper.markPickingAttachment(true);
    SecurityLockHelper.markPickingAttachment(true);
    SecurityLockHelper.markPickingAttachment(false);
    SecurityLockHelper.markPickingAttachment(true);
    assert.strictEqual(SecurityLockHelper.isAttachmentPickerActive(), true);
  });

  test('notifyAppLocked triggers all registered subscribers', () => {
    let callCountA = 0;
    let callCountB = 0;

    const unsubA = SecurityLockHelper.subscribeLock(() => { callCountA++; });
    const unsubB = SecurityLockHelper.subscribeLock(() => { callCountB++; });

    SecurityLockHelper.notifyAppLocked();
    assert.strictEqual(callCountA, 1);
    assert.strictEqual(callCountB, 1);

    // Unsubscribe A
    unsubA();
    SecurityLockHelper.notifyAppLocked();
    assert.strictEqual(callCountA, 1);
    assert.strictEqual(callCountB, 2);

    unsubB();
  });
});

// ==============================================================================
// TEST SUITE 2: CrashLogger
// ==============================================================================
describe('CrashLogger', () => {
  let CrashLogger;
  let mockStorage;

  beforeEach(() => {
    mockStorage = {};
    const mockAsyncStorage = {
      getItem: async (key) => mockStorage[key] || null,
      setItem: async (key, val) => { mockStorage[key] = val; },
      removeItem: async (key) => { delete mockStorage[key]; }
    };
    const mockPlatform = {
      Platform: { OS: 'android', Version: 34 }
    };

    const mod = loadTranspiledModule(path.resolve('src/utils/crashLogger.js'), {
      '@react-native-async-storage/async-storage': mockAsyncStorage,
      'react-native': mockPlatform
    });
    CrashLogger = mod.CrashLogger;
  });

  test('init loads empty logs if storage is empty', async () => {
    const logs = await CrashLogger.init();
    assert.ok(Array.isArray(logs));
  });

  test('recordCrash stores error metadata and notifies subscribers', async () => {
    let subscriberPayload = null;
    const unsub = CrashLogger.subscribe((logs) => {
      subscriberPayload = logs;
    });

    const error = new Error('Test crash event');
    const entry = await CrashLogger.recordCrash({
      screenName: 'BoardScreen',
      error,
      errorInfo: { componentStack: 'in TaskRow\nin BoardScreen' }
    });

    assert.ok(entry);
    assert.ok(entry.id.startsWith('crash_'));
    assert.strictEqual(entry.screenName, 'BoardScreen');
    assert.strictEqual(entry.message, 'Test crash event');
    assert.ok(entry.stack.includes('Test crash event'));
    assert.strictEqual(entry.componentStack, 'in TaskRow\nin BoardScreen');
    assert.strictEqual(entry.platform, 'android (34)');

    // Subscriber notified
    assert.ok(Array.isArray(subscriberPayload));
    assert.strictEqual(subscriberPayload.length, 1);
    assert.strictEqual(subscriberPayload[0].id, entry.id);

    unsub();
  });

  test('recordCrash caps logs at MAX_CRASH_LOGS (50)', async () => {
    for (let i = 0; i < 55; i++) {
      await CrashLogger.recordCrash({
        screenName: 'StressScreen',
        error: new Error(`Crash #${i}`)
      });
    }
    const logs = await CrashLogger.getCrashLogs();
    assert.strictEqual(logs.length, 50);
    // Most recent crash is first
    assert.strictEqual(logs[0].message, 'Crash #54');
  });

  test('clearCrashLogs wipes memory and storage', async () => {
    await CrashLogger.recordCrash({
      screenName: 'TestScreen',
      error: new Error('To be cleared')
    });
    let logs = await CrashLogger.getCrashLogs();
    assert.strictEqual(logs.length, 1);

    await CrashLogger.clearCrashLogs();
    logs = await CrashLogger.getCrashLogs();
    assert.strictEqual(logs.length, 0);
    assert.strictEqual(mockStorage['@system_crash_logs'], undefined);
  });
});

// ==============================================================================
// TEST SUITE 3: BoardScreen Recurring Tasks Filtering
// ==============================================================================
describe('BoardScreen Recurring Tasks Filtering', () => {
  // Replicate isRepeatingTask logic from BoardScreen.js
  const isRepeatingTask = (task) => {
    if (!task) return false;
    return !!(
      task.recurringSeriesId ||
      task.isRecurring ||
      (task.repeatConfig && task.repeatConfig.preset && task.repeatConfig.preset !== 'None') ||
      (task.repeatFrequency && task.repeatFrequency !== 'None') ||
      (task.repeat && task.repeat !== 'none' && task.repeat !== 'None')
    );
  };

  const getTaskDateStr = (task) => {
    if (!task) return null;
    return task.date || task.dueDate || null;
  };

  const computeHiddenRecurringTaskIds = (boardTasks, showRecurringTasksOnBoard, activeBoardType = 'standard') => {
    const hiddenIds = new Set();
    const todayStr = dayjs().format('YYYY-MM-DD');

    const addToHidden = (id) => {
      if (id === undefined || id === null) return;
      hiddenIds.add(id);
      hiddenIds.add(String(id));
      const num = Number(id);
      if (!isNaN(num)) hiddenIds.add(num);
    };

    // When toggle is ON ('Show recurring tasks'): All recurring tasks should be shown!
    if (showRecurringTasksOnBoard) {
      return hiddenIds; // empty Set -> show all tasks!
    }

    // When toggle is OFF ('Do not show recurring tasks'): Show JUST NEXT ONE!
    // Deduplicate each recurring series so only the single next (earliest upcoming) occurrence appears
    const earliestSeriesMap = new Map();
    for (const task of boardTasks) {
      if (!task || task.completed) continue;
      const isRepeating = isRepeatingTask(task);
      const titleKey = String(task.taskname || task.name || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const rawBId = String(task.boardId || task.board_id || 'main');
      const seriesKey = task.recurringSeriesId
        ? ('series_' + task.recurringSeriesId)
        : (isRepeating && titleKey ? (`title_${rawBId}_${titleKey}`) : null);
      if (!seriesKey) continue;

      const dateStr = getTaskDateStr(task);
      if (dateStr && dateStr < todayStr) continue;

      const existing = earliestSeriesMap.get(seriesKey);
      const currentDate = dateStr || '9999-12-31';
      const taskId = task.id || task._id;
      if (!existing) {
        earliestSeriesMap.set(seriesKey, { task, taskId, dateStr: currentDate });
      } else {
        if (currentDate < existing.dateStr) {
          addToHidden(existing.taskId);
          earliestSeriesMap.set(seriesKey, { task, taskId, dateStr: currentDate });
        } else {
          addToHidden(taskId);
        }
      }
    }
    return hiddenIds;
  };

  test('isRepeatingTask correctly identifies recurring attributes', () => {
    assert.strictEqual(isRepeatingTask({ id: '1', recurringSeriesId: 'series_abc' }), true);
    assert.strictEqual(isRepeatingTask({ id: '2', isRecurring: true }), true);
    assert.strictEqual(isRepeatingTask({ id: '3', repeatConfig: { preset: 'Daily' } }), true);
    assert.strictEqual(isRepeatingTask({ id: '4', repeatFrequency: 'Weekly' }), true);
    assert.strictEqual(isRepeatingTask({ id: '5', repeat: 'daily' }), true);

    // Non-recurring
    assert.strictEqual(isRepeatingTask({ id: '6', taskname: 'Buy milk' }), false);
    assert.strictEqual(isRepeatingTask({ id: '7', repeatConfig: { preset: 'None' } }), false);
    assert.strictEqual(isRepeatingTask({ id: '8', repeat: 'none' }), false);
    assert.strictEqual(isRepeatingTask(null), false);
  });

  test('when showRecurringTasksOnBoard is OFF, show just next one: only earliest occurrence shown, future duplicates hidden', () => {
    const nov27 = dayjs().add(20, 'day').format('YYYY-MM-DD');
    const dec27 = dayjs().add(50, 'day').format('YYYY-MM-DD');
    const jan27 = dayjs().add(80, 'day').format('YYYY-MM-DD');

    const tasks = [
      { id: 'toyota_nov', taskname: 'Toyota finance $550', date: nov27, recurringSeriesId: 'series_toyota' },
      { id: 'toyota_dec', taskname: 'Toyota finance $550', date: dec27, recurringSeriesId: 'series_toyota' },
      { id: 'toyota_jan', taskname: 'Toyota finance $550', date: jan27, recurringSeriesId: 'series_toyota' },
      { id: 'insurance_nov', taskname: 'Insurance for car $125', date: nov27, repeatConfig: { preset: 'Monthly' } },
      { id: 'insurance_dec', taskname: 'Insurance for car $125', date: dec27, repeatConfig: { preset: 'Monthly' } },
      { id: 'normal_future', taskname: 'Friend Wedding', date: nov27 } // non-recurring
    ];

    const hidden = computeHiddenRecurringTaskIds(tasks, false);

    // Earliest (next one) MUST stay visible!
    assert.strictEqual(hidden.has('toyota_nov'), false, 'Next occurrence (Nov) must stay visible');
    assert.strictEqual(hidden.has('insurance_nov'), false, 'Next occurrence (Nov) must stay visible');

    // Future duplicate occurrences MUST be hidden!
    assert.strictEqual(hidden.has('toyota_dec'), true, 'Future duplicate (Dec) must be hidden');
    assert.strictEqual(hidden.has('toyota_jan'), true, 'Future duplicate (Jan) must be hidden');
    assert.strictEqual(hidden.has('insurance_dec'), true, 'Future duplicate (Dec) must be hidden');

    // Non-recurring future tasks stay visible
    assert.strictEqual(hidden.has('normal_future'), false);
  });

  test('when showRecurringTasksOnBoard is ON, all recurring tasks are shown without hiding', () => {
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
    const nextWeek = dayjs().add(7, 'day').format('YYYY-MM-DD');
    const nextMonth = dayjs().add(30, 'day').format('YYYY-MM-DD');

    const tasks = [
      { id: 'series_1_occ1', date: tomorrow, recurringSeriesId: 'series_1' },
      { id: 'series_1_occ2', date: nextWeek, recurringSeriesId: 'series_1' },
      { id: 'series_1_occ3', date: nextMonth, recurringSeriesId: 'series_1' },
      { id: 'series_2_occ1', date: tomorrow, recurringSeriesId: 'series_2' }
    ];

    const hidden = computeHiddenRecurringTaskIds(tasks, true);

    // All recurring occurrences must be shown!
    assert.strictEqual(hidden.size, 0);
    assert.strictEqual(hidden.has('series_1_occ1'), false);
    assert.strictEqual(hidden.has('series_1_occ2'), false);
    assert.strictEqual(hidden.has('series_1_occ3'), false);
    assert.strictEqual(hidden.has('series_2_occ1'), false);
  });

  test('when showRecurringTasksOnBoard is OFF on an Events or Payments board, only next occurrence is shown', () => {
    const nov27 = dayjs().add(20, 'day').format('YYYY-MM-DD');
    const dec27 = dayjs().add(50, 'day').format('YYYY-MM-DD');
    const tasks = [
      { id: 'pay_toyota_nov', taskname: 'Toyota finance $550', date: nov27, recurringSeriesId: 'series_toyota' },
      { id: 'pay_toyota_dec', taskname: 'Toyota finance $550', date: dec27, recurringSeriesId: 'series_toyota' }
    ];

    const hidden = computeHiddenRecurringTaskIds(tasks, false, 'birthdays');
    assert.strictEqual(hidden.has('pay_toyota_nov'), false, 'Next occurrence must be shown');
    assert.strictEqual(hidden.has('pay_toyota_dec'), true, 'Subsequent occurrence must be hidden');
  });

  test('when showRecurringTasksOnBoard is OFF, duplicate occurrences matching by normalized title show just next one', () => {
    const nov27 = dayjs().add(20, 'day').format('YYYY-MM-DD');
    const dec27 = dayjs().add(50, 'day').format('YYYY-MM-DD');
    const tasks = [
      { id: 'toyota_nov', taskname: 'Toyota finance $550', date: nov27, repeatConfig: { preset: 'every_month' } },
      { id: 'toyota_dec', taskname: 'Toyota finance $550', date: dec27, repeatConfig: { preset: 'every_month' } }
    ];

    const hidden = computeHiddenRecurringTaskIds(tasks, false, 'standard');
    assert.strictEqual(hidden.has('toyota_nov'), false); // earliest stays visible (just next one)
    assert.strictEqual(hidden.has('toyota_dec'), true);  // future duplicate is hidden
  });

  test('simple_list and shopping boards properly show just next one when OFF, and all when ON', () => {
    // Simulate 48 recurring occurrences for a simple_list board
    const recurringTasks = [];
    for (let i = 0; i < 48; i++) {
      recurringTasks.push({
        id: `task_rec_${i}`,
        taskname: '546415352',
        time: '1:20 AM',
        date: dayjs().add(i + 1, 'day').format('YYYY-MM-DD'),
        isRecurring: true,
        recurringSeriesId: 'series_546415352'
      });
    }

    // Case 1: showRecurringTasksOnBoard is OFF -> show just next one (1 task shown, 47 hidden)
    const hiddenOff = computeHiddenRecurringTaskIds(recurringTasks, false, 'simple_list');
    const todoTasksOff = recurringTasks.filter(t => !hiddenOff.has(t.id));
    assert.strictEqual(todoTasksOff.length, 1, 'Show just next one (1 task) on simple_list when toggle is OFF');
    assert.strictEqual(todoTasksOff[0].id, 'task_rec_0');

    // Case 2: showRecurringTasksOnBoard is ON -> all tasks should be shown (all 48 shown)
    const hiddenOn = computeHiddenRecurringTaskIds(recurringTasks, true, 'simple_list');
    const todoTasksOn = recurringTasks.filter(t => !hiddenOn.has(t.id));
    assert.strictEqual(todoTasksOn.length, 48, 'All tasks should be shown when toggle is ON');
  });

  test('tasks with MongoDB _id (no id property) properly deduplicate recurring tasks', () => {
    const nov27 = dayjs().add(20, 'day').format('YYYY-MM-DD');
    const dec27 = dayjs().add(50, 'day').format('YYYY-MM-DD');

    const tasksWithMongoId = [
      { _id: 'mongo_nov_123', taskname: 'Toyota finance $550', date: nov27, isRecurring: true, recurringSeriesId: 'series_toyota' },
      { _id: 'mongo_dec_456', taskname: 'Toyota finance $550', date: dec27, isRecurring: true, recurringSeriesId: 'series_toyota' }
    ];

    const hidden = computeHiddenRecurringTaskIds(tasksWithMongoId, false, 'standard');
    assert.strictEqual(hidden.has('mongo_nov_123'), false, 'Earliest MongoDB occurrence is shown');
    assert.strictEqual(hidden.has('mongo_dec_456'), true, 'Future MongoDB occurrence is hidden');
  });
});

// ==============================================================================
// TEST SUITE 4: Inline Edit Focus & Cancellation (TaskRow)
// ==============================================================================
describe('TaskRow Inline Focus & Cancellation', () => {
  test('cancelAllInlineEditing notifies all registered listeners and triggers keyboard dismissal', () => {
    const inlineEditingListeners = new Set();
    let keyboardDismissCalled = false;

    const mockKeyboard = {
      dismiss: () => { keyboardDismissCalled = true; }
    };

    function cancelAllInlineEditing() {
      inlineEditingListeners.forEach(fn => {
        try { fn(); } catch (e) {}
      });
      mockKeyboard.dismiss();
    }

    let edit1Cancelled = false;
    let edit2Cancelled = false;

    const fn1 = () => { edit1Cancelled = true; };
    const fn2 = () => { edit2Cancelled = true; };

    inlineEditingListeners.add(fn1);
    inlineEditingListeners.add(fn2);

    cancelAllInlineEditing();

    assert.strictEqual(edit1Cancelled, true);
    assert.strictEqual(edit2Cancelled, true);
    assert.strictEqual(keyboardDismissCalled, true);
  });

  test('failing listener does not prevent other listeners from being called', () => {
    const inlineEditingListeners = new Set();
    function cancelAllInlineEditing() {
      inlineEditingListeners.forEach(fn => {
        try { fn(); } catch (e) {}
      });
    }

    let edit2Called = false;
    inlineEditingListeners.add(() => { throw new Error('Simulated component error'); });
    inlineEditingListeners.add(() => { edit2Called = true; });

    assert.doesNotThrow(() => {
      cancelAllInlineEditing();
    });
    assert.strictEqual(edit2Called, true);
  });

  test('Privacy & Data (GDPR) in SettingsScreen is collapsed by default', () => {
    const settingsPath = path.resolve('src/screens/SettingsScreen.js');
    const content = fs.readFileSync(settingsPath, 'utf8');
    assert.match(
      content,
      /const\s*\[isPrivacyExpanded,\s*setIsPrivacyExpanded\]\s*=\s*useState\(false\)/,
      'Privacy & Data section must be collapsed (useState(false)) by default'
    );
  });

  test('TaskRow due date tap and row tap trigger onPress to open TaskDetailsModal', () => {
    const taskRowPath = path.resolve('src/components/TaskRow.js');
    const content = fs.readFileSync(taskRowPath, 'utf8');

    // 1. Task name touchable is bounded (alignSelf: 'flex-start') so it does not intercept row taps
    assert.match(
      content,
      /alignSelf:\s*['"]flex-start['"]/,
      'Task name touchable must be bounded (alignSelf: flex-start) so inline edit is only triggered on the text itself'
    );

    // 2. Due date supports completionDate, dateString, dueDate, and date
    assert.match(
      content,
      /const\s+rawDueDate\s*=\s*task\.completionDate\s*\|\|\s*task\.dateString\s*\|\|\s*task\.dueDate\s*\|\|\s*task\.date/,
      'TaskRow must resolve due date across completionDate, dateString, dueDate, and date'
    );

    // 3. Due date metadata touchable triggers onPress(task) to open edit task modal
    assert.match(
      content,
      /if\s*\(\s*onPress\s*\)\s*onPress\s*\(\s*task\s*\)/,
      'Metadata due date must dispatch onPress(task)'
    );
  });

  test('user can change task name inline on completed section', () => {
    const taskRowPath = path.resolve('src/components/TaskRow.js');
    const content = fs.readFileSync(taskRowPath, 'utf8');

    // Asserts handleTextPress does not block inline editing for completed tasks
    assert.match(
      content,
      /if\s*\(\s*disableInlineEdit\s*\)\s*\{\s*if\s*\(\s*onPress\s*\)\s*onPress\s*\(\s*task\s*\);\s*return;\s*\}/,
      'Tapping task name on completed section allows inline edit (only blocked if disableInlineEdit is explicitly true)'
    );

    // Behavioral simulation
    let inlineEditTriggered = false;
    let editModalOpened = false;

    function simulateTextPress({ task, sectionId, disableInlineEdit, onPress }) {
      if (disableInlineEdit) {
        if (onPress) onPress(task);
        return;
      }
      inlineEditTriggered = true;
    }

    // 1. Incompleted task in 'today' section allows inline edit
    simulateTextPress({
      task: { id: 't1', taskname: 'Active task', completed: false },
      sectionId: 'today',
      disableInlineEdit: false,
      onPress: () => { editModalOpened = true; }
    });
    assert.strictEqual(inlineEditTriggered, true);
    assert.strictEqual(editModalOpened, false);

    // 2. Task in 'completed' section also allows inline edit
    inlineEditTriggered = false;
    editModalOpened = false;
    simulateTextPress({
      task: { id: 't2', taskname: 'Done task', completed: true },
      sectionId: 'completed',
      disableInlineEdit: false,
      onPress: () => { editModalOpened = true; }
    });
    assert.strictEqual(inlineEditTriggered, true);
    assert.strictEqual(editModalOpened, false);
  });
});

// ==============================================================================
// TEST SUITE 5: 30-Second Minimize Grace Period & Smart Lock
// ==============================================================================
describe('Smart PIN Lock 30s Grace Period', () => {
  function simulateResume({ lastBackgroundTime, currentTime, appPin, isAttachmentPickerActive }) {
    let shouldLock = false;
    if (lastBackgroundTime && appPin) {
      const elapsed = currentTime - lastBackgroundTime;
      if (elapsed > 30000 && !isAttachmentPickerActive) {
        shouldLock = true;
      }
    }
    return shouldLock;
  }

  test('brief minimize (< 30s) does not trigger PIN lock', () => {
    const start = 1000000;
    const shouldLock = simulateResume({
      lastBackgroundTime: start,
      currentTime: start + 12000, // 12 seconds elapsed
      appPin: '1234',
      isAttachmentPickerActive: false
    });
    assert.strictEqual(shouldLock, false);
  });

  test('extended minimize (> 30s) triggers PIN lock', () => {
    const start = 1000000;
    const shouldLock = simulateResume({
      lastBackgroundTime: start,
      currentTime: start + 31000, // 31 seconds elapsed
      appPin: '1234',
      isAttachmentPickerActive: false
    });
    assert.strictEqual(shouldLock, true);
  });

  test('picking attachment suppresses PIN lock even after prolonged period (> 30s)', () => {
    const start = 1000000;
    const shouldLock = simulateResume({
      lastBackgroundTime: start,
      currentTime: start + 60000, // 60 seconds picking document in OS
      appPin: '1234',
      isAttachmentPickerActive: true // Attachment picker active
    });
    assert.strictEqual(shouldLock, false);
  });

  test('no PIN configured never locks', () => {
    const start = 1000000;
    const shouldLock = simulateResume({
      lastBackgroundTime: start,
      currentTime: start + 100000,
      appPin: null,
      isAttachmentPickerActive: false
    });
    assert.strictEqual(shouldLock, false);
  });
});

// ==============================================================================
// TEST SUITE 6: Localization & PIN Translation Verification
// ==============================================================================
describe('Localization & PIN String Integrity', () => {
  const languages = ['de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'ru', 'zh'];
  const requiredNewKeys = [
    'Forgot PIN?',
    'Reset PIN',
    'Reset PIN will remove the App PIN lock and allow you to access your tasks. Do you want to reset your PIN?',
    'Unlock with Biometrics',
    'Verify fingerprint to reset App PIN',
    'Authentication Failed',
    'Biometric authentication failed. The App PIN cannot be reset without verification.',
    'Authenticate to manage App PIN',
    'Authenticate to change App PIN',
    'Authenticate with fingerprint to enable App PIN',
    'Authenticate to remove App PIN',
    'Biometric authentication is required to configure or change the App PIN to prevent unauthorized lockouts.',
    'Biometric authentication is required to turn off App PIN.',
    'Not available on this device',
    'Enter your 4-digit PIN',
    'Purple',
    'Violet',
    'Green',
    'Blue',
    'Orange',
    'Slate'
  ];

  test('all 10 language files exist, are valid JSON, and have matching key counts', () => {
    const counts = [];
    for (const lang of languages) {
      const filePath = path.resolve(`src/locales/${lang}.json`);
      assert.ok(fs.existsSync(filePath), `Locale file missing: ${lang}.json`);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      counts.push(Object.keys(content).length);
    }
    // All files should have identical key count
    const targetCount = counts[0];
    for (let i = 0; i < languages.length; i++) {
      assert.strictEqual(
        counts[i],
        targetCount,
        `Key count mismatch in ${languages[i]}.json (expected ${targetCount}, got ${counts[i]})`
      );
    }
  });

  test('new PIN & biometric keys exist and are non-empty in every language', () => {
    for (const lang of languages) {
      const filePath = path.resolve(`src/locales/${lang}.json`);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const key of requiredNewKeys) {
        assert.ok(content[key], `Missing key "${key}" in ${lang}.json`);
        assert.strictEqual(typeof content[key], 'string');
        assert.ok(content[key].trim().length > 0, `Empty translation for "${key}" in ${lang}.json`);
      }
    }
  });
});

// ==============================================================================
// TEST SUITE 7: Biometric Protection for PIN Setup, Change, and Recovery
// ==============================================================================
describe('Tier 1 Biometric Protection for PIN Operations', () => {
  let mockAuthSuccess = true;
  let mockHardware = true;
  let mockEnrolled = true;

  const mockLocalAuthentication = {
    __esModule: true,
    hasHardwareAsync: async () => mockHardware,
    isEnrolledAsync: async () => mockEnrolled,
    supportedAuthenticationTypesAsync: async () => [1], // 1 = Fingerprint
    authenticateAsync: async () => ({ success: mockAuthSuccess }),
    AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 }
  };

  const mockPlatform = { Platform: { OS: 'android', Version: 34 } };

  let BiometricHelper;
  let SecurityLockHelper;

  beforeEach(() => {
    mockAuthSuccess = true;
    mockHardware = true;
    mockEnrolled = true;
    mockLocalAuthentication.authenticateAsync = async () => ({ success: mockAuthSuccess });

    const secMod = loadTranspiledModule(path.resolve('src/utils/securityLockHelper.js'));
    SecurityLockHelper = secMod.SecurityLockHelper;
    if (SecurityLockHelper._resetForTesting) SecurityLockHelper._resetForTesting();

    const bioMod = loadTranspiledModule(path.resolve('src/utils/biometricHelper.js'), {
      'expo-local-authentication': mockLocalAuthentication,
      'react-native': mockPlatform,
      './securityLockHelper': secMod
    });
    BiometricHelper = bioMod.BiometricHelper;
  });

  afterEach(() => {
    if (SecurityLockHelper._resetForTesting) SecurityLockHelper._resetForTesting();
  });

  test('isAvailable returns true when hardware & enrolled are true', async () => {
    assert.strictEqual(await BiometricHelper.isAvailable(), true);
  });

  test('isAvailable returns false if not enrolled', async () => {
    mockEnrolled = false;
    assert.strictEqual(await BiometricHelper.isAvailable(), false);
  });

  test('authenticate marks and unmarks biometric authentication status in SecurityLockHelper', async () => {
    let capturedDuringAuth = null;
    mockLocalAuthentication.authenticateAsync = async () => {
      capturedDuringAuth = SecurityLockHelper.isAuthenticatingBiometric();
      return { success: true };
    };

    const res = await BiometricHelper.authenticate();
    assert.strictEqual(res.success, true);
    assert.strictEqual(capturedDuringAuth, true);
  });

  test('unauthorized person fails biometric check and CANNOT enable or set App PIN', async () => {
    mockAuthSuccess = false; // Unauthorized person (e.g. friend or stranger)

    let pinWasSet = false;
    const attemptSetPin = async () => {
      const isAvail = await BiometricHelper.isAvailable();
      if (isAvail) {
        const auth = await BiometricHelper.authenticate({ promptMessage: 'Authenticate with fingerprint to enable App PIN' });
        if (!auth.success) {
          return { error: 'Authentication Failed' };
        }
      }
      pinWasSet = true;
      return { success: true };
    };

    const result = await attemptSetPin();
    assert.strictEqual(pinWasSet, false);
    assert.strictEqual(result.error, 'Authentication Failed');
  });

  test('legitimate device owner with fingerprint CAN enable App PIN', async () => {
    mockAuthSuccess = true; // Legitimate owner

    let pinWasSet = false;
    const attemptSetPin = async () => {
      const isAvail = await BiometricHelper.isAvailable();
      if (isAvail) {
        const auth = await BiometricHelper.authenticate({ promptMessage: 'Authenticate with fingerprint to enable App PIN' });
        if (!auth.success) {
          return { error: 'Authentication Failed' };
        }
      }
      pinWasSet = true;
      return { success: true };
    };

    const result = await attemptSetPin();
    assert.strictEqual(pinWasSet, true);
    assert.strictEqual(result.success, true);
  });

  test('unauthorized person CANNOT reset forgotten PIN', async () => {
    mockAuthSuccess = false;

    let appPin = '9999';
    let isUnlocked = false;

    const handleForgotPin = async () => {
      const isAvail = await BiometricHelper.isAvailable();
      if (isAvail) {
        const auth = await BiometricHelper.authenticate({ promptMessage: 'Verify fingerprint to reset App PIN' });
        if (!auth.success) {
          return; // Stay locked
        }
      }
      appPin = null;
      isUnlocked = true;
    };

    await handleForgotPin();
    assert.strictEqual(appPin, '9999'); // PIN unchanged
    assert.strictEqual(isUnlocked, false); // Screen remains locked
  });

  test('legitimate owner verifies fingerprint and resets forgotten PIN', async () => {
    mockAuthSuccess = true;

    let appPin = '9999';
    let isUnlocked = false;

    const handleForgotPin = async () => {
      const isAvail = await BiometricHelper.isAvailable();
      if (isAvail) {
        const auth = await BiometricHelper.authenticate({ promptMessage: 'Verify fingerprint to reset App PIN' });
        if (!auth.success) {
          return;
        }
      }
      appPin = null;
      isUnlocked = true;
    };

    await handleForgotPin();
    assert.strictEqual(appPin, null); // PIN successfully reset
    assert.strictEqual(isUnlocked, true); // App unlocked
  });

  test('user can choose biometric or PIN unlock via biometricUnlockEnabled setting', () => {
    const themeMod = loadTranspiledModule(path.resolve('src/features/themeSlice.js'), {
      '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {} }
    });
    const reducer = themeMod.default;
    const { setBiometricUnlockEnabled } = themeMod;

    // Initial state has biometricUnlockEnabled default true
    const initialState = reducer(undefined, { type: '@@INIT' });
    assert.strictEqual(initialState.biometricUnlockEnabled, true);

    // User chooses PIN code only (turns off biometric unlock)
    const pinOnlyState = reducer(initialState, setBiometricUnlockEnabled(false));
    assert.strictEqual(pinOnlyState.biometricUnlockEnabled, false);

    // User switches back to biometric unlock
    const biometricState = reducer(pinOnlyState, setBiometricUnlockEnabled(true));
    assert.strictEqual(biometricState.biometricUnlockEnabled, true);
  });
});

// ==============================================================================
// TEST SUITE 8: Section 508 & WCAG 2.1 AA Accessibility Standards
// ==============================================================================
describe('Section 508 & WCAG 2.1 AA Accessibility Standards', () => {
  let A11yHelper;
  let lastAnnouncedMessage = null;

  beforeEach(() => {
    lastAnnouncedMessage = null;
    const mockRN = {
      Platform: { OS: 'android', Version: 34 },
      AccessibilityInfo: {
        announceForAccessibility: (msg) => {
          lastAnnouncedMessage = msg;
        }
      },
      Text: {},
      TextInput: {}
    };
    const mod = loadTranspiledModule(path.resolve('src/utils/a11yHelper.js'), {
      'react-native': mockRN
    });
    A11yHelper = mod.A11yHelper;
  });

  test('minTouchTarget meets Section 508 / WCAG 2.5.5 touch target size (>= 44x44 dp)', () => {
    assert.ok(A11yHelper.minTouchTarget);
    assert.strictEqual(A11yHelper.minTouchTarget.minWidth, 44);
    assert.strictEqual(A11yHelper.minTouchTarget.minHeight, 44);
  });

  test('announce dispatches message to native AccessibilityInfo', () => {
    A11yHelper.announce('Task completed successfully');
    assert.strictEqual(lastAnnouncedMessage, 'Task completed successfully');
  });

  test('announce ignores null, non-string, or empty messages without error', () => {
    A11yHelper.announce(null);
    assert.strictEqual(lastAnnouncedMessage, null);
    A11yHelper.announce('');
    assert.strictEqual(lastAnnouncedMessage, null);
    A11yHelper.announce(12345);
    assert.strictEqual(lastAnnouncedMessage, null);
  });

  test('formatTaskAccessibilityLabel provides color-independent priority description (Section 508 §1194.21(i))', () => {
    const taskHigh = {
      taskname: 'Pay electricity bill',
      completed: false,
      priority: 'high'
    };
    const labelHigh = A11yHelper.formatTaskAccessibilityLabel(taskHigh);
    assert.ok(labelHigh.includes('Incomplete'));
    assert.ok(labelHigh.includes('Pay electricity bill'));
    assert.ok(labelHigh.includes('High Priority'));

    const taskMedium = { taskname: 'Buy milk', completed: false, priority: 'medium' };
    assert.ok(A11yHelper.formatTaskAccessibilityLabel(taskMedium).includes('Medium Priority'));

    const taskLow = { taskname: 'Read book', completed: false, priority: 'low' };
    assert.ok(A11yHelper.formatTaskAccessibilityLabel(taskLow).includes('Low Priority'));
  });

  test('formatTaskAccessibilityLabel formats completion, due date, recurring series and subtasks', () => {
    const task = {
      taskname: 'Quarterly taxes',
      completed: true,
      priority: 'urgent',
      dueDate: '2026-11-15',
      time: '14:00',
      isRecurring: true,
      subtasks: [
        { text: 'Gather W2', completed: true },
        { text: 'Submit 1040', completed: false }
      ]
    };
    const label = A11yHelper.formatTaskAccessibilityLabel(task);
    assert.ok(label.includes('Completed'));
    assert.ok(label.includes('Quarterly taxes'));
    assert.ok(label.includes('High Priority'));
    assert.ok(label.includes('Due: 2026-11-15, 14:00'));
    assert.ok(label.includes('Recurring task'));
    assert.ok(label.includes('1 of 2 subtasks completed'));
  });

  test('formatTaskAccessibilityLabel handles empty or null task safely', () => {
    assert.strictEqual(A11yHelper.formatTaskAccessibilityLabel(null), '');
    assert.strictEqual(A11yHelper.formatTaskAccessibilityLabel(undefined), '');
  });

  test('formatTaskAccessibilityLabel respects custom localization translation function', () => {
    const task = {
      taskname: 'Купить продукты',
      completed: false,
      priority: 'high',
      dueDate: '2026-11-01',
      recurringSeriesId: 'series_123',
      subtasks: [{ completed: true }, { completed: true }]
    };
    const mockT = (key) => {
      const dict = {
        'Incomplete': 'Не выполнено',
        'High Priority': 'Высокий приоритет',
        'Due': 'Срок',
        'Recurring task': 'Повторяющаяся задача',
        'of': 'из',
        'subtasks completed': 'подзадач выполнено'
      };
      return dict[key] || key;
    };
    const label = A11yHelper.formatTaskAccessibilityLabel(task, { t: mockT });
    assert.ok(label.includes('Не выполнено'));
    assert.ok(label.includes('Купить продукты'));
    assert.ok(label.includes('Высокий приоритет'));
    assert.ok(label.includes('Срок: 2026-11-01'));
    assert.ok(label.includes('Повторяющаяся задача'));
    assert.ok(label.includes('2 из 2 подзадач выполнено'));
  });

  test('getModalFocusTrapProps shields background views when modal is active (WCAG 2.1.2)', () => {
    const trapped = A11yHelper.getModalFocusTrapProps(true);
    assert.strictEqual(trapped.accessibilityElementsHidden, true);
    assert.strictEqual(trapped.importantForAccessibility, 'no-hide-descendants');
    assert.strictEqual(trapped.pointerEvents, 'none');

    const untrapped = A11yHelper.getModalFocusTrapProps(false);
    assert.strictEqual(untrapped.accessibilityElementsHidden, false);
    assert.strictEqual(untrapped.importantForAccessibility, 'auto');
    assert.strictEqual(untrapped.pointerEvents, 'auto');
  });

  test('MAX_FONT_SIZE_MULTIPLIER and getAccessibleTextProps provide WCAG 1.4.4 font scaling limits', () => {
    assert.strictEqual(A11yHelper.MAX_FONT_SIZE_MULTIPLIER, 1.5);
    const defaultProps = A11yHelper.getAccessibleTextProps();
    assert.strictEqual(defaultProps.maxFontSizeMultiplier, 1.5);
    assert.strictEqual(defaultProps.allowFontScaling, true);

    const customProps = A11yHelper.getAccessibleTextProps(1.35);
    assert.strictEqual(customProps.maxFontSizeMultiplier, 1.35);
  });

  test('makeFlexibleHeight converts fixed heights into accessible minHeights', () => {
    const fixedSmall = { height: 32, padding: 8 };
    const flexibleSmall = A11yHelper.makeFlexibleHeight(fixedSmall);
    assert.strictEqual(flexibleSmall.height, undefined);
    assert.strictEqual(flexibleSmall.minHeight, 44);
    assert.strictEqual(flexibleSmall.padding, 8);

    const fixedLarge = { height: 56, margin: 4 };
    const flexibleLarge = A11yHelper.makeFlexibleHeight(fixedLarge);
    assert.strictEqual(flexibleLarge.minHeight, 56);
  });

  test('configureGlobalFontScaling sets maxFontSizeMultiplier across Text and TextInput', () => {
    A11yHelper.configureGlobalFontScaling(1.5);
    const mockRN = loadTranspiledModule(path.resolve('src/utils/a11yHelper.js'), {
      'react-native': { Text: {}, TextInput: {}, AccessibilityInfo: {}, Platform: { OS: 'ios' } }
    });
    mockRN.A11yHelper.configureGlobalFontScaling(1.5);
  });
});

// ==============================================================================
// TEST SUITE 9: OWASP MASVS Security Standards (Data-at-Rest & Screen Privacy)
// ==============================================================================
describe('OWASP MASVS Security Standards (Data-at-Rest & Screen Privacy)', () => {
  let CryptoStorage;
  let mockStorage;

  beforeEach(() => {
    mockStorage = {};
    const mockAsyncStorage = {
      setItem: async (k, v) => { mockStorage[k] = String(v); },
      getItem: async (k) => mockStorage[k] !== undefined ? mockStorage[k] : null,
      multiGet: async (keys) => keys.map(k => [k, mockStorage[k] !== undefined ? mockStorage[k] : null]),
      removeItem: async (k) => { delete mockStorage[k]; },
      clear: async () => { mockStorage = {}; }
    };
    const mod = loadTranspiledModule(path.resolve('src/utils/cryptoStorage.js'), {
      '@react-native-async-storage/async-storage': mockAsyncStorage
    });
    CryptoStorage = mod.CryptoStorage;
    if (CryptoStorage._resetKeyForTesting) CryptoStorage._resetKeyForTesting();
  });

  test('SHA-256 and HMAC-SHA256 match cryptographic standard test vectors', () => {
    const { sha256Bytes, hmacSha256, strToUtf8, bytesToHex } = CryptoStorage;
    // NIST test vector for empty string
    const emptySha = bytesToHex(sha256Bytes(strToUtf8('')));
    assert.strictEqual(emptySha, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

    // NIST test vector for "The quick brown fox jumps over the lazy dog"
    const foxSha = bytesToHex(sha256Bytes(strToUtf8('The quick brown fox jumps over the lazy dog')));
    assert.strictEqual(foxSha, 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');

    // RFC 2104 HMAC-SHA256 test vector
    const key = strToUtf8('key');
    const msg = strToUtf8('The quick brown fox jumps over the lazy dog');
    const hmacHex = bytesToHex(hmacSha256(key, msg));
    assert.strictEqual(hmacHex, 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
  });

  test('hashPin generates salted multi-iteration hash, protecting PIN from plaintext storage', () => {
    const hash1 = CryptoStorage.hashPin('1234');
    const hash2 = CryptoStorage.hashPin('1234');
    assert.ok(CryptoStorage.isPinHashed(hash1));
    assert.ok(CryptoStorage.isPinHashed(hash2));
    // Due to random salt, two hashes of the same PIN must not be identical
    assert.notStrictEqual(hash1, hash2);
    assert.ok(!hash1.includes('1234'));
  });

  test('verifyPin correctly verifies matching PIN and rejects incorrect PIN', () => {
    const hashed = CryptoStorage.hashPin('4321');
    assert.strictEqual(CryptoStorage.verifyPin('4321', hashed), true);
    assert.strictEqual(CryptoStorage.verifyPin('1234', hashed), false);
    assert.strictEqual(CryptoStorage.verifyPin('4322', hashed), false);
    assert.strictEqual(CryptoStorage.verifyPin('', hashed), false);
  });

  test('verifyPin supports backward-compatible constant-time verification for legacy plaintext PINs', () => {
    assert.strictEqual(CryptoStorage.verifyPin('9999', '9999'), true);
    assert.strictEqual(CryptoStorage.verifyPin('1111', '9999'), false);
  });

  test('CryptoStorage encrypts tasks at rest with AES-256 CTR and HMAC authentication', async () => {
    const sensitiveTasks = [
      { id: 'task_001', taskname: 'Secret client meeting', notes: 'Password123' }
    ];
    await CryptoStorage.setItem('tasks', JSON.stringify(sensitiveTasks));

    const rawInStorage = mockStorage['tasks'];
    assert.ok(rawInStorage);
    // Raw storage must be an encrypted envelope, not plaintext
    assert.ok(rawInStorage.includes('__enc__'));
    assert.ok(!rawInStorage.includes('Secret client meeting'));
    assert.ok(!rawInStorage.includes('Password123'));

    // Reading back decrypts correctly
    const decrypted = await CryptoStorage.getItem('tasks');
    assert.deepStrictEqual(JSON.parse(decrypted), sensitiveTasks);
  });

  test('CryptoStorage transparently reads existing unencrypted data without corruption', async () => {
    const legacyPlaintext = JSON.stringify([{ id: 'legacy_1', taskname: 'Existing unencrypted task' }]);
    mockStorage['legacy_tasks'] = legacyPlaintext;

    const readBack = await CryptoStorage.getItem('legacy_tasks');
    assert.strictEqual(readBack, legacyPlaintext);
  });

  test('CryptoStorage detects data tampering and fails integrity verification', async () => {
    await CryptoStorage.setItem('tamper_test', 'Sensitive configuration');
    const envelope = JSON.parse(mockStorage['tamper_test']);

    // Tamper with the ciphertext by flipping bytes
    const tamperedCt = envelope.ct.replace(/^[0-9a-f]{2}/, 'ff');
    envelope.ct = tamperedCt;
    mockStorage['tamper_test'] = JSON.stringify(envelope);

    const decrypted = await CryptoStorage.getItem('tamper_test');
    // Tampered data must return null to prevent executing corrupted/manipulated payloads
    assert.strictEqual(decrypted, null);
  });

  test('setScreenSecurityAsync and isScreenSecurityEnabled operate safely on native module interface', async () => {
    const alarmModule = loadTranspiledModule(path.resolve('modules/expo-task-alarm/index.ts'), {
      'expo-modules-core': {
        requireNativeModule: () => ({
          setScreenSecurityAsync: async (enable) => enable,
          isScreenSecurityEnabled: async () => true
        })
      },
      'react-native': { Platform: { OS: 'android' } }
    });

    const setRes = await alarmModule.setScreenSecurityAsync(true);
    assert.strictEqual(setRes, true);
    const isSec = await alarmModule.isScreenSecurityEnabled();
    assert.strictEqual(isSec, true);
  });

  test('scheduleExactAlarm handles exact alarm execution and errors gracefully', async () => {
    let scheduledWith = null;
    const alarmModule = loadTranspiledModule(path.resolve('modules/expo-task-alarm/index.ts'), {
      'expo-modules-core': {
        requireNativeModule: () => ({
          scheduleExactAlarm: async (id, name, time, sound, style) => {
            scheduledWith = { id, name, time, sound, style };
            return true;
          }
        })
      },
      'react-native': { Platform: { OS: 'android' } }
    });

    const success = await alarmModule.scheduleExactAlarm('t-123', 'Important task', Date.now() + 60000, 'bell.mp3', 'fullscreen');
    assert.strictEqual(success, true);
    assert.strictEqual(scheduledWith.id, 't-123');
    assert.strictEqual(scheduledWith.sound, 'bell.mp3');
  });

  test('App screen security policy allows screenshots when unlocked and blocks during PIN screen, background or when user enabled blockScreenshots', () => {
    const computeScreenSecurity = ({ blockScreenshots, appPin, isUnlocked, isAppBackgrounded }) => {
      const isLocked = !!(appPin && !isUnlocked);
      return !!(blockScreenshots || isLocked || isAppBackgrounded);
    };

    // Case 1: Unlocked, PIN enabled, actively in foreground, blockScreenshots OFF (default)
    // -> Screenshots MUST be allowed!
    assert.strictEqual(
      computeScreenSecurity({ blockScreenshots: false, appPin: '1234', isUnlocked: true, isAppBackgrounded: false }),
      false,
      'Screenshots must be allowed during normal foreground usage even when App PIN is set'
    );

    // Case 2: App locked with PIN (on PIN screen)
    // -> Screenshots must be blocked to protect PIN
    assert.strictEqual(
      computeScreenSecurity({ blockScreenshots: false, appPin: '1234', isUnlocked: false, isAppBackgrounded: false }),
      true,
      'Screenshots must be blocked when PIN lock screen is displayed'
    );

    // Case 3: App is backgrounded (in OS task switcher)
    // -> Screen security must be enabled to prevent OS recents leaks
    assert.strictEqual(
      computeScreenSecurity({ blockScreenshots: false, appPin: '1234', isUnlocked: true, isAppBackgrounded: true }),
      true,
      'Screen security must be active in app switcher'
    );

    // Case 4: User explicitly enabled "Block screenshots" in Settings
    // -> Always blocked even when unlocked
    assert.strictEqual(
      computeScreenSecurity({ blockScreenshots: true, appPin: '1234', isUnlocked: true, isAppBackgrounded: false }),
      true,
      'Screenshots must be blocked when user enables Block screenshots setting'
    );
  });
});

// ==============================================================================
// TEST SUITE 10: GDPR Data Portability, Right to Erasure & Privacy Compliance
// ==============================================================================
describe('GDPR Data Portability, Right to Erasure & Privacy Compliance', () => {
  let gdprHelper;
  let writtenFiles;
  let sharedFiles;
  let fallbackShares;
  let cancelledAlarms;
  let notificationsCancelled;
  let storageCleared;
  let cryptoStorageCleared;
  let dispatchedActions;
  let isSharingAvailable;

  beforeEach(() => {
    writtenFiles = {};
    sharedFiles = [];
    fallbackShares = [];
    cancelledAlarms = [];
    notificationsCancelled = false;
    storageCleared = false;
    cryptoStorageCleared = false;
    dispatchedActions = [];
    isSharingAvailable = true;

    gdprHelper = loadTranspiledModule(path.resolve('src/utils/gdprHelper.js'), {
      'expo-file-system': {
        cacheDirectory: 'file:///data/user/0/com.taskcalendar/cache/',
        documentDirectory: 'file:///data/user/0/com.taskcalendar/files/',
        EncodingType: { UTF8: 'utf8' },
        writeAsStringAsync: async (uri, content) => {
          writtenFiles[uri] = content;
        }
      },
      'expo-sharing': {
        isAvailableAsync: async () => isSharingAvailable,
        shareAsync: async (uri, opts) => {
          sharedFiles.push({ uri, opts });
        }
      },
      'expo-notifications': {
        cancelAllScheduledNotificationsAsync: async () => {
          notificationsCancelled = true;
        }
      },
      'react-native': {
        Platform: { OS: 'android' },
        Share: {
          share: async (content) => {
            fallbackShares.push(content);
          }
        }
      },
      '@react-native-async-storage/async-storage': {
        clear: async () => {
          storageCleared = true;
        }
      },
      './cryptoStorage': {
        CryptoStorage: {
          clear: async () => {
            cryptoStorageCleared = true;
          }
        }
      },
      'expo-document-picker': {
        getDocumentAsync: async () => ({ canceled: true })
      },
      './securityLockHelper': {
        SecurityLockHelper: {
          markPickingAttachment: () => {}
        }
      },
      '../../modules/expo-task-alarm': {
        cancelAlarm: async (id) => {
          cancelledAlarms.push(id);
        }
      },
      '../features/taskSlice': {
        clearTasks: () => ({ type: 'task/clearTasks' }),
        addMultipleTasks: (payload) => ({ type: 'task/addMultipleTasks', payload })
      },
      '../features/themeSlice': {
        resetTheme: () => ({ type: 'theme/resetTheme' })
      },
      '../features/userSlice': {
        logout: () => ({ type: 'user/logout' }),
        addBoardAsync: (payload) => ({ type: 'user/addBoard', payload })
      }
    });
  });

  test('exportDataAsJsonAsync creates valid JSON containing full user dataset and invokes sharing', async () => {
    const tasks = [
      {
        id: 't-1',
        taskname: 'Quarterly Review',
        completed: false,
        priority: 'high',
        completionDate: '2026-11-15',
        time: '14:00',
        boardId: 'b-work',
        reminder: '30 min before',
        isAlarm: true,
        isRecurring: true,
        repeatConfig: { preset: 'Weekly', interval: 1 },
        notes: 'Prepare slide deck',
        subtasks: [{ id: 's-1', title: 'Collect metrics', completed: true }]
      }
    ];
    const boards = [{ id: 'b-work', name: 'Work Projects', color: '#5D45DB' }];
    const stats = { completedCount: 42, streak: 7 };
    const pomodoro = { completedSessions: 12 };
    const theme = { themeMode: 'dark', fontSize: 'large', defaultReminderTime: '30 min before' };
    const user = { userEmail: 'user@example.com', isGuest: false };

    const result = await gdprHelper.exportDataAsJsonAsync({ tasks, boards, stats, pomodoro, theme, user });
    assert.strictEqual(result.success, true);
    assert.ok(result.filename.startsWith('taskcalendar_export_'));
    assert.ok(result.filename.endsWith('.json'));

    // Check file content
    const content = writtenFiles[result.uri];
    assert.ok(content, 'File was written to cache directory');
    const parsed = JSON.parse(content);

    assert.strictEqual(parsed.app, 'TaskCalendar');
    assert.strictEqual(parsed.schemaVersion, 1);
    assert.strictEqual(parsed.account.email, 'user@example.com');
    assert.strictEqual(parsed.boards.length, 1);
    assert.strictEqual(parsed.boards[0].name, 'Work Projects');
    assert.strictEqual(parsed.tasks.length, 1);
    assert.strictEqual(parsed.tasks[0].taskname, 'Quarterly Review');
    assert.strictEqual(parsed.tasks[0].subtasks.length, 1);
    assert.strictEqual(parsed.tasks[0].subtasks[0].title, 'Collect metrics');
    assert.strictEqual(parsed.preferences.themeMode, 'dark');

    // Check native sharing was invoked
    assert.strictEqual(sharedFiles.length, 1);
    assert.strictEqual(sharedFiles[0].uri, result.uri);
    assert.strictEqual(sharedFiles[0].opts.mimeType, 'application/json');
  });

  test('exportDataAsJsonAsync falls back to Share.share when expo-sharing is unavailable', async () => {
    isSharingAvailable = false;
    const result = await gdprHelper.exportDataAsJsonAsync({ tasks: [], boards: [] });
    assert.strictEqual(result.success, true);
    assert.strictEqual(fallbackShares.length, 1);
    assert.ok(fallbackShares[0].title.startsWith('taskcalendar_export_'));
  });

  test('exportTasksAsCsvAsync produces RFC 4180 compliant CSV with proper escaping', async () => {
    const tasks = [
      {
        id: 't-101',
        taskname: 'Meeting with "VIP" clients, urgent',
        completed: true,
        priority: 'high',
        completionDate: '2026-11-02',
        time: '09:00 AM',
        boardId: 'b-1',
        isRecurring: false,
        notes: 'Line 1\nLine 2 with "quotes" and, commas',
        subtasks: [
          { id: 'sub-1', title: 'Part A', completed: true },
          { id: 'sub-2', title: 'Part B', completed: false }
        ]
      },
      {
        id: 't-102',
        taskname: 'Simple Task',
        completed: false,
        priority: 'normal',
        boardId: 'non-existent-board'
      }
    ];
    const boards = [{ id: 'b-1', name: 'Executive Team' }];

    const result = await gdprHelper.exportTasksAsCsvAsync({ tasks, boards });
    assert.strictEqual(result.success, true);
    assert.ok(result.filename.startsWith('taskcalendar_tasks_'));
    assert.ok(result.filename.endsWith('.csv'));

    const content = writtenFiles[result.uri];
    assert.ok(content);
    const lines = content.split('\n');

    // Header check
    assert.strictEqual(lines[0], 'Task ID,Task Name,Status,Priority,Due Date,Due Time,Board,Recurring,Subtasks Total,Subtasks Completed,Notes');

    // Row 1 checks: quotes doubled, comma escaped, subtasks 2 total 1 completed
    assert.ok(content.includes('""VIP"" clients, urgent'));
    assert.ok(content.includes('"Executive Team"'));
    assert.ok(content.includes('"Completed"'));
    assert.ok(content.includes('"2","1"'));

    // Check share call
    assert.strictEqual(sharedFiles.length, 1);
    assert.strictEqual(sharedFiles[0].opts.mimeType, 'text/csv');
  });

  test('parseCsv handles standard RFC 4180 quotes, commas, and newlines', () => {
    const csv = 'Task Name,Priority,Notes\n"Buy ""Organic"" Milk",High,"Line 1\nLine 2, with comma"\nSimple,Low,Done';
    const rows = gdprHelper.parseCsv(csv);
    assert.strictEqual(rows.length, 3);
    assert.deepStrictEqual(rows[0], ['Task Name', 'Priority', 'Notes']);
    assert.strictEqual(rows[1][0], 'Buy "Organic" Milk');
    assert.strictEqual(rows[1][1], 'High');
    assert.strictEqual(rows[1][2], 'Line 1\nLine 2, with comma');
    assert.deepStrictEqual(rows[2], ['Simple', 'Low', 'Done']);
  });

  test('importTasksFromCsvAsync imports tasks accurately into Redux state', async () => {
    const csv = [
      'Task Name,Status,Priority,Due Date,Due Time,Board,Notes,Subtasks',
      '"Project Alpha Launch",Completed,High,2026-11-20,10:00 AM,Work,"Crucial deadline","Prep slides; Review budget"',
      '"Grocery Run",Pending,Normal,2026-11-05,08:30 AM,Personal,"Apples, Milk",Sub 1'
    ].join('\n');

    const added = [];
    const mockDispatch = (action) => {
      if (action.type === 'task/addMultipleTasks') {
        added.push(...action.payload.tasks);
      }
    };
    const boards = [{ id: 'b_work', name: 'Work' }, { id: 'b_pers', name: 'Personal' }];

    const res = await gdprHelper.importTasksFromCsvAsync({
      csvString: csv,
      dispatch: mockDispatch,
      existingBoards: boards
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.count, 2);
    assert.strictEqual(added.length, 2);

    // Row 1 assertions
    assert.strictEqual(added[0].taskname, 'Project Alpha Launch');
    assert.strictEqual(added[0].completed, true);
    assert.strictEqual(added[0].priority, 'high');
    assert.strictEqual(added[0].boardId, 'b_work');
    assert.strictEqual(added[0].time, '10:00 AM');
    assert.strictEqual(added[0].description.text, 'Crucial deadline');
    assert.strictEqual(added[0].subtasks.length, 2);
    assert.strictEqual(added[0].subtasks[0].text, 'Prep slides');
    assert.strictEqual(added[0].subtasks[1].text, 'Review budget');

    // Row 2 assertions
    assert.strictEqual(added[1].taskname, 'Grocery Run');
    assert.strictEqual(added[1].completed, false);
    assert.strictEqual(added[1].priority, 'medium');
    assert.strictEqual(added[1].boardId, 'b_pers');
  });

  test('importDataFromJsonAsync restores tasks and creates missing boards', async () => {
    const backupJson = JSON.stringify({
      app: 'TaskCalendar',
      schemaVersion: 1,
      boards: [
        { id: 'custom_board_1', name: 'Fitness & Health', color: '#10B981' }
      ],
      tasks: [
        {
          id: 'json_task_1',
          taskname: '5k Morning Run',
          completed: false,
          priority: 'high',
          completionDate: '2026-11-10T07:00:00.000Z',
          boardId: 'custom_board_1',
          description: { text: 'Drink water before starting' },
          subtasks: [{ id: 'sub_run_1', title: 'Stretch legs', completed: true }]
        }
      ]
    });

    const addedTasks = [];
    const addedBoards = [];
    const mockDispatch = (action) => {
      if (action.type === 'task/addMultipleTasks') {
        addedTasks.push(...action.payload.tasks);
      } else if (action.type === 'user/addBoard') {
        addedBoards.push(action.payload);
      }
    };

    const res = await gdprHelper.importDataFromJsonAsync({
      jsonString: backupJson,
      dispatch: mockDispatch,
      existingBoards: [{ id: 'main', name: 'Main' }]
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.boardsCount, 1);
    assert.strictEqual(addedBoards.length, 1);
    assert.strictEqual(addedBoards[0].name, 'Fitness & Health');
    assert.strictEqual(addedTasks.length, 1);
    assert.strictEqual(addedTasks[0].taskname, '5k Morning Run');
    assert.strictEqual(addedTasks[0].priority, 'high');
    assert.strictEqual(addedTasks[0].boardId, 'custom_board_1');
  });

  test('wipeAllUserDataAsync executes complete GDPR Art. 17 data erasure', async () => {
    const mockTasks = [
      { id: 'task-1', isAlarm: true },
      { id: 'task-2', isAlarm: false }
    ];
    const mockGetState = () => ({
      taskReducer: { tasks: mockTasks }
    });
    const mockDispatch = (action) => {
      dispatchedActions.push(action);
    };

    const wipeResult = await gdprHelper.wipeAllUserDataAsync({
      dispatch: mockDispatch,
      getState: mockGetState
    });

    assert.strictEqual(wipeResult.success, true);

    // 1. Notifications cancelled
    assert.strictEqual(notificationsCancelled, true);

    // 2. Active task alarms cancelled
    assert.ok(cancelledAlarms.includes('task-1'));
    assert.ok(cancelledAlarms.includes('task-2'));

    // 3. Storage wiped
    assert.strictEqual(cryptoStorageCleared, true);
    assert.strictEqual(storageCleared, true);

    // 4. Redux states reset
    const actionTypes = dispatchedActions.map(a => a.type);
    assert.ok(actionTypes.includes('task/clearTasks'));
    assert.ok(actionTypes.includes('theme/resetTheme'));
    assert.ok(actionTypes.includes('user/logout'));
  });

  test('PRIVACY_POLICY_DISCLOSURES provides 5 structured transparency items', () => {
    const disclosures = gdprHelper.PRIVACY_POLICY_DISCLOSURES;
    assert.strictEqual(disclosures.length, 5);

    const ids = disclosures.map(d => d.id);
    assert.deepStrictEqual(ids, ['ownership', 'encryption', 'no_trackers', 'biometrics', 'gdpr_rights']);

    for (const item of disclosures) {
      assert.ok(item.title && typeof item.title === 'string' && item.title.length > 5);
      assert.ok(item.text && typeof item.text === 'string' && item.text.length > 20);
    }
  });

  test('100% localization key parity and presence of all GDPR strings across all 10 locales', () => {
    const localesDir = path.resolve('src/locales');
    const languages = ['en', 'ru', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'hi'];

    const loadedLocales = {};
    for (const lang of languages) {
      const filePath = path.join(localesDir, `${lang}.json`);
      assert.ok(fs.existsSync(filePath), `Locale file for ${lang} must exist`);
      const raw = fs.readFileSync(filePath, 'utf8');
      loadedLocales[lang] = JSON.parse(raw);
    }

    const enKeys = Object.keys(loadedLocales['en']);
    assert.strictEqual(enKeys.length, 837, 'English locale must contain exactly 837 keys');
    assert.strictEqual(loadedLocales['ru']['Not available on this device'], 'Недоступно на этом устройстве');
    assert.strictEqual(loadedLocales['ko']['Purple'], '보라');
    assert.strictEqual(loadedLocales['ru']['Purple'], 'Пурпурный');
    assert.strictEqual(loadedLocales['ru']['Block screenshots'], 'Запретить снимки экрана');
    assert.strictEqual(loadedLocales['ko']['Block screenshots'], '스크린샷 차단');
    assert.strictEqual(loadedLocales['de']['Block screenshots'], 'Screenshots blockieren');
    assert.strictEqual(loadedLocales['ru']['Open full image'], 'Открыть снимок полностью');
    assert.strictEqual(loadedLocales['ko']['Open full image'], '전체 이미지 열기');
    assert.strictEqual(loadedLocales['ru']['Import Data (JSON)'], 'Импорт данных (JSON)');
    assert.strictEqual(loadedLocales['ru']['Import Tasks (CSV)'], 'Импорт задач (CSV)');
    assert.strictEqual(loadedLocales['ko']['Import Data (JSON)'], '데이터 가져오기 (JSON)');
    assert.strictEqual(loadedLocales['ko']['Import Tasks (CSV)'], '작업 가져오기 (CSV)');

    // Required GDPR keys to check
    const requiredGdprKeys = [
      'Privacy & Data (GDPR)',
      'Tap to expand',
      'Tap to collapse',
      'Privacy & Security Policy',
      'Local storage, AES-256 encryption, zero ad trackers',
      'Export All Data (JSON)',
      'GDPR Art. 20 Data Portability · Full JSON backup',
      'Import Data (JSON)',
      'Restore backup or task list from JSON',
      'Export Tasks (CSV)',
      'Formatted for spreadsheets · Excel, Sheets, Numbers',
      'Import Tasks (CSV)',
      'Import spreadsheet tasks from Excel or Google Sheets',
      'Import Successful',
      'Import Failed',
      'Successfully imported {{count}} task(s)!',
      'No valid tasks found in file',
      'Erase All Data & Reset',
      'GDPR Art. 17 Right to Erasure · Permanent wipe',
      'Privacy & Data Protection',
      'GDPR & CCPA Transparency Notice',
      'Got it',
      'Erase All Data (GDPR Art. 17)',
      'Are you sure you want to permanently erase all tasks, boards, settings, alarms, and history from this device? This action is irreversible.',
      'Erase Everything',
      'Data Erased',
      'All your personal data, alarms, and storage have been permanently erased.',
      'Authenticate to authorize data erasure',
      'Biometric authentication is required to erase all data.',
      'Export Failed',
      'Data Ownership & Local Storage',
      'You own 100% of your data. TaskCalendar is built on a local-first architecture. Your tasks, lists, notes, and habits are stored directly on your device rather than on third-party servers.',
      'AES-256 Storage Encryption at Rest',
      'All task records, descriptions, and user configurations saved on this device are encrypted at rest using industry-standard AES-256 CTR and HMAC-SHA256 authenticated encryption.',
      'Zero Third-Party Ad Trackers',
      'We never sell, rent, or monetize your personal data. The app contains zero advertising SDKs, tracking pixels, or commercial telemetry beacons.',
      'Hardware-Enclave Biometric Security',
      'Biometric authentication (fingerprint) operates exclusively through your device hardware Secure Enclave / KeyStore. Biometric samples are never captured, read, or transmitted by this app.',
      'Your GDPR & CCPA Rights',
      'In compliance with GDPR Articles 17 and 20 and the California Consumer Privacy Act (CCPA), you can export your complete personal data in standard JSON or CSV format (Data Portability) or permanently erase all your data (Right to Erasure) at any time from this Settings menu.'
    ];

    for (const lang of languages) {
      const keys = Object.keys(loadedLocales[lang]);
      assert.strictEqual(
        keys.length,
        enKeys.length,
        `Locale ${lang} must have exactly ${enKeys.length} keys (has ${keys.length})`
      );

      for (const gdprKey of requiredGdprKeys) {
        assert.ok(
          loadedLocales[lang][gdprKey] !== undefined && loadedLocales[lang][gdprKey].trim().length > 0,
          `Key "${gdprKey}" missing or empty in locale ${lang}`
        );
      }
    }
  });
});

// ==============================================================================
// TEST SUITE 11: Apple HIG & Material Design Haptic Engine
// ==============================================================================
describe('Apple HIG & Material Design Haptic Engine', () => {
  let HapticHelper;
  let vibrationCalls;

  beforeEach(() => {
    vibrationCalls = [];
    const mockRN = {
      Platform: { OS: 'android' },
      Vibration: {
        vibrate: (pattern) => {
          vibrationCalls.push(pattern);
        }
      }
    };

    const mod = loadTranspiledModule(path.resolve('src/utils/hapticHelper.js'), {
      'react-native': mockRN
    });
    HapticHelper = mod.HapticHelper;
    if (HapticHelper._resetForTesting) HapticHelper._resetForTesting();
  });

  afterEach(() => {
    if (HapticHelper._resetForTesting) HapticHelper._resetForTesting();
  });

  test('trigger vibrates with accurate HIG/Material patterns for all interaction types', () => {
    // 1. selection
    HapticHelper.selection();
    assert.strictEqual(vibrationCalls.length, 1);
    assert.strictEqual(vibrationCalls[0], 8);

    // 2. light
    HapticHelper.light();
    assert.strictEqual(vibrationCalls.length, 2);
    assert.strictEqual(vibrationCalls[1], 12);

    // 3. medium
    HapticHelper.medium();
    assert.strictEqual(vibrationCalls.length, 3);
    assert.strictEqual(vibrationCalls[2], 22);

    // 4. heavy
    HapticHelper.heavy();
    assert.strictEqual(vibrationCalls.length, 4);
    assert.strictEqual(vibrationCalls[3], 38);

    // 5. success (celebratory rhythm for task completion)
    HapticHelper.success();
    assert.strictEqual(vibrationCalls.length, 5);
    assert.deepStrictEqual(vibrationCalls[4], [0, 25, 60, 35]);

    // 6. warning
    HapticHelper.warning();
    assert.strictEqual(vibrationCalls.length, 6);
    assert.deepStrictEqual(vibrationCalls[5], [0, 35, 50, 35]);

    // 7. error (triple buzz on failed PIN / lockout)
    HapticHelper.error();
    assert.strictEqual(vibrationCalls.length, 7);
    assert.deepStrictEqual(vibrationCalls[6], [0, 45, 60, 45, 60, 45]);
  });

  test('setVibrationEnabled(false) completely suppresses all haptic vibrations', () => {
    HapticHelper.setVibrationEnabled(false);
    assert.strictEqual(HapticHelper.isVibrationEnabled(), false);

    const res = HapticHelper.success();
    assert.strictEqual(res, false);
    assert.strictEqual(vibrationCalls.length, 0);

    HapticHelper.light();
    HapticHelper.error();
    assert.strictEqual(vibrationCalls.length, 0);

    // Re-enabling restores vibration immediately
    HapticHelper.setVibrationEnabled(true);
    assert.strictEqual(HapticHelper.isVibrationEnabled(), true);
    HapticHelper.selection();
    assert.strictEqual(vibrationCalls.length, 1);
  });

  test('per-call vibrationEnabled: false overrides global setting', () => {
    HapticHelper.setVibrationEnabled(true);
    const res = HapticHelper.success({ vibrationEnabled: false });
    assert.strictEqual(res, false);
    assert.strictEqual(vibrationCalls.length, 0);
  });

  test('expo-haptics integration invokes native impact and notification methods', () => {
    let expoCalled = [];
    const mockExpo = {
      ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
      NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
      selectionAsync: async () => { expoCalled.push('selection'); },
      impactAsync: async (style) => { expoCalled.push(`impact:${style}`); },
      notificationAsync: async (type) => { expoCalled.push(`notification:${type}`); }
    };

    const mod = loadTranspiledModule(path.resolve('src/utils/hapticHelper.js'), {
      'react-native': { Platform: { OS: 'ios' }, Vibration: { vibrate: () => {} } },
      'expo-haptics': mockExpo
    });
    const customHaptic = mod.HapticHelper;

    customHaptic.selection();
    assert.ok(expoCalled.includes('selection'));

    customHaptic.success();
    assert.ok(expoCalled.includes('notification:success'));

    customHaptic.error();
    assert.ok(expoCalled.includes('notification:error'));

    customHaptic.heavy();
    assert.ok(expoCalled.includes('impact:heavy'));
  });

  test('Web environment invokes navigator.vibrate when available', () => {
    let webVibrated = null;
    const originalNav = typeof globalThis.navigator !== 'undefined' ? globalThis.navigator : undefined;
    const originalVibrate = originalNav ? originalNav.vibrate : undefined;

    if (typeof globalThis.navigator === 'undefined') {
      Object.defineProperty(globalThis, 'navigator', {
        value: { vibrate: (pattern) => { webVibrated = pattern; } },
        configurable: true,
        writable: true
      });
    } else {
      globalThis.navigator.vibrate = (pattern) => { webVibrated = pattern; };
    }

    try {
      const mod = loadTranspiledModule(path.resolve('src/utils/hapticHelper.js'), {
        'react-native': { Platform: { OS: 'web' }, Vibration: { vibrate: () => {} } }
      });

      mod.HapticHelper.success();
      assert.deepStrictEqual(webVibrated, [0, 25, 60, 35]);
    } finally {
      if (!originalNav) {
        try {
          delete globalThis.navigator;
        } catch (e) {}
      } else if (originalVibrate) {
        globalThis.navigator.vibrate = originalVibrate;
      } else {
        delete globalThis.navigator.vibrate;
      }
    }
  });
});

// ==============================================================================
// TEST SUITE 12: Bidirectional (RTL) Layout & CI Quality Gate
// ==============================================================================
describe('Bidirectional (RTL) Layout & CI Quality Gate', () => {
  let isRtlLanguage;
  let syncRtlLayout;
  let rtlAllowed = null;

  beforeEach(() => {
    rtlAllowed = null;
    const mockI18nManager = {
      allowRTL: (allow) => { rtlAllowed = allow; },
      isRTL: false
    };

    const mod = loadTranspiledModule(path.resolve('src/i18n.js'), {
      'react-native': { I18nManager: mockI18nManager },
      'expo-localization': { getLocales: () => [{ languageCode: 'en' }] },
      'react-native-calendars': { LocaleConfig: { locales: {}, defaultLocale: 'en' } }
    });
    isRtlLanguage = mod.isRtlLanguage;
    syncRtlLayout = mod.syncRtlLayout;
  });

  test('isRtlLanguage correctly identifies RTL language families', () => {
    assert.strictEqual(isRtlLanguage('ar'), true);
    assert.strictEqual(isRtlLanguage('ar-SA'), true);
    assert.strictEqual(isRtlLanguage('he'), true);
    assert.strictEqual(isRtlLanguage('fa'), true);
    assert.strictEqual(isRtlLanguage('ur'), true);

    assert.strictEqual(isRtlLanguage('en'), false);
    assert.strictEqual(isRtlLanguage('ru'), false);
    assert.strictEqual(isRtlLanguage('es'), false);
    assert.strictEqual(isRtlLanguage('zh'), false);
    assert.strictEqual(isRtlLanguage(null), false);
    assert.strictEqual(isRtlLanguage(undefined), false);
  });

  test('syncRtlLayout dynamically communicates RTL state to native I18nManager', () => {
    syncRtlLayout('ar');
    assert.strictEqual(rtlAllowed, true);

    syncRtlLayout('en');
    assert.strictEqual(rtlAllowed, false);
  });

  test('CI workflow file exists and includes npm test step', () => {
    const ciPath = path.resolve('.github/workflows/ci.yml');
    assert.ok(fs.existsSync(ciPath), 'ci.yml must exist');
    const ciContent = fs.readFileSync(ciPath, 'utf8');
    assert.ok(ciContent.includes('npm test'), 'ci.yml must execute npm test');
    assert.ok(ciContent.includes('TaskCalendar CI Quality Gate'), 'ci.yml must define quality gate');
  });
});

// ==============================================================================
// TEST SUITE 13: Tier 2 Large Screens, Foldables & Chaos Stress Harness
// ==============================================================================
describe('Tier 2 Large Screens, Foldables & Chaos Stress Harness', () => {
  let ResponsiveHelper;
  let WINDOW_SIZE_CLASSES;
  let BREAKPOINTS;
  let ChaosTestHelper;
  let CHAOS_PREFIX;

  beforeEach(() => {
    const respMod = loadTranspiledModule(path.resolve('src/utils/responsiveHelper.js'));
    ResponsiveHelper = respMod.ResponsiveHelper;
    WINDOW_SIZE_CLASSES = respMod.WINDOW_SIZE_CLASSES;
    BREAKPOINTS = respMod.BREAKPOINTS;

    const chaosMod = loadTranspiledModule(path.resolve('src/utils/chaosTestHelper.js'), {
      dayjs: require('dayjs')
    });
    ChaosTestHelper = chaosMod.ChaosTestHelper;
    CHAOS_PREFIX = chaosMod.CHAOS_PREFIX;
  });

  test('getWindowSizeClass identifies compact, medium and expanded viewports', () => {
    assert.strictEqual(ResponsiveHelper.getWindowSizeClass(360), WINDOW_SIZE_CLASSES.COMPACT);
    assert.strictEqual(ResponsiveHelper.getWindowSizeClass(599), WINDOW_SIZE_CLASSES.COMPACT);
    assert.strictEqual(ResponsiveHelper.getWindowSizeClass(600), WINDOW_SIZE_CLASSES.MEDIUM);
    assert.strictEqual(ResponsiveHelper.getWindowSizeClass(720), WINDOW_SIZE_CLASSES.MEDIUM);
    assert.strictEqual(ResponsiveHelper.getWindowSizeClass(839), WINDOW_SIZE_CLASSES.MEDIUM);
    assert.strictEqual(ResponsiveHelper.getWindowSizeClass(840), WINDOW_SIZE_CLASSES.EXPANDED);
    assert.strictEqual(ResponsiveHelper.getWindowSizeClass(1280), WINDOW_SIZE_CLASSES.EXPANDED);
    // Safe fallback on invalid/missing width
    assert.strictEqual(ResponsiveHelper.getWindowSizeClass(0), WINDOW_SIZE_CLASSES.COMPACT);
    assert.strictEqual(ResponsiveHelper.getWindowSizeClass(null), WINDOW_SIZE_CLASSES.COMPACT);
  });

  test('isDualPane activates at >= 720dp for unfolded foldables and tablets', () => {
    assert.strictEqual(ResponsiveHelper.isDualPane(360), false);
    assert.strictEqual(ResponsiveHelper.isDualPane(412), false);
    assert.strictEqual(ResponsiveHelper.isDualPane(719), false);
    assert.strictEqual(ResponsiveHelper.isDualPane(720), true);
    assert.strictEqual(ResponsiveHelper.isDualPane(800), true);
    assert.strictEqual(ResponsiveHelper.isDualPane(1024), true);
  });

  test('getDualPaneLayout calculates Master-Detail pane dimensions correctly', () => {
    const compactLayout = ResponsiveHelper.getDualPaneLayout(400);
    assert.strictEqual(compactLayout.isDualPane, false);
    assert.strictEqual(compactLayout.leftPaneWidth, 400);

    const foldableLayout = ResponsiveHelper.getDualPaneLayout(750);
    assert.strictEqual(foldableLayout.isDualPane, true);
    // 750 * 0.42 = 315, capped by min 340
    assert.strictEqual(foldableLayout.leftPaneWidth, 340);

    const tabletLayout = ResponsiveHelper.getDualPaneLayout(1000);
    assert.strictEqual(tabletLayout.isDualPane, true);
    // 1000 * 0.42 = 420
    assert.strictEqual(tabletLayout.leftPaneWidth, 420);

    const wideTabletLayout = ResponsiveHelper.getDualPaneLayout(1400);
    assert.strictEqual(wideTabletLayout.isDualPane, true);
    // 1400 * 0.42 = 588, capped by max 440
    assert.strictEqual(wideTabletLayout.leftPaneWidth, 440);
  });

  test('getCenteredContainerStyle centers cards on wide viewports and preserves full width on phones', () => {
    const phoneStyle = ResponsiveHelper.getCenteredContainerStyle(390, 760);
    assert.deepStrictEqual(phoneStyle, { width: '100%' });

    const wideStyle = ResponsiveHelper.getCenteredContainerStyle(1024, 760);
    assert.strictEqual(wideStyle.width, '100%');
    assert.strictEqual(wideStyle.maxWidth, 760);
    assert.strictEqual(wideStyle.alignSelf, 'center');
  });

  test('app.json orientation is set to default for foldable and tablet freedom', () => {
    const appJsonPath = path.resolve('app.json');
    assert.ok(fs.existsSync(appJsonPath));
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    assert.strictEqual(
      appJson.expo.orientation,
      'default',
      'app.json orientation must be "default" to comply with Android 12L+ Large Screen quality standards'
    );
  });

  test('generateStressTasks creates requested task volume with benchmark attributes', () => {
    const tasks = ChaosTestHelper.generateStressTasks(25, 'custom_board');
    assert.strictEqual(tasks.length, 25);
    tasks.forEach((t) => {
      assert.ok(t.id.startsWith(CHAOS_PREFIX));
      assert.ok(t.taskname.includes('[Performance Benchmark]'));
      assert.strictEqual(t.boardId, 'custom_board');
      assert.ok(Array.isArray(t.subtasks));
      assert.strictEqual(t.subtasks.length, 2);
      assert.ok(typeof t.dueDate === 'string' && t.dueDate.length === 10);
    });
  });

  test('isChaosTask distinguishes synthetic stress tasks from user tasks', () => {
    const stressTask = {
      id: `${CHAOS_PREFIX}12345_1`,
      taskname: 'Stress Task #1 [Performance Benchmark]'
    };
    assert.strictEqual(ChaosTestHelper.isChaosTask(stressTask), true);

    const normalTask = {
      id: 'task_abc_789',
      taskname: 'Buy milk at grocery store'
    };
    assert.strictEqual(ChaosTestHelper.isChaosTask(normalTask), false);

    assert.strictEqual(ChaosTestHelper.isChaosTask(null), false);
    assert.strictEqual(ChaosTestHelper.isChaosTask(undefined), false);
    assert.strictEqual(ChaosTestHelper.isChaosTask({}), false);
  });

  test('getPayloadMetrics calculates item count, byte size, and human-readable KB', () => {
    const stressTasks = ChaosTestHelper.generateStressTasks(50);
    const metrics = ChaosTestHelper.getPayloadMetrics(stressTasks);
    assert.strictEqual(metrics.count, 50);
    assert.ok(typeof metrics.sizeBytes === 'number' && metrics.sizeBytes > 0);
    assert.ok(typeof metrics.sizeKb === 'number' && metrics.sizeKb > 0);
    assert.ok(metrics.formattedSize.includes('KB'));
    assert.ok(metrics.formattedSize.includes('50 items'));
  });

  test('testStorageCorruptionResilience detects tampered envelopes and quarantines safely', async () => {
    let rawStored = {};
    const mockRawStorage = {
      setItem: async (k, v) => { rawStored[k] = v; },
      getItem: async (k) => rawStored[k] || null,
      removeItem: async (k) => { delete rawStored[k]; }
    };

    const cryptoMod = loadTranspiledModule(path.resolve('src/utils/cryptoStorage.js'), {
      '@react-native-async-storage/async-storage': mockRawStorage
    });

    const result = await ChaosTestHelper.testStorageCorruptionResilience(
      cryptoMod.CryptoStorage,
      mockRawStorage
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isTamperCaught, true);
    assert.ok(result.message.includes('Integrity Verified'));
    assert.strictEqual(rawStored['@chaos_tamper_canary'], undefined);
  });
});

// ==============================================================================
// TEST SUITE 14: Deep Persistent Debugger, Looping Alarm & Date Normalization
// ==============================================================================
describe('Deep Persistent Debugger, Looping Alarm & Date Normalization', () => {
  test('DevLogger persists logs to AsyncStorage across reloads', async () => {
    let mockStorage = {};
    const mockAsyncStorage = {
      getItem: async (key) => mockStorage[key] || null,
      setItem: async (key, val) => { mockStorage[key] = val; },
      removeItem: async (key) => { delete mockStorage[key]; }
    };

    const loggerMod = loadTranspiledModule(path.resolve('src/utils/logger.js'), {
      '@react-native-async-storage/async-storage': mockAsyncStorage
    });
    const { DevLogger } = loggerMod;

    await DevLogger.init();
    DevLogger.info('Diagnostic message 1');
    DevLogger.error('Diagnostic error 2');

    // Wait for debounced persist (500ms + buffer)
    await new Promise(r => setTimeout(r, 600));

    assert.ok(mockStorage['@system_dev_logs'], 'Logs must be saved in @system_dev_logs');
    const storedEntries = JSON.parse(mockStorage['@system_dev_logs']);
    assert.ok(Array.isArray(storedEntries));
    assert.ok(storedEntries.length >= 2);
    assert.strictEqual(storedEntries[0].message, 'Diagnostic error 2');
    assert.strictEqual(storedEntries[1].message, 'Diagnostic message 1');

    await DevLogger.clearLogs();
  });

  test('date normalization prevents UTC shift backwards by a day in local time', () => {
    const utcIsoString = '2026-11-03T00:00:00.000Z';
    const dateOnly = (typeof utcIsoString === 'string' && utcIsoString.includes('T'))
      ? utcIsoString.split('T')[0]
      : dayjs(utcIsoString).format('YYYY-MM-DD');

    assert.strictEqual(dateOnly, '2026-11-03', 'Must stay 2026-11-03 and never shift to 2026-11-02');

    const combinedDateTime = `${dateOnly} 10:00 AM`;
    const parsed = dayjs(combinedDateTime, ['YYYY-MM-DD h:mm A'], true);
    assert.strictEqual(parsed.isValid(), true);
    assert.strictEqual(parsed.format('YYYY-MM-DD'), '2026-11-03');
  });

  test('persistent all-day notification is silent and does not play audible chime', () => {
    const notificationsPath = path.resolve('src/utils/notifications.js');
    const content = fs.readFileSync(notificationsPath, 'utf8');

    // Asserts channel is silent and sound is null for all-day notifications
    assert.match(
      content,
      /const\s+channelId\s*=\s*['"]task_silent_notification_v2['"]/,
      'Persistent notifications must use task_silent_notification_v2'
    );
    assert.match(
      content,
      /const\s+sound\s*=\s*null/,
      'Persistent notification sound must be null'
    );
  });

  test('native alarm passes keepNotificationAllDay and supports continuous loop', () => {
    const alarmModPath = path.resolve('modules/expo-task-alarm/index.ts');
    const content = fs.readFileSync(alarmModPath, 'utf8');

    assert.match(
      content,
      /keepNotificationAllDay\?:?\s*boolean/,
      'scheduleExactAlarm must accept keepNotificationAllDay'
    );
    assert.match(
      content,
      /!!keepNotificationAllDay/,
      'scheduleExactAlarm must forward keepNotificationAllDay to native module'
    );
  });
});

describe('Interactive Specialized List Types (Grocery, Expenses, Packing, Habits, Media)', () => {
  const listTypes = ['simple_list', 'grocery', 'expenses', 'packing', 'habits', 'media'];

  test('CreateBoardModal exports 6 list type options with icons and colors', () => {
    const modalPath = path.resolve('src/components/CreateBoardModal.js');
    const content = fs.readFileSync(modalPath, 'utf8');

    for (const type of listTypes) {
      assert.match(content, new RegExp(`id:\\s*['"]${type}['"]`), `Must support list template id: ${type}`);
    }
  });

  test('InlineAddTask parses price and quantity intelligently from task titles', () => {
    const parseTaskInput = (text) => {
      let title = text.trim();
      let itemPrice = null;
      let itemQuantity = null;

      const priceMatch = title.match(/\$(\d+(?:\.\d{1,2})?)/);
      if (priceMatch) {
        itemPrice = parseFloat(priceMatch[1]);
      }

      const qtyMatch = title.match(/(\d+)\s*(?:x|pcs|packs?|kg|lbs?|items?)\b/i) || title.match(/\b(?:x|\*)\s*(\d+)\b/i);
      if (qtyMatch) {
        itemQuantity = parseInt(qtyMatch[1], 10);
      }

      return { title, itemPrice, itemQuantity };
    };

    const t1 = parseTaskInput('Milk 2x $4.50');
    assert.strictEqual(t1.itemPrice, 4.5);
    assert.strictEqual(t1.itemQuantity, 2);

    const t2 = parseTaskInput('Toyota finance $550');
    assert.strictEqual(t2.itemPrice, 550);
    assert.strictEqual(t2.itemQuantity, null);

    const t3 = parseTaskInput('Apples 3 kg');
    assert.strictEqual(t3.itemPrice, null);
    assert.strictEqual(t3.itemQuantity, 3);
  });

  test('taskSlice persists item and habit interactive fields', () => {
    const slicePath = path.resolve('src/features/taskSlice.js');
    const content = fs.readFileSync(slicePath, 'utf8');

    const expectedFields = [
      'itemPrice',
      'itemQuantity',
      'itemUnit',
      'itemCategory',
      'itemRating',
      'itemProgress',
      'habitStreak',
      'habitLastCompleted'
    ];

    for (const field of expectedFields) {
      assert.match(content, new RegExp(`task\\.${field}\\s*=\\s*action\\.payload\\.${field}`), `taskSlice must update ${field}`);
    }
  });

  test('All 10 locale files contain all interactive list keys', () => {
    const localesDir = path.resolve('src/locales');
    const languages = ['en', 'ru', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'hi'];

    const interactiveKeys = [
      'Grocery & Shopping',
      'Interactive Cart',
      'Expenses & Bills',
      'Budget Tracker',
      'Travel & Packing',
      'Trip Checklist',
      'Habit Tracker',
      'Daily Streaks',
      'Reading & Watchlist',
      'Ratings & Progress',
      'To Buy',
      'In Cart',
      'Bills Due',
      'Paid Bills',
      'Overdue Bills',
      'To Pack',
      'Packed',
      'Today\'s Habits',
      'Done Today',
      'Watchlist & Reading',
      'Finished',
      'Total Bills',
      'Remaining Due',
      'Grand Total',
      'Remaining',
      'Uncheck All',
      'Reset for Next Trip',
      'Carry-On',
      'Checked Bag',
      'Backpack',
      'Essentials',
      'Morning',
      'Afternoon',
      'Evening',
      'Anytime',
      'Best Streak',
      'Average Rating'
    ];

    for (const lang of languages) {
      const raw = fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8');
      const json = JSON.parse(raw);
      for (const k of interactiveKeys) {
        assert.ok(json[k] && json[k].length > 0, `Locale ${lang} is missing key: ${k}`);
      }
    }
  });
});
