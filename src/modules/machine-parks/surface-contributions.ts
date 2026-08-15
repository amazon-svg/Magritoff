import { defineSurfaceContribution } from '../../surfaces/registry';

export const machineParksWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'machine-parks',
  surface: 'workspace',
  routes: [
    {
      id: 'machine-parks.workspace.list', moduleId: 'machine-parks',
      featureId: 'machine-parks.workspace-list', surface: 'workspace',
      path: 'machines', mount: 'router', requiredCapabilities: ['machine-parks.read'],
    },
    {
      id: 'machine-parks.workspace.wizard', moduleId: 'machine-parks',
      featureId: 'machine-parks.workspace-wizard', surface: 'workspace',
      path: 'machines/wizard', mount: 'router', requiredCapabilities: ['machine-parks.manage'],
    },
    {
      id: 'machine-parks.workspace.detail', moduleId: 'machine-parks',
      featureId: 'machine-parks.workspace-detail', surface: 'workspace',
      path: 'machines/:parkId', mount: 'router', requiredCapabilities: ['machine-parks.manage'],
    },
  ],
  navigation: [{
    id: 'machine-parks.workspace.navigation', moduleId: 'machine-parks',
    featureId: 'machine-parks.workspace-list', surface: 'workspace',
    routeId: 'machine-parks.workspace.list', groupId: 'production',
    label: 'Parc machine', iconId: 'factory', order: 300,
  }],
} as const);
