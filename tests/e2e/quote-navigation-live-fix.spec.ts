import { test, expect } from '@playwright/test';
import { loginAs } from './_helpers/auth';

/**
 * Bug 4 remonte par Arnaud en test live (2026-09-02, chantier unification des
 * devis) : "clic sur un devis renvoie vers Projet". Reproduction sur le
 * tenant reel qa-espace-2408 (compte amazon@ageservices.fr), avec le projet
 * "Projet Test QA" deja cree par Arnaud comme cible.
 *
 * Ce tenant n avait pas encore de devis existant (seuls un client et un
 * projet vides y avaient ete crees pour le bug 2) : ce test seme lui-meme
 * un chiffrage (via la restauration synchrone de ConversationContext, comme
 * `add-to-project-modal-live-fix.spec.ts`) puis un devis brouillon via le
 * flux reel (fiche projet -> case a cocher -> "Creer un devis"), avant de
 * verifier le clic depuis la liste. Nettoie les deux (devis brouillon +
 * chiffrage) a la fin pour ne pas polluer les donnees de QA d Arnaud.
 *
 * Correctif qa-review (2026-09-03) : meme defaut que celui deja corrige dans
 * `project-create-no-double-fetch.spec.ts` — le nettoyage etait place APRES
 * les assertions principales, donc jamais execute si celles-ci echouaient,
 * et decidait des clics via `locator.isVisible({ timeout }).catch(() =>
 * false)` qui ne RE-essaie jamais (contrairement a
 * `expect(locator).toBeVisible()`). Le commentaire qui justifiait la boucle
 * `for (;;)` par des rejeux precedents ayant laisse plusieurs items reconnait
 * deja le symptome sans en garantir la cause : un `if` isole place hors
 * `finally` sautait le nettoyage sans le signaler, y compris sur un run vert.
 * Deplace dans un `finally` et remplace chaque decision de clic par une
 * assertion `toBeVisible` (qui attend/re-essaie).
 */
const TENANT_SLUG = process.env.E2E_QA_TENANT_SLUG ?? 'qa-espace-2408';
const ADMIN_EMAIL = process.env.E2E_QA_EMAIL ?? 'amazon@ageservices.fr';
const ADMIN_PASSWORD = process.env.E2E_QA_PASSWORD ?? 'admin123';
const PRODUCT_LABEL = 'Flyer test E2E QuoteNavigation';

