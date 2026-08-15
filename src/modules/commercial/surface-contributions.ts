import { defineSurfaceContribution } from '../../surfaces/registry';

export const commercialWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'commercial',
  surface: 'workspace',
  routes: [{
    id: 'commercial.workspace.pricing', moduleId: 'commercial',
    featureId: 'commercial.workspace-pricing', surface: 'workspace',
    path: 'commercial', mount: 'router', requiredCapabilities: ['commercial.manage'],
  }],
  navigation: [{
    id: 'commercial.workspace.navigation', moduleId: 'commercial',
    featureId: 'commercial.workspace-pricing', surface: 'workspace',
    routeId: 'commercial.workspace.pricing', groupId: 'commercial',
    label: 'Prix & marges', iconId: 'badge-percent', order: 160,
  }],
} as const);
