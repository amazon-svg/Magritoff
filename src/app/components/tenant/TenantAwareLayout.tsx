/**
 * TenantAwareLayout
 * ─────────────────
 * Layout des routes /t/:tenantSlug/*.
 *
 * Responsabilites :
 *   - verifier que l'user est connecte (sinon redirection login)
 *   - verifier que l'user est bien membre du tenant dans l'URL (sinon 403/picker)
 *   - render Header + Outlet (et UnauthBanner pour les cas edge)
 *
 * Si le TenantContext ne resout rien (pas de tenant dans les memberships), on
 * redirige vers /tenants pour que l'user creee ou choisisse un tenant.
 */

import { Navigate, Outlet, useParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { Header } from '../Header';
import { UnauthBanner } from '../UnauthBanner';
import { LegacySlugRedirect } from './LegacySlugRedirect';
import { ShopOnlyRedirect } from './ShopOnlyRedirect';

export function TenantAwareLayout() {
  const { user, loading: authLoading } = useAuth();
  const { tenants, currentTenant, loading: tenantLoading } = useTenant();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const loading = authLoading || tenantLoading;

  if (loading) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-bg text-ink-muted"
        style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 300 }}
      >
        Chargement du tenant…
      </div>
    );
  }

  // Pas connecte → redirection auth (ou page login dediee)
  if (!user) {
    return <Navigate to="/tenants" replace />;
  }

  // User connecte mais aucun tenant → onboarding
  if (tenants.length === 0) {
    return <Navigate to="/tenants/new" replace />;
  }

  // Slug URL ne correspond a aucun tenant accessible → tente d'abord la
  // resolution d'un slug archive (E9.4 redirection 90 j apres rename),
  // puis fallback /tenants si rien.
  const match = tenants.find((t) => t.slug === tenantSlug);
  if (!match) {
    return <LegacySlugRedirect oldSlug={tenantSlug ?? ''} />;
  }

  // E9.3 — Guard scope. Un user shop_only ne doit jamais voir le dashboard
  // ni la chat home : on l'envoie directement sur sa boutique.
  if (match.accessScope === 'shop_only') {
    return <ShopOnlyRedirect allowedShopIds={match.allowedShopIds} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main>
        <Outlet />
      </main>
      <UnauthBanner />
    </div>
  );
}
