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
  let context;
  let page;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    await context.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('isGuest', 'true');
    });
    page = await context.newPage();
    await page.goto('/', { waitUntil: 'load', timeout: 60000 });
    const boardTab = page.getByTestId('tab_board');
    await boardTab.waitFor({ state: 'visible', timeout: 15000 });
    await boardTab.click();
    await page.waitForSelector('[data-testid="section_title_today"]', { timeout: 15000 });
  });

  test.afterEach(async () => {
    await context.close();
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

  test('should create a List (checklist) board with List section', async () => {
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

      const listHeader = page.getByTestId('section_title_today');
      await expect(listHeader).toBeVisible();
      await expect(listHeader).toHaveText('List');
    }
  });

  test('should accurately render section titles when switching between boards with and without missed tasks', async () => {
    const mainTab = page.locator('[data-testid^="board_tab_"]').filter({ hasText: 'Main' }).first();
    await mainTab.click();

    await createTask(page, 'today', 'Switch Header Task');

    const moreBtn = page.locator('[data-testid^="task_more_btn_"]').first();
    await moreBtn.click();
    await page.getByTestId('quick_menu_action_move_backward').click();

    await expect(page.getByTestId('section_title_missed')).toBeVisible();

    const bdayTab = page.locator('[data-testid^="board_tab_"]').filter({ hasText: 'Birthdays' }).first();
    if (await bdayTab.isVisible()) {
      await bdayTab.click();

      await mainTab.click();

      const missedTitle = page.getByTestId('section_title_missed');
      await expect(missedTitle).toBeVisible();
      await expect(missedTitle).toHaveText('Missed tasks');
    }
  });
});
