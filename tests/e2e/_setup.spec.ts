import { test, expect } from '@playwright/test';
import { loginAs } from './_helpers/auth';

test('smoke - login page rend', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login/);
  const body = await page.locator('body').innerText();
  expect(body.length).toBeGreaterThan(0);
});

test('smoke - injection session admin tenant -> redirige hors login', async ({ page }) => {
  await page.goto('about:blank');
  await loginAs(page, 'a.mazon@me.com', process.env.E2E_ADMIN_PASSWORD ?? 'MagritTest2026!');
  await page.goto('/login');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  const finalUrl = page.url();
  expect(finalUrl).not.toMatch(/\/login\b/);
});
