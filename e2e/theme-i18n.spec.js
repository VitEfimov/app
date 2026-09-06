const { test, expect } = require('@playwright/test');

test.describe('Theme & i18n Localization', () => {
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

  test('should render section titles in English by default', async () => {
    const todayHeader = page.getByTestId('section_title_today');
    await expect(todayHeader).toHaveText('Today');

    const tomorrowHeader = page.getByTestId('section_title_tomorrow');
    await expect(tomorrowHeader).toHaveText('Tomorrow');
  });

  test('should switch language to Russian and update UI section headers', async () => {
    const settingsTab = page.getByTestId('tab_settings');
    await settingsTab.click();

    const russianOpt = page.getByText('Русский', { exact: false });
    if (await russianOpt.isVisible()) {
      await russianOpt.click();

      const boardTab = page.getByTestId('tab_board');
      await boardTab.click();

      const todayHeader = page.getByTestId('section_title_today');
      await expect(todayHeader).toHaveText('Сегодня');
    }
  });
});
