/**
 * Tests E2E durcissements R5-bis P1 invite-member (S9 audit sécurité,
 * Sprint 9, 2026-06-01).
 *
 * Valide les 4 durcissements ajoutés post Sprint 5 clôture :
 *   1. Auth check : caller JWT id == body.invited_by
 *   2. Capability check : caller a can_invite sur tenant cible
 *   3. Validation role_definition_ids ⊂ tenant
 *   4. Idempotence : pas de doublon pending
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
  anonMember: SupabaseClient;
  ownerId: string;
  memberId: string;
  tenantId: string;
  otherTenantId: string;
  acheteurRoleId: string;
  otherRoleId: string;
  edgeUrl: string;
  ownerJwt: string;
  memberJwt: string;
  baseUrl: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('invite-member hardened (S9 R5-bis P1)', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const tag = rid();
    const password = `inv-h-${tag}-${rid()}`;

    const { data: owner } = await admin.auth.admin.createUser({
      email: `inv-h-o-${tag}@magrit.test`, password, email_confirm: true,
    });
    const { data: member } = await admin.auth.admin.createUser({
      email: `inv-h-m-${tag}@magrit.test`, password, email_confirm: true,
    });

    const { data: tenant } = await admin
      .from('tenants').insert({ slug: `inv-h-${tag}`, name: `Inv H ${tag}` })
      .select('id').single();
    const { data: otherTenant } = await admin
      .from('tenants').insert({ slug: `inv-h-other-${tag}`, name: `Other ${tag}` })
      .select('id').single();

    // owner = admin tenant, member = simple (n'aura pas can_invite)
    await admin.from('tenant_members').insert([
      { tenant_id: tenant!.id, user_id: owner.user!.id, role: 'owner', access_scope: 'magrit_full' },
      { tenant_id: tenant!.id, user_id: member.user!.id, role: 'member', access_scope: 'magrit_full' },
    ]);

    // Owner reçoit rôle Owner (avec can_invite)
    const { data: ownerRole } = await admin.from('tenant_role_definitions')
      .select('id').eq('tenant_id', tenant!.id).eq('name', 'Owner').single();
    await admin.from('tenant_role_assignments').insert({
      role_definition_id: ownerRole!.id, user_id: owner.user!.id, assigned_by: owner.user!.id,
    });

    // Acheteur role pour ce tenant + Acheteur role pour OTHER tenant
    const { data: acheteur } = await admin.from('tenant_role_definitions')
      .select('id').eq('tenant_id', tenant!.id).eq('name', 'Acheteur').single();
    const { data: otherRole } = await admin.from('tenant_role_definitions')
      .select('id').eq('tenant_id', otherTenant!.id).eq('name', 'Acheteur').single();

    const anonOwner = createClient(url, anonKey, { auth: { persistSession: false } });
    await anonOwner.auth.signInWithPassword({ email: `inv-h-o-${tag}@magrit.test`, password });
    const anonMember = createClient(url, anonKey, { auth: { persistSession: false } });
    await anonMember.auth.signInWithPassword({ email: `inv-h-m-${tag}@magrit.test`, password });

    const { data: ownerSession } = await anonOwner.auth.getSession();
    const { data: memberSession } = await anonMember.auth.getSession();

    Object.assign(ctx, {
      admin, anonOwner, anonMember,
      ownerId: owner.user!.id, memberId: member.user!.id,
      tenantId: tenant!.id, otherTenantId: otherTenant!.id,
      acheteurRoleId: acheteur!.id, otherRoleId: otherRole!.id,
      edgeUrl: `${url}/functions/v1/invite-member`,
      ownerJwt: ownerSession.session!.access_token,
      memberJwt: memberSession.session!.access_token,
      baseUrl: 'http://localhost:5177',
      cleanup: async () => {
        await admin.from('tenant_role_assignments').delete().eq('role_definition_id', ownerRole!.id);
        await admin.from('tenant_invitations').delete().in('tenant_id', [tenant!.id, otherTenant!.id]);
        await admin.from('tenant_order_status_transitions').delete().in('tenant_id', [tenant!.id, otherTenant!.id]);
        await admin.from('tenant_order_status_definitions').delete().in('tenant_id', [tenant!.id, otherTenant!.id]);
        await admin.from('tenant_role_definitions').delete().in('tenant_id', [tenant!.id, otherTenant!.id]);
        await admin.from('tenant_members').delete().in('tenant_id', [tenant!.id, otherTenant!.id]);
        await admin.from('tenants').delete().in('id', [tenant!.id, otherTenant!.id]);
        await admin.auth.admin.deleteUser(owner.user!.id).catch(() => {});
        await admin.auth.admin.deleteUser(member.user!.id).catch(() => {});
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (ctx.cleanup) await ctx.cleanup();
  });

  const callEdge = async (token: string, body: object) => {
    const resp = await fetch(ctx.edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const respBody = await resp.json();
    return { status: resp.status, body: respBody };
  };

  it('1. Pas de Authorization Bearer → 401', async () => {
    const resp = await fetch(ctx.edgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new@magrit.test',
        tenant_id: ctx.tenantId,
        invited_by: ctx.ownerId,
        baseUrl: ctx.baseUrl,
      }),
    });
    expect(resp.status).toBe(401);
  });

  it('2. JWT caller ≠ invited_by → 403 invited_by_mismatch', async () => {
    // Owner essaie d inviter MAIS body.invited_by = memberId (mismatch)
    const { status, body } = await callEdge(ctx.ownerJwt, {
      email: `new-${rid()}@magrit.test`,
      tenant_id: ctx.tenantId,
      invited_by: ctx.memberId, // FORGED
      baseUrl: ctx.baseUrl,
    });
    expect(status).toBe(403);
    expect(body.error).toMatch(/invited_by_mismatch/);
  });

  it('3. Caller sans can_invite (member simple sans rôle Owner) → 403 permission_denied', async () => {
    const { status, body } = await callEdge(ctx.memberJwt, {
      email: `new-${rid()}@magrit.test`,
      tenant_id: ctx.tenantId,
      invited_by: ctx.memberId,
      baseUrl: ctx.baseUrl,
    });
    expect(status).toBe(403);
    expect(body.error).toMatch(/permission_denied/);
  });

  it('4. role_definition_ids cross-tenant → 403 role_mismatch_tenant', async () => {
    const { status, body } = await callEdge(ctx.ownerJwt, {
      email: `new-${rid()}@magrit.test`,
      tenant_id: ctx.tenantId,
      invited_by: ctx.ownerId,
      role_definition_ids: [ctx.otherRoleId], // FORGED — role d un autre tenant
      baseUrl: ctx.baseUrl,
    });
    expect(status).toBe(403);
    expect(body.error).toMatch(/role_mismatch_tenant/);
  });

  it('5. Happy path : owner avec can_invite + role tenant valide → 200', async () => {
    const targetEmail = `happy-${rid()}@magrit.test`;
    const { status, body } = await callEdge(ctx.ownerJwt, {
      email: targetEmail,
      tenant_id: ctx.tenantId,
      invited_by: ctx.ownerId,
      role_definition_ids: [ctx.acheteurRoleId],
      baseUrl: ctx.baseUrl,
    });
    expect([200]).toContain(status);
    expect(body.ok).toBe(true);
    expect(body.invitationId).toBeTruthy();
  });

  it('6. Idempotence : 2e invitation pending même email/tenant → 409 duplicate_pending', async () => {
    const targetEmail = `dup-${rid()}@magrit.test`;
    // 1ère invitation OK
    const { status: s1 } = await callEdge(ctx.ownerJwt, {
      email: targetEmail,
      tenant_id: ctx.tenantId,
      invited_by: ctx.ownerId,
      role_definition_ids: [ctx.acheteurRoleId],
      baseUrl: ctx.baseUrl,
    });
    expect(s1).toBe(200);

    // 2e invitation = duplicate → 409
    const { status: s2, body: b2 } = await callEdge(ctx.ownerJwt, {
      email: targetEmail,
      tenant_id: ctx.tenantId,
      invited_by: ctx.ownerId,
      role_definition_ids: [ctx.acheteurRoleId],
      baseUrl: ctx.baseUrl,
    });
    expect(s2).toBe(409);
    expect(b2.error).toMatch(/duplicate_pending/);
    expect(b2.existing_invitation_id).toBeTruthy();
  });
});
