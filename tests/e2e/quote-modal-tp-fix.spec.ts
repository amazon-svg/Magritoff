import { test, expect, type ConsoleMessage } from '@playwright/test';
import { adminClient, getSessionForCredentials, injectSupabaseSession } from './_helpers/auth';

const RID = () => Math.random().toString(36).slice(2, 10);

interface MinimalFixture {
  adminEmail: string;
  adminPassword: string;
  adminUserId: string;
  tenantId: string;
  tenantSlug: string;
  cleanup: () => Promise<void>;
}

async function bootstrapMinimal(): Promise<MinimalFixture> {
  const admin = adminClient();
  const tag = RID();
  const email = `e2e-quote-${tag}@magrit.test`;
  const password = `Pwd-${tag}-${RID()}!`;

  const { data: u, error: ue } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (ue || !u.user) throw new Error(`createUser: ${ue?.message}`);

  const slug = `e2e-q-${tag}`;
  const { data: t, error: te } = await admin
    .from('tenants')
    .insert({ slug, name: `E2E Quote ${tag}` })
    .select('id, slug')
    .single();
  if (te || !t) throw new Error(`tenant insert: ${te?.message}`);

  const { error: tmErr } = await admin.from('tenant_members').insert({
    tenant_id: t.id,
    user_id: u.user.id,
    role: 'owner',
    access_scope: 'magrit_full',
    permissions: { can_quote: true, can_order: true, can_invite: true },
  });
  if (tmErr) throw new Error(`tenant_members insert: ${tmErr.message}`);

  return {
    adminEmail: email,
    adminPassword: password,
    adminUserId: u.user.id,
    tenantId: t.id,
    tenantSlug: t.slug,
    cleanup: async () => {
      await admin.from('conversations').delete().eq('user_id', u.user.id);
      await admin.from('tenant_members').delete().eq('tenant_id', t.id);
      await admin.from('tenants').delete().eq('id', t.id);
      await admin.auth.admin.deleteUser(u.user.id);
    },
  };
}

let fx: MinimalFixture;

