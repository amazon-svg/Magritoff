import { test, expect } from '@playwright/test';
import { loginAs } from './_helpers/auth';

/**
 * Bug 2 remonte par Arnaud en test live (2026-09-02, chantier unification
 * des devis) : lenteur perçue a la creation d un projet. Non reproduit sur
 * un tenant vide (creation instantanee), mais le reseau observe montrait
 * `GET /api/v1/projects` appele DEUX FOIS de suite juste apres le
 * `POST /projects`.
 *
 * Cause reelle (corrigee ici) : `useProjectsManagement().create()`
 * rafraichit deja la liste apres un `POST` reussi ; `ProjectsPage.tsx`
 * rafraichissait une SECONDE fois dans le `onClose` de la modale de
 * creation (appele juste apres `onCreate` par
 * `ProjectCreateModal.handleSubmit`). Invisible sur un tenant vide (les deux
 * requetes sont instantanees), mais double le nombre de requetes de liste a
 * chaque creation — perceptible sur un tenant charge (imprimerie-ipa).
 *
 * Meme correctif applique a `CustomersPage.tsx` (meme pattern exact).
 */
const TENANT_SLUG = process.env.E2E_QA_TENANT_SLUG ?? 'qa-espace-2408';
const ADMIN_EMAIL = process.env.E2E_QA_EMAIL ?? 'amazon@ageservices.fr';
const ADMIN_PASSWORD = process.env.E2E_QA_PASSWORD ?? 'admin123';

test('creer un projet ne declenche qu un seul rafraichissement de la liste', async ({ page }) => {
  await page.goto('about:blank');
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.goto(`/t/${TENANT_SLUG}/dashboard/projects`);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await expect(page.getByTestId('projects-page')).toBeVisible({ timeout: 10_000 });

  let listGetCount = 0;
  page.on('request', (req) => {
    if (req.method() !== 'GET') return;
    const { pathname } = new URL(req.url());
    // Ne compte que l endpoint de LISTE (`/api/v1/projects`), jamais un
    // sous-chemin (`/api/v1/projects/{id}` ou `/items`).
    if (pathname === '/api/v1/projects') listGetCount += 1;
  });

  await page.getByTestId('project-create-btn').click();
  await expect(page.getByTestId('project-create-modal')).toBeVisible({ timeout: 5_000 });

  const uniqueName = `E2E double-fetch ${Date.now()}`;
  await page.getByTestId('project-name-input').fill(uniqueName);

  const customerSelect = page.getByTestId('project-customer-select');
  await expect(customerSelect).toBeEnabled({ timeout: 8_000 });
  const optionCount = await customerSelect.locator('option').count();
  test.skip(optionCount <= 1, 'Aucun client disponible sur ce tenant pour ce cas.');
  await customerSelect.selectOption({ index: 1 });

  await page.getByTestId('project-create-submit-btn').click();
  await expect(page.getByTestId('project-create-modal')).toBeHidden({ timeout: 10_000 });

  // Laisse le reseau se stabiliser avant de compter.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

  expect(listGetCount).toBe(1);

  // Nettoyage : archive immediatement le projet de test (pas de suppression
  // possible sur cette ressource — l archivage est le seul retrait prevu,
  // cf. DashboardProjectDetail.tsx).
  const row = page.getByTestId('project-row').filter({ hasText: uniqueName }).first();
  if (await row.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await row.getByRole('link').click();
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    const archiveBtn = page.getByRole('button', { name: /archiver/i });
    if (await archiveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await archiveBtn.click();
    }
  }
});
