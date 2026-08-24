/**
 * Smoke storefront : compte boutique autonome + IA + commande.
 *
 * Le client boutique n'est ni un auth.users ni un tenant_member. Il reçoit
 * une session opaque et passe sa commande par l'API storefront canonique.
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Ctx {
  admin: SupabaseClient;
  anon: SupabaseClient;
  tenantId: string;
  shopId: string;
  shopSlug: string;
  productLibraryId: string;
  customerEmail: string;
  accountId: string;
  opaqueToken: string;
  orderId: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('Smoke E2E storefront identity', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anon = createClient(url, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const tag = rid();
    const customerEmail = `smoke-customer-${tag}@magrit.test`;
    const { data: owner, error: ownerError } = await admin.auth.admin.createUser({
      email: `smoke-owner-${tag}@magrit.test`,
      password: `smoke-${tag}-${rid()}`,
      email_confirm: true,
    });
    if (ownerError || !owner.user) throw new Error(`createUser owner: ${ownerError?.message}`);

    const { data: tenant, error: tenantError } = await admin.from('tenants')
      .insert({ slug: `smoke-tenant-${tag}`, name: `Smoke Storefront ${tag}` })
      .select('id').single();
    if (tenantError || !tenant) throw new Error(`tenant insert: ${tenantError?.message}`);
    await admin.from('tenant_members').insert({
      tenant_id: tenant.id, user_id: owner.user.id, role: 'admin', access_scope: 'magrit_full',
    });

    const shopSlug = `smoke-shop-${tag}`;
    const { data: shop, error: shopError } = await admin.from('shops').insert({
      tenant_id: tenant.id,
      owner_user_id: owner.user.id,
      slug: shopSlug,
      name: `Smoke Shop ${tag}`,
      active: true,
      access_mode: 'self_signup',
      library_ids: [],
      excluded_product_ids: [],
    }).select('id, slug').single();
    if (shopError || !shop) throw new Error(`shop insert: ${shopError?.message}`);

    const { data: product, error: productError } = await admin.from('product_library').insert({
      user_id: owner.user.id,
      name: `Smoke Flyer ${tag}`,
      category: 'Flyer',
      config: { format: 'A5', paper: 'std' },
      price_ht: 99.5,
    }).select('id').single();
    if (productError || !product) throw new Error(`product insert: ${productError?.message}`);

    Object.assign(ctx, {
      admin, anon, tenantId: tenant.id, shopId: shop.id, shopSlug: shop.slug,
      productLibraryId: product.id, customerEmail, accountId: '', opaqueToken: '', orderId: '',
      cleanup: async () => {
        await admin.from('tenant_order_items').delete().in('order_id', [ctx.orderId].filter(Boolean));
        await admin.from('tenant_orders').delete().eq('tenant_id', tenant.id);
        await admin.from('pim_candidates').delete().eq('source_tenant_id', tenant.id);
        await admin.from('shop_customer_accounts').delete().eq('shop_id', shop.id);
        await admin.from('shops').delete().eq('id', shop.id);
        await admin.from('product_library').delete().eq('id', product.id);
        await admin.from('tenant_members').delete().eq('tenant_id', tenant.id);
        await admin.from('tenant_role_definitions').delete().eq('tenant_id', tenant.id);
        await admin.from('tenants').delete().eq('id', tenant.id);
        await admin.auth.admin.deleteUser(owner.user!.id).catch(() => {});
      },
    });
  }, 45_000);

  afterAll(async () => ctx.cleanup?.());

  it('inscription boutique — crée une identité storefront sans identité Magrit', async () => {
    const { data, error } = await ctx.anon.rpc('api_register_shop_customer', {
      p_shop_slug: ctx.shopSlug,
      p_email: ctx.customerEmail,
      p_full_name: 'Client Smoke',
      p_password: 'mot-de-passe-solide',
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    ctx.accountId = data![0].account_id;
    ctx.opaqueToken = data![0].opaque_token;
    const { data: mixedMemberships } = await ctx.admin.from('tenant_members')
      .select('user_id').eq('tenant_id', ctx.tenantId).eq('access_scope', 'shop_only');
    expect(mixedMemberships ?? []).toHaveLength(0);
  });

  it('catalogue — la boutique active reste lisible publiquement', async () => {
    const { data, error } = await ctx.anon.from('shops')
      .select('id, slug, active, tenant_id').eq('slug', ctx.shopSlug).single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ id: ctx.shopId, slug: ctx.shopSlug, active: true, tenant_id: ctx.tenantId });
  });

  it('askMagrit — la fonction IA répond au preflight CORS', async () => {
    const url = `${process.env.SUPABASE_URL}/functions/v1/make-server-e3db71a4/claude-proxy-stream`;
    const resp = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5177',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });
    expect([200, 204]).toContain(resp.status);
    expect(resp.headers.get('access-control-allow-methods')?.toLowerCase()).toContain('post');
  });

  it('panier -> commande — crée la commande avec le compte boutique', async () => {
    const { data, error } = await ctx.anon.rpc('api_create_storefront_order', {
      p_opaque_token: ctx.opaqueToken,
      p_shop_id: ctx.shopId,
      p_currency: 'EUR',
      p_notes: '',
      p_items: [{
        product_id: ctx.productLibraryId,
        product_label: 'Smoke Flyer A5',
        clariprint_options: { format: 'A5', paper: 'std' },
        quantity: 2,
        unit_price_ht: 99.5,
      }],
      p_idempotency_key: `smoke-${rid()}`,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ shop_id: ctx.shopId, total_ht: 199, currency: 'EUR', replayed: false });
    expect(data.order_id).toMatch(UUID_RE);
    ctx.orderId = data.order_id;

    const { data: order, error: readError } = await ctx.admin.from('tenant_orders')
      .select('id, created_by, shop_customer_account_id, acted_by_magrit_user_id, tenant_order_items(quantity, line_total_ht)')
      .eq('id', ctx.orderId).single();
    expect(readError).toBeNull();
    expect(order).toMatchObject({
      created_by: null,
      shop_customer_account_id: ctx.accountId,
      acted_by_magrit_user_id: null,
    });
    expect(order!.tenant_order_items).toHaveLength(1);
  });
});
