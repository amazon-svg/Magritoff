/**
 * Smoke E2E acheteur AI — DoD #3 obligatoire Sprint 5 closure (2026-06-01).
 *
 * Parcours teste cote DB+SDK (pas Playwright, harness vitest existant) :
 *   1. "login boutique" : l'acheteur shop_only authentifie peut SELECT
 *      la shop active dont il est membre (RLS shops_select_tenant +
 *      shops_public_read).
 *   2. "askMagrit" : health check edge function claude-proxy-stream
 *      (preflight CORS OPTIONS). Confirme que la function est ACTIVE
 *      sans consommer de LLM (le vrai prompt est valide en smoke prod).
 *   3. "panier -> commande" : insert tenant_orders + tenant_order_items
 *      avec created_by = acheteur.id, status=draft. Le trigger PIM
 *      enqueue automatiquement les candidats (P0.10). RLS impose
 *      created_by = auth.uid() (AC9 S-MIGRATION-ORDERS, decision B2).
 *
 * Couvre le persona acheteur B2B shop_only avec allowed_shop_ids[shop.id]
 * + role Acheteur preset Phase A (permission can_order=true via capabilities).
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
  anonAcheteur: SupabaseClient;
  ownerId: string;
  acheteurId: string;
  tenantId: string;
  shopId: string;
  shopSlug: string;
  productLibraryId: string;
  shopProductId: string;
  acheteurRoleId: string;
  orderId: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('Smoke E2E acheteur AI (DoD #3)', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tag = rid();
    const password = `smoke-${tag}-${rid()}`;
    const ownerEmail = `smoke-owner-${tag}@magrit.test`;
    const acheteurEmail = `smoke-buyer-${tag}@magrit.test`;

    const { data: owner, error: oErr } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
    });
    if (oErr || !owner.user) throw new Error(`createUser owner: ${oErr?.message}`);

    const { data: acheteur, error: aErr } = await admin.auth.admin.createUser({
      email: acheteurEmail,
      password,
      email_confirm: true,
    });
    if (aErr || !acheteur.user) throw new Error(`createUser acheteur: ${aErr?.message}`);

    // Tenant + owner membership
    const slug = `smoke-tenant-${tag}`;
    const { data: tenant, error: tErr } = await admin
      .from('tenants')
      .insert({ slug, name: `Smoke Acheteur ${tag}` })
      .select('id')
      .single();
    if (tErr || !tenant) throw new Error(`tenant insert: ${tErr?.message}`);

    await admin.from('tenant_members').insert({
      tenant_id: tenant.id,
      user_id: owner.user.id,
      role: 'owner',
      access_scope: 'magrit_full',
      permissions: { can_quote: true, can_order: true, can_invite: true },
    });

    // Shop active, owned by owner
    const shopSlug = `smoke-shop-${tag}`;
    const { data: shop, error: sErr } = await admin
      .from('shops')
      .insert({
        tenant_id: tenant.id,
        owner_user_id: owner.user.id,
        slug: shopSlug,
        name: `Smoke Shop ${tag}`,
        description: 'Boutique de test smoke acheteur',
        theme: { primaryColor: '#1e3a8a', accentColor: '#f59e0b', mode: 'light' },
        active: true,
        library_ids: [],
        excluded_product_ids: [],
      })
      .select('id, slug')
      .single();
    if (sErr || !shop) throw new Error(`shop insert: ${sErr?.message}`);

    // Product library + shop_product (UUID)
    const { data: libProduct, error: lpErr } = await admin
      .from('product_library')
      .insert({
        user_id: owner.user.id,
        name: `Smoke Flyer ${tag}`,
        category: 'Flyer',
        config: { format: 'A5', paper: 'std' },
        price_ht: 99.5,
      })
      .select('id')
      .single();
    if (lpErr || !libProduct) throw new Error(`product_library insert: ${lpErr?.message}`);

    const { data: shopProduct, error: spErr } = await admin
      .from('shop_products')
      .insert({
        shop_id: shop.id,
        tenant_id: tenant.id,
        product_id: libProduct.id,
        name: `Smoke Flyer ${tag}`,
        category: 'Flyer',
        description: 'Flyer A5 std',
        price_ht: 99.5,
        image_url: '',
        config: { format: 'A5', paper: 'std' },
        display_order: 0,
      })
      .select('id')
      .single();
    if (spErr || !shopProduct) throw new Error(`shop_products insert: ${spErr?.message}`);

    // Role Acheteur preset (seede manuellement, comme dans invitation_flow)
    const { data: roleAcheteur, error: rErr } = await admin
      .from('tenant_role_definitions')
      .insert({
        tenant_id: tenant.id,
        name: 'Acheteur',
        description: 'Passe devis et commandes sur boutiques autorisees',
        capabilities: {
          can_quote: true,
          can_order: true,
          can_invite: false,
          can_validate: false,
          can_cancel: false,
          can_modify: false,
          can_export: false,
          can_manage_catalog: false,
          can_manage_roles: false,
        },
        ordering_index: 30,
      })
      .select('id')
      .single();
    if (rErr || !roleAcheteur) throw new Error(`role acheteur insert: ${rErr?.message}`);

    // Membership acheteur shop_only + role assignment
    await admin.from('tenant_members').insert({
      tenant_id: tenant.id,
      user_id: acheteur.user.id,
      role: 'member',
      access_scope: 'shop_only',
      allowed_shop_ids: [shop.id],
      permissions: { can_quote: true, can_order: true, can_invite: false },
    });
    await admin.from('tenant_role_assignments').insert({
      role_definition_id: roleAcheteur.id,
      user_id: acheteur.user.id,
      assigned_by: owner.user.id,
    });

    const anonAcheteur = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signErr } = await anonAcheteur.auth.signInWithPassword({
      email: acheteurEmail,
      password,
    });
    if (signErr) throw new Error(`signIn acheteur: ${signErr.message}`);

    Object.assign(ctx, {
      admin,
      anonAcheteur,
      ownerId: owner.user.id,
      acheteurId: acheteur.user.id,
      tenantId: tenant.id,
      shopId: shop.id,
      shopSlug: shop.slug,
      productLibraryId: libProduct.id,
      shopProductId: shopProduct.id,
      acheteurRoleId: roleAcheteur.id,
      orderId: '',
      cleanup: async () => {
        // Ordre defensif : items -> orders -> assignments -> definitions
        //                  -> shop_products -> shops -> product_library
        //                  -> members -> invitations -> tenants -> users
        await admin
          .from('tenant_order_items')
          .delete()
          .in('order_id', [ctx.orderId].filter(Boolean));
        await admin.from('tenant_orders').delete().eq('tenant_id', tenant.id);
        await admin.from('pim_candidates').delete().eq('source_tenant_id', tenant.id);
        await admin
          .from('tenant_role_assignments')
          .delete()
          .eq('role_definition_id', roleAcheteur.id);
        await admin
          .from('tenant_role_definitions')
          .delete()
          .eq('tenant_id', tenant.id);
        await admin.from('shop_products').delete().eq('shop_id', shop.id);
        await admin.from('shops').delete().eq('id', shop.id);
        await admin.from('product_library').delete().eq('id', libProduct.id);
        await admin.from('tenant_members').delete().eq('tenant_id', tenant.id);
        await admin.from('tenant_invitations').delete().eq('tenant_id', tenant.id);
        await admin.from('tenants').delete().eq('id', tenant.id);
        await admin.auth.admin.deleteUser(owner.user!.id).catch(() => {});
        await admin.auth.admin.deleteUser(acheteur.user!.id).catch(() => {});
      },
    });
  }, 45_000);

  afterAll(async () => {
    if (ctx.cleanup) await ctx.cleanup();
  });

  it('login boutique — l acheteur shop_only SELECT la shop active', async () => {
    const { data, error } = await ctx.anonAcheteur
      .from('shops')
      .select('id, slug, active, tenant_id')
      .eq('slug', ctx.shopSlug)
      .single();
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.id).toBe(ctx.shopId);
    expect(data!.active).toBe(true);
    expect(data!.tenant_id).toBe(ctx.tenantId);
  });

  it('askMagrit — edge function claude-proxy-stream est ACTIVE (CORS preflight)', async () => {
    // ChatInterface pointe sur make-server-e3db71a4/claude-proxy-stream
    // (sous-endpoint Hono cf. ChatInterface.tsx:183). Middleware CORS
    // configure avec allowMethods POST + OPTIONS.
    const url = `${process.env.SUPABASE_URL}/functions/v1/make-server-e3db71a4/claude-proxy-stream`;
    const resp = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5177',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });
    // Edge function ACTIVE retourne 200 (ou 204) avec headers CORS.
    // BOOT_ERROR retournerait 503. Tout autre code = function down.
    expect([200, 204]).toContain(resp.status);
    const allowMethods = resp.headers.get('access-control-allow-methods') || '';
    expect(allowMethods.toLowerCase()).toContain('post');
  });

  it('panier -> commande — l acheteur cree tenant_orders + items en status draft', async () => {
    const quantity = 250;
    const unit_price_ht = 99.5;
    const line_total_ht = quantity * unit_price_ht;

    const { data: orderRow, error: orderErr } = await ctx.anonAcheteur
      .from('tenant_orders')
      .insert({
        tenant_id: ctx.tenantId,
        shop_id: ctx.shopId,
        created_by: ctx.acheteurId,
        status: 'draft',
        total_ht: line_total_ht,
        currency: 'EUR',
        notes: '',
      })
      .select('id, status, created_by, shop_id')
      .single();

    expect(orderErr).toBeNull();
    expect(orderRow).toBeTruthy();
    expect(orderRow!.status).toBe('draft');
    expect(orderRow!.created_by).toBe(ctx.acheteurId);
    expect(orderRow!.shop_id).toBe(ctx.shopId);
    expect(UUID_RE.test(orderRow!.id)).toBe(true);

    ctx.orderId = orderRow!.id;

    const { error: itemsErr } = await ctx.anonAcheteur.from('tenant_order_items').insert([
      {
        order_id: orderRow!.id,
        product_id: ctx.productLibraryId,
        product_label: 'Smoke Flyer A5',
        clariprint_options: { format: 'A5', paper: 'std' },
        quantity,
        unit_price_ht,
        line_total_ht,
      },
    ]);
    expect(itemsErr).toBeNull();

    // L'acheteur peut relire sa propre commande
    const { data: readBack } = await ctx.anonAcheteur
      .from('tenant_orders')
      .select('id, status, total_ht, tenant_order_items(id, quantity, line_total_ht)')
      .eq('id', orderRow!.id)
      .single();
    expect(readBack).toBeTruthy();
    expect(readBack!.total_ht).toBe(line_total_ht);
    expect((readBack as any).tenant_order_items).toHaveLength(1);
    expect((readBack as any).tenant_order_items[0].quantity).toBe(quantity);
  });
});
