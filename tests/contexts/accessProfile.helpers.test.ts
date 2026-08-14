/**
 * UM2 — décision d affichage d une capability depuis le profil d accès.
 * Doit reproduire la sémantique serveur de `user_has_capability`.
 */

import { describe, expect, it } from 'vitest';
import { resolveCapability } from '../../src/app/contexts/accessProfile.helpers';
import type { UserAccessProfile } from '../../src/modules/roles';

const base: UserAccessProfile = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  membership: 'member',
  isAdmin: false,
  surfaces: ['workspace'],
  allowedShopIds: [],
  capabilities: ['can_validate', 'can_export'],
};

describe('resolveCapability', () => {
  it('accorde tout au super admin, même sans profil chargé', () => {
    expect(resolveCapability(null, true, true, 'can_validate')).toBe(true);
    expect(resolveCapability(null, false, true, 'can_anything')).toBe(true);
  });

  it('reste indécis pendant le chargement, jamais faussement négatif', () => {
    // Un null pendant le chargement évite qu un bouton légitime clignote
    // (caché puis montré) — les écrans testent `loading` explicitement.
    expect(resolveCapability(null, true, false, 'can_validate')).toBeNull();
  });

  it('refuse sans profil : hors espace, la réponse est non', () => {
    expect(resolveCapability(null, false, false, 'can_validate')).toBe(false);
  });

  it('accorde à l admin toute capability, même absente du catalogue', () => {
    // Même sémantique que le serveur : l admin porte tout, y compris une
    // capability que le catalogue de l espace ne déclare pas.
    const admin = { ...base, membership: 'admin' as const, isAdmin: true, capabilities: [] };
    expect(resolveCapability(admin, false, false, 'can_validate')).toBe(true);
    expect(resolveCapability(admin, false, false, 'can_jamais_declaree')).toBe(true);
  });

  it('applique l union des rôles actifs pour un membre', () => {
    expect(resolveCapability(base, false, false, 'can_validate')).toBe(true);
    expect(resolveCapability(base, false, false, 'can_manage_roles')).toBe(false);
  });
});
