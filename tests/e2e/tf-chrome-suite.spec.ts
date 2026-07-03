import { test, expect, type Page } from '@playwright/test';
import { bootstrapChromeFixtures, loginSession, type ChromeFixtures } from './_helpers/fixtures';
import { injectSupabaseSession } from './_helpers/auth';

let fx: ChromeFixtures;

test.describe.serial('TF Chrome Suite — Sprint 6/7 wire-ups', () => {
  test.beforeAll(async () => {
    fx = await bootstrapChromeFixtures();
  });

  test.afterAll(async () => {
    if (fx) await fx.cleanup();
  });

  async function loginAs(page: Page, email: string, password: string) {
    const session = await loginSession(email, password);
    await page.goto('about:blank');
    await injectSupabaseSession(page, session);
  }

  test('T7 — ShopVisualSettings UI admin tenant (preview live + library + override gamme)', async ({
    page,
  }) => {
    await loginAs(page, fx.adminEmail, fx.adminPassword);
    await page.goto(`/t/${fx.tenantSlug}/dashboard/shops/${fx.shopId}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const section = page.getByTestId('shop-visual-settings');
    const sectionVisible = await section.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!sectionVisible) {
      const url = page.url();
      const status = page.locator('body').first();
      const bodyText = (await status.innerText().catch(() => '')).slice(0, 200);
      test.info().annotations.push({
        type: 'shop-visual-settings-not-found',
        description: `url=${url}, bodyExcerpt="${bodyText}"`,
      });
    }
    expect(sectionVisible).toBe(true);

    await section.scrollIntoViewIfNeeded();
    const libraryCards = page.locator('[data-testid^="shop-bg-library-"]');
    const libCount = await libraryCards.count();
    expect(libCount).toBeGreaterThanOrEqual(1);
  });

  test('T13 — Bouton Historique sur OrderHistoryTable (acheteur via RLS) — smoke navigation portal', async ({
    page,
  }) => {
    await loginAs(page, fx.acheteurEmail, fx.acheteurPassword);
    await page.goto(`/shop/${fx.shopSlug}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const ordersLink = page
      .getByRole('button', { name: /mes commandes|commandes/i })
      .first()
      .or(page.getByRole('link', { name: /mes commandes|commandes/i }).first());
    const ordersLinkVisible = await ordersLink.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!ordersLinkVisible) {
      test.info().annotations.push({
        type: 'portal-orders-nav-not-found',
        description: `url=${page.url()}, no commandes link in PortalHome`,
      });
    }
    expect(ordersLinkVisible).toBe(true);

    await ordersLink.click();
    await page.waitForTimeout(1000);

    const historyBtn = page.locator('[data-testid^="order-history-btn"]').first();
    const btnVisible = await historyBtn.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!btnVisible) {
      test.info().annotations.push({
        type: 'history-btn-not-found',
        description: `url=${page.url()}, button order-history-btn absent`,
      });
    }
    expect(btnVisible).toBe(true);
  });

  test('T14 + T9 partie UI — ProductMultiView toggle Recto/Verso dans ProductOverlay', async ({
    page,
  }) => {
    await loginAs(page, fx.acheteurEmail, fx.acheteurPassword);
    await page.goto(`/shop/${fx.shopSlug}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const catalogLink = page
      .getByRole('button', { name: /catalogue|nos produits/i })
      .first()
      .or(page.getByRole('link', { name: /catalogue/i }).first());
    const catalogVisible = await catalogLink.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!catalogVisible) {
      test.info().annotations.push({
        type: 'portal-catalog-nav-not-found',
        description: `url=${page.url()}`,
      });
    }
    expect(catalogVisible).toBe(true);

    await catalogLink.click();
    await page.waitForTimeout(1000);

    const productCard = page
      .locator('article, [data-testid^="product-card"]')
      .filter({ hasText: new RegExp(fx.productName.slice(0, 10), 'i') })
      .first();
    const cardVisible = await productCard.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!cardVisible) {
      test.info().annotations.push({
        type: 'product-card-not-found',
        description: `url=${page.url()}, product=${fx.productName}`,
      });
    }
    expect(cardVisible).toBe(true);

    await productCard.click();
    await page.waitForTimeout(1500);

    const toggleRecto = page.getByRole('button', { name: /^recto$/i }).first();
    const toggleVerso = page.getByRole('button', { name: /^verso$/i }).first();
    const rectoVisible = await toggleRecto.isVisible({ timeout: 8_000 }).catch(() => false);
    const versoVisible = await toggleVerso.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!rectoVisible || !versoVisible) {
      test.info().annotations.push({
        type: 'product-multi-view-toggle-not-found',
        description: `url=${page.url()}, recto=${rectoVisible}, verso=${versoVisible}`,
      });
    }
    expect(rectoVisible).toBe(true);
    expect(versoVisible).toBe(true);

    const rectoPressed = await toggleRecto.getAttribute('aria-pressed');
    const versoPressed = await toggleVerso.getAttribute('aria-pressed');
    expect(rectoPressed === 'true' || rectoPressed === 'false').toBe(true);
    expect(versoPressed === 'true' || versoPressed === 'false').toBe(true);

    await toggleVerso.click();
    await page.waitForTimeout(500);
    const versoAfter = await toggleVerso.getAttribute('aria-pressed');
    expect(versoAfter).toBe('true');
  });
});
