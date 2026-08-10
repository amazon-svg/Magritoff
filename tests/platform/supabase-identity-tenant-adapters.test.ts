import { describe, expect, it, vi } from 'vitest';
import { fixedClock, parseId } from '../../src/kernel';
import {
  SupabaseIdentityService,
  SupabaseTenantService,
} from '../../src/platform/infrastructure/supabase';

function id<Name extends string>(value: string) {
  const parsed = parseId<Name>(value);
  if (!parsed.ok) throw new Error('Invalid test identifier.');
  return parsed.value;
}

function supabaseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'user@example.test',
    user_metadata: { full_name: '  Test User  ' },
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function identityClient(options: {
  currentUser?: ReturnType<typeof supabaseUser> | null;
  currentError?: Record<string, unknown> | null;
  lookupUser?: ReturnType<typeof supabaseUser> | null;
  lookupError?: Record<string, unknown> | null;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.currentUser ?? null },
        error: options.currentError ?? null,
      }),
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: options.lookupUser ?? null },
          error: options.lookupError ?? null,
        }),
      },
    },
  };
}

type QueryResult = Readonly<{
  data: unknown;
  error: { message: string } | null;
}>;

function tenantClient(results: readonly QueryResult[]) {
  const queue = [...results];
  const from = vi.fn(() => {
    const result = queue.shift() ?? { data: null, error: { message: 'Unexpected query' } };
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue(result),
      then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  });
  return { from };
}

describe('SupabaseIdentityService', () => {
  const clock = fixedClock('2026-08-10T12:00:00.000Z');

  it('validates a token and maps Supabase user data to the public identity', async () => {
    const client = identityClient({ currentUser: supabaseUser() });
    const service = new SupabaseIdentityService(client as never, clock);

    await expect(service.verifyToken('valid-token')).resolves.toEqual({
      ok: true,
      value: {
        authenticatedAt: '2026-08-10T12:00:00.000Z',
        identity: {
          id: 'user-1',
          email: 'user@example.test',
          displayName: 'Test User',
          status: 'active',
        },
      },
    });
    expect(client.auth.getUser).toHaveBeenCalledWith('valid-token');
  });

  it('rejects an empty token without contacting Supabase', async () => {
    const client = identityClient({});
    const service = new SupabaseIdentityService(client as never, clock);

    await expect(service.verifyToken('   ')).resolves.toMatchObject({
      ok: false,
      error: { code: 'identity.invalid_token', retryable: false },
    });
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it('normalizes provider authentication failures without exposing their message', async () => {
    const client = identityClient({
      currentError: { status: 401, code: 'bad_jwt', message: 'sensitive provider detail' },
    });
    const service = new SupabaseIdentityService(client as never, clock);

    await expect(service.verifyToken('expired-token')).resolves.toMatchObject({
      ok: false,
      error: { code: 'identity.invalid_token', retryable: false },
    });
  });

  it('refuses a user whose ban is still active', async () => {
    const client = identityClient({
      currentUser: supabaseUser({ banned_until: '2026-08-11T12:00:00.000Z' }),
    });
    const service = new SupabaseIdentityService(client as never, clock);

    await expect(service.verifyToken('valid-token')).resolves.toMatchObject({
      ok: false,
      error: { code: 'identity.disabled' },
    });
  });

  it('uses the server-only admin lookup and maps a missing identity to null', async () => {
    const client = identityClient({
      lookupError: { status: 404, code: 'user_not_found', message: 'not found' },
    });
    const service = new SupabaseIdentityService(client as never, clock);

    await expect(service.getIdentity(id<'UserId'>('user-404'))).resolves.toEqual({
      ok: true,
      value: null,
    });
  });
});

describe('SupabaseTenantService', () => {
  it('resolves an existing direct membership', async () => {
    const client = tenantClient([
      { data: { user_id: 'user-1', tenant_id: 'tenant-a' }, error: null },
    ]);
    const service = new SupabaseTenantService(client as never);

    await expect(
      service.requireMembership(id<'UserId'>('user-1'), id<'TenantId'>('tenant-a')),
    ).resolves.toEqual({
      ok: true,
      value: { userId: 'user-1', tenantId: 'tenant-a', status: 'active' },
    });
  });

  it('returns an explicit denial when no direct membership exists', async () => {
    const service = new SupabaseTenantService(
      tenantClient([{ data: null, error: null }]) as never,
    );

    await expect(
      service.requireMembership(id<'UserId'>('user-1'), id<'TenantId'>('tenant-a')),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'tenant.not_a_member', retryable: false },
    });
  });

  it('lists only the membership rows returned through RLS', async () => {
    const service = new SupabaseTenantService(
      tenantClient([
        {
          data: [
            { user_id: 'user-1', tenant_id: 'tenant-a' },
            { user_id: 'user-1', tenant_id: 'tenant-b' },
          ],
          error: null,
        },
      ]) as never,
    );

    await expect(service.listMemberships(id<'UserId'>('user-1'))).resolves.toEqual({
      ok: true,
      value: [
        { userId: 'user-1', tenantId: 'tenant-a', status: 'active' },
        { userId: 'user-1', tenantId: 'tenant-b', status: 'active' },
      ],
    });
  });

  it('maps a two-level hierarchy without leaking database rows', async () => {
    const service = new SupabaseTenantService(
      tenantClient([
        {
          data: { id: 'tenant-child', name: 'Child', parent_tenant_id: 'tenant-parent' },
          error: null,
        },
        { data: [{ id: 'tenant-grandchild' }], error: null },
      ]) as never,
    );

    await expect(service.getHierarchy(id<'TenantId'>('tenant-child'))).resolves.toEqual({
      ok: true,
      value: {
        tenant: { id: 'tenant-child', name: 'Child', status: 'active' },
        parentId: 'tenant-parent',
        children: ['tenant-grandchild'],
      },
    });
  });

  it('keeps database failures distinct from an absent membership', async () => {
    const service = new SupabaseTenantService(
      tenantClient([{ data: null, error: { message: 'RLS failure detail' } }]) as never,
    );

    await expect(
      service.resolveMembership(id<'UserId'>('user-1'), id<'TenantId'>('tenant-a')),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'tenant.provider_unavailable', retryable: true },
    });
  });
});
