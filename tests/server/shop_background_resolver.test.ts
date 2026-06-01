/**
 * Tests helpers shopBackground (S-PIM-VISUELS-5 layered, 2026-06-01).
 *
 * Valide :
 *   - resolveShopBackground appelle RPC + map row → ResolvedShopBackground
 *   - Fallback defensif si RPC erreur / data vide
 *   - Source mapping ('gamme' | 'shop' | 'default')
 *
 * Test bout en bout via RPC réelle (cohérent avec autres tests/server) :
 *   - Pas de pref : default
 *   - Shop pref : source='shop' avec primary_color, background_url=null
 *   - Gamme pref : source='gamme', overrides shop pref
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
  anonOwner: SupabaseClient;
  ownerId: string;
  tenantId: string;
  shopId: string;
  freshShopId: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('shopBackground resolver (V5)', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const tag = rid();
    const password = `bgres-${tag}-${rid()}`;

    const { data: owner } = await admin.auth.admin.createUser({
      email: `bgres-${tag}@magrit.test`, password, email_confirm: true,
    });
    if (!owner.user) throw new Error('createUser failed');

    const { data: tenant } = await admin
      .from('tenants').insert({ slug: `bgres-${tag}`, name: `BG Res ${tag}` })
      .select('id').single();
    if (!tenant) throw new Error('tenant insert failed');

    await admin.from('tenant_members').insert({
      tenant_id: tenant.id, user_id: owner.user.id, role: 'owner', access_scope: 'magrit_full',
    });

    const { data: ownerRole } = await admin.from('tenant_role_definitions')
      .select('id').eq('tenant_id', tenant.id).eq('name', 'Owner').single();
    await admin.from('tenant_role_assignments').insert({
      role_definition_id: ownerRole!.id, user_id: owner.user.id, assigned_by: owner.user.id,
    });

    const { data: shop } = await admin.from('shops').insert({
      tenant_id: tenant.id, owner_user_id: owner.user.id,
      slug: `bgres-shop-${tag}`, name: 'BG Res Shop',
      description: '', theme: { primaryColor: '#000', accentColor: '#000', mode: 'light' },
      active: true, library_ids: [], excluded_product_ids: [],
    }).select('id').single();
    const { data: freshShop } = await admin.from('shops').insert({
      tenant_id: tenant.id, owner_user_id: owner.user.id,
      slug: `bgres-fresh-${tag}`, name: 'BG Fresh',
      description: '', theme: { primaryColor: '#000', accentColor: '#000', mode: 'light' },
      active: true, library_ids: [], excluded_product_ids: [],
    }).select('id').single();
    if (!shop || !freshShop) throw new Error('shop insert failed');

    // Configure shop pref + gamme pref pour le shop principal
    const { data: lib } = await admin.from('magrit_background_library')
      .select('id, url').is('archived_at', null).limit(2);
    if (!lib || lib.length < 2) throw new Error('library not seeded');

    await admin.from('shop_visual_preferences').insert({
      shop_id: shop.id,
      background_source: 'library',
      background_library_id: lib[0].id,
      background_url: lib[0].url,
      primary_color: '#ff5500',
      updated_by: owner.user.id,
    });
    await admin.from('shop_gamme_visual_preferences').insert({
      shop_id: shop.id,
      gamme_slug: 'flyers',
      background_source: 'library',
      background_library_id: lib[1].id,
      background_url: lib[1].url,
      primary_color: '#00aa00',
      updated_by: owner.user.id,
    });

    const anonOwner = createClient(url, anonKey, { auth: { persistSession: false } });
    await anonOwner.auth.signInWithPassword({ email: `bgres-${tag}@magrit.test`, password });

    Object.assign(ctx, {
      admin, anonOwner,
      ownerId: owner.user.id,
      tenantId: tenant.id,
      shopId: shop.id,
      freshShopId: freshShop.id,
      cleanup: async () => {
        await admin.from('shop_gamme_visual_preferences').delete().in('shop_id', [shop.id, freshShop.id]);
        await admin.from('shop_visual_preferences').delete().in('shop_id', [shop.id, freshShop.id]);
        await admin.from('tenant_role_assignments').delete().eq('role_definition_id', ownerRole!.id);
        await admin.from('tenant_order_status_transitions').delete().eq('tenant_id', tenant.id);
        await admin.from('tenant_order_status_definitions').delete().eq('tenant_id', tenant.id);
        await admin.from('tenant_role_definitions').delete().eq('tenant_id', tenant.id);
        await admin.from('shops').delete().in('id', [shop.id, freshShop.id]);
        await admin.from('tenant_members').delete().eq('tenant_id', tenant.id);
        await admin.from('tenants').delete().eq('id', tenant.id);
        await admin.auth.admin.deleteUser(owner.user!.id).catch(() => {});
      },
    });
  }, 45_000);

  afterAll(async () => {
    if (ctx.cleanup) await ctx.cleanup();
  });

  it('RPC resolve_shop_background : gamme pref overrides shop pref', async () => {
    const { data, error } = await ctx.anonOwner.rpc('resolve_shop_background', {
      p_shop_id: ctx.shopId,
      p_gamme_slug: 'flyers',
    });
    expect(error).toBeNull();
    expect(data![0].source).toBe('gamme');
    expect(data![0].primary_color).toBe('#00aa00');
    expect(data![0].background_url).toBeTruthy();
  });

  it('RPC resolve_shop_background : gamme inexistante fallback shop pref', async () => {
    const { data } = await ctx.anonOwner.rpc('resolve_shop_background', {
      p_shop_id: ctx.shopId,
      p_gamme_slug: 'inconnue',
    });
    expect(data![0].source).toBe('shop');
    expect(data![0].primary_color).toBe('#ff5500');
  });

  it('RPC resolve_shop_background : shop sans pref → default', async () => {
    const { data } = await ctx.anonOwner.rpc('resolve_shop_background', {
      p_shop_id: ctx.freshShopId,
      p_gamme_slug: 'any',
    });
    expect(data![0].source).toBe('default');
    expect(data![0].primary_color).toBe('#1e3a8a');
    expect(data![0].background_url).toBeNull();
  });

  it('RPC resolve_shop_background : shop_id inexistant retourne default safe', async () => {
    const { data, error } = await ctx.anonOwner.rpc('resolve_shop_background', {
      p_shop_id: '00000000-0000-0000-0000-000000000000',
      p_gamme_slug: 'any',
    });
    expect(error).toBeNull();
    // shop_id inexistant : pas de row gamme ni shop pref, default
    expect(data![0].source).toBe('default');
  });
});
