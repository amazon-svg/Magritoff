import { describe, expect, it, vi } from 'vitest';
import { parseId, type ActorContext } from '../../src/kernel';
import {
  SupabaseAccessService,
  SupabaseTenantSettingsEntitlementService,
} from '../../src/platform/infrastructure/supabase';

function id<Name extends string>(value: string) {
  const parsed = parseId<Name>(value);
  if (!parsed.ok) throw new Error('Invalid test identifier.');
  return parsed.value;
}

const actor: ActorContext = {
  kind: 'user',
  userId: id<'UserId'>('user-1'),
  tenantId: id<'TenantId'>('tenant-a'),
  requestId: id<'RequestId'>('request-1'),
};

function accessClient(options: {
  capability?: boolean | null;
  rpcError?: { message: string } | null;
  assignments?: readonly unknown[];
  assignmentError?: { message: string } | null;
}) {
  const assignmentResult = {
    data: options.assignments ?? [],
    error: options.assignmentError ?? null,
  };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    then: (resolve: (value: typeof assignmentResult) => unknown) =>
      Promise.resolve(assignmentResult).then(resolve),
  };

  return {
    rpc: vi.fn().mockResolvedValue({
      data: options.capability ?? false,
      error: options.rpcError ?? null,
    }),
    from: vi.fn(() => query),
  };
}

function entitlementClient(result: {
  data: { settings: unknown } | null;
  error: { message: string } | null;
}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return { from: vi.fn(() => query) };
}

describe('SupabaseAccessService', () => {
  it('delegates capability evaluation to the existing RPC', async () => {
    const client = accessClient({ capability: true });
    const service = new SupabaseAccessService(client as never);

    await expect(service.require(actor, 'clariprint_data.module.access')).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(client.rpc).toHaveBeenCalledWith('user_has_capability', {
      p_tenant_id: actor.tenantId,
      p_capability: 'clariprint_data.module.access',
    });
  });

  it('fails closed when the capability is absent', async () => {
    const service = new SupabaseAccessService(accessClient({ capability: false }) as never);

    await expect(service.require(actor, 'clariprint_data.module.access')).resolves.toMatchObject({
      ok: false,
      error: { code: 'access.missing_capability', retryable: false },
    });
  });

  it('does not query Supabase for a resource from another tenant', async () => {
    const client = accessClient({ capability: true });
    const service = new SupabaseAccessService(client as never);

    await expect(
      service.require(actor, 'clariprint_data.supplier.read', {
        type: 'supplier',
        id: 'supplier-1',
        tenantId: id<'TenantId'>('tenant-b'),
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'access.wrong_tenant' },
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('exposes a stable retryable error when the RPC is unavailable', async () => {
    const service = new SupabaseAccessService(
      accessClient({ capability: null, rpcError: { message: 'internal database detail' } }) as never,
    );

    await expect(service.require(actor, 'clariprint_data.module.access')).resolves.toMatchObject({
      ok: false,
      error: { code: 'access.provider_unavailable', retryable: true },
    });
    await expect(service.can(actor, 'clariprint_data.module.access')).resolves.toEqual({
      allowed: false,
      reason: 'provider_unavailable',
    });
  });

  it('merges enabled capabilities from active tenant roles', async () => {
    const client = accessClient({
      assignments: [
        {
          tenant_role_definitions: {
            tenant_id: 'tenant-a',
            archived_at: null,
            capabilities: { can_quote: true, can_order: false },
          },
        },
        {
          tenant_role_definitions: {
            tenant_id: 'tenant-a',
            archived_at: null,
            capabilities: { can_quote: true, clariprint_data: true },
          },
        },
      ],
    });
    const service = new SupabaseAccessService(client as never);

    await expect(service.listCapabilities(actor)).resolves.toEqual({
      ok: true,
      value: ['can_quote', 'clariprint_data'],
    });
  });
});

describe('SupabaseTenantSettingsEntitlementService', () => {
  it('reads an explicitly enabled pilot feature', async () => {
    const client = entitlementClient({
      data: { settings: { features: { 'clariprint_data.enabled': true } } },
      error: null,
    });
    const service = new SupabaseTenantSettingsEntitlementService(client as never);

    await expect(
      service.requireFeature(actor.tenantId, 'clariprint_data.enabled'),
    ).resolves.toEqual({ ok: true, value: undefined });
  });

  it('denies an absent or malformed feature by default', async () => {
    const service = new SupabaseTenantSettingsEntitlementService(
      entitlementClient({ data: { settings: {} }, error: null }) as never,
    );

    await expect(
      service.requireFeature(actor.tenantId, 'clariprint_data.enabled'),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'entitlement.feature_unavailable', retryable: false },
    });
  });

  it('does not turn a database error into an absent feature', async () => {
    const service = new SupabaseTenantSettingsEntitlementService(
      entitlementClient({ data: null, error: { message: 'RLS or network failure' } }) as never,
    );

    await expect(
      service.hasFeature(actor.tenantId, 'clariprint_data.enabled'),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'entitlement.provider_unavailable', retryable: true },
    });
  });

  it('reads quotas but refuses non-atomic consumption in the pilot adapter', async () => {
    const service = new SupabaseTenantSettingsEntitlementService(
      entitlementClient({ data: { settings: { quotas: { suppliers: 25 } } }, error: null }) as never,
    );

    await expect(service.getLimit(actor.tenantId, 'suppliers')).resolves.toEqual({
      ok: true,
      value: 25,
    });
    await expect(service.consume(actor.tenantId, 'suppliers', 1)).resolves.toMatchObject({
      ok: false,
      error: { code: 'entitlement.provider_unavailable' },
    });
  });
});
