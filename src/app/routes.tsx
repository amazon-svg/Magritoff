import { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { workspaceRuntimeRoutes } from "@/app/surfaces/workspaceRuntimeRoutes";
import { WorkspaceCapabilityGate } from "@/app/surfaces/WorkspaceCapabilityGate";
import { portalRuntimePaths } from "@/app/surfaces/portalRuntimePaths";

const AppShell = lazy(() =>
  import("@/app/AppShell").then((m) => ({ default: m.AppShell })),
);
const MainLayout = lazy(() =>
  import("@/app/layouts/MainLayout").then((m) => ({ default: m.MainLayout })),
);
const TenantAwareLayout = lazy(() =>
  import("@/app/layouts/TenantAwareLayout").then((m) => ({ default: m.TenantAwareLayout })),
);
const TenantPicker = lazy(() =>
  import("@/modules/tenants/ui").then((m) => ({ default: m.TenantPicker })),
);
const ConfiguratorPage = lazy(() =>
  import("@/modules/catalog/ui").then((m) => ({ default: m.ConfiguratorPage })),
);
const NotFound = lazy(() =>
  import("@/app/layouts/NotFound").then((m) => ({ default: m.NotFound })),
);
const DashboardLayout = lazy(() =>
  import("@/app/layouts/DashboardLayout").then((m) => ({ default: m.DashboardLayout })),
);
const StorefrontRuntimeBoundary = lazy(() =>
  import("@/app/surfaces/StorefrontRuntimeBoundary").then((m) => ({ default: m.StorefrontRuntimeBoundary })),
);
const WorkspaceRuntimeBoundary = lazy(() =>
  import("@/app/surfaces/WorkspaceRuntimeBoundary").then((m) => ({ default: m.WorkspaceRuntimeBoundary })),
);

const TenantOnboarding = lazy(() =>
  import("@/modules/tenants/ui").then((m) => ({ default: m.TenantOnboarding })),
);
const AcceptInvitation = lazy(() =>
  import("@/modules/invitations/ui").then((m) => ({ default: m.AcceptInvitation })),
);
const ResetPasswordPage = lazy(() =>
  import("@/modules/account/ui").then((m) => ({ default: m.ResetPasswordPage })),
);
const ProductSheet = lazy(() =>
  import("@/modules/catalog/ui").then((m) => ({ default: m.ProductSheet })),
);
const PersonalizationPage = lazy(() =>
  import("@/modules/catalog/ui").then((m) => ({ default: m.PersonalizationPage })),
);
const PublicShop = lazy(() =>
  import("@/modules/shops/ui").then((m) => ({ default: m.PublicShop })),
);
const StorefrontActivationPage = lazy(() =>
  import("@/modules/shop-customers/ui").then((m) => ({ default: m.StorefrontActivationPage })),
);
const StorefrontPasswordResetPage = lazy(() =>
  import("@/modules/shop-customers/ui").then((m) => ({ default: m.StorefrontPasswordResetPage })),
);

// REFONTE-UX (2026-08-08) — module Parc machine, wizard RP#070826 (point 8).
const MachineParkWizard = lazy(() =>
  import("@/modules/machine-parks/ui").then((m) => ({
    default: m.MachineParkWizard,
  })),
);
const HopeStudioIntegrationTestPage = lazy(() =>
  import('@/modules/hopstudio/ui').then((module) => ({
    default: module.HopeStudioIntegrationTestPage,
  })),
);

function RouteFallback() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center p-8">
      <div className="text-sm text-ink-muted" aria-live="polite">
        Chargement…
      </div>
    </div>
  );
}

