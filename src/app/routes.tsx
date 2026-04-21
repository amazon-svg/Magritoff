import { createBrowserRouter } from "react-router";
import { MainLayout } from "./components/MainLayout";
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
import { DashboardOrders } from "./components/dashboard/DashboardOrders";
import { DashboardClients } from "./components/dashboard/DashboardClients";
import { DashboardPlan } from "./components/dashboard/DashboardPlan";
import { DashboardLibraries } from "./components/dashboard/DashboardLibraries";
import { DashboardLibraryDetail } from "./components/dashboard/DashboardLibraryDetail";
import { DashboardShops } from "./components/dashboard/DashboardShops";
import { DashboardShopEditor } from "./components/dashboard/DashboardShopEditor";
import { DashboardAdminPIM } from "./components/dashboard/DashboardAdminPIM";
import { PublicShop } from "./components/shop/PublicShop";

export const router = createBrowserRouter([
  // Boutique publique — hors du layout de l'app
  { path: "/shop/:slug", element: <PublicShop /> },

  // App principale
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <ConfiguratorPage /> },
      { path: "product/:id", element: <ProductSheet /> },
      { path: "personalization/:id", element: <PersonalizationPage /> },
      { path: "reset-password", element: <ResetPasswordPage /> },
      {
        path: "dashboard",
        element: <DashboardLayout />,
        children: [
          { index: true, element: <DashboardProfile /> },
          { path: "plan", element: <DashboardPlan /> },
          { path: "preferences", element: <DashboardPreferences /> },
          { path: "history", element: <DashboardHistory /> },
          { path: "quotes", element: <DashboardQuotes /> },
          { path: "orders", element: <DashboardOrders /> },
          { path: "clients", element: <DashboardClients /> },
          { path: "library", element: <DashboardLibraries /> },
          { path: "library/:id", element: <DashboardLibraryDetail /> },
          { path: "shops", element: <DashboardShops /> },
          { path: "shops/:id", element: <DashboardShopEditor /> },
          { path: "admin/pim", element: <DashboardAdminPIM /> },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