test('clic sur une ligne de devis ouvre bien l editeur du devis, pas un retour projets', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(`${err.name}: ${err.message}`));

  let tenantId: string | null = null;
  page.on('request', (req) => {
    if (tenantId) return;
    const header = req.headers()['x-magrit-tenant'];
    if (header) tenantId = header;
  });

  let projectId: string | null = null;
  let quoteId: string | null = null;

  try {
    // ── 1. Seme un chiffrage produit dans l atelier (meme technique que
    //      add-to-project-modal-live-fix.spec.ts) ──────────────────────────
    await page.goto('about:blank');
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto(`/t/${TENANT_SLUG}`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect.poll(() => tenantId, { timeout: 15_000 }).not.toBeNull();

    const convId = `e2e-conv-${Date.now()}`;
    const productPayload = {
      id: `e2e-prod-${Date.now()}`,
      name: PRODUCT_LABEL,
      category: 'Flyer',
      quantity: 1000,
      price: 250,
      format: 'A5',
      material: 'Couché brillant 135g',
      weight: 135,
      dimensions: { width: 148, height: 210 },
    };
    await page.evaluate(
      ({ tenantId, convId, productPayload }) => {
        localStorage.setItem(`magrit_current_conversation__${tenantId}`, convId);
        localStorage.setItem(
          `magrit_conversation_history__${tenantId}`,
          JSON.stringify([
            {
              id: convId,
              timestamp: Date.now(),
              title: 'E2E QuoteNavigation smoke',
              messages: [
                { role: 'user', content: 'Flyer A5 1000 ex' },
                { role: 'assistant', content: 'Voici une proposition.' },
              ],
              products: [productPayload],
            },
          ]),
        );
      },
      { tenantId, convId, productPayload },
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
    await page.locator('text=/Total\\s*TTC/i').first().click();
    await page.waitForTimeout(1_000);

    const quoteModal = page.locator('div.fixed.inset-0.z-50');
    await quoteModal
      .getByRole('button', { name: 'Ajouter au projet', exact: true })
      .first()
      .click();

    const addToProjectModal = page.getByTestId('project-add-to-project-modal');
    await expect(addToProjectModal).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('project-add-to-project-existing-option').check();
    const select = page.locator('#add-to-project-select');
    await expect(select).toBeEnabled({ timeout: 8_000 });
    projectId = await select.locator('option').nth(1).getAttribute('value');
    await select.selectOption({ index: 1 });
    await page.getByTestId('project-add-to-project-submit-btn').click();
    await expect(page.getByText(/ajouté au projet/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Terminer', exact: true }).click();
    await expect(addToProjectModal).toBeHidden({ timeout: 5_000 });

    test.skip(!projectId, 'Aucun projet cible resolu.');

    // ── 2. Cree un devis brouillon depuis la fiche projet (flux reel) ──────
    await page.goto(`/t/${TENANT_SLUG}/dashboard/projects/${projectId}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const itemRow = page
      .getByTestId('project-item-row')
      .filter({ hasText: PRODUCT_LABEL })
      .first();
    await expect(itemRow).toBeVisible({ timeout: 10_000 });
    await itemRow.getByTestId('project-item-checkbox').check();

    await page.getByTestId('project-create-quote-btn').click();
    const drawer = page.getByTestId('quote-create-drawer');
    await expect(drawer).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('quote-create-submit-btn').click();

    // Creation reussie -> navigation directe vers l editeur (CreateQuoteDrawer.onCreated).
    await expect(page).toHaveURL(
      new RegExp(`/t/${TENANT_SLUG}/dashboard/commercial-quotes/[0-9a-f-]+$`),
      { timeout: 10_000 },
    );
    quoteId = page.url().split('/commercial-quotes/')[1];
    expect(quoteId).toBeTruthy();

    await expect(page.getByTestId('quote-editor-page')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('quote-number-display')).toHaveText(/^DEV-\d{4}-\d{5}$/);

    // ── 3. Le vrai test du bug 4 : depuis la LISTE, cliquer sur la ligne du
    //      devis fraichement cree doit ouvrir l editeur, pas un retour
    //      silencieux vers les projets consecutif a un echec de chargement
    //      masque (getForEdit qui leve, detail reste null -> etat `!detail`,
    //      lien "Retour aux projets" GENERIQUE au lieu de l editeur). ───────
    await page.goto(`/t/${TENANT_SLUG}/dashboard/quotes`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(new RegExp(`/t/${TENANT_SLUG}/dashboard/quotes`));

    const rowByAttr = page.locator(`[data-testid="quote-list-row"][data-quote-id="${quoteId}"]`);
    await expect(rowByAttr).toBeVisible({ timeout: 10_000 });
    await rowByAttr.locator('a').click();

    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(
      new RegExp(`/t/${TENANT_SLUG}/dashboard/commercial-quotes/${quoteId}`),
    );
    await expect(page.getByTestId('quote-editor-page')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('quote-number-display')).toHaveText(/^DEV-\d{4}-\d{5}$/);

    const backLink = page.getByRole('link', { name: /voir le projet source/i });
    await expect(backLink).toBeVisible();
    const href = await backLink.getAttribute('href');
    expect(href).toBe(`/t/${TENANT_SLUG}/dashboard/projects/${projectId}`);

    expect(pageErrors).toEqual([]);
  } finally {
    // ── Nettoyage : supprime le devis brouillon (autorise, CA6) puis le
    //    chiffrage source, pour laisser le tenant de QA dans l etat trouve.
    //    Dans un `finally` pour s executer meme si une assertion ci-dessus
    //    echoue. ──────────────────────────────────────────────────────────
    if (quoteId) {
      await page.goto(`/t/${TENANT_SLUG}/dashboard/quotes`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      const cleanupRow = page.locator(
        `[data-testid="quote-list-row"][data-quote-id="${quoteId}"]`,
      );
      const cleanupRowAppeared = await expect(cleanupRow)
        .toBeVisible({ timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (cleanupRowAppeared) {
        await cleanupRow.getByTestId('quote-list-delete-btn').click();
        await page.getByTestId('quote-list-delete-confirm-btn').click();
        try {
          // Verifie que la suppression a reellement pris effet cote UI (pas
          // juste que le clic n a pas leve d erreur).
          await expect(cleanupRow).toBeHidden({ timeout: 5_000 });
        } catch (cleanupError) {
          console.warn(
            '[quote-navigation-live-fix] echec de verification du nettoyage (devis non retire) :',
            cleanupError,
          );
        }
      }
    }

    if (projectId) {
      await page.goto(`/t/${TENANT_SLUG}/dashboard/projects/${projectId}`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      // Boucle (pas juste un essai) : des rejeux precedents de ce test,
      // avortes avant d atteindre ce nettoyage, ont pu laisser plusieurs
      // items du meme libelle sur ce projet reel partage. Chaque iteration
      // attend/re-essaie via `toBeVisible` avant de decider si un item reste
      // a retirer.
      for (;;) {
        const candidate = page
          .getByTestId('project-item-row')
          .filter({ hasText: PRODUCT_LABEL })
          .first();
        const candidateAppeared = await expect(candidate)
          .toBeVisible({ timeout: 3_000 })
          .then(() => true)
          .catch(() => false);
        if (!candidateAppeared) break;
        const itemId = await candidate.getAttribute('data-item-id');
        await candidate.getByTestId('project-item-remove-btn').click();
        try {
          await expect(
            page.locator(`[data-testid="project-item-row"][data-item-id="${itemId}"]`),
          ).toBeHidden({ timeout: 10_000 });
        } catch (cleanupError) {
          console.warn(
            '[quote-navigation-live-fix] echec de verification du nettoyage (item non retire) :',
            cleanupError,
          );
          break;
        }
      }
    }
  }
});
