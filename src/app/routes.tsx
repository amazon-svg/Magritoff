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

const DashboardHistory = lazy(() =>
  import("./components/dashboard/DashboardHistory").then((m) => ({ default: m.DashboardHistory })),
);
const DashboardQuotes = lazy(() =>
  import("./components/dashboard/DashboardQuotes").then((m) => ({ default: m.DashboardQuotes })),
);
const DashboardQuoteTemplates = lazy(() =>
  import("./components/dashboard/DashboardQuoteTemplates").then((m) => ({
    default: m.DashboardQuoteTemplates,
  })),
);
const DashboardQuotesPending = lazy(() =>
  import("./components/dashboard/DashboardQuotesPending").then((m) => ({
    default: m.DashboardQuotesPending,
  })),
);
const DashboardQuoteEditor = lazy(() =>
  import("./components/dashboard/DashboardQuoteEditor").then((m) => ({
    default: m.DashboardQuoteEditor,
  })),
);
const DashboardUsers = lazy(() =>
  import("./components/dashboard/DashboardUsers").then((m) => ({ default: m.DashboardUsers })),
);
const DashboardPlan = lazy(() =>
  import("./components/dashboard/DashboardPlan").then((m) => ({ default: m.DashboardPlan })),
);
const DashboardLibraries = lazy(() =>
  import("./components/dashboard/DashboardLibraries").then((m) => ({
    default: m.DashboardLibraries,
  })),
);
const DashboardLibraryDetail = lazy(() =>
  import("./components/dashboard/DashboardLibraryDetail").then((m) => ({
    default: m.DashboardLibraryDetail,
  })),
);
const DashboardAdminPIM = lazy(() =>
  import("./components/dashboard/DashboardAdminPIM").then((m) => ({
    default: m.DashboardAdminPIM,
  })),
);
const DashboardAdminMockups = lazy(() =>
  import("./components/dashboard/DashboardAdminMockups").then((m) => ({
    default: m.DashboardAdminMockups,
  })),
);
// REFONTE-UX (2026-08-08) — module Gestion commerciale (point 7).
const DashboardCommercial = lazy(() =>
  import("./components/dashboard/commercial/DashboardCommercial").then((m) => ({
    default: m.DashboardCommercial,
  })),
);
// REFONTE-UX (2026-08-08) — module Parc machine, wizard RP#070826 (point 8).
const DashboardMachines = lazy(() =>
  import("./components/dashboard/machines/DashboardMachines").then((m) => ({
    default: m.DashboardMachines,
  })),
);
const MachineParkWizard = lazy(() =>
  import("./components/dashboard/machines/MachineParkWizard").then((m) => ({
    default: m.MachineParkWizard,
  })),
);
const MachineParkDetail = lazy(() =>
  import("./components/dashboard/machines/MachineParkDetail").then((m) => ({
    default: m.MachineParkDetail,
  })),
);
const DashboardTenantSettings = lazy(() =>
  import("./components/dashboard/DashboardTenantSettings").then((m) => ({
    default: m.DashboardTenantSettings,
  })),
);
const DashboardTenantSpaces = lazy(() =>
  import("./components/dashboard/DashboardTenantSpaces").then((m) => ({
    default: m.DashboardTenantSpaces,
  })),
);
const DashboardTenantGammes = lazy(() =>
  import("./components/dashboard/DashboardTenantGammes").then((m) => ({
    default: m.DashboardTenantGammes,
  })),
);
const OrderRoleAdminPage = lazy(() =>
  import("./components/dashboard/OrderRoleAdminPage").then((m) => ({
    default: m.OrderRoleAdminPage,
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
              { path: "history", element: lazyRoute(<DashboardHistory />) },
              { path: "quotes", element: lazyRoute(<DashboardQuotes />) },
              { path: "quotes/pending", element: lazyRoute(<DashboardQuotesPending />) },
              { path: "quotes/:id/edit", element: lazyRoute(<DashboardQuoteEditor />) },
              { path: "quote-templates", element: lazyRoute(<DashboardQuoteTemplates />) },
              { path: "users", element: lazyRoute(<DashboardUsers />) },
              { path: "clients", element: <Navigate to="../users" replace /> },
              { path: "members", element: <Navigate to="../users" replace /> },
              { path: "library", element: lazyRoute(<DashboardLibraries />) },
              { path: "library/:id", element: lazyRoute(<DashboardLibraryDetail />) },
              // Nouveautes v3
              { path: "settings", element: lazyRoute(<DashboardTenantSettings />) },
              { path: "spaces", element: lazyRoute(<DashboardTenantSpaces />) },
              { path: "gammes", element: lazyRoute(<DashboardTenantGammes />) },
              { path: "admin/pim", element: lazyRoute(<DashboardAdminPIM />) },
              // REFONTE-UX v2 (2026-08-08, retour Arnaud point 5) — la galerie
              // des mockups Magrit-brandes est CONSERVEE (visuels generes +
              // verification du moteur E8.3), rangee dans le groupe Catalogue.
              { path: "admin/mockups", element: lazyRoute(<DashboardAdminMockups />) },
              // REFONTE-UX (2026-08-08) — Gestion commerciale (point 7) :
              // prix, marges et remises par gamme/produit x client/groupe.
              { path: "commercial", element: lazyRoute(<DashboardCommercial />) },
              // REFONTE-UX (2026-08-08) — Parc machine (point 8, RP#070826) :
              // liste du parc + wizard guide de constitution.
              { path: "machines", element: lazyRoute(<DashboardMachines />) },
              { path: "machines/wizard", element: lazyRoute(<MachineParkWizard />) },
              // Point 8 (retour Arnaud 2026-08-08) — detail d un parc.
              { path: "machines/:parkId", element: lazyRoute(<MachineParkDetail />) },
              // S-ORDER-ROLES-3-UI T4 — page admin catalog rôles workflow.
              // Garde d'accès via capability `can_manage_roles` côté composant
              // (preset Owner / Admin depuis migration 2026-06-09).
              { path: "order-roles", element: lazyRoute(<OrderRoleAdminPage />) },
            ],
          },
        ],
      },

      { path: "*", element: <NotFound /> },
    ],
  },
]);
