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

  test('should navigate directly to Dashboard after entering PIN for remembered user', async ({ browser }) => {
    const pinContext = await browser.newContext();
    await pinContext.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('rememberedUser', JSON.stringify({ email: 'user@example.com', rememberMe: true }));
      window.localStorage.setItem('customTheme', JSON.stringify({ appPin: '1234' }));
    });
    const pinPage = await pinContext.newPage();
    await pinPage.goto('/', { waitUntil: 'load', timeout: 60000 });

    await expect(pinPage.getByText('Enter PIN')).toBeVisible({ timeout: 15000 });

    await pinPage.getByText('1').first().click();
    await pinPage.getByText('2').first().click();
    await pinPage.getByText('3').first().click();
    await pinPage.getByText('4').first().click();

    const dashboardTab = pinPage.getByTestId('tab_dashboard');
    await expect(dashboardTab).toBeVisible({ timeout: 15000 });
    await expect(pinPage.getByTestId('login_email_input')).not.toBeVisible();
    await pinContext.close();
  });
});
