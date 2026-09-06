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

test.describe('Task Date Movement & Section Logic', () => {
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

  test('should move Today task backward into Missed tasks with correct section headers', async () => {
    await createTask(page, 'today', 'Backward Test Task');
    await expect(page.getByText('Backward Test Task')).toBeVisible();

    const moreBtn = page.locator('[data-testid^="task_more_btn_"]').first();
    await moreBtn.click();

    await page.getByTestId('quick_menu_action_move_backward').click();

    const missedTitle = page.getByTestId('section_title_missed');
    await expect(missedTitle).toBeVisible();

    const missedHeaders = await page.getByTestId('section_title_missed').count();
    const todayHeaders = await page.getByTestId('section_title_today').count();
    expect(missedHeaders).toBe(1);
    expect(todayHeaders).toBe(1);
  });

  test('should move Missed task forward back to Today', async () => {
    await createTask(page, 'today', 'Forward Test Task');

    const moreBtn = page.locator('[data-testid^="task_more_btn_"]').first();
    await moreBtn.click();
    await page.getByTestId('quick_menu_action_move_backward').click();

    await expect(page.getByTestId('section_title_missed')).toBeVisible();

    const moreBtnMissed = page.locator('[data-testid^="task_more_btn_"]').first();
    await moreBtnMissed.click();
    await page.getByTestId('quick_menu_action_move_forward').click();

    await expect(page.getByTestId('section_title_today')).toBeVisible();
  });

  test('should batch move Today tasks forward via Section Options Menu', async () => {
    await createTask(page, 'today', 'Batch Task 1');

    const sectionMenuBtn = page.getByTestId('section_menu_today');
    await sectionMenuBtn.click();

    await page.getByTestId('section_option_move_forward').click();

    const confirmSubmit = page.getByTestId('confirm_modal_submit');
    if (await confirmSubmit.isVisible()) {
      await confirmSubmit.click();
    }

    await page.waitForTimeout(500);
    const tomorrowHeader = page.getByTestId('section_title_tomorrow');
    await expect(tomorrowHeader).toBeVisible();
    if (!await page.getByText('Batch Task 1').isVisible()) {
      await tomorrowHeader.click();
    }
    await expect(page.getByText('Batch Task 1')).toBeVisible();
  });
});
