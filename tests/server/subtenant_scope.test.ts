/**
 * Tests S-SUBTENANT-SCOPE (Sprint 8, 2026-06-01).
 *
 * Bootstrap : 1 tenant racine "Imprimerie Dupont" + 3 sous-tenants
 * (Paris/Lyon/Bordeaux) + 5 users (admin racine, member Paris, member Lyon,
 * member Bordeaux, partner racine non-hérité).
 *
 * Valide :
 *  - is_subtenant_member_direct : OK pour member direct
 *  - is_subtenant_member_inherited : OK pour admin/member racine, KO partner
 *  - get_user_subtenants : admin voit tous, members voient leur site +
 *    racine via inherited
 *  - move_user_between_subtenants : OK admin parent, BLOCKED autre user,
 *    BLOCKED parents différents
 *  - get_subtenant_kpis : aggregations correctes nb commandes + CA HT
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
  anonAdmin: SupabaseClient;
  anonMemberParis: SupabaseClient;
  anonMemberLyon: SupabaseClient;
  anonPartner: SupabaseClient;
  adminId: string;
  memberParisId: string;
  memberLyonId: string;
  memberBordeauxId: string;
  partnerId: string;
  rootTenantId: string;
  parisTenantId: string;
  lyonTenantId: string;
  bordeauxTenantId: string;
  otherTenantId: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('S-SUBTENANT-SCOPE (Usage A filiale)', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const tag = rid();
    const password = `sub-${tag}-${rid()}`;

    const mkUser = (label: string) => admin.auth.admin.createUser({
      email: `sub-${label}-${tag}@magrit.test`, password, email_confirm: true,
    });
    const [a, p, l, b, pa] = await Promise.all([
      mkUser('admin'), mkUser('paris'), mkUser('lyon'), mkUser('bordeaux'), mkUser('partner'),
    ]);

    // Tenant racine
    const { data: rootT } = await admin.from('tenants').insert({
      slug: `sub-root-${tag}`, name: `Dupont SA ${tag}`,
    }).select('id').single();
    // 3 sous-tenants (avec parent_tenant_id)
    const { data: paris } = await admin.from('tenants').insert({
      slug: `sub-paris-${tag}`, name: `Dupont Paris ${tag}`, parent_tenant_id: rootT!.id,
    }).select('id').single();
    const { data: lyon } = await admin.from('tenants').insert({
      slug: `sub-lyon-${tag}`, name: `Dupont Lyon ${tag}`, parent_tenant_id: rootT!.id,
    }).select('id').single();
    const { data: bordeaux } = await admin.from('tenants').insert({
      slug: `sub-bord-${tag}`, name: `Dupont Bordeaux ${tag}`, parent_tenant_id: rootT!.id,
    }).select('id').single();
    // Tenant tiers (cross-isolation)
    const { data: other } = await admin.from('tenants').insert({
      slug: `sub-other-${tag}`, name: `Other ${tag}`,
    }).select('id').single();

    await admin.from('tenant_members').insert([
      { tenant_id: rootT!.id, user_id: a.data.user!.id, role: 'owner', access_scope: 'magrit_full' },
      { tenant_id: rootT!.id, user_id: pa.data.user!.id, role: 'partner', access_scope: 'magrit_full' },
      { tenant_id: paris!.id, user_id: p.data.user!.id, role: 'member', access_scope: 'magrit_full' },
      { tenant_id: lyon!.id, user_id: l.data.user!.id, role: 'member', access_scope: 'magrit_full' },
      { tenant_id: bordeaux!.id, user_id: b.data.user!.id, role: 'member', access_scope: 'magrit_full' },
    ]);

    // Crée 1 commande dans Paris + 1 dans Lyon pour tester KPIs
    const { data: parisShop } = await admin.from('shops').insert({
      tenant_id: paris!.id, owner_user_id: a.data.user!.id,
      slug: `sub-parisshop-${tag}`, name: 'Shop Paris',
      description: '', theme: { primaryColor: '#000', accentColor: '#000', mode: 'light' },
      active: true, library_ids: [], excluded_product_ids: [],
    }).select('id').single();
    await admin.from('tenant_orders').insert([
      { tenant_id: paris!.id, shop_id: parisShop!.id, created_by: a.data.user!.id,
        status: 'draft', total_ht: 100, currency: 'EUR' },
      { tenant_id: paris!.id, shop_id: parisShop!.id, created_by: a.data.user!.id,
        status: 'validated', total_ht: 250, currency: 'EUR' },
    ]);

    const mkAnon = async (uid: string, label: string) => {
      const c = createClient(url, anonKey, { auth: { persistSession: false } });
      await c.auth.signInWithPassword({ email: `sub-${label}-${tag}@magrit.test`, password });
      return c;
    };
    const [anonAdmin, anonMemberParis, anonMemberLyon, anonPartner] = await Promise.all([
      mkAnon(a.data.user!.id, 'admin'),
      mkAnon(p.data.user!.id, 'paris'),
      mkAnon(l.data.user!.id, 'lyon'),
      mkAnon(pa.data.user!.id, 'partner'),
    ]);

    Object.assign(ctx, {
      admin, anonAdmin, anonMemberParis, anonMemberLyon, anonPartner,
      adminId: a.data.user!.id,
      memberParisId: p.data.user!.id,
      memberLyonId: l.data.user!.id,
      memberBordeauxId: b.data.user!.id,
      partnerId: pa.data.user!.id,
      rootTenantId: rootT!.id,
      parisTenantId: paris!.id,
      lyonTenantId: lyon!.id,
      bordeauxTenantId: bordeaux!.id,
      otherTenantId: other!.id,
      cleanup: async () => {
        await admin.from('tenant_orders').delete().in('tenant_id', [paris!.id, lyon!.id, bordeaux!.id]);
        await admin.from('shops').delete().eq('id', parisShop!.id);
        await admin.from('tenant_order_status_transitions').delete()
          .in('tenant_id', [rootT!.id, paris!.id, lyon!.id, bordeaux!.id, other!.id]);
        await admin.from('tenant_order_status_definitions').delete()
          .in('tenant_id', [rootT!.id, paris!.id, lyon!.id, bordeaux!.id, other!.id]);
        await admin.from('tenant_role_definitions').delete()
          .in('tenant_id', [rootT!.id, paris!.id, lyon!.id, bordeaux!.id, other!.id]);
        await admin.from('tenant_members').delete()
          .in('tenant_id', [rootT!.id, paris!.id, lyon!.id, bordeaux!.id, other!.id]);
        await admin.from('tenants').delete()
          .in('id', [paris!.id, lyon!.id, bordeaux!.id]); // sub-tenants d'abord
        await admin.from('tenants').delete().in('id', [rootT!.id, other!.id]);
        await Promise.all([
          admin.auth.admin.deleteUser(a.data.user!.id).catch(() => {}),
          admin.auth.admin.deleteUser(p.data.user!.id).catch(() => {}),
          admin.auth.admin.deleteUser(l.data.user!.id).catch(() => {}),
          admin.auth.admin.deleteUser(b.data.user!.id).catch(() => {}),
          admin.auth.admin.deleteUser(pa.data.user!.id).catch(() => {}),
        ]);
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (ctx.cleanup) await ctx.cleanup();
  });

  // ─── is_subtenant_member_direct ────────────────────────────────────────

  it('member_direct : memberParis voit Paris (direct)', async () => {
    const { data, error } = await ctx.anonMemberParis.rpc('is_subtenant_member_direct', {
      p_tenant_id: ctx.parisTenantId,
    });
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it('member_direct : memberParis ne voit PAS Lyon (cross-subtenant)', async () => {
    const { data } = await ctx.anonMemberParis.rpc('is_subtenant_member_direct', {
      p_tenant_id: ctx.lyonTenantId,
    });
    expect(data).toBe(false);
  });

  // ─── is_subtenant_member_inherited ─────────────────────────────────────

  it('member_inherited : admin racine hérite vers Paris', async () => {
    const { data } = await ctx.anonAdmin.rpc('is_subtenant_member_inherited', {
      p_tenant_id: ctx.parisTenantId,
    });
    expect(data).toBe(true);
  });

  it('member_inherited : partner racine n hérite PAS (cohérent règle)', async () => {
    const { data } = await ctx.anonPartner.rpc('is_subtenant_member_inherited', {
      p_tenant_id: ctx.parisTenantId,
    });
    expect(data).toBe(false);
  });

  it('member_inherited : tenant racine (sans parent) retourne false', async () => {
    const { data } = await ctx.anonAdmin.rpc('is_subtenant_member_inherited', {
      p_tenant_id: ctx.rootTenantId,
    });
    expect(data).toBe(false);
  });

  // ─── get_user_subtenants ────────────────────────────────────────────────

  it('get_user_subtenants : admin racine voit les 3 sous-tenants', async () => {
    const { data, error } = await ctx.anonAdmin.rpc('get_user_subtenants', {
      p_parent_tenant_id: ctx.rootTenantId,
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    const ids = data!.map((t: { id: string }) => t.id).sort();
    expect(ids).toEqual([ctx.parisTenantId, ctx.lyonTenantId, ctx.bordeauxTenantId].sort());
  });

  it('get_user_subtenants : memberParis voit Paris + Lyon + Bordeaux (via inherited car member racine via parent? NON il est member SUBTENANT pas racine)', async () => {
    // memberParis est member direct de PARIS, pas du parent racine.
    // Via inherited (jointure parent_tenant_id), il N'a PAS d'appartenance
    // au racine, donc voit uniquement Paris (direct).
    const { data } = await ctx.anonMemberParis.rpc('get_user_subtenants', {
      p_parent_tenant_id: ctx.rootTenantId,
    });
    expect(data).toHaveLength(1);
    expect((data as { id: string }[])[0].id).toBe(ctx.parisTenantId);
  });

  it('get_user_subtenants : partner racine ne voit aucun sous-tenant', async () => {
    const { data } = await ctx.anonPartner.rpc('get_user_subtenants', {
      p_parent_tenant_id: ctx.rootTenantId,
    });
    expect(data).toEqual([]);
  });

  // ─── move_user_between_subtenants ──────────────────────────────────────

  it('move : admin racine déplace memberBordeaux Bordeaux → Lyon (atomique)', async () => {
    const { error } = await ctx.anonAdmin.rpc('move_user_between_subtenants', {
      p_user_id: ctx.memberBordeauxId,
      p_from_tenant_id: ctx.bordeauxTenantId,
      p_to_tenant_id: ctx.lyonTenantId,
    });
    expect(error).toBeNull();

    // Vérifications : plus dans Bordeaux, présent dans Lyon
    const { data: inBordeaux } = await ctx.admin.from('tenant_members')
      .select('tenant_id').eq('user_id', ctx.memberBordeauxId).eq('tenant_id', ctx.bordeauxTenantId);
    expect(inBordeaux).toEqual([]);
    const { data: inLyon } = await ctx.admin.from('tenant_members')
      .select('tenant_id').eq('user_id', ctx.memberBordeauxId).eq('tenant_id', ctx.lyonTenantId);
    expect(inLyon).toHaveLength(1);

    // Restore pour les tests suivants
    await ctx.admin.from('tenant_members').delete()
      .eq('user_id', ctx.memberBordeauxId).eq('tenant_id', ctx.lyonTenantId);
    await ctx.admin.from('tenant_members').insert({
      tenant_id: ctx.bordeauxTenantId, user_id: ctx.memberBordeauxId, role: 'member', access_scope: 'magrit_full',
    });
  });

  it('move : memberParis (non-admin parent) BLOCKED', async () => {
    const { error } = await ctx.anonMemberParis.rpc('move_user_between_subtenants', {
      p_user_id: ctx.memberLyonId,
      p_from_tenant_id: ctx.lyonTenantId,
      p_to_tenant_id: ctx.parisTenantId,
    });
    expect(error?.message).toMatch(/permission_denied/);
  });

  it('move : tenants avec parents différents BLOCKED', async () => {
    const { error } = await ctx.anonAdmin.rpc('move_user_between_subtenants', {
      p_user_id: ctx.memberParisId,
      p_from_tenant_id: ctx.parisTenantId,
      p_to_tenant_id: ctx.otherTenantId, // pas un subtenant
    });
    expect(error?.message).toMatch(/subtenant_required|parent_mismatch/);
  });

  // ─── get_subtenant_kpis ────────────────────────────────────────────────

  it('get_subtenant_kpis : admin voit nb commandes + CA HT du mois par site', async () => {
    const { data, error } = await ctx.anonAdmin.rpc('get_subtenant_kpis', {
      p_parent_tenant_id: ctx.rootTenantId,
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(3);

    const paris = (data as Array<{ tenant_id: string; month_order_count: number; month_ca_ht: number }>)
      .find((row) => row.tenant_id === ctx.parisTenantId);
    expect(paris).toBeTruthy();
    expect(Number(paris!.month_order_count)).toBe(2);
    expect(Number(paris!.month_ca_ht)).toBe(350);

    const lyon = (data as Array<{ tenant_id: string; month_order_count: number }>)
      .find((row) => row.tenant_id === ctx.lyonTenantId);
    expect(Number(lyon!.month_order_count)).toBe(0);
  });
});
