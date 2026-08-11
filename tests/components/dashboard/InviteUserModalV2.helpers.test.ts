import { describe, expect, it } from 'vitest';
import { inviteMemberErrorMessage } from '../../../src/app/components/dashboard/InviteUserModalV2.helpers';

describe('inviteMemberErrorMessage', () => {
  it('traduit un JWT expiré en action utilisateur', () => {
    expect(inviteMemberErrorMessage(null, 401, 'SDK opaque')).toBe(
      'Votre session a expiré. Reconnectez-vous puis réessayez.',
    );
  });

  it('traduit le doublon pending', () => {
    expect(inviteMemberErrorMessage(
      { error: 'duplicate_pending: invitation exists' },
      409,
      'SDK opaque',
    )).toBe('Une invitation active existe déjà pour cette adresse email.');
  });

  it('traduit un refus de capability', () => {
    expect(inviteMemberErrorMessage(
      { error: 'permission_denied: caller lacks can_invite capability' },
      403,
      'SDK opaque',
    )).toBe("Votre compte n'a pas le droit d'inviter sur cet espace.");
  });

  it('conserve le détail serveur inconnu avant le fallback SDK', () => {
    expect(inviteMemberErrorMessage(
      { error: 'Erreur Resend détaillée' },
      502,
      'Edge Function returned a non-2xx status code',
    )).toBe('Erreur Resend détaillée');
  });
});
