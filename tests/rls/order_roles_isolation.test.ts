/**
 * Tests RLS S-ORDER-ROLES-1 (2026-06-01).
 *
 * Couvre l'isolation cross-tenant des 3 nouvelles tables :
 *   - tenant_order_status_definitions
 *   - tenant_order_roles
 *   - tenant_order_role_events
 *
 * + Helpers SQL : user_has_order_role + user_can_validate_order.
 *
 * Pattern harness : 2 tenants jetables avec 1 commande chacun, 1 role
 * Validateur dans le tenant A assigné à userA sur la commande A.
 * On vérifie que userB ne voit RIEN du tenant A et inversement.
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
  anonA: SupabaseClient;
  anonB: SupabaseClient;
  userAId: string;
  userBId: string;
  tenantAId: string;
  tenantBId: string;
  orderAId: string;
  orderBId: string;
  shopAId: string;
  validatorRoleAId: string;
  acheteurRoleAId: string;
  validatorRoleBId: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('RLS order roles isolation (S-ORDER-ROLES-1)', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tag = rid();
    const password = `roles-${tag}-${rid()}`;
    const emailA = `roles-a-${tag}@magrit.test`;
    const emailB = `roles-b-${tag}@magrit.test`;

    const { data: a } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    const { data: b } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (!a.user || !b.user) throw new Error('createUser failed');

    // Tenants
    const tagSlugA = `roles-a-${tag}`;
    const tagSlugB = `roles-b-${tag}`;
    const { data: tA } = await admin
      .from('tenants')
      .insert({ slug: tagSlugA, name: `Roles A ${tag}` })
      .select('id')
      .single();
    const { data: tB } = await admin
      .from('tenants')
      .insert({ slug: tagSlugB, name: `Roles B ${tag}` })
      .select('id')
      .single();
    if (!tA || !tB) throw new Error('tenant insert failed');

    // Memberships owner
    await admin.from('tenant_members').insert([
      { tenant_id: tA.id, user_id: a.user.id, role: 'owner', access_scope: 'magrit_full' },
      { tenant_id: tB.id, user_id: b.user.id, role: 'owner', access_scope: 'magrit_full' },
    ]);

    // Shops (nécessaire pour FK tenant_orders.shop_id)
    const { data: shopA } = await admin
      .from('shops')
      .insert({
        tenant_id: tA.id,
        owner_user_id: a.user.id,
        slug: `roles-shop-a-${tag}`,
        name: `Shop A ${tag}`,
        description: '',
        theme: { primaryColor: '#000', accentColor: '#000', mode: 'light' },
        active: true,
        library_ids: [],
        excluded_product_ids: [],
      })
      .select('id')
      .single();
    const { data: shopB } = await admin
      .from('shops')
      .insert({
        tenant_id: tB.id,
        owner_user_id: b.user.id,
        slug: `roles-shop-b-${tag}`,
        name: `Shop B ${tag}`,
        description: '',
        theme: { primaryColor: '#000', accentColor: '#000', mode: 'light' },
        active: true,
        library_ids: [],
        excluded_product_ids: [],
      })
      .select('id')
      .single();
    if (!shopA || !shopB) throw new Error('shop insert failed');

    // Orders draft
    const { data: orderA } = await admin
      .from('tenant_orders')
      .insert({
        tenant_id: tA.id,
        shop_id: shopA.id,
        created_by: a.user.id,
        status: 'draft',
        total_ht: 100,
        currency: 'EUR',
      })
      .select('id')
      .single();
    const { data: orderB } = await admin
      .from('tenant_orders')
      .insert({
        tenant_id: tB.id,
        shop_id: shopB.id,
        created_by: b.user.id,
        status: 'draft',
        total_ht: 200,
        currency: 'EUR',
      })
      .select('id')
      .single();
    if (!orderA || !orderB) throw new Error('order insert failed');

    // Récupère les rôles Validateur + Acheteur auto-seedés par le trigger
    // tenants_seed_catalogs (migration 20260601000200).
    const { data: roleValA } = await admin
      .from('tenant_role_definitions')
      .select('id')
      .eq('tenant_id', tA.id)
      .eq('name', 'Validateur')
      .single();
    const { data: roleAcheteurA } = await admin
      .from('tenant_role_definitions')
      .select('id')
      .eq('tenant_id', tA.id)
      .eq('name', 'Acheteur')
      .single();
    const { data: roleValB } = await admin
      .from('tenant_role_definitions')
      .select('id')
      .eq('tenant_id', tB.id)
      .eq('name', 'Validateur')
      .single();
    if (!roleValA || !roleAcheteurA || !roleValB) throw new Error('roles auto-seed introuvables');

    // Assign userA en Validateur sur orderA (via service_role pour bypass policy)
    await admin.from('tenant_order_roles').insert({
      order_id: orderA.id,
      role_definition_id: roleValA.id,
      user_id: a.user.id,
      assigned_by: a.user.id,
    });

    // Event audit assignment (via service_role pour bypass policy)
    await admin.from('tenant_order_role_events').insert({
      order_id: orderA.id,
      role_definition_id: roleValA.id,
      user_id: a.user.id,
      event_type: 'assigned',
      actor_user_id: a.user.id,
      payload: { reason: 'initial assignment' },
    });

    const anonA = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonB = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await anonA.auth.signInWithPassword({ email: emailA, password });
    await anonB.auth.signInWithPassword({ email: emailB, password });

    Object.assign(ctx, {
      admin,
      anonA,
      anonB,
      userAId: a.user.id,
      userBId: b.user.id,
      tenantAId: tA.id,
      tenantBId: tB.id,
      orderAId: orderA.id,
      orderBId: orderB.id,
      shopAId: shopA.id,
      validatorRoleAId: roleValA.id,
      acheteurRoleAId: roleAcheteurA.id,
      validatorRoleBId: roleValB.id,
      cleanup: async () => {
        await admin.from('tenant_order_role_events').delete().in('order_id', [orderA.id, orderB.id]);
        await admin.from('tenant_order_roles').delete().in('order_id', [orderA.id, orderB.id]);
        await admin
          .from('tenant_order_status_definitions')
          .delete()
          .in('tenant_id', [tA.id, tB.id]);
        await admin.from('tenant_order_items').delete().in('order_id', [orderA.id, orderB.id]);
        await admin.from('tenant_orders').delete().in('id', [orderA.id, orderB.id]);
        await admin
          .from('tenant_role_definitions')
          .delete()
          .in('id', [roleValA.id, roleAcheteurA.id, roleValB.id]);
        await admin.from('shops').delete().in('id', [shopA.id, shopB.id]);
        await admin.from('tenant_members').delete().in('tenant_id', [tA.id, tB.id]);
        await admin.from('tenants').delete().in('id', [tA.id, tB.id]);
        await admin.auth.admin.deleteUser(a.user!.id).catch(() => {});
        await admin.auth.admin.deleteUser(b.user!.id).catch(() => {});
      },
    });
  }, 45_000);

  afterAll(async () => {
    if (ctx.cleanup) await ctx.cleanup();
  });

  // ─── tenant_order_status_definitions ───────────────────────────────────

  it('status_definitions — userA SELECT statuts de A (seedés par migration)', async () => {
    const { data, error } = await ctx.anonA
      .from('tenant_order_status_definitions')
      .select('code')
      .eq('tenant_id', ctx.tenantAId);
    expect(error).toBeNull();
    expect(data!.length).toBe(7);
    const codes = data!.map((r) => r.code).sort();
    expect(codes).toEqual([
      'cancelled',
      'delivered',
      'draft',
      'in_production',
      'invoiced',
      'shipped',
      'validated',
    ]);
  });

  it('status_definitions — userA ne voit RIEN du tenant B', async () => {
    const { data, error } = await ctx.anonA
      .from('tenant_order_status_definitions')
      .select('id')
      .eq('tenant_id', ctx.tenantBId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  // ─── tenant_order_roles ────────────────────────────────────────────────

  it('order_roles — userA voit son assignment Validateur sur orderA', async () => {
    const { data, error } = await ctx.anonA
      .from('tenant_order_roles')
      .select('role_definition_id, user_id, order_id')
      .eq('order_id', ctx.orderAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].user_id).toBe(ctx.userAId);
    expect(data![0].role_definition_id).toBe(ctx.validatorRoleAId);
  });

  it('order_roles — userB ne voit AUCUN assignment du tenant A', async () => {
    const { data, error } = await ctx.anonB
      .from('tenant_order_roles')
      .select('id')
      .eq('order_id', ctx.orderAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('order_roles — INSERT direct par user lambda est BLOQUÉ (RPC SECURITY DEFINER requis)', async () => {
    // userA tente d'auto-assigner un nouveau rôle (cumul) sur sa propre commande.
    // La policy autorise seulement super_admin en écriture directe.
    const { error } = await ctx.anonA.from('tenant_order_roles').insert({
      order_id: ctx.orderAId,
      role_definition_id: ctx.acheteurRoleAId,
      user_id: ctx.userAId,
      assigned_by: ctx.userAId,
    });
    expect(error).toBeTruthy();
    // PostgREST renvoie 42501 / row-level security pour les inserts bloqués
    const msg = error?.message ?? '';
    const code = (error as { code?: string }).code ?? '';
    expect(code === '42501' || msg.includes('row-level security')).toBe(true);
  });

  // ─── tenant_order_role_events ──────────────────────────────────────────

  it('role_events — userA voit l event assigned sur orderA', async () => {
    const { data, error } = await ctx.anonA
      .from('tenant_order_role_events')
      .select('event_type, role_definition_id')
      .eq('order_id', ctx.orderAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].event_type).toBe('assigned');
    expect(data![0].role_definition_id).toBe(ctx.validatorRoleAId);
  });

  it('role_events — userB ne voit AUCUN event du tenant A', async () => {
    const { data, error } = await ctx.anonB
      .from('tenant_order_role_events')
      .select('id')
      .eq('order_id', ctx.orderAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('role_events — INSERT direct bloqué (RPC SECURITY DEFINER requis)', async () => {
    const { error } = await ctx.anonA.from('tenant_order_role_events').insert({
      order_id: ctx.orderAId,
      role_definition_id: ctx.validatorRoleAId,
      user_id: ctx.userAId,
      event_type: 'capability_updated',
      actor_user_id: ctx.userAId,
      payload: { faked: true },
    });
    expect(error).toBeTruthy();
    const code = (error as { code?: string }).code ?? '';
    const msg = error?.message ?? '';
    expect(code === '42501' || msg.includes('row-level security')).toBe(true);
  });

  // ─── Helpers SQL ───────────────────────────────────────────────────────

  it('helper user_has_order_role — true si user a un rôle avec capability', async () => {
    // userA est Validateur sur orderA avec can_validate=true.
    const { data, error } = await ctx.anonA.rpc('user_has_order_role', {
      p_order_id: ctx.orderAId,
      p_capability: 'can_validate',
    });
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it('helper user_has_order_role — false si capability absente', async () => {
    // userA est Validateur sur orderA mais le rôle Validateur n'a pas
    // can_publish (cap inexistante du jeu Phase A).
    const { data, error } = await ctx.anonA.rpc('user_has_order_role', {
      p_order_id: ctx.orderAId,
      p_capability: 'can_publish',
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it('helper user_has_order_role — false si user n a aucun rôle sur la commande', async () => {
    // userB n a aucun rôle sur orderA.
    const { data, error } = await ctx.anonB.rpc('user_has_order_role', {
      p_order_id: ctx.orderAId,
      p_capability: 'can_validate',
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it('helper user_can_validate_order — alias user_has_order_role(can_validate)', async () => {
    const { data: dataA } = await ctx.anonA.rpc('user_can_validate_order', {
      p_order_id: ctx.orderAId,
    });
    expect(dataA).toBe(true);

    const { data: dataB } = await ctx.anonB.rpc('user_can_validate_order', {
      p_order_id: ctx.orderAId,
    });
    expect(dataB).toBe(false);
  });

  it('helper user_has_order_role — false si rôle révoqué', async () => {
    // Révoque l assignment userA sur Validateur orderA, vérifie helper retourne false.
    await ctx.admin
      .from('tenant_order_roles')
      .update({ revoked_at: new Date().toISOString() })
      .eq('order_id', ctx.orderAId)
      .eq('role_definition_id', ctx.validatorRoleAId);

    const { data, error } = await ctx.anonA.rpc('user_can_validate_order', {
      p_order_id: ctx.orderAId,
    });
    expect(error).toBeNull();
    expect(data).toBe(false);

    // Restore pour pas polluer les éventuels tests suivants (defensif).
    await ctx.admin
      .from('tenant_order_roles')
      .update({ revoked_at: null })
      .eq('order_id', ctx.orderAId)
      .eq('role_definition_id', ctx.validatorRoleAId);
  });
});
