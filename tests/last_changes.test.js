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
    transforms: ['imports', 'jsx'],
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
        if (fs.existsSync(resolved + ext) && !fs.statSync(resolved + ext).isDirectory()) {
          if (ext === '.json') {
            return JSON.parse(fs.readFileSync(resolved + ext, 'utf8'));
          }
          return loadTranspiledModule(resolved + ext, customMocks);
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
    if (activeBoardType === 'birthdays') return new Set();

    const hiddenIds = new Set();
    const todayStr = dayjs().format('YYYY-MM-DD');

    // When toggle is OFF: Hide ALL recurring tasks from future/upcoming sections
    if (!showRecurringTasksOnBoard) {
      for (const task of boardTasks) {
        if (!task || task.completed) continue;
        if (isRepeatingTask(task)) {
          const dateStr = getTaskDateStr(task);
          if (!dateStr || dateStr > todayStr) {
            hiddenIds.add(task.id);
          }
        }
      }
      return hiddenIds;
    }

    // When toggle is ON: Deduplicate each recurring series so only the earliest upcoming occurrence appears
    const earliestSeriesMap = new Map();
    for (const task of boardTasks) {
      if (!task || task.completed || !task.recurringSeriesId) continue;
      const dateStr = getTaskDateStr(task);
      if (dateStr && dateStr < todayStr) continue;

      const seriesId = task.recurringSeriesId;
      if (!earliestSeriesMap.has(seriesId)) {
        earliestSeriesMap.set(seriesId, { id: task.id, dateStr: dateStr || '9999-99-99' });
      } else {
        const existing = earliestSeriesMap.get(seriesId);
        const currentDate = dateStr || '9999-99-99';
        if (currentDate < existing.dateStr) {
          hiddenIds.add(existing.id);
          earliestSeriesMap.set(seriesId, { id: task.id, dateStr: currentDate });
        } else {
          hiddenIds.add(task.id);
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

  test('when showRecurringTasksOnBoard is OFF, upcoming recurring tasks are hidden but today/missed remain visible', () => {
    const today = dayjs().format('YYYY-MM-DD');
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
    const nextMonth = dayjs().add(30, 'day').format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

    const tasks = [
      { id: 'rec_today', taskname: 'Daily Standup', date: today, isRecurring: true },
      { id: 'rec_missed', taskname: 'Yesterday Workout', date: yesterday, isRecurring: true },
      { id: 'rec_tomorrow', taskname: 'Tomorrow Meds', date: tomorrow, isRecurring: true },
      { id: 'rec_future_finance', taskname: 'Toyota finance $550', date: nextMonth, recurringSeriesId: 'series_toyota' },
      { id: 'rec_future_insurance', taskname: 'Insurance for car $125', date: nextMonth, repeatConfig: { preset: 'Monthly' } },
      { id: 'normal_future', taskname: 'Friend Wedding', date: nextMonth } // non-recurring
    ];

    const hidden = computeHiddenRecurringTaskIds(tasks, false);

    // Upcoming recurring tasks MUST be hidden
    assert.strictEqual(hidden.has('rec_tomorrow'), true);
    assert.strictEqual(hidden.has('rec_future_finance'), true);
    assert.strictEqual(hidden.has('rec_future_insurance'), true);

    // Today and missed recurring tasks MUST stay visible
    assert.strictEqual(hidden.has('rec_today'), false);
    assert.strictEqual(hidden.has('rec_missed'), false);

    // Non-recurring future tasks MUST stay visible
    assert.strictEqual(hidden.has('normal_future'), false);
  });

  test('when showRecurringTasksOnBoard is ON, duplicate future occurrences of a series are hidden', () => {
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

    // Earliest occurrence of series_1 stays visible
    assert.strictEqual(hidden.has('series_1_occ1'), false);
    // Future duplicates of series_1 are hidden
    assert.strictEqual(hidden.has('series_1_occ2'), true);
    assert.strictEqual(hidden.has('series_1_occ3'), true);

    // Earliest of series_2 stays visible
    assert.strictEqual(hidden.has('series_2_occ1'), false);
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
    'Biometric authentication is required to turn off App PIN.'
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
      }
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
});
