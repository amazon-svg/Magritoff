/**
 * Tests S-PIM-VISUELS-1 + -3 (Sprint 7, 2026-06-01).
 *
 * Valide :
 *  - Catalog magrit_background_library lisible par tous (anon + auth)
 *  - shop_visual_preferences SELECT public read (mockup rendering anonyme)
 *  - shop_visual_preferences WRITE restreint can_manage_catalog
 *  - shop_gamme_visual_preferences idem
 *  - Helper resolve_shop_background cascade gamme > shop > default
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
  anonStranger: SupabaseClient;
  ownerRoleAssignmentId: string;
  ownerId: string;
  strangerId: string;
  tenantId: string;
  shopId: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('S-PIM-VISUELS foundation (V1 + V3)', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const tag = rid();
    const password = `vis-${tag}-${rid()}`;

    const { data: owner } = await admin.auth.admin.createUser({
      email: `vis-o-${tag}@magrit.test`, password, email_confirm: true,
    });
    const { data: stranger } = await admin.auth.admin.createUser({
      email: `vis-s-${tag}@magrit.test`, password, email_confirm: true,
    });
    if (!owner.user || !stranger.user) throw new Error('createUser failed');

    const { data: tenant } = await admin
      .from('tenants').insert({ slug: `vis-${tag}`, name: `Vis ${tag}` })
      .select('id').single();
    const { data: otherTenant } = await admin
      .from('tenants').insert({ slug: `vis-other-${tag}`, name: `Vis Other ${tag}` })
      .select('id').single();
    if (!tenant || !otherTenant) throw new Error('tenant insert failed');

    await admin.from('tenant_members').insert([
      { tenant_id: tenant.id, user_id: owner.user.id, role: 'owner', access_scope: 'magrit_full' },
      { tenant_id: otherTenant.id, user_id: stranger.user.id, role: 'owner', access_scope: 'magrit_full' },
    ]);

    // Récupère le rôle Owner auto-seedé pour donner can_manage_catalog
    const { data: ownerRoleDef } = await admin.from('tenant_role_definitions')
      .select('id').eq('tenant_id', tenant.id).eq('name', 'Owner').single();
    if (!ownerRoleDef) throw new Error('Owner role introuvable');

    // Assignment global owner -> Owner role (active)
    const { data: assign } = await admin.from('tenant_role_assignments').insert({
      role_definition_id: ownerRoleDef.id,
      user_id: owner.user.id,
      assigned_by: owner.user.id,
    }).select('id').single();
    if (!assign) throw new Error('assignment insert failed');

    const { data: shop } = await admin.from('shops').insert({
      tenant_id: tenant.id, owner_user_id: owner.user.id,
      slug: `vis-shop-${tag}`, name: 'Vis Shop',
      description: '', theme: { primaryColor: '#000', accentColor: '#000', mode: 'light' },
      active: true, library_ids: [], excluded_product_ids: [],
    }).select('id').single();
    if (!shop) throw new Error('shop insert failed');

    const anonOwner = createClient(url, anonKey, { auth: { persistSession: false } });
    await anonOwner.auth.signInWithPassword({ email: `vis-o-${tag}@magrit.test`, password });
    const anonStranger = createClient(url, anonKey, { auth: { persistSession: false } });
    await anonStranger.auth.signInWithPassword({ email: `vis-s-${tag}@magrit.test`, password });

    Object.assign(ctx, {
      admin, anonOwner, anonStranger,
      ownerRoleAssignmentId: assign.id,
      ownerId: owner.user.id, strangerId: stranger.user.id,
      tenantId: tenant.id, shopId: shop.id,
      cleanup: async () => {
        await admin.from('shop_gamme_visual_preferences').delete().eq('shop_id', shop.id);
        await admin.from('shop_visual_preferences').delete().eq('shop_id', shop.id);
        await admin.from('tenant_role_assignments').delete().eq('role_definition_id', ownerRoleDef.id);
        await admin.from('tenant_order_status_transitions').delete().in('tenant_id', [tenant.id, otherTenant.id]);
        await admin.from('tenant_order_status_definitions').delete().in('tenant_id', [tenant.id, otherTenant.id]);
        await admin.from('tenant_role_definitions').delete().in('tenant_id', [tenant.id, otherTenant.id]);
        await admin.from('shops').delete().eq('id', shop.id);
        await admin.from('tenant_members').delete().in('tenant_id', [tenant.id, otherTenant.id]);
        await admin.from('tenants').delete().in('id', [tenant.id, otherTenant.id]);
        await admin.auth.admin.deleteUser(owner.user!.id).catch(() => {});
        await admin.auth.admin.deleteUser(stranger.user!.id).catch(() => {});
      },
    });
  }, 45_000);

  afterAll(async () => {
    if (ctx.cleanup) await ctx.cleanup();
  });

  // ─── magrit_background_library ─────────────────────────────────────────

  it('library — public select retourne 10 fonds seedés', async () => {
    const { data, error } = await ctx.anonStranger
      .from('magrit_background_library')
      .select('id, name')
      .is('archived_at', null);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(10);
  });

  it('library — owner non super_admin ne peut PAS insert un nouveau fond', async () => {
    const { error } = await ctx.anonOwner.from('magrit_background_library').insert({
      name: 'Faux fond', url: 'https://faux.url',
    });
    expect(error).toBeTruthy();
  });

  // ─── shop_visual_preferences ───────────────────────────────────────────

  it('shop_pref — owner avec can_manage_catalog peut insert', async () => {
    const { error } = await ctx.anonOwner.from('shop_visual_preferences').insert({
      shop_id: ctx.shopId,
      background_source: 'default',
      primary_color: '#ff5500',
      updated_by: ctx.ownerId,
    });
    expect(error).toBeNull();
  });

  it('shop_pref — stranger ne peut PAS insert pour un shop d un autre tenant', async () => {
    const { error } = await ctx.anonStranger.from('shop_visual_preferences').insert({
      shop_id: ctx.shopId,
      background_source: 'default',
      primary_color: '#000000',
    });
    expect(error).toBeTruthy();
  });

  it('shop_pref — anon lit le shop_visual_preferences (public read pour rendu mockup)', async () => {
    const url = process.env.SUPABASE_URL!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;
    const anonNoAuth = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await anonNoAuth
      .from('shop_visual_preferences')
      .select('primary_color')
      .eq('shop_id', ctx.shopId);
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0].primary_color).toBe('#ff5500');
  });

  // ─── shop_gamme_visual_preferences + cascade resolver ─────────────────

  it('resolve — shop pref sans background_url → source=default mais primary_color override', async () => {
    // Sémantique : source reflète l'origine du background_url uniquement.
    // primary_color est cumulé depuis shop_pref même quand background_url=null
    // (default). Cohérent avec la cascade gamme > shop > default sur chaque
    // colonne indépendamment.
    const { data, error } = await ctx.anonOwner.rpc('resolve_shop_background', {
      p_shop_id: ctx.shopId,
      p_gamme_slug: 'gamme-inexistante',
    });
    expect(error).toBeNull();
    expect(data![0].source).toBe('default');
    expect(data![0].background_url).toBeNull();
    expect(data![0].primary_color).toBe('#ff5500'); // override shop pref
  });

  it('resolve — gamme pref overrides shop pref (cascade)', async () => {
    await ctx.anonOwner.from('shop_gamme_visual_preferences').insert({
      shop_id: ctx.shopId,
      gamme_slug: 'flyers',
      background_source: 'library',
      background_url: 'https://example.com/flyer-bg.jpg',
      primary_color: '#00aa00',
      updated_by: ctx.ownerId,
    });

    const { data, error } = await ctx.anonOwner.rpc('resolve_shop_background', {
      p_shop_id: ctx.shopId,
      p_gamme_slug: 'flyers',
    });
    expect(error).toBeNull();
    expect(data![0].source).toBe('gamme');
    expect(data![0].background_url).toBe('https://example.com/flyer-bg.jpg');
    expect(data![0].primary_color).toBe('#00aa00');
  });

  it('resolve — gamme inexistante fallback sur shop pref (primary_color)', async () => {
    const { data } = await ctx.anonOwner.rpc('resolve_shop_background', {
      p_shop_id: ctx.shopId,
      p_gamme_slug: 'cartes-visite',
    });
    // gamme 'cartes-visite' n'a pas de row → tombe sur shop pref
    // shop pref n'a pas background_url → source='default'
    // shop pref a primary_color='#ff5500' → override
    expect(data![0].source).toBe('default');
    expect(data![0].background_url).toBeNull();
    expect(data![0].primary_color).toBe('#ff5500');
  });

  it('resolve — shop sans aucune pref retourne source=default + primary #1e3a8a', async () => {
    // Crée un shop temporaire sans visual_pref ni gamme_pref
    const { data: shopFresh } = await ctx.admin.from('shops').insert({
      tenant_id: ctx.tenantId, owner_user_id: ctx.ownerId,
      slug: `vis-fresh-${rid()}`, name: 'Fresh',
      description: '', theme: { primaryColor: '#000', accentColor: '#000', mode: 'light' },
      active: true, library_ids: [], excluded_product_ids: [],
    }).select('id').single();

    const { data } = await ctx.anonOwner.rpc('resolve_shop_background', {
      p_shop_id: shopFresh!.id,
      p_gamme_slug: 'any',
    });
    expect(data![0].source).toBe('default');
    expect(data![0].primary_color).toBe('#1e3a8a');

    await ctx.admin.from('shops').delete().eq('id', shopFresh!.id);
  });
});
