import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './_helpers/auth';
import type { OrderListEntry } from '../../src/modules/orders/api/contracts';
import { readFile } from 'node:fs/promises';

// Recette sans mutation de commandes sur les fixtures UX locales : au moins 100 commandes,
// les deux origines et des étapes de production affectées.
const tenantSlug = process.env.E2E_QA_TENANT_SLUG ?? 'atelier-lumiere';
const email = process.env.E2E_QA_EMAIL ?? 'developer@magrit.local';
const password = process.env.E2E_QA_PASSWORD ?? 'magrit-development-only';
const path = `/t/${tenantSlug}/dashboard/orders`;
const rows = (page: Page) => page.locator('[data-testid="shop-orders-row"]');

type ListPage = { data: OrderListEntry[]; meta: { next_cursor: string | null } };
async function readPage(page: Page, action: () => Promise<unknown>): Promise<ListPage> {
  const response = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/order-summaries' && response.request().method() === 'GET');
  await action();
  const result = await response;
  expect(result.status()).toBe(200);
  const body = await result.json() as ListPage;
  await expect(page.getByRole('button', { name: 'Appliquer', exact: true })).toBeEnabled();
  await expect(rows(page)).toHaveCount(body.data.length);
  return body;
}
async function apply(page: Page) { return readPage(page, () => page.getByRole('button', { name: 'Appliquer', exact: true }).click()); }
async function reset(page: Page) { return readPage(page, () => page.getByRole('button', { name: 'Réinitialiser', exact: true }).click()); }

test.beforeEach(async ({ page }) => { await loginAs(page, email, password); });

test('liste réelle : pagination, filtres communs et absence de chevauchement', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const initial = await readPage(page, () => page.goto(path));
  expect(initial.data).toHaveLength(50);
  expect(new Set(initial.data.map((row) => row.origin))).toEqual(new Set(['quote', 'storefront']));
  expect(initial.meta.next_cursor).not.toBeNull();
  await expect(page.getByRole('button', { name: 'Précédente', exact: true })).toBeDisabled();
  const next = await readPage(page, () => page.getByRole('button', { name: 'Suivante', exact: true }).click());
  expect(new Set([...initial.data, ...next.data].map((row) => row.id)).size).toBe(initial.data.length + next.data.length);
  await expect(page.getByRole('navigation', { name: 'Pagination des commandes' })).toContainText('Page 2');
  const previous = await readPage(page, () => page.getByRole('button', { name: 'Précédente', exact: true }).click());
  expect(previous.data.map((row) => row.id)).toEqual(initial.data.map((row) => row.id));

  await page.getByRole('combobox', { name: 'Origine', exact: true }).selectOption('quote');
  const quotePage = await apply(page);
  expect(quotePage.data.length).toBeGreaterThan(0);
  expect(quotePage.data.every((row) => row.origin === 'quote')).toBe(true);
  const quote = quotePage.data[0];
  const numberBounds = await rows(page).first().locator('td').nth(0).locator('button').boundingBox();
  const dateBounds = await rows(page).first().locator('td').nth(1).boundingBox();
  expect(numberBounds!.x + numberBounds!.width).toBeLessThanOrEqual(dateBounds!.x);

  await page.getByLabel('Client', { exact: true }).fill(quote.customer_name!);
  const customerPage = await apply(page);
  expect(customerPage.data.length).toBeGreaterThan(0);
  expect(customerPage.data.every((row) => row.customer_name?.toLowerCase().includes(quote.customer_name!.toLowerCase()))).toBe(true);
  await reset(page);

  await page.getByRole('combobox', { name: 'Origine', exact: true }).selectOption('storefront');
  await page.getByRole('combobox', { name: 'Statut', exact: true }).selectOption('draft');
  const storefront = initial.data.find((row) => row.origin === 'storefront')!;
  await page.getByRole('combobox', { name: 'Boutique', exact: true }).selectOption(storefront.shop_id!);
  const storefrontPage = await apply(page);
  expect(storefrontPage.data.length).toBeGreaterThan(0);
  expect(storefrontPage.data.every((row) => row.origin === 'storefront' && row.status === 'draft' && row.shop_id === storefront.shop_id)).toBe(true);
  const statusBounds = await rows(page).first().locator('td').nth(7).locator('span').first().boundingBox();
  const actionsBounds = await rows(page).first().locator('td').nth(8).boundingBox();
  expect(statusBounds!.x + statusBounds!.width).toBeLessThanOrEqual(actionsBounds!.x);
  await reset(page);

  const stepId = await page.getByRole('combobox', { name: 'Étape de production', exact: true }).locator('option').nth(1).getAttribute('value');
  expect(stepId).toBeTruthy();
  await page.getByRole('combobox', { name: 'Étape de production', exact: true }).selectOption(stepId!);
  const productionPage = await apply(page);
  expect(productionPage.data.length).toBeGreaterThan(0);
  expect(productionPage.data.every((row) => row.current_production_step_id === stepId)).toBe(true);
  await reset(page);

  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(initial.data[0].created_at));
  await page.getByLabel('Du', { exact: true }).fill(date);
  await page.getByLabel('Au', { exact: true }).fill(date);
  const periodPage = await apply(page);
  expect(periodPage.data.length).toBeGreaterThan(0);
  expect(periodPage.meta.next_cursor).toBeNull();
  expect(periodPage.data.every((row) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(row.created_at)) === date)).toBe(true);
  await expect(page.getByRole('button', { name: 'Suivante', exact: true })).toBeDisabled();
  await reset(page);
  await page.getByLabel('Client', { exact: true }).fill('__client_inexistant_recette__');
  expect((await apply(page)).data).toHaveLength(0);
  await expect(page.getByText('Aucune commande pour le moment.')).toBeVisible();
  await reset(page);
  await page.screenshot({ path: test.info().outputPath('commandes.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('les deux origines ouvrent leur fiche canonique et le client CRM est accessible', async ({ page }) => {
  test.setTimeout(90_000);
  const detailRequests: string[] = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'GET' && /^\/api\/v1\/(?:order-summaries|orders|commercial-orders)\/[^/]+$/.test(pathname)) {
      detailRequests.push(pathname);
    }
  });
  const initial = await readPage(page, () => page.goto(path));
  const storefront = initial.data.find((row) => row.origin === 'storefront')!;
  await page.locator(`[data-testid="shop-orders-row"][data-order-id="${storefront.id}"]`).getByRole('button', { name: `Ouvrir la commande ${storefront.id}`, exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/orders/${storefront.id}$`));
  await expect(page.getByTestId('order-backoffice-detail')).toBeVisible();
  await expect(page.getByTestId('order-files-block')).toBeVisible();
  await expect(page.getByTestId('order-files-line-select')).toContainText('Toute la commande');
  await expect(page.getByTestId('order-upload-links-block')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('order-backoffice-detail')).toBeVisible();
  await readPage(page, () => page.getByRole('link', { name: 'Retour aux commandes' }).click());

  const quote = initial.data.find((row) => row.origin === 'quote')!;
  const quoteRow = page.locator(`[data-testid="shop-orders-row"][data-order-id="${quote.id}"]`);
  await quoteRow.getByRole('button', { name: `Ouvrir la commande ${quote.number}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/orders/${quote.id}$`));
  await expect(page.getByRole('heading', { name: quote.number!, exact: true })).toBeVisible();
  await expect(page.getByTestId('order-files-block')).toBeVisible();
  await expect(page.getByTestId('order-files-line-select')).toContainText('Toute la commande');
  await expect(page.getByTestId('order-upload-links-block')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: quote.number!, exact: true })).toBeVisible();
  await readPage(page, () => page.getByRole('link', { name: 'Retour aux commandes' }).click());
  expect(detailRequests.length).toBeGreaterThanOrEqual(4);
  expect(detailRequests.every((request) => request.startsWith('/api/v1/order-summaries/'))).toBe(true);
  await page.locator(`[data-testid="shop-orders-row"][data-order-id="${quote.id}"]`).getByRole('button', { name: `Ouvrir la fiche client ${quote.customer_name}` }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/customers/${quote.customer_id}$`));
});

