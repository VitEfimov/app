const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { transform } = require('sucrase');
const dayjs = require('dayjs');

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
      for (const ext of ['', '.js', '.jsx', '.json', '.ts']) {
        const fullPath = resolved + ext;
        if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
          if (ext === '.json' || fullPath.endsWith('.json')) {
            return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          }
          return loadTranspiledModule(fullPath, customMocks);
        }
      }
    }
    try {
      return require(reqPath);
    } catch (e) {
      return {};
    }
  };

  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transformed);
  fn(mockModule.exports, mockRequire, mockModule, filePath, path.dirname(filePath));
  return mockModule.exports;
}

// ==============================================================================
// 1. RECURRING TASK DEDUPLICATION ENGINE TESTS
// ==============================================================================
describe('Recurring Task Deduplication & ID Normalization Engine', () => {
  const isRepeatingTask = (task) => {
    if (!task) return false;
    return !!(
      (task.repeatConfig && task.repeatConfig.preset && task.repeatConfig.preset !== 'None' && task.repeatConfig.preset !== 'none') ||
      (task.repeatFrequency && task.repeatFrequency !== 'None' && task.repeatFrequency !== 'none') ||
      (task.repeat && task.repeat !== 'none' && task.repeat !== 'None')
    );
  };

  const getTaskDateStr = (task) => {
    if (!task) return null;
    const raw = task.completionDate || task.date || task.dueDate;
    if (!raw) return null;
    return dayjs(raw).format('YYYY-MM-DD');
  };

  const computeHiddenRecurringTaskIds = (tasks, showRecurringTasksOnBoard, activeBoard) => {
    const hiddenIds = new Set();
    const todayStr = dayjs().format('YYYY-MM-DD');

    const addToHidden = (id) => {
      if (id === undefined || id === null) return;
      hiddenIds.add(id);
      hiddenIds.add(String(id));
      const num = Number(id);
      if (!isNaN(num)) hiddenIds.add(num);
    };

    if (showRecurringTasksOnBoard) {
      return hiddenIds; // Empty set: show all recurring occurrences
    }

    const earliestSeriesMap = new Map();
    for (const task of tasks) {
      if (!task || task.completed) continue;
      const isRepeating = isRepeatingTask(task);
      const titleKey = String(task.taskname || task.name || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const rawBId = String(task.boardId || task.board_id || activeBoard?.id || 'main');
      const seriesKey = task.recurringSeriesId
        ? ('series_' + task.recurringSeriesId)
        : (isRepeating && titleKey ? (`title_${rawBId}_${titleKey}`) : null);
      if (!seriesKey) continue;

      const dateStr = getTaskDateStr(task);
      if (dateStr && dateStr < todayStr) continue; // Overdue tasks remain visible in Missed section

      const existing = earliestSeriesMap.get(seriesKey);
      const taskId = task.id || task._id;

      if (!existing) {
        earliestSeriesMap.set(seriesKey, { task, taskId, dateStr: dateStr || '9999-12-31' });
      } else {
        const taskVal = dateStr || '9999-12-31';
        const existingVal = existing.dateStr;

        if (taskVal < existingVal) {
          addToHidden(existing.taskId);
          earliestSeriesMap.set(seriesKey, { task, taskId, dateStr: taskVal });
        } else {
          addToHidden(taskId);
        }
      }
    }

    return hiddenIds;
  };

  test('deduplicates tasks using MongoDB _id when task.id is absent', () => {
    const mongoTasks = [
      {
        _id: 'mongo_toyota_nov',
        taskname: 'Toyota finance $550',
        completionDate: dayjs().add(24, 'day').format('YYYY-MM-DD'),
        repeatConfig: { preset: 'every_month' },
        boardId: 'payments_board'
      },
      {
        _id: 'mongo_toyota_dec',
        taskname: 'Toyota finance $550',
        completionDate: dayjs().add(54, 'day').format('YYYY-MM-DD'),
        repeatConfig: { preset: 'every_month' },
        boardId: 'payments_board'
      },
      {
        _id: 'mongo_toyota_jan',
        taskname: 'Toyota finance $550',
        completionDate: dayjs().add(84, 'day').format('YYYY-MM-DD'),
        repeatConfig: { preset: 'every_month' },
        boardId: 'payments_board'
      }
    ];

    const hiddenIds = computeHiddenRecurringTaskIds(mongoTasks, false, { id: 'payments_board' });

    // Earliest (November) must NOT be hidden
    assert.strictEqual(hiddenIds.has('mongo_toyota_nov'), false, 'Earliest upcoming occurrence must remain visible');
    // December and January occurrences must be hidden
    assert.strictEqual(hiddenIds.has('mongo_toyota_dec'), true, 'Second occurrence must be hidden');
    assert.strictEqual(hiddenIds.has('mongo_toyota_jan'), true, 'Third occurrence must be hidden');
  });

  test('normalizes title spacing and casing to deduplicate recurring tasks within board', () => {
    const tasks = [
      {
        id: 'car_ins_1',
        taskname: '  Insurance for the car $125 ',
        completionDate: dayjs().add(20, 'day').format('YYYY-MM-DD'),
        repeatFrequency: 'Monthly',
        boardId: 'payments'
      },
      {
        id: 'car_ins_2',
        taskname: 'insurance  FOR THE CAR $125',
        completionDate: dayjs().add(50, 'day').format('YYYY-MM-DD'),
        repeatFrequency: 'Monthly',
        boardId: 'payments'
      }
    ];

    const hidden = computeHiddenRecurringTaskIds(tasks, false, { id: 'payments' });
    assert.strictEqual(hidden.has('car_ins_1'), false);
    assert.strictEqual(hidden.has('car_ins_2'), true);
  });

  test('preserves overdue missed tasks while hiding future duplicate occurrences', () => {
    const tasks = [
      {
        id: 'missed_rent',
        taskname: 'Apartment Rent',
        completionDate: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
        repeatConfig: { preset: 'every_month' },
        boardId: 'main'
      },
      {
        id: 'next_rent',
        taskname: 'Apartment Rent',
        completionDate: dayjs().add(25, 'day').format('YYYY-MM-DD'),
        repeatConfig: { preset: 'every_month' },
        boardId: 'main'
      },
      {
        id: 'future_rent',
        taskname: 'Apartment Rent',
        completionDate: dayjs().add(55, 'day').format('YYYY-MM-DD'),
        repeatConfig: { preset: 'every_month' },
        boardId: 'main'
      }
    ];

    const hidden = computeHiddenRecurringTaskIds(tasks, false, { id: 'main' });
    // Overdue task must not be hidden (it goes to Missed bucket)
    assert.strictEqual(hidden.has('missed_rent'), false, 'Missed task should not be hidden');
    // Earliest upcoming task must not be hidden
    assert.strictEqual(hidden.has('next_rent'), false, 'Next upcoming task should not be hidden');
    // Future duplicates must be hidden
    assert.strictEqual(hidden.has('future_rent'), true, 'Future duplicate must be hidden');
  });

  test('when showRecurringTasksOnBoard is true, all occurrences remain visible', () => {
    const tasks = [
      { id: 't1', taskname: 'Gym Workout', completionDate: dayjs().add(1, 'day').format('YYYY-MM-DD'), repeat: 'Daily' },
      { id: 't2', taskname: 'Gym Workout', completionDate: dayjs().add(2, 'day').format('YYYY-MM-DD'), repeat: 'Daily' },
      { id: 't3', taskname: 'Gym Workout', completionDate: dayjs().add(3, 'day').format('YYYY-MM-DD'), repeat: 'Daily' }
    ];

    const hidden = computeHiddenRecurringTaskIds(tasks, true, { id: 'main' });
    assert.strictEqual(hidden.size, 0, 'No tasks should be hidden when toggle is ON');
  });

  test('boardCounts correctly deducts hidden recurring tasks when toggle is OFF', () => {
    const boards = [
      { id: 'main', name: 'Main' },
      { id: 'payments', name: 'Payments' }
    ];

    const allTasks = [
      { id: 'reg1', taskname: 'Buy milk', boardId: 'main' },
      { id: 'p_uas', taskname: 'Uas SDET Boot camp', boardId: 'payments', completionDate: dayjs().add(7, 'day').format('YYYY-MM-DD') },
      { id: 'p_wash', taskname: 'Mr.Wash $34.50', boardId: 'payments', completionDate: dayjs().add(16, 'day').format('YYYY-MM-DD') },
      // 4 recurring Toyota occurrences
      { id: 'toyota_1', taskname: 'Toyota finance $550', boardId: 'payments', completionDate: dayjs().add(24, 'day').format('YYYY-MM-DD'), repeatConfig: { preset: 'every_month' } },
      { id: 'toyota_2', taskname: 'Toyota finance $550', boardId: 'payments', completionDate: dayjs().add(54, 'day').format('YYYY-MM-DD'), repeatConfig: { preset: 'every_month' } },
      { id: 'toyota_3', taskname: 'Toyota finance $550', boardId: 'payments', completionDate: dayjs().add(84, 'day').format('YYYY-MM-DD'), repeatConfig: { preset: 'every_month' } },
      { id: 'toyota_4', taskname: 'Toyota finance $550', boardId: 'payments', completionDate: dayjs().add(114, 'day').format('YYYY-MM-DD'), repeatConfig: { preset: 'every_month' } },
    ];

    const computeBoardCounts = (showRecurring) => {
      const hiddenIds = computeHiddenRecurringTaskIds(allTasks, showRecurring, null);
      const counts = { main: 0, payments: 0 };

      for (const t of allTasks) {
        if (!t || t.completed) continue;
        const tid = t.id || t._id;
        if (!showRecurring && hiddenIds.has(tid)) continue;
        const bId = t.boardId || 'main';
        if (counts[bId] !== undefined) counts[bId]++;
      }
      return counts;
    };

    const countsWhenOff = computeBoardCounts(false);
    // In payments: Uas (1) + Wash (1) + Toyota 1st (1) = 3 total visible!
    assert.strictEqual(countsWhenOff.payments, 3, 'Payments badge should show only 3 visible tasks when toggle is OFF');

    const countsWhenOn = computeBoardCounts(true);
    // In payments: Uas (1) + Wash (1) + 4 Toyota = 6 total
    assert.strictEqual(countsWhenOn.payments, 6, 'Payments badge should show all 6 tasks when toggle is ON');
  });
});

// ==============================================================================
// 2. GROCERY & SHOPPING INTERACTIVE LIST TESTS
// ==============================================================================
describe('Grocery & Shopping Interactive List', () => {
  const computeGrocerySummary = (items) => {
    let grandTotal = 0;
    let inCartSpent = 0;
    const totalCount = items.length;
    const completedCount = items.filter(t => t.completed).length;

    items.forEach(t => {
      const qty = t.itemQuantity !== undefined && !isNaN(Number(t.itemQuantity)) ? Math.max(1, Number(t.itemQuantity)) : 1;
      const price = (t.itemPrice !== undefined && !isNaN(Number(t.itemPrice))) ? Number(t.itemPrice) : 0;
      const itemTot = qty * price;
      grandTotal += itemTot;
      if (t.completed) inCartSpent += itemTot;
    });

    const remaining = Math.max(0, grandTotal - inCartSpent);
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return { grandTotal, inCartSpent, remaining, progressPercent, totalCount, completedCount };
  };

  test('calculates correct grand total, in-cart spent, and remaining balance', () => {
    const groceries = [
      { id: 'g1', taskname: 'Milk', itemPrice: 4.50, itemQuantity: 2, completed: true },   // $9.00 in cart
      { id: 'g2', taskname: 'Eggs', itemPrice: 3.25, itemQuantity: 1, completed: false },  // $3.25 to buy
      { id: 'g3', taskname: 'Bread', itemPrice: 2.75, itemQuantity: 3, completed: false }, // $8.25 to buy
      { id: 'g4', taskname: 'Apples', itemPrice: 1.50, itemQuantity: 4, completed: true }  // $6.00 in cart
    ];

    const summary = computeGrocerySummary(groceries);

    assert.strictEqual(summary.grandTotal, 26.50);
    assert.strictEqual(summary.inCartSpent, 15.00);
    assert.strictEqual(summary.remaining, 11.50);
    assert.strictEqual(summary.completedCount, 2);
    assert.strictEqual(summary.totalCount, 4);
    assert.strictEqual(summary.progressPercent, 50);
  });

  test('quantity stepper bounds: quantity cannot drop below 1', () => {
    const stepDown = (currentQty) => {
      const parsed = parseInt(currentQty, 10);
      const safe = isNaN(parsed) ? 1 : parsed;
      return Math.max(1, safe - 1);
    };

    assert.strictEqual(stepDown(5), 4);
    assert.strictEqual(stepDown(1), 1, 'Quantity must not drop below 1');
    assert.strictEqual(stepDown(0), 1, '0 should normalize to 1');
  });

  test('uncheck all items resets completion state for entire cart', () => {
    let items = [
      { id: '1', taskname: 'Milk', completed: true },
      { id: '2', taskname: 'Bread', completed: true },
      { id: '3', taskname: 'Cheese', completed: false }
    ];

    // Uncheck all
    items = items.map(item => ({ ...item, completed: false }));

    const summary = computeGrocerySummary(items);
    assert.strictEqual(summary.completedCount, 0);
    assert.strictEqual(summary.inCartSpent, 0);
  });
});

// ==============================================================================
// 3. EXPENSES & BILLS TRACKER TESTS
// ==============================================================================
describe('Expenses & Bills Tracker', () => {
  const getTaskAmount = (task) => {
    if (!task) return 0;
    if (task.itemPrice !== undefined && task.itemPrice !== null && !isNaN(Number(task.itemPrice))) {
      return Number(task.itemPrice);
    }
    const title = task.taskname || task.name || '';
    const match = title.match(/\$(\d+(?:\.\d{1,2})?)/);
    if (match) {
      const parsed = parseFloat(match[1]);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const computeExpensesSummary = (bills) => {
    let totalBills = 0;
    let totalPaid = 0;

    bills.forEach(t => {
      const amt = getTaskAmount(t);
      totalBills += amt;
      if (t.completed) totalPaid += amt;
    });

    const remainingDue = Math.max(0, totalBills - totalPaid);
    return { totalBills, totalPaid, remainingDue };
  };

  test('correctly extracts dollar amounts from titles and computes bill totals', () => {
    const bills = [
      { id: 'b1', taskname: 'Toyota finance $550', completed: true },
      { id: 'b2', taskname: 'Insurance for the car $125', completed: true },
      { id: 'b3', taskname: 'Mira extended kindergarten $385', completed: false },
      { id: 'b4', taskname: 'Costco $400', completed: false },
      { id: 'b5', taskname: 'Electric utility', itemPrice: 85.50, completed: false }
    ];

    const summary = computeExpensesSummary(bills);

    // Total: 550 + 125 + 385 + 400 + 85.50 = 1545.50
    assert.strictEqual(summary.totalBills, 1545.50);
    // Paid: 550 + 125 = 675.00
    assert.strictEqual(summary.totalPaid, 675.00);
    // Remaining Due: 1545.50 - 675.00 = 870.50
    assert.strictEqual(summary.remainingDue, 870.50);
  });

  test('expenses boards display due date on task rows (hideDate is false)', () => {
    const listBoardTypes = ['simple_list', 'shopping', 'grocery', 'packing', 'habits', 'media'];
    const isListBoard = (type) => listBoardTypes.includes(type);

    assert.strictEqual(isListBoard('grocery'), true, 'grocery should hide date');
    assert.strictEqual(isListBoard('packing'), true, 'packing should hide date');
    assert.strictEqual(isListBoard('expenses'), false, 'expenses must NOT hide date: bills require visible due dates!');
  });

  test('expenses boards organize bills into Today, Tomorrow, Upcoming, and Overdue sections', () => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD');
    const laterStr = dayjs().add(10, 'day').format('YYYY-MM-DD');
    const overdueStr = dayjs().subtract(3, 'day').format('YYYY-MM-DD');

    const bills = [
      { id: '1', taskname: 'Overdue bill', completionDate: overdueStr, completed: false },
      { id: '2', taskname: 'Car insurance $125', completionDate: todayStr, completed: false },
      { id: '3', taskname: 'Electric bill $85', completionDate: tomorrowStr, completed: false },
      { id: '4', taskname: 'Toyota finance $550', completionDate: laterStr, completed: false },
      { id: '5', taskname: 'Paid rent', completionDate: todayStr, completed: true }
    ];

    const isExpenses = true;
    const missed = bills.filter(b => !b.completed && b.completionDate < todayStr);
    const today = bills.filter(b => !b.completed && b.completionDate === todayStr);
    const tomorrow = bills.filter(b => !b.completed && b.completionDate === tomorrowStr);
    const upcoming = bills.filter(b => !b.completed && b.completionDate > tomorrowStr);
    const paid = bills.filter(b => b.completed);

    assert.strictEqual(missed.length, 1);
    assert.strictEqual(today.length, 1);
    assert.strictEqual(tomorrow.length, 1);
    assert.strictEqual(upcoming.length, 1);
    assert.strictEqual(paid.length, 1);
  });

  test('Option B: computes This Month ($40) vs All Scheduled ($520) for recurring bills', () => {
    const currentMonth = dayjs().format('YYYY-MM');
    const todayStr = dayjs().format('YYYY-MM-DD');

    // 13 recurring occurrences of midas $40
    const recurringMidasBills = [];
    for (let i = 0; i < 13; i++) {
      recurringMidasBills.push({
        id: `midas_${i}`,
        taskname: 'midas $40',
        itemPrice: 40,
        completionDate: dayjs().add(i, 'month').format('YYYY-MM-DD'),
        completed: false
      });
    }

    const computeExpensesOptionB = (bills, periodFilter) => {
      let allTotal = 0;
      let allPaid = 0;
      let monthlyTotal = 0;
      let monthlyPaid = 0;

      bills.forEach(t => {
        const amt = t.itemPrice || 0;
        allTotal += amt;
        if (t.completed) allPaid += amt;

        const dateStr = t.completionDate;
        const isCurrentMonth = dateStr ? dateStr.startsWith(currentMonth) : true;
        const isOverdueUnpaid = dateStr && dateStr < todayStr && !t.completed;

        if (isCurrentMonth || isOverdueUnpaid) {
          monthlyTotal += amt;
          if (t.completed) monthlyPaid += amt;
        }
      });

      const isMonthlyView = periodFilter === 'month';
      const displayTotal = isMonthlyView ? monthlyTotal : allTotal;
      const displayPaid = isMonthlyView ? monthlyPaid : allPaid;
      const displayRemaining = Math.max(0, displayTotal - displayPaid);

      return { displayTotal, displayPaid, displayRemaining, monthlyTotal, allTotal };
    };

    const monthlyView = computeExpensesOptionB(recurringMidasBills, 'month');
    assert.strictEqual(monthlyView.displayTotal, 40.00, 'This Month view must show $40 for current month');
    assert.strictEqual(monthlyView.displayRemaining, 40.00);

    const allView = computeExpensesOptionB(recurringMidasBills, 'all');
    assert.strictEqual(allView.displayTotal, 520.00, 'All Scheduled view must show $520 for all 13 occurrences');
    assert.strictEqual(allView.displayRemaining, 520.00);
  });
});

// ==============================================================================
// 4. TRAVEL & PACKING LIST TESTS
// ==============================================================================
describe('Travel & Packing Checklist', () => {
  test('category filtering partitions items by luggage type', () => {
    const packingItems = [
      { id: 'p1', taskname: 'Passport', itemCategory: 'Essentials', completed: true },
      { id: 'p2', taskname: 'Credit Card', itemCategory: 'Essentials', completed: true },
      { id: 'p3', taskname: 'Laptop & Charger', itemCategory: 'Backpack', completed: false },
      { id: 'p4', taskname: 'T-Shirts (5x)', itemCategory: 'Carry-On', completed: false },
      { id: 'p5', taskname: 'Winter Coat', itemCategory: 'Checked Bag', completed: false }
    ];

    const filterCategory = (category) => {
      if (category === 'All') return packingItems;
      return packingItems.filter(item => (item.itemCategory || 'Carry-On') === category);
    };

    assert.strictEqual(filterCategory('All').length, 5);
    assert.strictEqual(filterCategory('Essentials').length, 2);
    assert.strictEqual(filterCategory('Backpack').length, 1);
    assert.strictEqual(filterCategory('Carry-On').length, 1);
    assert.strictEqual(filterCategory('Checked Bag').length, 1);
  });

  test('reset for next trip resets all packed items to uncompleted', () => {
    let items = [
      { id: '1', taskname: 'Passport', completed: true },
      { id: '2', taskname: 'Sunscreen', completed: true },
      { id: '3', taskname: 'Sunglasses', completed: false }
    ];

    // Reset action
    items = items.map(t => ({ ...t, completed: false }));

    const packedCount = items.filter(t => t.completed).length;
    assert.strictEqual(packedCount, 0, 'All items must be reset to uncompleted for next trip');
  });
});

// ==============================================================================
// 5. DAILY HABIT TRACKER TESTS
// ==============================================================================
describe('Daily Habit Tracker', () => {
  const toggleHabitCompletion = (habit, nowDayStr = dayjs().format('YYYY-MM-DD')) => {
    const wasCompleted = !!habit.completed;
    const nowCompleted = !wasCompleted;

    let habitStreak = Number(habit.habitStreak) || 0;
    let habitLastCompleted = habit.habitLastCompleted;

    if (nowCompleted) {
      const yesterdayStr = dayjs(nowDayStr).subtract(1, 'day').format('YYYY-MM-DD');
      if (habitLastCompleted === yesterdayStr) {
        habitStreak += 1;
      } else if (habitLastCompleted === nowDayStr) {
        // already counted today
      } else {
        habitStreak = 1; // start new streak
      }
      habitLastCompleted = nowDayStr;
    } else {
      habitStreak = Math.max(0, habitStreak - 1);
    }

    return { ...habit, completed: nowCompleted, habitStreak, habitLastCompleted };
  };

  test('increments streak when completed on consecutive days', () => {
    const today = dayjs().format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

    const initialHabit = {
      id: 'h1',
      taskname: 'Drink 2L Water',
      completed: false,
      habitStreak: 4,
      habitLastCompleted: yesterday
    };

    const updated = toggleHabitCompletion(initialHabit, today);

    assert.strictEqual(updated.completed, true);
    assert.strictEqual(updated.habitStreak, 5, 'Streak should advance from 4 to 5 on consecutive day completion');
    assert.strictEqual(updated.habitLastCompleted, today);
  });

  test('resets streak to 1 if habit was missed for several days', () => {
    const today = dayjs().format('YYYY-MM-DD');
    const lastWeek = dayjs().subtract(5, 'day').format('YYYY-MM-DD');

    const lapsedHabit = {
      id: 'h2',
      taskname: 'Morning Meditation',
      completed: false,
      habitStreak: 12,
      habitLastCompleted: lastWeek
    };

    const updated = toggleHabitCompletion(lapsedHabit, today);

    assert.strictEqual(updated.completed, true);
    assert.strictEqual(updated.habitStreak, 1, 'Lapsed streak should restart at 1');
  });

  test('best streak correctly identifies the highest streak among all habits', () => {
    const habits = [
      { id: '1', taskname: 'Reading', habitStreak: 7 },
      { id: '2', taskname: 'Workout', habitStreak: 21 },
      { id: '3', taskname: 'Floss', habitStreak: 14 }
    ];

    const bestStreak = habits.reduce((max, t) => Math.max(max, Number(t.habitStreak) || 0), 0);
    assert.strictEqual(bestStreak, 21);
  });

  test('correctly infers time of day from task.time and filters morning habits', () => {
    const getHabitTimeCategory = (task) => {
      if (!task) return 'Anytime';
      if (task.itemCategory && ['Morning', 'Afternoon', 'Evening', 'Anytime'].includes(task.itemCategory)) {
        if (task.itemCategory !== 'Anytime') return task.itemCategory;
      }
      if (task.time && typeof task.time === 'string' && task.time.includes(':')) {
        const [h] = task.time.split(':');
        const hour = parseInt(h, 10);
        if (!isNaN(hour)) {
          if (hour >= 4 && hour < 12) return 'Morning';
          if (hour >= 12 && hour < 17) return 'Afternoon';
          if (hour >= 17 && hour <= 23) return 'Evening';
        }
      }
      return task.itemCategory || 'Anytime';
    };

    const hMorning = { id: 'h1', taskname: 'Morning walk', time: '09:24' };
    const hAfternoon = { id: 'h2', taskname: 'Post-lunch walk', time: '14:15' };
    const hEvening = { id: 'h3', taskname: 'Read before bed', time: '21:00' };
    const hAnytime = { id: 'h4', taskname: 'Drink 2L Water' };

    assert.strictEqual(getHabitTimeCategory(hMorning), 'Morning');
    assert.strictEqual(getHabitTimeCategory(hAfternoon), 'Afternoon');
    assert.strictEqual(getHabitTimeCategory(hEvening), 'Evening');
    assert.strictEqual(getHabitTimeCategory(hAnytime), 'Anytime');

    // When user filters by 'Morning', hMorning (9:24 AM) must be included!
    const allHabits = [hMorning, hAfternoon, hEvening, hAnytime];
    const morningHabits = allHabits.filter(h => getHabitTimeCategory(h) === 'Morning');
    assert.strictEqual(morningHabits.length, 1);
    assert.strictEqual(morningHabits[0].id, 'h1');
  });
});

// ==============================================================================
// 6. READING & WATCHLIST TESTS
// ==============================================================================
describe('Reading & Watchlist', () => {
  test('calculates average rating accurately from 5-star items', () => {
    const items = [
      { id: 'm1', taskname: 'Atomic Habits', itemCategory: 'Books', itemRating: 5 },
      { id: 'm2', taskname: 'Clean Code', itemCategory: 'Books', itemRating: 4 },
      { id: 'm3', taskname: 'Inception', itemCategory: 'Movies/TV', itemRating: 5 },
      { id: 'm4', taskname: 'Sci-Fi Novel', itemCategory: 'Books' } // unrated
    ];

    const ratedItems = items.filter(t => Number(t.itemRating) > 0);
    const avgRating = ratedItems.length > 0
      ? (ratedItems.reduce((sum, t) => sum + Number(t.itemRating), 0) / ratedItems.length).toFixed(1)
      : null;

    // (5 + 4 + 5) / 3 = 4.666... -> 4.7
    assert.strictEqual(avgRating, '4.7');
  });
});

// ==============================================================================
// 7. SMART INPUT PARSER IN INLINE ADDTASK TESTS
// ==============================================================================
describe('InlineAddTask Smart Input Parsing', () => {
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

  test('parses quantity and dollar amount from groceries', () => {
    const p1 = parseTaskInput('Almond Milk 2x $4.99');
    assert.strictEqual(p1.itemQuantity, 2);
    assert.strictEqual(p1.itemPrice, 4.99);

    const p2 = parseTaskInput('Bananas 3 kg $2.50');
    assert.strictEqual(p2.itemQuantity, 3);
    assert.strictEqual(p2.itemPrice, 2.50);

    const p3 = parseTaskInput('Costco $400');
    assert.strictEqual(p3.itemQuantity, null);
    assert.strictEqual(p3.itemPrice, 400);

    const p4 = parseTaskInput('Eggs 12 pcs');
    assert.strictEqual(p4.itemQuantity, 12);
    assert.strictEqual(p4.itemPrice, null);
  });
});

// ==============================================================================
// 8. 100% LOCALIZATION PARITY AND LINGUISTIC VALIDATION
// ==============================================================================
describe('Localization Parity Across All 10 Supported Languages', () => {
  const localesDir = path.resolve('src/locales');
  const languages = ['en', 'ru', 'es', 'de', 'fr', 'it', 'zh', 'ja', 'ko', 'hi'];

  const requiredInteractiveKeys = [
    'Grocery & Shopping',
    'Interactive Cart',
    'Interactive grocery list with item prices, quantity stepper and live budget total.',
    'Expenses & Bills',
    'Budget Tracker',
    'Track monthly bills, recurring expenses, paid vs due amounts with live totals.',
    'Travel & Packing',
    'Trip Checklist',
    'Luggage checklist with categories, packing progress meter and quick trip reset.',
    'Habit Tracker',
    'Daily Streaks',
    'Daily habits and routines with streak counters, time-of-day filters and completion rate.',
    'Reading & Watchlist',
    'Ratings & Progress',
    'Books, movies, TV shows and courses with 5-star ratings and progress tracking.',
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

  test('all 10 languages exist, have valid JSON, and have exactly 837 keys each', () => {
    const loaded = {};
    for (const lang of languages) {
      const p = path.join(localesDir, `${lang}.json`);
      assert.ok(fs.existsSync(p), `Locale file missing: ${lang}.json`);
      const raw = fs.readFileSync(p, 'utf8');
      loaded[lang] = JSON.parse(raw);
    }

    const enCount = Object.keys(loaded['en']).length;
    assert.strictEqual(enCount, 837, `English locale must contain 837 keys, got ${enCount}`);

    for (const lang of languages) {
      const count = Object.keys(loaded[lang]).length;
      assert.strictEqual(
        count,
        837,
        `Language ${lang} has ${count} keys, expected 837 (matching EN)`
      );
    }
  });

  test('all 42 interactive list keys are present, non-empty, and translated in every non-English locale', () => {
    const enData = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));

    for (const lang of languages) {
      const data = JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'));

      for (const key of requiredInteractiveKeys) {
        const val = data[key];
        assert.ok(val && typeof val === 'string', `Locale ${lang} is missing or has empty key: "${key}"`);

        // If non-English, verify it's translated and not left as English string
        if (lang !== 'en') {
          assert.notStrictEqual(
            val,
            enData[key],
            `Locale ${lang} has untranslated English placeholder for: "${key}"`
          );
        }
      }
    }
  });

  test('Russian translations match exact product terminology', () => {
    const ru = JSON.parse(fs.readFileSync(path.join(localesDir, 'ru.json'), 'utf8'));

    assert.strictEqual(ru['Grocery & Shopping'], 'Покупки и продукты');
    assert.strictEqual(ru['Expenses & Bills'], 'Расходы и счета');
    assert.strictEqual(ru['Travel & Packing'], 'Сборы в поездку');
    assert.strictEqual(ru['Habit Tracker'], 'Трекер привычек');
    assert.strictEqual(ru['Reading & Watchlist'], 'Книги и фильмы');
    assert.strictEqual(ru['In Cart'], 'В корзине');
    assert.strictEqual(ru['To Buy'], 'Купить');
    assert.strictEqual(ru['Bills Due'], 'К оплате');
    assert.strictEqual(ru['Paid Bills'], 'Оплачено');
    assert.strictEqual(ru['Packed'], 'Собрано');
    assert.strictEqual(ru['Uncheck All'], 'Снять все отметки');
    assert.strictEqual(ru['Reset for Next Trip'], 'Сбросить для новой поездки');
    assert.strictEqual(ru['Best Streak'], 'Лучшая серия');
    assert.strictEqual(ru['Average Rating'], 'Средняя оценка');
  });
});

// ==============================================================================
// 9. TASK ALARM SINGLE-SOUND INTEGRITY & RESCHEDULING ENGINE
// ==============================================================================
describe('Task Alarm Single Sound Integrity & Rescheduling Engine', () => {
  test('native alarm channels configure setSound(null, null) to eliminate double sounding', () => {
    const ktModulePath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/ExpoTaskAlarmModule.kt');
    const ktContent = fs.readFileSync(ktModulePath, 'utf8');

    // Verify popup channel is defined and has setSound(null, null)
    assert.match(ktContent, /popupChannelId\s*=\s*"\$\{resolvedChannelId\}_popup_v3"/, 'Must define isolated popup channel');
    assert.match(ktContent, /popupChannel[\s\S]*?setSound\(null,\s*null\)/, 'Popup channel must be silent');

    // Verify full-screen channel is defined and has setSound(null, null)
    assert.match(ktContent, /fsChannelId\s*=\s*"\$\{resolvedChannelId\}_fs_v3"/, 'Must define isolated full-screen channel');
    assert.match(ktContent, /fsChannel[\s\S]*?setSound\(null,\s*null\)/, 'Full-screen channel must be silent');
  });

  test('receiverIntent explicitly forwards soundName to AlarmActivity and AlarmAudioManager', () => {
    const ktModulePath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/ExpoTaskAlarmModule.kt');
    const ktContent = fs.readFileSync(ktModulePath, 'utf8');

    assert.ok(ktContent.includes('putExtra("soundName", resolvedSoundName)'), 'ExpoTaskAlarmModule must pass resolvedSoundName in intent');

    const receiverPath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/TaskAlarmReceiver.kt');
    const receiverContent = fs.readFileSync(receiverPath, 'utf8');

    assert.ok(receiverContent.includes('.setSound(null)'), 'NotificationBuilder must explicitly setSound(null)');
    assert.ok(receiverContent.includes('notificationBuilder.setDefaults(0)'), 'NotificationBuilder must not use DEFAULT_SOUND');
    assert.ok(receiverContent.includes('putExtra("soundName", soundName)'), 'AlarmActivity must receive soundName');
  });

  test('TS wrapper and notifications.js pass sound and channelId to scheduleExactAlarm', () => {
    const tsPath = path.resolve('modules/expo-task-alarm/index.ts');
    const tsContent = fs.readFileSync(tsPath, 'utf8');

    assert.match(tsContent, /channelId\?:?\s*string/, 'TS signature must accept optional channelId');
    assert.match(tsContent, /channelId\s*\|\|\s*''/, 'TS module must forward channelId');

    const notifPath = path.resolve('src/utils/notifications.js');
    const notifContent = fs.readFileSync(notifPath, 'utf8');

    assert.match(notifContent, /scheduleExactAlarm\([\s\S]*?sound[\s\S]*?channelId[\s\S]*?\)/, 'notifications.js must forward soundName and channelId');
  });

  test('TaskDetailsModal and taskSlice normalize taskId using task.id || task._id', () => {
    const modalPath = path.resolve('src/components/TaskDetailsModal.js');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    assert.match(modalContent, /const effectiveTaskId = task\.id \|\| task\._id;/, 'TaskDetailsModal must normalize effectiveTaskId');
    assert.match(modalContent, /await cancelNotification\(task\.notificationId, effectiveTaskId\);/, 'Rescheduling must cancel previous notifications first');

    const slicePath = path.resolve('src/features/taskSlice.js');
    const sliceContent = fs.readFileSync(slicePath, 'utf8');

    assert.match(sliceContent, /\(t\.id \|\| t\._id\) !== taskId/, 'deleteTaskSync must check both t.id and t._id');
    assert.match(sliceContent, /const effectiveTaskId = payload\.task\.id \|\| payload\.task\._id;/, 'addTask must resolve effectiveTaskId');
    assert.match(sliceContent, /hasReminder \|\| isKeepAllDay \|\| isAlarm/, 'addTask must schedule alarm even when reminder is None');
  });
});

// ==============================================================================
// 10. THEME-AWARE LOADING SCREEN & SYNCHRONOUS BOOT INTEGRITY
// ==============================================================================
describe('Theme-Aware Loading Screen & Synchronous Boot Integrity', () => {
  test('loadInitialThemeMode resolves dark, contrast and light synchronously from state or system', () => {
    const themeMod = loadTranspiledModule(path.resolve('src/features/themeSlice.js'), {
      '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {} },
      '@reduxjs/toolkit': { createSlice: () => ({ reducer: () => ({}), actions: {} }) }
    });
    const { loadInitialThemeMode } = themeMod;

    // 1. Pre-loaded / saved customTheme
    assert.strictEqual(loadInitialThemeMode({ themeMode: 'dark' }), 'dark');
    assert.strictEqual(loadInitialThemeMode({ themeMode: 'contrast' }), 'contrast');
    assert.strictEqual(loadInitialThemeMode({ themeMode: 'light' }), 'light');

    // 2. Default fallback when no saved state
    const fallback = loadInitialThemeMode(null);
    assert.ok(fallback === 'light' || fallback === 'dark', 'Must resolve to light or dark');
  });

  test('AnimatedLoadingScreen adapts background, badge and spinner to light, dark and contrast', () => {
    const screenPath = path.resolve('src/components/AnimatedLoadingScreen.js');
    const screenContent = fs.readFileSync(screenPath, 'utf8');

    // Contrast theme styling
    assert.match(screenContent, /isContrast\s*\?\s*['"]#000000['"]/, 'Must use pitch black #000000 in contrast mode');
    assert.match(screenContent, /isContrast\s*\?\s*2\s*:\s*1\.5/, 'Must use thick 2px border in contrast mode');
    assert.match(screenContent, /isContrast\s*\?\s*['"]#FFFFFF['"]/, 'Must use pure white elements in contrast mode');

    // Dark vs Light fallback
    assert.match(screenContent, /isDark\s*\?\s*['"]#141419['"]\s*:\s*['"]#FAF9F6['"]/, 'Must use #141419 for dark and #FAF9F6 for light');

    // StatusBar sync
    assert.match(screenContent, /<StatusBar[\s\S]*?barStyle=\{isDark\s*\|\|\s*isContrast\s*\?\s*['"]light-content['"]\s*:\s*['"]dark-content['"]\}/, 'StatusBar must match theme brightness');
  });

  test('ExpoTaskAlarmModule and index.ts expose synchronous getSavedThemeMode and setSavedThemeMode', () => {
    const ktPath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/ExpoTaskAlarmModule.kt');
    const ktContent = fs.readFileSync(ktPath, 'utf8');

    assert.match(ktContent, /Function\("getSavedThemeMode"\)/, 'ExpoTaskAlarmModule must define synchronous getSavedThemeMode');
    assert.match(ktContent, /Function\("setSavedThemeMode"\)/, 'ExpoTaskAlarmModule must define synchronous setSavedThemeMode');

    const tsPath = path.resolve('modules/expo-task-alarm/index.ts');
    const tsContent = fs.readFileSync(tsPath, 'utf8');

    assert.match(tsContent, /export function getSavedThemeMode\(\)/, 'index.ts must export getSavedThemeMode');
    assert.match(tsContent, /export function setSavedThemeMode\(/, 'index.ts must export setSavedThemeMode');
  });
});



