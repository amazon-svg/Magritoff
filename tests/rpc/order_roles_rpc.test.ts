/**
 * Tests RPC S-ORDER-ROLES-2 (2026-06-01).
 *
 * Couvre les 4 RPCs canoniques :
 *   - assign_tenant_order_role
 *   - revoke_tenant_order_role
 *   - update_tenant_order_role_capabilities (transactional + audit retroactif)
 *   - transition_tenant_order_status (matrice extensible)
 *
 * Pattern : 1 tenant + 2 users (owner = admin, buyer = member acheteur),
 * 1 commande draft + 1 role Validateur. On exerce les RPCs avec les 2
 * identités pour vérifier autorisations et audits.
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
  anonBuyer: SupabaseClient;
  anonStranger: SupabaseClient;
  ownerId: string;
  buyerId: string;
  strangerId: string;
  tenantId: string;
  otherTenantId: string;
  shopId: string;
  orderId: string;
  validateurRoleId: string;
  otherTenantRoleId: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('RPC S-ORDER-ROLES-2 (transitions + audit)', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tag = rid();
    const password = `rpc-${tag}-${rid()}`;
    const ownerEmail = `rpc-owner-${tag}@magrit.test`;
    const buyerEmail = `rpc-buyer-${tag}@magrit.test`;
    const strangerEmail = `rpc-stranger-${tag}@magrit.test`;

    const { data: owner } = await admin.auth.admin.createUser({
      email: ownerEmail, password, email_confirm: true,
    });
    const { data: buyer } = await admin.auth.admin.createUser({
      email: buyerEmail, password, email_confirm: true,
    });
    const { data: stranger } = await admin.auth.admin.createUser({
      email: strangerEmail, password, email_confirm: true,
    });
    if (!owner.user || !buyer.user || !stranger.user) throw new Error('createUser failed');

    // 2 tenants (le second pour tester cross-tenant)
    const { data: tenant } = await admin
      .from('tenants').insert({ slug: `rpc-test-${tag}`, name: `RPC Test ${tag}` })
      .select('id').single();
    const { data: otherTenant } = await admin
      .from('tenants').insert({ slug: `rpc-other-${tag}`, name: `RPC Other ${tag}` })
      .select('id').single();
    if (!tenant || !otherTenant) throw new Error('tenant insert failed');

    // NB : ne pas mélanger des rows avec/sans `permissions` dans le même
    // batch insert — Supabase JS aligne les colonnes et passe `null` à ceux
    // qui ne l'ont pas, ce qui viole le NOT NULL (la colonne a un DEFAULT
    // mais il ne s'applique pas si null explicite).
    // Laisser le default SQL `{can_quote:true, can_order:true, can_invite:false}`
    // s'appliquer pour tous (cohérent avec scope shop_only acheteur preset).
    await admin.from('tenant_members').insert([
      { tenant_id: tenant.id, user_id: owner.user.id, role: 'owner', access_scope: 'magrit_full' },
      { tenant_id: tenant.id, user_id: buyer.user.id, role: 'member', access_scope: 'shop_only' },
      { tenant_id: otherTenant.id, user_id: stranger.user.id, role: 'owner', access_scope: 'magrit_full' },
    ]);

    const { data: shop } = await admin.from('shops').insert({
      tenant_id: tenant.id, owner_user_id: owner.user.id,
      slug: `rpc-shop-${tag}`, name: 'Shop RPC',
      description: '', theme: { primaryColor: '#000', accentColor: '#000', mode: 'light' },
      active: true, library_ids: [], excluded_product_ids: [],
    }).select('id').single();
    if (!shop) throw new Error('shop insert failed');

    const { data: order } = await admin.from('tenant_orders').insert({
      tenant_id: tenant.id, shop_id: shop.id, created_by: buyer.user.id,
      status: 'draft', total_ht: 100, currency: 'EUR',
    }).select('id').single();
    if (!order) throw new Error('order insert failed');

    // Récupère Validateur preset auto-seedé sur tenant
    const { data: roleVal } = await admin.from('tenant_role_definitions')
      .select('id').eq('tenant_id', tenant.id).eq('name', 'Validateur').single();
    const { data: otherRoleVal } = await admin.from('tenant_role_definitions')
      .select('id').eq('tenant_id', otherTenant.id).eq('name', 'Validateur').single();
    if (!roleVal || !otherRoleVal) throw new Error('roles auto-seed introuvables');

    const anonOwner = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const anonBuyer = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const anonStranger = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await anonOwner.auth.signInWithPassword({ email: ownerEmail, password });
    await anonBuyer.auth.signInWithPassword({ email: buyerEmail, password });
    await anonStranger.auth.signInWithPassword({ email: strangerEmail, password });

    Object.assign(ctx, {
      admin, anonOwner, anonBuyer, anonStranger,
      ownerId: owner.user.id, buyerId: buyer.user.id, strangerId: stranger.user.id,
      tenantId: tenant.id, otherTenantId: otherTenant.id,
      shopId: shop.id, orderId: order.id,
      validateurRoleId: roleVal.id, otherTenantRoleId: otherRoleVal.id,
      cleanup: async () => {
        await admin.from('tenant_order_role_events').delete().eq('order_id', order.id);
        await admin.from('tenant_order_status_events').delete().eq('order_id', order.id);
        await admin.from('tenant_order_roles').delete().eq('order_id', order.id);
        await admin.from('tenant_order_items').delete().eq('order_id', order.id);
        await admin.from('tenant_orders').delete().eq('id', order.id);
        await admin.from('tenant_order_status_transitions').delete().in('tenant_id', [tenant.id, otherTenant.id]);
        await admin.from('tenant_order_status_definitions').delete().in('tenant_id', [tenant.id, otherTenant.id]);
        await admin.from('tenant_role_definitions').delete().in('tenant_id', [tenant.id, otherTenant.id]);
        await admin.from('shops').delete().eq('id', shop.id);
        await admin.from('tenant_members').delete().in('tenant_id', [tenant.id, otherTenant.id]);
        await admin.from('tenants').delete().in('id', [tenant.id, otherTenant.id]);
        await admin.auth.admin.deleteUser(owner.user!.id).catch(() => {});
        await admin.auth.admin.deleteUser(buyer.user!.id).catch(() => {});
        await admin.auth.admin.deleteUser(stranger.user!.id).catch(() => {});
      },
    });
  }, 45_000);

  afterAll(async () => {
    if (ctx.cleanup) await ctx.cleanup();
  });

  // ─── assign_tenant_order_role ──────────────────────────────────────────

  it('assign — admin tenant assigne Validateur a buyer sur l ordre + audit event', async () => {
    const { data: assignmentId, error } = await ctx.anonOwner.rpc('assign_tenant_order_role', {
      p_order_id: ctx.orderId,
      p_role_definition_id: ctx.validateurRoleId,
      p_user_id: ctx.buyerId,
    });
    expect(error).toBeNull();
    expect(typeof assignmentId).toBe('string');

    // Audit event present
    const { data: events } = await ctx.admin
      .from('tenant_order_role_events')
      .select('event_type, payload')
      .eq('order_id', ctx.orderId)
      .eq('event_type', 'assigned');
    expect(events).toHaveLength(1);
    expect((events![0].payload as any).role_name).toBe('Validateur');
  });

  it('assign — réassignation idempotente (UNIQUE constraint, no new row)', async () => {
    const { data: assignmentId2 } = await ctx.anonOwner.rpc('assign_tenant_order_role', {
      p_order_id: ctx.orderId,
      p_role_definition_id: ctx.validateurRoleId,
      p_user_id: ctx.buyerId,
    });
    // Doit retourner le même id que le premier appel
    const { data: assignments } = await ctx.admin
      .from('tenant_order_roles').select('id')
      .eq('order_id', ctx.orderId).eq('user_id', ctx.buyerId).eq('role_definition_id', ctx.validateurRoleId);
    expect(assignments).toHaveLength(1);
    expect(assignments![0].id).toBe(assignmentId2);
  });

  it('assign — buyer (non-admin) tente d assigner → permission_denied', async () => {
    const { error } = await ctx.anonBuyer.rpc('assign_tenant_order_role', {
      p_order_id: ctx.orderId,
      p_role_definition_id: ctx.validateurRoleId,
      p_user_id: ctx.buyerId,
    });
    expect(error?.message).toMatch(/permission_denied/);
  });

  it('assign — role cross-tenant → role_mismatch_tenant', async () => {
    const { error } = await ctx.anonOwner.rpc('assign_tenant_order_role', {
      p_order_id: ctx.orderId,
      p_role_definition_id: ctx.otherTenantRoleId,
      p_user_id: ctx.buyerId,
    });
    expect(error?.message).toMatch(/role_mismatch_tenant|permission_denied/);
  });

  it('assign — user non-membre du tenant → user_not_member', async () => {
    const { error } = await ctx.anonOwner.rpc('assign_tenant_order_role', {
      p_order_id: ctx.orderId,
      p_role_definition_id: ctx.validateurRoleId,
      p_user_id: ctx.strangerId,
    });
    expect(error?.message).toMatch(/user_not_member/);
  });

  // ─── revoke_tenant_order_role ──────────────────────────────────────────

  it('revoke — admin tenant révoque + audit event revoked', async () => {
    const { data: assignment } = await ctx.admin
      .from('tenant_order_roles').select('id')
      .eq('order_id', ctx.orderId).eq('user_id', ctx.buyerId).single();
    expect(assignment).toBeTruthy();

    const { data: revokedAt, error } = await ctx.anonOwner.rpc('revoke_tenant_order_role', {
      p_assignment_id: assignment!.id,
    });
    expect(error).toBeNull();
    expect(revokedAt).toBeTruthy();

    const { data: events } = await ctx.admin.from('tenant_order_role_events')
      .select('event_type, payload')
      .eq('order_id', ctx.orderId).eq('event_type', 'revoked');
    expect(events!.length).toBeGreaterThanOrEqual(1);
  });

  it('revoke — double revoke est idempotent (no-op silencieux)', async () => {
    const { data: assignment } = await ctx.admin
      .from('tenant_order_roles').select('id, revoked_at')
      .eq('order_id', ctx.orderId).eq('user_id', ctx.buyerId).single();
    const initialRevokedAt = assignment!.revoked_at;

    const { data: revokedAt, error } = await ctx.anonOwner.rpc('revoke_tenant_order_role', {
      p_assignment_id: assignment!.id,
    });
    expect(error).toBeNull();
    // Idempotent : retourne le même revoked_at, pas de nouveau
    expect(new Date(revokedAt!).toISOString()).toBe(new Date(initialRevokedAt!).toISOString());
  });

  // ─── update_tenant_order_role_capabilities ─────────────────────────────

  it('update_capabilities — admin tenant modifie + audit retroactif sur commandes assignees', async () => {
    // Re-assign Validateur sur orderId (reactivation post-revoke précédent)
    await ctx.anonOwner.rpc('assign_tenant_order_role', {
      p_order_id: ctx.orderId,
      p_role_definition_id: ctx.validateurRoleId,
      p_user_id: ctx.buyerId,
    });

    const newCaps = {
      can_quote: false, can_order: false, can_invite: false,
      can_validate: true, can_cancel: false, can_modify: false, can_export: true,
      can_manage_catalog: false, can_manage_roles: false,
    };
    const { error } = await ctx.anonOwner.rpc('update_tenant_order_role_capabilities', {
      p_role_definition_id: ctx.validateurRoleId,
      p_capabilities: newCaps,
    });
    expect(error).toBeNull();

    // Vérif capabilities mises à jour
    const { data: roleAfter } = await ctx.admin.from('tenant_role_definitions')
      .select('capabilities').eq('id', ctx.validateurRoleId).single();
    expect((roleAfter!.capabilities as any).can_cancel).toBe(false);

    // Audit event capability_updated présent
    const { data: events } = await ctx.admin.from('tenant_order_role_events')
      .select('event_type, payload').eq('order_id', ctx.orderId).eq('event_type', 'capability_updated');
    expect(events!.length).toBeGreaterThanOrEqual(1);
    expect((events![0].payload as any).new_capabilities.can_cancel).toBe(false);
  });

  it('update_capabilities — invalid key → invalid_capabilities_keys', async () => {
    const { error } = await ctx.anonOwner.rpc('update_tenant_order_role_capabilities', {
      p_role_definition_id: ctx.validateurRoleId,
      p_capabilities: { can_validate: true, can_evil_admin_bypass: true },
    });
    expect(error?.message).toMatch(/invalid_capabilities_keys/);
  });

  // ─── transition_tenant_order_status ────────────────────────────────────

  it('transition — buyer (creator) self-service draft → cancelled', async () => {
    // Crée une nouvelle commande qu on va annuler en self-service
    const { data: newOrder } = await ctx.admin.from('tenant_orders').insert({
      tenant_id: ctx.tenantId, shop_id: ctx.shopId, created_by: ctx.buyerId,
      status: 'draft', total_ht: 50, currency: 'EUR',
    }).select('id').single();

    const { data: newStatus, error } = await ctx.anonBuyer.rpc('transition_tenant_order_status', {
      p_order_id: newOrder!.id,
      p_new_status_code: 'cancelled',
      p_reason: 'self-service test',
    });
    expect(error).toBeNull();
    expect(newStatus).toBe('cancelled');

    // Cleanup
    await ctx.admin.from('tenant_order_status_events').delete().eq('order_id', newOrder!.id);
    await ctx.admin.from('tenant_orders').delete().eq('id', newOrder!.id);
  });

  it('transition — admin tenant draft → validated (capability requise validee via admin)', async () => {
    // Crée une nouvelle commande pour valider
    const { data: newOrder } = await ctx.admin.from('tenant_orders').insert({
      tenant_id: ctx.tenantId, shop_id: ctx.shopId, created_by: ctx.buyerId,
      status: 'draft', total_ht: 75, currency: 'EUR',
    }).select('id').single();

    const { data: newStatus, error } = await ctx.anonOwner.rpc('transition_tenant_order_status', {
      p_order_id: newOrder!.id,
      p_new_status_code: 'validated',
    });
    expect(error).toBeNull();
    expect(newStatus).toBe('validated');

    // Cleanup
    await ctx.admin.from('tenant_order_status_events').delete().eq('order_id', newOrder!.id);
    await ctx.admin.from('tenant_orders').delete().eq('id', newOrder!.id);
  });

  it('transition — transition illegale draft → shipped (skip validated) → transition_not_allowed', async () => {
    const { data: newOrder } = await ctx.admin.from('tenant_orders').insert({
      tenant_id: ctx.tenantId, shop_id: ctx.shopId, created_by: ctx.buyerId,
      status: 'draft', total_ht: 30, currency: 'EUR',
    }).select('id').single();

    const { error } = await ctx.anonOwner.rpc('transition_tenant_order_status', {
      p_order_id: newOrder!.id,
      p_new_status_code: 'shipped',
    });
    expect(error?.message).toMatch(/transition_not_allowed/);

    await ctx.admin.from('tenant_orders').delete().eq('id', newOrder!.id);
  });

  it('transition — status code inexistant → status_code_unknown', async () => {
    const { error } = await ctx.anonOwner.rpc('transition_tenant_order_status', {
      p_order_id: ctx.orderId,
      p_new_status_code: 'totally_made_up_status',
    });
    expect(error?.message).toMatch(/status_code_unknown/);
  });

  it('transition — buyer (non-creator non-admin sans capability) → permission_denied', async () => {
    // Crée une commande dont le creator n est PAS buyer
    const { data: newOrder } = await ctx.admin.from('tenant_orders').insert({
      tenant_id: ctx.tenantId, shop_id: ctx.shopId, created_by: ctx.ownerId,
      status: 'draft', total_ht: 20, currency: 'EUR',
    }).select('id').single();

    // buyer tente d annuler une commande qu il n a pas creee, sans capability
    const { error } = await ctx.anonBuyer.rpc('transition_tenant_order_status', {
      p_order_id: newOrder!.id,
      p_new_status_code: 'cancelled',
    });
    expect(error?.message).toMatch(/permission_denied/);

    await ctx.admin.from('tenant_orders').delete().eq('id', newOrder!.id);
  });
});
