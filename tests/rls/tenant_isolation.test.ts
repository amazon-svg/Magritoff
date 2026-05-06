/**
 * E9.10 — Tests RLS d etancheite multi-tenant.
 *
 * Verifie qu un user authentifie ne peut PAS lire ni modifier les donnees
 * d un autre tenant via l API anon Supabase. Couvre les tables ajoutees /
 * modifiees au Sprint 1 (tenant_members, tenant_invitations, llm_usage_events,
 * tenant_member_events, tenant_slug_history).
 *
 * Lancer : pnpm test (necessite .env.test avec SUPABASE_URL +
 * SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapHarness, RlsHarness, SKIP_REASON } from './setup';

const describeIfCreds = SKIP_REASON ? describe.skip : describe;

describeIfCreds('RLS tenant isolation (E9.10)', () => {
  let h: RlsHarness;

  beforeAll(async () => {
    h = await bootstrapHarness();
  }, 30_000);

  afterAll(async () => {
    if (h) await h.cleanup();
  });

  it('user A ne lit pas les memberships du tenant B', async () => {
    const { data, error } = await h.anonA
      .from('tenant_members')
      .select('user_id, tenant_id, role')
      .eq('tenant_id', h.tenantB.id);
    // RLS doit retourner zero ligne (pas une erreur explicite)
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('user A ne lit pas les invitations du tenant B', async () => {
    // Cree une invitation cote B via service_role
    await h.admin.from('tenant_invitations').insert({
      tenant_id: h.tenantB.id,
      email: 'invitee@example.test',
      role: 'member',
      token: 'rlstest-' + Date.now(),
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      invited_by: h.userB.id,
      access_scope: 'magrit_full',
      allowed_shop_ids: [],
      permissions: { can_quote: true, can_order: true, can_invite: false },
    });
    const { data, error } = await h.anonA
      .from('tenant_invitations')
      .select('id, email, tenant_id')
      .eq('tenant_id', h.tenantB.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('user A ne peut pas creer une invitation dans le tenant B', async () => {
    const { error } = await h.anonA.from('tenant_invitations').insert({
      tenant_id: h.tenantB.id,
      email: 'rls-attack@example.test',
      role: 'admin',
      token: 'attack-' + Date.now(),
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      invited_by: h.userA.id,
      access_scope: 'magrit_full',
      allowed_shop_ids: [],
      permissions: { can_quote: true, can_order: true, can_invite: true },
    });
    expect(error).not.toBeNull();
  });

  it('user A ne peut pas renommer le tenant B', async () => {
    const { error } = await h.anonA
      .from('tenants')
      .update({ name: 'PWNED' })
      .eq('id', h.tenantB.id);
    // Soit erreur RLS, soit zero ligne affectee : on accepte les deux
    if (!error) {
      const { data: tCheck } = await h.admin
        .from('tenants')
        .select('name')
        .eq('id', h.tenantB.id)
        .single();
      expect(tCheck?.name).not.toBe('PWNED');
    }
  });

  it('user A ne lit pas les llm_usage_events du tenant B', async () => {
    await h.admin.from('llm_usage_events').insert({
      user_id: h.userB.id,
      tenant_id: h.tenantB.id,
      endpoint: 'rls-test',
      model: 'claude-sonnet-4-20250514',
      input_tokens: 100,
      output_tokens: 50,
      metadata: {},
    });
    const { data, error } = await h.anonA
      .from('llm_usage_events')
      .select('id, tenant_id')
      .eq('tenant_id', h.tenantB.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('user A voit ses propres memberships', async () => {
    const { data, error } = await h.anonA
      .from('tenant_members')
      .select('tenant_id, role')
      .eq('user_id', h.userA.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
    expect(data?.[0]?.tenant_id).toBe(h.tenantA.id);
  });
});
