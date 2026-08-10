import { describe, expect, it, vi } from 'vitest';
import { appError, err, ok, parseId, type ActorContext } from '../../src/kernel';
import {
  clariprintDataCapabilities,
  clariprintDataFeature,
  requireClariprintDataModuleAccess,
} from '../../src/modules/clariprint-data';
import type {
  AccessError,
  AccessService,
  EntitlementError,
  EntitlementService,
} from '../../src/platform';

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

function dependencies() {
  const access: AccessService = {
    can: vi.fn(),
    require: vi.fn().mockResolvedValue(ok(undefined)),
    listCapabilities: vi.fn(),
  };
  const entitlements: EntitlementService = {
    hasFeature: vi.fn(),
    requireFeature: vi.fn().mockResolvedValue(ok(undefined)),
    getLimit: vi.fn(),
    consume: vi.fn(),
  };

  return { access, entitlements };
}

describe('Clariprint Data module access', () => {
  it('requires both the feature and the module capability', async () => {
    const services = dependencies();

    await expect(requireClariprintDataModuleAccess(actor, services)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(services.entitlements.requireFeature).toHaveBeenCalledWith(
      actor.tenantId,
      clariprintDataFeature,
    );
    expect(services.access.require).toHaveBeenCalledWith(
      actor,
      clariprintDataCapabilities.moduleAccess,
    );
  });

  it('stops before capability evaluation when the feature is unavailable', async () => {
    const services = dependencies();
    const unavailable = appError(
      'entitlement.feature_unavailable',
      'Clariprint Data is not enabled for this tenant.',
    ) as EntitlementError;
    vi.mocked(services.entitlements.requireFeature).mockResolvedValue(err(unavailable));

    await expect(requireClariprintDataModuleAccess(actor, services)).resolves.toEqual({
      ok: false,
      error: unavailable,
    });
    expect(services.access.require).not.toHaveBeenCalled();
  });

  it('returns an explicit error when the capability is missing', async () => {
    const services = dependencies();
    const forbidden = appError(
      'access.missing_capability',
      'The actor cannot access Clariprint Data.',
    ) as AccessError;
    vi.mocked(services.access.require).mockResolvedValue(err(forbidden));

    await expect(requireClariprintDataModuleAccess(actor, services)).resolves.toEqual({
      ok: false,
      error: forbidden,
    });
  });
});
