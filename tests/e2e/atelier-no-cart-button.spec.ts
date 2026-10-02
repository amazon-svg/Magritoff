import { expect, test } from '@playwright/test';
import { loginAs } from './_helpers/auth';

const USER_EMAIL = process.env.E2E_USER_EMAIL ?? 'developer@magrit.local';
const USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'magrit-development-only';
const TENANT_SLUG = process.env.E2E_TENANT_SLUG ?? 'magrit-development';

test.describe.serial('le panier reste absent des surfaces internes Magrit', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, USER_EMAIL, USER_PASSWORD);
  });

  test('atelier', async ({ page }) => {
    await page.goto(`/t/${TENANT_SLUG}`);
    await expect(page.getByTestId('marguerite-chat')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /panier/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /panier/i })).toHaveCount(0);
    await expect(page.locator('[aria-label*="anier" i], [title*="anier" i]')).toHaveCount(0);
  });

  test('dashboard', async ({ page }) => {
    await page.goto(`/t/${TENANT_SLUG}/dashboard`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page.getByRole('button', { name: /panier/i })).toHaveCount(0);
    await expect(page.locator('[aria-label*="anier" i], [title*="anier" i]')).toHaveCount(0);
  });
});
