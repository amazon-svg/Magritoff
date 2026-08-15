import { defineSurfaceContribution } from '../../surfaces/registry';

export const quoteTemplatesWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'quote-templates',
  surface: 'workspace',
  routes: [{
    id: 'quote-templates.workspace.list', moduleId: 'quote-templates',
    featureId: 'quote-templates.workspace-management', surface: 'workspace',
    path: 'quote-templates', mount: 'router', requiredCapabilities: ['quote-templates.manage'],
  }],
  navigation: [{
    id: 'quote-templates.workspace.navigation', moduleId: 'quote-templates',
    featureId: 'quote-templates.workspace-management', surface: 'workspace',
    routeId: 'quote-templates.workspace.list', groupId: 'commercial',
    label: 'Gabarits de devis', iconId: 'layout-template', order: 120,
    nested: true,
  }],
} as const);
