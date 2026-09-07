import { describe, expect, it } from 'vitest';
import type { UserAccessProfile } from '@/modules/roles';
import { normalizeWorkspaceCapability, resolveCapability } from '@/modules/roles/ui/runtime/accessProfile.helpers';

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

  it('E10.11 — un membre NON-ADMIN porteur de can_manage_pricing voit la garde accordée, sans alias (piège §8.11 s3)', () => {
    // `pricing/manifest.ts` déclare directement `can_manage_pricing` (nom
    // canonique de la base), pas un identifiant pointé qui exigerait une
    // entrée dans WORKSPACE_CAPABILITY_ALIASES : `normalizeWorkspaceCapability`
    // doit donc le laisser inchangé, et un membre SANS `isAdmin` mais dont
    // `capabilities` le porte doit passer la garde — pas seulement un admin,
    // qui passerait de toute façon par dérivation (le défaut invisible que
    // §8.11 s3 met en garde).
    const memberWithPricing: UserAccessProfile = {
      ...member,
      membership: 'member',
      isAdmin: false,
      capabilities: ['can_manage_pricing'],
    };
    expect(normalizeWorkspaceCapability('can_manage_pricing')).toBe('can_manage_pricing');
    expect(resolveCapability(memberWithPricing, false, false, 'can_manage_pricing')).toBe(true);

    const memberWithoutPricing: UserAccessProfile = {
      ...member,
      membership: 'member',
      isAdmin: false,
      capabilities: ['can_manage_shops'],
    };
    expect(resolveCapability(memberWithoutPricing, false, false, 'can_manage_pricing')).toBe(false);
  });
});
