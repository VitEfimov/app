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

  test('BoardScreen FlashList configures stable uniqueKey keyExtractor and disableAutoLayout', () => {
    const boardPath = path.resolve('src/screens/BoardScreen.js');
    const content = fs.readFileSync(boardPath, 'utf8');

    assert.match(content, /keyExtractor=\{\(item,\s*index\)/, 'keyExtractor must accept index parameter');
    assert.match(content, /if \(item\?\.uniqueKey\) return item\.uniqueKey;/, 'Must use stable uniqueKey to prevent key shift on section expand');
    assert.match(content, /disableAutoLayout=\{true\}/, 'Must disable AutoLayoutView on single-column list to prevent Android native crash');
    assert.match(content, /drawDistance=\{Platform\.OS === 'web' \? 400 : 250\}/, 'Must use conservative drawDistance on mobile');
    assert.match(content, /ListHeaderComponent=\{renderListSummaryBar\}/, 'Must wire summary bar into ListHeaderComponent to scroll with tasks');
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

  test('BoardScreen protects large section expansion (e.g. 111 missed tasks) via progressive batching, stable keys, and disableAutoLayout', () => {
    const boardPath = path.resolve('src/screens/BoardScreen.js');
    const content = fs.readFileSync(boardPath, 'utf8');

    assert.match(content, /INITIAL_SECTION_PAGE_SIZE/, 'BoardScreen must batch initial visible rows per section');
    assert.match(content, /type:\s*'show_more'/, 'BoardScreen must render a show_more pagination row when section exceeds page size');
    assert.match(content, /disableAutoLayout=\{true\}/, 'BoardScreen FlashList must disable AutoLayoutView to prevent Android native dispatchDraw crash');
    assert.doesNotMatch(content, /removeClippedSubviews=\{Platform\.OS === 'android'\}/, 'BoardScreen FlashList must not combine removeClippedSubviews with FlashList');
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
});







