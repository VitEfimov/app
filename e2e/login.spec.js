const { test, expect } = require('@playwright/test');

test.describe('Login Screen & Authentication Flow', () => {
  let context;
  let page;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    await context.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    page = await context.newPage();
    await page.goto('/', { waitUntil: 'load', timeout: 60000 });
  });

  test.afterEach(async () => {
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
