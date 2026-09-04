import { test, expect } from '@playwright/test';
import { loginAs } from './_helpers/auth';

/**
 * Correctif qa-review B1 (2026-09-03, chantier unification des devis) :
 * le correctif du bug 2 (double `GET` apres creation, cf.
 * `project-create-no-double-fetch.spec.ts`) avait ete applique
 * mecaniquement a `CustomersPage.tsx` en retirant le `refresh()` de
 * `onClose`. Mais le flux personne morale a une etape supplementaire que le
 * flux Projets n a pas : apres creation, la modale reste ouverte sur l etape
 * "Verifier le SIRET" (`CustomerFormModal`, etat `verify`). Cette
 * verification (`POST /customers/{id}/siret-verifications`) MUTE la ligne
 * cote serveur (`siret_verified`, `siret_verified_at`) mais ne mettait a
 * jour qu un etat local dans la modale — jamais la liste. Sans le callback
 * `onVerified` (branche sur `refresh()` dans `CustomersPage`), le badge
 * "verifie" n apparaissait jamais tant que la page n etait pas rechargee
 * manuellement.
 *
 * Ce test echoue sans le correctif (le badge n apparait jamais dans le delai
 * imparti, sans rechargement de page) et passe avec.
 */
const TENANT_SLUG = process.env.E2E_QA_TENANT_SLUG ?? 'qa-espace-2408';
const ADMIN_EMAIL = process.env.E2E_QA_EMAIL ?? 'amazon@ageservices.fr';
const ADMIN_PASSWORD = process.env.E2E_QA_PASSWORD ?? 'admin123';

/**
 * Cle de Luhn generique (meme algorithme que
 * `src/modules/customers/application/siret-verification.ts#computeLuhnChecksum`,
 * duplique ici pour ne pas dependre de la resolution d alias `@/` du
 * chargeur TypeScript de Playwright) : double un chiffre sur deux EN
 * PARTANT DE LA DROITE.
 */
function computeLuhnChecksum(digits: string): boolean {
  let sum = 0;
  for (let indexFromRight = 0; indexFromRight < digits.length; indexFromRight += 1) {
    const digit = Number(digits[digits.length - 1 - indexFromRight]);
    const doubled = indexFromRight % 2 === 1;
    const value = doubled ? digit * 2 : digit;
    sum += value > 9 ? value - 9 : value;
  }
  return sum % 10 === 0;
}

/** Genere un SIRET (14 chiffres) valide en forme, avec cle de Luhn correcte. */
function generateValidSiret(prefix13: string): string {
  for (let checkDigit = 0; checkDigit <= 9; checkDigit += 1) {
    const candidate = `${prefix13}${checkDigit}`;
    if (computeLuhnChecksum(candidate)) return candidate;
  }
  throw new Error('Aucune cle de Luhn valide trouvee (ne devrait jamais arriver).');
}

test('la verification SIRET d un client personne morale met a jour le badge de la liste sans rechargement de page', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('about:blank');
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.goto(`/t/${TENANT_SLUG}/dashboard/customers`);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await expect(page.getByTestId('customers-page')).toBeVisible({ timeout: 10_000 });

  const uniqueName = `E2E SIRET badge ${Date.now()}`;
  // Date.now() produit 13 chiffres jusqu en l an ~2286 : base credible pour
  // un SIREN + les 4 premiers chiffres du NIC, sans collision entre runs.
  const siret = generateValidSiret(String(Date.now()));

  let customerId: string | null = null;

  try {
    await page.getByTestId('customer-create-btn').click();
    await expect(page.getByTestId('customer-form-modal')).toBeVisible({ timeout: 5_000 });

    // "Personne morale" est deja le type par defaut (cf. CustomerFormModal),
    // mais le poser explicitement documente l intention du test.
    await page.locator('[data-testid="customer-type-radio"][data-type="company"]').check();
    await page.getByTestId('customer-company-name-input').fill(uniqueName);
    await page.getByTestId('customer-siret-input').fill(siret);

    await page.getByTestId('customer-save-btn').click();

    // Etape "Verifier le SIRET" : la modale reste ouverte (CustomerFormModal,
    // etat `verify`), preuve que la creation a reussi.
    const verifyBtn = page.getByTestId('customer-siret-verify-btn');
    await expect(verifyBtn).toBeVisible({ timeout: 10_000 });
    await expect(verifyBtn).toHaveText(/Vérifier le SIRET/i);

    await verifyBtn.click();
    await expect(verifyBtn).toHaveText(/SIRET vérifié/i, { timeout: 10_000 });

    // Ferme la modale ("Terminer") — la liste ne doit PAS etre rechargee
    // manuellement (pas de `page.reload()` ni `page.goto()` ici) : c est
    // exactement ce que le correctif `onVerified` doit garantir.
    await page.getByTestId('customer-save-btn').click();
    await expect(page.getByTestId('customer-form-modal')).toBeHidden({ timeout: 5_000 });

    const row = page.getByTestId('customer-row').filter({ hasText: uniqueName }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    customerId = await row.getAttribute('data-customer-id');

    // Le coeur du test B1 : le badge "verifie" doit apparaitre SANS aucun
    // rechargement de page, uniquement via le refresh declenche par
    // `onVerified`.
    await expect(row.getByTestId('customer-siret-verified-badge')).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    // Nettoyage : desactive le client de test (pas de suppression possible
    // sur cette ressource, cf. CustomerDetailPage.tsx — meme discipline que
    // l archivage des projets). Verifie que la desactivation a REELLEMENT
    // pris effet (qa-review R2 : ne pas se contenter d avoir clique).
    if (customerId) {
      await page.goto(`/t/${TENANT_SLUG}/dashboard/customers/${customerId}`);
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      const deactivateBtn = page.getByRole('button', { name: /^désactiver/i });
      const appeared = await expect(deactivateBtn)
        .toBeVisible({ timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      if (appeared) {
        await deactivateBtn.click();
        try {
          await expect(page.getByRole('button', { name: /^réactiver/i })).toBeVisible({
            timeout: 10_000,
          });
        } catch (cleanupError) {
          // N ecrase pas une eventuelle erreur de test d origine : une
          // erreur de nettoyage est signalee sans etre lancee.
          console.warn(
            '[customer-siret-verify-badge] echec de verification du nettoyage (desactivation non confirmee) :',
            cleanupError,
          );
        }
      }
    }
  }
});
