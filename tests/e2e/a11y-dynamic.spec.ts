import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { bootstrapChromeFixtures, type ChromeFixtures } from './_helpers/fixtures';
import { injectSupabaseSession } from './_helpers/auth';
import { getSessionForCredentials } from './_helpers/auth';

/**
 * S9 audit a11y dynamique - login bypass Playwright (lesson rétro Sprint 9).
 *
 * Couvre les 8 routes user-facing étendues post Sprint 6/7/8 dans a11y-scan.sh.
 * Login bypass via session injection localStorage (pas de clic UI sur login).
 *
 * Critères : 0 violation niveau "critical" autorisé. Niveaux moderate/minor
 * loggés mais ne bloquent pas le test (engagement WCAG AA reporté V2).
 */

let fx: ChromeFixtures;

async function loginAs(page: Page, email: string, password: string) {
  const session = await getSessionForCredentials(email, password);
  await page.goto('about:blank');
  await injectSupabaseSession(page, session);
}

async function runAxe(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag21a'])
    .analyze();
  const critical = results.violations.filter((v) => v.impact === 'critical');
  const serious = results.violations.filter((v) => v.impact === 'serious');
  return { critical, serious, all: results.violations };
}

test.describe.serial('S9 a11y dynamique - 8 routes user-facing', () => {
  test.beforeAll(async () => {
    fx = await bootstrapChromeFixtures();
  });

  test.afterAll(async () => {
    if (fx) await fx.cleanup();
  });

  test('/login (anonyme)', async ({ page }) => {
    const r = await runAxe(page, '/login');
    test.info().annotations.push({
      type: 'axe-result',
      description: `critical=${r.critical.length} serious=${r.serious.length} all=${r.all.length}`,
    });
    expect(r.critical, JSON.stringify(r.critical.map((v) => v.id))).toHaveLength(0);
  });

  test('/shop/:slug (boutique anonyme)', async ({ page }) => {
    const r = await runAxe(page, `/shop/${fx.shopSlug}`);
    test.info().annotations.push({
      type: 'axe-result',
      description: `critical=${r.critical.length} serious=${r.serious.length}`,
    });
    expect(r.critical, JSON.stringify(r.critical.map((v) => v.id))).toHaveLength(0);
  });

  test('/t/:tenant/dashboard/orders (admin tenant)', async ({ page }) => {
    await loginAs(page, fx.adminEmail, fx.adminPassword);
    const r = await runAxe(page, `/t/${fx.tenantSlug}/dashboard/orders`);
    test.info().annotations.push({
      type: 'axe-result',
      description: `critical=${r.critical.length} serious=${r.serious.length}`,
    });
    expect(r.critical, JSON.stringify(r.critical.map((v) => v.id))).toHaveLength(0);
  });

  test('/t/:tenant/dashboard/users (admin tenant)', async ({ page }) => {
    await loginAs(page, fx.adminEmail, fx.adminPassword);
    const r = await runAxe(page, `/t/${fx.tenantSlug}/dashboard/users`);
    test.info().annotations.push({
      type: 'axe-result',
      description: `critical=${r.critical.length} serious=${r.serious.length}`,
    });
    expect(r.critical, JSON.stringify(r.critical.map((v) => v.id))).toHaveLength(0);
  });

  test('/t/:tenant/spaces (admin tenant)', async ({ page }) => {
    await loginAs(page, fx.adminEmail, fx.adminPassword);
    const r = await runAxe(page, `/t/${fx.tenantSlug}/spaces`);
    test.info().annotations.push({
      type: 'axe-result',
      description: `critical=${r.critical.length} serious=${r.serious.length}`,
    });
    expect(r.critical, JSON.stringify(r.critical.map((v) => v.id))).toHaveLength(0);
  });

  test('/t/:tenant (atelier - chat home)', async ({ page }) => {
    await loginAs(page, fx.adminEmail, fx.adminPassword);
    const r = await runAxe(page, `/t/${fx.tenantSlug}`);
    test.info().annotations.push({
      type: 'axe-result',
      description: `critical=${r.critical.length} serious=${r.serious.length}`,
    });
    expect(r.critical, JSON.stringify(r.critical.map((v) => v.id))).toHaveLength(0);
  });

  test('/tenants (picker post-login)', async ({ page }) => {
    await loginAs(page, fx.adminEmail, fx.adminPassword);
    const r = await runAxe(page, `/tenants`);
    test.info().annotations.push({
      type: 'axe-result',
      description: `critical=${r.critical.length} serious=${r.serious.length}`,
    });
    expect(r.critical, JSON.stringify(r.critical.map((v) => v.id))).toHaveLength(0);
  });

  test('/t/:tenant/dashboard/shops/:id (admin tenant)', async ({ page }) => {
    await loginAs(page, fx.adminEmail, fx.adminPassword);
    const r = await runAxe(page, `/t/${fx.tenantSlug}/dashboard/shops/${fx.shopId}`);
    test.info().annotations.push({
      type: 'axe-result',
      description: `critical=${r.critical.length} serious=${r.serious.length}`,
    });
    expect(r.critical, JSON.stringify(r.critical.map((v) => v.id))).toHaveLength(0);
  });
});
