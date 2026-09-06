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

test.describe('Board Management', () => {
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

  test('should create a new board tab and switch active boards', async () => {
    const addBoardBtn = page.getByRole('button', { name: 'Add new board' }).first();
    await addBoardBtn.click();

    const promptInput = page.getByTestId('prompt_input');
    await promptInput.fill('Personal');
    await page.getByTestId('prompt_submit_btn').click();

    const personalTab = page.locator('[data-testid^="board_tab_"]').filter({ hasText: 'Personal' }).first();
    await expect(personalTab).toBeAttached();

    await createTask(page, 'today', 'Personal Task 1');

    await expect(page.getByText('Personal Task 1')).toBeVisible();

    await page.getByText('Main').first().click();

    await expect(page.getByText('Personal Task 1')).not.toBeVisible();
  });

  test('should rename a board via long-press board tab options', async () => {
    const addBoardBtn = page.getByRole('button', { name: 'Add new board' }).first();
    await addBoardBtn.click();

    const promptInput = page.getByTestId('prompt_input');
    await promptInput.fill('Work Old');
    await page.getByTestId('prompt_submit_btn').click();

    const workTab = page.locator('[data-testid^="board_tab_"]').filter({ hasText: 'Work Old' }).first();
    await workTab.click({ button: 'right' });

    const renameOption = page.getByText('Rename Board');
    if (await renameOption.isVisible()) {
      await renameOption.click();

      const renameInput = page.getByTestId('prompt_input');
      await renameInput.fill('Work New');
      await page.getByTestId('prompt_submit_btn').click();

      const workNewTab = page.locator('[data-testid^="board_tab_"]').filter({ hasText: 'Work New' }).first();
      await expect(workNewTab).toBeAttached();
    }
  });

  test('should create a Birthdays board with auto-repeat setup', async () => {
    const addBoardBtn = page.getByRole('button', { name: 'Add new board' }).first();
    if (await addBoardBtn.isVisible()) {
      await addBoardBtn.click();

      const promptInput = page.getByTestId('prompt_input');
      await promptInput.fill('Birthdays');

      const birthdayTypeCard = page.getByTestId('create_board_type_birthdays');
      if (await birthdayTypeCard.isVisible()) {
        await birthdayTypeCard.click();
      }

      await page.getByTestId('prompt_submit_btn').click();

      const bdayTab = page.locator('[data-testid^="board_tab_"]').filter({ hasText: 'Birthdays' }).first();
      await expect(bdayTab).toBeAttached();
    }
  });

  test('should create a Simple List board with To-Do section', async () => {
    const addBoardBtn = page.getByRole('button', { name: 'Add new board' }).first();
    if (await addBoardBtn.isVisible()) {
      await addBoardBtn.click();

      const promptInput = page.getByTestId('prompt_input');
      await promptInput.fill('Quick Notes');

      const simpleTypeCard = page.getByTestId('create_board_type_simple_list');
      if (await simpleTypeCard.isVisible()) {
        await simpleTypeCard.click();
      }

      await page.getByTestId('prompt_submit_btn').click();

      const listTab = page.locator('[data-testid^="board_tab_"]').filter({ hasText: 'Quick Notes' }).first();
      await expect(listTab).toBeAttached();

      const todoHeader = page.getByTestId('section_title_today');
      await expect(todoHeader).toBeVisible();
    }
  });

  test('should create a Shopping List board with Need to Buy section', async () => {
    const addBoardBtn = page.getByRole('button', { name: 'Add new board' }).first();
    if (await addBoardBtn.isVisible()) {
      await addBoardBtn.click();

      const promptInput = page.getByTestId('prompt_input');
      await promptInput.fill('Groceries');

      const shoppingTypeCard = page.getByTestId('create_board_type_shopping');
      if (await shoppingTypeCard.isVisible()) {
        await shoppingTypeCard.click();
      }

      await page.getByTestId('prompt_submit_btn').click();

      const shopTab = page.locator('[data-testid^="board_tab_"]').filter({ hasText: 'Groceries' }).first();
      await expect(shopTab).toBeAttached();

      const shopHeader = page.getByTestId('section_title_today');
      await expect(shopHeader).toBeVisible();
    }
  });
});
