import { test, expect, type Page } from '@playwright/test';
import { TEST_IDS } from '../../src/shared/presentation/testIds';
import type { PublicShopCatalog } from '../../src/modules/shops';
import type { CreateOrderCommand } from '../../src/modules/orders';

// Recette déterministe de l'interface : API, fournisseur et persistance simulés.
// Aucun compte, email ou commande réelle n'est créé.
const shopId = '41000000-0000-4000-8000-000000000001';
const tenantId = '41000000-0000-4000-8000-000000000002';
const productId = '41000000-0000-4000-8000-000000000003';
const customerId = '41000000-0000-4000-8000-000000000004';
const orderId = '41000000-0000-4000-8000-000000000005';
const date = '2026-10-09T08:00:00Z';
const catalog: PublicShopCatalog = {
  shop: { id: shopId, tenantId, slug: 'recette-boutique', name: 'Boutique de recette',
    description: '', theme: { primaryColor: '#1e3a8a', accentColor: '#f59e0b', mode: 'light' }, logoUrl: '', address: '', contactEmail: 'contact@example.invalid',
    active: true, heroImageUrl: null, tagline: 'Recette simulée', accessMode: 'self_signup', createdAt: date },
  taxRegime: 'metropole_fr', products: [{ id: `lib-${productId}`, shopId, productId,
    tenantId, name: 'Flyer A5', category: 'Flyers', description: '', priceHt: 0, imageUrl: '',
    config: { kind: 'leaflet', quantity: 500, source: 'pim-generated',
      clariprintData: { kind: 'leaflet', width: 148, height: 210, quantity: 500 } },
    displayOrder: 0, createdAt: date, gammeSlug: 'flyer_a5' }],
  gammes: [
    { id: '41000000-0000-4000-8000-000000000006', slug: 'flyer', name: 'Flyers', parent_slug: null, matching_rules: {}, display_order: 0 },
    { id: '41000000-0000-4000-8000-000000000007', slug: 'flyer_a5', name: 'Flyer A5', parent_slug: 'flyer', matching_rules: {}, display_order: 1 },
  ], definitions: [], subscribedSlugs: ['flyer', 'flyer_a5'], customMockups: [],
};

async function fixture(page: Page) {
  const orders: CreateOrderCommand[] = [];
  const unexpected: string[] = [];
  let authenticated = false;
  const session = { identity: { kind: 'shop_customer', shopId, shopCustomerAccountId: customerId },
    customer: { id: customerId, shopId, email: 'acheteur@example.invalid', fullName: 'Acheteur recette', status: 'active' },
    expiresAt: '2099-10-09T08:00:00Z' };
  await page.route('**/api/v1/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    if (pathname === '/api/v1/public/shops/recette-boutique/probe') {
      await route.fulfill({ json: { id: shopId, tenantId, accessMode: 'self_signup' } });
    } else if (pathname === '/api/v1/public/shops/recette-boutique/catalog') {
      await route.fulfill({ json: catalog });
    } else if (pathname === '/api/v1/storefront/session/current') {
      await route.fulfill(authenticated ? { json: { session } } : {
        status: 401, json: { type: 'about:blank', title: 'Connexion requise', status: 401,
          code: 'storefront.unauthorized', requestId: 'recette' },
      });
    } else if (pathname === '/api/v1/storefront/recette-boutique/session' && method === 'POST') {
      authenticated = true;
      await route.fulfill({ json: { session } });
    } else if (pathname === '/api/v1/public/shops/recette-boutique/assistant/category-editorial') {
      // Vérifie aussi le repli déterministe sans service éditorial IA.
      await route.fulfill({ status: 503, json: { type: 'about:blank', title: 'Éditorial indisponible',
        status: 503, code: 'recipe.editorial_unavailable', requestId: 'recette' } });
    } else if (pathname === '/api/v1/clariprint/quote') {
      await route.fulfill({ json: { success: true, priceHT: 125, delais: 5 } });
    } else if (pathname === `/api/v1/shops/${shopId}/orders`) {
      await route.fulfill({ json: { counters: { mine: 0, to_validate: 0, to_approve: 0, to_produce: 0 },
        datasets: { mine: [], to_validate: [], to_approve: [], to_produce: [] } } });
    } else if (pathname === '/api/v1/orders' && method === 'POST') {
      orders.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, json: { orderId, tenantId, shopId, totalHt: '125.00', currency: 'EUR', replayed: false } });
    } else if (pathname === `/api/v1/orders/${orderId}/draft`) {
      await route.fulfill({ json: { orderId, status: 'draft', createdAt: date,
        totalHt: '125.00', hasUnverifiedPrices: true, items: [] } });
    } else {
      unexpected.push(`${method} ${pathname}`);
      await route.fulfill({ status: 503, json: { type: 'about:blank', title: 'Hors recette', status: 503,
        code: 'recipe.unexpected_request', requestId: 'recette' } });
    }
  });
  return { orders, unexpected };
}

