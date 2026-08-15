import { defineSurfaceContribution } from '../../surfaces/registry';

export const plansWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'plans',
  surface: 'workspace',
  routes: [{
    id: 'plans.workspace.selection', moduleId: 'plans',
    featureId: 'plans.workspace-selection', surface: 'workspace',
    path: 'plan', mount: 'router',
  }],
  navigation: [{
    id: 'plans.workspace.navigation', moduleId: 'plans',
    featureId: 'plans.workspace-selection', surface: 'workspace',
    routeId: 'plans.workspace.selection', groupId: 'settings',
    label: 'Plan & abonnement', iconId: 'credit-card', order: 460,
  }],
} as const);
