const { test, expect } = require('@playwright/test');

/**
 * Generate a large, realistic dataset with both valid and corrupted edge-case tasks
 * to stress test memory, single-pass categorizers, sorting, and rendering.
 */
function generateStressTasks(count = 300) {
  const categories = ['main', 'cat_work', 'cat_personal', 'cat_shopping'];
  const priorities = ['none', 'low', 'medium', 'high'];
  const tasks = [];

  const baseDate = new Date();

  for (let i = 0; i < count; i++) {
    // Generate dates spread across -30 days to +60 days
    const dayOffset = (i % 90) - 30;
    const taskDate = new Date(baseDate);
    taskDate.setDate(taskDate.getDate() + dayOffset);
    const dateStr = taskDate.toISOString().split('T')[0];

    const categoryId = categories[i % categories.length];
    const priority = priorities[i % priorities.length];

    // Introduce edge-case tasks (corrupted formats, numeric IDs, unicode, long text)
    const isEdgeCase = i % 25 === 0;
    const isCorruptedDate = i % 40 === 0;

    tasks.push({
      id: isEdgeCase ? (1000000 + i) : `stress_task_${Date.now()}_${i}`, // Test numeric IDs vs string IDs
      taskname: isEdgeCase 
        ? `🔥 Edge Case Task ${i} 🚀 [Unicode & Long String: ${'x'.repeat(120)}]`
        : `Performance Task #${i + 1}`,
      completionDate: isCorruptedDate ? 'invalid-date-string' : taskDate.toISOString(),
      dateString: isCorruptedDate ? null : dateStr,
      time: i % 3 === 0 ? `${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}` : undefined,
      completed: i % 4 === 0,
      priority: priority,
      boardId: categoryId,
      description: {
        text: i % 5 === 0 ? `Detailed notes for task #${i} with special symbols: <script>alert(1)</script> & 🌟` : '',
        attachments: [],
      },
      subtasks: i % 6 === 0 ? [
        { id: `sub_${i}_1`, text: 'Subtask 1', completed: true },
        { id: `sub_${i}_2`, text: 'Subtask 2', completed: false }
      ] : []
    });
  }

  return tasks;
}

