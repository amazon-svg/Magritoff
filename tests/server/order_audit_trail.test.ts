/**
 * Tests E2E RPC get_order_audit_trail + helpers (S3.5 Sprint 6, 2026-06-01).
 *
 * Valide :
 *  - RPC retourne UNION ordered DESC des 2 tables d events
 *  - RLS via security definer + tenant member check
 *  - Helpers formatAuditEventTitle/Description couvrent les event types
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import '../_loadEnv';
import {
  formatAuditEventDescription,
  formatAuditEventTitle,
  formatAuditTimestamp,
  type OrderAuditEvent,
} from '../../src/app/components/shop/portal/orderAuditTrail.helpers';

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
  anonMember: SupabaseClient;
  anonStranger: SupabaseClient;
  memberId: string;
  strangerId: string;
  tenantId: string;
  orderId: string;
  validateurRoleId: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('RPC get_order_audit_trail (S3.5)', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const tag = rid();
    const password = `audit-${tag}-${rid()}`;

    const { data: m } = await admin.auth.admin.createUser({
      email: `audit-m-${tag}@magrit.test`, password, email_confirm: true,
    });
    const { data: s } = await admin.auth.admin.createUser({
      email: `audit-s-${tag}@magrit.test`, password, email_confirm: true,
    });
    if (!m.user || !s.user) throw new Error('createUser failed');

    const { data: tenant } = await admin
      .from('tenants').insert({ slug: `audit-${tag}`, name: `Audit ${tag}` })
      .select('id').single();
    const { data: stranger_tenant } = await admin
      .from('tenants').insert({ slug: `audit-stranger-${tag}`, name: `Stranger ${tag}` })
      .select('id').single();
    if (!tenant || !stranger_tenant) throw new Error('tenant insert failed');

    await admin.from('tenant_members').insert([
      { tenant_id: tenant.id, user_id: m.user.id, role: 'owner', access_scope: 'magrit_full' },
      { tenant_id: stranger_tenant.id, user_id: s.user.id, role: 'owner', access_scope: 'magrit_full' },
    ]);

    const { data: shop } = await admin.from('shops').insert({
      tenant_id: tenant.id, owner_user_id: m.user.id,
      slug: `audit-shop-${tag}`, name: 'Audit Shop',
      description: '', theme: { primaryColor: '#000', accentColor: '#000', mode: 'light' },
      active: true, library_ids: [], excluded_product_ids: [],
    }).select('id').single();
    if (!shop) throw new Error('shop insert failed');

    const { data: order } = await admin.from('tenant_orders').insert({
      tenant_id: tenant.id, shop_id: shop.id, created_by: m.user.id,
      status: 'draft', total_ht: 100, currency: 'EUR',
    }).select('id').single();
    if (!order) throw new Error('order insert failed');

    // Provoque 1 status event (cancel) via RPC
    const anonMember = createClient(url, anonKey, { auth: { persistSession: false } });
    await anonMember.auth.signInWithPassword({ email: `audit-m-${tag}@magrit.test`, password });

    await anonMember.rpc('update_tenant_order_status', {
      p_order_id: order.id,
      p_new_status: 'cancelled',
      p_reason: 'test audit trail',
    });

    // Provoque 1 role event (assign) via RPC
    const { data: validateur } = await admin.from('tenant_role_definitions')
      .select('id').eq('tenant_id', tenant.id).eq('name', 'Validateur').single();
    if (!validateur) throw new Error('role introuvable');

    await anonMember.rpc('assign_tenant_order_role', {
      p_order_id: order.id,
      p_role_definition_id: validateur.id,
      p_user_id: m.user.id,
    });

    const anonStranger = createClient(url, anonKey, { auth: { persistSession: false } });
    await anonStranger.auth.signInWithPassword({ email: `audit-s-${tag}@magrit.test`, password });

    Object.assign(ctx, {
      admin, anonMember, anonStranger,
      memberId: m.user.id, strangerId: s.user.id,
      tenantId: tenant.id, orderId: order.id,
      validateurRoleId: validateur.id,
      cleanup: async () => {
        await admin.from('tenant_order_role_events').delete().eq('order_id', order.id);
        await admin.from('tenant_order_status_events').delete().eq('order_id', order.id);
        await admin.from('tenant_order_roles').delete().eq('order_id', order.id);
        await admin.from('tenant_orders').delete().eq('id', order.id);
        await admin.from('tenant_order_status_transitions').delete().in('tenant_id', [tenant.id, stranger_tenant.id]);
        await admin.from('tenant_order_status_definitions').delete().in('tenant_id', [tenant.id, stranger_tenant.id]);
        await admin.from('tenant_role_definitions').delete().in('tenant_id', [tenant.id, stranger_tenant.id]);
        await admin.from('shops').delete().eq('id', shop.id);
        await admin.from('tenant_members').delete().in('tenant_id', [tenant.id, stranger_tenant.id]);
        await admin.from('tenants').delete().in('id', [tenant.id, stranger_tenant.id]);
        await admin.auth.admin.deleteUser(m.user!.id).catch(() => {});
        await admin.auth.admin.deleteUser(s.user!.id).catch(() => {});
      },
    });
  }, 45_000);

  afterAll(async () => {
    if (ctx.cleanup) await ctx.cleanup();
  });

  it('membre tenant voit UNION status + role events ordered DESC', async () => {
    const { data, error } = await ctx.anonMember.rpc('get_order_audit_trail', {
      p_order_id: ctx.orderId,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const events = data as OrderAuditEvent[];
    // Au moins 1 status event (cancel) + 1 role event (assigned)
    expect(events.length).toBeGreaterThanOrEqual(2);
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds.has('status')).toBe(true);
    expect(kinds.has('role')).toBe(true);

    // Tri DESC : le premier est plus récent que le dernier
    if (events.length >= 2) {
      const t0 = new Date(events[0].occurred_at).getTime();
      const t1 = new Date(events[events.length - 1].occurred_at).getTime();
      expect(t0).toBeGreaterThanOrEqual(t1);
    }
  });

  it('stranger (autre tenant) → permission_denied', async () => {
    const { error } = await ctx.anonStranger.rpc('get_order_audit_trail', {
      p_order_id: ctx.orderId,
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/permission_denied/);
  });

  it('order inexistant → order_not_found', async () => {
    const { error } = await ctx.anonMember.rpc('get_order_audit_trail', {
      p_order_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/order_not_found/);
  });
});

describe('orderAuditTrail.helpers (pur)', () => {
  const baseEvent = (overrides: Partial<OrderAuditEvent>): OrderAuditEvent => ({
    event_id: 'e-' + Math.random().toString(36).slice(2),
    order_id: 'o-' + Math.random().toString(36).slice(2),
    kind: 'status',
    event_type: 'status_transition',
    actor_id: 'u-' + Math.random().toString(36).slice(2),
    actor_email: 'actor@magrit.test',
    role_name: null,
    payload: {},
    occurred_at: new Date().toISOString(),
    ...overrides,
  });

  describe('formatAuditEventTitle', () => {
    it('status transition formate from -> to en FR', () => {
      const e = baseEvent({
        kind: 'status',
        payload: { from_status: 'draft', to_status: 'validated' },
      });
      expect(formatAuditEventTitle(e)).toBe('Statut : Brouillon → Validée');
    });

    it('role assigned affiche le nom du rôle', () => {
      const e = baseEvent({ kind: 'role', event_type: 'assigned', role_name: 'Validateur' });
      expect(formatAuditEventTitle(e)).toBe('Rôle assigné : Validateur');
    });

    it('role revoked affiche le nom du rôle', () => {
      const e = baseEvent({ kind: 'role', event_type: 'revoked', role_name: 'Acheteur' });
      expect(formatAuditEventTitle(e)).toBe('Rôle révoqué : Acheteur');
    });

    it('capability_updated affiche le nom du rôle', () => {
      const e = baseEvent({ kind: 'role', event_type: 'capability_updated', role_name: 'Validateur' });
      expect(formatAuditEventTitle(e)).toBe('Capabilities mises à jour : Validateur');
    });

    it('status inconnu fallback sur le code brut', () => {
      const e = baseEvent({ kind: 'status', payload: { from_status: 'wat', to_status: 'wat2' } });
      expect(formatAuditEventTitle(e)).toContain('wat');
    });
  });

  describe('formatAuditEventDescription', () => {
    it('inclut acteur email', () => {
      const e = baseEvent({ actor_email: 'admin@magrit.test' });
      expect(formatAuditEventDescription(e)).toContain('admin@magrit.test');
    });

    it('status avec reason affiche le motif', () => {
      const e = baseEvent({ kind: 'status', payload: { reason: 'rupture stock' } });
      expect(formatAuditEventDescription(e)).toContain('rupture stock');
    });

    it('acteur inconnu fallback', () => {
      const e = baseEvent({ actor_email: null });
      expect(formatAuditEventDescription(e)).toContain('acteur inconnu');
    });
  });

  describe('formatAuditTimestamp', () => {
    it('formate ISO en YYYY-MM-DD HH:mm', () => {
      const result = formatAuditTimestamp('2026-06-01T14:32:00.000Z');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('iso invalide retourné tel quel', () => {
      expect(formatAuditTimestamp('not-a-date')).toBe('not-a-date');
    });
  });
});
