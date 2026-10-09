import { test, expect } from '@playwright/test';
import { fixture } from './fixtures/backoffice-shops';
import { storefrontDetail } from '../modules/orders/_fixtures/unified-order-detail';

for (const width of [375, 1280]) test(`une commande boutique sans annexes affiche des états vides (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await fixture(page);
  const orderId = storefrontDetail.id;
  const requests: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    if (pathname === `/api/v1/order-summaries/${orderId}`) return route.fulfill({ json: { data: storefrontDetail, meta: { request_id: 'annex' } }, headers: { etag: '"annex"' } });
    if (pathname === '/api/v1/production-steps') return route.fulfill({ json: { data: [], meta: { request_id: 'annex' } } });
    if (pathname === `/api/v1/commercial-orders/${orderId}/files` || pathname === `/api/v1/commercial-orders/${orderId}/upload-links`) {
      requests.push(pathname); return route.fulfill({ json: { data: [], meta: { request_id: 'annex' } } });
    }
    if (pathname === `/api/v1/commercial-orders/${orderId}/documents`) {
      requests.push(pathname); return route.fulfill({ status: 404, json: { type: 'about:blank', title: 'Aucun bon produit', status: 404, code: 'order.document_not_generated', request_id: 'annex' } });
    }
    return route.fallback();
  });
  await page.goto(`/t/magrit-development/dashboard/orders/${orderId}`);
  await expect(page.getByText('Aucun fichier déposé sur cette commande.')).toBeVisible();
  await expect(page.getByText('Aucun lien de dépôt actif pour cette commande.')).toBeVisible();
  await expect(page.getByText('Aucun bon de commande produit pour cette commande.')).toBeVisible();
  await expect(page.getByText('La production du bon PDF n’est pas encore disponible pour les commandes boutique.')).toBeVisible();
  await expect(page.getByText('Impossible de charger les fichiers de cette commande.')).toHaveCount(0);
  await expect(page.getByText('Chargement des liens de depot impossible.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Produire le bon de commande' })).toHaveCount(0);
  await expect.poll(() => requests.length).toBe(3);
  await page.screenshot({ path: test.info().outputPath(`annexes-${width}.png`), fullPage: true });
});
