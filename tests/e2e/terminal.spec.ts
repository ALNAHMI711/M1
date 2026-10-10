import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Browser tests never depend on exchange availability or place orders.
  await page.route('https://api.binance.com/**', route => route.abort());
});

test('demo, timeframe, export, both themes and responsive fit', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('button-demo').click();
  await expect(page.locator('#connection-status')).toContainText('بيانات مصطنعة');
  await expect(page.locator('#candle-info')).toContainText('DEMO');
  await page.getByTestId('button-timeframe-1h').click();
  await expect(page.locator('#candle-info')).toContainText('1h');
  const download = page.waitForEvent('download');
  await page.getByTestId('button-export').click();
  expect((await download).suggestedFilename()).toBe('DEMO-synthetic-1h.csv');
  const first = await page.locator('html').getAttribute('data-theme');
  await page.getByTestId('button-theme').click();
  expect(await page.locator('html').getAttribute('data-theme')).not.toBe(first);
  await page.getByTestId('button-theme').click();
  expect(await page.locator('html').getAttribute('data-theme')).toBe(first);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('invalid market and offline states are explicit', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#connection-status')).toContainText('تعذر الوصول');
  await page.locator('#symbol').fill('bad<script>');
  await page.locator('#load-market').click();
  await expect(page.locator('#connection-status')).toContainText('غير صالح');
  await page.getByTestId('button-control').click();
  await expect(page.locator('#control-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#control-dialog')).not.toBeVisible();
});

test('indicator library loads on demand and can be searched and cleared', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('button-demo').click();
  await page.getByTestId('button-load-indicators').click();
  await expect(page.locator('#indicator-search')).toBeEnabled();
  await page.locator('#indicator-search').fill('rsi');
  await expect(page.locator('#indicator-select option').first()).toBeAttached();
  const value = await page.locator('#indicator-select option').first().getAttribute('value');
  await page.locator('#indicator-select').selectOption(value!);
  await expect(page.locator('#indicator-status')).not.toContainText('تعذر');
  await page.locator('#clear-indicator').click();
  expect(await page.locator('#indicator-select').inputValue()).toBe('');
  await page.locator('#indicator-search').fill('zzzz-no-such-indicator');
  await expect(page.locator('#indicator-select')).toContainText('لا توجد نتائج');
});

test('real local backend: login, durable switch, validation, audit and logout', async ({ page }) => {
  test.skip(!process.env.M1_E2E_USERNAME || !process.env.M1_E2E_PASSWORD, 'Run backend with an isolated test account to enable the integration test.');
  await page.goto('/');
  await page.getByTestId('button-control').click();
  await page.locator('#login-user').fill(process.env.M1_E2E_USERNAME!);
  await page.locator('#login-password').fill(process.env.M1_E2E_PASSWORD!);
  await page.getByTestId('button-login').click();
  await expect(page.locator('#authenticated-controls')).toBeVisible();
  await expect(page.locator('#readiness-output')).toContainText('"live_enabled": false');
  await page.locator('#kill-on').click();
  await expect(page.locator('#control-message')).toContainText('مفتاح الإيقاف مفعّل');
  await page.locator('#validate-signal').click();
  await expect(page.locator('#signal-output')).toContainText('kill_switch');
  await page.locator('#kill-off').click();
  await expect(page.locator('#control-message')).toContainText('حالة الخدمة محدودة');
  await page.locator('#validate-signal').click();
  await expect(page.locator('#signal-output')).toContainText('"accepted": true');
  await page.locator('#control-refresh').click();
  await expect(page.locator('#audit-output')).toContainText('KILL_SWITCH');
  await page.locator('#signal-json').fill('{broken');
  await page.locator('#validate-signal').click();
  await expect(page.locator('#control-message')).toContainText('JSON غير صالحة');
  await page.locator('#control-logout').click();
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#authenticated-controls')).toBeHidden();
});

test('paper UI: simulated buy, replay, sell, own-ledger export and invalid JSON', async ({ page }) => {
  test.skip(!process.env.M1_E2E_USERNAME || !process.env.M1_E2E_PASSWORD, 'Requires isolated local backend.');
  await page.goto('/');
  await page.getByTestId('button-control').click();
  await page.locator('#login-user').fill(process.env.M1_E2E_USERNAME!);
  await page.locator('#login-password').fill(process.env.M1_E2E_PASSWORD!);
  await page.getByTestId('button-login').click();
  await expect(page.locator('#authenticated-controls')).toBeVisible();
  await page.locator('#paper-panel summary').click();
  await expect(page.locator('#paper-account-output')).toContainText('user_assumption_not_exchange');
  await page.locator('#paper-buy-example').click();
  await page.locator('#paper-submit').click();
  await expect(page.locator('#paper-result')).toContainText('SIMULATED_FILLED');
  await expect(page.locator('#paper-result')).toContainText('"replayed": false');
  await page.locator('#paper-submit').click();
  await expect(page.locator('#paper-result')).toContainText('"replayed": true');
  await page.locator('#paper-sell-example').click();
  await page.locator('#paper-submit').click();
  await expect(page.locator('#paper-result')).toContainText('reduce_only_exit_gate');
  await expect(page.locator('#paper-account-output')).toContainText('"positions": []');
  const download = page.waitForEvent('download');
  await page.locator('#paper-export').click();
  expect((await download).suggestedFilename()).toBe('m1-paper-ledger.csv');
  await page.locator('#paper-json').fill('{bad');
  await page.locator('#paper-submit').click();
  await expect(page.locator('#control-message')).toContainText('JSON غير صالحة');
  await page.locator('#control-logout').click();
  await expect(page.locator('#login-form')).toBeVisible();
});
