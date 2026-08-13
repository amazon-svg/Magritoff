import { defineSurfaceContribution } from '../../surfaces/registry';

export const librariesWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'libraries',
  surface: 'workspace',
  routes: [
    { id: 'libraries.workspace.list', moduleId: 'libraries', featureId: 'libraries.workspace-list', surface: 'workspace', path: 'library', mount: 'router', requiredCapabilities: ['libraries.read'] },
    { id: 'libraries.workspace.detail', moduleId: 'libraries', featureId: 'libraries.workspace-detail', surface: 'workspace', path: 'library/:id', mount: 'router', requiredCapabilities: ['libraries.manage'] },
  ],
  navigation: [{
    id: 'libraries.workspace.navigation', moduleId: 'libraries',
    featureId: 'libraries.workspace-list', surface: 'workspace',
    routeId: 'libraries.workspace.list', groupId: 'catalog',
    label: 'Bibliothèques', iconId: 'package', order: 240,
  }],
} as const);
