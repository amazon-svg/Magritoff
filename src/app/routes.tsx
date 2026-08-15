import { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "./AppShell";
import { MainLayout } from "./components/MainLayout";
import { TenantAwareLayout } from "./components/tenant/TenantAwareLayout";
import { TenantPicker } from "./components/tenant/TenantPicker";
import { ConfiguratorPage } from "./components/ConfiguratorPage";
import { NotFound } from "./components/NotFound";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { workspaceRuntimeRoutes } from "./surfaces/workspaceRuntimeRoutes";

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

const DashboardPlan = lazy(() =>
  import("./components/dashboard/DashboardPlan").then((m) => ({ default: m.DashboardPlan })),
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
 * AppShell est le root element qui monte les providers router-aware
 * (TenantProvider notamment).
 *
 * Code-splitting Sprint 10 (S9-PERF-ROUTE-SPLIT) : Dashboard* + pages secondaires
 * sont lazy via React.lazy + Suspense fallback Chargement. AppShell, MainLayout,
 * TenantAwareLayout, DashboardLayout, TenantPicker et ConfiguratorPage restent
 * eager car hot-path post-login.
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      // Boutique publique — anonyme, pas de tenant.
      // S7.1 (ADR §4.19-1) : catch-all — les vues du portail sont des URLs
      // (`/catalog`, `/p/:id`, `/orders`, `/thank-you`, `/g/:gamme` S7.3,
      // `/account/*` S7.10) résolues par parsePortalPath dans PublicShop.
      { path: "/shop/:slug/*", element: lazyRoute(<PublicShop />) },

      // REFONTE-UX (2026-08-08) — route DEV seulement : rendre le wizard parc
      // machine hors auth pour les tests automatises et les demos d arbitrage
      // BK-15 (maquettes A/B). Exclue des builds de production.
      ...(import.meta.env.DEV
        ? [{ path: "/dev/machines-wizard", element: lazyRoute(<MachineParkWizard />) }]
        : []),

      // Flux hors-tenant (auth, onboarding, picker, invitation)
      {
        path: "/",
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/tenants" replace /> },
          { path: "reset-password", element: lazyRoute(<ResetPasswordPage />) },
          { path: "tenants", element: <TenantPicker /> },
          { path: "tenants/new", element: lazyRoute(<TenantOnboarding />) },
          { path: "invitations/:token", element: lazyRoute(<AcceptInvitation />) },
        ],
      },

      // App principale, tenant-scoped
      {
        path: "/t/:tenantSlug",
        element: <TenantAwareLayout />,
        children: [
          { index: true, element: <ConfiguratorPage /> },
          { path: "product/:id", element: lazyRoute(<ProductSheet />) },
          { path: "personalization/:id", element: lazyRoute(<PersonalizationPage />) },
          {
            path: "dashboard",
            element: <DashboardLayout />,
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
              { path: "plan", element: lazyRoute(<DashboardPlan />) },
              { path: "clients", element: <Navigate to="../users" replace /> },
              { path: "members", element: <Navigate to="../users" replace /> },
            ],
          },
        ],
      },

      { path: "*", element: <NotFound /> },
    ],
  },
]);
