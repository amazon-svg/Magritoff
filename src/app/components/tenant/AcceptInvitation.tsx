/**
 * AcceptInvitation
 * ────────────────
 * Page /invitations/:token : landing apres clic sur le lien recu par email.
 *
 * Si l'user n'est pas connecte : affiche un message + bouton de connexion,
 * et stocke le token en localStorage pour le reprendre apres login.
 *
 * Si l'user est connecte : appelle RPC accept_tenant_invitation, puis redirige
 * vers /t/:slug du tenant rejoint.
 */

import { useParams } from 'react-router';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMagritInvitationAcceptance } from '../../hooks/useMagritInvitationAcceptance';

export function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, signOut } = useAuth();
  const invitation = useMagritInvitationAcceptance({
    token,
    userId: user?.id ?? null,
    authLoading,
  });
  const { status, targetSlug, message, isEmailMismatch } = invitation;

  return (
    <div
      className="min-h-[calc(100vh-56px)] bg-bg px-6 py-10 grid place-items-center"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      <div className="max-w-md w-full bg-paper border border-line rounded-md p-6 text-center">
        {!user && (
          <>
            <p className="text-ink mb-2" style={{ fontSize: '15px', fontWeight: 500 }}>
              Connectez-vous pour accepter l'invitation
            </p>
            <p
              className="text-ink-muted"
              style={{ fontSize: '13px', fontWeight: 300, lineHeight: 1.5 }}
            >
              Votre invitation sera automatiquement appliquee apres votre
              connexion.
            </p>
          </>
        )}
        {user && status === 'accepting' && (
          <p className="text-ink-muted" style={{ fontSize: '13.5px', fontWeight: 300 }}>
            Acceptation de l'invitation…
          </p>
        )}
        {user && status === 'success' && (
          <>
            <CheckCircle2
              className="w-10 h-10 text-ok-fg mx-auto mb-3"
              strokeWidth={1.5}
            />
            <p className="text-ink" style={{ fontSize: '15px', fontWeight: 500 }}>
              Bienvenue dans l'espace !
            </p>
            <p
              className="mt-2 text-ink-muted"
              style={{ fontSize: '13px', fontWeight: 300 }}
            >
              Redirection vers{' '}
              <span className="font-mono">/t/{targetSlug ?? '…'}</span>
            </p>
          </>
        )}
        {user && status === 'error' && (
          <>
            <XCircle
              className="w-10 h-10 text-err-fg mx-auto mb-3"
              strokeWidth={1.5}
            />
            <p className="text-ink" style={{ fontSize: '15px', fontWeight: 500 }}>
              {isEmailMismatch ? 'Mauvais compte connecté' : 'Invitation invalide'}
            </p>
            <p
              className="mt-2 text-ink-muted"
              style={{ fontSize: '13px', fontWeight: 300, lineHeight: 1.5 }}
            >
              {message}
            </p>
            {isEmailMismatch && (
              <button
                onClick={async () => {
                  invitation.rememberPendingInvitation();
                  await signOut();
                }}
                className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-md bg-ink text-paper hover:bg-black"
                style={{ fontSize: '13px', fontWeight: 500 }}
              >
                Se déconnecter et changer de compte
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
