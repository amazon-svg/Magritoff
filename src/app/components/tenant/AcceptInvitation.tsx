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

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { supabase } from '/utils/supabase/client';

const PENDING_INVITATION_KEY = 'magrit:pending-invitation';

export function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const { acceptInvitation } = useTenant();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'idle' | 'accepting' | 'success' | 'error'>(
    'idle'
  );
  const [targetSlug, setTargetSlug] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isEmailMismatch, setIsEmailMismatch] = useState(false);

  // Si l'user n'est pas connecte, on stocke le token pour le reprendre apres login
  useEffect(() => {
    if (!token) return;
    if (!authLoading && !user) {
      try {
        window.localStorage.setItem(PENDING_INVITATION_KEY, token);
      } catch {
        /* ignore */
      }
    }
  }, [token, authLoading, user]);

  // Une fois connecte, on accepte l'invitation automatiquement
  useEffect(() => {
    if (!token || !user || status !== 'idle') return;

    (async () => {
      setStatus('accepting');
      const { tenantId, errorCode, errorMessage } = await acceptInvitation(token);
      if (!tenantId) {
        setStatus('error');
        // Fix 2026-05-27 : message specifique si le compte connecte ne
        // correspond pas a l'email cible de l'invitation (EMAIL_MISMATCH).
        if (errorCode === 'EMAIL_MISMATCH') {
          setIsEmailMismatch(true);
          // Le message RPC contient 'EMAIL_MISMATCH: Cette invitation est
          // destinee a X. Vous etes connecte en tant que Y...'. On retire
          // le prefixe technique pour l'affichage.
          const clean = (errorMessage ?? '').replace(/^.*EMAIL_MISMATCH:\s*/, '');
          setMessage(
            clean ||
              "Cette invitation est destinee a un autre compte. Deconnectez-vous puis reconnectez-vous avec le compte invite.",
          );
        } else {
          setMessage('Invitation invalide ou expiree.');
        }
        return;
      }
      // Recupere le slug du tenant + la 1re boutique accessible (si l'invite
      // est un acheteur shop_only, on l'amene directement sur SA boutique
      // au lieu de la home du tenant — fix 2026-05-27).
      const { data: tenant } = await supabase
        .from('tenants')
        .select('slug')
        .eq('id', tenantId)
        .maybeSingle();

      // Tente de resoudre une boutique accessible (RLS filtre deja sur les
      // shops que l'user peut voir). Si l'user est shop_only, il ne verra
      // que sa/ses boutique(s) → on prend la premiere.
      const { data: shopRows } = await supabase
        .from('shops')
        .select('slug')
        .eq('tenant_id', tenantId)
        .limit(1);
      const firstShopSlug = (shopRows && shopRows[0]?.slug) || null;

      setStatus('success');
      setTargetSlug(tenant?.slug ?? null);
      try {
        window.localStorage.removeItem(PENDING_INVITATION_KEY);
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        if (tenant?.slug && firstShopSlug) {
          // Acheteur / membre avec une boutique accessible → direct boutique
          navigate(`/t/${tenant.slug}/s/${firstShopSlug}`);
        } else if (tenant?.slug) {
          navigate(`/t/${tenant.slug}`);
        } else {
          navigate('/tenants');
        }
      }, 1500);
    })();
  }, [token, user, status, acceptInvitation, navigate]);

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
                  // Le token reste en localStorage (set au mount si !user).
                  // On le re-set par securite avant signOut pour reprendre
                  // l'invitation apres reconnexion avec le bon compte.
                  try {
                    if (token) window.localStorage.setItem(PENDING_INVITATION_KEY, token);
                  } catch {
                    /* ignore */
                  }
                  await supabase.auth.signOut();
                  navigate('/');
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
