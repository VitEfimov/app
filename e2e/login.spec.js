const { test, expect } = require('@playwright/test');

test.describe('Login Screen & Authentication Flow', () => {
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/', { waitUntil: 'load', timeout: 60000 });

    const settingsTab = page.getByTestId('tab_settings');
    if (await settingsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsTab.click();
      const logoutBtn = page.getByTestId('logout_btn');
      await logoutBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      if (await logoutBtn.isVisible().catch(() => false)) {
        await logoutBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should render Login screen by default for unauthenticated users', async () => {
    const emailInput = page.getByTestId('login_email_input');
    const passwordInput = page.getByTestId('login_password_input');
    const submitBtn = page.getByTestId('login_submit_btn');
    const guestBtn = page.getByTestId('guest_login_btn');

    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await expect(passwordInput).toBeVisible({ timeout: 15000 });
    await expect(submitBtn).toBeVisible({ timeout: 15000 });
    await expect(guestBtn).toBeVisible({ timeout: 15000 });
  });

  test('should navigate into app when clicking Continue without login (Guest Mode)', async () => {
    const guestBtn = page.getByTestId('guest_login_btn');
    await guestBtn.waitFor({ state: 'visible', timeout: 15000 });
    await guestBtn.click();

    const boardTab = page.getByTestId('tab_board');
    await expect(boardTab).toBeVisible({ timeout: 15000 });
  });
});
