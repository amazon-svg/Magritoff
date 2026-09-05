import { test, expect } from '@playwright/test';
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
  const email = `e2e-no-cart-${tag}@magrit.test`;
  const password = `Pwd-${tag}-${RID()}!`;

  const { data: u, error: ue } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (ue || !u.user) throw new Error(`createUser: ${ue?.message}`);

  const slug = `e2e-nc-${tag}`;
  const { data: t, error: te } = await admin
    .from('tenants')
    .insert({ slug, name: `E2E No Cart ${tag}` })
    .select('id, slug')
    .single();
  if (te || !t) throw new Error(`tenant insert: ${te?.message}`);

  const { error: tmErr } = await admin.from('tenant_members').insert({
    tenant_id: t.id,
    user_id: u.user.id,
    role: 'admin',
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
      await admin.from('tenant_members').delete().eq('tenant_id', t.id);
      await admin.from('tenants').delete().eq('id', t.id);
      await admin.auth.admin.deleteUser(u.user.id);
    },
  };
}

let fx: MinimalFixture;

test.describe.serial('E10.1 qa-review B1 — le panier a disparu des surfaces internes Magrit', () => {
  test.beforeAll(async () => {
    fx = await bootstrapMinimal();
  });

  test.afterAll(async () => {
    if (fx) await fx.cleanup();
  });

  test('aucun bouton/icone "Panier" n est present sur /t/:slug (atelier)', async ({ page }) => {
    const session = await getSessionForCredentials(fx.adminEmail, fx.adminPassword);
    await page.goto('about:blank');
    await injectSupabaseSession(page, session);

    await page.goto(`/t/${fx.tenantSlug}`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

    // Le chat de l atelier doit etre monte (rail + topbar visibles) avant
    // de conclure a une absence — sinon un panier absent parce que la page
    // n a pas charge ne prouverait rien.
    await expect(page.getByTestId('marguerite-chat')).toBeVisible({ timeout: 15_000 });

    // CA1 (E10.1) : ABSENCE, pas seulement inertie fonctionnelle. Cherche
    // tout bouton/lien dont le nom accessible contient "panier", et toute
    // icone panier via son aria-label/title — les deux variantes (rail et
    // pill) du CartButton retire portaient ce mot.
    await expect(page.getByRole('button', { name: /panier/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /panier/i })).toHaveCount(0);
    await expect(page.locator('[aria-label*="anier" i]')).toHaveCount(0);
    await expect(page.locator('[title*="anier" i]')).toHaveCount(0);
  });

  test('aucun bouton/icone "Panier" n est present sur le dashboard (Header partage)', async ({
    page,
  }) => {
    const session = await getSessionForCredentials(fx.adminEmail, fx.adminPassword);
    await page.goto('about:blank');
    await injectSupabaseSession(page, session);

    await page.goto(`/t/${fx.tenantSlug}/dashboard/quotes`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

    await expect(page.getByRole('button', { name: /panier/i })).toHaveCount(0);
    await expect(page.locator('[aria-label*="anier" i]')).toHaveCount(0);
    await expect(page.locator('[title*="anier" i]')).toHaveCount(0);
  });
});