function lazyRoute(element: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

/**
 * Routage v3 multi-tenant
 * ───────────────────────
 * Toutes les URLs applicatives sont prefixees par le slug du tenant :
 *   /t/imprimerie-dupont/                → chat home
 *   /t/imprimerie-dupont/dashboard/...   → dashboard du tenant
 *
 * Routes hors-tenant :
 *   /                          → redirige vers /tenants (picker)
 *   /tenants                   → liste des tenants accessibles + "creer"
 *   /tenants/new               → wizard de creation de tenant (signup)
 *   /invitations/:token        → accept invitation flow
 *   /shop/:slug                → boutique publique (anonyme, pas de tenant)
 *   /reset-password            → auth reset (hors tenant)
 *
 * StorefrontRuntimeBoundary et WorkspaceRuntimeBoundary séparent les
 * transports et identités. AppShell ne vit que sous la frontière workspace et
 * monte ensuite les providers tenant-aware.
 *
 * Code-splitting Sprint 10 (S9-PERF-ROUTE-SPLIT) : les frontières d'identité,
 * Dashboard* et les pages secondaires sont lazy via React.lazy + Suspense.
 * Les shells workspace sont eux aussi lazy afin qu'une entrée boutique ne
 * télécharge aucune composition Magrit avant navigation vers cette surface.
 */
export const router = createBrowserRouter([
  ...(import.meta.env.DEV
    ? [{ path: '/dev/hopstudio', element: lazyRoute(<HopeStudioIntegrationTestPage />) }]
    : []),
  {
    element: lazyRoute(<StorefrontRuntimeBoundary />),
    children: [
      // Boutique publique — anonyme, pas de tenant.
      // S7.1 (ADR §4.19-1) : catch-all — les vues du portail sont des URLs
      // (`/catalog`, `/p/:id`, `/orders`, `/thank-you`, `/g/:gamme` S7.3,
      // `/account/*` S7.10) résolues par parsePortalPath dans PublicShop.
      // shopRoot contient deja le parametre `:slug` (ex. `shop/:slug`).
      // Ne pas le rajouter ici : `/shop/:slug/:slug/activate` laisserait le
      // catch-all PublicShop absorber les liens d invitation.
      { path: `/${portalRuntimePaths.shopRoot}/${portalRuntimePaths.activation}`, element: lazyRoute(<StorefrontActivationPage />) },
      { path: `/${portalRuntimePaths.shopRoot}/${portalRuntimePaths.passwordReset}`, element: lazyRoute(<StorefrontPasswordResetPage />) },
      { path: `/${portalRuntimePaths.shopRoot}/*`, element: lazyRoute(<PublicShop />) },
    ],
  },
  {
    element: lazyRoute(<WorkspaceRuntimeBoundary />),
    children: [
      {
        element: lazyRoute(<AppShell />),
        children: [

      // REFONTE-UX (2026-08-08) — route DEV seulement : rendre le wizard parc
      // machine hors auth pour les tests automatises et les demos d arbitrage
      // BK-15 (maquettes A/B). Exclue des builds de production.
      ...(import.meta.env.DEV
        ? [{ path: "/dev/machines-wizard", element: lazyRoute(<MachineParkWizard />) }]
        : []),

      // Flux hors-tenant (auth, onboarding, picker, invitation)
      {
        path: "/",
        element: lazyRoute(<MainLayout />),
        children: [
          { index: true, element: <Navigate to="/tenants" replace /> },
          { path: "reset-password", element: lazyRoute(<ResetPasswordPage />) },
          { path: "tenants", element: lazyRoute(<TenantPicker />) },
          { path: "tenants/new", element: lazyRoute(<TenantOnboarding />) },
          { path: "invitations/:token", element: lazyRoute(<AcceptInvitation />) },
        ],
      },

      // App principale, tenant-scoped
      {
        path: "/t/:tenantSlug",
        element: lazyRoute(<TenantAwareLayout />),
        children: [
          { index: true, element: lazyRoute(<ConfiguratorPage />) },
          { path: "product/:id", element: lazyRoute(<ProductSheet />) },
          { path: "personalization/:id", element: lazyRoute(<PersonalizationPage />) },
          {
            path: "dashboard",
            element: lazyRoute(<DashboardLayout />),
            children: [
              // REFONTE-UX (2026-08-08) — l entree du dashboard est l Atelier
              // (Devis), plus le profil. Profil + Preferences vivent dans
              // Parametres > Mon compte (/account).
              { index: true, element: <Navigate to="quotes" replace /> },
              ...workspaceRuntimeRoutes.map(({ id, path, Component, requiredCapabilities, requiredTenantRole }) => ({
                id,
                path,
                element: lazyRoute(
                  <WorkspaceCapabilityGate
                    requiredCapabilities={requiredCapabilities}
                    requiredTenantRole={requiredTenantRole}
                  >
                    <Component />
                  </WorkspaceCapabilityGate>,
                ),
              })),
              { path: "profile", element: <Navigate to="../account" replace /> },
              { path: "preferences", element: <Navigate to="../account" replace /> },
              { path: "clients", element: <Navigate to="../users" replace /> },
              { path: "members", element: <Navigate to="../users" replace /> },
            ],
          },
        ],
      },

      { path: "*", element: lazyRoute(<NotFound />) },
        ],
      },
    ],
  },
]);
