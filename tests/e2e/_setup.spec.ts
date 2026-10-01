import { test, expect } from '@playwright/test';
import { loginAs } from './_helpers/auth';

test('smoke - espace anonyme rend le point d entrée de connexion', async ({ page }) => {
  await page.goto('/tenants');
  const body = await page.locator('body').innerText();
  expect(body.length).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible();
});

test('smoke - connexion Better Auth locale', async ({ page }) => {
  await loginAs(
    page,
    process.env.E2E_USER_EMAIL ?? 'developer@magrit.local',
    process.env.E2E_USER_PASSWORD ?? 'magrit-development-only',
  );
  await expect(page.getByText(/Mes espaces|Mode superadmin/i).first()).toBeVisible({ timeout: 10_000 });
});
