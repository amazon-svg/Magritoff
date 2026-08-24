import { describe, expect, it } from 'vitest';
import type { SessionBootstrap } from '../../../src/modules/session';
import { resolveMagritInvitationDestination } from '../../../src/app/hooks/useMagritInvitationAcceptance';

const bootstrap = {
  user: { id: 'user-1' },
  tenants: [{ id: 'tenant-1', slug: 'atelier-dupont' }],
  isSuperAdmin: false,
  preferences: {},
} as unknown as SessionBootstrap;

describe('resolveMagritInvitationDestination', () => {
  it("redirige une invitation Magrit vers l'espace back-office", () => {
    expect(resolveMagritInvitationDestination('tenant-1', bootstrap)).toEqual({
      tenantSlug: 'atelier-dupont',
      path: '/t/atelier-dupont',
    });
  });

  it('ne fabrique jamais une route boutique', () => {
    const destination = resolveMagritInvitationDestination('tenant-1', bootstrap);
    expect(destination.path).not.toContain('/s/');
    expect(destination.path).not.toContain('/shop/');
  });

  it("revient au sélecteur si le tenant accepté n'est pas dans le bootstrap", () => {
    expect(resolveMagritInvitationDestination('tenant-inconnu', bootstrap)).toEqual({
      tenantSlug: null,
      path: '/tenants',
    });
  });
});
