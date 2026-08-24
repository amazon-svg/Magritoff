import { describe, expect, it } from 'vitest';
import type { UserAccessProfile } from '../../src/modules/roles';
import { normalizeWorkspaceCapability, resolveCapability } from '../../src/app/contexts/accessProfile.helpers';

const member: UserAccessProfile = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  membership: 'member',
  isAdmin: false,
  surfaces: ['workspace'],
  capabilities: ['can_manage_shops'],
};

describe('resolveCapability', () => {
  it('accorde tout aux admins et super admins', () => {
    expect(resolveCapability({ ...member, membership: 'admin', isAdmin: true }, false, false, 'unknown')).toBe(true);
    expect(resolveCapability(null, true, true, 'unknown')).toBe(true);
  });

  it('retourne null pendant le chargement et false sans profil', () => {
    expect(resolveCapability(member, true, false, 'can_manage_shops')).toBeNull();
    expect(resolveCapability(null, false, false, 'can_manage_shops')).toBe(false);
  });

  it('résout les capabilities produit et leurs alias de surface', () => {
    expect(normalizeWorkspaceCapability('shops.manage')).toBe('can_manage_shops');
    expect(resolveCapability(member, false, false, 'shops.manage')).toBe(true);
    expect(resolveCapability(member, false, false, 'orders.read.tenant')).toBe(false);
  });
});
