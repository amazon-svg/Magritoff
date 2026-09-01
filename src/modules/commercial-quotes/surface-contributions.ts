import { defineSurfaceContribution } from '../../surfaces/registry';

/**
 * Pas de route de LISTE dediee dans cette story (E10.3) : le point d entree
 * est le bouton « Creer un devis » dans l en-tete d un projet (CA1), pas une
 * bibliotheque de devis a parcourir. Le module `quotes` (legacy, storefront)
 * porte deja une route `quotes` sans rapport avec ce domaine — ne pas la
 * recouvrir ni la reutiliser.
 */
export const commercialQuotesWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'commercial-quotes',
  surface: 'workspace',
  routes: [
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
  navigation: [],
} as const);
