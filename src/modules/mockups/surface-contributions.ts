import { defineSurfaceContribution } from '../../surfaces/registry';

export const mockupsWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'mockups',
  surface: 'workspace',
  routes: [{
    id: 'mockups.workspace.reference', moduleId: 'mockups',
    featureId: 'mockups.workspace-reference', surface: 'workspace',
    path: 'admin/mockups', mount: 'router', requiredCapabilities: ['mockups.govern'],
  }],
  navigation: [{
    id: 'mockups.workspace.navigation', moduleId: 'mockups',
    featureId: 'mockups.workspace-reference', surface: 'workspace',
    routeId: 'mockups.workspace.reference', groupId: 'catalog',
    label: 'Visuels Magrit', iconId: 'image', order: 260,
  }],
} as const);
