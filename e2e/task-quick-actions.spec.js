const { test, expect } = require('@playwright/test');

async function createTask(page, sectionId, taskName) {
  const sectionHeader = page.getByTestId(`section_title_${sectionId}`);
  if (await sectionHeader.isVisible()) {
    const addBtn = page.getByTestId(`inline_add_btn_${sectionId}`).first();
    if (!await addBtn.isVisible()) {
      await sectionHeader.click();
      await page.waitForTimeout(300);
    }
  }
  const addBtn = page.getByTestId(`inline_add_btn_${sectionId}`).first();
  await addBtn.click();
  const input = page.getByTestId('inline_task_input');
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(taskName);
  await page.getByTestId('inline_submit_btn').click();
}

test.describe('Task Quick Actions & Batch Selection', () => {
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

  test.afterEach(async ({}, testInfo) => {
    const name = testInfo.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    await page.screenshot({ path: `e2e/screenshots/${name}.png` });
  });

  test.beforeEach(async () => {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.localStorage.setItem('isGuest', 'true');
    });
    const boardTab = page.getByTestId('tab_board');
    await boardTab.waitFor({ state: 'visible', timeout: 10000 });
    await boardTab.click();
    await page.waitForSelector('[data-testid="section_title_today"]', { timeout: 10000 });
  });

  test('should duplicate a task via Quick Menu', async () => {
    await createTask(page, 'today', 'Task to Duplicate');

    const moreBtn = page.locator('[data-testid^="task_more_btn_"]').first();
    await moreBtn.click();

    await page.getByTestId('quick_menu_action_duplicate').click();

    const count = await page.getByText('Task to Duplicate').count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('should open SnoozeModal and select a snooze option', async () => {
    await createTask(page, 'today', 'Task to Snooze');

    const moreBtn = page.locator('[data-testid^="task_more_btn_"]').first();
    await moreBtn.click();

    await page.getByTestId('quick_menu_action_snooze').click();

    await expect(page.getByText('Reschedule Date')).toBeVisible();

    const snoozeOpt = page.getByText('Tomorrow morning').first();
    if (await snoozeOpt.isVisible()) {
      await snoozeOpt.click();
    }
  });

  test('should move task to another board via Quick Menu', async () => {
    const addBoardBtn = page.getByRole('button', { name: 'Add new board' }).first();
    if (await addBoardBtn.isVisible()) {
      await addBoardBtn.click();
      const promptInput = page.getByTestId('prompt_input');
      await promptInput.fill('Project B');
      await page.getByTestId('prompt_submit_btn').click();
    }

    const mainTab = page.locator('[data-testid^="board_tab_"]').filter({ hasText: 'Main' }).first();
    await mainTab.click();

    await createTask(page, 'today', 'Board Move Task');

    const moreBtn = page.locator('[data-testid^="task_more_btn_"]').first();
    await moreBtn.click();

    await page.getByTestId('quick_menu_action_move_to_board').click();

    const moveOptions = page.locator('[data-testid^="move_board_option_"]');
    const optionCount = await moveOptions.count();
    if (optionCount > 1) {
      const secondOption = moveOptions.nth(1);
      const targetBoardId = (await secondOption.getAttribute('data-testid')).replace('move_board_option_', '');
      await secondOption.click();

      await expect(page.getByText('Board Move Task')).not.toBeVisible();

      const targetTab = page.getByTestId(`board_tab_${targetBoardId}`);
      await targetTab.click();
      await expect(page.getByText('Board Move Task')).toBeVisible();
    }
  });
});
