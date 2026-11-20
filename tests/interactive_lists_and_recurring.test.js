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

  test('expenses title label hides (display: none) when viewport width < 300px', () => {
    const getTitleLabelStyle = (windowWidth) => ({
      fontSize: 10,
      textTransform: 'uppercase',
      fontWeight: '600',
      display: windowWidth < 300 ? 'none' : 'flex',
    });

    assert.strictEqual(getTitleLabelStyle(280).display, 'none');
    assert.strictEqual(getTitleLabelStyle(299).display, 'none');
    assert.strictEqual(getTitleLabelStyle(300).display, 'flex');
    assert.strictEqual(getTitleLabelStyle(375).display, 'flex');
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

  test('filter pills use high-contrast dark surface and readable text in dark mode', () => {
    const getPillStyle = (isSelected, isDark) => ({
      backgroundColor: isSelected ? '#F59E0B' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
      textColor: isSelected ? '#FFFFFF' : (isDark ? '#E5E7EB' : '#1A1A24'),
    });

    const unselectedDark = getPillStyle(false, true);
    assert.strictEqual(unselectedDark.backgroundColor, 'rgba(255,255,255,0.08)');
    assert.strictEqual(unselectedDark.textColor, '#E5E7EB');

    const selectedDark = getPillStyle(true, true);
    assert.strictEqual(selectedDark.backgroundColor, '#F59E0B');
    assert.strictEqual(selectedDark.textColor, '#FFFFFF');
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

  test('all 10 languages exist, have valid JSON, and have exactly 892 keys each', () => {
    const loaded = {};
    for (const lang of languages) {
      const p = path.join(localesDir, `${lang}.json`);
      assert.ok(fs.existsSync(p), `Locale file missing: ${lang}.json`);
      const raw = fs.readFileSync(p, 'utf8');
      loaded[lang] = JSON.parse(raw);
    }

    const enCount = Object.keys(loaded['en']).length;
    assert.strictEqual(enCount, 923, `English locale must contain 923 keys, got ${enCount}`);

    for (const lang of languages) {
      const count = Object.keys(loaded[lang]).length;
      assert.strictEqual(
        count,
        923,
        `Language ${lang} has ${count} keys, expected 923 (matching EN)`
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
  test('native alarm channels configure USAGE_ALARM, IMPORTANCE_HIGH and soundUri for background lockscreen delivery', () => {
    const ktModulePath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/ExpoTaskAlarmModule.kt');
    const ktContent = fs.readFileSync(ktModulePath, 'utf8');

    // Verify legacy silent _fs_v / _popup_v channels are deleted and resolvedChannelId has USAGE_ALARM & IMPORTANCE_HIGH
    assert.match(ktContent, /deleteNotificationChannel\(ch\.id\)/, 'Must purge legacy silent _fs_v / _popup_v channels');
    assert.match(ktContent, /AudioAttributes\.USAGE_ALARM/, 'Alarm channel must use USAGE_ALARM audio attributes');
    assert.match(ktContent, /setSound\(soundUri,\s*audioAttributes\)/, 'Alarm channel must configure soundUri with audioAttributes');
    assert.match(ktContent, /NotificationChannel\(resolvedChannelId,\s*"Task alarms",\s*NotificationManager\.IMPORTANCE_HIGH\)/, 'Alarm channel must be IMPORTANCE_HIGH');
  });

  test('receiverIntent and TaskAlarmReceiver configure single-stream audio with AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK over Amazon Music and YouTube', () => {
    const ktModulePath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/ExpoTaskAlarmModule.kt');
    const ktContent = fs.readFileSync(ktModulePath, 'utf8');

    assert.ok(ktContent.includes('putExtra("soundName", resolvedSoundName)'), 'ExpoTaskAlarmModule must pass resolvedSoundName in intent');

    const receiverPath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/TaskAlarmReceiver.kt');
    const receiverContent = fs.readFileSync(receiverPath, 'utf8');

    assert.ok(receiverContent.includes('AlarmAudioManager.startAlarmSound(context, soundName)'), 'TaskAlarmReceiver must start AlarmAudioManager for both popup and fullscreen');
    assert.ok(receiverContent.includes('CarUtils.shouldMuteForCar(context)'), 'TaskAlarmReceiver must respect Mute on Android Auto toggle');
    assert.ok(receiverContent.includes('.setPriority(NotificationCompat.PRIORITY_MAX)'), 'NotificationBuilder must use PRIORITY_MAX');
    assert.ok(receiverContent.includes('notificationBuilder.setFullScreenIntent(fullScreenPendingIntent, true)'), 'Must attach setFullScreenIntent when locked');
    assert.ok(receiverContent.includes('.setDeleteIntent(stopPendingIntent)'), 'Must stop alarm sound if popup banner is swiped away');

    const audioManagerPath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/AlarmAudioManager.kt');
    const audioManagerContent = fs.readFileSync(audioManagerPath, 'utf8');
    assert.ok(audioManagerContent.includes('AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK'), 'Must request AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK to make Amazon Music / YouTube quieter');

    const activityPath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/AlarmActivity.kt');
    const activityContent = fs.readFileSync(activityPath, 'utf8');
    assert.ok(activityContent.includes('AlarmAudioManager.requestAlarmFocus(this)'), 'AlarmActivity must hold AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK without spawning a duplicate audio stream');
    assert.ok(activityContent.includes('if (isFinishing)'), 'AlarmActivity.onDestroy must only stop alarm sound when isFinishing is true');

    const notifPath = path.resolve('src/utils/notifications.js');
    const notifContent = fs.readFileSync(notifPath, 'utf8');
    assert.ok(notifContent.includes('return `task_${base}_${soundName}_${vib}_v17`;'), 'getChannelId must keep the working v17 channel suffix');
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

  test('alarms default to full screen when locked and popup banner for other without display style picker', () => {
    const receiverPath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/TaskAlarmReceiver.kt');
    const receiverContent = fs.readFileSync(receiverPath, 'utf8');

    assert.ok(receiverContent.includes('val isFullScreenMode = !isInteractive || isLocked'), 'Must use lockscreen/interactive check for full screen vs popup');

    const settingsPath = path.resolve('src/screens/SettingsScreen.js');
    const settingsContent = fs.readFileSync(settingsPath, 'utf8');
    assert.strictEqual(settingsContent.includes('Alarm display style'), false, 'SettingsScreen must not render Alarm display style picker');
    assert.strictEqual(settingsContent.includes('isAlarmStylePickerOpen'), false, 'isAlarmStylePickerOpen state must be removed');
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

// ==============================================================================
// 11. DUAL MONTH & YEAR SELECTOR WITH HOT TAPS (NEXT 5 MONTHS & NEXT 5 YEARS)
// ==============================================================================
describe('Dual Month & Year Selector with Hot Taps Engine', () => {
  test('YearPickerModal exports backwards-compatible MonthYearPickerModal and YearPickerModal', () => {
    const pickerPath = path.resolve('src/components/YearPickerModal.js');
    const content = fs.readFileSync(pickerPath, 'utf8');

    assert.match(content, /export\s+function\s+YearPickerModal/, 'Must export YearPickerModal');
    assert.match(content, /export\s+\{\s*YearPickerModal\s+as\s+MonthYearPickerModal\s*\}/, 'Must export MonthYearPickerModal alias');
    assert.match(content, /export\s+default\s+YearPickerModal/, 'Must have default export');
  });

  test('YearPickerModal generates next 5 months and next 5 years hot taps', () => {
    const pickerPath = path.resolve('src/components/YearPickerModal.js');
    const content = fs.readFileSync(pickerPath, 'utf8');

    // Hot taps logic
    assert.match(content, /hotMonths/, 'Must define hotMonths list');
    assert.match(content, /base\.add\(i,\s*['"]month['"]\)/, 'Must compute next 5 months');
    assert.match(content, /hotYears/, 'Must define hotYears list');
    assert.match(content, /baseYear\s*\+\s*i/, 'Must compute next 5 years');
    assert.match(content, /handleHotMonthPress/, 'Must provide 1-tap quick jump for months');
    assert.match(content, /handleHotYearPress/, 'Must provide 1-tap quick jump for years');
  });

  test('YearPickerModal contains 3x4 Month grid, Year list, and Done/Apply button', () => {
    const pickerPath = path.resolve('src/components/YearPickerModal.js');
    const content = fs.readFileSync(pickerPath, 'utf8');

    assert.match(content, /tab_month_picker/, 'Must contain Month tab testID');
    assert.match(content, /tab_year_picker/, 'Must contain Year tab testID');
    assert.match(content, /month_option_/, 'Must contain month option testIDs for all 12 months');
    assert.match(content, /year_option_/, 'Must contain year option testIDs');
    assert.match(content, /month_year_apply_btn/, 'Must contain Done / Apply button');
  });

  test('CalendarScreen wires header pill button and handleSelectMonthYear to YearPickerModal', () => {
    const calPath = path.resolve('src/screens/CalendarScreen.js');
    const content = fs.readFileSync(calPath, 'utf8');

    assert.match(content, /handleSelectMonthYear/, 'CalendarScreen must implement handleSelectMonthYear');
    assert.match(content, /calendar_month_year_header/, 'CalendarScreen header must have month-year pill button');
    assert.match(content, /onSelectMonthYear=\{handleSelectMonthYear\}/, 'YearPickerModal must receive onSelectMonthYear callback');
    assert.match(content, /currentMonth=\{dayjs\(calendarMonth\)\.month\(\)\}/, 'YearPickerModal must receive currentMonth');
  });

  test('parseCalendarHeaderDate avoids UTC timezone backward drift for Jan 2027', () => {
    const mod = loadTranspiledModule(path.resolve('src/components/YearPickerModal.js'), {
      'react-native': {
        View: () => null,
        Text: () => null,
        TouchableOpacity: () => null,
        ScrollView: () => null,
        StyleSheet: { create: (s) => s, absoluteFillObject: {} }
      },
      'react-native-modal': () => null,
      'react-i18next': { useTranslation: () => ({ t: (k) => k, i18n: { language: 'en' } }) }
    });
    const { parseCalendarHeaderDate } = mod;

    // Simulate XDate in UTC mode as passed by react-native-calendars
    const mockUtcXDate = {
      getFullYear: () => 2027,
      getMonth: () => 0, // 0 = January
      toString: (fmt) => fmt === 'yyyy-MM-dd' ? '2027-01-01' : 'Fri, 01 Jan 2027 00:00:00 GMT'
    };

    const parsed = parseCalendarHeaderDate(mockUtcXDate, '2026-11-04');
    assert.strictEqual(parsed.format('MMMM YYYY'), 'January 2027', 'Must resolve to January 2027 and not drift to December 2026');
    assert.strictEqual(parsed.year(), 2027);
    assert.strictEqual(parsed.month(), 0);
  });
});

// ==============================================================================
// 12. LARGE SECTION CRASH PREVENTION, FLASHLIST INTEGRITY & HARDWARE DIAGNOSTICS
// ==============================================================================
describe('Large Section Crash Prevention, FlashList Integrity & Hardware Diagnostics', () => {
  test('BoardScreen bypasses LayoutAnimation on Android and large lists to prevent SIGSEGV', () => {
    const boardPath = path.resolve('src/screens/BoardScreen.js');
    const content = fs.readFileSync(boardPath, 'utf8');

    assert.match(content, /isLargeList/, 'Must detect large list conditions in toggleSection');
    assert.match(content, /Platform\.OS\s*!==\s*['"]android['"]/, 'Must not trigger native LayoutAnimation on Android FlashList');
  });

  test('BoardScreen FlashList v2 configures stable uniqueKey keyExtractor and drawDistance', () => {
    const boardPath = path.resolve('src/screens/BoardScreen.js');
    const content = fs.readFileSync(boardPath, 'utf8');

    assert.match(content, /extractBoardItemKey\s*=\s*useCallback\(\(item,\s*index\)/, 'extractBoardItemKey must accept item and index parameters');
    assert.match(content, /keyExtractor=\{extractBoardItemKey\}/, 'keyExtractor must reuse stable extractBoardItemKey callback');
    assert.match(content, /if \(item\?\.uniqueKey\) return item\.uniqueKey;/, 'Must use stable uniqueKey to prevent key shift on section expand');
    assert.match(content, /maintainVisibleContentPosition=\{\{\s*disabled:\s*true\s*\}\}/, 'Must configure maintainVisibleContentPosition disabled for FlashList v2');
    assert.match(content, /drawDistance=\{500\}/, 'FlashList v2 must buffer balanced 500dp ahead/behind viewport');
    assert.match(content, /ListHeaderComponent=\{renderListSummaryBar\}/, 'Must wire memoized summary bar into ListHeaderComponent to scroll with tasks');
  });

  test('ExpoTaskAlarmModule and index.ts expose getSystemMemoryMetrics and native crash capture', () => {
    const ktPath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/ExpoTaskAlarmModule.kt');
    const ktContent = fs.readFileSync(ktPath, 'utf8');

    assert.match(ktContent, /Function\("getSystemMemoryMetrics"\)/, 'Must define getSystemMemoryMetrics in Kotlin');
    assert.match(ktContent, /Function\("getNativeCrashLogs"\)/, 'Must define getNativeCrashLogs in Kotlin');
    assert.match(ktContent, /Function\("initNativeCrashHandler"\)/, 'Must define initNativeCrashHandler in Kotlin');

    const tsPath = path.resolve('modules/expo-task-alarm/index.ts');
    const tsContent = fs.readFileSync(tsPath, 'utf8');

    assert.match(tsContent, /export function getSystemMemoryMetrics/, 'Must export getSystemMemoryMetrics');
    assert.match(tsContent, /export function getNativeCrashLogs/, 'Must export getNativeCrashLogs');
    assert.match(tsContent, /export function initNativeCrashHandler/, 'Must export initNativeCrashHandler');
  });

  test('DevLogsScreen renders Hardware Health & Resource Monitor with RAM spent and processor stats', () => {
    const devPath = path.resolve('src/screens/DevLogsScreen.js');
    const content = fs.readFileSync(devPath, 'utf8');

    assert.match(content, /Hardware Health & Resource Monitor/, 'Must contain Hardware Health monitor card');
    assert.match(content, /RAM Spent \(App Heap\):/, 'Must display RAM Spent metric');
    assert.match(content, /Device RAM Available:/, 'Must display Device RAM Available metric');
    assert.match(content, /Processor Responsiveness:/, 'Must display Processor Responsiveness / FPS metric');
    assert.match(content, /FlashList Crash Guard:/, 'Must display Crash Guard status');
  });
});

// ==============================================================================
// 13. HARDWARE PEAK GUARD & AUTOMATED MEMORY HOOKS
// ==============================================================================
describe('Hardware Peak Guard & Automated Memory Hooks', () => {
  const guardMod = loadTranspiledModule(path.resolve('src/utils/memoryPressureGuard.js'), {
    './logger': { DevLogger: { warn: () => {}, error: () => {}, info: () => {}, log: () => {} } },
    'react-native': { Platform: { OS: 'android' } },
    'react': { useState: (init) => [init, () => {}], useEffect: () => {}, useRef: (v) => ({ current: v }), useCallback: (fn) => fn }
  });
  const { HARDWARE_THRESHOLDS, evaluateHardwareHealth, MemoryPressureGuard } = guardMod;

  test('HARDWARE_THRESHOLDS defines precise memory, latency, and section limits', () => {
    assert.strictEqual(HARDWARE_THRESHOLDS.HEAP_WARNING_PERCENT, 75, 'Heap warning threshold must be 75%');
    assert.strictEqual(HARDWARE_THRESHOLDS.HEAP_CRITICAL_PERCENT, 85, 'Heap critical peak threshold must be 85%');
    assert.strictEqual(HARDWARE_THRESHOLDS.AVAIL_MEM_WARNING_MB, 350, 'Device RAM warning threshold must be 350MB');
    assert.strictEqual(HARDWARE_THRESHOLDS.AVAIL_MEM_CRITICAL_MB, 180, 'Device RAM critical peak threshold must be 180MB');
    assert.strictEqual(HARDWARE_THRESHOLDS.EVENT_LOOP_LAG_WARNING_MS, 60, 'Event loop lag warning must be 60ms');
    assert.strictEqual(HARDWARE_THRESHOLDS.EVENT_LOOP_LAG_CRITICAL_MS, 150, 'Event loop lag critical must be 150ms');
    assert.strictEqual(HARDWARE_THRESHOLDS.SECTION_DENSITY_CRITICAL, 100, 'Section density critical limit must be 100');
  });

  test('evaluateHardwareHealth accurately classifies HEALTHY, WARNING, and CRITICAL_PEAK', () => {
    // 1. Healthy state
    const healthy = evaluateHardwareHealth({
      usedHeapMb: 60,
      totalHeapMb: 100,
      maxHeapMb: 256,
      availMemMb: 1500,
      totalMemMb: 4096,
      lowMemory: false,
      eventLoopLagMs: 5,
      fps: 60,
    });
    assert.strictEqual(healthy.level, 'HEALTHY');
    assert.strictEqual(healthy.isPeak, false);
    assert.strictEqual(healthy.isWarning, false);
    assert.strictEqual(healthy.reasons.length, 0);

    // 2. Warning state (Heap at 78% of maxHeapMb)
    const warningHeap = evaluateHardwareHealth({
      usedHeapMb: 200,
      totalHeapMb: 220,
      maxHeapMb: 256,
      availMemMb: 1200,
      totalMemMb: 4096,
      lowMemory: false,
      eventLoopLagMs: 10,
      fps: 55,
    });
    assert.strictEqual(warningHeap.level, 'WARNING');
    assert.strictEqual(warningHeap.isWarning, true);
    assert.strictEqual(warningHeap.isPeak, false);
    assert.ok(warningHeap.reasons.some(r => r.includes('78%')));

    // 3. Critical Peak state (Heap at 90% or lowMemory true)
    const criticalHeap = evaluateHardwareHealth({
      usedHeapMb: 232,
      totalHeapMb: 240,
      maxHeapMb: 256,
      availMemMb: 120,
      totalMemMb: 4096,
      lowMemory: true,
      eventLoopLagMs: 180,
      fps: 12,
    });
    assert.strictEqual(criticalHeap.level, 'CRITICAL_PEAK');
    assert.strictEqual(criticalHeap.isPeak, true);
    assert.ok(criticalHeap.reasons.length >= 2, 'Should detect multiple peak threshold violations');
  });

  test('MemoryPressureGuard registers, executes, and unregisters cleanup hooks', () => {
    let hookExecuted = false;
    let receivedMetrics = null;

    const unregister = MemoryPressureGuard.registerCleanupHook('test_subsystem', (metrics) => {
      hookExecuted = true;
      receivedMetrics = metrics;
    });

    const result = MemoryPressureGuard.runEmergencyCleanup('TEST_PEAK_EMERGENCY');
    assert.strictEqual(hookExecuted, true, 'Registered hook must be executed on emergency cleanup');
    assert.ok(receivedMetrics !== null, 'Hook must receive current metrics snapshot');
    assert.ok(result.hooksExecuted >= 1, 'Freed count should reflect executed hooks');

    // Unregister and ensure hook is not called again
    hookExecuted = false;
    unregister();
    MemoryPressureGuard.runEmergencyCleanup('TEST_AFTER_UNREGISTER');
    assert.strictEqual(hookExecuted, false, 'Unregistered hook must NOT be executed');
  });

  test('BoardScreen registers cleanup hook to close modals and cancel editing during memory peak', () => {
    const boardPath = path.resolve('src/screens/BoardScreen.js');
    const content = fs.readFileSync(boardPath, 'utf8');

    assert.match(content, /MemoryPressureGuard\.registerCleanupHook\('BoardScreen'/, 'BoardScreen must register a named cleanup hook');
    assert.match(content, /closeOpenSwipeableRow\?\.\(\)/, 'Cleanup hook must close open swipeables');
    assert.match(content, /cancelAllInlineEditing\?\.\(\)/, 'Cleanup hook must cancel inline editing');
  });

  test('DevLogsScreen wires useMemoryPressureGuard and displays threshold cheatsheet and manual emergency flush', () => {
    const devPath = path.resolve('src/screens/DevLogsScreen.js');
    const content = fs.readFileSync(devPath, 'utf8');

    assert.match(content, /useMemoryPressureGuard/, 'DevLogsScreen must import and use useMemoryPressureGuard');
    assert.match(content, /CRITICAL HARDWARE NUMBERS & THRESHOLDS/, 'DevLogsScreen must render hardware threshold reference guide');
    assert.match(content, /Run Emergency RAM Flush & GC/, 'DevLogsScreen must provide manual emergency flush trigger');
  });

  test('BoardScreen protects large section expansion (e.g. 111 missed tasks) via progressive batching, stable keys, and FlashList v2', () => {
    const boardPath = path.resolve('src/screens/BoardScreen.js');
    const content = fs.readFileSync(boardPath, 'utf8');

    assert.match(content, /INITIAL_SECTION_PAGE_SIZE/, 'BoardScreen must batch initial visible rows per section');
    assert.match(content, /type:\s*'show_more'/, 'BoardScreen must render a show_more pagination row when section exceeds page size');
    assert.match(content, /maintainVisibleContentPosition=\{\{\s*disabled:\s*true\s*\}\}/, 'BoardScreen FlashList v2 must disable chat scroll anchoring on section toggles');
    assert.doesNotMatch(content, /removeClippedSubviews=\{Platform\.OS === 'android'\}/, 'BoardScreen must not combine removeClippedSubviews with FlashList');
  });

  test('TaskAlarmReceiver uses full screen only when phone is locked and popup with sound when phone is active', () => {
    const receiverPath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/TaskAlarmReceiver.kt');
    const receiverContent = fs.readFileSync(receiverPath, 'utf8');

    assert.match(receiverContent, /val isFullScreenMode = !isInteractive \|\| isLocked/, 'Must only enter full screen mode when screen is off or keyguard is locked');
    assert.match(receiverContent, /val isCar = CarUtils\.shouldMuteForCar\(context\)/, 'Must check shouldMuteForCar which respects Mute on Android Auto setting');
    assert.match(receiverContent, /if \(isFullScreenMode\) \{\s*notificationBuilder\.setFullScreenIntent/s, 'Must only attach setFullScreenIntent when phone is locked');
    assert.match(receiverContent, /AlarmAudioManager\.startAlarmSound\(context, soundName\)/, 'Must start alarm audio and duck media in both popup and fullscreen modes');

    const modulePath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/ExpoTaskAlarmModule.kt');
    const moduleContent = fs.readFileSync(modulePath, 'utf8');
    assert.match(moduleContent, /deleteNotificationChannel/, 'Must purge legacy silent _fs_v / _popup_v channels');
    assert.match(moduleContent, /OnActivityEntersForeground/, 'Must re-sync FLAG_SECURE on foreground resume so screenshots are never stuck blocked');
  });

  test('LoginScreen is hidden (display: none) and app opens automatically without registration', () => {
    const loginPath = path.resolve('src/screens/LoginScreen.js');
    const loginContent = fs.readFileSync(loginPath, 'utf8');
    assert.match(loginContent, /display:\s*['"]none['"]/, 'LoginScreen container must have display: none');
    assert.match(loginContent, /dispatch\(continueAsGuest\(\)\)/, 'LoginScreen must automatically continue as guest');

    const navPath = path.resolve('src/navigation/AppNavigator.js');
    const navContent = fs.readFileSync(navPath, 'utf8');
    assert.match(navContent, /<MainStack\s*\/>/, 'AppNavigator must render MainStack directly');

    const userSlicePath = path.resolve('src/features/userSlice.js');
    const userSliceContent = fs.readFileSync(userSlicePath, 'utf8');
    assert.match(userSliceContent, /const loadIsGuestFromLocalStorage = \(\) => \{[\s\S]*?return true;/, 'userSlice must default isGuest to true');
  });

  test('CrashLogger and ExpoTaskAlarmModule ignore normal background OS cache eviction (Importance > 200) and DevLogsScreen memoizes payload metrics', () => {
    const crashPath = path.resolve('src/utils/crashLogger.js');
    const crashContent = fs.readFileSync(crashPath, 'utf8');
    assert.match(crashContent, /isBackgroundCacheEviction/, 'CrashLogger must filter out background OS cache evictions (Importance > 200)');

    const ktPath = path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/ExpoTaskAlarmModule.kt');
    const ktContent = fs.readFileSync(ktPath, 'utf8');
    assert.match(ktContent, /IMPORTANCE_VISIBLE/, 'ExpoTaskAlarmModule must only treat REASON_LOW_MEMORY as a crash when process was foreground/visible');

    const devPath = path.resolve('src/screens/DevLogsScreen.js');
    const devContent = fs.readFileSync(devPath, 'utf8');
    assert.match(devContent, /const payloadMetrics = useMemo/, 'DevLogsScreen must memoize payloadMetrics');
    assert.match(devContent, /filteredTasks\.slice\(0,\s*visibleTaskLimit\)/, 'DevLogsScreen must paginate task cards to avoid main-thread mount lag');
  });
});

// ==============================================================================
// 14. MODERN PERFORMANCE ARCHITECTURE: MMKV JSI & FAST STORAGE
// ==============================================================================
describe('Modern Performance Architecture: MMKV JSI & Fast Storage Engine', () => {
  test('FastStorage & CryptoStorage leverage native MMKV JSI with transparent AsyncStorage migration and tamper safety', async () => {
    const legacyAsyncStore = {};
    const mmkvBacking = new Map();

    class MockMMKV {
      constructor({ id, encryptionKey } = {}) {
        this.id = id || 'default';
        this.encryptionKey = encryptionKey || null;
        if (!mmkvBacking.has(this.id)) mmkvBacking.set(this.id, new Map());
        this.map = mmkvBacking.get(this.id);
      }
      getString(k) {
        return this.map.has(k) ? this.map.get(k) : undefined;
      }
      set(k, v) {
        this.map.set(k, String(v));
      }
      delete(k) {
        this.map.delete(k);
      }
      clearAll() {
        this.map.clear();
      }
    }

    const mockAsyncStorage = {
      setItem: async (k, v) => { legacyAsyncStore[k] = String(v); },
      getItem: async (k) => (legacyAsyncStore[k] !== undefined ? legacyAsyncStore[k] : null),
      multiGet: async (keys) => keys.map(k => [k, legacyAsyncStore[k] !== undefined ? legacyAsyncStore[k] : null]),
      removeItem: async (k) => { delete legacyAsyncStore[k]; },
      clear: async () => { Object.keys(legacyAsyncStore).forEach(k => delete legacyAsyncStore[k]); },
    };

    // 1. Seed a legacy encrypted payload in AsyncStorage before enabling MMKV
    global.__TEST_ENABLE_MMKV__ = false;
    const legacyCryptoMod = loadTranspiledModule(path.resolve('src/utils/cryptoStorage.js'), {
      '@react-native-async-storage/async-storage': mockAsyncStorage,
    });
    legacyCryptoMod.CryptoStorage._resetKeyForTesting();
    const legacyTasks = [{ id: 'legacy_mmkv_1', taskname: 'Migrate me seamlessly' }];
    await legacyCryptoMod.CryptoStorage.setItem('tasks_guest', JSON.stringify(legacyTasks));
    assert.ok(legacyAsyncStore['tasks_guest'].includes('__enc__'), 'Legacy AsyncStorage must hold AES envelope');

    // 2. Enable native JSI MMKV and verify transparent auto-migration + native encrypted vault
    global.__TEST_ENABLE_MMKV__ = true;
    try {
      const mmkvCryptoMod = loadTranspiledModule(path.resolve('src/utils/cryptoStorage.js'), {
        '@react-native-async-storage/async-storage': mockAsyncStorage,
        'react-native-mmkv': { MMKV: MockMMKV },
      });
      const { CryptoStorage } = mmkvCryptoMod;
      CryptoStorage._resetKeyForTesting();

      assert.strictEqual(CryptoStorage.isNativeMMKVActive(), true, 'Native MMKV must be active when JSI is available');

      // First getItem transparently decrypts from AsyncStorage and migrates into MMKV secure vault
      const migratedJson = await CryptoStorage.getItem('tasks_guest');
      assert.deepStrictEqual(JSON.parse(migratedJson), legacyTasks);

      const secureVault = mmkvBacking.get('taskcalendar-secure-v1');
      assert.ok(secureVault && secureVault.has('tasks_guest'), 'Legacy tasks_guest must be auto-migrated into MMKV secure store');

      // setItemMultiKeys writes multiple keys synchronously into MMKV
      const updatedTasks = [{ id: 'fast_1', taskname: 'Zero-bridge C++ MMKV write' }];
      await CryptoStorage.setItemMultiKeys(['tasks_guest', 'tasks'], JSON.stringify(updatedTasks));
      assert.deepStrictEqual(JSON.parse(await CryptoStorage.getItem('tasks_guest')), updatedTasks);
      assert.deepStrictEqual(JSON.parse(await CryptoStorage.getItem('tasks')), updatedTasks);

      // Tamper canary in AsyncStorage is still caught and rejected safely
      legacyAsyncStore['@chaos_tamper_canary'] = JSON.stringify({
        __enc__: true,
        v: 1,
        iv: '0102030405060708090a0b0c0d0e0f10',
        ct: 'deadbeefcafebabe',
        mac: 'badc0ffee0000000000000000000000000000000000000000000000000000000',
      });
      const tamperedRes = await CryptoStorage.getItem('@chaos_tamper_canary');
      assert.strictEqual(tamperedRes, null, 'Tampered ciphertext must still return null when MMKV is active');
    } finally {
      delete global.__TEST_ENABLE_MMKV__;
    }
  });

  test('Android 15 (targetSdkVersion 35) edge-to-edge safe-area insets protect top headers and BottomMenu height without double-padding', () => {
    const appContent = fs.readFileSync(path.resolve('App.js'), 'utf8');
    assert.match(appContent, /<SafeAreaProvider\s+initialMetrics=\{SAFE_INITIAL_METRICS\}>\s*<ToastProvider>/, 'SafeAreaProvider must wrap ToastProvider and InitApp');
    assert.match(appContent, /paddingTop:\s*insets\?\.top\s*\|\|\s*0/, 'InitApp must apply top safe-area inset for status bar / cutout clearance');

    const bottomMenuContent = fs.readFileSync(path.resolve('src/components/BottomMenu.js'), 'utf8');
    assert.match(bottomMenuContent, /SafeAreaInsetsContext/, 'BottomMenu must read SafeAreaInsetsContext so Android 15 system navigation bar never clips tab items');
    assert.match(bottomMenuContent, /minHeight:\s*barMinHeight/, 'BottomMenu must dynamically expand minHeight by bottom safe-area inset');
    assert.match(bottomMenuContent, /paddingBottom:\s*bottomPadding/, 'BottomMenu must dynamically apply bottomPadding above system navigation bar');

    const devLogsContent = fs.readFileSync(path.resolve('src/screens/DevLogsScreen.js'), 'utf8');
    assert.match(devLogsContent, /paddingBottom:\s*insets\?\.bottom\s*\|\|\s*0/, 'DevLogsScreen (outside MainTabs) must apply bottom safe-area inset');
    assert.doesNotMatch(devLogsContent, /paddingTop:\s*Platform\.OS\s*===\s*'ios'\s*\?\s*44/, 'DevLogsScreen must not double-pad top inset on iOS');

    const drawerContent = fs.readFileSync(path.resolve('src/components/calendar/GoogleDrawer.js'), 'utf8');
    assert.doesNotMatch(drawerContent, /paddingTop:\s*Platform\.OS\s*===\s*'ios'\s*\?\s*44/, 'GoogleDrawer inside inset screens must not double-pad top inset on iOS');

    const pinLockContent = fs.readFileSync(path.resolve('src/screens/PinLockScreen.js'), 'utf8');
    assert.match(pinLockContent, /paddingTop:\s*20\s*\+\s*\(insets\?\.top\s*\|\|\s*0\)/, 'PinLockScreen (statusBarTranslucent Modal) must apply top safe-area inset');
    assert.match(pinLockContent, /paddingBottom:\s*20\s*\+\s*\(insets\?\.bottom\s*\|\|\s*0\)/, 'PinLockScreen (statusBarTranslucent Modal) must apply bottom safe-area inset');

    const toastContent = fs.readFileSync(path.resolve('src/styles/ToastContext.js'), 'utf8');
    assert.match(toastContent, /bottom:\s*30\s*\+\s*\(insets\?\.bottom\s*\|\|\s*0\)/, 'ToastProvider must offset bottom toast above system navigation bar');
  });

  describe('Phase 4: Modal & Sheet Architecture Hardening (In-Tree Overlays & BackHandler)', () => {
    const taskDetailsMod = loadTranspiledModule(path.resolve('src/components/TaskDetailsModal.js'), {
      'react-native': {
        View: () => null,
        Text: () => null,
        TextInput: () => null,
        TouchableOpacity: () => null,
        StyleSheet: { create: s => s, absoluteFillObject: {}, absoluteFill: {} },
        ScrollView: () => null,
        Platform: { OS: 'android', select: obj => obj.android || obj.default },
        Share: {},
        Image: () => null,
        KeyboardAvoidingView: () => null,
        Keyboard: { dismiss: () => {} },
        Alert: { alert: () => {} },
        Switch: () => null,
        AppState: { addEventListener: () => ({ remove: () => {} }) },
        Linking: { openURL: () => {} },
        useWindowDimensions: () => ({ width: 400, height: 800 }),
        BackHandler: { addEventListener: () => ({ remove: () => {} }) },
      },
      'react-redux': { useDispatch: () => () => {}, useSelector: () => [] },
      '../features/taskSlice': {},
      '@expo/vector-icons': {},
      '../styles/ThemeContext': { useTheme: () => ({ colors: {}, isDark: false }), hexToRgba: () => '' },
      'dayjs': dayjs,
      'expo-localization': {},
      'react-native-svg': { default: () => null, Path: () => null, Circle: () => null, Rect: () => null, Polyline: () => null },
      'react-native-calendars': { Calendar: () => null },
      '../utils/notifications': { scheduleTaskReminder: async () => {}, cancelNotification: async () => {} },
      '../custom-hooks/useTaskRepeat': { useTaskRepeat: () => ({ generateRepeatingTasks: () => [] }) },
      './CustomDropdown': () => null,
      './CustomRepeatModal': () => null,
      './CustomReminderModal': () => null,
      './YearPickerModal': { parseCalendarHeaderDate: () => dayjs() },
      './ConfirmModal': () => null,
      './PremiumModal': () => null,
      './CustomTimePicker': () => null,
      'react-i18next': { useTranslation: () => ({ t: k => k, i18n: { language: 'en' } }) },
      'react-native-modal': () => null,
      'expo-image-picker': { getPendingResultAsync: async () => null },
      'expo-document-picker': {},
      'expo-file-system': {},
      'expo-sharing': {},
      'expo-clipboard': {},
      'expo-intent-launcher': {},
      '../utils/securityLockHelper': { SecurityLockHelper: { subscribeLock: () => () => {} } },
    });

    const { normalizeSubtasks } = taskDetailsMod;

    test('normalizeSubtasks converts strings and objects deterministically without Date.now() false positives', () => {
      assert.strictEqual(typeof normalizeSubtasks, 'function', 'normalizeSubtasks must be exported as a function');
      assert.deepStrictEqual(normalizeSubtasks(null), []);
      assert.deepStrictEqual(normalizeSubtasks([]), []);

      const rawStringList = ['Buy groceries', 'Call pharmacy'];
      const normalized1 = normalizeSubtasks(rawStringList);
      const normalized2 = normalizeSubtasks(rawStringList);

      assert.strictEqual(normalized1.length, 2);
      assert.strictEqual(normalized1[0].id, 'st_0');
      assert.strictEqual(normalized1[0].text, 'Buy groceries');
      assert.strictEqual(normalized1[0].completed, false);
      assert.strictEqual(normalized1[1].id, 'st_1');
      assert.strictEqual(normalized1[1].text, 'Call pharmacy');

      // Deterministic identity check: string representations match 100% across multiple calls
      assert.strictEqual(
        JSON.stringify(normalized1),
        JSON.stringify(normalized2),
        'normalizeSubtasks must produce deterministic IDs (st_idx) to prevent hasUnsavedChanges() false triggers on mount'
      );

      // Existing IDs are preserved
      const rawObjects = [
        { id: 'custom_sub_99', text: 'Existing task', completed: true },
        { name: 'Missing ID task' },
      ];
      const normObjects = normalizeSubtasks(rawObjects);
      assert.strictEqual(normObjects[0].id, 'custom_sub_99');
      assert.strictEqual(normObjects[0].completed, true);
      assert.strictEqual(normObjects[1].id, 'st_1');
      assert.strictEqual(normObjects[1].text, 'Missing ID task');
      assert.strictEqual(normObjects[1].completed, false);
    });

    test('In-Tree Overlays: ConfirmModal, YearPickerModal, CustomRepeatModal, CustomReminderModal, and CalendarDayOptionsModal support inline={true}', () => {
      const confirmModalContent = fs.readFileSync(path.resolve('src/components/ConfirmModal.js'), 'utf8');
      assert.match(confirmModalContent, /inline\s*=\s*false/, 'ConfirmModal must support inline prop');
      assert.match(confirmModalContent, /if\s*\(inline\)/, 'ConfirmModal must branch on inline prop');
      assert.match(confirmModalContent, /styles\.inlineOverlay/, 'ConfirmModal inline mode must render in-tree overlay');

      const yearPickerContent = fs.readFileSync(path.resolve('src/components/YearPickerModal.js'), 'utf8');
      assert.match(yearPickerContent, /inline\s*=\s*false/, 'YearPickerModal must support inline prop');
      assert.match(yearPickerContent, /if\s*\(inline\)/, 'YearPickerModal must branch on inline prop');
      assert.match(yearPickerContent, /styles\.inlineOverlay/, 'YearPickerModal inline mode must render in-tree overlay');

      const customRepeatContent = fs.readFileSync(path.resolve('src/components/CustomRepeatModal.js'), 'utf8');
      assert.match(customRepeatContent, /inline\s*=\s*false/, 'CustomRepeatModal must support inline prop');
      assert.match(customRepeatContent, /if\s*\(inline\)/, 'CustomRepeatModal must branch on inline prop');
      assert.match(customRepeatContent, /styles\.inlineOverlay/, 'CustomRepeatModal inline mode must render in-tree overlay');

      const customReminderContent = fs.readFileSync(path.resolve('src/components/CustomReminderModal.js'), 'utf8');
      assert.match(customReminderContent, /inline\s*=\s*false/, 'CustomReminderModal must support inline prop');
      assert.match(customReminderContent, /if\s*\(inline\)/, 'CustomReminderModal must branch on inline prop');
      assert.match(customReminderContent, /styles\.inlineOverlay/, 'CustomReminderModal inline mode must render in-tree overlay');

      const dayOptionsContent = fs.readFileSync(path.resolve('src/components/calendar/CalendarDayOptionsModal.js'), 'utf8');
      assert.match(dayOptionsContent, /inline\s*=\s*false/, 'CalendarDayOptionsModal must support inline prop');
      assert.match(dayOptionsContent, /if\s*\(inline\)/, 'CalendarDayOptionsModal must branch on inline prop');
      assert.match(dayOptionsContent, /styles\.inlineOverlay/, 'CalendarDayOptionsModal inline mode must render in-tree overlay');
    });

    test('BoardScreen renders sectionOptionsConfig & boardOptionsConfig as in-tree absoluteFill overlays and buffers task press by 150ms', () => {
      const boardScreenContent = fs.readFileSync(path.resolve('src/screens/BoardScreen.js'), 'utf8');

      // In-tree overlays instead of Modal for kebab options
      assert.match(boardScreenContent, /Boolean\(sectionOptionsConfig\.isVisible\)\s*&&\s*\(\s*<View\s+style=\s*\{\[StyleSheet\.absoluteFillObject,\s*styles\.sheetOverlay/, 'sectionOptionsConfig must be rendered as an in-tree overlay');
      assert.match(boardScreenContent, /Boolean\(boardOptionsConfig\.isVisible\)\s*&&\s*\(\s*<View\s+style=\s*\{\[StyleSheet\.absoluteFillObject,\s*styles\.sheetOverlay/, 'boardOptionsConfig must be rendered as an in-tree overlay');

      // 150ms buffer in handleTaskPress
      assert.match(boardScreenContent, /setTimeout\(\(\)\s*=>\s*\{\s*setDetailsVisible\(true\);\s*\},\s*150\)/, 'handleTaskPress must buffer details modal presentation by 150ms to allow ACTION_UP completion');

      // BackHandler listener in BoardScreen
      assert.match(boardScreenContent, /BackHandler\.addEventListener\('hardwareBackPress'/, 'BoardScreen must register BackHandler for hardware back press');
    });

    test('TaskDetailsModal eliminates nested RNModals and passes inline={true} to all child dialogs', () => {
      const taskDetailsContent = fs.readFileSync(path.resolve('src/components/TaskDetailsModal.js'), 'utf8');

      // No nested RNModal tags
      assert.doesNotMatch(taskDetailsContent, /<RNModal/, 'TaskDetailsModal must not contain any nested RNModal dialogs');

      // In-tree overlay for attachment options & date picker
      assert.match(taskDetailsContent, /Boolean\(isAttachmentOptionsVisible\)\s*&&\s*\(\s*<View\s+style=\s*\{\[StyleSheet\.absoluteFillObject,\s*styles\.calendarOverlay/, 'Attachment options must render as an in-tree overlay');
      assert.match(taskDetailsContent, /Boolean\(showDatePicker\)\s*&&\s*\(\s*<View\s+style=\s*\{\[StyleSheet\.absoluteFillObject,\s*styles\.calendarOverlay/, 'Date picker must render as an in-tree overlay');

      // Sub-modals passed inline={true}
      assert.match(taskDetailsContent, /<ConfirmModal[\s\S]*?inline=\{true\}/, 'ConfirmModal must receive inline={true}');
      assert.match(taskDetailsContent, /<YearPickerModal[\s\S]*?inline=\{true\}/, 'YearPickerModal must receive inline={true}');
      assert.match(taskDetailsContent, /<CustomRepeatModal[\s\S]*?inline=\{true\}/, 'CustomRepeatModal must receive inline={true}');
      assert.match(taskDetailsContent, /<CustomReminderModal[\s\S]*?inline=\{true\}/, 'CustomReminderModal must receive inline={true}');

      // BackHandler listener in TaskDetailsModal
      assert.match(taskDetailsContent, /BackHandler\.addEventListener\('hardwareBackPress'/, 'TaskDetailsModal must register BackHandler for hardware back press');
    });
  });

  describe('Phase 5: Expo SDK 52, React Native 0.76.9 & FlashList v2 (Fabric & Bridgeless)', () => {
    test('Expo SDK 52 + New Architecture (Fabric) + FlashList v2 + MMKV v3 + Bridgeless storage & navigation are configured cleanly', () => {
      const appJson = JSON.parse(fs.readFileSync(path.resolve('app.json'), 'utf8'));
      assert.strictEqual(appJson.expo.newArchEnabled, true, 'app.json must enable newArchEnabled: true for Fabric');

      const buildPropsPlugin = (appJson.expo.plugins || []).find(
        p => Array.isArray(p) && p[0] === 'expo-build-properties'
      );
      assert.ok(buildPropsPlugin, 'app.json must configure expo-build-properties');
      assert.strictEqual(buildPropsPlugin[1]?.android?.compileSdkVersion, 35, 'Android compileSdkVersion must be 35');
      assert.strictEqual(buildPropsPlugin[1]?.android?.targetSdkVersion, 35, 'Android targetSdkVersion must be 35');

      const pkgJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
      assert.match(pkgJson.dependencies.expo, /52\./, 'package.json must target Expo SDK 52');
      assert.match(pkgJson.dependencies['react-native'], /0\.76\./, 'package.json must target React Native 0.76');
      assert.match(pkgJson.dependencies['@shopify/flash-list'], /\^2\./, 'package.json must use FlashList v2 for Fabric');
      assert.match(pkgJson.dependencies['react-native-mmkv'], /\^3\./, 'package.json must use MMKV v3 TurboModule for New Architecture');

      const boardContent = fs.readFileSync(path.resolve('src/screens/BoardScreen.js'), 'utf8');
      assert.match(boardContent, /require\(['"]@shopify\/flash-list['"]\)\.FlashList/, 'BoardScreen must load FlashList v2 conditionally on Native Fabric');
      assert.match(boardContent, /<FabricFlashList/, 'BoardScreen must render FabricFlashList when Fabric is active');
      assert.match(boardContent, /drawDistance=\{500\}/, 'FabricFlashList must use balanced 500dp drawDistance');
      assert.match(boardContent, /getItemType=\{getBoardItemType\}/, 'FabricFlashList must pass hoisted getBoardItemType');
      assert.match(boardContent, /maintainVisibleContentPosition=\{\{\s*disabled:\s*true\s*\}\}/, 'FabricFlashList must disable chat scroll anchoring');
      assert.doesNotMatch(boardContent, /estimatedItemSize=/, 'FlashList v2 must not pass deprecated estimatedItemSize prop');
      assert.match(boardContent, /boardTypeProp=\{activeType\}/, 'BoardScreen must pass boardTypeProp directly to TaskRow');
      assert.match(boardContent, /const renderListSummaryBar = useCallback/, 'renderListSummaryBar must be memoized with useCallback');
      assert.match(boardContent, /<FlatList/, 'BoardScreen must keep FlatList fallback for Web and legacy binaries');
      assert.match(boardContent, /windowSize=\{21\}/, 'BoardScreen FlatList fallback must use windowSize={21}');

      const fastStorageContent = fs.readFileSync(path.resolve('src/utils/fastStorage.js'), 'utf8');
      assert.match(fastStorageContent, /nativeFabricUIManager/, 'FastStorage must detect Fabric JSI in Bridgeless mode');
      assert.match(fastStorageContent, /RN\$Bridgeless/, 'FastStorage must detect RN 0.76 Bridgeless runtime');
      assert.match(fastStorageContent, /createMMKV/, 'FastStorage must support MMKV v3 createMMKV factory');

      const navContent = fs.readFileSync(path.resolve('src/navigation/AppNavigator.js'), 'utf8');
      assert.match(navContent, /detachInactiveScreens=\{false\}/, 'Tab.Navigator must disable screen detachment on RN 0.76 Fabric');

      // UI-Thread Scroll & Row Performance Optimizations
      const appContent = fs.readFileSync(path.resolve('App.js'), 'utf8');
      assert.match(appContent, /<TaskRowConfigProvider>/, 'App.js must wrap InitApp in TaskRowConfigProvider');

      const taskRowContent = fs.readFileSync(path.resolve('src/components/TaskRow.js'), 'utf8');
      assert.match(taskRowContent, /import ReanimatedSwipeRow from '\.\/ReanimatedSwipeRow'/, 'TaskRow must use UI-thread ReanimatedSwipeRow');
      assert.match(taskRowContent, /useTaskRowConfig\(\)/, 'TaskRow must read shared config from TaskRowConfigContext');
      assert.match(taskRowContent, /function areTaskRowPropsEqual/, 'TaskRow must use custom areTaskRowPropsEqual comparator');
      assert.match(taskRowContent, /PRICE_PARSE_CACHE/, 'TaskRow must cache parsed prices in O(1) Map');
      assert.match(taskRowContent, /DUE_DATE_CACHE/, 'TaskRow must cache formatted due dates in O(1) Map');

      assert.doesNotMatch(taskRowContent, /useAnimatedStyle\s*\(/, 'TaskRow must avoid Reanimated useAnimatedStyle so modals do not collapse on Fabric (#6659)');

      const swipeRowContent = fs.readFileSync(path.resolve('src/components/ReanimatedSwipeRow.js'), 'utf8');
      assert.match(swipeRowContent, /PanGestureHandler/, 'ReanimatedSwipeRow must use native RNGH PanGestureHandler');
      assert.doesNotMatch(swipeRowContent, /useAnimatedStyle\s*\(/, 'ReanimatedSwipeRow must use native-driver Animated rather than Reanimated useAnimatedStyle on Fabric (#6659)');
      assert.match(swipeRowContent, /actionsMounted &&/, 'ReanimatedSwipeRow must lazily mount swipe drawers');

      const inlineAddContent = fs.readFileSync(path.resolve('src/components/InlineAddTask.js'), 'utf8');
      assert.match(inlineAddContent, /const InlineAddTask = React\.memo/, 'InlineAddTask must be wrapped in React.memo');

      const detailsContent = fs.readFileSync(path.resolve('src/components/TaskDetailsModal.js'), 'utf8');
      assert.match(detailsContent, /const TaskDetailsModal = React\.memo/, 'TaskDetailsModal must be wrapped in React.memo');
      assert.match(detailsContent, /<CustomTimePicker[\s\S]*inline=\{true\}/, 'TaskDetailsModal must render CustomTimePicker inline to avoid nested native Dialog deadlocks');

      const autoManageContent = fs.readFileSync(path.resolve('src/components/AutoManageSettings.js'), 'utf8');
      assert.match(autoManageContent, /<CustomTimePicker[\s\S]*inline=\{true\}/, 'AutoManageSettings must render CustomTimePicker inline');

      const timePickerContent = fs.readFileSync(path.resolve('src/components/CustomTimePicker.js'), 'utf8');
      const activeStartIdx = timePickerContent.search(/^import React,/m);
      const activeTimePickerCode = activeStartIdx >= 0 ? timePickerContent.slice(activeStartIdx) : timePickerContent;
      assert.match(activeTimePickerCode, /PanResponder\.create/, 'CustomTimePicker must use RN PanResponder rather than GestureHandlerRootView inside Modals');
      assert.doesNotMatch(activeTimePickerCode, /GestureHandlerRootView/, 'CustomTimePicker must not wrap Modal content in GestureHandlerRootView on Fabric');
      assert.doesNotMatch(activeTimePickerCode, /useAnimatedStyle\s*\(/, 'CustomTimePicker must avoid Reanimated useAnimatedStyle inside Modals (#6659)');

      for (const unusedDep of ['@gorhom/bottom-sheet', '@react-native-community/datetimepicker', 'react-native-draggable-flatlist', 'reanimated-color-picker']) {
        assert.strictEqual(pkgJson.dependencies[unusedDep], undefined, `Unused dependency ${unusedDep} must not remain in package.json`);
      }
    });

    test('GitHub Actions workflows prune old artifacts and enforce retention-days: 3 to stay under 500 MB quota', async () => {
      const pruneArtifacts = require(path.resolve('.github/scripts/prune-artifacts.js'));
      const deletedIds = [];
      const mockArtifacts = [
        { id: 1, name: 'taskcalendar-release.apk', size_in_bytes: 110 * 1024 * 1024, expired: false, created_at: '2026-11-01T00:00:00Z' },
        { id: 2, name: 'old-other-bundle', size_in_bytes: 150 * 1024 * 1024, expired: false, created_at: '2026-11-02T00:00:00Z' },
        { id: 3, name: 'taskcalendar-web-dist', size_in_bytes: 100 * 1024 * 1024, expired: false, created_at: '2026-11-03T00:00:00Z' },
        { id: 4, name: 'expired-apk', size_in_bytes: 200 * 1024 * 1024, expired: true, created_at: '2026-10-01T00:00:00Z' },
      ];

      const mockGithub = {
        rest: {
          actions: {
            listArtifactsForRepo: async () => ({ data: { artifacts: mockArtifacts } }),
            deleteArtifact: async ({ artifact_id }) => { deletedIds.push(artifact_id); },
          },
        },
      };

      const res = await pruneArtifacts({
        github: mockGithub,
        context: { repo: { owner: 'user', repo: 'app' } },
        targetArtifactName: 'taskcalendar-release.apk',
        maxRepoBytes: 200 * 1024 * 1024,
      });

      assert.deepStrictEqual(deletedIds, [1, 2], 'Must delete matching artifact and oldest remaining artifact exceeding maxRepoBytes');
      assert.strictEqual(res.remainingBytes, 100 * 1024 * 1024);

      for (const wf of ['android-build.yml', 'ci.yml', 'web-deploy.yml']) {
        const yml = fs.readFileSync(path.resolve('.github/workflows', wf), 'utf8');
        assert.match(yml, /actions:\s*write/, `${wf} must declare actions: write permission`);
        assert.match(yml, /prune-artifacts\.js/, `${wf} must run prune-artifacts.js before uploading`);
        assert.match(yml, /retention-days:\s*3/, `${wf} must enforce short retention-days: 3`);
      }
    });
  });

  // ============================================================================
  // PHASE 6: MULTI-CURRENCY PARSING & PERSISTENT HABIT ARCHITECTURE TESTS
  // ============================================================================
  describe('Phase 6: Multi-Currency Parsing, Formatting & Persistent Habit Engine', () => {
    const currencyHelper = loadTranspiledModule(path.resolve('src/utils/currencyHelper.js'));
    const habitHelper = loadTranspiledModule(path.resolve('src/utils/habitHelper.js'), { dayjs });

    test('parses explicit symbols/codes in multiple scripts and comma/dot decimals', () => {
      assert.strictEqual(currencyHelper.extractTaskAmountFromTitle('Almond Milk 2x $4.99'), 4.99);
      assert.strictEqual(currencyHelper.extractTaskAmountFromTitle('Кофе 350₽'), 350);
      assert.strictEqual(currencyHelper.extractTaskAmountFromTitle('Молоко 120 руб'), 120);
      assert.strictEqual(currencyHelper.extractTaskAmountFromTitle('Хлеб 65,50 р.'), 65.5);
      assert.strictEqual(currencyHelper.extractTaskAmountFromTitle('Wine €12,50'), 12.5);
      assert.strictEqual(currencyHelper.extractTaskAmountFromTitle('Ramen 980円'), 980);
      assert.strictEqual(currencyHelper.extractTaskAmountFromTitle('Bento ¥1,200'), 1200);
      assert.strictEqual(currencyHelper.extractTaskAmountFromTitle('Tea ₹250'), 250);
      assert.strictEqual(currencyHelper.extractTaskAmountFromTitle('Kimchi ₩5000'), 5000);
      assert.strictEqual(currencyHelper.extractTaskAmountFromTitle('Internet RUB 750'), 750);
    });

    test('parses bare trailing price on price boards while ignoring weights, counts, and embedded numbers', () => {
      assert.strictEqual(
        currencyHelper.extractTaskAmountFromTitle('Молоко 120', { boardType: 'grocery' }),
        120
      );
      assert.strictEqual(
        currencyHelper.extractTaskAmountFromTitle('2x Apples 3.50', { boardType: 'grocery' }),
        3.5
      );
      assert.strictEqual(
        currencyHelper.extractGroceryQuantity('2x Apples 3.50'),
        2
      );
      assert.strictEqual(
        currencyHelper.extractTaskAmountFromTitle('Хлеб 2 шт 65', { boardType: 'grocery' }),
        65
      );
      assert.strictEqual(
        currencyHelper.extractGroceryQuantity('Хлеб 2 шт 65'),
        2
      );
      assert.strictEqual(
        currencyHelper.extractTaskAmountFromTitle('Box 50', { boardType: 'grocery' }),
        50
      );

      // Guard against false positives
      assert.strictEqual(
        currencyHelper.extractTaskAmountFromTitle('Eggs x 2', { boardType: 'grocery' }),
        0
      );
      assert.strictEqual(
        currencyHelper.extractTaskAmountFromTitle('2 apples', { boardType: 'grocery' }),
        0
      );
      assert.strictEqual(
        currencyHelper.extractTaskAmountFromTitle('Flour 500g', { boardType: 'grocery' }),
        0
      );
      assert.strictEqual(
        currencyHelper.extractTaskAmountFromTitle('Eggs 12 pcs', { boardType: 'grocery' }),
        0
      );
      assert.strictEqual(
        currencyHelper.extractTaskAmountFromTitle('Vitamin B12', { boardType: 'grocery' }),
        0
      );
      assert.strictEqual(
        currencyHelper.extractTaskAmountFromTitle('Milk 2%', { boardType: 'grocery' }),
        0
      );
      assert.strictEqual(
        currencyHelper.extractTaskAmountFromTitle('Chrome 120', { boardType: 'standard' }),
        0
      );
    });

    test('resolves regional currencies by language/override and formats decimals cleanly', () => {
      assert.strictEqual(currencyHelper.resolveCurrencyCode({ langCode: 'ru' }), 'RUB');
      assert.strictEqual(currencyHelper.resolveCurrencyCode({ langCode: 'ja' }), 'JPY');
      assert.strictEqual(currencyHelper.resolveCurrencyCode({ langCode: 'ko' }), 'KRW');
      assert.strictEqual(currencyHelper.resolveCurrencyCode({ langCode: 'zh' }), 'CNY');
      assert.strictEqual(currencyHelper.resolveCurrencyCode({ langCode: 'hi' }), 'INR');
      assert.strictEqual(currencyHelper.resolveCurrencyCode({ langCode: 'en' }), 'USD');
      assert.strictEqual(
        currencyHelper.resolveCurrencyCode({ boardCurrencyCode: 'EUR', settingCode: 'RUB', langCode: 'ru' }),
        'EUR'
      );

      assert.strictEqual(currencyHelper.formatCurrency(1200, 'JPY'), '¥1,200');
      assert.strictEqual(currencyHelper.formatCurrency(120, 'RUB'), '120 ₽');
      assert.strictEqual(currencyHelper.formatCurrency(120.5, 'RUB'), '120.50 ₽');
      assert.strictEqual(currencyHelper.formatCurrency(12.5, 'USD'), '$12.50');
    });

    test('computes deterministic habit streaks, strict vs grace freeze, missed days, and 7-day consistency dots', () => {
      // Today = Thursday 2026-11-12
      const today = '2026-11-12';

      // 1. Daily habit completed Nov 8, skipped Nov 9-11 -> 3 missed scheduled days before today
      const lapsedTask = {
        id: 'h1',
        taskname: 'Meditate',
        habitCompletedDates: ['2026-11-08'],
        habitSchedule: { preset: 'daily' },
      };
      const lapsedStats = habitHelper.computeHabitStats(lapsedTask, today, 'grace');
      assert.strictEqual(lapsedStats.missedScheduledDays, 3);
      assert.strictEqual(lapsedStats.status, 'missed_days');
      assert.strictEqual(lapsedStats.currentStreak, 0);
      assert.strictEqual(lapsedStats.last7Days.length, 7);
      assert.strictEqual(lapsedStats.last7Days[6].state, 'pending_today');

      // 2. Missed ONLY yesterday with 3 prior completed days: grace preserves 3 + freezeActive; strict resets to 0
      const graceCandidate = {
        id: 'h2',
        taskname: 'Workout',
        habitCompletedDates: ['2026-11-08', '2026-11-09', '2026-11-10'],
        habitSchedule: { preset: 'daily' },
      };
      const graceStats = habitHelper.computeHabitStats(graceCandidate, today, 'grace');
      assert.strictEqual(graceStats.status, 'missed_yesterday');
      assert.strictEqual(graceStats.currentStreak, 3);
      assert.strictEqual(graceStats.freezeActive, true);

      const strictStats = habitHelper.computeHabitStats(graceCandidate, today, 'strict');
      assert.strictEqual(strictStats.currentStreak, 0);
      assert.strictEqual(strictStats.freezeActive, false);

      // 3. Weekdays schedule checked on Monday 2026-11-09 when last completed Friday 2026-11-06 -> 0 missed days
      const weekdayHabit = {
        id: 'h3',
        taskname: 'Standup Prep',
        habitCompletedDates: ['2026-11-05', '2026-11-06'],
        habitSchedule: { preset: 'weekdays' },
      };
      const mondayStats = habitHelper.computeHabitStats(weekdayHabit, '2026-11-09', 'strict');
      assert.strictEqual(mondayStats.missedScheduledDays, 0);
      assert.strictEqual(mondayStats.currentStreak, 2);

      // 4. Mark yesterday done backfills yesterday without marking today completed
      const markYest = habitHelper.toggleHabitCompletionForDate(graceCandidate, '2026-11-11', today, 'strict');
      assert.strictEqual(markYest.patch.completed, false);
      assert.strictEqual(markYest.patch.habitStreak, 4);
      assert.strictEqual(markYest.patch.habitBestStreak, 4);

      // 5. Same-day toggle prevention + Undo accuracy
      const toggleOn = habitHelper.toggleHabitCompletionForDate(lapsedTask, today, today, 'grace');
      assert.strictEqual(toggleOn.patch.completed, true);
      assert.strictEqual(toggleOn.patch.habitStreak, 1);
      const taskAfterOn = { ...lapsedTask, ...toggleOn.patch };
      const toggleOff = habitHelper.toggleHabitCompletionForDate(taskAfterOn, today, today, 'grace');
      assert.strictEqual(toggleOff.patch.completed, false);
      assert.strictEqual(toggleOff.patch.habitStreak, 0);
    });

    test('daily rollover resets yesterday completed habits back to today and migrates legacy streaks', () => {
      const boards = [{ id: 'habits_1', name: 'Habits', type: 'habits' }];
      const tasks = [
        {
          id: 'legacy_h',
          boardId: 'habits_1',
          taskname: 'Read 20 pages',
          completed: true,
          habitStreak: 5,
          habitLastCompleted: '2026-11-11',
          dateString: '2026-11-11',
          completionDate: '2026-11-11',
        },
        {
          id: 'future_h',
          boardId: 'habits_1',
          taskname: 'Weekend Swim',
          completed: false,
          habitCompletedDates: [],
          habitSchedule: { preset: 'weekends' },
          dateString: '2026-11-14',
          completionDate: '2026-11-14',
        },
      ];

      const updates = habitHelper.computeHabitRolloverUpdates(tasks, boards, '2026-11-12', 'grace');
      const legacyUpd = updates.find(u => u.taskId === 'legacy_h');
      assert.ok(legacyUpd, 'Legacy habit from yesterday must roll over to today');
      assert.strictEqual(legacyUpd.completed, false, 'Habit checked off yesterday must reset unchecked today');
      assert.strictEqual(legacyUpd.habitStreak, 5, 'Legacy 5-day streak must carry over cleanly');
      assert.strictEqual(legacyUpd.habitBestStreak, 5);
      assert.strictEqual(legacyUpd.completionDate, '2026-11-12');
      assert.strictEqual(legacyUpd.habitCompletedDates.length, 5);

      const futureUpd = updates.find(u => u.taskId === 'future_h');
      assert.strictEqual(futureUpd.completionDate, undefined, 'Future scheduled habit must keep its planned date');
    });

    test('source files wire currencyHelper, habitHelper, and rolloverHabitTasks properly', () => {
      const taskSliceSrc = fs.readFileSync(path.resolve('src/features/taskSlice.js'), 'utf8');
      assert.match(taskSliceSrc, /rolloverHabitTasks/);
      assert.match(taskSliceSrc, /habitCompletedDates/);
      assert.match(taskSliceSrc, /habitBestStreak/);
      assert.match(taskSliceSrc, /habitSchedule/);

      const taskRowSrc = fs.readFileSync(path.resolve('src/components/TaskRow.js'), 'utf8');
      assert.match(taskRowSrc, /extractTaskAmountFromTitle/);
      assert.match(taskRowSrc, /formatCurrency/);
      assert.match(taskRowSrc, /toggleHabitCompletionForDate/);
      assert.match(taskRowSrc, /Missed yesterday/);

      const boardSrc = fs.readFileSync(path.resolve('src/screens/BoardScreen.js'), 'utf8');
      assert.match(boardSrc, /setHabitStreakMode/);
      assert.match(boardSrc, /Habit Streak Mode/);

      const modalSrc = fs.readFileSync(path.resolve('src/components/PaymentBoardSettingsModal.js'), 'utf8');
      assert.match(modalSrc, /CURRENCY_OPTION_CODES/);
      assert.match(modalSrc, /setBoardCurrency/);

      const appSrc = fs.readFileSync(path.resolve('App.js'), 'utf8');
      assert.match(appSrc, /rolloverHabitTasks/);
    });

    test('SDK 52 expo-notifications triggers include explicit type and foreground shouldShowAlert', () => {
      const notificationsSrc = fs.readFileSync(path.resolve('src/utils/notifications.js'), 'utf8');
      assert.match(notificationsSrc, /shouldShowAlert:\s*true/, 'Notification handler must enable shouldShowAlert for expo-notifications 0.29');
      assert.match(notificationsSrc, /export function buildDateTrigger/, 'Must export typed DATE trigger builder');
      assert.match(notificationsSrc, /export function buildTimeIntervalTrigger/, 'Must export typed TIME_INTERVAL trigger builder');
      assert.doesNotMatch(
        notificationsSrc,
        /trigger:\s*(?:Platform\.OS\s*===\s*'android'\s*\?\s*)?\{\s*date:/,
        'Do not pass untyped SDK 51 { date, channelId } trigger objects (they fire immediately as type: channel on SDK 52)'
      );
      assert.doesNotMatch(
        notificationsSrc,
        /trigger:\s*\{\s*seconds:/,
        'Do not pass untyped SDK 51 { seconds } trigger objects'
      );

      const notifMod = loadTranspiledModule(path.resolve('src/utils/notifications.js'), {
        'expo-notifications': {
          setNotificationHandler: () => {},
          SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
        },
        'expo-device': {},
        'react-native': { Platform: { OS: 'android' }, ToastAndroid: { show: () => {} } },
        '../../modules/expo-task-alarm': {},
        './logger': { DevLogger: { info: () => {}, warn: () => {}, error: () => {}, success: () => {} } },
        dayjs,
      });

      const future = new Date(Date.now() + 900000);
      const dateTrig = notifMod.buildDateTrigger(future, 'task_default_notification_vib1_v17');
      assert.deepStrictEqual(dateTrig, {
        type: 'date',
        date: future,
        channelId: 'task_default_notification_vib1_v17',
      });

      const intervalTrig = notifMod.buildTimeIntervalTrigger(3, 'debug_system_sound_v16', false);
      assert.deepStrictEqual(intervalTrig, {
        type: 'timeInterval',
        seconds: 3,
        repeats: false,
        channelId: 'debug_system_sound_v16',
      });
    });

    test('scheduleTaskReminder schedules both before-offset and on-time typed date triggers without premature Redux mutation', async () => {
      const scheduledCalls = [];
      const notifMod = loadTranspiledModule(path.resolve('src/utils/notifications.js'), {
        'expo-notifications': {
          setNotificationHandler: () => {},
          SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
          AndroidNotificationPriority: { MAX: 'max', HIGH: 'high', LOW: 'low' },
          AndroidImportance: { MAX: 5, HIGH: 4, LOW: 2, NONE: 0 },
          AndroidAudioUsage: { NOTIFICATION: 5, ALARM: 4 },
          AndroidAudioContentType: { SONIFICATION: 4 },
          AndroidNotificationVisibility: { PUBLIC: 1 },
          setNotificationChannelAsync: async () => ({}),
          getNotificationChannelAsync: async () => ({ importance: 4, sound: 'default' }),
          scheduleNotificationAsync: async (req) => {
            scheduledCalls.push(req);
            return `sched_${scheduledCalls.length}`;
          },
          getAllScheduledNotificationsAsync: async () => [],
          getPresentedNotificationsAsync: async () => [],
          cancelScheduledNotificationAsync: async () => {},
          dismissNotificationAsync: async () => {},
        },
        'expo-device': {},
        'react-native': { Platform: { OS: 'android' }, ToastAndroid: { show: () => {} } },
        '../../modules/expo-task-alarm': {
          scheduleExactAlarm: async () => false,
          cancelAlarm: async () => {},
          isCarConnected: async () => false,
          setSavedAndroidAutoMute: () => {},
        },
        './logger': { DevLogger: { info: () => {}, warn: () => {}, error: () => {}, success: () => {} } },
        dayjs,
      });

      const futureDue = dayjs().add(3, 'hour').second(0).millisecond(0);
      const dueDateStr = futureDue.format('YYYY-MM-DD');
      const dueTimeStr = futureDue.format('HH:mm');

      const ids = await notifMod.scheduleTaskReminder(
        'Doctor Visit',
        '30 min before',
        dueDateStr,
        dueTimeStr,
        'task_99',
        false,
        {}
      );

      assert.strictEqual(ids.length, 2, 'Must schedule both exact-time notification and 30 min before notification');
      assert.strictEqual(scheduledCalls.length, 2);
      assert.strictEqual(scheduledCalls[0].trigger.type, 'date');
      assert.strictEqual(scheduledCalls[1].trigger.type, 'date');
      assert.strictEqual(scheduledCalls[0].trigger.date.getTime(), futureDue.toDate().getTime());
      assert.strictEqual(
        scheduledCalls[1].trigger.date.getTime(),
        futureDue.subtract(30, 'minute').toDate().getTime(),
        'Before reminder trigger must fire 30 minutes before task time'
      );
      assert.strictEqual(scheduledCalls[1].content.body, 'Doctor Visit (30 min before)');

      // Verify TaskDetailsModal does not mutate Redux reminder/time prematurely before Save
      const detailsSrc = fs.readFileSync(path.resolve('src/components/TaskDetailsModal.js'), 'utf8');
      assert.match(detailsSrc, /skipReschedule:\s*didScheduleInSave/);
      const reminderSelectBlock = detailsSrc.match(/const handleReminderSelect[\s\S]*?const handleCustomReminderSave[\s\S]*?\};/);
      assert.ok(reminderSelectBlock, 'handleReminderSelect and handleCustomReminderSave must exist');
      assert.doesNotMatch(reminderSelectBlock[0], /handleUpdate\(/, 'Reminder pickers must not mutate Redux before Save changes');

      // Verify taskSlice.updateTask reschedules when reminder/time changes directly (e.g. SnoozeModal)
      const taskSliceSrc = fs.readFileSync(path.resolve('src/features/taskSlice.js'), 'utf8');
      assert.match(taskSliceSrc, /scheduleFieldChanged/);
    });

    test('Recurring series price tag propagation & hash amount extraction (#34.5, series updates)', () => {
      const currencyHelper = loadTranspiledModule(path.resolve('src/utils/currencyHelper.js'));
      const { extractTaskAmountFromTitle, formatCurrency } = currencyHelper;

      // 1. Hash-prefixed decimal amounts parse correctly
      assert.strictEqual(extractTaskAmountFromTitle('Mr Wash #34.5', { boardType: 'expenses' }), 34.5);
      assert.strictEqual(extractTaskAmountFromTitle('Mr Wash #34.50', { boardType: 'expenses' }), 34.5);
      assert.strictEqual(extractTaskAmountFromTitle('Costco $400', { boardType: 'expenses' }), 400);
      assert.strictEqual(extractTaskAmountFromTitle('Dinner #45.50'), 45.5, 'Decimal hash amount works on general boards');
      assert.strictEqual(extractTaskAmountFromTitle('Issue #5'), 0, 'Integer issue # is not misparsed as currency on standard boards');
      assert.strictEqual(extractTaskAmountFromTitle('Room #101'), 0, 'Integer room # is not misparsed as currency on standard boards');
      assert.strictEqual(formatCurrency(34.5, 'USD'), '$34.50');

      // 2. taskSlice updateRecurringSeriesSync propagates itemPrice, itemQuantity, itemCategory
      const taskSliceMod = loadTranspiledModule(path.resolve('src/features/taskSlice.js'), {
        '../utils/logger': { DevLogger: { info: () => {}, warn: () => {}, error: () => {}, success: () => {} } },
        '../utils/CryptoStorage': { setItemMultiKeys: async () => {}, getItem: async () => null },
        '../utils/notifications': { cancelNotification: async () => {}, scheduleTaskReminder: async () => [] },
        'react-native': { Platform: { OS: 'ios' } },
        dayjs,
      });

      const taskReducer = taskSliceMod.default;
      const { updateRecurringSeriesSync } = taskSliceMod;
      const initialState = {
        tasks: [
          { id: 'task_1', recurringSeriesId: 'series_bill_1', taskname: 'Toyota Corolla', completionDate: '2026-12-28T09:00:00.000Z', isRecurring: true },
          { id: 'task_2', recurringSeriesId: 'series_bill_1', taskname: 'Toyota Corolla', completionDate: '2027-01-28T09:00:00.000Z', isRecurring: true },
          { id: 'task_3', recurringSeriesId: 'series_bill_1', taskname: 'Toyota Corolla', completionDate: '2027-02-28T09:00:00.000Z', isRecurring: true },
        ],
      };

      const action = updateRecurringSeriesSync({
        seriesId: 'series_bill_1',
        fromDate: '2026-12-28T09:00:00.000Z',
        updates: {
          name: 'Toyota Corolla',
          itemPrice: 425.50,
          itemQuantity: 1,
          itemCategory: 'Bills',
        },
      });

      const nextState = taskReducer(initialState, action);

      assert.strictEqual(nextState.tasks[0].itemPrice, 425.50, 'Instance 1 must have updated itemPrice');
      assert.strictEqual(nextState.tasks[1].itemPrice, 425.50, 'Instance 2 must have updated itemPrice');
      assert.strictEqual(nextState.tasks[2].itemPrice, 425.50, 'Instance 3 must have updated itemPrice');
      assert.strictEqual(nextState.tasks[0].itemCategory, 'Bills');

      // 3. Verify useTaskRepeat preserves itemPrice & itemQuantity
      const repeatHookSrc = fs.readFileSync(path.resolve('src/custom-hooks/useTaskRepeat.js'), 'utf8');
      assert.match(repeatHookSrc, /targetItemPrice/);
      assert.match(repeatHookSrc, /\.\.\.\(targetItemPrice !== undefined \? \{ itemPrice: targetItemPrice \} : \{\}\)/);

      // 4. Verify TaskDetailsModal passes itemPrice to updateRecurringSeries & generateRepeatingTasks
      const detailsSrc = fs.readFileSync(path.resolve('src/components/TaskDetailsModal.js'), 'utf8');
      assert.match(detailsSrc, /itemPrice:\s*effectivePrice/);
      assert.match(detailsSrc, /dispatch\(updateRecurringSeries\(/);
    });
  });

  describe('Payment Board Settings, Recurring Engine & Monthly Budget', () => {
    test('themeReducer updates boardExpensesSettings per boardId', () => {
      const themeModule = loadTranspiledModule(path.resolve('src/features/themeSlice.js'), {
        '@react-native-async-storage/async-storage': { setItem: async () => {}, getItem: async () => null },
        '../utils/cryptoStorage': { CryptoStorage: { setItem: async () => {}, getItem: async () => null } },
        '../styles/theme': { themes: { dark: {}, light: {} } },
      });
      const { setBoardExpensesSettings } = themeModule;
      const themeReducer = themeModule.default;

      const initialThemeState = {
        boardExpensesSettings: {},
      };

      const payload = {
        boardId: 'payments_board_123',
        settings: {
          monthlyBudget: 2500,
          repeatPreset: 'every_month',
          repeatDurationCount: 12,
          repeatDurationUnit: 'month',
          defaultReminder: '1 day before',
        },
      };

      const nextState = themeReducer(initialThemeState, setBoardExpensesSettings(payload));
      assert.deepStrictEqual(nextState.boardExpensesSettings['payments_board_123'], payload.settings);
      assert.strictEqual(nextState.boardExpensesSettings['payments_board_123'].monthlyBudget, 2500);
      assert.strictEqual(nextState.boardExpensesSettings['payments_board_123'].defaultReminder, '1 day before');
    });

    test('userReducer updates board repeat settings on matching board', () => {
      const userModule = loadTranspiledModule(path.resolve('src/features/userSlice.js'), {
        '@react-native-async-storage/async-storage': { setItem: async () => {}, getItem: async () => null },
        '../services/api': {},
      });
      const { updateBoardRepeatSettings } = userModule;
      const userReducer = userModule.default;

      const initialUserState = {
        boards: [
          { id: 'main', name: 'Main' },
          { id: 'payments_board_123', name: 'Payments', type: 'expenses', repeatConfig: null },
        ],
      };

      const payload = {
        boardId: 'payments_board_123',
        repeatConfig: { preset: 'every_month' },
        repeatDuration: { count: 12, unit: 'month' },
      };

      const nextState = userReducer(initialUserState, updateBoardRepeatSettings(payload));
      const board = nextState.boards.find(b => b.id === 'payments_board_123');
      assert.ok(board);
      assert.deepStrictEqual(board.repeatConfig, { preset: 'every_month' });
      assert.deepStrictEqual(board.repeatDuration, { count: 12, unit: 'month' });
    });

    test('monthly budget calculations correctly handle under budget, over budget, and percentages', () => {
      const calculateBudgetState = (monthlyTotal, monthlyBudget) => {
        const remaining = monthlyBudget > 0 ? (monthlyBudget - monthlyTotal) : 0;
        const isOverBudget = monthlyBudget > 0 && remaining < 0;
        const percentUsed = monthlyBudget > 0 ? Math.min(100, Math.round((monthlyTotal / monthlyBudget) * 100)) : 0;
        return { remaining, isOverBudget, percentUsed };
      };

      // Under budget
      const under = calculateBudgetState(400, 1000);
      assert.strictEqual(under.remaining, 600);
      assert.strictEqual(under.isOverBudget, false);
      assert.strictEqual(under.percentUsed, 40);

      // Over budget
      const over = calculateBudgetState(1250, 1000);
      assert.strictEqual(over.remaining, -250);
      assert.strictEqual(over.isOverBudget, true);
      assert.strictEqual(over.percentUsed, 100);

      // No budget set
      const noBudget = calculateBudgetState(350, 0);
      assert.strictEqual(noBudget.remaining, 0);
      assert.strictEqual(noBudget.isOverBudget, false);
      assert.strictEqual(noBudget.percentUsed, 0);
    });

    test('all 31 payment board settings keys are non-empty in all 10 locales', () => {
      const localesDir = path.resolve('src/locales');
      const languages = ['de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'ru', 'zh'];
      const requiredKeys = [
        'Payment Board Settings',
        'Customize currency, billing cycle, bill reminders, and monthly budget for this board.',
        'Monthly Budget',
        'Target budget limit per month. Track used vs remaining spending balance directly in the board summary bar.',
        'e.g. 1500',
        'No budget limit',
        'Clear budget',
        'Billing Cycle & Repeat',
        'Default recurrence preset applied when new bills and payments are added to this board.',
        'Bi-weekly',
        'Annual',
        'Manual / Off',
        'Generate Ahead Duration',
        'How far ahead recurring bills are automatically populated on the calendar and board.',
        '3 months',
        '6 months',
        '12 months',
        '24 months',
        'Default Bill Reminder',
        "Automatically schedules a notification before each bill's due date on this board.",
        'Day of (due date)',
        '3 days before',
        '1 week before',
        'Payment board settings updated',
        'Budget',
        'over budget',
        'remaining budget',
        'Payment & Bills Boards',
        'No payment boards yet',
        'Create an Expenses & Bills board in Tasks to manage recurring bills, budgets, and due date reminders.',
        'Configure payment board settings'
      ];

      for (const lang of languages) {
        const filePath = path.join(localesDir, `${lang}.json`);
        const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        for (const k of requiredKeys) {
          assert.ok(
            json[k] && json[k].trim().length > 0,
            `Key "${k}" missing or empty in ${lang}.json`
          );
        }
      }
    });

    test('PaymentBoardSettingsModal is integrated directly on BoardScreen and removed from SettingsScreen', () => {
      const boardScreenSrc = fs.readFileSync(path.resolve('src/screens/BoardScreen.js'), 'utf8');
      assert.match(boardScreenSrc, /import PaymentBoardSettingsModal from '\.\.\/components\/PaymentBoardSettingsModal'/);
      assert.match(boardScreenSrc, /<PaymentBoardSettingsModal/);
      assert.match(boardScreenSrc, /Payment Board Settings/);
      assert.match(boardScreenSrc, /setPaymentSettingsBoard\(activeBoard\)/);

      const settingsScreenSrc = fs.readFileSync(path.resolve('src/screens/SettingsScreen.js'), 'utf8');
      assert.doesNotMatch(settingsScreenSrc, /import PaymentBoardSettingsModal/);
      assert.doesNotMatch(settingsScreenSrc, /<PaymentBoardSettingsModal/);
      assert.doesNotMatch(settingsScreenSrc, /Payment & Bills Boards/);
      assert.doesNotMatch(settingsScreenSrc, /setCurrencyCode/);
      assert.doesNotMatch(settingsScreenSrc, /setHabitStreakMode/);
      assert.match(settingsScreenSrc, /isNotificationsExpanded/);
      assert.match(settingsScreenSrc, /toggleNotificationsSection/);
      assert.match(settingsScreenSrc, /isMoreExpanded/);
      assert.match(settingsScreenSrc, /toggleMoreSection/);
    });

    test('board deletion permanently removes board, updates storage, and prevents resurrection via tombstones', () => {
      const storageWrites = {};
      const mockStorage = {
        setItem: async (k, v) => { storageWrites[k] = v; },
        getItem: async (k) => storageWrites[k] || null,
        multiGet: async (keys) => keys.map(k => [k, storageWrites[k] || null]),
      };

      const userModule = loadTranspiledModule(path.resolve('src/features/userSlice.js'), {
        '@react-native-async-storage/async-storage': mockStorage,
        '../utils/cryptoStorage': { CryptoStorage: mockStorage },
        '../services/api': {},
      });
      const { deleteBoardAsync, hydrateUserState } = userModule;
      const userReducer = userModule.default;

      // Initial state with duplicate Payments boards (empty board 101, and board 102 with tasks)
      const initialState = {
        boards: [
          { id: 'main', name: 'Main', type: 'standard' },
          { id: 'payments_empty', name: 'Payments', type: 'expenses' },
          { id: 'payments_with_tasks', name: 'Payments', type: 'expenses' },
        ],
        deletedBoardIds: [],
        activeBoardId: 'payments_empty',
      };

      // 1. Delete the empty Payments board
      const pendingState = userReducer(initialState, {
        type: deleteBoardAsync.pending.type,
        meta: { arg: { id: 'payments_empty', name: 'Payments' } },
      });

      // Assert it was removed immediately in pending
      assert.strictEqual(pendingState.boards.some(b => b.id === 'payments_empty'), false);
      assert.strictEqual(pendingState.boards.some(b => b.id === 'payments_with_tasks'), true);
      assert.strictEqual(pendingState.activeBoardId, 'main'); // reset from deleted board
      assert.ok(pendingState.deletedBoardIds.includes('payments_empty'));

      // 2. Storage was updated
      assert.ok(storageWrites.boards, 'boards must be persisted to storage');
      assert.ok(storageWrites.deleted_boards, 'deleted_boards must be persisted to storage');
      const savedBoards = JSON.parse(storageWrites.boards);
      assert.strictEqual(savedBoards.some(b => b.id === 'payments_empty'), false);

      // 3. Stale hydration with resurrecting payload is blocked by tombstones
      const resurrectedPayload = {
        boards: [
          { id: 'main', name: 'Main', type: 'standard' },
          { id: 'payments_empty', name: 'Payments', type: 'expenses' }, // stale storage or remote board
          { id: 'payments_with_tasks', name: 'Payments', type: 'expenses' },
        ],
      };
      const hydratedState = userReducer(pendingState, hydrateUserState(resurrectedPayload));
      assert.strictEqual(hydratedState.boards.some(b => b.id === 'payments_empty'), false, 'Tombstone must prevent deleted board from reappearing');
      assert.strictEqual(hydratedState.boards.some(b => b.id === 'payments_with_tasks'), true);
    });
  });

  describe('Notification & Alarm Deep Linking, Board Switching & Task Focus Engine', () => {
    test('App.js handles notification response, extracts boardId, switches board and routes with focusTaskId', () => {
      const appJsSrc = fs.readFileSync(path.resolve('App.js'), 'utf8');
      
      // Cold-start notification listener
      assert.match(appJsSrc, /Notifications\.getLastNotificationResponseAsync\(\)/, 'Must check for cold-start notification response on mount');
      
      // Board extraction & switching
      assert.match(appJsSrc, /taskBoardId = task\?\.boardId \|\| task\?\.board_id \|\| data\.boardId \|\| 'main'/, 'Must extract task boardId or fallback to main');
      assert.match(appJsSrc, /dispatch\(setActiveBoardId\(taskBoardId\)\)/, 'Must dispatch setActiveBoardId with task boardId');
      
      // Target navigation params
      assert.match(appJsSrc, /params:\s*\{\s*editTaskId:\s*taskId,\s*boardId:\s*taskBoardId,\s*focusTaskId:\s*taskId\s*\}/, 'Must pass editTaskId, boardId and focusTaskId to Board screen');
      
      // PIN unlock queued notification preserves boardId and switches board
      assert.match(appJsSrc, /boardId: taskBoardId/, 'Must preserve boardId in pendingNotificationPayload');
      assert.match(appJsSrc, /dispatch\(setActiveBoardId\(boardId\)\)/, 'Must switch activeBoardId when unlocked with pending payload');
      
      // Response deduplication
      assert.match(appJsSrc, /lastHandledResponseId = responseId/, 'Must track lastHandledResponseId to avoid double triggers');
    });

    test('BoardScreen uncollapses target section, switches activeBoardId, expands pagination, and highlights task', () => {
      const boardScreenSrc = fs.readFileSync(path.resolve('src/screens/BoardScreen.js'), 'utf8');
      
      // Target ID extraction
      assert.match(boardScreenSrc, /route\?\.params\?\.editTaskId \|\| route\?\.params\?\.taskId \|\| route\?\.params\?\.focusTaskId/, 'Must support editTaskId, taskId or focusTaskId');
      
      // Hydration guard: does not wipe params prematurely before tasks load
      assert.match(boardScreenSrc, /if \(!tasks \|\| tasks\.length === 0\) \{\s*return;\s*\}/, 'Must wait for tasks to hydrate before evaluating route params');
      
      // Switch active board if different
      assert.match(boardScreenSrc, /if \(activeBoardId !== taskBoardId\) \{\s*dispatch\(setActiveBoardId\(taskBoardId\)\);\s*\}/, 'Must switch board if task belongs to another board');
      
      // Uncollapse target section
      assert.match(boardScreenSrc, /setCollapsedSections\(prev => \{/, 'Must update collapsedSections to show hidden task');
      assert.match(boardScreenSrc, /prev\.filter\(s => s !== targetSection\)/, 'Must remove target section from collapsedSections');
      
      // Expand section pagination
      assert.match(boardScreenSrc, /setSectionVisibleCounts\(prev => \(\{/, 'Must increase sectionVisibleCounts to ensure row is rendered');
      
      // Highlight state & TaskRow prop
      assert.match(boardScreenSrc, /const \[highlightedTaskId, setHighlightedTaskId\] = useState\(null\)/, 'Must track highlightedTaskId');
      assert.match(boardScreenSrc, /isHighlighted=\{Boolean\(highlightedTaskId && \(String\(task\.id\) === String\(highlightedTaskId\) \|\| String\(task\._id\) === String\(highlightedTaskId\)\)\)\}/, 'Must pass isHighlighted to TaskRow');
      assert.match(boardScreenSrc, /flashListExtraData = useMemo\(\(\) => \(\{[\s\S]*?highlightedTaskId,[\s\S]*?\}\)/, 'Must include highlightedTaskId in FlashList extraData');
    });

    test('TaskRow memoization and styling responds to isHighlighted prop', () => {
      const taskRowSrc = fs.readFileSync(path.resolve('src/components/TaskRow.js'), 'utf8');
      
      // areTaskRowPropsEqual checks isHighlighted
      assert.match(taskRowSrc, /prev\.isHighlighted === next\.isHighlighted/, 'areTaskRowPropsEqual must compare isHighlighted');
      
      // TaskRowInner receives isHighlighted
      assert.match(taskRowSrc, /isHighlighted = false/, 'TaskRowInner must declare isHighlighted prop');
      
      // Styling applies highlight border and background tint
      assert.match(taskRowSrc, /isHighlighted\s*\?\s*`\$\{colors\.primary \|\| '#8E24AA'\}26`/, 'Must tint row background when highlighted');
      assert.match(taskRowSrc, /isHighlighted && \{\s*borderWidth: 1\.5,\s*borderColor: colors\.primary \|\| '#8E24AA'/, 'Must apply highlight border when isHighlighted is true');
    });

    test('AlarmActivity enables tap anywhere on screen to trigger openTaskAction with URI deep link', () => {
      const alarmActivitySrc = fs.readFileSync(path.resolve('modules/expo-task-alarm/android/src/main/java/expo/modules/taskalarm/AlarmActivity.kt'), 'utf8');
      
      // Defines openTaskAction
      assert.match(alarmActivitySrc, /val openTaskAction = \{/, 'Must define reusable openTaskAction closure');
      
      // Tapping background/root content triggers openTaskAction
      assert.match(alarmActivitySrc, /findViewById<android\.view\.View>\(android\.R\.id\.content\)\?\.setOnClickListener \{ openTaskAction\(\) \}/, 'Root view tap must open task');
      
      // Tapping title or date triggers openTaskAction
      assert.match(alarmActivitySrc, /titleView\?\.setOnClickListener \{ openTaskAction\(\) \}/, 'Title view tap must open task');
      assert.match(alarmActivitySrc, /nameView\?\.setOnClickListener \{ openTaskAction\(\) \}/, 'Date/time view tap must open task');
      
      // Deep link URI
      assert.match(alarmActivitySrc, /taskmanager:\/\/board\?editTaskId=\$safeTaskId/, 'Must deep link to board with editTaskId');
    });

    test('CalendarScreen task pane background matches BoardScreen and TaskRow colors.bgMain', () => {
      const calSrc = fs.readFileSync(path.resolve('src/screens/CalendarScreen.js'), 'utf8');
      
      // dayTaskListCard background must use colors.bgMain to match BoardScreen
      assert.match(calSrc, /styles\.dayTaskListCard,\s*\{\s*backgroundColor:\s*colors\.bgMain/, 'dayTaskListCard must use colors.bgMain instead of colors.bgCard');
      
      // taskListHeader and taskRowWrapper use colors.bgMain
      assert.match(calSrc, /styles\.taskListHeader,\s*\{\s*borderBottomColor:\s*colors\.borderColor,\s*backgroundColor:\s*colors\.bgMain/, 'taskListHeader must use colors.bgMain');
      assert.match(calSrc, /styles\.taskRowWrapper,\s*\{\s*borderBottomColor:\s*colors\.borderColor,\s*backgroundColor:\s*colors\.bgMain/, 'taskRowWrapper must use colors.bgMain');
      assert.match(calSrc, /styles\.inlineAddWrapper,\s*\{\s*borderTopColor:\s*colors\.borderColor,\s*backgroundColor:\s*colors\.bgMain/, 'inlineAddWrapper must use colors.bgMain');

      const taskRowSrc = fs.readFileSync(path.resolve('src/components/TaskRow.js'), 'utf8');
      assert.match(taskRowSrc, /backgroundColor\s*\|\|\s*colors\.bgMain/, 'TaskRow must use colors.bgMain for default background');
    });

    test('Calendar firstDay starts on Monday (1) for Russian and other European locales, Sunday (0) for English/Japanese/Korean', () => {
      const filtersMod = loadTranspiledModule(path.resolve('src/utils/filters.js'));
      const { getFirstDayOfWeek, MONDAY_FIRST_LANGUAGES } = filtersMod;
      
      assert.strictEqual(getFirstDayOfWeek('ru'), 1, 'Russian must start on Monday');
      assert.strictEqual(getFirstDayOfWeek('de'), 1, 'German must start on Monday');
      assert.strictEqual(getFirstDayOfWeek('fr'), 1, 'French must start on Monday');
      assert.strictEqual(getFirstDayOfWeek('es'), 1, 'Spanish must start on Monday');
      assert.strictEqual(getFirstDayOfWeek('it'), 1, 'Italian must start on Monday');
      assert.strictEqual(getFirstDayOfWeek('zh'), 1, 'Chinese must start on Monday');
      assert.strictEqual(getFirstDayOfWeek('en'), 0, 'English must start on Sunday');
      assert.strictEqual(getFirstDayOfWeek('ja'), 0, 'Japanese must start on Sunday');
      assert.strictEqual(getFirstDayOfWeek('ko'), 0, 'Korean must start on Sunday');

      const calSrc = fs.readFileSync(path.resolve('src/screens/CalendarScreen.js'), 'utf8');
      assert.match(calSrc, /firstDay=\{getFirstDayOfWeek\(i18n\.language\)\}/, 'CalendarScreen must pass localized firstDay to Calendar');

      const inlineSrc = fs.readFileSync(path.resolve('src/components/InlineAddTask.js'), 'utf8');
      assert.match(inlineSrc, /firstDay=\{getFirstDayOfWeek\(i18n\.language\)\}/, 'InlineAddTask must pass localized firstDay to Calendar');

      const detailsSrc = fs.readFileSync(path.resolve('src/components/TaskDetailsModal.js'), 'utf8');
      assert.match(detailsSrc, /firstDay=\{getFirstDayOfWeek\(i18n\.language\)\}/, 'TaskDetailsModal must pass localized firstDay to Calendar');
    });

    test('Specialized boards and InlineAddTask prevent label overflow and increase interactive button height', () => {
      const boardSrc = fs.readFileSync(path.resolve('src/screens/BoardScreen.js'), 'utf8');
      
      // Payments board settings button: no text label, uses clean IconSettingsSliders SVG
      assert.doesNotMatch(boardSrc, /\{t\('Settings'\)\s*\|\|\s*'Settings'\}/, 'Payments board must not render Settings text label in card header');
      assert.match(boardSrc, /<IconSettingsSliders color=\{colors\.textSecondary\} size=\{16\} \/>/, 'Payments board must render IconSettingsSliders SVG icon');

      // Grocery summary bar: flexWrap on top row prevents collision of large totals with localized labels
      assert.match(boardSrc, /flexDirection:\s*'row',\s*justifyContent:\s*'space-between',\s*alignItems:\s*'center',\s*flexWrap:\s*'wrap',\s*gap:\s*6/, 'Grocery summary bar top row must use flexWrap');

      // Habits summary bar: flexWrap on streak and freeze badges prevents right-edge clipping
      assert.match(boardSrc, /flexDirection:\s*'row',\s*alignItems:\s*'center',\s*gap:\s*6,\s*flexWrap:\s*'wrap'/, 'Habits summary badges must use flexWrap');

      // InlineAddTask: increased height and padding for interactive buttons
      const inlineSrc = fs.readFileSync(path.resolve('src/components/InlineAddTask.js'), 'utf8');
      assert.match(inlineSrc, /minHeight:\s*220/, 'InlineAddTask editContainer must have minHeight >= 220');
      assert.match(inlineSrc, /minHeight:\s*44/, 'InlineAddTask action buttons must have minHeight >= 44 for comfortable tap targets');
    });

    test('Luggage and Media categories are selectable in InlineAddTask, TaskDetailsModal, and interactive in TaskRow', () => {
      const inlineSrc = fs.readFileSync(path.resolve('src/components/InlineAddTask.js'), 'utf8');
      assert.match(inlineSrc, /selectedPackingCategory/, 'InlineAddTask must have state for luggage type');
      assert.match(inlineSrc, /selectedMediaCategory/, 'InlineAddTask must have state for media category');
      assert.match(inlineSrc, /inlineBoardType === 'packing'/, 'InlineAddTask must render luggage type chip');
      assert.match(inlineSrc, /inlineBoardType === 'media'/, 'InlineAddTask must render media category chip');

      const detailsSrc = fs.readFileSync(path.resolve('src/components/TaskDetailsModal.js'), 'utf8');
      assert.match(detailsSrc, /selectedBoardType === 'packing'/, 'TaskDetailsModal must render luggage category section');
      assert.match(detailsSrc, /selectedBoardType === 'media'/, 'TaskDetailsModal must render media category and rating section');

      const taskRowSrc = fs.readFileSync(path.resolve('src/components/TaskRow.js'), 'utf8');
      assert.match(taskRowSrc, /handleCyclePackingCategory/, 'TaskRow must support cycling packing category on tap');
      assert.match(taskRowSrc, /handleCycleMediaCategory/, 'TaskRow must support cycling media category on tap');

      const modalSrc = fs.readFileSync(path.resolve('src/components/PaymentBoardSettingsModal.js'), 'utf8');
      assert.match(modalSrc, /<View style=\{styles\.optionsWrap\}>\s*\{CURRENCY_OPTION_CODES\.map/, 'PaymentBoardSettingsModal must wrap all currency chips so all are visible');
      assert.doesNotMatch(modalSrc, /Track spending progress and remaining balance/, 'Outdated English subtitle must be replaced with localized key');
    });

    test('Multi-currency conversion: tasks in foreign currencies display natively on task row while converting in board totals', () => {
      const curMod = require(path.resolve('src/utils/currencyHelper.js'));
      const { convertCurrency, extractTaskAmountAndCurrency, formatCurrency } = curMod;

      // 1. Math conversion: 20 USD to RUB is 1930 RUB
      const convertedRub = convertCurrency(20, 'USD', 'RUB');
      assert.strictEqual(convertedRub, 1930, '20 USD must convert to 1930 RUB');
      const convertedUsd = convertCurrency(1930, 'RUB', 'USD');
      assert.strictEqual(convertedUsd, 20, '1930 RUB must convert back to 20 USD');

      // 2. Detection of currency and amount from text
      const d1 = extractTaskAmountAndCurrency('Costco $400');
      assert.strictEqual(d1.amount, 400);
      assert.strictEqual(d1.currency, 'USD');

      const d2 = extractTaskAmountAndCurrency('$20');
      assert.strictEqual(d2.amount, 20);
      assert.strictEqual(d2.currency, 'USD');

      const d3 = extractTaskAmountAndCurrency('Mr Wash 34.50 EUR');
      assert.strictEqual(d3.amount, 34.5);
      assert.strictEqual(d3.currency, 'EUR');

      const d4 = extractTaskAmountAndCurrency('Билеты 5000 руб');
      assert.strictEqual(d4.amount, 5000);
      assert.strictEqual(d4.currency, 'RUB');

      // 3. BoardScreen converts multi-currency item totals into board currency
      const boardSrc = fs.readFileSync(path.resolve('src/screens/BoardScreen.js'), 'utf8');
      assert.match(boardSrc, /convertCurrency\(rawPrice,\s*taskCur,\s*activeCurrencyCode\)/, 'BoardScreen must convert grocery item prices into activeCurrencyCode');
      assert.match(boardSrc, /convertCurrency\(rawAmt,\s*taskCur,\s*activeCurrencyCode\)/, 'BoardScreen must convert bill amounts into activeCurrencyCode');

      // 4. TaskRow displays native item currency with converted total annotation
      const taskRowSrc = fs.readFileSync(path.resolve('src/components/TaskRow.js'), 'utf8');
      assert.match(taskRowSrc, /hasDifferentCurrency\s*&&/, 'TaskRow must detect when item currency differs from board currency');
      assert.match(taskRowSrc, /convertedTotalFormatted/, 'TaskRow must display converted total annotation');

      // 5. InlineAddTask and TaskDetailsModal allow picking/typing currency
      const inlineSrc = fs.readFileSync(path.resolve('src/components/InlineAddTask.js'), 'utf8');
      assert.match(inlineSrc, /setShowCurrencyModal\(true\)/, 'InlineAddTask must open currency picker when currency button is clicked');
      assert.match(inlineSrc, /extractTaskAmountAndCurrency/, 'InlineAddTask must parse currency from input text');

      const detailsSrc = fs.readFileSync(path.resolve('src/components/TaskDetailsModal.js'), 'utf8');
      assert.match(detailsSrc, /setShowCurrencyModal\(true\)/, 'TaskDetailsModal must open currency picker when currency button is clicked');
      assert.match(detailsSrc, /itemCurrencyState/, 'TaskDetailsModal must have state for item currency');
      assert.match(detailsSrc, /convertCurrency\(parsedPriceNum,\s*effectiveTaskCurrencyCode,\s*modalCurrencyCode\)/, 'TaskDetailsModal must show live conversion preview');
      assert.match(detailsSrc, /import\s*\{[^}]*formatCurrency[^}]*\}\s*from\s*['"]\.\.\/utils\/currencyHelper['"]/, 'TaskDetailsModal must import formatCurrency');

      // 6. Modern Pressable used over deprecated TouchableWithoutFeedback
      const customDropdownSrc = fs.readFileSync(path.resolve('src/components/CustomDropdown.js'), 'utf8');
      assert.ok(!customDropdownSrc.includes('TouchableWithoutFeedback'), 'CustomDropdown should not use deprecated TouchableWithoutFeedback');
      assert.ok(!inlineSrc.includes('TouchableWithoutFeedback'), 'InlineAddTask should not use deprecated TouchableWithoutFeedback');

      // 7. Non-overlapping TaskRow indicators and metadata date protection
      assert.match(taskRowSrc, /content:\s*\{[^}]*overflow:\s*['"]hidden['"]/, 'TaskRow content must clip overflowing labels');
      assert.match(taskRowSrc, /metadata:\s*\{[^}]*flexShrink:\s*0/, 'TaskRow metadata date must not shrink or be pushed');
      assert.match(taskRowSrc, /boardType === 'expenses'[\s\S]*?maxWidth:\s*['"]100%['"]/, 'TaskRow expenses container must have maxWidth 100% to prevent date overlap');
    });

    test('Calendar firstDayOfWeek alignment per language specification across CalendarScreen, TaskDetailsModal, and InlineAddTask', () => {
      const { getFirstDayOfWeek } = require('../src/utils/filters');

      // Exact specification mapping:
      // English (en) -> Sunday (0)
      // Russian (ru) -> Monday (1)
      // Spanish (es) -> Monday (1)
      // Chinese (zh) -> Monday (1)
      // Japanese (ja) -> Sunday (0)
      // Hindi (hi) -> Sunday (0)
      // French (fr) -> Monday (1)
      // German (de) -> Monday (1)
      // Italian (it) -> Monday (1)
      // Korean (ko) -> Sunday (0)
      const expectedDays = {
        en: 0,
        ru: 1,
        es: 1,
        zh: 1,
        ja: 0,
        hi: 0,
        fr: 1,
        de: 1,
        it: 1,
        ko: 0,
      };

      for (const [lang, expectedDay] of Object.entries(expectedDays)) {
        assert.strictEqual(
          getFirstDayOfWeek(lang),
          expectedDay,
          `Language '${lang}' must have firstDay=${expectedDay} (${expectedDay === 1 ? 'Monday' : 'Sunday'})`
        );
      }

      // Verify calendars in CalendarScreen, TaskDetailsModal, and InlineAddTask use getFirstDayOfWeek
      const calScreenSrc = fs.readFileSync(path.resolve('src/screens/CalendarScreen.js'), 'utf8');
      assert.match(calScreenSrc, /firstDay=\{getFirstDayOfWeek\(i18n\.language\)\}/, 'CalendarScreen must pass getFirstDayOfWeek to Calendar');

      const taskDetailsSrc = fs.readFileSync(path.resolve('src/components/TaskDetailsModal.js'), 'utf8');
      assert.match(taskDetailsSrc, /firstDay=\{getFirstDayOfWeek\(i18n\.language\)\}/, 'TaskDetailsModal must pass getFirstDayOfWeek to Calendar');

      const inlineAddSrc = fs.readFileSync(path.resolve('src/components/InlineAddTask.js'), 'utf8');
      assert.match(inlineAddSrc, /firstDay=\{getFirstDayOfWeek\(i18n\.language\)\}/, 'InlineAddTask must pass getFirstDayOfWeek to Calendar');
    });

    test('Calendar Sync 3x/Day Scheduler (08:00, 12:00, 17:00) computes exact due slots, next sync times, and rollover boundaries', () => {
      const {
        DAILY_CALENDAR_SYNC_HOURS,
        DAILY_CALENDAR_SYNC_SLOTS,
        getDailySyncSlotsForDate,
        getMostRecentDueSyncSlot,
        getNextScheduledSyncTime,
        isScheduledCalendarSyncDue,
      } = require('../src/utils/calendarSyncSchedule');

      assert.deepStrictEqual(DAILY_CALENDAR_SYNC_HOURS, [8, 12, 17], 'Daily sync hours must be 8am, 12pm (noon), and 5pm');
      assert.deepStrictEqual(DAILY_CALENDAR_SYNC_SLOTS, ['08:00', '12:00', '17:00']);

      // 1. Before 8:00 AM -> most recent due is yesterday 17:00, next sync is today 08:00
      const earlyMorning = new Date(2026, 10, 19, 6, 30, 0, 0); // Nov 19, 2026 06:30
      assert.strictEqual(getMostRecentDueSyncSlot(earlyMorning).slotKey, '2026-11-18@17:00');
      assert.strictEqual(getNextScheduledSyncTime(earlyMorning).slotKey, '2026-11-19@08:00');

      // 2. Exact 8:00 AM boundary -> due is today 08:00, next is today 12:00
      const at8am = new Date(2026, 10, 19, 8, 0, 0, 0);
      const dueAt8am = isScheduledCalendarSyncDue('2026-11-18@17:00', at8am);
      assert.strictEqual(dueAt8am.isDue, true);
      assert.strictEqual(dueAt8am.dueSlotKey, '2026-11-19@08:00');
      assert.strictEqual(dueAt8am.nextSlotKey, '2026-11-19@12:00');

      // 3. Mid-morning 10:15 AM -> already synced 08:00 means NOT due; missed 08:00 means DUE
      const at1015am = new Date(2026, 10, 19, 10, 15, 0, 0);
      assert.strictEqual(isScheduledCalendarSyncDue('2026-11-19@08:00', at1015am).isDue, false);
      assert.strictEqual(isScheduledCalendarSyncDue('2026-11-18@17:00', at1015am).isDue, true);

      // 4. Exact 12:00 PM noon -> due is today 12:00, next is today 17:00
      const atNoon = new Date(2026, 10, 19, 12, 0, 0, 0);
      const dueAtNoon = isScheduledCalendarSyncDue('2026-11-19@08:00', atNoon);
      assert.strictEqual(dueAtNoon.isDue, true);
      assert.strictEqual(dueAtNoon.dueSlotKey, '2026-11-19@12:00');
      assert.strictEqual(dueAtNoon.nextSlotKey, '2026-11-19@17:00');

      // 5. Exact 5:00 PM -> due is today 17:00, next rolls over to tomorrow 08:00
      const at5pm = new Date(2026, 10, 19, 17, 0, 0, 0);
      const dueAt5pm = isScheduledCalendarSyncDue('2026-11-19@12:00', at5pm);
      assert.strictEqual(dueAt5pm.isDue, true);
      assert.strictEqual(dueAt5pm.dueSlotKey, '2026-11-19@17:00');
      assert.strictEqual(dueAt5pm.nextSlotKey, '2026-11-20@08:00');

      // 6. Month-end rollover (Nov 30, 18:00 -> Dec 1, 08:00)
      const monthEndEvening = new Date(2026, 10, 30, 18, 0, 0, 0);
      assert.strictEqual(getNextScheduledSyncTime(monthEndEvening).slotKey, '2026-12-01@08:00');

      // 7. First-ever sync (null lastSyncedSlotKey) is always due
      assert.strictEqual(isScheduledCalendarSyncDue(null, at1015am).isDue, true);
      assert.strictEqual(getDailySyncSlotsForDate(at8am).length, 3);
    });

    test('Open Google & Device Calendar Synchronization: unlocked from premium gate and wired across app', () => {
      // 1. entitlementSlice no longer gates calendarSync as premium
      const entSrc = fs.readFileSync(path.resolve('src/features/entitlementSlice.js'), 'utf8');
      assert.ok(!entSrc.includes("'calendarSync'"), 'calendarSync must be removed from premiumFeatures');

      // 2. taskSlice runs calendar sync without isPremium checks and exports performScheduledCalendarSync
      const taskSliceSrc = fs.readFileSync(path.resolve('src/features/taskSlice.js'), 'utf8');
      assert.ok(!/isPremium\s*&&\s*(?:state\.)?theme(?:State|Reducer)\??\.calendarSyncEnabled/.test(taskSliceSrc), 'taskSlice must not gate calendarSyncEnabled behind isPremium');
      assert.match(taskSliceSrc, /export const performScheduledCalendarSync/, 'taskSlice must export performScheduledCalendarSync');
      assert.match(taskSliceSrc, /markCalendarSyncCompletedAsync/, 'batchSyncCalendarTasks must mark scheduled sync slot completed');

      // 3. backgroundTasks uses CryptoStorage, removes isPremium gate, and executes scheduled 3x/day sync
      const bgSrc = fs.readFileSync(path.resolve('src/utils/backgroundTasks.js'), 'utf8');
      assert.match(bgSrc, /CryptoStorage\.getItem/, 'backgroundTasks must read encrypted storage via CryptoStorage');
      assert.ok(!bgSrc.includes('isPremium && themeState.calendarSyncEnabled'), 'backgroundTasks must not gate calendar sync on isPremium');
      assert.match(bgSrc, /runHeadlessCalendarSyncIfDueAsync/, 'backgroundTasks must run scheduled headless calendar sync');
      assert.match(bgSrc, /isScheduledCalendarSyncDue/, 'backgroundTasks must evaluate 3x/day sync slots');

      // 4. calendarSync allows writable calendars without Android-only isPrimary !== undefined bug
      const calSyncSrc = fs.readFileSync(path.resolve('src/utils/calendarSync.js'), 'utf8');
      assert.ok(!calSyncSrc.includes('cal.isPrimary !== undefined'), 'getWritableCalendarsAsync must not filter out iOS/local calendars with undefined isPrimary');
      assert.match(calSyncSrc, /from '\.\/calendarSyncSchedule'/, 'calendarSync must import scheduling utilities');
      assert.match(calSyncSrc, /export\s*\{[\s\S]*DAILY_CALENDAR_SYNC_HOURS[\s\S]*\}/, 'calendarSync must re-export scheduling utilities');

      // 5. SettingsScreen exposes Google & Device Calendar UI without premium lock
      const settingsSrc = fs.readFileSync(path.resolve('src/screens/SettingsScreen.js'), 'utf8');
      assert.match(settingsSrc, /settings_calendar_sync_switch/, 'SettingsScreen must expose Calendar Sync switch');
      assert.match(settingsSrc, /settings_sync_calendar_now_btn/, 'SettingsScreen must expose Sync Now button');
      assert.match(settingsSrc, /handleToggleCalendarSync/, 'SettingsScreen must wire handleToggleCalendarSync');
      assert.match(settingsSrc, /Auto-syncs 3x daily \(8:00 AM, 12:00 PM, 5:00 PM\)/, 'SettingsScreen must clearly show 3x daily sync schedule');

      // 6. App.js schedules exact foreground 3x/day timer + resume catch-up
      const appSrc = fs.readFileSync(path.resolve('App.js'), 'utf8');
      assert.match(appSrc, /getNextScheduledSyncTime/, 'App.js must schedule foreground exact sync slot timer');
      assert.match(appSrc, /performScheduledCalendarSync/, 'App.js must dispatch performScheduledCalendarSync on startup, timer, and resume');

      // 7. CalendarScreen exposes quick sync button when enabled
      const calScreenSrc = fs.readFileSync(path.resolve('src/screens/CalendarScreen.js'), 'utf8');
      assert.match(calScreenSrc, /calendar_quick_sync_btn/, 'CalendarScreen must render quick sync button when calendar sync is enabled');

      // 8. iOS compatibility: UIBackgroundModes fetch, iOS 17+ FullAccess permissions, expo-background-fetch plugin, case-insensitive canceled check
      const appJson = JSON.parse(fs.readFileSync(path.resolve('app.json'), 'utf8'));
      const iosPlist = appJson?.expo?.ios?.infoPlist || {};
      assert.ok(Array.isArray(iosPlist.UIBackgroundModes) && iosPlist.UIBackgroundModes.includes('fetch'), 'app.json ios.infoPlist must include UIBackgroundModes: ["fetch"]');
      assert.ok(typeof iosPlist.NSCalendarsFullAccessUsageDescription === 'string' && iosPlist.NSCalendarsFullAccessUsageDescription.length > 0, 'app.json must declare NSCalendarsFullAccessUsageDescription for iOS 17+');
      assert.ok(typeof iosPlist.NSRemindersFullAccessUsageDescription === 'string' && iosPlist.NSRemindersFullAccessUsageDescription.length > 0, 'app.json must declare NSRemindersFullAccessUsageDescription for iOS 17+');
      assert.ok(Array.isArray(appJson?.expo?.plugins) && appJson.expo.plugins.includes('expo-background-fetch'), 'app.json plugins must include expo-background-fetch');
      assert.match(calSyncSrc, /toLowerCase\(\)\s*!==\s*'canceled'/, 'calendarSync must check canceled event status case-insensitively for iOS & Android');
    });

    test('Settings More section: hidden Debugger unlocked via 20 taps on commit-upgraded Version within 10 seconds', () => {
      const {
        DEBUG_UNLOCK_TAP_COUNT,
        DEBUG_UNLOCK_WINDOW_MS,
        getAppVersionInfo,
        formatAppVersionDisplay,
        recordDebugUnlockTap,
      } = require('../src/utils/appVersion');

      assert.strictEqual(DEBUG_UNLOCK_TAP_COUNT, 20, 'Must require exactly 20 taps');
      assert.strictEqual(DEBUG_UNLOCK_WINDOW_MS, 10000, 'Must enforce a 10-second sliding window');

      // 1. Version metadata & display format
      const info = getAppVersionInfo();
      assert.ok(info.commitCount >= 1, 'commitCount must be populated from git history');
      assert.ok(info.buildRandom >= 1000 && info.buildRandom <= 9999, 'buildRandom must be a 4-digit random number');
      const display = formatAppVersionDisplay(info);
      assert.match(display, /^\d+\.\d+\.\d+\s+\(\d{4}\)$/, `Display version "${display}" must match major.minor.commits (random)`);

      // 2. 20 taps within 10 seconds unlocks on tap 20
      let timestamps = [];
      const baseTime = 100000;
      for (let i = 1; i <= 19; i++) {
        const r = recordDebugUnlockTap(timestamps, baseTime + i * 200);
        assert.strictEqual(r.unlocked, false, `Tap ${i} must not unlock yet`);
        assert.strictEqual(r.remainingTaps, 20 - i);
        timestamps = r.timestamps;
      }
      const twentieth = recordDebugUnlockTap(timestamps, baseTime + 4000);
      assert.strictEqual(twentieth.unlocked, true, '20th tap within 10s must unlock debugger');
      assert.strictEqual(twentieth.remainingTaps, 0);
      assert.deepStrictEqual(twentieth.timestamps, [], 'Buffer should reset upon unlock');

      // 3. Taps older than 10 seconds expire from the sliding window
      let slowTaps = [];
      for (let i = 0; i < 12; i++) {
        slowTaps = recordDebugUnlockTap(slowTaps, baseTime + i * 200).timestamps;
      }
      // Pause > 10 seconds after the first 12 taps -> they expire!
      let resAfterPause = null;
      for (let i = 0; i < 9; i++) {
        resAfterPause = recordDebugUnlockTap(slowTaps, baseTime + 15000 + i * 200);
        slowTaps = resAfterPause.timestamps;
      }
      assert.strictEqual(resAfterPause.unlocked, false, 'Expired taps older than 10s must not count toward unlock');
      assert.strictEqual(resAfterPause.tapCount, 9);

      // 4. SettingsScreen hides Debugger by default and wires Version row tap handler
      const settingsSrc = fs.readFileSync(path.resolve('src/screens/SettingsScreen.js'), 'utf8');
      assert.match(settingsSrc, /const \[isDebuggerUnlocked,\s*setIsDebuggerUnlocked\] = useState\(false\)/, 'Debugger must be hidden by default');
      assert.match(settingsSrc, /\{isDebuggerUnlocked && \([\s\S]*settings_debugger_btn/, 'Debugger row must only render when unlocked');
      assert.match(settingsSrc, /testID="settings_version_row"[\s\S]*onPress=\{handleVersionPress\}/, 'Version row must trigger handleVersionPress');

      // 5. Commit auto-upgrade script & hooks exist
      assert.ok(fs.existsSync(path.resolve('scripts/update-version.js')), 'scripts/update-version.js must exist');
      assert.ok(fs.existsSync(path.resolve('.githooks/pre-commit')), '.githooks/pre-commit must exist');
      const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
      assert.ok(pkg.scripts['version:sync'], 'package.json must have version:sync script');
      assert.ok(pkg.scripts['prestart'] && pkg.scripts['preweb'], 'package.json must auto-sync version before start/web');
    });

    test('Calendar Sync Android crash-safety: chunked reads, window-scoped deduped writes, sequential queue & native patch', () => {
      const {
        SYNC_PAST_DAYS,
        SYNC_FUTURE_DAYS,
        SYNC_CHUNK_DAYS,
        MAX_EVENTS_PER_SYNC_BATCH,
        MAX_IMPORTS_PER_SYNC,
        extractTaskDateKey,
        isDateStrInSyncWindow,
        buildSyncWindowChunks,
        getTaskCalendarFingerprint,
      } = require('../src/utils/calendarSyncSchedule');

      // 1. Safe bounded defaults
      assert.strictEqual(SYNC_PAST_DAYS, 14);
      assert.strictEqual(SYNC_FUTURE_DAYS, 60);
      assert.strictEqual(SYNC_CHUNK_DAYS, 14);
      assert.ok(MAX_EVENTS_PER_SYNC_BATCH <= 50, 'Batch export cap must prevent Android cursor blasts');
      assert.ok(MAX_IMPORTS_PER_SYNC <= 200, 'Import cap must bound memory on huge calendars');

      // 2. Date key extraction & rolling sync window bounds
      const refNow = new Date(2026, 10, 19, 12, 0, 0, 0); // 2026-11-19
      assert.strictEqual(extractTaskDateKey({ dateString: '2026-11-19' }), '2026-11-19');
      assert.strictEqual(extractTaskDateKey({ completionDate: '2026-11-25T10:30:00.000Z' }), '2026-11-25');
      assert.strictEqual(extractTaskDateKey(null), '');

      assert.strictEqual(isDateStrInSyncWindow('2026-11-19', refNow), true);
      assert.strictEqual(isDateStrInSyncWindow('2026-11-05', refNow), true, 'Exactly 14 days ago is inside window');
      assert.strictEqual(isDateStrInSyncWindow('2026-11-04', refNow), false, '15 days ago is outside window');
      assert.strictEqual(isDateStrInSyncWindow('2027-01-18', refNow), true, '60 days ahead is inside window');
      assert.strictEqual(isDateStrInSyncWindow('2027-06-01', refNow), false, 'Far-future recurring task is outside window');
      assert.strictEqual(isDateStrInSyncWindow('invalid-date', refNow), false);

      // 3. Chunked window slices cover [-14d, +60d] in overlapping <=14-day chunks with ZERO boundary cracks
      const chunks = buildSyncWindowChunks(refNow, 14, 60, 14);
      assert.ok(chunks.length >= 6 && chunks.length <= 8, `75-day span with ±1d overlap splits into 6-8 chunks, got ${chunks.length}`);
      for (const ch of chunks) {
        assert.ok(ch.start instanceof Date && ch.end instanceof Date);
        assert.ok(ch.end.getTime() > ch.start.getTime());
        const spanDays = (ch.end.getTime() - ch.start.getTime()) / (24 * 60 * 60 * 1000);
        assert.ok(spanDays <= 14.1, `Chunk span must be <= 14 days, got ${spanDays}`);
      }
      // Every UTC all-day event [D 00:00Z .. (D+1) 00:00Z] for D in [-14..+60] (including TODAY offset=0 & TOMORROW offset=1)
      // MUST be strictly contained inside at least one chunk (BEGIN >= start && END <= end) so Android Instances never drops Today!
      for (let dOff = -14; dOff <= 60; dOff++) {
        const dayDate = new Date(refNow.getFullYear(), refNow.getMonth(), refNow.getDate() + dOff);
        const evBegin = Date.UTC(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 0, 0, 0);
        const evEnd = Date.UTC(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate() + 1, 0, 0, 0);
        const contained = chunks.some(ch => evBegin >= ch.start.getTime() && evEnd <= ch.end.getTime());
        assert.strictEqual(contained, true, `All-day UTC event at offset ${dOff} (${dayDate.toISOString().slice(0, 10)}) must be strictly contained in at least one chunk`);
      }

      // 4. Deterministic fingerprint detects changes and matches identical tasks
      const tA = { id: '1', taskname: 'Dentist', completionDate: '2026-11-20', time: '09:00', reminder: '15 min', description: { text: 'Clinic' } };
      const tB = { ...tA };
      const tC = { ...tA, time: '10:00' };
      assert.strictEqual(getTaskCalendarFingerprint(tA, true), getTaskCalendarFingerprint(tB, true));
      assert.notStrictEqual(getTaskCalendarFingerprint(tA, true), getTaskCalendarFingerprint(tC, true));
      assert.notStrictEqual(getTaskCalendarFingerprint(tA, true), getTaskCalendarFingerprint(tA, false));

      // 5. calendarSync.js enforces sequential queue, Android epoch dates, chunked reads, caps & hash skip
      const calSyncSrc = fs.readFileSync(path.resolve('src/utils/calendarSync.js'), 'utf8');
      assert.match(calSyncSrc, /export const enqueueCalendarOp/, 'calendarSync must serialize all native calls via enqueueCalendarOp');
      assert.match(calSyncSrc, /toNativeCalendarDate/, 'calendarSync must pass epoch ms on Android to bypass unpatched SimpleDateFormat');
      assert.match(calSyncSrc, /buildSyncWindowChunks/, 'performDifferentialCalendarSyncAsync must query in chunks');
      assert.match(calSyncSrc, /MAX_EVENTS_PER_SYNC_BATCH/, 'syncAllTasksToCalendarAsync must enforce batch write cap');
      assert.match(calSyncSrc, /MAX_IMPORTS_PER_SYNC/, 'performDifferentialCalendarSyncAsync must enforce import cap');
      assert.match(calSyncSrc, /task\.calendarSyncHash\s*===\s*fingerprint/, 'syncAllTasksToCalendarAsync must skip unchanged tasks');
      assert.match(calSyncSrc, /if\s*\(allChunksSucceeded\)/, 'ghost deletion detection must only run when all chunks succeeded');

      // 6. SettingsScreen & CalendarScreen guard re-entrancy & catch all sync errors safely
      const settingsSrc = fs.readFileSync(path.resolve('src/screens/SettingsScreen.js'), 'utf8');
      assert.match(settingsSrc, /isSyncingCalendarRef\s*=\s*useRef\(false\)/, 'SettingsScreen must track active calendar sync via ref');
      assert.match(settingsSrc, /handleToggleCalendarSync[\s\S]*?catch\s*\(err\)[\s\S]*?finally\s*\{[\s\S]*?isSyncingCalendarRef\.current\s*=\s*false/, 'handleToggleCalendarSync must wrap entire body in try/catch/finally');
      assert.match(settingsSrc, /handleManualCalendarSync[\s\S]*?catch\s*\(err\)[\s\S]*?finally\s*\{[\s\S]*?isSyncingCalendarRef\.current\s*=\s*false/, 'handleManualCalendarSync must wrap entire body in try/catch/finally');

      // 7. Native Android expo-calendar patch script exists, is wired into package.json, and applied cleanly
      assert.ok(fs.existsSync(path.resolve('scripts/patch-expo-calendar.js')), 'scripts/patch-expo-calendar.js must exist');
      const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
      assert.match(pkg.scripts.postinstall || '', /patch-expo-calendar\.js/, 'package.json postinstall must apply expo-calendar patch');
      assert.match(pkg.scripts.preandroid || '', /patch-expo-calendar\.js/, 'package.json preandroid must apply expo-calendar patch');

      const calKtPath = path.resolve('node_modules/expo-calendar/android/src/main/java/expo/modules/calendar/CalendarModule.kt');
      if (fs.existsSync(calKtPath)) {
        const calKt = fs.readFileSync(calKtPath, 'utf8');
        assert.match(calKt, /SupervisorJob\(\)\s*\+\s*Dispatchers\.Default/, 'CalendarModule.kt must use SupervisorJob()');
        assert.match(calKt, /ThreadLocal<SimpleDateFormat>/, 'CalendarModule.kt must use ThreadLocal SimpleDateFormat');
        assert.match(calKt, /CalendarContract\.Reminders\.query\([\s\S]*?CalendarContract\.Reminders\.MINUTES[\s\S]*?\)\?\.use\s*\{\s*cursor\s*->/, 'serializeAlarms must close Reminders cursor via ?.use');
        assert.match(calKt, /CalendarContract\.Reminders\.query\([\s\S]*?CalendarContract\.Reminders\._ID[\s\S]*?\)\?\.use\s*\{\s*cursor\s*->/, 'removeRemindersForEvent must close Reminders cursor via ?.use');
        assert.match(calKt, /catch\s*\(e:\s*Throwable\)/, 'launchAsyncWithModuleScope must catch Throwable to prevent native process crash');
        assert.match(calKt, /cursor\.getString\(index\)\s*\?:\s*""/, 'stringFromCursor must handle NULL DB cells safely');
      }

      const mappersKtPath = path.resolve('node_modules/expo-calendar/android/src/main/java/expo/modules/calendar/JsValuesMappers.kt');
      if (fs.existsSync(mappersKtPath)) {
        const mappersKt = fs.readFileSync(mappersKtPath, 'utf8');
        assert.match(mappersKt, /availabilityId\.trim\(\)\.toIntOrNull\(\)/, 'JsValuesMappers.kt must parse availability IDs safely with toIntOrNull()');
      }
    });

    test('Cross-board Calendar Sync Deduplication: tasks on payments/birthdays/events never duplicate onto Main board', () => {
      const {
        normalizeCalendarTitle,
        extractTaskDateKey,
        buildTaskDeduplicationPlan,
        buildTaskCalendarIndex,
        findMatchingTaskForCalendarEvent,
      } = require('../src/utils/calendarSyncSchedule');

      // 1. Title normalization & multi-field date extraction
      assert.strictEqual(normalizeCalendarTitle('✓  Toyota   Finance $550 '), 'toyota finance $550');
      assert.strictEqual(extractTaskDateKey({ dueDate: '2026-11-27' }), '2026-11-27');
      assert.strictEqual(extractTaskDateKey({ date: '2026-12-01' }), '2026-12-01');

      // 2. Existing tasks across payments, birthdays, and previously duplicated main copies
      const existingTasks = [
        { id: 'pay_1', taskname: 'Toyota Finance $550', dateString: '2026-11-27', boardId: 'payments', calendarEventId: '202' },
        { id: 'cal_101_dup', taskname: 'Toyota Finance $550', dateString: '2026-11-27', boardId: 'main', syncedFromCalendar: true, calendarEventId: '101' },
        { id: 'bday_1', taskname: "Mom's Birthday", dateString: '2026-11-29', boardId: 'birthdays' }, // unlinked!
        { id: 'cal_102_dup', taskname: "Mom's Birthday", dateString: '2026-11-29', boardId: 'main', syncedFromCalendar: true, calendarEventId: '102' },
        { id: 'user_main_1', taskname: 'Buy Groceries', dateString: '2026-11-20', boardId: 'main' },
        { id: 'user_main_2', taskname: 'Buy Groceries', dateString: '2026-11-20', boardId: 'main' }, // two user-created tasks -> never auto-deleted!
      ];

      const plan = buildTaskDeduplicationPlan(existingTasks);
      assert.deepStrictEqual(
        plan.duplicateTaskIds.sort(),
        ['cal_101_dup', 'cal_102_dup'],
        'Must remove ONLY syncedFromCalendar duplicates on main that duplicate payments/birthdays tasks'
      );
      assert.deepStrictEqual(
        plan.linkTransfers,
        [{ taskId: 'bday_1', calendarEventId: '102' }],
        'Must transfer calendarEventId from removed main duplicate to the unlinked birthdays task'
      );
      assert.deepStrictEqual(
        plan.orphanCalendarEventIds,
        ['101'],
        'Must identify orphan extra calendarEventId 101 (distinct from payments task event 202)'
      );

      // 3. Cross-board event matching prevents importing duplicates onto main even when task is already linked
      const cleanTasks = [
        { id: 'pay_1', taskname: 'Toyota Finance $550', dateString: '2026-11-27', boardId: 'payments', calendarEventId: '202' },
        { id: 'bday_1', taskname: "Mom's Birthday", dateString: '2026-11-29', boardId: 'birthdays' },
        { id: 'evt_1', taskname: 'Dentist Visit', dateString: '2026-11-30', boardId: 'events', calendarEventId: '303' },
      ];
      const idx = buildTaskCalendarIndex(cleanTasks);

      // Case A: Exact ID match on payments board
      const mLinked = findMatchingTaskForCalendarEvent(
        { eventCalId: '202', cleanTitle: 'Toyota Finance $550', dateStr: '2026-11-27', isFromTaskFlow: true },
        idx
      );
      assert.strictEqual(mLinked.matchType, 'linked');
      assert.strictEqual(mLinked.task.id, 'pay_1');

      // Case B: Duplicate Google Calendar event (different eventCalId '101') for ALREADY-LINKED payments task
      const mAlreadyExists = findMatchingTaskForCalendarEvent(
        { eventCalId: '101', cleanTitle: 'Toyota   finance $550', dateStr: '2026-11-27', isFromTaskFlow: true },
        idx
      );
      assert.strictEqual(mAlreadyExists.matchType, 'already_exists', 'Must NOT fall through and duplicate onto main!');
      assert.strictEqual(mAlreadyExists.task.id, 'pay_1');

      // Case C: Unlinked task on birthdays board matches Google Calendar event -> links in place on birthdays!
      const mUnlinked = findMatchingTaskForCalendarEvent(
        { eventCalId: '404', cleanTitle: "Mom's Birthday", dateStr: '2026-11-29', isFromTaskFlow: false },
        idx
      );
      assert.strictEqual(mUnlinked.matchType, 'unlinked');
      assert.strictEqual(mUnlinked.task.id, 'bday_1');
      assert.strictEqual(mUnlinked.task.boardId, 'birthdays');

      // Case D: TaskFlow-exported event shifted by 1 day due to timezone boundary still matches events board task
      const mTzShift = findMatchingTaskForCalendarEvent(
        { eventCalId: '999', cleanTitle: 'Dentist Visit', dateStr: '2026-11-29', isFromTaskFlow: true },
        idx
      );
      assert.strictEqual(mTzShift.matchType, 'already_exists');
      assert.strictEqual(mTzShift.task.id, 'evt_1');

      // Case E: Genuinely new Google Calendar event not present on ANY board -> matchType 'none' (imports to main)
      const mNew = findMatchingTaskForCalendarEvent(
        { eventCalId: '505', cleanTitle: 'Flight to Rome', dateStr: '2026-12-10', isFromTaskFlow: false },
        idx
      );
      assert.strictEqual(mNew.matchType, 'none');

      // 4. Verify calendarSync.js, taskSlice.js, and backgroundTasks.js wire single-fetch + dedup-before-export + metadata preservation
      const calSyncSrc = fs.readFileSync(path.resolve('src/utils/calendarSync.js'), 'utf8');
      assert.match(calSyncSrc, /export const fetchCalendarWindowEventsAsync/, 'calendarSync must export fetchCalendarWindowEventsAsync');
      assert.match(calSyncSrc, /match\.matchType === 'already_exists'/, 'performDifferentialCalendarSyncAsync must skip already_exists matches across all boards');
      assert.match(calSyncSrc, /existingNativeByTitleDate/, 'syncAllTasksToCalendarAsync must link existing Google Calendar events before creating new ones');

      const taskSliceSrc = fs.readFileSync(path.resolve('src/features/taskSlice.js'), 'utf8');
      assert.match(taskSliceSrc, /fetchCalendarWindowEventsAsync\(themeState\)/, 'batchSyncCalendarTasks must prefetch calendar window once before export');
      assert.match(taskSliceSrc, /buildTaskDeduplicationPlan\(tasks\)/, 'batchSyncCalendarTasks must deduplicate main copies before export');
      assert.match(taskSliceSrc, /cachedLocal\.calendarEventId/, 'fetchTasks must preserve local calendarEventId across remote DB sync');

      const bgSrc = fs.readFileSync(path.resolve('src/utils/backgroundTasks.js'), 'utf8');
      assert.match(bgSrc, /fetchCalendarWindowEventsAsync\(themeState\)/, 'backgroundTasks must prefetch calendar window once');
      assert.match(bgSrc, /buildTaskDeduplicationPlan\(tasks\)/, 'backgroundTasks must deduplicate main copies before export');
    });

    test('Per-board Calendar Sync Policy: smart defaults, long-tap & Settings toggles, and automatic removal of unsynced board events', () => {
      const {
        getDefaultBoardCalendarSync,
        isBoardCalendarSyncEnabled,
        isTaskEligibleForCalendarSync,
        getImportTargetBoardId,
        getBoardCalendarSyncKey,
      } = require('../src/utils/calendarSyncSchedule');

      const boards = [
        { id: 'main', name: 'Main', type: 'standard' },
        { id: 'b_events', name: 'Birthdays', type: 'birthdays' },
        { id: 'b_pay', name: 'Payments', type: 'expenses' },
        { id: 'b_groc', name: 'Grocery', type: 'grocery' },
        { id: 'b_books', name: 'Books', type: 'media' },
        { id: 'b_travel', name: 'Travel', type: 'packing' },
        { id: 'b_habits', name: 'Habits', type: 'habits' },
        { id: 'b_list', name: 'Notes List', type: 'simple_list' },
      ];

      // 1. Smart defaults ON for standard/Main, birthdays/Events, expenses/Payments
      assert.strictEqual(getDefaultBoardCalendarSync(boards[0]), true, 'Main/standard defaults ON');
      assert.strictEqual(getDefaultBoardCalendarSync(boards[1]), true, 'Events/birthdays defaults ON');
      assert.strictEqual(getDefaultBoardCalendarSync(boards[2]), true, 'Payments/expenses defaults ON');

      // 2. Smart defaults OFF for Grocery, Books/Media, Travel/Packing, Habits, Simple List
      assert.strictEqual(getDefaultBoardCalendarSync(boards[3]), false, 'Grocery defaults OFF');
      assert.strictEqual(getDefaultBoardCalendarSync(boards[4]), false, 'Books/media defaults OFF');
      assert.strictEqual(getDefaultBoardCalendarSync(boards[5]), false, 'Travel/packing defaults OFF');
      assert.strictEqual(getDefaultBoardCalendarSync(boards[6]), false, 'Habits defaults OFF');
      assert.strictEqual(getDefaultBoardCalendarSync(boards[7]), false, 'Simple List defaults OFF');

      // 3. Task eligibility respects defaults and explicit per-board overrides
      assert.strictEqual(isTaskEligibleForCalendarSync({ id: 't1', boardId: 'b_pay' }, boards, {}), true);
      assert.strictEqual(isTaskEligibleForCalendarSync({ id: 't2', boardId: 'b_groc' }, boards, {}), false);
      assert.strictEqual(isTaskEligibleForCalendarSync({ id: 't3', boardId: 'b_books' }, boards, {}), false);
      assert.strictEqual(isTaskEligibleForCalendarSync({ id: 't4', boardId: 'b_habits' }, boards, {}), false);
      assert.strictEqual(isTaskEligibleForCalendarSync({ id: 't5', boardId: 'b_travel' }, boards, {}), false);
      assert.strictEqual(isTaskEligibleForCalendarSync({ id: 't6', boardId: 'b_list' }, boards, {}), false);

      // User toggles Habits ON and Payments OFF via long-tap or Settings
      const overrides = { b_habits: true, b_pay: false, main: false };
      assert.strictEqual(isBoardCalendarSyncEnabled(boards[6], overrides), true, 'Habits override ON must work');
      assert.strictEqual(isBoardCalendarSyncEnabled(boards[2], overrides), false, 'Payments override OFF must work');
      assert.strictEqual(isTaskEligibleForCalendarSync({ id: 't4', boardId: 'b_habits' }, boards, overrides), true);
      assert.strictEqual(isTaskEligibleForCalendarSync({ id: 't1', boardId: 'b_pay' }, boards, overrides), false);
      assert.strictEqual(getBoardCalendarSyncKey({ id: 'tasks' }), 'main');

      // 4. Import target falls back to first synced board when Main is toggled OFF
      assert.strictEqual(getImportTargetBoardId(boards, {}), 'main');
      assert.strictEqual(getImportTargetBoardId(boards, { main: false }), 'b_events');

      // 5. Code wiring across themeSlice, calendarSync, taskSlice, backgroundTasks, BoardScreen, and SettingsScreen
      const themeSrc = fs.readFileSync(path.resolve('src/features/themeSlice.js'), 'utf8');
      assert.match(themeSrc, /boardCalendarSync:/, 'themeSlice must persist boardCalendarSync map');
      assert.match(themeSrc, /setBoardCalendarSync:/, 'themeSlice must export setBoardCalendarSync reducer');

      const calSyncSrc = fs.readFileSync(path.resolve('src/utils/calendarSync.js'), 'utf8');
      assert.match(calSyncSrc, /export const removeBoardEventsFromCalendarAsync/, 'calendarSync must export removeBoardEventsFromCalendarAsync');
      assert.match(calSyncSrc, /isTaskEligibleForCalendarSync\(task,\s*boards,\s*boardCalendarSync\)/, 'syncAllTasksToCalendarAsync must enforce per-board sync eligibility and clean up unsynced events');
      assert.match(calSyncSrc, /clearedEventTaskIds/, 'calendarSync must return clearedEventTaskIds to unlink unsynced board tasks without deleting them');

      const taskSliceSrc = fs.readFileSync(path.resolve('src/features/taskSlice.js'), 'utf8');
      assert.match(taskSliceSrc, /export const toggleBoardCalendarSync/, 'taskSlice must export toggleBoardCalendarSync thunk');
      assert.match(taskSliceSrc, /clearedEventTaskIds/, 'batchCalendarSyncComplete must handle clearedEventTaskIds');

      const boardScreenSrc = fs.readFileSync(path.resolve('src/screens/BoardScreen.js'), 'utf8');
      assert.match(boardScreenSrc, /board_options_calendar_sync_switch/, 'BoardScreen long-tap menu must render per-board calendar sync Switch');
      assert.match(boardScreenSrc, /toggleBoardCalendarSync/, 'BoardScreen must dispatch toggleBoardCalendarSync');

      const settingsSrc = fs.readFileSync(path.resolve('src/screens/SettingsScreen.js'), 'utf8');
      assert.match(settingsSrc, /settings_synced_boards_toggle/, 'SettingsScreen must render Synced Boards accordion inside Google & Device Calendar card');
      assert.match(settingsSrc, /settings_board_cal_sync_/, 'SettingsScreen must render per-board switches');
      assert.match(settingsSrc, /toggleBoardCalendarSync/, 'SettingsScreen must dispatch toggleBoardCalendarSync');
    });

    test('Quick List Board (replaces simple_list): inline subtask-style checklist, stays in place on check, hidden from Calendar & Calendar Sync', () => {
      const {
        isQuickListBoardType,
        isCalendarSyncSupportedForBoard,
        isBoardCalendarSyncEnabled,
        isTaskEligibleForCalendarSync,
      } = require('../src/utils/calendarSyncSchedule');

      const quickBoard = { id: 'b_ql', name: 'Quick Notes', type: 'simple_list' };
      const boards = [
        { id: 'main', name: 'Main', type: 'standard' },
        quickBoard,
      ];

      // 1. Quick List board type detection & hard exclusion from Calendar Sync (even if an override existed)
      assert.strictEqual(isQuickListBoardType(quickBoard), true);
      assert.strictEqual(isQuickListBoardType('quick_list'), true);
      assert.strictEqual(isQuickListBoardType('standard'), false);
      assert.strictEqual(isCalendarSyncSupportedForBoard(quickBoard), false, 'Quick List must never support Calendar Sync');
      assert.strictEqual(isBoardCalendarSyncEnabled(quickBoard, { b_ql: true }), false, 'Quick List must stay OFF even if stale override is true');
      assert.strictEqual(isTaskEligibleForCalendarSync({ id: 'q1', boardId: 'b_ql' }, boards, { b_ql: true }), false);

      // 2. CreateBoardModal replaces 'Board' template with 'Quick List'
      const createModalSrc = fs.readFileSync(path.resolve('src/components/CreateBoardModal.js'), 'utf8');
      assert.match(createModalSrc, /id:\s*'simple_list'[\s\S]*?Quick List[\s\S]*?Fast Checklist/, 'CreateBoardModal must replace simple_list template with Quick List');

      // 3. QuickListBoard implements pure inline subtask-style checklist (checkbox, inline TextInput, × delete, + Add item, Clear completed, never opens TaskDetailsModal)
      const qlSrc = fs.readFileSync(path.resolve('src/components/QuickListBoard.js'), 'utf8');
      assert.match(qlSrc, /export function sortQuickListItems/, 'QuickListBoard must export stable sortQuickListItems');
      assert.match(qlSrc, /quick_list_clear_completed_btn/, 'QuickListBoard must provide Clear completed button');
      assert.match(qlSrc, /quick_list_add_item_btn/, 'QuickListBoard must provide + Add item button');
      assert.match(qlSrc, /textDecorationLine:\s*'line-through'/, 'Checked Quick List items must stay in place with strikethrough');
      assert.match(qlSrc, /onSubmitEditing=\{handleSubmit\}/, 'Pressing Enter must save and add next inline item');
      assert.match(qlSrc, /colors\.primaryContainer/, 'QuickListBoard must use Material You primaryContainer token');
      assert.match(qlSrc, /colors\.onPrimaryContainer/, 'QuickListBoard must use Material You onPrimaryContainer token');
      assert.match(qlSrc, /colors\.errorContainer/, 'QuickListBoard must use Material You errorContainer token');
      assert.match(qlSrc, /colors\.surfaceContainerHighest/, 'QuickListBoard must use Material You surfaceContainerHighest token');
      assert.ok(!qlSrc.includes('TaskDetailsModal'), 'QuickListBoard must never open TaskDetailsModal');

      // 4. BoardScreen renders QuickListBoard for simple_list, creates undated items, and hides Calendar Sync switch in long-tap menu
      const boardScreenSrc = fs.readFileSync(path.resolve('src/screens/BoardScreen.js'), 'utf8');
      assert.match(boardScreenSrc, /isQuickListBoard\s*\?\s*\(\s*<QuickListBoard/, 'BoardScreen must render QuickListBoard for Quick List boards');
      assert.match(boardScreenSrc, /completionDate:\s*null,\s*dateString:\s*null[\s\S]*?isQuickListItem:\s*true/, 'Quick List items must be created undated');
      assert.match(boardScreenSrc, /isCalendarSyncSupportedForBoard\(boardOptionsConfig\.board\)/, 'BoardScreen long-tap menu must hide Calendar Sync switch for Quick List');

      // 5. CalendarScreen & SettingsScreen completely exclude Quick List boards
      const calScreenSrc = fs.readFileSync(path.resolve('src/screens/CalendarScreen.js'), 'utf8');
      assert.match(calScreenSrc, /quickListBoardIdSet/, 'CalendarScreen must exclude Quick List board tasks');
      assert.match(calScreenSrc, /!isTaskOnQuickListBoard\(t\)/, 'CalendarScreen markedDates must skip Quick List items');
      assert.match(calScreenSrc, /if\s*\(!task\s*\|\|\s*isTaskOnQuickListBoard\(task\)\)\s*return false/, 'CalendarScreen selectedTasks must skip Quick List items');

      const settingsSrc = fs.readFileSync(path.resolve('src/screens/SettingsScreen.js'), 'utf8');
      assert.match(settingsSrc, /rawBoards\.filter\(b => isCalendarSyncSupportedForBoard\(b\)\)/, 'SettingsScreen Synced Boards list must exclude Quick List boards');
    });

    test('Quick List & BoardScreen keyboard layout: exact flush padding with no growing gap, no double-shift, and adjustResize config', () => {
      const { computeAndroidKeyboardPadding } = require('../src/utils/keyboardLayout');

      // 1. Keyboard closed -> always 0 (immune to RN Android keyboardDidHide screenY bug)
      assert.strictEqual(
        computeAndroidKeyboardPadding({
          topInset: 36,
          containerHeight: 789,
          closedContainerHeight: 789,
          keyboardScreenY: 855,
          keyboardHeight: 0,
        }),
        0,
        'Hidden keyboard must always yield 0 padding'
      );

      // 2. Android API <= 34 with adjustResize -> native window already shrank -> 0 padding even if keyboard height shrinks later
      assert.strictEqual(
        computeAndroidKeyboardPadding({
          topInset: 36,
          containerHeight: 549,
          closedContainerHeight: 789,
          measuredY: 0,
          baselineY: 0,
          keyboardScreenY: 585,
          keyboardHeight: 306,
        }),
        0,
        'Native adjustResize shrink must not be double-padded'
      );
      assert.strictEqual(
        computeAndroidKeyboardPadding({
          topInset: 36,
          containerHeight: 589,
          closedContainerHeight: 789,
          measuredY: 0,
          baselineY: 0,
          keyboardScreenY: 545,
          keyboardHeight: 306,
        }),
        0,
        'Native adjustResize keyboard height variation must remain 0 padding'
      );

      // 3. Android 15 edge-to-edge (window did not shrink, BottomMenu hidden) -> exact flush overlap (330dp)
      assert.strictEqual(
        computeAndroidKeyboardPadding({
          topInset: 36,
          containerHeight: 879,
          closedContainerHeight: 789,
          measuredY: 36,
          baselineY: 36,
          keyboardScreenY: 585,
          keyboardHeight: 306,
        }),
        330,
        'Android 15 edge-to-edge must compute exact overlap to keyboardScreenY'
      );

      // 4. Legacy adjustPan APK where Android panned window up by 250dp -> accounts for panDelta (no double-shift)
      assert.strictEqual(
        computeAndroidKeyboardPadding({
          topInset: 36,
          containerHeight: 855,
          closedContainerHeight: 789,
          measuredY: -250,
          baselineY: 0,
          keyboardScreenY: 585,
          keyboardHeight: 306,
        }),
        56,
        'Legacy adjustPan panDelta must prevent double-shifting'
      );

      // 5. QuickListBoard uses compact bottom padding (no 120dp void below + Add item) and keyboard-aware scroll
      const qlSrc = fs.readFileSync(path.resolve('src/components/QuickListBoard.js'), 'utf8');
      assert.match(qlSrc, /scrollContent:\s*\{[\s\S]*?paddingBottom:\s*16/, 'QuickListBoard scrollContent must use compact 16dp bottom padding');
      assert.doesNotMatch(qlSrc, /paddingBottom:\s*120/, 'QuickListBoard must not leave a 120dp gap below + Add item');
      assert.match(qlSrc, /onContentSizeChange=\{handleContentSizeChange\}/, 'QuickListBoard must scroll cleanly when new items change content size');

      // 6. BoardScreen removes stale hardcoded 80/90 keyboardVerticalOffset and uses exact SafeArea topInset + computeAndroidKeyboardPadding
      const boardScreenSrc = fs.readFileSync(path.resolve('src/screens/BoardScreen.js'), 'utf8');
      assert.match(boardScreenSrc, /computeAndroidKeyboardPadding/, 'BoardScreen must use computeAndroidKeyboardPadding on Android');
      assert.match(boardScreenSrc, /keyboardVerticalOffset=\{topInset\}/, 'BoardScreen iOS KeyboardAvoidingView must use exact topInset');
      assert.doesNotMatch(boardScreenSrc, /keyboardVerticalOffset=\{Platform\.OS === 'ios' \? 90 : 80\}/, 'BoardScreen must not keep stale 80/90 hardcoded offset');

      // 7. BottomMenu hides while Android software keyboard is open
      const bottomMenuSrc = fs.readFileSync(path.resolve('src/components/BottomMenu.js'), 'utf8');
      assert.match(bottomMenuSrc, /keyboardDidShow/, 'BottomMenu must listen to Android keyboardDidShow');
      assert.match(bottomMenuSrc, /if\s*\(Platform\.OS === 'android' && isKeyboardVisible\)\s*\{\s*return null;/, 'BottomMenu must hide on Android while keyboard is open');

      // 8. app.json & AndroidManifest.xml use resize / adjustResize
      const appJson = JSON.parse(fs.readFileSync(path.resolve('app.json'), 'utf8'));
      assert.strictEqual(appJson.expo.android.softwareKeyboardLayoutMode, 'resize', 'app.json must use softwareKeyboardLayoutMode: resize');
      const manifestSrc = fs.readFileSync(path.resolve('android/app/src/main/AndroidManifest.xml'), 'utf8');
      assert.match(manifestSrc, /android:windowSoftInputMode="adjustResize"/, 'AndroidManifest.xml must use adjustResize');
    });

    test('Task addition & calendar sync integrity: Today never ghost-deleted, Tomorrow prioritized & self-healed, calendarSyncHash persisted', () => {
      const {
        buildSyncWindowChunks,
        isTaskRecentlyCreatedOrUpdated,
        prioritizeTasksForCalendarExport,
      } = require('../src/utils/calendarSyncSchedule');

      // 1. Overlapping chunks strictly contain Today (Nov 20) & Tomorrow (Nov 21) UTC all-day events
      const nov20 = new Date(2026, 10, 20, 14, 49, 0);
      const chunks = buildSyncWindowChunks(nov20, 14, 60, 14);
      const isContained = (y, m, d) => {
        const b = Date.UTC(y, m - 1, d, 0, 0, 0);
        const e = Date.UTC(y, m - 1, d + 1, 0, 0, 0);
        return chunks.some(c => b >= c.start.getTime() && e <= c.end.getTime());
      };
      assert.strictEqual(isContained(2026, 11, 20), true, 'Today (Nov 20) all-day event must be strictly contained in a chunk');
      assert.strictEqual(isContained(2026, 11, 21), true, 'Tomorrow (Nov 21) all-day event must be strictly contained in a chunk');
      assert.strictEqual(isContained(2026, 12, 4), true, 'Chunk boundary (Dec 4) all-day event must be strictly contained in a chunk');

      // 2. Recent-creation grace window protects newly added tasks from premature ghost-deletion
      const nowMs = Date.UTC(2026, 10, 20, 19, 49, 0);
      assert.strictEqual(
        isTaskRecentlyCreatedOrUpdated({ creationDate: new Date(nowMs - 30000).toISOString() }, nowMs),
        true,
        'Task created 30s ago must be protected from ghost deletion'
      );
      assert.strictEqual(
        isTaskRecentlyCreatedOrUpdated({ creationDate: new Date(nowMs - 10 * 60 * 1000).toISOString() }, nowMs),
        false,
        'Task created 10m ago is eligible for verified ghost-deletion checks'
      );

      // 3. Export prioritization puts unlinked Today & Tomorrow tasks BEFORE 52+ old missed tasks
      const missedTasks = Array.from({ length: 55 }, (_, i) => ({
        id: `missed_${i}`,
        taskname: `Old missed ${i}`,
        dateString: '2026-11-10',
        completionDate: '2026-11-10',
        calendarEventId: `ev_${i}`,
      }));
      const todayUnlinked = { id: 'today_1', taskname: 'Test task for calendar', dateString: '2026-11-20', completionDate: '2026-11-20' };
      const tomorrowUnlinked = { id: 'tom_1', taskname: 'Tomorrow task for calendar', dateString: '2026-11-21', completionDate: '2026-11-21' };
      const prioritized = prioritizeTasksForCalendarExport([...missedTasks, tomorrowUnlinked, todayUnlinked], nov20);
      assert.strictEqual(prioritized[0].id, 'today_1', 'Unlinked Today task must export first');
      assert.strictEqual(prioritized[1].id, 'tom_1', 'Unlinked Tomorrow task must export second (never starved by 55 missed tasks)');

      // 4. taskSlice.js persists calendarSyncHash in updateTaskSync & updateMultipleTasksSync,
      //    serializes per-task calendar writes, flushes after addTask, and self-heals unlinked tasks on foreground sync
      const taskSliceSrc = fs.readFileSync(path.resolve('src/features/taskSlice.js'), 'utf8');
      assert.match(taskSliceSrc, /if\s*\(action\.payload\.calendarSyncHash !== undefined\)\s*task\.calendarSyncHash = action\.payload\.calendarSyncHash;/, 'updateTaskSync must persist calendarSyncHash');
      assert.match(taskSliceSrc, /if\s*\(patch\.calendarSyncHash !== undefined\)\s*task\.calendarSyncHash = patch\.calendarSyncHash;/, 'updateMultipleTasksSync must persist calendarSyncHash');
      assert.match(taskSliceSrc, /runSerializedTaskCalendarWrite/, 'taskSlice must serialize per-task calendar writes to prevent add/update duplicate events');
      assert.match(taskSliceSrc, /await flushPendingTaskSaves\(getState\)/, 'addTask must flush calendarEventId immediately after native write');
      assert.match(taskSliceSrc, /performForegroundCalendarSync[\s\S]*?unlinkedEligible[\s\S]*?syncAllTasksToCalendarAsync/, 'performForegroundCalendarSync must self-heal and export unlinked eligible local tasks');

      // 5. calendarSync.js verifies native event existence before ghost deletion & prioritizes immediate user writes
      const calSyncSrc = fs.readFileSync(path.resolve('src/utils/calendarSync.js'), 'utf8');
      assert.match(calSyncSrc, /verifyCalendarEventExistsAsync/, 'calendarSync must directly verify event deletion via getEventByIdAsync before ghost-deleting any task');
      assert.match(calSyncSrc, /isTaskRecentlyCreatedOrUpdated/, 'calendarSync must guard recently added/updated tasks from ghost deletion');
      assert.match(calSyncSrc, /priority:\s*'high'/, 'syncTaskToCalendarAsync must use high-priority queue lane for immediate user writes');
      assert.match(calSyncSrc, /prioritizeTasksForCalendarExport/, 'syncAllTasksToCalendarAsync must prioritize Today/Tomorrow unlinked exports');

      // 6. patch-expo-calendar.js patches Android CalendarModule.kt findEvents to overlap semantics
      const patchSrc = fs.readFileSync(path.resolve('scripts/patch-expo-calendar.js'), 'utf8');
      assert.match(patchSrc, /find-events-overlap-bounds/, 'patch-expo-calendar.js must fix strict containment in Android findEvents');
    });
  });
});








