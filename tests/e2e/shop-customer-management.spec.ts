import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fixture } from './fixtures/backoffice-shops';

const tenant = '20000000-0000-4000-8000-000000000001';
const shop = '51000000-0000-4000-8000-000000000001';
const customerId = '61000000-0000-4000-8000-000000000001';
const base = `/api/v1/tenants/${tenant}/shops/${shop}/customers`;
const path = `/t/magrit-development/dashboard/shops/${shop}`;
const customer = { id: customerId, shopId: shop, email: 'alice@example.invalid', normalizedEmail: 'alice@example.invalid', fullName: 'Alice Client', status: 'active', authSubjectId: null, createdByMagritUserId: null, customerContactId: null, createdAt: '2026-09-01T10:00:00Z', activatedAt: '2026-09-02T10:00:00Z', suspendedAt: null as string | null };

for (const width of [375, 768, 1280]) test(`fiche client, CA, pagination et désactivation (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await fixture(page);
  let account = { ...customer };
  let statusFailure = true;
  let nameFailure = true;
  const pages: string[] = [];
  const writes: unknown[] = [];
  await page.route(`**${base}**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === `${base}/page`) {
      const second = url.searchParams.get('page[cursor]') === 'page-2';
      pages.push(second ? '2' : '1');
      expect(url.searchParams.get('page[size]')).toBe('20');
      return route.fulfill({ json: { items: second ? [{ ...account, fullName: 'Dernier client' }] : Array.from({ length: 20 }, (_, index) => ({ ...account, id: index === 0 ? customerId : `61000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, fullName: index === 0 ? account.fullName : `Client ${index + 1}`, email: index === 0 ? account.email : `client${index}@example.invalid`, normalizedEmail: index === 0 ? account.email : `client${index}@example.invalid` })), nextCursor: second ? null : 'page-2' } });
    }
    if (url.pathname === `${base}/${customerId}/orders`) {
      const second = url.searchParams.has('page[cursor]');
      return route.fulfill({ json: { items: [{ id: second ? '71000000-0000-4000-8000-000000000002' : '71000000-0000-4000-8000-000000000001', number: second ? 'CDE-002' : 'CDE-001', createdAt: '2026-10-01T10:00:00Z', status: second ? 'draft' : 'validated', currency: 'EUR', totalHt: second ? '45.00' : '125.00' }], nextCursor: second ? null : 'orders-2' } });
    }
    if (url.pathname === `${base}/${customerId}` && request.method() === 'PATCH') {
      const command = request.postDataJSON();
      writes.push(command);
      if ((command.fullName && nameFailure) || (command.enabled === false && statusFailure)) {
        if (command.fullName) nameFailure = false;
        else statusFailure = false;
        return route.fulfill({ status: 503, json: { type: 'about:blank', title: 'Service indisponible. Réessayez.', status: 503, code: 'recipe.unavailable', requestId: 'client' } });
      }
      account = { ...account, fullName: command.fullName ?? account.fullName, status: command.enabled === false ? 'suspended' : command.enabled === true ? 'active' : account.status, suspendedAt: command.enabled === false ? '2026-10-09T12:00:00Z' : command.enabled === true ? null : account.suspendedAt };
      return route.fulfill({ json: account });
    }
    if (url.pathname === `${base}/${customerId}`) return route.fulfill({ json: { customer: account, orderCount: 2, revenue: [{ currency: 'EUR', totalHt: '125.00', orderCount: 1 }] } });
    return route.fulfill({ status: 404, json: { type: 'about:blank', title: 'Introuvable', status: 404, code: 'recipe.not_found', requestId: 'client' } });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${path}?section=clients`);
  await expect(page.getByRole('link', { name: 'Alice Client', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Pages des clients' }).getByRole('button', { name: 'Suivante', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Dernier client' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Pages des clients' }).getByRole('button', { name: 'Suivante' })).toBeDisabled();
  await page.getByRole('button', { name: 'Précédente', exact: true }).click();
  await page.getByRole('link', { name: 'Alice Client', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Alice Client' })).toBeVisible();
  await expect(page.getByText('125,00 €', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Commande CDE-001' })).toHaveAttribute('href', /dashboard\/orders\//);
  await page.getByRole('button', { name: 'Commandes suivantes' }).click();
  await expect(page.getByRole('link', { name: 'Commande CDE-002' })).toBeVisible();
  await page.getByRole('button', { name: 'Commandes précédentes' }).click();
  await expect(page.getByRole('link', { name: 'Commande CDE-001' })).toBeVisible();
  await page.getByLabel('Nom complet').fill('Alice Renommée');
  await page.getByRole('link', { name: 'Clients de la boutique' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Quitter sans enregistrer');
  await page.getByRole('button', { name: 'Rester sur le client' }).click();
  await page.getByRole('button', { name: 'Enregistrer les informations' }).click();
  await expect(page.getByRole('alert')).toContainText('indisponible');
  await expect(page.getByLabel('Nom complet')).toHaveValue('Alice Renommée');
  await page.getByRole('button', { name: 'Enregistrer les informations' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Informations enregistrées.' })).toBeVisible();
  await page.getByRole('button', { name: 'Désactiver l’accès' }).click();
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  expect(writes).toHaveLength(2);
  await page.getByRole('button', { name: 'Désactiver l’accès' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('sessions seront révoquées');
  await page.getByRole('button', { name: 'Confirmer', exact: true }).click();
  await expect(page.getByRole('alertdialog').getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Réactiver l’accès' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Commande CDE-001' })).toBeVisible();
  await page.getByRole('button', { name: 'Réactiver l’accès' }).click();
  await page.getByRole('button', { name: 'Confirmer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Désactiver l’accès' })).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  expect(pages).toContain('2');
  await page.screenshot({ path: test.info().outputPath(`client-${width}.png`), fullPage: true });
});

test('une panne client ou commandes propose une reprise et garde un retour à la boutique', async ({ page }) => {
  await fixture(page);
  let detailFails = true;
  let ordersFail = true;
  await page.route(`**${base}**`, async route => {
    const pathname = new URL(route.request().url()).pathname;
    const problem = () => route.fulfill({ status: 503, json: { type: 'about:blank', title: 'Service indisponible', status: 503, code: 'recipe.unavailable', requestId: 'retry' } });
    if (pathname.endsWith('/orders')) {
      if (ordersFail) { ordersFail = false; return problem(); }
      return route.fulfill({ json: { items: [], nextCursor: null } });
    }
    if (detailFails) { detailFails = false; return problem(); }
    return route.fulfill({ json: { customer, orderCount: 0, revenue: [] } });
  });
  await page.goto(`${path}/customers/${customerId}`);
  await expect(page.getByRole('alert')).toContainText('indisponible');
  await expect(page.getByRole('link', { name: 'Clients de la boutique' })).toBeVisible();
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alice Client', level: 1 })).toBeVisible();
  await expect(page.getByText('Aucune commande validée.')).toBeVisible();
  await page.getByRole('button', { name: 'Réessayer les commandes' }).click();
  await expect(page.getByText('Aucune commande sur cette page.')).toBeVisible();
});
