import { describe, expect, it } from 'vitest';
import { invitationApiProblemMessage } from '../../../src/app/components/dashboard/InviteUserModalV2.helpers';

describe('invitationApiProblemMessage', () => {
  it('traduit une session expirée en action utilisateur', () => {
    expect(invitationApiProblemMessage('identity.authentication_required')).toBe(
      'Votre session a expiré. Reconnectez-vous puis réessayez.',
    );
  });

  it('traduit le doublon pending', () => {
    expect(invitationApiProblemMessage('invitations.duplicate_pending')).toBe(
      'Une invitation active existe déjà pour cette adresse email.',
    );
  });

  it('traduit un refus de capability', () => {
    expect(invitationApiProblemMessage('invitations.permission_denied')).toBe(
      "Votre compte n'a pas le droit d'inviter sur cet espace.",
    );
  });

  it('conserve le détail API inconnu', () => {
    expect(invitationApiProblemMessage('invitations.delivery_failed', 'Erreur Resend détaillée')).toBe(
      'Erreur Resend détaillée',
    );
  });
});
