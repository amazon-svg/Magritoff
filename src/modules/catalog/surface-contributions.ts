import { defineSurfaceContribution } from '../../surfaces/registry';

export const catalogStorefrontContribution = defineSurfaceContribution({
  moduleId: 'catalog',
  surface: 'storefront',
  routes: [
    {
      id: 'catalog.storefront.list', moduleId: 'catalog',
      featureId: 'catalog.storefront-browse', surface: 'storefront',
      path: 'catalog', mount: 'host', requiredCapabilities: ['catalog.read-storefront'],
    },
    {
      id: 'catalog.storefront.gamme', moduleId: 'catalog',
      featureId: 'catalog.storefront-browse', surface: 'storefront',
      path: 'g/:gammeSlug', mount: 'host', requiredCapabilities: ['catalog.read-storefront'],
    },
    {
      id: 'catalog.storefront.product', moduleId: 'catalog',
      featureId: 'catalog.storefront-browse', surface: 'storefront',
      path: 'p/:productId', mount: 'host', requiredCapabilities: ['catalog.read-storefront'],
    },
  ],
  navigation: [],
} as const);

export const catalogWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'catalog',
  surface: 'workspace',
  routes: [
    {
      id: 'catalog.workspace.gammes', moduleId: 'catalog',
      featureId: 'catalog.workspace-gammes', surface: 'workspace',
      path: 'gammes', mount: 'router', requiredCapabilities: ['catalog.manage-subscriptions'],
    },
    {
      id: 'catalog.workspace.pim', moduleId: 'catalog',
      featureId: 'catalog.workspace-pim', surface: 'workspace',
      path: 'admin/pim', mount: 'router', requiredCapabilities: ['catalog.govern-pim'],
    },
  ],
  navigation: [
    {
      id: 'catalog.workspace.pim-navigation', moduleId: 'catalog',
      featureId: 'catalog.workspace-pim', surface: 'workspace',
      routeId: 'catalog.workspace.pim', groupId: 'catalog',
      label: 'PIM — Produits', iconId: 'shield', order: 200,
    },
    {
      id: 'catalog.workspace.gammes-navigation', moduleId: 'catalog',
      featureId: 'catalog.workspace-gammes', surface: 'workspace',
      routeId: 'catalog.workspace.gammes', groupId: 'catalog',
      label: 'Gammes actives', iconId: 'layers', order: 220,
    },
  ],
} as const);
