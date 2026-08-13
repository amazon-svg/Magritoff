import { defineSurfaceContribution } from '../../surfaces/registry';

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
