const { test, expect } = require('@playwright/test');
const { parseSharedTasks, parseSingleTaskBlock } = require('../src/utils/taskShareParser');

test.describe('Task Share Parser (Multi-Task & Task Flow transfers)', () => {
  test('should parse multiple tasks separated by divider line (e.g. from TaskManager/Task Flow export)', () => {
    const multiTaskText = `Tasks:

Task: Buy Groceries
Due: Oct 28, 2026 at 14:00
Priority: High

Notes:
Milk, eggs, and bread

------------------------

Task: Call Dentist
Due: tomorrow
Priority: Medium

------------------------

Task: Finish Project Report
Due: Oct 30, 2026`;

    const tasks = parseSharedTasks(multiTaskText);
    expect(tasks).toHaveLength(3);
    expect(tasks[0].taskname).toBe('Buy Groceries');
    expect(tasks[0].priority).toBe('high');
    expect(tasks[0].time).toBe('14:00');
    expect(tasks[0].description.text).toContain('Milk, eggs, and bread');

    expect(tasks[1].taskname).toBe('Call Dentist');
    expect(tasks[1].priority).toBe('medium');

    expect(tasks[2].taskname).toBe('Finish Project Report');
  });

  test('should parse JSON task transfer from Task Flow or other apps', () => {
    const jsonExport = JSON.stringify([
      { title: 'Task A', dueDate: '2026-10-29', priority: 'high', completed: false },
      { title: 'Task B', dueDate: '2026-10-30', priority: 'low', completed: true },
      { title: 'Task C', priority: 'medium' }
    ]);

    const tasks = parseSharedTasks(jsonExport);
    expect(tasks).toHaveLength(3);
    expect(tasks[0].taskname).toBe('Task A');
    expect(tasks[0].priority).toBe('high');
    expect(tasks[0].completed).toBe(false);

    expect(tasks[1].taskname).toBe('Task B');
    expect(tasks[1].priority).toBe('low');
    expect(tasks[1].completed).toBe(true);

    expect(tasks[2].taskname).toBe('Task C');
  });

  test('should parse multiple checklist / bulleted items as individual tasks', () => {
    const checklistText = `- [ ] Prepare slides for presentation
- [x] Send invite emails
- [ ] Review meeting notes
- [ ] Update roadmap`;

    const tasks = parseSharedTasks(checklistText);
    expect(tasks).toHaveLength(4);
    expect(tasks[0].taskname).toBe('Prepare slides for presentation');
    expect(tasks[0].completed).toBe(false);

    expect(tasks[1].taskname).toBe('Send invite emails');
    expect(tasks[1].completed).toBe(true);

    expect(tasks[2].taskname).toBe('Review meeting notes');
    expect(tasks[3].taskname).toBe('Update roadmap');
  });

  test('should preserve single task parsing for normal shared text and notes', () => {
    const singleText = `Meeting with Marketing
Due tomorrow at 3pm
Priority: High

Discuss Q4 advertising campaign`;

    const tasks = parseSharedTasks(singleText);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskname).toContain('Meeting with Marketing');
    expect(tasks[0].priority).toBe('high');
    expect(tasks[0].time).toBe('15:00');
  });
});

test.describe('Board Missed Tasks Move Backward & Year Picker 18 Years', () => {
  test.describe.configure({ mode: 'serial' });

  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('isGuest', 'true');
    });
    await page.goto('/', { waitUntil: 'load', timeout: 60000 });
    const boardTab = page.getByTestId('tab_board');
    await boardTab.waitFor({ state: 'visible', timeout: 30000 });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should show Move backward option in Options for Missed tasks and move tasks backward', async () => {
    await page.waitForSelector('[data-testid="section_title_today"]', { timeout: 15000 });
    // 1. Create a task in Today section
    const addBtn = page.getByTestId('inline_add_btn_today').first();
    await addBtn.click();
    const input = page.getByTestId('inline_task_input');
    await input.waitFor({ state: 'visible', timeout: 5000 });
    await input.fill('Overdue Task');
    await page.getByTestId('inline_submit_btn').click();

    // 2. Move this task backward into Missed tasks via kebab menu
    const moreBtn = page.locator('[data-testid^="task_more_btn_"]').first();
    await moreBtn.click();
    await page.getByTestId('quick_menu_action_move_backward').click();

    // 3. Open section options for Missed tasks
    const missedHeader = page.getByTestId('section_title_missed');
    await expect(missedHeader).toBeVisible();

    const missedOptionsBtn = page.getByRole('button', { name: /Options for Missed tasks/i }).first();
    await missedOptionsBtn.click();

    // 4. Assert that "Move backward" is now present for Missed tasks!
    const moveBackwardBtn = page.getByTestId('section_option_move_backward');
    await expect(moveBackwardBtn).toBeVisible();
    await expect(moveBackwardBtn).toHaveText('Move backward');

    // 5. Click Move backward and confirm
    await moveBackwardBtn.click();
    await expect(page.getByText('Move Backward')).toBeVisible();
    await page.getByText('Move', { exact: true }).click();
  });

  test('should display 18 years in total in Calendar YearPickerModal', async () => {
    // Navigate to Calendar
    const calTab = page.getByTestId('tab_calendar');
    await calTab.waitFor({ state: 'visible', timeout: 15000 });
    await calTab.click();

    // Open year picker modal
    const monthYearBtn = page.getByTestId('calendar_month_year_header');
    await monthYearBtn.waitFor({ state: 'visible', timeout: 15000 });
    await monthYearBtn.click();

    // Count year buttons inside YearPickerModal
    const yearOptions = page.locator('[data-testid^="year_option_"]');
    await yearOptions.first().waitFor({ state: 'visible', timeout: 5000 });
    const count = await yearOptions.count();
    expect(count).toBe(18);
  });
});
