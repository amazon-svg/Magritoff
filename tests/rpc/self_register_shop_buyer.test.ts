/**
 * Tests RPC S7.11 — self_register_shop_buyer (ADR §4.20).
 *
 * Pattern order_roles_rpc : tenant + 2 boutiques (invite_only / self_signup),
 * user éphémère « visiteur » (aucune appartenance). On vérifie :
 *  refus boutique fermée · inscription allow-list shop_only + rôle Acheteur ·
 *  idempotence · refus anonyme.
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
  anonVisitor: SupabaseClient;
  visitorId: string;
  tenantId: string;
  openShopId: string;
  closedShopId: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('RPC S7.11 self_register_shop_buyer', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tag = rid();
    const password = `selfreg-${tag}-${rid()}`;
    const visitorEmail = `selfreg-visitor-${tag}@magrit.test`;

    const { data: visitor } = await admin.auth.admin.createUser({
      email: visitorEmail,
      password,
      email_confirm: true,
    });
    if (!visitor.user) throw new Error('createUser failed');

    const { data: tenant } = await admin
      .from('tenants')
      .insert({ slug: `selfreg-${tag}`, name: `SelfReg ${tag}` })
      .select('id')
      .single();
    if (!tenant) throw new Error('tenant insert failed');

    const shopBase = {
      tenant_id: tenant.id,
      owner_user_id: visitor.user.id,
      description: '',
      theme: { primaryColor: '#000', accentColor: '#000', mode: 'light' },
      active: true,
      library_ids: [],
      excluded_product_ids: [],
    };
    const { data: openShop, error: openErr } = await admin
      .from('shops')
      .insert({ ...shopBase, slug: `selfreg-open-${tag}`, name: 'Open', access_mode: 'self_signup' })
      .select('id')
      .single();
    const { data: closedShop, error: closedErr } = await admin
      .from('shops')
      .insert({ ...shopBase, slug: `selfreg-closed-${tag}`, name: 'Closed', access_mode: 'invite_only' })
      .select('id')
      .single();
    if (!openShop || !closedShop) {
      throw new Error(`shop insert failed: ${openErr?.message ?? ''} ${closedErr?.message ?? ''}`);
    }

    const anonVisitor = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await anonVisitor.auth.signInWithPassword({ email: visitorEmail, password });

    Object.assign(ctx, {
      admin,
      anonVisitor,
      visitorId: visitor.user.id,
      tenantId: tenant.id,
      openShopId: openShop.id,
      closedShopId: closedShop.id,
      cleanup: async () => {
        await admin.from('tenant_role_assignments').delete().eq('user_id', visitor.user!.id);
        await admin.from('tenant_members').delete().eq('user_id', visitor.user!.id);
        await admin.from('shops').delete().in('id', [openShop.id, closedShop.id]);
        await admin.from('tenants').delete().eq('id', tenant.id);
        await admin.auth.admin.deleteUser(visitor.user!.id);
      },
    });
  }, 30_000);

  afterAll(async () => {
    await ctx.cleanup?.();
  });

  it('anonyme → permission denied (EXECUTE réservé authenticated)', async () => {
    const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon.rpc('self_register_shop_buyer', {
      p_shop_id: ctx.openShopId,
    });
    expect(error).not.toBeNull();
  });

  it('boutique invite_only → shop_not_open, aucun membre créé', async () => {
    const { error } = await ctx.anonVisitor.rpc('self_register_shop_buyer', {
      p_shop_id: ctx.closedShopId,
    });
    expect(error?.message).toContain('shop_not_open');
    const { data: members } = await ctx.admin
      .from('tenant_members')
      .select('user_id')
      .eq('tenant_id', ctx.tenantId)
      .eq('user_id', ctx.visitorId);
    expect(members).toHaveLength(0);
  });

  it('boutique self_signup → membre shop_only allow-list + rôle Acheteur (AC2/AC3)', async () => {
    const { data, error } = await ctx.anonVisitor.rpc('self_register_shop_buyer', {
      p_shop_id: ctx.openShopId,
    });
    expect(error).toBeNull();
    expect((data as { status: string }).status).toBe('registered');

    const { data: member } = await ctx.admin
      .from('tenant_members')
      .select('role, access_scope, allowed_shop_ids, permissions')
      .eq('tenant_id', ctx.tenantId)
      .eq('user_id', ctx.visitorId)
      .single();
    expect(member?.role).toBe('member');
    expect(member?.access_scope).toBe('shop_only');
    expect(member?.allowed_shop_ids).toEqual([ctx.openShopId]);
    expect((member?.permissions as { can_order: boolean }).can_order).toBe(true);
    expect((member?.permissions as { can_invite: boolean }).can_invite).toBe(false);

    // Rôle Acheteur (preset auto-seedé à la création du tenant)
    const { data: assignments } = await ctx.admin
      .from('tenant_role_assignments')
      .select('role_definition_id, tenant_role_definitions!inner(name, tenant_id)')
      .eq('user_id', ctx.visitorId)
      .is('revoked_at', null);
    const names = (assignments ?? []).map(
      (a) => (a.tenant_role_definitions as unknown as { name: string }).name,
    );
    expect(names).toContain('Acheteur');
  });

  it('idempotence : 2e appel → already_member, pas de doublon', async () => {
    const { data, error } = await ctx.anonVisitor.rpc('self_register_shop_buyer', {
      p_shop_id: ctx.openShopId,
    });
    expect(error).toBeNull();
    expect((data as { status: string }).status).toBe('already_member');

    const { data: members } = await ctx.admin
      .from('tenant_members')
      .select('user_id')
      .eq('tenant_id', ctx.tenantId)
      .eq('user_id', ctx.visitorId);
    expect(members).toHaveLength(1);
    const { data: member } = await ctx.admin
      .from('tenant_members')
      .select('allowed_shop_ids')
      .eq('tenant_id', ctx.tenantId)
      .eq('user_id', ctx.visitorId)
      .single();
    // Pas de doublon dans l'allow-list
    expect(member?.allowed_shop_ids).toEqual([ctx.openShopId]);
  });
});