test.describe.serial('QuoteModal — fix tp ReferenceError', () => {
  test.beforeAll(async () => {
    fx = await bootstrapMinimal();
  });

  test.afterAll(async () => {
    if (fx) await fx.cleanup();
  });

  test('QuoteModal s ouvre sans ReferenceError tp depuis la ProductCard atelier', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(`${err.name}: ${err.message}`);
    });

    // 1. Conversation factice avec un produit minimal
    const admin = adminClient();
    const convId = `e2e-conv-${Date.now()}-${RID()}`;
    const productPayload = {
      id: `e2e-prod-${Date.now()}`,
      name: 'Flyer test E2E QuoteModal',
      category: 'Flyer',
      quantity: 1000,
      price: 250,
      format: 'A5',
      material: 'Couché brillant 135g',
      weight: 135,
      dimensions: { width: 148, height: 210 },
    };
    const { error: convErr } = await admin.from('conversations').insert({
      id: convId,
      user_id: fx.adminUserId,
      tenant_id: fx.tenantId,
      title: 'E2E QuoteModal smoke',
      messages: [
        { role: 'user', content: 'Flyer A5 1000 ex' },
        { role: 'assistant', content: 'Voici une proposition.' },
      ],
      products: [productPayload],
      timestamp: new Date().toISOString(),
    });
    expect(convErr).toBeNull();

    // 2. Auth admin + pré-injecte les clés localStorage attendues par
    //    ConversationContext (restauration synchrone) AVANT le mount.
    const session = await getSessionForCredentials(fx.adminEmail, fx.adminPassword);
    await page.goto('about:blank');
    await injectSupabaseSession(page, session);

    const historyPayload = [
      {
        id: convId,
        timestamp: Date.now(),
        title: 'E2E QuoteModal smoke',
        messages: [
          { role: 'user', content: 'Flyer A5 1000 ex' },
          { role: 'assistant', content: 'Voici une proposition.' },
        ],
        products: [productPayload],
      },
    ];
    await page.addInitScript(
      ({ tenantId, convId, history }) => {
        try {
          localStorage.setItem(`magrit_current_conversation__${tenantId}`, convId);
          localStorage.setItem(
            `magrit_conversation_history__${tenantId}`,
            JSON.stringify(history),
          );
        } catch {}
      },
      { tenantId: fx.tenantId, convId, history: historyPayload },
    );

    // 3. Navigate to /t/{slug} — ConfiguratorPage (ChatInterface)
    await page.goto(`/t/${fx.tenantSlug}`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

    // 4. ProductCard doit apparaître (driven par products[] dans la conv)
    const productGrid = page.locator('[data-testid="marguerite-quote-result"]');
    await expect(productGrid).toBeVisible({ timeout: 15_000 });

    // 5. Onglet "Prix & Devis" + clic Total TTC (déclencheur QuoteModal,
    //    cf ProductCardPrix.tsx ligne 94).
    const pricingTab = page
      .getByRole('button', { name: /^(prix|devis|prix.*devis)/i })
      .first();
    if (await pricingTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pricingTab.click().catch(() => {});
      await page.waitForTimeout(500);
    }

    const totalTtc = page.locator('text=/Total\\s*TTC/i').first();
    await expect(totalTtc).toBeVisible({ timeout: 8_000 });
    await totalTtc.click();
    await page.waitForTimeout(1_500);

    // 6. QuoteModal monté → boutons Imprimer / Ajouter au panier visibles
    //    (scopés au dialog z-50 pour éviter de capter ProductCardPrix sous l overlay)
    const modal = page.locator('div.fixed.inset-0.z-50');
    const printBtn = modal.getByRole('button', { name: /imprimer le devis/i }).first();
    const cartBtn = modal.getByRole('button', { name: 'Ajouter au panier', exact: true }).first();
    await expect(printBtn).toBeVisible({ timeout: 5_000 });
    await expect(cartBtn).toBeVisible({ timeout: 5_000 });

    // 7. Aucune ReferenceError tp / "Can't find variable: tp"
    const all = [...consoleErrors, ...pageErrors];
    const tpErrors = all.filter((m) =>
      /Can't find variable: tp\b|tp is not defined|ReferenceError.*\btp\b/.test(m),
    );
    if (tpErrors.length > 0) {
      test.info().annotations.push({
        type: 'tp-reference-error',
        description: tpErrors.join(' | '),
      });
    }
    expect(tpErrors).toEqual([]);

    // 8. Le lien "Devis › Gabarits" (qui appelle tp(...)) doit avoir un href
    //    /t/{slug}/dashboard/quote-templates correctement préfixé.
    const link = modal.getByRole('link', { name: /devis.*gabarits|changer mon gabarit/i }).first();
    if (await link.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const href = await link.getAttribute('href');
      expect(href).toMatch(new RegExp(`/t/${fx.tenantSlug}/dashboard/quote-templates`));
    }

    // 9. Clic Ajouter au panier → ferme le QuoteModal, puis clic icône Panier
    //    dans le Header. CartButton ne doit pas crasher (uniqueClientCount
    //    supprimé Sprint 10 Phase B mais référencé encore dans le JSX).
    await cartBtn.click();
    await page.waitForTimeout(500);

    const headerCart = page
      .getByRole('button', { name: /panier/i })
      .first();
    await expect(headerCart).toBeVisible({ timeout: 5_000 });
    await headerCart.click();
    await page.waitForTimeout(800);

    // Le bouton "Imprimer le devis" du drawer panier doit apparaître sans
    // ReferenceError uniqueClientCount.
    const drawerPrintBtn = page
      .getByRole('button', { name: /imprimer le devis/i })
      .first();
    await expect(drawerPrintBtn).toBeVisible({ timeout: 5_000 });

    const allErrs2 = [...consoleErrors, ...pageErrors];
    const refErrors = allErrs2.filter((m) =>
      /Can't find variable: (tp|uniqueClientCount)\b|uniqueClientCount is not defined|ReferenceError.*\b(tp|uniqueClientCount)\b/.test(m),
    );
    if (refErrors.length > 0) {
      test.info().annotations.push({
        type: 'reference-error',
        description: refErrors.join(' | '),
      });
    }
    expect(refErrors).toEqual([]);
  });
});
