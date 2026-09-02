import { defineSurfaceContribution } from '../../surfaces/registry';

/**
 * Route de liste ajoutee par le chantier d unification des devis (post
 * Sprint 5 : docs/api/CONVENTIONS.md §8.10). E10.3 ne portait volontairement
 * aucune route de liste : le point d entree etait uniquement le bouton
 * « Creer un devis » dans l en-tete d un projet (CA1). L ancien module
 * `quotes` (legacy, storefront) portait la route `quotes` du groupe
 * `commercial` — il est supprime, cette route lui succede sur le meme
 * chemin, seule entree « Devis » de la sidebar desormais.
 */
export const commercialQuotesWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'commercial-quotes',
  surface: 'workspace',
  routes: [
    {
      id: 'commercial-quotes.workspace.list',
      moduleId: 'commercial-quotes',
      featureId: 'commercial-quotes.workspace-library',
      surface: 'workspace',
      path: 'quotes',
      mount: 'router',
      requiredCapabilities: ['commercial-quotes.read'],
    },
    {
      id: 'commercial-quotes.workspace.editor',
      moduleId: 'commercial-quotes',
      featureId: 'commercial-quotes.workspace-editor',
      surface: 'workspace',
      path: 'commercial-quotes/:quoteId',
      mount: 'router',
      requiredCapabilities: ['commercial-quotes.read'],
    },
  ],
  navigation: [
    {
      id: 'commercial-quotes.workspace.navigation',
      moduleId: 'commercial-quotes',
      featureId: 'commercial-quotes.workspace-library',
      surface: 'workspace',
      routeId: 'commercial-quotes.workspace.list',
      groupId: 'commercial',
      label: 'Devis',
      iconId: 'file-text',
      order: 100,
      exact: true,
    },
  ],
} as const);
