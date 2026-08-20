import { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { workspaceRuntimeRoutes } from "./surfaces/workspaceRuntimeRoutes";
import { portalRuntimePaths } from "./surfaces/portalRuntimePaths";

const AppShell = lazy(() =>
  import("./AppShell").then((m) => ({ default: m.AppShell })),
);
const MainLayout = lazy(() =>
  import("./components/MainLayout").then((m) => ({ default: m.MainLayout })),
);
const TenantAwareLayout = lazy(() =>
  import("./components/tenant/TenantAwareLayout").then((m) => ({ default: m.TenantAwareLayout })),
);
const TenantPicker = lazy(() =>
  import("./components/tenant/TenantPicker").then((m) => ({ default: m.TenantPicker })),
);
const ConfiguratorPage = lazy(() =>
  import("./components/ConfiguratorPage").then((m) => ({ default: m.ConfiguratorPage })),
);
const NotFound = lazy(() =>
  import("./components/NotFound").then((m) => ({ default: m.NotFound })),
);
const DashboardLayout = lazy(() =>
  import("./components/dashboard/DashboardLayout").then((m) => ({ default: m.DashboardLayout })),
);
const StorefrontRuntimeBoundary = lazy(() =>
  import("./surfaces/StorefrontRuntimeBoundary").then((m) => ({ default: m.StorefrontRuntimeBoundary })),
);
const WorkspaceRuntimeBoundary = lazy(() =>
  import("./surfaces/WorkspaceRuntimeBoundary").then((m) => ({ default: m.WorkspaceRuntimeBoundary })),
);

const TenantOnboarding = lazy(() =>
  import("./components/tenant/TenantOnboarding").then((m) => ({ default: m.TenantOnboarding })),
);
const AcceptInvitation = lazy(() =>
  import("./components/tenant/AcceptInvitation").then((m) => ({ default: m.AcceptInvitation })),
);
const ResetPasswordPage = lazy(() =>
  import("./components/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const ProductSheet = lazy(() =>
  import("./components/ProductSheet").then((m) => ({ default: m.ProductSheet })),
);
const PersonalizationPage = lazy(() =>
  import("./components/PersonalizationPage").then((m) => ({ default: m.PersonalizationPage })),
);
const PublicShop = lazy(() =>
  import("./components/shop/PublicShop").then((m) => ({ default: m.PublicShop })),
);
const StorefrontActivationPage = lazy(() =>
  import("./components/shop/StorefrontActivationPage").then((m) => ({ default: m.StorefrontActivationPage })),
);
const StorefrontPasswordResetPage = lazy(() =>
  import("./components/shop/StorefrontPasswordResetPage").then((m) => ({ default: m.StorefrontPasswordResetPage })),
);

// REFONTE-UX (2026-08-08) — module Parc machine, wizard RP#070826 (point 8).
const MachineParkWizard = lazy(() =>
  import("./components/dashboard/machines/MachineParkWizard").then((m) => ({
    default: m.MachineParkWizard,
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
              ...workspaceRuntimeRoutes.map(({ id, path, Component }) => ({
                id,
                path,
                element: lazyRoute(<Component />),
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
