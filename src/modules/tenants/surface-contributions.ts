import { defineSurfaceContribution } from '../../surfaces/registry';

export const tenantsWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'tenants',
  surface: 'workspace',
  routes: [
    {
      id: 'tenants.workspace.settings', moduleId: 'tenants',
      featureId: 'tenants.workspace-settings', surface: 'workspace',
      path: 'settings', mount: 'router', requiredCapabilities: ['tenants.manage-settings'],
    },
    {
      id: 'tenants.workspace.spaces', moduleId: 'tenants',
      featureId: 'tenants.workspace-children', surface: 'workspace',
      path: 'spaces', mount: 'router', requiredCapabilities: ['tenants.manage-children'],
    },
  ],
  navigation: [
    {
      id: 'tenants.workspace.settings-navigation', moduleId: 'tenants',
      featureId: 'tenants.workspace-settings', surface: 'workspace',
      routeId: 'tenants.workspace.settings', groupId: 'settings',
      label: "Paramètres de l'espace", iconId: 'settings', order: 400,
    },
    {
      id: 'tenants.workspace.spaces-navigation', moduleId: 'tenants',
      featureId: 'tenants.workspace-children', surface: 'workspace',
      routeId: 'tenants.workspace.spaces', groupId: 'settings',
      label: 'Sous-espaces', iconId: 'building', order: 420, nested: true,
    },
  ],
} as const);
