/**
 * Test E2E flux invitation (Sprint 5 closure, 2026-06-01).
 *
 * Couvre le parcours complet cote DB :
 *   1. Insert tenant_invitations (simule l'edge invite-member, sans Resend)
 *      avec pending_role_ids[] = [acheteur.id] et access_scope shop_only
 *   2. EMAIL_MISMATCH : un user authentifie avec un autre email se voit
 *      refuser l'acceptation (fix faille 27/05, migration accept_invitation_email_guard)
 *   3. Accept normal : user cible signe et appelle RPC accept_tenant_invitation
 *      -> insert tenant_members + tenant_role_assignments (Phase A propagation)
 *      -> tenant_invitations.accepted_at non null
 *   4. Idempotence : un replay de accept echoue (deja acceptee)
 *
 * L'edge function invite-member est testee separement (insert + Resend + rollback).
 * Ce test focus sur la chaine DB qui est consommee a l'acceptation.
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
  anonInvitee: SupabaseClient;
  anonStranger: SupabaseClient;
  ownerId: string;
  inviteeId: string;
  strangerId: string;
  inviteeEmail: string;
  tenantId: string;
  acheteurRoleId: string;
  invitationToken: string;
  invitationId: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('Flux invitation E2E (DB layer)', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tag = rid();
    const password = `inv-${tag}-${rid()}`;
    const ownerEmail = `inv-owner-${tag}@magrit.test`;
    const inviteeEmail = `inv-invitee-${tag}@magrit.test`;
    const strangerEmail = `inv-stranger-${tag}@magrit.test`;

    const { data: owner, error: oErr } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
    });
    if (oErr || !owner.user) throw new Error(`createUser owner: ${oErr?.message}`);

    const { data: invitee, error: iErr } = await admin.auth.admin.createUser({
      email: inviteeEmail,
      password,
      email_confirm: true,
    });
    if (iErr || !invitee.user) throw new Error(`createUser invitee: ${iErr?.message}`);

    const { data: stranger, error: sErr } = await admin.auth.admin.createUser({
      email: strangerEmail,
      password,
      email_confirm: true,
    });
    if (sErr || !stranger.user) throw new Error(`createUser stranger: ${sErr?.message}`);

    const slug = `inv-test-${tag}`;
    const { data: tenant, error: tErr } = await admin
      .from('tenants')
      .insert({ slug, name: `Invitation Test ${tag}` })
      .select('id')
      .single();
    if (tErr || !tenant) throw new Error(`tenant insert: ${tErr?.message}`);

    const { error: memErr } = await admin.from('tenant_members').insert({
      tenant_id: tenant.id,
      user_id: owner.user.id,
      role: 'owner',
      access_scope: 'magrit_full',
      permissions: { can_quote: true, can_order: true, can_invite: true },
    });
    if (memErr) throw new Error(`tenant_member owner: ${memErr.message}`);

    // Seed le role Acheteur sur le tenant test (la migration seed sur les
    // tenants existants au moment de son apply, pas sur new tenants).
    const { data: roleAcheteur, error: rErr } = await admin
      .from('tenant_role_definitions')
      .insert({
        tenant_id: tenant.id,
        name: 'Acheteur',
        description: 'Passe des devis et commandes sur les boutiques autorisees',
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
    if (rErr || !roleAcheteur) throw new Error(`role insert: ${rErr?.message}`);

    const anonOwner = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonInvitee = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonStranger = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: signOErr } = await anonOwner.auth.signInWithPassword({
      email: ownerEmail,
      password,
    });
    if (signOErr) throw new Error(`signIn owner: ${signOErr.message}`);
    const { error: signIErr } = await anonInvitee.auth.signInWithPassword({
      email: inviteeEmail,
      password,
    });
    if (signIErr) throw new Error(`signIn invitee: ${signIErr.message}`);
    const { error: signSErr } = await anonStranger.auth.signInWithPassword({
      email: strangerEmail,
      password,
    });
    if (signSErr) throw new Error(`signIn stranger: ${signSErr.message}`);

    Object.assign(ctx, {
      admin,
      anonOwner,
      anonInvitee,
      anonStranger,
      ownerId: owner.user.id,
      inviteeId: invitee.user.id,
      strangerId: stranger.user.id,
      inviteeEmail,
      tenantId: tenant.id,
      acheteurRoleId: roleAcheteur.id,
      invitationToken: '',
      invitationId: '',
      cleanup: async () => {
        // Ordre defensif : assignments -> definitions -> members -> invitations
        //                  -> tenants -> users
        await admin
          .from('tenant_role_assignments')
          .delete()
          .eq('role_definition_id', roleAcheteur.id);
        await admin
          .from('tenant_role_definitions')
          .delete()
          .eq('tenant_id', tenant.id);
        await admin.from('tenant_members').delete().eq('tenant_id', tenant.id);
        await admin
          .from('tenant_invitations')
          .delete()
          .eq('tenant_id', tenant.id);
        await admin.from('tenants').delete().eq('id', tenant.id);
        await admin.auth.admin.deleteUser(owner.user!.id).catch(() => {});
        await admin.auth.admin.deleteUser(invitee.user!.id).catch(() => {});
        await admin.auth.admin.deleteUser(stranger.user!.id).catch(() => {});
      },
    });
  }, 30_000);

  afterAll(async () => {
    if (ctx.cleanup) await ctx.cleanup();
  });

  it('etape 1 — insert tenant_invitations avec pending_role_ids', async () => {
    const token = crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
    const expires = new Date(Date.now() + 14 * 86_400_000).toISOString();

    const { data, error } = await ctx.admin
      .from('tenant_invitations')
      .insert({
        tenant_id: ctx.tenantId,
        email: ctx.inviteeEmail.toLowerCase(),
        role: 'member',
        token,
        expires_at: expires,
        invited_by: ctx.ownerId,
        access_scope: 'shop_only',
        allowed_shop_ids: [],
        permissions: { can_quote: true, can_order: true, can_invite: false },
        pending_role_ids: [ctx.acheteurRoleId],
      })
      .select('id, token, pending_role_ids')
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.token).toBe(token);
    expect(data!.pending_role_ids).toEqual([ctx.acheteurRoleId]);

    ctx.invitationToken = token;
    ctx.invitationId = data!.id;
  });

  it('etape 2 — accept par un autre user echoue avec EMAIL_MISMATCH', async () => {
    const { error } = await ctx.anonStranger.rpc('accept_tenant_invitation', {
      p_token: ctx.invitationToken,
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/EMAIL_MISMATCH/);

    // L'invitation reste non-acceptee
    const { data: inv } = await ctx.admin
      .from('tenant_invitations')
      .select('accepted_at')
      .eq('id', ctx.invitationId)
      .single();
    expect(inv?.accepted_at).toBeNull();
  });

  it('etape 3 — accept par le user cible cree membership + role assignment', async () => {
    const { data, error } = await ctx.anonInvitee.rpc('accept_tenant_invitation', {
      p_token: ctx.invitationToken,
    });
    expect(error).toBeNull();
    expect(data).toBe(ctx.tenantId);

    // tenant_members
    const { data: member } = await ctx.admin
      .from('tenant_members')
      .select('role, access_scope, allowed_shop_ids, permissions')
      .eq('tenant_id', ctx.tenantId)
      .eq('user_id', ctx.inviteeId)
      .single();
    expect(member).toBeTruthy();
    expect(member!.access_scope).toBe('shop_only');
    expect(member!.role).toBe('member');
    expect(member!.permissions).toMatchObject({
      can_quote: true,
      can_order: true,
      can_invite: false,
    });

    // tenant_role_assignments — Acheteur propage
    const { data: assignments } = await ctx.admin
      .from('tenant_role_assignments')
      .select('role_definition_id, revoked_at')
      .eq('user_id', ctx.inviteeId)
      .is('revoked_at', null);
    expect(assignments).toHaveLength(1);
    expect(assignments![0].role_definition_id).toBe(ctx.acheteurRoleId);

    // tenant_invitations.accepted_at est non null
    const { data: inv } = await ctx.admin
      .from('tenant_invitations')
      .select('accepted_at')
      .eq('id', ctx.invitationId)
      .single();
    expect(inv?.accepted_at).not.toBeNull();
  });

  it('etape 4 — replay accept echoue (idempotence)', async () => {
    const { error } = await ctx.anonInvitee.rpc('accept_tenant_invitation', {
      p_token: ctx.invitationToken,
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/invalide|deja acceptee/i);
  });
});
