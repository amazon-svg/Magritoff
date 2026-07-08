import { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "./AppShell";
import { MainLayout } from "./components/MainLayout";
import { TenantAwareLayout } from "./components/tenant/TenantAwareLayout";
import { TenantPicker } from "./components/tenant/TenantPicker";
import { ConfiguratorPage } from "./components/ConfiguratorPage";
import { NotFound } from "./components/NotFound";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";

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

const DashboardProfile = lazy(() =>
  import("./components/dashboard/DashboardProfile").then((m) => ({ default: m.DashboardProfile })),
);
const DashboardPreferences = lazy(() =>
  import("./components/dashboard/DashboardPreferences").then((m) => ({
    default: m.DashboardPreferences,
  })),
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
const DashboardOrders = lazy(() =>
  import("./components/dashboard/DashboardOrders").then((m) => ({ default: m.DashboardOrders })),
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
const DashboardShops = lazy(() =>
  import("./components/dashboard/DashboardShops").then((m) => ({ default: m.DashboardShops })),
);
const DashboardShopEditor = lazy(() =>
  import("./components/dashboard/DashboardShopEditor").then((m) => ({
    default: m.DashboardShopEditor,
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
      <div className="text-sm text-gray-500" aria-live="polite">
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
      // Boutique publique — anonyme, pas de tenant
      { path: "/shop/:slug", element: lazyRoute(<PublicShop />) },

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
              { index: true, element: lazyRoute(<DashboardProfile />) },
              { path: "plan", element: lazyRoute(<DashboardPlan />) },
              { path: "preferences", element: lazyRoute(<DashboardPreferences />) },
              { path: "history", element: lazyRoute(<DashboardHistory />) },
              { path: "quotes", element: lazyRoute(<DashboardQuotes />) },
              { path: "quotes/pending", element: lazyRoute(<DashboardQuotesPending />) },
              { path: "quotes/:id/edit", element: lazyRoute(<DashboardQuoteEditor />) },
              { path: "quote-templates", element: lazyRoute(<DashboardQuoteTemplates />) },
              { path: "orders", element: lazyRoute(<DashboardOrders />) },
              { path: "users", element: lazyRoute(<DashboardUsers />) },
              { path: "clients", element: <Navigate to="../users" replace /> },
              { path: "members", element: <Navigate to="../users" replace /> },
              { path: "library", element: lazyRoute(<DashboardLibraries />) },
              { path: "library/:id", element: lazyRoute(<DashboardLibraryDetail />) },
              { path: "shops", element: lazyRoute(<DashboardShops />) },
              { path: "shops/:id", element: lazyRoute(<DashboardShopEditor />) },
              // Nouveautes v3
              { path: "settings", element: lazyRoute(<DashboardTenantSettings />) },
              { path: "spaces", element: lazyRoute(<DashboardTenantSpaces />) },
              { path: "gammes", element: lazyRoute(<DashboardTenantGammes />) },
              { path: "admin/pim", element: lazyRoute(<DashboardAdminPIM />) },
              // P5-VISUELS (2026-06-15) — Référence visuelle 5 templates Magrit-brandés
              // Garde superadmin (isAdmin || isSuperAdmin) côté composant.
              { path: "admin/mockups", element: lazyRoute(<DashboardAdminMockups />) },
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
