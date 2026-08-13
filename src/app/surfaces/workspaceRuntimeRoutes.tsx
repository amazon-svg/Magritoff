import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { workspaceSurface } from '../../surfaces/workspace';

type PageModule = Readonly<{ default: ComponentType }>;
type LazyPageLoader = () => Promise<PageModule>;

const routeLoaders: Readonly<Record<string, LazyPageLoader>> = Object.freeze({
  'account.workspace.settings': () =>
    import('../components/dashboard/DashboardAccount').then((module) => ({
      default: module.DashboardAccount,
    })),
  'orders.workspace.list': () =>
    import('../components/dashboard/DashboardOrders').then((module) => ({
      default: module.DashboardOrders,
    })),
  'shops.workspace.list': () =>
    import('../components/dashboard/DashboardShops').then((module) => ({ default: module.DashboardShops })),
  'shops.workspace.edit': () =>
    import('../components/dashboard/DashboardShopEditor').then((module) => ({ default: module.DashboardShopEditor })),
  'quotes.workspace.list': () => import('../components/dashboard/DashboardQuotes').then((module) => ({ default: module.DashboardQuotes })),
  'quotes.workspace.pending': () => import('../components/dashboard/DashboardQuotesPending').then((module) => ({ default: module.DashboardQuotesPending })),
  'quotes.workspace.edit': () => import('../components/dashboard/DashboardQuoteEditor').then((module) => ({ default: module.DashboardQuoteEditor })),
  'quote-templates.workspace.list': () => import('../components/dashboard/DashboardQuoteTemplates').then((module) => ({ default: module.DashboardQuoteTemplates })),
  'libraries.workspace.list': () => import('../components/dashboard/DashboardLibraries').then((module) => ({ default: module.DashboardLibraries })),
  'libraries.workspace.detail': () => import('../components/dashboard/DashboardLibraryDetail').then((module) => ({ default: module.DashboardLibraryDetail })),
  'catalog.workspace.gammes': () => import('../components/dashboard/DashboardTenantGammes').then((module) => ({ default: module.DashboardTenantGammes })),
  'catalog.workspace.pim': () => import('../components/dashboard/DashboardAdminPIM').then((module) => ({ default: module.DashboardAdminPIM })),
});

export type WorkspaceRuntimeRoute = Readonly<{
  id: string;
  path: string;
  Component: LazyExoticComponent<ComponentType>;
}>;

export const workspaceRuntimeRoutes: readonly WorkspaceRuntimeRoute[] = workspaceSurface.routes
  .filter((route) => route.mount === 'router')
  .map((route) => {
    const loader = routeLoaders[route.id];
    if (!loader) throw new Error(`Aucun loader lazy pour la route workspace ${route.id}.`);
    return Object.freeze({ id: route.id, path: route.path, Component: lazy(loader) });
  });
