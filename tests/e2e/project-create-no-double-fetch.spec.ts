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
 *
 * Correctif qa-review R2 (2026-09-03) : le nettoyage (archivage du projet
 * de test) est deplace dans un `finally` — il s executait auparavant APRES
 * l assertion principale, donc jamais si celle-ci echouait. De plus, il
 * utilisait `locator.isVisible({ timeout })` pour attendre l apparition de
 * la ligne/du bouton : cette methode ne RE-essaie jamais, contrairement aux
 * assertions web-first (`expect(locator).toBeVisible()`) — elle renvoie
 * `false` immediatement si l element n est pas encore dans le DOM au moment
 * precis de l appel, sans attendre le rendu (chargement de la fiche projet
 * apres navigation). Resultat observe en pratique : le `if` etait souvent
 * `false` et `archiveBtn.click()` n etait jamais tente, sans qu aucune
 * assertion ne l ait signale (le test passait quand meme, seule l assertion
 * principale etait verifiee). Remplace par des assertions `toBeVisible`
 * (qui attendent/re-essaient) suivies d une verification que l archivage a
 * reellement pris effet cote UI.
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

  try {
    expect(listGetCount).toBe(1);
  } finally {
    // Nettoyage : archive le projet de test — pas de suppression possible
    // sur cette ressource, l archivage est le seul retrait prevu (cf.
    // DashboardProjectDetail.tsx). Dans un `finally` pour s executer meme si
    // l assertion ci-dessus echoue.
    const row = page.getByTestId('project-row').filter({ hasText: uniqueName }).first();
    const rowAppeared = await expect(row)
      .toBeVisible({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (rowAppeared) {
      await row.getByRole('link').click();
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      const archiveBtn = page.getByRole('button', { name: /^archiver/i });
      const archiveBtnAppeared = await expect(archiveBtn)
        .toBeVisible({ timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      if (archiveBtnAppeared) {
        await archiveBtn.click();
        try {
          // Confirme que l archivage a reellement pris effet cote UI (statut
          // "Archivé" affiche et bouton devenu "Réactiver") avant de
          // conclure le nettoyage — ne pas se contenter d avoir clique.
          await expect(page.getByText(/Archivé/)).toBeVisible({ timeout: 10_000 });
          await expect(page.getByRole('button', { name: /^réactiver/i })).toBeVisible({
            timeout: 5_000,
          });
        } catch (cleanupError) {
          // N ecrase pas une eventuelle erreur de test d origine : une
          // erreur de nettoyage est signalee sans etre lancee.
          console.warn(
            '[project-create-no-double-fetch] echec de verification du nettoyage (archivage non confirme) :',
            cleanupError,
          );
        }
      }
    }
  }
});
