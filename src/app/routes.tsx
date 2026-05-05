import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "./AppShell";
import { MainLayout } from "./components/MainLayout";
import { TenantAwareLayout } from "./components/tenant/TenantAwareLayout";
import { TenantPicker } from "./components/tenant/TenantPicker";
import { TenantOnboarding } from "./components/tenant/TenantOnboarding";
import { AcceptInvitation } from "./components/tenant/AcceptInvitation";
import { ConfiguratorPage } from "./components/ConfiguratorPage";
import { ProductSheet } from "./components/ProductSheet";
import { PersonalizationPage } from "./components/PersonalizationPage";
import { NotFound } from "./components/NotFound";
import { ResetPasswordPage } from "./components/auth/ResetPasswordPage";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { DashboardProfile } from "./components/dashboard/DashboardProfile";
import { DashboardPreferences } from "./components/dashboard/DashboardPreferences";
import { DashboardHistory } from "./components/dashboard/DashboardHistory";
import { DashboardQuotes } from "./components/dashboard/DashboardQuotes";
import { DashboardQuoteTemplates } from "./components/dashboard/DashboardQuoteTemplates";
import { DashboardOrders } from "./components/dashboard/DashboardOrders";
import { DashboardUsers } from "./components/dashboard/DashboardUsers";
import { DashboardPlan } from "./components/dashboard/DashboardPlan";
import { DashboardLibraries } from "./components/dashboard/DashboardLibraries";
import { DashboardLibraryDetail } from "./components/dashboard/DashboardLibraryDetail";
import { DashboardShops } from "./components/dashboard/DashboardShops";
import { DashboardShopEditor } from "./components/dashboard/DashboardShopEditor";
import { DashboardAdminPIM } from "./components/dashboard/DashboardAdminPIM";
import { DashboardTenantSpaces } from "./components/dashboard/DashboardTenantSpaces";
import { DashboardTenantGammes } from "./components/dashboard/DashboardTenantGammes";
import { PublicShop } from "./components/shop/PublicShop";

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
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      // Boutique publique — anonyme, pas de tenant
      { path: "/shop/:slug", element: <PublicShop /> },

      // Flux hors-tenant (auth, onboarding, picker, invitation)
      {
        path: "/",
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/tenants" replace /> },
          { path: "reset-password", element: <ResetPasswordPage /> },
          { path: "tenants", element: <TenantPicker /> },
          { path: "tenants/new", element: <TenantOnboarding /> },
          { path: "invitations/:token", element: <AcceptInvitation /> },
        ],
      },

      // App principale, tenant-scoped
      {
        path: "/t/:tenantSlug",
        element: <TenantAwareLayout />,
        children: [
          { index: true, element: <ConfiguratorPage /> },
          { path: "product/:id", element: <ProductSheet /> },
          { path: "personalization/:id", element: <PersonalizationPage /> },
          {
            path: "dashboard",
            element: <DashboardLayout />,
            children: [
              { index: true, element: <DashboardProfile /> },
              { path: "plan", element: <DashboardPlan /> },
              { path: "preferences", element: <DashboardPreferences /> },
              { path: "history", element: <DashboardHistory /> },
              { path: "quotes", element: <DashboardQuotes /> },
              { path: "quote-templates", element: <DashboardQuoteTemplates /> },
              { path: "orders", element: <DashboardOrders /> },
              { path: "users", element: <DashboardUsers /> },
              { path: "clients", element: <Navigate to="../users" replace /> },
              { path: "members", element: <Navigate to="../users" replace /> },
              { path: "library", element: <DashboardLibraries /> },
              { path: "library/:id", element: <DashboardLibraryDetail /> },
              { path: "shops", element: <DashboardShops /> },
              { path: "shops/:id", element: <DashboardShopEditor /> },
              // Nouveautes v3
              { path: "spaces", element: <DashboardTenantSpaces /> },
              { path: "gammes", element: <DashboardTenantGammes /> },
              { path: "admin/pim", element: <DashboardAdminPIM /> },
            ],
          },
        ],
      },

      { path: "*", element: <NotFound /> },
    ],
  },
]);
