import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/modules/account/ui/runtime';
import { PENDING_MAGRIT_INVITATION_KEY } from '@/modules/invitations/ui/hooks/useMagritInvitationAcceptance';

export function PendingMagritInvitationRedirect() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user || location.pathname.startsWith('/invitations/')) return;
    try {
      const token = window.localStorage.getItem(PENDING_MAGRIT_INVITATION_KEY);
      if (token && /^[A-Za-z0-9_-]{32,512}$/.test(token)) {
        navigate(`/invitations/${encodeURIComponent(token)}`, { replace: true });
      }
    } catch {
      // Le lien reçu par email reste le mécanisme de reprise principal.
    }
  }, [loading, location.pathname, navigate, user]);

  return null;
}
