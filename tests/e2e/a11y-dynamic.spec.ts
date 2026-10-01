import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAs } from './_helpers/auth';

const USER_EMAIL = process.env.E2E_USER_EMAIL ?? 'developer@magrit.local';
const USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'magrit-development-only';
const TENANT_SLUG = process.env.E2E_TENANT_SLUG ?? 'magrit-development';

async function expectNoCriticalViolation(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag21a']).analyze();
  const critical = results.violations.filter((violation) => violation.impact === 'critical');
  expect(critical, JSON.stringify(critical.map((violation) => violation.id))).toHaveLength(0);
}

test.describe.serial('accessibilité dynamique — runtime portable', () => {
  test('/tenants anonyme', async ({ page }) => {
    await expectNoCriticalViolation(page, '/tenants');
  });

  test('atelier authentifié', async ({ page }) => {
    await loginAs(page, USER_EMAIL, USER_PASSWORD);
    await expectNoCriticalViolation(page, `/t/${TENANT_SLUG}`);
  });

  test('dashboard authentifié', async ({ page }) => {
    await loginAs(page, USER_EMAIL, USER_PASSWORD);
    await expectNoCriticalViolation(page, `/t/${TENANT_SLUG}/dashboard`);
  });
});