test.describe('Performance & Stress Test Suite', () => {
  test.describe.configure({ mode: 'serial' });

  let page;
  const consoleErrors = [];

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    // Listen for any unhandled exceptions or console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known harmless Metro/asset warnings if any
        if (!text.includes('favicon.ico') && !text.includes('downloadable font')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(`[Page Crash Error]: ${error.message}\n${error.stack}`);
    });

    const stressTasks = generateStressTasks(350);
    const stressBoards = [
      { id: 'main', name: 'Main', type: 'standard', color: '#4CAF50' },
      { id: 'cat_work', name: 'Work', type: 'standard', color: '#2196F3' },
      { id: 'cat_personal', name: 'Personal', type: 'standard', color: '#9C27B0' },
      { id: 'cat_shopping', name: 'Shopping', type: 'shopping', color: '#FF9800' }
    ];

    await page.addInitScript(({ tasks, boards }) => {
      window.localStorage.clear();
      window.localStorage.setItem('isGuest', 'true');
      window.localStorage.setItem('tasks_guest', JSON.stringify(tasks));
      window.localStorage.setItem('tasks', JSON.stringify(tasks));
      window.localStorage.setItem('boards', JSON.stringify(boards));
    }, { tasks: stressTasks, boards: stressBoards });

    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'load', timeout: 60000 });
    const loadDuration = Date.now() - startTime;
    console.log(`[Performance] Initial Page Load with 350 tasks: ${loadDuration}ms`);

    // Verify Board tab mounts
    const boardHeader = page.getByText('Tasks').first();
    await boardHeader.waitFor({ state: 'visible', timeout: 20000 });
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test('Benchmark 1: Bulk Task Loading & Render Stability (350+ Tasks)', async () => {
    const startTime = Date.now();

    // Verify sections render properly
    const todaySection = page.getByTestId('section_title_today');
    await expect(todaySection).toBeVisible();

    const renderTime = Date.now() - startTime;
    console.log(`[Performance] Board Sections Render Latency: ${renderTime}ms`);
    expect(renderTime).toBeLessThan(10000);

    // Verify zero fatal page errors during massive dataset initialization
    const fatalErrors = consoleErrors.filter(e => e.includes('TypeError') || e.includes('Uncaught') || e.includes('Crash'));
    expect(fatalErrors).toHaveLength(0);
  });

  test('Benchmark 2: Rapid Tab Navigation Stress Test (15 Transitions)', async () => {
    const tabBoard = page.getByTestId('tab_board');
    const tabCalendar = page.getByTestId('tab_calendar');
    const tabSettings = page.getByTestId('tab_settings');

    const startTime = Date.now();
    const cycles = 5; // 5 x 3 = 15 screen switches

    for (let i = 0; i < cycles; i++) {
      await tabCalendar.click();
      await page.waitForTimeout(60);

      await tabSettings.click();
      await page.waitForTimeout(60);

      await tabBoard.click();
      await page.waitForTimeout(60);
    }

    const duration = Date.now() - startTime;
    console.log(`[Performance] 15 Rapid Tab Switches completed in ${duration}ms (Avg: ${(duration / 15).toFixed(1)}ms/switch)`);

    // Ensure Board is still functional and alive
    await expect(page.getByTestId('section_title_today')).toBeVisible();

    const fatalErrors = consoleErrors.filter(e => e.includes('TypeError') || e.includes('Crash'));
    expect(fatalErrors).toHaveLength(0);
  });

  test('Benchmark 3: Calendar Month Traversal & Rapid Day Selection Under Heavy Load', async () => {
    const tabCalendar = page.getByTestId('tab_calendar');
    await tabCalendar.click();

    // Verify calendar screen mounted
    await expect(page.getByText('Make room for what matters.')).toBeVisible({ timeout: 10000 });

    const startTime = Date.now();

    // Rapid day selections
    const daysToClick = ['10', '15', '20', '25', '26'];
    for (const day of daysToClick) {
      const dayCell = page.locator(`text=${day}`).first();
      if (await dayCell.isVisible()) {
        await dayCell.click({ force: true });
        await page.waitForTimeout(80);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Performance] Rapid Calendar Day Selections took ${duration}ms`);

    // Verify task list section rendered below calendar
    const tasksHeader = page.locator('text=/Tasks for/i').first();
    await expect(tasksHeader).toBeVisible();

    const fatalErrors = consoleErrors.filter(e => e.includes('TypeError') || e.includes('Crash'));
    expect(fatalErrors).toHaveLength(0);
  });

  test('Benchmark 4: Rapid Theme Switching Stress Test (12 Cycles)', async () => {
    // Click theme toggle on Calendar header rapidly
    const themeBtn = page.getByRole('button', { name: 'Toggle theme' }).first();
    await expect(themeBtn).toBeVisible();

    const startTime = Date.now();
    for (let i = 0; i < 12; i++) {
      await themeBtn.click();
      await page.waitForTimeout(50);
    }

    const duration = Date.now() - startTime;
    console.log(`[Performance] 12 Rapid Theme Toggles executed in ${duration}ms (Avg: ${(duration / 12).toFixed(1)}ms/toggle)`);

    // Verify UI is responsive and rendered
    await expect(page.getByText('Make room for what matters.')).toBeVisible();

    const fatalErrors = consoleErrors.filter(e => e.includes('TypeError') || e.includes('Crash'));
    expect(fatalErrors).toHaveLength(0);
  });

  test('Benchmark 5: Checkbox Completion Stress Under High Volume', async () => {
    // Switch back to Board tab
    const tabBoard = page.getByTestId('tab_board');
    await tabBoard.click();
    await page.waitForTimeout(300);

    const checkboxes = page.getByTestId('task_checkbox');
    const count = await checkboxes.count();
    console.log(`[Stress] Found ${count} visible checkboxes on screen`);

    const clickLimit = Math.min(count, 8);
    const startTime = Date.now();

    for (let i = 0; i < clickLimit; i++) {
      const cb = checkboxes.nth(i);
      if (await cb.isVisible()) {
        await cb.click();
        await page.waitForTimeout(50);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Performance] ${clickLimit} rapid task completions toggled in ${duration}ms`);

    // Verify no crashes occurred
    const fatalErrors = consoleErrors.filter(e => e.includes('TypeError') || e.includes('Crash'));
    expect(fatalErrors).toHaveLength(0);
  });

  test('Benchmark 6: Year Picker Modal Navigation (current to current + 10)', async () => {
    const tabCalendar = page.getByTestId('tab_calendar');
    await tabCalendar.click();
    await page.waitForTimeout(300);

    // Month and year header button
    const headerBtn = page.getByTestId('calendar_month_year_header');
    await expect(headerBtn).toBeVisible({ timeout: 10000 });
    await headerBtn.click();

    // Verify modal opened
    const currentYear = new Date().getFullYear();
    const targetYear = currentYear + 3;

    // Verify current year and current + 10 are visible
    const yearCurrentBtn = page.getByTestId(`year_option_${currentYear}`);
    const yearPlus10Btn = page.getByTestId(`year_option_${currentYear + 10}`);
    await expect(yearCurrentBtn).toBeVisible();
    await expect(yearPlus10Btn).toBeVisible();

    // Click on target year
    const targetYearBtn = page.getByTestId(`year_option_${targetYear}`);
    await targetYearBtn.click();

    // Verify calendar header updated to target year
    await expect(headerBtn).toContainText(String(targetYear));
  });
});
