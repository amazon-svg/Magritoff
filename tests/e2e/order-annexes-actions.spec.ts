import { test, expect } from '@playwright/test';
import { fixture } from './fixtures/backoffice-shops';
import { storefrontDetail } from '../modules/orders/_fixtures/unified-order-detail';
import { TEST_IDS } from '../../src/shared/presentation/testIds';

for (const width of [375,1280]) test(`PDF, fichier et lien de dépôt boutique (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await fixture(page);
  const orderId = storefrontDetail.id;
  const base = `/api/v1/commercial-orders/${orderId}`;
  const fileId = '70000000-0000-4000-8000-000000000001';
  const linkId = '70000000-0000-4000-8000-000000000002';
  const time = '2026-10-09T10:00:00.000Z';
  const expiry = '2030-10-09T10:00:00.000Z';
  const document = { order_id: orderId, template_id: linkId, generated_at: time, generated_by: linkId, generated_by_label: 'Recette', byte_size: 100, sha256: 'a'.repeat(64), content_type: 'application/pdf', page_count: 1, download_url: 'http://localhost:5176/recipe-order.pdf', download_url_expires_at: expiry };
  const file = { id: fileId, order_id: orderId, order_line_id: null, filename: 'bat-boutique.pdf', content_type: 'application/pdf', byte_size: 24, visibility: 'internal', deposited_at: time, deposited_by: linkId, deposited_by_label: 'Recette', updated_at: time };
  const link = { id: linkId, order_id: orderId, label: 'BAT boutique', expires_at: expiry, max_files: 10, deposited_count: 0, use_count: 0, first_used_at: null, last_used_at: null, created_at: time, created_by: linkId, created_by_label: 'Recette' };
  let generation = 0; let uploaded = false; let linked = false;
  await page.route('**/recipe-upload', route => route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('**/api/v1/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    const ok = (data: unknown, status = 200) => route.fulfill({ status, json: { data, meta: { request_id: 'annexes' } } });
    if (path === `/api/v1/order-summaries/${orderId}`) return route.fulfill({ json: { data: storefrontDetail, meta: { request_id: 'annexes' } }, headers: { etag: '"annexes"' } });
    if (path === '/api/v1/production-steps') return ok([]);
    if (path === `${base}/documents`) {
      if (method === 'POST') {
        expect(request.headers()['idempotency-key']).toBeTruthy();
        if (++generation === 1) return route.fulfill({ status: 409, json: { type: 'about:blank', title: 'Aucun gabarit de bon de commande actif pour ce tenant.', status: 409, code: 'order.document_template_missing', request_id: 'annexes' } });
        return ok(document, 201);
      }
      return route.fulfill({ status: 404, json: { type: 'about:blank', title: 'Aucun bon produit', status: 404, code: 'order.document_not_generated', request_id: 'annexes' } });
    }
    if (path === `${base}/file-upload-urls`) return ok({ file_id: fileId, url: 'http://localhost:5176/recipe-upload', token: fileId, path: `tenant/${orderId}/${fileId}`, max_byte_size: 52428800, accepted_content_types: ['application/pdf'], expires_at: expiry });
    if (path === `${base}/files`) {
      if (method === 'POST') { expect(request.postDataJSON().filename).toBe(file.filename); uploaded = true; return ok(file, 201); }
      return ok(uploaded ? [file] : []);
    }
    if (path === `${base}/files/${fileId}`) return ok({ ...file, download_url: 'http://localhost:5176/recipe-file.pdf', download_url_expires_at: expiry });
    if (path === `${base}/upload-links`) {
      if (method === 'POST') { expect(request.postDataJSON().label).toBe(link.label); linked = true; return ok({ ...link, token: 'x'.repeat(43) }, 201); }
      return ok(linked ? [link] : []);
    }
    return route.fallback();
  });
  await page.goto(`/t/magrit-development/dashboard/orders/${orderId}`);
  await page.getByRole('button', { name: 'Produire le bon de commande' }).click();
  await expect(page.getByTestId(TEST_IDS.orderDocument.errorBanner)).toContainText('champ positionné');
  await expect(page.getByRole('link', { name: 'Configurer les gabarits PDF' })).toHaveAttribute('href', '/t/magrit-development/dashboard/document-templates');
  await page.getByRole('button', { name: 'Produire le bon de commande' }).click();
  await expect(page.getByTestId(TEST_IDS.orderDocument.downloadBtn)).toHaveAttribute('href', document.download_url);
  await expect(page.getByRole('button', { name: 'Produire le bon de commande' })).toHaveCount(0);
  await expect(page.getByTestId(TEST_IDS.orderDocument.errorBanner)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Configurer les gabarits PDF' })).toHaveCount(0);
  await page.locator('input[type="file"]').setInputFiles({ name: file.filename, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 BAT de recette') });
  await expect.poll(() => uploaded).toBe(true);
  await expect(page.getByText(file.filename, { exact: true })).toBeVisible();
  await expect(page.getByText('Le dépôt a échoué.', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Créer un lien', exact: true }).click();
  await page.getByLabel('Consigne pour le client (facultatif)').fill(link.label);
  await page.getByRole('button', { name: 'Créer le lien', exact: true }).click();
  await expect(page.getByTestId(TEST_IDS.orderUploadLinks.createdUrlField)).toHaveValue(/\/depot\/x+/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(link.label, { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath(`annexes-actions-${width}.png`), fullPage: true });
});
