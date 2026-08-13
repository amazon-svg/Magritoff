/**
 * LegacySlugRedirect
 * ──────────────────
 * Quand un user tape une URL /t/:oldSlug/... apres qu'un superadmin a renomme
 * le tenant (E9.4), on resout l'ancien slug via la RPC `resolve_tenant_slug`
 * et on redirige vers le nouveau slug en preservant le path.
 *
 * Conserve la redirection 90 jours (geree cote DB par tenant_slug_history).
 * Si le slug n'est ni courant ni archive → fallback /tenants (picker).
 */

import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { SessionApiClient } from '../../../modules/session';
import { useApiRuntimeClient } from '../../contexts/ApiRuntimeContext';

interface Props {
  oldSlug: string;
}

export function LegacySlugRedirect({ oldSlug }: Props) {
  const location = useLocation();
  const apiClient = useApiRuntimeClient();
  const sessionApi = useMemo(() => new SessionApiClient(apiClient), [apiClient]);
  // undefined = loading, null = no match (fallback), string = redirect target
  const [target, setTarget] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!oldSlug) {
      setTarget(null);
      return;
    }
    let cancelled = false;
    sessionApi.resolveTenantSlug(oldSlug)
      .then((slug) => {
        if (cancelled) return;
        if (!slug || slug === oldSlug) {
          setTarget(null);
          return;
        }
        // Remplace seulement le segment slug, conserve le sous-path
        const newPath = location.pathname.replace(`/t/${oldSlug}`, `/t/${slug}`)
          + location.search
          + location.hash;
        setTarget(newPath);
      })
      .catch(() => { if (!cancelled) setTarget(null); });
    return () => { cancelled = true; };
  }, [oldSlug, location.hash, location.pathname, location.search, sessionApi]);

  if (target === undefined) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-bg text-ink-muted"
        style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 300 }}
      >
        Recherche de l'espace…
      </div>
    );
  }

  if (target === null) {
    return <Navigate to="/tenants" replace />;
  }

  return <Navigate to={target} replace />;
}
