import { defineSurfaceContribution } from '../../surfaces/registry';

export const quotesStorefrontContribution = defineSurfaceContribution({
  moduleId: 'quotes', surface: 'storefront',
  routes: [{ id: 'quotes.storefront.create', moduleId: 'quotes', featureId: 'quotes.storefront-request', surface: 'storefront', path: 'quote', mount: 'host', availability: 'planned', requiredCapabilities: ['quotes.create'] }], navigation: [],
} as const);
export const quotesCustomerPortalContribution = defineSurfaceContribution({
  moduleId: 'quotes', surface: 'customer-portal',
  routes: [{ id: 'quotes.customer-portal.list', moduleId: 'quotes', featureId: 'quotes.customer-history', surface: 'customer-portal', path: 'account/quotes', mount: 'host', requiredCapabilities: ['quotes.read.own'] }], navigation: [],
} as const);
export const quotesWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'quotes', surface: 'workspace',
  routes: [
    { id: 'quotes.workspace.list', moduleId: 'quotes', featureId: 'quotes.workspace-library', surface: 'workspace', path: 'quotes', mount: 'router', requiredCapabilities: ['quotes.read.tenant'] },
    { id: 'quotes.workspace.pending', moduleId: 'quotes', featureId: 'quotes.workspace-review', surface: 'workspace', path: 'quotes/pending', mount: 'router', requiredCapabilities: ['quotes.validate'] },
    { id: 'quotes.workspace.edit', moduleId: 'quotes', featureId: 'quotes.workspace-library', surface: 'workspace', path: 'quotes/:id/edit', mount: 'router', requiredCapabilities: ['quotes.manage'] },
  ],
  navigation: [
    { id: 'quotes.workspace.navigation', moduleId: 'quotes', featureId: 'quotes.workspace-library', surface: 'workspace', routeId: 'quotes.workspace.list', groupId: 'commercial', label: 'Devis', iconId: 'file-text', order: 100, exact: true },
    { id: 'quotes.workspace.pending-navigation', moduleId: 'quotes', featureId: 'quotes.workspace-review', surface: 'workspace', routeId: 'quotes.workspace.pending', groupId: 'commercial', label: 'Devis en attente', iconId: 'file-clock', order: 110, nested: true },
  ],
} as const);
export const quotesBackofficeContribution = defineSurfaceContribution({
  moduleId: 'quotes', surface: 'backoffice',
  routes: [{ id: 'quotes.backoffice.pending', moduleId: 'quotes', featureId: 'quotes.workspace-review', surface: 'backoffice', path: 'quotes/pending', mount: 'router', availability: 'planned', requiredCapabilities: ['quotes.validate'] }],
  navigation: [{ id: 'quotes.backoffice.navigation', moduleId: 'quotes', featureId: 'quotes.workspace-review', surface: 'backoffice', routeId: 'quotes.backoffice.pending', groupId: 'commercial', label: 'Devis en attente', iconId: 'file-clock', order: 90 }],
} as const);
