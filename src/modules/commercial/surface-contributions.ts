import { defineSurfaceContribution } from '../../surfaces/registry';

export const commercialWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'commercial',
  surface: 'workspace',
  routes: [{
    id: 'commercial.workspace.pricing', moduleId: 'commercial',
    featureId: 'commercial.workspace-pricing', surface: 'workspace',
    path: 'commercial', mount: 'router', requiredCapabilities: ['commercial.manage'],
  }],
  navigation: [],
} as const);
