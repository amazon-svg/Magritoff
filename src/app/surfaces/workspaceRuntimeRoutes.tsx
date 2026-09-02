import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { workspaceSurface } from '@/surfaces/workspace';

type PageModule = Readonly<{ default: ComponentType }>;
type LazyPageLoader = () => Promise<PageModule>;

const routeLoaders: Readonly<Record<string, LazyPageLoader>> = Object.freeze({
  'account.workspace.settings': () =>
    import('@/modules/account/ui').then((module) => ({
      default: module.DashboardAccount,
    })),
  'orders.workspace.list': () =>
    import('@/modules/orders/ui').then((module) => ({
      default: module.DashboardOrders,
    })),
  'shops.workspace.list': () =>
    import('@/modules/shops/ui').then((module) => ({ default: module.DashboardShops })),
  'shops.workspace.edit': () =>
    import('@/modules/shops/ui').then((module) => ({ default: module.DashboardShopEditor })),
  'quote-templates.workspace.list': () => import('@/modules/quote-templates/ui').then((module) => ({ default: module.DashboardQuoteTemplates })),
  'libraries.workspace.list': () => import('@/modules/libraries/ui').then((module) => ({ default: module.DashboardLibraries })),
  'libraries.workspace.detail': () => import('@/modules/libraries/ui').then((module) => ({ default: module.DashboardLibraryDetail })),
  'catalog.workspace.gammes': () => import('@/modules/catalog/ui').then((module) => ({ default: module.DashboardTenantGammes })),
  'catalog.workspace.pim': () => import('@/modules/catalog/ui').then((module) => ({ default: module.DashboardAdminPIM })),
  'commercial.workspace.pricing': () => import('@/modules/commercial/ui').then((module) => ({ default: module.DashboardCommercial })),
  'customers.workspace.list': () => import('@/modules/customers/ui').then((module) => ({ default: module.DashboardCustomers })),
  'customers.workspace.detail': () => import('@/modules/customers/ui').then((module) => ({ default: module.DashboardCustomerDetail })),
  'projects.workspace.list': () => import('@/modules/projects/ui').then((module) => ({ default: module.DashboardProjects })),
  'projects.workspace.detail': () => import('@/modules/projects/ui').then((module) => ({ default: module.DashboardProjectDetail })),
  'commercial-quotes.workspace.list': () => import('@/modules/commercial-quotes/ui').then((module) => ({ default: module.DashboardQuotes })),
  'commercial-quotes.workspace.editor': () => import('@/modules/commercial-quotes/ui').then((module) => ({ default: module.QuoteEditorPage })),
  'members.workspace.list': () => import('@/modules/members/ui').then((module) => ({ default: module.MembersPage })),
  'tenants.workspace.settings': () => import('@/modules/tenants/ui').then((module) => ({ default: module.DashboardTenantSettings })),
  'tenants.workspace.spaces': () => import('@/modules/tenants/ui').then((module) => ({ default: module.DashboardTenantSpaces })),
  'conversations.workspace.history': () => import('@/modules/conversations/ui').then((module) => ({ default: module.DashboardHistory })),
  'machine-parks.workspace.list': () => import('@/modules/machine-parks/ui').then((module) => ({ default: module.DashboardMachines })),
  'machine-parks.workspace.wizard': () => import('@/modules/machine-parks/ui').then((module) => ({ default: module.MachineParkWizard })),
  'machine-parks.workspace.detail': () => import('@/modules/machine-parks/ui').then((module) => ({ default: module.MachineParkDetail })),
  'mockups.workspace.reference': () => import('@/modules/mockups/ui').then((module) => ({ default: module.DashboardAdminMockups })),
  'plans.workspace.selection': () => import('@/modules/plans/ui').then((module) => ({ default: module.DashboardPlan })),
  'pricing.workspace.rules': () => import('@/modules/pricing/ui').then((module) => ({ default: module.DashboardPricingRules })),
});

export type WorkspaceRuntimeRoute = Readonly<{
  id: string;
  path: string;
  Component: LazyExoticComponent<ComponentType>;
  requiredCapabilities: readonly string[];
  requiredTenantRole?: 'admin';
}>;

export const workspaceRuntimeRoutes: readonly WorkspaceRuntimeRoute[] = workspaceSurface.routes
  .filter((route) => route.mount === 'router')
  .map((route) => {
    const loader = routeLoaders[route.id];
    if (!loader) throw new Error(`Aucun loader lazy pour la route workspace ${route.id}.`);
    return Object.freeze({
      id: route.id,
      path: route.path,
      Component: lazy(loader),
      requiredCapabilities: route.requiredCapabilities ?? [],
      ...(route.requiredTenantRole ? { requiredTenantRole: route.requiredTenantRole } : {}),
    });
  });
