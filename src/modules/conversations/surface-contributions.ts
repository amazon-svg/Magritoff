import { defineSurfaceContribution } from '../../surfaces/registry';

export const conversationsWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'conversations',
  surface: 'workspace',
  routes: [{
    id: 'conversations.workspace.history', moduleId: 'conversations',
    featureId: 'conversations.workspace-history', surface: 'workspace',
    path: 'history', mount: 'router', requiredCapabilities: ['conversations.read'],
  }],
  navigation: [{
    id: 'conversations.workspace.navigation', moduleId: 'conversations',
    featureId: 'conversations.workspace-history', surface: 'workspace',
    routeId: 'conversations.workspace.history', groupId: 'commercial',
    label: 'Historique', iconId: 'message-square', order: 150,
  }],
} as const);
