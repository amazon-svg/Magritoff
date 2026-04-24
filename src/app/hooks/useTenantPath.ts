/**
 * useTenantPath
 * ─────────────
 * Hook utilitaire pour construire des paths tenant-aware.
 * En v3, toutes les URLs applicatives sont prefixees par /t/:tenantSlug.
 * Ce helper permet d'ecrire du code qui n'a pas a hardcoder le slug.
 *
 * Exemples :
 *   const tp = useTenantPath();
 *   <Link to={tp('/dashboard/clients')}>Clients</Link>
 *   <a href={tp('/dashboard/quote-templates')}>Gabarits</a>
 *
 * Si aucun tenant n'est actif, le path `/dashboard/*` est rewrite en
 * `/tenants` (picker) pour que l'user choisisse d'abord un espace.
 */

import { useCallback } from 'react';
import { useTenant } from '../contexts/TenantContext';

export function useTenantPath() {
  const { currentTenant } = useTenant();
  return useCallback(
    (path: string) => {
      if (!currentTenant) return '/tenants';
      // paths qui commencent par / et pointent dans l'app → prefixer /t/:slug
      if (path.startsWith('/t/')) return path; // deja prefixe
      if (path.startsWith('/tenants')) return path; // hors tenant
      if (path.startsWith('/invitations')) return path; // hors tenant
      if (path.startsWith('/shop/')) return path; // shop public
      if (path.startsWith('/')) return `/t/${currentTenant.slug}${path}`;
      return path; // path relatif, laisse tel quel
    },
    [currentTenant]
  );
}
