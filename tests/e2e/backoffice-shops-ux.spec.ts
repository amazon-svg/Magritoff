import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { ShopDto } from '../../src/modules/shops';

const tenantId = '20000000-0000-4000-8000-000000000001';
const libraryId = '51000000-0000-4000-8000-000000000002';
const shopId = '51000000-0000-4000-8000-000000000001';
const prefix = `/api/v1/tenants/${tenantId}`;
const path = '/t/magrit-development/dashboard/shops';
const original: ShopDto = { id: shopId, tenantId, ownerUserId: '10000000-0000-4000-8000-000000000001',
  slug: 'boutique-recette-ux', name: 'Boutique de recette', description: 'Produits et accès clients',
  theme: { primaryColor: '#0f172a', accentColor: '#16a34a', mode: 'light' }, logoUrl: '',
  address: '', contactEmail: '', active: true, libraryIds: [], excludedProductIds: [],
  heroImageUrl: null, tagline: null, pimCatalogMode: false, pimGammeSlugs: [], accessMode: 'invite_only',
  createdAt: '2026-10-09T08:00:00Z' };

// Session et mutations métier simulées ; aucune donnée métier ni session réelle créée.
async function fixture(page: Page, failList = false) {
  let shop = { ...original };
  let listFailures = failList ? 1 : 0;
  let creationFails = true;
  let saveFails = true;
  const writes: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    if (pathname === '/api/v1/auth/get-session') return route.fulfill({ json: { user: { id: original.ownerUserId, email: 'recette@example.invalid', name: 'Recette UX' } } });
    if (pathname === '/api/v1/session') return route.fulfill({ json: { user: { id: original.ownerUserId }, isSuperAdmin: true,
      tenants: [{ id: tenantId, slug: 'magrit-development', name: 'Espace de recette', parent_tenant_id: null, plan: 'pro', is_system_tenant: false, settings: {}, created_at: original.createdAt, myRole: 'admin', accessScope: 'magrit_full', allowedShopIds: [], permissions: { can_quote: true, can_order: true, can_invite: true }, inheritedFromParent: false }],
      preferences: { theme: 'light', language: 'fr', default_delivery_zone: '', notifications_email: false, plan: 'pro', is_admin: true, last_tenant_id: tenantId } } });
    if (pathname === `${prefix}/access-profile`) return route.fulfill({ json: { tenantId, userId: original.ownerUserId, membership: 'admin', isAdmin: true, surfaces: ['workspace', 'backoffice'], capabilities: ['shops.manage', 'libraries.manage', 'libraries.read'] } });
    if (pathname === '/api/v1/session/current-tenant') return route.fulfill({ json: { updated: true } });
    const problem = () => route.fulfill({ status: 503, json: { type: 'about:blank', title: 'Service temporairement indisponible. Réessayez.', status: 503, code: 'recipe.unavailable', requestId: 'ux' } });
    if (pathname === `${prefix}/shops` && method === 'GET') {
      if (listFailures-- > 0) return problem();
      return route.fulfill({ json: [shop] });
    }
    if (pathname === `${prefix}/shops` && method === 'POST') {
      writes.push('create');
      if (creationFails) { creationFails = false; return problem(); }
      const command = request.postDataJSON();
      shop = { ...shop, ...command, theme: { ...shop.theme, ...command.theme } };
      return route.fulfill({ status: 201, json: shop });
    }
    if (pathname === `${prefix}/shops/${shopId}` && method === 'PATCH') {
      writes.push('save');
      if (saveFails) { saveFails = false; return problem(); }
      const patch = request.postDataJSON();
      shop = { ...shop, ...patch, theme: { ...shop.theme, ...patch.theme } };
      return route.fulfill({ json: shop });
    }
    if (pathname === `${prefix}/shops/${shopId}` && method === 'DELETE') {
      writes.push('delete');
      return problem();
    }
    if (pathname === `${prefix}/libraries`) return route.fulfill({ json: [{ id: libraryId, tenant_id: tenantId, user_id: original.ownerUserId, name: 'Produits de recette', description: '' }] });
    if (pathname === `${prefix}/library-products`) return route.fulfill({ json: [1, 2].map(number => ({ id: `51000000-0000-4000-8000-00000000000${number + 2}`, library_id: libraryId, name: `Article fixe ${number}`, category: 'Articles', description: '', price_ht: 100, image_url: '', config: { pricing_mode: 'fixed_unit' }, active: true, gamme_slug: null })) });
    if (pathname === '/api/v1/catalog/pim') return route.fulfill({ json: { gammes: [], definitions: [] } });
    if ([ `${prefix}/shops/${shopId}/products`, `${prefix}/shops/${shopId}/pricing`, `${prefix}/shops/${shopId}/customers`].includes(pathname)) return route.fulfill({ json: [] });
    if (method === 'GET' || pathname.startsWith('/api/v1/auth/')) return route.continue();
    return problem();
  });
  return { writes };
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const width of [375, 768, 1280]) {
  test(`création, réglages, erreurs et protection de saisie (${width}px)`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    const { writes } = await fixture(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Boutiques', exact: true })).toBeVisible();
    await noOverflow(page);
    const create = page.getByRole('button', { name: 'Créer une boutique', exact: true });
    await create.click();
    await page.getByLabel('Nom de la boutique (obligatoire)').fill('Boutique créée');
    await page.keyboard.press('Escape');
    await expect(create).toBeFocused();
    await create.click();
    await expect(page.getByLabel('Nom de la boutique (obligatoire)')).toHaveValue('Boutique créée');
    await page.getByRole('button', { name: 'Créer la boutique', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('Nom de la boutique (obligatoire)')).toHaveValue('Boutique créée');
    await page.getByRole('button', { name: 'Créer la boutique', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(shopId));
    await expect(page.getByRole('tab', { name: 'Catalogue', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByLabel(/Produits de recette/).check();
    const information = page.getByRole('tab', { name: 'Informations', exact: true });
    await information.click();
    await expect(page).toHaveURL(/section=informations/);
    await page.getByLabel('Nom', { exact: true }).fill('Boutique renommée');
    await page.getByRole('tab', { name: 'Apparence', exact: true }).click();
    await expect(page.getByLabel('Couleur primaire', { exact: true })).toBeVisible();
    await information.click();
    await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Boutique renommée');
    await page.getByRole('link', { name: 'Toutes les boutiques', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Quitter sans enregistrer');
    await page.getByRole('button', { name: 'Rester sur la boutique' }).click();
    await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Boutique renommée');
    await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'indisponible' })).toBeVisible();
    await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Boutique renommée');
    await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Modifications enregistrées.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer les modifications' })).toBeDisabled();
    await page.getByRole('tab', { name: 'Catalogue', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Accès et clients', exact: true })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Accès et clients', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel(/Accès des acheteurs/)).toBeVisible();
    await noOverflow(page);
    const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(axe.violations, JSON.stringify(axe.violations.map(value => ({ id: value.id, nodes: value.nodes.map(node => node.target) })))).toEqual([]);
    for (const label of ['Informations', 'Apparence', 'Catalogue']) {
      await page.getByRole('tab', { name: label, exact: true }).click();
      await noOverflow(page);
      const result = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations, JSON.stringify(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })))).toEqual([]);
    }
    await page.getByRole('tab', { name: 'Produits (2)', exact: true }).click();
    await expect(page.getByLabel('Prix de vente négocié HT de Article fixe 1', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Prix de vente négocié HT de Article fixe 2', { exact: true })).toBeVisible();
    const productAxe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(productAxe.violations, JSON.stringify(productAxe.violations.map(v => v.id))).toEqual([]);
    await noOverflow(page);
    if (width === 375) {
      await page.getByRole('button', { name: 'Ouvrir le menu du back-office' }).click();
      await expect(page.getByRole('dialog', { name: 'Navigation du back-office' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Ouvrir le menu du back-office' })).toBeFocused();
    }
    await page.screenshot({ path: test.info().outputPath(`boutique-${width}.png`), fullPage: true });
    expect(writes).toEqual(['create', 'create', 'save', 'save']);
    expect(errors).toEqual([]);
  });
}

test('une panne de liste permet de réessayer ; la suppression garde sa confirmation et son erreur', async ({ page }) => {
  const { writes } = await fixture(page, true);
  await page.goto(path);
  await expect(page.getByRole('alert')).toContainText('Impossible de charger');
  await expect(page.getByText('Votre première boutique')).toHaveCount(0);
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Boutique de recette', exact: true })).toBeVisible();
  const remove = page.getByRole('button', { name: 'Supprimer la boutique Boutique de recette' });
  await remove.click();
  await expect(page.getByRole('alertdialog')).toContainText('irréversible');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(remove).toBeFocused();
  expect(writes).toEqual([]);
  await remove.click();
  await page.getByRole('button', { name: 'Supprimer la boutique', exact: true }).click();
  await expect(page.getByRole('alertdialog').getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  expect(writes).toEqual(['delete']);
});
