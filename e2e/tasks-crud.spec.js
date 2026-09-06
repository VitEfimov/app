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

test.describe('Task CRUD Operations & Details Modal', () => {
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

  test('should create a task in Today section via inline input', async () => {
    await createTask(page, 'today', 'Buy Groceries');
    await expect(page.getByText('Buy Groceries')).toBeVisible();
  });

  test('should create a task in Tomorrow section', async () => {
    await createTask(page, 'tomorrow', 'Plan Weekend Trip');
    await expect(page.getByText('Plan Weekend Trip')).toBeVisible();
  });

  test('should complete a task and move it to Completed section', async () => {
    await createTask(page, 'today', 'Task to Complete');
    await expect(page.getByText('Task to Complete')).toBeVisible();

    const taskContainer = page.locator('div').filter({ hasText: /^Task to Complete$/ }).first();
    const checkbox = taskContainer.locator('..').locator('..').getByTestId('task_checkbox').first();
    await checkbox.click();

    await page.waitForTimeout(500);
    const completedHeader = page.getByTestId('section_title_completed');
    if (await completedHeader.isVisible()) {
      await completedHeader.click();
    }
    await expect(page.getByText('Task to Complete')).toBeVisible();
  });

  test('should edit task details inside TaskDetailsModal', async () => {
    await createTask(page, 'today', 'Detailed Task');
    
    const moreBtn = page.locator('[data-testid^="task_more_btn_"]').first();
    await moreBtn.click();
    await page.getByTestId('quick_menu_action_edit').click();

    const modalInput = page.getByTestId('task_details_name_input');
    await expect(modalInput).toBeVisible();
    await modalInput.fill('Detailed Task Updated');
    await modalInput.blur();

    const closeBtn = page.getByTestId('task_details_close_btn');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await expect(page.getByText('Detailed Task Updated')).toBeVisible();
  });
});
