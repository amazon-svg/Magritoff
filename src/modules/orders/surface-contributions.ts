import { defineSurfaceContribution } from '../../surfaces/registry';

export const ordersStorefrontContribution = defineSurfaceContribution({
  moduleId: 'orders', surface: 'storefront',
  routes: [{ id: 'orders.storefront.checkout', moduleId: 'orders', featureId: 'orders.checkout', surface: 'storefront', path: 'checkout', mount: 'host', requiredCapabilities: ['orders.create'] }],
  navigation: [],
} as const);

export const ordersCustomerPortalContribution = defineSurfaceContribution({
  moduleId: 'orders', surface: 'customer-portal',
  routes: [{ id: 'orders.customer-portal.list', moduleId: 'orders', featureId: 'orders.customer-history', surface: 'customer-portal', path: 'account/orders', mount: 'host', requiredCapabilities: ['orders.read.own'] }],
  navigation: [],
} as const);

export const ordersWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'orders', surface: 'workspace',
  routes: [{ id: 'orders.workspace.list', moduleId: 'orders', featureId: 'orders.workspace-management', surface: 'workspace', path: 'orders', mount: 'router', requiredCapabilities: ['orders.read.tenant'] }],
  navigation: [{ id: 'orders.workspace.navigation', moduleId: 'orders', featureId: 'orders.workspace-management', surface: 'workspace', routeId: 'orders.workspace.list', groupId: 'commercial', label: 'Commandes', iconId: 'shopping-bag', order: 140 }],
} as const);

export const ordersBackofficeContribution = defineSurfaceContribution({
  moduleId: 'orders', surface: 'backoffice',
  routes: [{ id: 'orders.backoffice.production', moduleId: 'orders', featureId: 'orders.production-management', surface: 'backoffice', path: 'orders', mount: 'router', availability: 'planned', requiredCapabilities: ['orders.transition'] }],
  navigation: [{ id: 'orders.backoffice.navigation', moduleId: 'orders', featureId: 'orders.production-management', surface: 'backoffice', routeId: 'orders.backoffice.production', groupId: 'production', label: 'Commandes', iconId: 'shopping-bag', order: 100 }],
} as const);
