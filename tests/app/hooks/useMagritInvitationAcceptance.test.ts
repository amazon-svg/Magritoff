import { describe, expect, it } from 'vitest';
import type { SessionBootstrap } from '@/modules/session';
import { resolveMagritInvitationDestination } from '@/modules/invitations/ui/hooks/useMagritInvitationAcceptance';
import {
  consumePendingMagritInvitation,
  PENDING_MAGRIT_INVITATION_KEY,
  rememberPendingMagritInvitation,
} from '@/modules/invitations/ui/pendingMagritInvitation';

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

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('pending Magrit invitation', () => {
  const token = 'a'.repeat(32);
  const now = Date.UTC(2026, 7, 27, 12);

  it("consomme l'intention une seule fois", () => {
    const storage = memoryStorage();
    rememberPendingMagritInvitation(storage, token, now);

    expect(consumePendingMagritInvitation(storage, now)).toBe(token);
    expect(consumePendingMagritInvitation(storage, now)).toBeNull();
  });

  it('rejette et supprime une intention expirée', () => {
    const storage = memoryStorage();
    rememberPendingMagritInvitation(storage, token, now - 24 * 60 * 60 * 1000 - 1);

    expect(consumePendingMagritInvitation(storage, now)).toBeNull();
    expect(storage.getItem(PENDING_MAGRIT_INVITATION_KEY)).toBeNull();
  });

  it("supprime sans l'exécuter un ancien token brut", () => {
    const storage = memoryStorage();
    storage.setItem(PENDING_MAGRIT_INVITATION_KEY, token);

    expect(consumePendingMagritInvitation(storage, now)).toBeNull();
    expect(storage.getItem(PENDING_MAGRIT_INVITATION_KEY)).toBeNull();
  });
});