async function configureAndOpenCart(page: Page) {
  await page.goto('/shop/recette-boutique/catalog');
  const search = page.getByRole('combobox', { name: 'Rechercher un produit ou une catégorie' }).first();
  await search.fill('Flyer A5');
  await expect(page.getByRole('option', { name: /Flyer A5/ }).first()).toBeVisible();
  await search.press('Enter');
  await expect(page).toHaveURL(/\/p\//);
  await page.getByRole('button', { name: 'Configurer', exact: true }).click();
  await expect(page.getByTestId(TEST_IDS.shop.overlayPriceDisplay)).toContainText('125,00');
  await page.getByTestId(TEST_IDS.shop.overlayAddBtn).click();
  await page.getByRole('button', { name: /^Panier/ }).click();
  await expect(page.getByTestId(TEST_IDS.shop.checkoutBtn)).toBeVisible();
}

test('recherche, configuration, identification et commande conservent le prix et les packs', async ({ page }) => {
  const { orders, unexpected } = await fixture(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await configureAndOpenCart(page);
  await page.getByTestId(TEST_IDS.shop.checkoutBtn).click();
  await expect(page.getByTestId(TEST_IDS.shop.checkoutSubmitBtn)).toBeDisabled();
  expect(orders).toEqual([]);
  await page.getByTestId(TEST_IDS.shop.checkoutEmailInput).fill('acheteur@example.invalid');
  await page.getByTestId(TEST_IDS.shop.checkoutPasswordInput).fill('recette-simulee-only');
  await page.getByTestId(TEST_IDS.shop.checkoutAuthBtn).click();
  await expect(page.getByRole('heading', { name: 'Récapitulatif de votre commande' })).toBeVisible();
  await page.getByTestId(TEST_IDS.shop.checkoutSubmitBtn).click();
  await expect(page.getByTestId(TEST_IDS.shop.thankYouPage)).toContainText('Commande transmise');
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({ shopId, currency: 'EUR', items: [{ productId,
    productLabel: 'Flyer A5', quantity: 1, expectedUnitPriceHt: '125.00' }] });
  expect(orders[0].items[0].clariprintOptions).toMatchObject({ quantity: 500 });
  expect(orders[0].idempotencyKey).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath('commande-simulee.png') });
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`les recherches ont un nom accessible et des menus distincts (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await fixture(page);
    await page.goto('/shop/recette-boutique/catalog');
    const catalogSearch = page.getByRole('combobox', { name: 'Rechercher dans le catalogue' });
    await expect(catalogSearch).toBeVisible();
    const headerInputs = page.getByTestId(TEST_IDS.shop.headerSearchInput);
    const ids = await headerInputs.evaluateAll((inputs) => inputs.map((input) => input.getAttribute('aria-controls')));
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length);
    const visibleHeader = headerInputs.filter({ visible: true });
    await visibleHeader.fill('Flyer');
    const menuId = await visibleHeader.getAttribute('aria-controls');
    const menu = page.locator('[role="listbox"]').filter({ visible: true });
    await expect(menu).toHaveAttribute('id', menuId!);
    await expect(menu.getByRole('option').first()).toBeVisible();
    await catalogSearch.fill('Flyer A5');
    await expect(catalogSearch).toHaveAttribute('aria-expanded', 'true');
  });
}
