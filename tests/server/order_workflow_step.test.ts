/**
 * Tests E2E edge function order-workflow-step (S-N1-APPROVAL, 2026-06-01).
 *
 * Valide le mapping notify_policy → destinataires :
 *   - chain_next : ordering_index strictement supérieur au rôle actif
 *   - all_roles : tous sauf l'acteur
 *   - none : aucun
 *
 * Resend n'est pas configuré sur le compte test (emails @magrit.test) :
 * destinations.sent sera false avec reason. On valide la LOGIQUE de
 * sélection des destinataires, pas l'envoi effectif.
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
  val1Id: string;
  val2Id: string;
  tenantId: string;
  orderId: string;
  acheteurRoleId: string;
  validateurRoleId: string;
  producteurRoleId: string;
  edgeUrl: string;
  baseUrl: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('Edge order-workflow-step (S-N1-APPROVAL)', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tag = rid();
    const password = `wf-${tag}-${rid()}`;

    const { data: owner } = await admin.auth.admin.createUser({
      email: `wf-owner-${tag}@magrit.test`, password, email_confirm: true,
    });
    const { data: val1 } = await admin.auth.admin.createUser({
      email: `wf-val1-${tag}@magrit.test`, password, email_confirm: true,
    });
    const { data: val2 } = await admin.auth.admin.createUser({
      email: `wf-val2-${tag}@magrit.test`, password, email_confirm: true,
    });
    if (!owner.user || !val1.user || !val2.user) throw new Error('createUser failed');

    const { data: tenant } = await admin
      .from('tenants').insert({ slug: `wf-${tag}`, name: `WF ${tag}` })
      .select('id').single();
    if (!tenant) throw new Error('tenant insert failed');

    await admin.from('tenant_members').insert([
      { tenant_id: tenant.id, user_id: owner.user.id, role: 'owner', access_scope: 'magrit_full' },
      { tenant_id: tenant.id, user_id: val1.user.id, role: 'member', access_scope: 'magrit_full' },
      { tenant_id: tenant.id, user_id: val2.user.id, role: 'member', access_scope: 'magrit_full' },
    ]);

    const { data: shop } = await admin.from('shops').insert({
      tenant_id: tenant.id, owner_user_id: owner.user.id,
      slug: `wf-shop-${tag}`, name: 'Shop WF',
      description: '', theme: { primaryColor: '#000', accentColor: '#000', mode: 'light' },
      active: true, library_ids: [], excluded_product_ids: [],
    }).select('id').single();
    if (!shop) throw new Error('shop insert failed');

    const { data: order } = await admin.from('tenant_orders').insert({
      tenant_id: tenant.id, shop_id: shop.id, created_by: owner.user.id,
      status: 'draft', total_ht: 100, currency: 'EUR',
    }).select('id').single();
    if (!order) throw new Error('order insert failed');

    // Récupère 3 rôles auto-seedés (différents ordering_index)
    const { data: acheteur } = await admin.from('tenant_role_definitions')
      .select('id').eq('tenant_id', tenant.id).eq('name', 'Acheteur').single();
    const { data: validateur } = await admin.from('tenant_role_definitions')
      .select('id').eq('tenant_id', tenant.id).eq('name', 'Validateur').single();
    const { data: producteur } = await admin.from('tenant_role_definitions')
      .select('id').eq('tenant_id', tenant.id).eq('name', 'Producteur').single();
    if (!acheteur || !validateur || !producteur) throw new Error('roles introuvables');

    // Assignments : owner=Acheteur (ord 30), val1=Validateur (ord 40), val2=Producteur (ord 50)
    await admin.from('tenant_order_roles').insert([
      { order_id: order.id, role_definition_id: acheteur.id, user_id: owner.user.id, assigned_by: owner.user.id },
      { order_id: order.id, role_definition_id: validateur.id, user_id: val1.user.id, assigned_by: owner.user.id },
      { order_id: order.id, role_definition_id: producteur.id, user_id: val2.user.id, assigned_by: owner.user.id },
    ]);

    const anonOwner = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await anonOwner.auth.signInWithPassword({ email: `wf-owner-${tag}@magrit.test`, password });

    Object.assign(ctx, {
      admin, anonOwner,
      ownerId: owner.user.id, val1Id: val1.user.id, val2Id: val2.user.id,
      tenantId: tenant.id, orderId: order.id,
      acheteurRoleId: acheteur.id, validateurRoleId: validateur.id, producteurRoleId: producteur.id,
      edgeUrl: `${url}/functions/v1/order-workflow-step`,
      baseUrl: 'http://localhost:5177',
      cleanup: async () => {
        await admin.from('tenant_order_role_events').delete().eq('order_id', order.id);
        await admin.from('tenant_order_status_events').delete().eq('order_id', order.id);
        await admin.from('tenant_order_roles').delete().eq('order_id', order.id);
        await admin.from('tenant_order_items').delete().eq('order_id', order.id);
        await admin.from('tenant_orders').delete().eq('id', order.id);
        await admin.from('tenant_order_status_transitions').delete().eq('tenant_id', tenant.id);
        await admin.from('tenant_order_status_definitions').delete().eq('tenant_id', tenant.id);
        await admin.from('tenant_role_definitions').delete().eq('tenant_id', tenant.id);
        await admin.from('shops').delete().eq('id', shop.id);
        await admin.from('tenant_members').delete().eq('tenant_id', tenant.id);
        await admin.from('tenants').delete().eq('id', tenant.id);
        await admin.auth.admin.deleteUser(owner.user!.id).catch(() => {});
        await admin.auth.admin.deleteUser(val1.user!.id).catch(() => {});
        await admin.auth.admin.deleteUser(val2.user!.id).catch(() => {});
      },
    });
  }, 45_000);

  afterAll(async () => {
    if (ctx.cleanup) await ctx.cleanup();
  });

  const callEdge = async (payload: object) => {
    const resp = await fetch(ctx.edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await resp.json();
    return { status: resp.status, body };
  };

  it('chain_next — owner (Acheteur ord 30) valide → notifie val1 + val2 (ord > 30)', async () => {
    // owner appelle order-workflow-step après une transition draft → validated
    const { status, body } = await callEdge({
      order_id: ctx.orderId,
      from_status: 'draft',
      to_status: 'validated',
      actor_user_id: ctx.ownerId,
      base_url: ctx.baseUrl,
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    // Acheteur (30) → next steps : Validateur (40) + Producteur (50) = 2 destinataires
    expect(body.destinations).toHaveLength(2);
    expect(body.policy).toBe('chain_next');
    const userIds = body.destinations.map((d: { user_id: string }) => d.user_id).sort();
    expect(userIds).toEqual([ctx.val1Id, ctx.val2Id].sort());
    // Resend non configuré sur compte .magrit.test → sent=false avec reason
    for (const d of body.destinations) {
      expect(d.sent === false || d.sent === true).toBe(true);
    }
  });

  it('chain_next — val1 (Validateur ord 40) modifie → notifie uniquement val2 (Producteur ord 50)', async () => {
    const { body } = await callEdge({
      order_id: ctx.orderId,
      from_status: 'validated',
      to_status: 'in_production',
      actor_user_id: ctx.val1Id,
      base_url: ctx.baseUrl,
    });
    expect(body.ok).toBe(true);
    // Validateur (40) → next : Producteur (50) seulement
    expect(body.destinations).toHaveLength(1);
    expect(body.destinations[0].user_id).toBe(ctx.val2Id);
  });

  it('all_roles — patch notify_policy en all_roles puis owner valide → notifie val1 + val2 (sauf acteur)', async () => {
    // Patch Acheteur en all_roles
    await ctx.admin.from('tenant_role_definitions')
      .update({ notify_policy: 'all_roles' })
      .eq('id', ctx.acheteurRoleId);

    const { body } = await callEdge({
      order_id: ctx.orderId,
      from_status: 'draft',
      to_status: 'validated',
      actor_user_id: ctx.ownerId,
      base_url: ctx.baseUrl,
    });
    expect(body.policy).toBe('all_roles');
    // all_roles : tous les assignés non-révoqués sauf acteur → val1 + val2
    expect(body.destinations).toHaveLength(2);

    // Restore
    await ctx.admin.from('tenant_role_definitions')
      .update({ notify_policy: 'chain_next' })
      .eq('id', ctx.acheteurRoleId);
  });

  it('none — patch notify_policy en none → 0 destinataire', async () => {
    await ctx.admin.from('tenant_role_definitions')
      .update({ notify_policy: 'none' })
      .eq('id', ctx.acheteurRoleId);

    const { body } = await callEdge({
      order_id: ctx.orderId,
      from_status: 'draft',
      to_status: 'validated',
      actor_user_id: ctx.ownerId,
      base_url: ctx.baseUrl,
    });
    expect(body.policy).toBe('none');
    expect(body.notified_count).toBe(0);
    expect(body.destinations).toEqual([]);

    await ctx.admin.from('tenant_role_definitions')
      .update({ notify_policy: 'chain_next' })
      .eq('id', ctx.acheteurRoleId);
  });

  it('body invalide → 400', async () => {
    const { status, body } = await callEdge({
      order_id: 'not-a-uuid',
      from_status: 'draft',
      to_status: 'validated',
      actor_user_id: ctx.ownerId,
      base_url: ctx.baseUrl,
    });
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it('order inexistant → 404', async () => {
    const { status, body } = await callEdge({
      order_id: '00000000-0000-0000-0000-000000000000',
      from_status: 'draft',
      to_status: 'validated',
      actor_user_id: ctx.ownerId,
      base_url: ctx.baseUrl,
    });
    expect(status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('order_not_found');
  });
});
