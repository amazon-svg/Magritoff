import { test, expect } from '@playwright/test';
import { fixture } from './fixtures/backoffice-shops';
import { TEST_IDS } from '../../src/shared/presentation/testIds';
import { basePlacementModel } from '../../src/modules/document-templates/ui/workspace/field-editor/placement-model';
import type { ReplaceDocumentPdfTemplateFieldsCommand } from '../../src/modules/document-templates/api/contracts';

const id = '70000000-0000-4000-8000-000000000011';
const sourceId = '70000000-0000-4000-8000-000000000012';
const badId = '70000000-0000-4000-8000-000000000013';
const pageGeometry = { index: 0, width_pt: 595.28, height_pt: 841.89 };

test('applique le modèle de base puis copie un gabarit compatible sans modifier la source', async ({ page }) => {
  await fixture(page);
  let target: ReplaceDocumentPdfTemplateFieldsCommand = { placements: [], lines_block: null };
  const source = basePlacementModel(pageGeometry, 'order');
  source.placements[0].x = 72;
  const original = JSON.stringify(source);
  let writes = 0;
  const detail = (templateId: string, name: string, width = 595.28) => ({
    id: templateId, name, document_type: 'order', status: 'ready', is_default: templateId === id,
    is_active: true, page_count: 1, byte_size: 100, created_at: '2026-10-12T10:00:00Z',
    updated_at: '2026-10-12T10:00:00Z', pages: [{ ...pageGeometry, width_pt: width }],
    sha256: 'a'.repeat(64), has_field_map: templateId !== id || target.placements.length > 0,
    background_url: null, background_url_expires_at: null,
  });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { data, meta: { request_id: 'model' } }, headers: { etag: '"fields"' } });
    if (path.endsWith('/access-profile')) return route.fulfill({ json: { tenantId: '20000000-0000-4000-8000-000000000001', userId: id, membership: 'admin', isAdmin: true, surfaces: ['workspace', 'backoffice'], capabilities: ['can_manage_document_templates', 'document-templates.manage'] } });
    const base = '/api/v1/document-pdf-templates';
    if (path === base) {
      // Le contrat de liste n'inclut pas les pages ni les URL signées.
      const items = [detail(id, 'Destination'), detail(sourceId, 'Bon standard'), detail(badId, 'Autre format', 400)].map(item => {
        const { pages, sha256, background_url, background_url_expires_at, has_field_map, ...listItem } = item;
        return listItem;
      });
      return ok(items);
    }
    for (const templateId of [id, sourceId, badId]) {
      if (path === `${base}/${templateId}`) return ok(detail(templateId, templateId === sourceId ? 'Bon standard' : 'Gabarit', templateId === badId ? 400 : 595.28));
      if (path === `${base}/${templateId}/fields`) {
        if (route.request().method() === 'PUT') {
          expect(templateId).toBe(id);
          expect(route.request().headers()['if-match']).toBe('"fields"');
          target = route.request().postDataJSON();
          writes++;
        }
        return ok({ template_id: templateId, ...(templateId === id ? target : source) });
      }
    }
    return route.fallback();
  });
  await page.goto(`/t/magrit-development/dashboard/document-templates/${id}/fields`);
  await page.getByRole('button', { name: 'Copier un positionnement', exact: true }).click();
  await page.getByRole('button', { name: 'Appliquer ce positionnement', exact: true }).click();
  await expect(page.getByTestId(TEST_IDS.documentTemplateFields.placementLabel)).toHaveCount(11);
  await expect(page.getByTestId(TEST_IDS.documentTemplateFields.tableRowOnCanvas)).toHaveCount(3);
  expect(writes).toBe(0);
  await expect(page.getByTestId(TEST_IDS.documentTemplateFields.saveIndicator)).toHaveAttribute('data-state', 'dirty');
  await page.getByRole('button', { name: 'Copier un positionnement', exact: true }).click();
  await page.getByLabel('Positionnement à copier', { exact: true }).selectOption(badId);
  await page.getByRole('button', { name: 'Remplacer les placements actuels', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('mêmes dimensions');
  await expect(page.getByTestId(TEST_IDS.documentTemplateFields.placementLabel)).toHaveCount(11);
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  expect(writes).toBe(0);
  await expect(page.getByTestId(TEST_IDS.documentTemplateFields.placementLabel)).toHaveCount(11);
  await page.getByRole('button', { name: 'Copier un positionnement', exact: true }).click();
  await page.getByLabel('Positionnement à copier', { exact: true }).selectOption(sourceId);
  await page.getByRole('button', { name: 'Remplacer les placements actuels', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Positionnement copié');
  await page.getByTestId(TEST_IDS.documentTemplateFields.placementLabel).filter({ hasText: 'Numéro de commande' }).click();
  await expect(page.getByLabel('X depuis la gauche (mm)', { exact: true })).toHaveValue('25.4');
  await page.getByLabel('X depuis la gauche (mm)', { exact: true }).fill('30');
  await page.getByLabel('X depuis la gauche (mm)', { exact: true }).press('Enter');
  await page.getByTestId(TEST_IDS.documentTemplateFields.saveBtn).click();
  await expect(page.getByTestId(TEST_IDS.documentTemplateFields.saveBtn)).toBeDisabled();
  expect(writes).toBe(1);
  expect(JSON.stringify(source)).toBe(original);
  await page.reload();
  await page.getByTestId(TEST_IDS.documentTemplateFields.placementLabel).filter({ hasText: 'Numéro de commande' }).click();
  await expect(page.getByLabel('X depuis la gauche (mm)', { exact: true })).toHaveValue('30');
});
