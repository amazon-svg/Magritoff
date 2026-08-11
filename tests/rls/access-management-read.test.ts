import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import '../_loadEnv';
import { handleAccessManagementRequest } from '../../src/modules/access-management/infrastructure';
import { createAccessManagementServices } from '../../src/server/access-management';

const skipReason = (() => {
  if (!process.env.SUPABASE_URL) return 'SUPABASE_URL absent';
  if (!process.env.SUPABASE_ANON_KEY) return 'SUPABASE_ANON_KEY absent';
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 'SUPABASE_SERVICE_ROLE_KEY absent';
  return null;
})();

type Context = {
  admin: SupabaseClient;
  anonKey: string;
  url: string;
  tenantA: string;
  tenantB: string;
  userA: string;
  userB: string;
  tokenA: string;
  tokenB: string;
  cleanup: () => Promise<void>;
};

const context = {} as Context;
const randomId = () => Math.random().toString(36).slice(2, 10);

describe.skipIf(skipReason !== null)('access-management read API RLS', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const tag = randomId();
    const password = `access-${tag}-${randomId()}`;
    const emailA = `access-a-${tag}@magrit.test`;
    const emailB = `access-b-${tag}@magrit.test`;
    const { data: identityA, error: identityAError } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    const { data: identityB, error: identityBError } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (identityAError || identityBError || !identityA.user || !identityB.user) {
      throw identityAError ?? identityBError ?? new Error('Test identities were not created.');
    }

    const { data: tenants, error: tenantError } = await admin.from('tenants').insert([
      {
        slug: `access-a-${tag}`,
        name: `Access A ${tag}`,
        settings: { features: { 'clariprint_data.enabled': true } },
      },
      {
        slug: `access-b-${tag}`,
        name: `Access B ${tag}`,
        settings: { features: { 'clariprint_data.enabled': true } },
      },
    ]).select('id').order('id');
    if (tenantError || !tenants || tenants.length !== 2) {
      throw tenantError ?? new Error('Test tenants were not created.');
    }
    const tenantA = tenants[0]!.id;
    const tenantB = tenants[1]!.id;
    await admin.from('tenant_members').insert([
      { tenant_id: tenantA, user_id: identityA.user.id, role: 'owner' },
      { tenant_id: tenantB, user_id: identityB.user.id, role: 'owner' },
    ]);
    const { data: ownerRoles } = await admin.from('tenant_role_definitions')
      .select('id, tenant_id')
      .in('tenant_id', [tenantA, tenantB])
      .eq('name', 'Owner');
    const roleA = ownerRoles?.find((role) => role.tenant_id === tenantA);
    const roleB = ownerRoles?.find((role) => role.tenant_id === tenantB);
    if (!roleA || !roleB) throw new Error('Owner roles were not seeded.');
    await admin.from('tenant_role_assignments').insert([
      { role_definition_id: roleA.id, user_id: identityA.user.id },
      { role_definition_id: roleB.id, user_id: identityB.user.id },
    ]);

    const authA = createClient(url, anonKey, { auth: { persistSession: false } });
    const authB = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: sessionA } = await authA.auth.signInWithPassword({ email: emailA, password });
    const { data: sessionB } = await authB.auth.signInWithPassword({ email: emailB, password });
    if (!sessionA.session || !sessionB.session) throw new Error('Test sessions were not created.');

    Object.assign(context, {
      admin,
      anonKey,
      url,
      tenantA,
      tenantB,
      userA: identityA.user.id,
      userB: identityB.user.id,
      tokenA: sessionA.session.access_token,
      tokenB: sessionB.session.access_token,
      cleanup: async () => {
        await admin.from('tenant_role_assignments').delete().in('role_definition_id', [roleA.id, roleB.id]);
        await admin.from('tenant_order_status_transitions').delete().in('tenant_id', [tenantA, tenantB]);
        await admin.from('tenant_order_status_definitions').delete().in('tenant_id', [tenantA, tenantB]);
        await admin.from('tenant_role_definitions').delete().in('tenant_id', [tenantA, tenantB]);
        await admin.from('tenant_members').delete().in('tenant_id', [tenantA, tenantB]);
        await admin.from('tenants').delete().in('id', [tenantA, tenantB]);
        await admin.auth.admin.deleteUser(identityA.user.id);
        await admin.auth.admin.deleteUser(identityB.user.id);
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (context.cleanup) await context.cleanup();
  });

  async function call(token: string, tenantId: string, resource: string) {
    const client = createClient(context.url, context.anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    return handleAccessManagementRequest(
      new Request(
        `https://api.example.test/api/v1/tenants/${tenantId}/access/${resource}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
      createAccessManagementServices(client),
    );
  }

  it('allows a member to resolve access in its own tenant', async () => {
    const response = await call(context.tokenA, context.tenantA, 'me');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      tenantId: context.tenantA,
      userId: context.userA,
      membership: 'active',
    });
  });

  it('does not disclose another tenant through the API', async () => {
    const response = await call(context.tokenA, context.tenantB, 'roles');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'tenant.not_a_member' },
    });
  });

  it('maps the historical Owner role to the canonical administration capability', async () => {
    const response = await call(context.tokenB, context.tenantB, 'roles');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ name: 'Owner', status: 'active' }),
      ]),
    });
  });
});

