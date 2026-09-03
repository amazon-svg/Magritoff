import { test, expect, type ConsoleMessage } from '@playwright/test';
import { loginAs } from './_helpers/auth';

/**
 * Bug 1 remonte par Arnaud en test live (2026-09-02, chantier unification des
 * devis) : la modale "Ajouter au projet" se fige apres generation d un
 * chiffrage produit dans l atelier. Reproduction sur le tenant reel
 * qa-espace-2408 (compte amazon@ageservices.fr), avec le projet "Projet Test
 * QA" deja cree par Arnaud comme cible existante.
 *
 * Contrairement a `tests/e2e/quote-modal-tp-fix.spec.ts` (qui insere la
 * conversation via `adminClient`, indisponible dans cette session), ce test
 * s appuie uniquement sur la restauration SYNCHRONE de `ConversationContext`
 * depuis `localStorage` (voir `ConversationContext.tsx` — `restoredSync`),
 * qui ne requiert aucune ecriture serveur prealable : le produit est rendu
 * par `ProductCard` des l hydratation, avant meme la resolution reseau.
 */
const TENANT_SLUG = process.env.E2E_QA_TENANT_SLUG ?? 'qa-espace-2408';
const ADMIN_EMAIL = process.env.E2E_QA_EMAIL ?? 'amazon@ageservices.fr';
const ADMIN_PASSWORD = process.env.E2E_QA_PASSWORD ?? 'admin123';

test('QuoteModal -> Ajouter au projet -> soumission sur un projet existant, sans gel', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(`${err.name}: ${err.message}`));

  let tenantId: string | null = null;
  page.on('request', (req) => {
    if (tenantId) return;
    const header = req.headers()['x-magrit-tenant'];
    if (header) tenantId = header;
  });

  await page.goto('about:blank');
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.goto(`/t/${TENANT_SLUG}`);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  await expect.poll(() => tenantId, { timeout: 15_000 }).not.toBeNull();

  const convId = `e2e-conv-${Date.now()}`;
  const productPayload = {
    id: `e2e-prod-${Date.now()}`,
    name: 'Flyer test E2E AddToProjectModal',
    category: 'Flyer',
    quantity: 1000,
    price: 250,
    format: 'A5',
    material: 'Couché brillant 135g',
    weight: 135,
    dimensions: { width: 148, height: 210 },
  };
  const historyPayload = [
    {
      id: convId,
      timestamp: Date.now(),
      title: 'E2E AddToProjectModal smoke',
      messages: [
        { role: 'user', content: 'Flyer A5 1000 ex' },
        { role: 'assistant', content: 'Voici une proposition.' },
      ],
      products: [productPayload],
    },
  ];

  await page.evaluate(
    ({ tenantId, convId, history }) => {
      localStorage.setItem(`magrit_current_conversation__${tenantId}`, convId);
      localStorage.setItem(`magrit_conversation_history__${tenantId}`, JSON.stringify(history));
    },
    { tenantId, convId, history: historyPayload },
  );

  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  const productGrid = page.locator('[data-testid="marguerite-quote-result"]');
  await expect(productGrid).toBeVisible({ timeout: 15_000 });

  const pricingTab = page.getByRole('button', { name: /^(prix|devis|prix.*devis)/i }).first();
  if (await pricingTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pricingTab.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  const totalTtc = page.locator('text=/Total\\s*TTC/i').first();
  await expect(totalTtc).toBeVisible({ timeout: 8_000 });
  await totalTtc.click();
  await page.waitForTimeout(1_500);

  const quoteModal = page.locator('div.fixed.inset-0.z-50');
  const addToProjectBtn = quoteModal
    .getByRole('button', { name: 'Ajouter au projet', exact: true })
    .first();
  await expect(addToProjectBtn).toBeVisible({ timeout: 5_000 });
  await addToProjectBtn.click();

  const addToProjectModal = page.getByTestId('project-add-to-project-modal');
  await expect(addToProjectModal).toBeVisible({ timeout: 5_000 });

  // Mode "Projet existant" doit etre pre-selectionne des qu au moins un
  // projet actif existe sur ce tenant (Projet Test QA).
  const existingOption = page.getByTestId('project-add-to-project-existing-option');
  await expect(existingOption).toBeEnabled({ timeout: 8_000 });
  await existingOption.check();

  const select = page.locator('#add-to-project-select');
  await expect(select).toBeEnabled({ timeout: 8_000 });
  const optionCount = await select.locator('option').count();
  test.skip(optionCount <= 1, 'Aucun projet actif disponible sur ce tenant pour ce cas.');

  const selectedProjectId = await select.locator('option').nth(1).getAttribute('value');
  await select.selectOption({ index: 1 });

  const submitBtn = page.getByTestId('project-add-to-project-submit-btn');
  await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
  await submitBtn.click();

  // Bug live du 2026-09-02 (corrige ici) : le succes fermait les DEUX
  // modales dans le meme rendu que `setAddedTo(project)`, si bien que la
  // confirmation "ajoute au projet" n etait jamais visible a l ecran —
  // seul un retour silencieux au produit, sans aucun feedback. La
  // confirmation doit maintenant rester affichee jusqu a ce que
  // l utilisateur clique "Terminer".
  const confirmation = page.getByText(/ajouté au projet/i);
  await expect(confirmation).toBeVisible({ timeout: 10_000 });

  await expect(addToProjectModal).toBeVisible();

  const finishBtn = page.getByRole('button', { name: 'Terminer', exact: true });
  await expect(finishBtn).toBeVisible();
  await finishBtn.click();

  // Une fois acquittee, la confirmation ET la modale de devis se ferment.
  await expect(addToProjectModal).toBeHidden({ timeout: 5_000 });
  await expect(page.locator('div.fixed.inset-0.z-50')).toBeHidden({ timeout: 5_000 });

  expect(pageErrors).toEqual([]);
  const criticalConsoleErrors = consoleErrors.filter(
    (m) => !/favicon|ResizeObserver/i.test(m),
  );
  expect(criticalConsoleErrors).toEqual([]);

  // Nettoyage : retire le chiffrage de test du projet reel partage
  // (qa-espace-2408 / Projet Test QA), pour ne pas polluer les donnees de
  // QA manuelle d Arnaud a chaque rejeu de ce test.
  if (selectedProjectId) {
    await page.goto(`/t/${TENANT_SLUG}/dashboard/projects/${selectedProjectId}`);
    const itemRow = page
      .getByTestId('project-item-row')
      .filter({ hasText: 'Flyer test E2E AddToProjectModal' })
      .first();
    if (await itemRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await itemRow.getByTestId('project-item-remove-btn').click();
      await expect(itemRow).toBeHidden({ timeout: 5_000 });
    }
  }
});
