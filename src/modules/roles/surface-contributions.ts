import { defineSurfaceContribution } from '../../surfaces/registry';

export const rolesWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'roles',
  surface: 'workspace',
  routes: [{
    id: 'roles.workspace.workflow', moduleId: 'roles',
    featureId: 'roles.workspace-administration', surface: 'workspace',
    path: 'order-roles', mount: 'router', requiredCapabilities: ['roles.manage'],
  }],
  navigation: [{
    id: 'roles.workspace.navigation', moduleId: 'roles',
    featureId: 'roles.workspace-administration', surface: 'workspace',
    routeId: 'roles.workspace.workflow', groupId: 'settings',
    label: 'Workflow & rôles', iconId: 'workflow', order: 440,
  }],
} as const);
