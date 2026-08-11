import { describe, expect, it, vi } from 'vitest';
import { ok, parseId } from '../../src/kernel';
import { AccessManagementQueries } from '../../src/modules/access-management/application';
import type {
  AccessManagementReadRepository,
  CapabilityCatalog,
  ModuleCatalog,
} from '../../src/modules/access-management/application';
import type { AccessService, EntitlementService } from '../../src/platform';

function id<Name extends string>(value: string) {
  const parsed = parseId<Name>(value);
  if (!parsed.ok) throw new Error('Invalid identifier.');
  return parsed.value;
}

const actor = {
  kind: 'user' as const,
  userId: id<'UserId'>('33333333-3333-4333-8333-333333333333'),
  tenantId: id<'TenantId'>('11111111-1111-4111-8111-111111111111'),
  requestId: id<'RequestId'>('request-1'),
};

function dependencies(options: { enabled?: boolean; allowed?: boolean } = {}) {
  const access: AccessService = {
    can: vi.fn().mockResolvedValue(
      options.allowed === false
        ? { allowed: false, reason: 'missing_capability' }
        : { allowed: true, reason: 'role' },
    ),
    require: vi.fn().mockResolvedValue(ok(undefined)),
    listCapabilities: vi.fn().mockResolvedValue(ok(['clariprint_data.module.access'])),
  };
  const entitlements: EntitlementService = {
    hasFeature: vi.fn().mockResolvedValue(ok(options.enabled !== false)),
    requireFeature: vi.fn(),
    getLimit: vi.fn(),
    consume: vi.fn(),
  };
  const repository: AccessManagementReadRepository = {
    listRoles: vi.fn().mockResolvedValue(ok([])),
    getRole: vi.fn().mockResolvedValue(ok(null)),
    listMemberAssignments: vi.fn().mockResolvedValue(ok([])),
  };
  const capabilities: CapabilityCatalog = { list: () => [] };
  const modules: ModuleCatalog = {
    list: () => [{
      moduleKey: 'clariprint_data',
      feature: 'clariprint_data.enabled',
      accessCapability: 'clariprint_data.module.access',
      capabilities: [],
    }],
  };
  return { access, entitlements, repository, capabilities, modules };
}

describe('AccessManagementQueries', () => {
  it('keeps entitlement and capability as distinct module decisions', async () => {
    const disabledDeps = dependencies({ enabled: false });
    const disabled = await new AccessManagementQueries(disabledDeps).getMyTenantAccess(actor);
    expect(disabled).toMatchObject({
      ok: true,
      value: {
        modules: [{ enabled: false, accessible: false, reason: 'feature_disabled' }],
      },
    });
    expect(disabledDeps.access.can).not.toHaveBeenCalled();

    const deniedDeps = dependencies({ allowed: false });
    const denied = await new AccessManagementQueries(deniedDeps).getMyTenantAccess(actor);
    expect(denied).toMatchObject({
      ok: true,
      value: {
        modules: [{ enabled: true, accessible: false, reason: 'missing_capability' }],
      },
    });
  });

  it('returns effective capabilities and an accessible module', async () => {
    const deps = dependencies();
    const result = await new AccessManagementQueries(deps).getMyTenantAccess(actor);
    expect(result).toEqual(ok({
      tenantId: actor.tenantId,
      userId: actor.userId,
      membership: 'active',
      capabilities: ['clariprint_data.module.access'],
      modules: [{
        moduleKey: 'clariprint_data',
        enabled: true,
        accessible: true,
        reason: 'available',
      }],
    }));
  });

  it('authorizes administrative projections before loading the repository', async () => {
    const deps = dependencies();
    const queries = new AccessManagementQueries(deps);
    await expect(queries.listRoles(actor)).resolves.toEqual(ok([]));
    expect(deps.access.require).toHaveBeenCalledWith(
      actor,
      'access_management.roles.read',
    );
    expect(deps.repository.listRoles).toHaveBeenCalledWith(actor.tenantId, 'active');
  });
});
