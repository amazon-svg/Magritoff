import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { SessionBootstrap } from '../../modules/session';
import { ApiClientError } from '../../platform/api';
import { useSessionBootstrap } from '../contexts/SessionBootstrapContext';

export const PENDING_MAGRIT_INVITATION_KEY = 'magrit:pending-invitation';

export type MagritInvitationStatus = 'idle' | 'accepting' | 'success' | 'error';

export function resolveMagritInvitationDestination(
  tenantId: string,
  bootstrap: SessionBootstrap | null,
): { tenantSlug: string | null; path: string } {
  const tenantSlug = bootstrap?.tenants.find((tenant) => tenant.id === tenantId)?.slug ?? null;
  return tenantSlug
    ? { tenantSlug, path: `/t/${tenantSlug}` }
    : { tenantSlug: null, path: '/tenants' };
}

function writePendingInvitation(token: string): void {
  try {
    window.localStorage.setItem(PENDING_MAGRIT_INVITATION_KEY, token);
  } catch {
    // Le stockage peut être désactivé ; le lien courant conserve encore le token.
  }
}

function clearPendingInvitation(): void {
  try {
    window.localStorage.removeItem(PENDING_MAGRIT_INVITATION_KEY);
  } catch {
    // Aucun impact sur l'acceptation déjà confirmée côté serveur.
  }
}

export function useMagritInvitationAcceptance({
  token,
  userId,
  authLoading,
}: {
  token: string | undefined;
  userId: string | null;
  authLoading: boolean;
}) {
  const navigate = useNavigate();
  const { acceptInvitation, reload } = useSessionBootstrap();
  const attemptedKey = useRef<string | null>(null);
  const [status, setStatus] = useState<MagritInvitationStatus>('idle');
  const [targetSlug, setTargetSlug] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isEmailMismatch, setIsEmailMismatch] = useState(false);

  useEffect(() => {
    if (token && !authLoading && !userId) writePendingInvitation(token);
  }, [authLoading, token, userId]);

  useEffect(() => {
    if (!token || !userId) return;
    const attemptKey = `${userId}:${token}`;
    if (attemptedKey.current === attemptKey) return;
    attemptedKey.current = attemptKey;
    let active = true;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;

    setStatus('accepting');
    setMessage(null);
    setIsEmailMismatch(false);

    void (async () => {
      try {
        const tenantId = await acceptInvitation(token);
        const bootstrap = await reload();
        if (!active) return;
        const destination = resolveMagritInvitationDestination(tenantId, bootstrap);
        clearPendingInvitation();
        setTargetSlug(destination.tenantSlug);
        setStatus('success');
        redirectTimer = setTimeout(() => navigate(destination.path), 1500);
      } catch (cause) {
        if (!active) return;
        const mismatch = cause instanceof ApiClientError
          && cause.problem.code === 'session.invitation_email_mismatch';
        const rawMessage = cause instanceof Error ? cause.message : String(cause);
        setIsEmailMismatch(mismatch);
        setMessage(mismatch
          ? rawMessage.replace(/^.*EMAIL_MISMATCH:\s*/, '')
            || "Cette invitation est destinée à un autre compte. Déconnectez-vous puis reconnectez-vous avec le compte invité."
          : 'Invitation invalide ou expirée.');
        setStatus('error');
      }
    })();

    return () => {
      active = false;
      if (redirectTimer !== undefined) clearTimeout(redirectTimer);
    };
  }, [acceptInvitation, navigate, reload, token, userId]);

  return {
    status,
    targetSlug,
    message,
    isEmailMismatch,
    rememberPendingInvitation: () => {
      if (token) writePendingInvitation(token);
    },
  } as const;
}
