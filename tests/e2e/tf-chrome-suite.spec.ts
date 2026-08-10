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

  // REFACTO-VISUELS (2026-08-10) — cas de test T14+T9 « toggle Recto/Verso »
  // SUPPRIME avec le composant qu il couvrait. ProductMultiView etait un
  // habillage de MockupImage : il basculait entre deux PNG generes par le
  // moteur SVG (suffixe de chemin __back). Le moteur, ses templates et son
  // cache ont ete supprimes — le visuel est une propriete de la gamme dans le
  // PIM, et une gamme ne porte qu un visuel. Si un besoin recto/verso revient,
  // il se traitera au niveau du PIM, pas par regeneration.
});
