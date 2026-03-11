import { createBrowserRouter } from "react-router";
import { MainLayout } from "./components/MainLayout";
import { ConfiguratorPage } from "./components/ConfiguratorPage";
import { ProductSheet } from "./components/ProductSheet";
import { PersonalizationPage } from "./components/PersonalizationPage";
import { NotFound } from "./components/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <ConfiguratorPage /> },
      { path: "product/:id", element: <ProductSheet /> },
      { path: "personalization/:id", element: <PersonalizationPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);