import { defineSurfaceContribution } from '../../surfaces/registry';

export const membersWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'members',
  surface: 'workspace',
  routes: [{
    id: 'members.workspace.list', moduleId: 'members',
    featureId: 'members.workspace-administration', surface: 'workspace',
    path: 'users', mount: 'router', requiredCapabilities: ['members.manage'],
  }],
  navigation: [{
    id: 'members.workspace.navigation', moduleId: 'members',
    featureId: 'members.workspace-administration', surface: 'workspace',
    routeId: 'members.workspace.list', groupId: 'commercial',
    label: 'Utilisateurs', iconId: 'users', order: 190,
    testId: 'nav-sidebar-users-link',
  }],
} as const);
