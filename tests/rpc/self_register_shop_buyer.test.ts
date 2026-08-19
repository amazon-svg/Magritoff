/**
 * UM9.1 — inscription autonome d'un compte boutique.
 *
 * Vérifie que l'ancien RPC créant un tenant_member shop_only reste révoqué et
 * que le nouveau parcours crée uniquement une identité storefront liée à la
 * boutique, avec son credential et sa session opaque.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import '../_loadEnv';

const SKIP_REASON = (() => {
  const env = process.env;
  if (!env.SUPABASE_URL) return 'SUPABASE_URL absent';
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return 'SUPABASE_SERVICE_ROLE_KEY absent';
  if (!env.SUPABASE_ANON_KEY) return 'SUPABASE_ANON_KEY absent';
  return null;
})();

const rid = () => Math.random().toString(36).slice(2, 10);

interface Ctx {
  admin: SupabaseClient;
  anon: SupabaseClient;
  tenantId: string;
  openShopId: string;
  openShopSlug: string;
  closedShopId: string;
  closedShopSlug: string;
  customerEmail: string;
  accountId: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('RPC UM9.1 storefront self registration', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anon = createClient(url, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const tag = rid();
    const customerEmail = `selfreg-customer-${tag}@magrit.test`;
    const { data: owner, error: ownerError } = await admin.auth.admin.createUser({
      email: `selfreg-owner-${tag}@magrit.test`,
      password: `selfreg-${tag}-${rid()}`,
      email_confirm: true,
    });
    if (ownerError || !owner.user) throw new Error(`createUser failed: ${ownerError?.message}`);

    const { data: tenant, error: tenantError } = await admin.from('tenants')
      .insert({ slug: `selfreg-${tag}`, name: `SelfReg ${tag}` }).select('id').single();
    if (tenantError || !tenant) throw new Error(`tenant insert failed: ${tenantError?.message}`);

    const shopBase = {
      tenant_id: tenant.id,
      owner_user_id: owner.user.id,
      active: true,
      library_ids: [],
      excluded_product_ids: [],
    };
    const openShopSlug = `selfreg-open-${tag}`;
    const closedShopSlug = `selfreg-closed-${tag}`;
    const { data: openShop, error: openError } = await admin.from('shops')
      .insert({ ...shopBase, slug: openShopSlug, name: 'Open', access_mode: 'self_signup' })
      .select('id').single();
    const { data: closedShop, error: closedError } = await admin.from('shops')
      .insert({ ...shopBase, slug: closedShopSlug, name: 'Closed', access_mode: 'invite_only' })
      .select('id').single();
    if (!openShop || !closedShop) {
      throw new Error(`shop insert failed: ${openError?.message ?? ''} ${closedError?.message ?? ''}`);
    }

    Object.assign(ctx, {
      admin, anon, tenantId: tenant.id, openShopId: openShop.id, openShopSlug,
      closedShopId: closedShop.id, closedShopSlug, customerEmail, accountId: '',
      cleanup: async () => {
        await admin.from('shop_customer_accounts').delete().in('shop_id', [openShop.id, closedShop.id]);
        await admin.from('shops').delete().in('id', [openShop.id, closedShop.id]);
        await admin.from('tenant_role_definitions').delete().eq('tenant_id', tenant.id);
        await admin.from('tenants').delete().eq('id', tenant.id);
        await admin.auth.admin.deleteUser(owner.user!.id).catch(() => {});
      },
    });
  }, 30_000);

  afterAll(async () => ctx.cleanup?.());

  it("l'ancien RPC tenant_member reste inaccessible", async () => {
    const { error } = await ctx.anon.rpc('self_register_shop_buyer', { p_shop_id: ctx.openShopId });
    expect(error).not.toBeNull();
  });

  it("une boutique invite_only refuse silencieusement l'auto-inscription", async () => {
    const { data, error } = await ctx.anon.rpc('api_register_shop_customer', {
      p_shop_slug: ctx.closedShopSlug,
      p_email: ctx.customerEmail,
      p_full_name: 'Client privé',
      p_password: 'mot-de-passe-solide',
    });
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('une boutique self_signup crée un compte boutique et une session, sans profil Magrit', async () => {
    const { data, error } = await ctx.anon.rpc('api_register_shop_customer', {
      p_shop_slug: ctx.openShopSlug,
      p_email: ` ${ctx.customerEmail.toUpperCase()} `,
      p_full_name: ' Client Exemple ',
      p_password: 'mot-de-passe-solide',
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({
      shop_id: ctx.openShopId, email: ctx.customerEmail,
      full_name: 'Client Exemple', account_status: 'active',
    });
    expect(data![0].opaque_token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    ctx.accountId = data![0].account_id;

    const { data: account } = await ctx.admin.from('shop_customer_accounts')
      .select('id, auth_subject_id, created_by_magrit_user_id').eq('id', ctx.accountId).single();
    expect(account).toMatchObject({ auth_subject_id: null, created_by_magrit_user_id: null });
    const { data: members } = await ctx.admin.from('tenant_members')
      .select('user_id').eq('tenant_id', ctx.tenantId).eq('access_scope', 'shop_only');
    expect(members ?? []).toHaveLength(0);
  });

  it('un second appel ne révèle ni ne duplique le compte existant', async () => {
    const { data, error } = await ctx.anon.rpc('api_register_shop_customer', {
      p_shop_slug: ctx.openShopSlug,
      p_email: ctx.customerEmail,
      p_full_name: 'Duplicata',
      p_password: 'autre-mot-de-passe',
    });
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
    const { count } = await ctx.admin.from('shop_customer_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', ctx.openShopId).eq('normalized_email', ctx.customerEmail);
    expect(count).toBe(1);
  });
});