test('export commun : utilise les filtres appliqués puis permet le téléchargement du CSV', async ({ page }) => {
  test.setTimeout(90_000);
  await readPage(page, () => page.goto(path));
  await page.getByRole('combobox', { name: 'Origine', exact: true }).selectOption('storefront');
  await page.getByRole('combobox', { name: 'Statut', exact: true }).selectOption('draft');
  const selected = await apply(page);
  expect(selected.data.length).toBeGreaterThan(0);
  // Un brouillon de filtre non appliqué ne doit pas modifier l'export.
  await page.getByLabel('Client', { exact: true }).fill('__non_applique__');
  await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Boutique');
  await expect(dialog).not.toContainText('__non_applique__');
  await dialog.getByRole('radio', { name: 'CSV', exact: true }).check();
  const requested = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/order-exports' && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: /Exporter|Demander|Lancer/ }).click();
  const response = await requested;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON().filters).toEqual({ origin: 'storefront', status: 'draft' });
  const { data } = await response.json();
  expect(data.layout_version).toBe(2);
  await expect(dialog).toBeHidden();
  console.log(`Export de recette : ${data.id}`);
  const downloadButton = page.locator(`[data-export-id="${data.id}"]`).getByRole('button', { name: 'Télécharger', exact: true });
  await expect(downloadButton).toBeVisible({ timeout: 60_000 });
  const downloaded = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  await download.saveAs(test.info().outputPath('commandes-communes.csv'));
  const csv = await readFile(test.info().outputPath('commandes-communes.csv'), 'utf8');
  expect(csv.split('\n')[0]).toContain('Origine');
  expect(csv.split('\n')[0]).toContain('Boutique');
  expect(csv).toContain(selected.data[0].id);
  expect(csv).not.toContain(';Devis;');
});
