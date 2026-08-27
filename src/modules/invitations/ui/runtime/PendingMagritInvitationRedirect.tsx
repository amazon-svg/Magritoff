import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/modules/account/ui/runtime';
import {
  clearPendingMagritInvitation,
  consumePendingMagritInvitation,
} from '@/modules/invitations/ui/pendingMagritInvitation';

export function PendingMagritInvitationRedirect() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user || location.pathname.startsWith('/invitations/')) return;
    try {
      // Supprime les anciens tokens persistants : ils sont la cause des
      // redirections surprises lors d'une connexion ultérieure.
      clearPendingMagritInvitation(window.localStorage);
    } catch {
      // Un localStorage désactivé ne doit pas bloquer sessionStorage.
    }
    try {
      const token = consumePendingMagritInvitation(window.sessionStorage);
      if (token) {
        navigate(`/invitations/${encodeURIComponent(token)}`, { replace: true });
      }
    } catch {
      // Le lien reçu par email reste le mécanisme de reprise principal.
    }
  }, [loading, location.pathname, navigate, user]);

  return null;
}
