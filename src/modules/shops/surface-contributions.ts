import { defineSurfaceContribution } from '../../surfaces/registry';

export const shopsStorefrontContribution = defineSurfaceContribution({
  moduleId: 'shops', surface: 'storefront',
  routes: [{ id: 'shops.storefront.root', moduleId: 'shops', featureId: 'shops.public-catalog', surface: 'storefront', path: 'shop/:slug', mount: 'host' }],
  navigation: [],
} as const);

export const shopsWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'shops', surface: 'workspace',
  routes: [
    { id: 'shops.workspace.list', moduleId: 'shops', featureId: 'shops.workspace-management', surface: 'workspace', path: 'shops', mount: 'router', requiredCapabilities: ['shops.manage'] },
    { id: 'shops.workspace.edit', moduleId: 'shops', featureId: 'shops.workspace-management', surface: 'workspace', path: 'shops/:id', mount: 'router', requiredCapabilities: ['shops.manage'] },
  ],
  navigation: [{ id: 'shops.workspace.navigation', moduleId: 'shops', featureId: 'shops.workspace-management', surface: 'workspace', routeId: 'shops.workspace.list', groupId: 'commercial', label: 'Boutiques', iconId: 'store', order: 180 }],
} as const);

export const shopsBackofficeContribution = defineSurfaceContribution({
  moduleId: 'shops', surface: 'backoffice',
  routes: [{ id: 'shops.backoffice.list', moduleId: 'shops', featureId: 'shops.backoffice-governance', surface: 'backoffice', path: 'shops', mount: 'router', requiredCapabilities: ['shops.govern'] }],
  navigation: [{ id: 'shops.backoffice.navigation', moduleId: 'shops', featureId: 'shops.backoffice-governance', surface: 'backoffice', routeId: 'shops.backoffice.list', groupId: 'governance', label: 'Boutiques', iconId: 'store', order: 120 }],
} as const);
