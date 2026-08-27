import { defineSurfaceContribution } from '../../surfaces/registry';

export const hopStudioWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'hopstudio',
  surface: 'workspace',
  routes: [{
    id: 'hopstudio.workspace.settings',
    moduleId: 'hopstudio',
    featureId: 'hopstudio.tenant-settings',
    surface: 'workspace',
    path: 'clariprint-studio',
    mount: 'router',
    requiredTenantRole: 'admin',
  }],
  navigation: [{
    id: 'hopstudio.workspace.settings-navigation',
    moduleId: 'hopstudio',
    featureId: 'hopstudio.tenant-settings',
    surface: 'workspace',
    routeId: 'hopstudio.workspace.settings',
    groupId: 'settings',
    label: 'Clariprint Studio',
    iconId: 'workflow',
    order: 440,
  }],
} as const);
