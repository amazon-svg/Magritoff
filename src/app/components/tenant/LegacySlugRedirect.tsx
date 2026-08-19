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

import { Navigate } from 'react-router';
import { useLegacyTenantSlugResolution } from '../../hooks/useLegacyTenantSlugResolution';

interface Props {
  oldSlug: string;
}

export function LegacySlugRedirect({ oldSlug }: Props) {
  const target = useLegacyTenantSlugResolution(oldSlug);

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
