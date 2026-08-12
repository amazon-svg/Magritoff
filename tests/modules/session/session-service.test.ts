import { describe, expect, it, vi } from 'vitest';
import { parseId, type UserId } from '../../../src/kernel';
import {
  SessionService,
  SessionTenantAccessDeniedError,
  type DirectMembership,
  type SessionRepository,
} from '../../../src/modules/session';

const userId = id('user-af2');

describe('SessionService', () => {
  it('agrège les tenants directs, les enfants hérités et les préférences', async () => {
    const owner = membership('root', 'owner', 'magrit_full', true);
    const child = tenant('child', 'root');
    const repository = repositoryStub({ direct: [owner], children: [child] });

    const result = await new SessionService(repository).load(userId);

    expect(repository.autoAcceptPendingInvitations).toHaveBeenCalledOnce();
    expect(repository.listChildren).toHaveBeenCalledWith(['root']);
    expect(result.isSuperAdmin).toBe(true);
    expect(result.tenants).toEqual([
      expect.objectContaining({ id: 'root', inheritedFromParent: false, myRole: 'owner' }),
      expect.objectContaining({
        id: 'child',
        inheritedFromParent: true,
        myRole: 'owner',
        accessScope: 'magrit_full',
        permissions: expect.objectContaining({ can_invite: true }),
      }),
    ]);
    expect(result.preferences).toMatchObject({ theme: 'dark', last_tenant_id: 'child' });
  });

  it.each([
    ['member', 'magrit_full'],
    ['partner', 'magrit_full'],
    ['owner', 'shop_only'],
  ] as const)('n hérite pas avec le rôle %s et le scope %s', async (role, scope) => {
    const repository = repositoryStub({ direct: [membership('root', role, scope)] });

    const result = await new SessionService(repository).load(userId);

    expect(repository.listChildren).not.toHaveBeenCalled();
    expect(result.tenants).toHaveLength(1);
  });

  it('déduplique un enfant déjà accessible directement', async () => {
    const repository = repositoryStub({
      direct: [
        membership('root', 'admin', 'magrit_full'),
        membership('child', 'member', 'magrit_full'),
      ],
      children: [tenant('child', 'root')],
    });

    const result = await new SessionService(repository).load(userId);

    expect(result.tenants.map(({ id }) => id)).toEqual(['root', 'child']);
    expect(result.tenants[1]).toMatchObject({ inheritedFromParent: false, myRole: 'member' });
  });

  it('refuse de mémoriser un tenant hors de la session', async () => {
    const repository = repositoryStub({ direct: [membership('root', 'owner', 'magrit_full')] });

    await expect(new SessionService(repository).updateLastTenant(userId, 'stranger')).rejects.toBeInstanceOf(
      SessionTenantAccessDeniedError,
    );
    expect(repository.updateLastTenant).not.toHaveBeenCalled();
  });
});

function repositoryStub(options: {
  direct?: DirectMembership[];
  children?: ReturnType<typeof tenant>[];
} = {}): SessionRepository & Record<'listChildren' | 'autoAcceptPendingInvitations', ReturnType<typeof vi.fn>> {
  return {
    autoAcceptPendingInvitations: vi.fn(async () => undefined),
    listDirectMemberships: vi.fn(async () => options.direct ?? []),
    listChildren: vi.fn(async () => options.children ?? []),
    getPreferences: vi.fn(async () => ({ theme: 'dark', last_tenant_id: 'child' })),
    updatePreferences: vi.fn(async (_userId, patch) => patch),
    updateLastTenant: vi.fn(async (_userId, tenantId) => ({ last_tenant_id: tenantId })),
    updateTenantSettings: vi.fn(async () => undefined),
    subTenantsDashboard: vi.fn(async () => ({ subTenants: [], kpis: [] })),
    createSubTenant: vi.fn(async () => 'subtenant-af15'),
    removeSubTenant: vi.fn(async () => undefined),
  };
}

function membership(
  tenantId: string,
  role: DirectMembership['role'],
  accessScope: DirectMembership['accessScope'],
  system = false,
): DirectMembership {
  return {
    tenant: tenant(tenantId),
    role,
    accessScope,
    allowedShopIds: accessScope === 'shop_only' ? ['shop-1'] : [],
    permissions: {},
    ...(system ? { tenant: { ...tenant(tenantId), is_system_tenant: true } } : {}),
  };
}

function tenant(id: string, parentId: string | null = null) {
  return {
    id,
    slug: id,
    name: id,
    parent_tenant_id: parentId,
    plan: 'freemium' as const,
    is_system_tenant: false,
    settings: {},
    created_at: '2026-08-11T12:00:00.000Z',
    tax_regime: 'metropole_fr',
  };
}

function id(value: string): UserId {
  const parsed = parseId<'UserId'>(value);
  if (!parsed.ok) throw new Error('ID de test invalide');
  return parsed.value;
}
