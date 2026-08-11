import { describe, expect, it, vi } from 'vitest';
import { ok, parseId } from '../../src/kernel';
import {
  canonicalCapabilityNames,
  LegacyMappedAccessService,
} from '../../src/modules/access-management/infrastructure';
import type { AccessService } from '../../src/platform';

function id<Name extends string>(value: string) {
  const parsed = parseId<Name>(value);
  if (!parsed.ok) throw new Error('Invalid identifier.');
  return parsed.value;
}

const actor = {
  kind: 'user' as const,
  userId: id<'UserId'>('33333333-3333-4333-8333-333333333333'),
  tenantId: id<'TenantId'>('11111111-1111-4111-8111-111111111111'),
  requestId: id<'RequestId'>('request-legacy'),
};

describe('legacy capability anti-corruption mapping', () => {
  it('expands historical capabilities into canonical names', () => {
    expect(canonicalCapabilityNames({
      can_manage_roles: true,
      can_quote: true,
      can_order: false,
      'clariprint_data.module.access': true,
    })).toEqual([
      'access_management.access.read',
      'access_management.assignments.manage',
      'access_management.assignments.read',
      'access_management.audit.read',
      'access_management.roles.manage',
      'access_management.roles.read',
      'clariprint_data.module.access',
      'quotes.quote.create',
    ]);
  });

  it('translates canonical authorization checks before calling the legacy provider', async () => {
    const delegate: AccessService = {
      can: vi.fn().mockResolvedValue({ allowed: true, reason: 'role' }),
      require: vi.fn().mockResolvedValue(ok(undefined)),
      listCapabilities: vi.fn().mockResolvedValue(ok(['can_manage_roles'])),
    };
    const service = new LegacyMappedAccessService(delegate);
    await service.require(actor, 'access_management.roles.read');
    expect(delegate.require).toHaveBeenCalledWith(actor, 'can_manage_roles', undefined);
    await expect(service.listCapabilities(actor)).resolves.toMatchObject({
      ok: true,
      value: expect.arrayContaining([
        'access_management.roles.read',
        'access_management.assignments.manage',
      ]),
    });
  });
});

