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

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { CheckCircle2, Loader2, LockKeyhole, XCircle } from 'lucide-react';
import { useAuth } from '@/modules/account/ui/runtime';
import { useMagritInvitationAcceptance } from '@/modules/invitations/ui/hooks/useMagritInvitationAcceptance';
import { InvitationsApiClient, type InvitationActivation } from '@/modules/invitations';
import { useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';

export function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const { apiClient } = useWorkspaceUiRuntime();
  const api = useMemo(() => new InvitationsApiClient(apiClient), [apiClient]);
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const invitation = useMagritInvitationAcceptance({
    token,
    userId: user?.id ?? null,
    authLoading,
  });
  const { status, targetSlug, message, isEmailMismatch } = invitation;
  const [activation, setActivation] = useState<InvitationActivation | null>(null);
  const [activationLoading, setActivationLoading] = useState(true);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setActivationError('Lien d’invitation invalide.');
      setActivationLoading(false);
      return;
    }
    let active = true;
    setActivationLoading(true);
    void api.activation(token).then((resolved) => {
      if (active) setActivation(resolved);
    }).catch(() => {
      if (active) setActivationError('Cette invitation est invalide, expirée ou déjà utilisée.');
    }).finally(() => {
      if (active) setActivationLoading(false);
    });
    return () => { active = false; };
  }, [api, token]);

  const submitActivation = async (event: FormEvent) => {
    event.preventDefault();
    if (!activation || submitting) return;
    setActivationError(null);
    if (!activation.accountExists && !fullName.trim()) {
      setActivationError('Indiquez votre nom complet.');
      return;
    }
    if (!activation.accountExists && password.length < 8) {
      setActivationError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!activation.accountExists && password !== confirmation) {
      setActivationError('Les mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    const result = activation.accountExists
      ? await signIn(activation.email, password)
      : await signUp(activation.email, password, fullName.trim());
    setSubmitting(false);
    if (result.error) {
      setActivationError(activation.accountExists
        ? 'Mot de passe incorrect.'
        : result.error.message);
    } else if (!result.session) {
      if (token) {
        const refreshed = await api.activation(token).catch(() => null);
        if (refreshed) setActivation(refreshed);
      }
      setActivationError('Un compte existe déjà pour cette adresse. Saisissez son mot de passe pour continuer.');
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-56px)] bg-bg px-6 py-10 grid place-items-center"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      <div className="max-w-md w-full bg-paper border border-line rounded-md p-6 text-center">
        {!user && (
          <>
            <LockKeyhole className="mx-auto mb-3 h-9 w-9 text-ink" strokeWidth={1.5} />
            {activationLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Vérification de l’invitation…
              </div>
            ) : activation ? (
              <>
                <p className="text-ink mb-1" style={{ fontSize: '17px', fontWeight: 600 }}>
                  Rejoindre {activation.tenantName}
                </p>
                <p className="mb-5 text-sm text-ink-muted">
                  {activation.accountExists
                    ? 'Saisissez votre mot de passe pour rejoindre cet espace.'
                    : 'Créez votre accès Magrit. Votre adresse est déjà définie par l’invitation.'}
                </p>
                <form className="space-y-3 text-left" onSubmit={submitActivation}>
                  <label className="block text-xs font-medium text-ink-muted">
                    Adresse email
                    <input
                      readOnly
                      value={activation.email}
                      className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm text-ink-muted"
                    />
                  </label>
                  {!activation.accountExists && (
                    <label className="block text-xs font-medium text-ink-muted">
                      Nom complet
                      <input
                        required
                        autoComplete="name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink"
                      />
                    </label>
                  )}
                  <label className="block text-xs font-medium text-ink-muted">
                    Mot de passe
                    <input
                      required
                      minLength={activation.accountExists ? 1 : 8}
                      type="password"
                      autoComplete={activation.accountExists ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  {!activation.accountExists && (
                    <label className="block text-xs font-medium text-ink-muted">
                      Confirmer le mot de passe
                      <input
                        required
                        minLength={8}
                        type="password"
                        autoComplete="new-password"
                        value={confirmation}
                        onChange={(event) => setConfirmation(event.target.value)}
                        className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink"
                      />
                    </label>
                  )}
                  {activationError && <p role="alert" className="rounded-md bg-err-bg px-3 py-2 text-xs text-err-fg">{activationError}</p>}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {activation.accountExists ? 'Se connecter et rejoindre' : 'Créer mon compte et rejoindre'}
                  </button>
                </form>
              </>
            ) : (
              <p role="alert" className="rounded-md bg-err-bg px-3 py-2 text-sm text-err-fg">
                {activationError}
              </p>
            )}
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
