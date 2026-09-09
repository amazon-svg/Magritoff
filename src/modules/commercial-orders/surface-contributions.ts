import { defineSurfaceContribution } from '../../surfaces/registry';

/**
 * E10.16 — CA6 : accessible SEULEMENT par URL directe, aucune grille de
 * commandes dans ce lot (decision #7/reserve (f), docs/api/CONVENTIONS.md
 * §8.17 : « le seul chemin d acces reellement livrable par ce lot »).
 * AUCUNE ENTREE DE NAVIGATION n est donc ajoutee ici — l inventer serait
 * presenter un point d entree que la story ne demande pas.
 *
 * Chemin `commercial-orders/:orderId`, PAS `orders/:orderId` : `orders`
 * (path `orders`, route `orders.workspace.list`) est deja pris par le
 * module `orders` — un ecran DIFFERENT et INCOMPATIBLE (commandes
 * BOUTIQUE/storefront, `tenant_orders`), meme frontiere que celle deja
 * posee cote API entre `/commercial-orders` et `/api/v1/orders` (verifiee
 * §8.17 §0 verification n°4). Meme patron que `commercial-quotes/:quoteId`
 * (module voisin, meme frontiere devis boutique/gescom).
 */
export const commercialOrdersWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'commercial-orders',
  surface: 'workspace',
  routes: [
    {
      id: 'commercial-orders.workspace.detail',
      moduleId: 'commercial-orders',
      featureId: 'commercial-orders.workspace-detail',
      surface: 'workspace',
      path: 'commercial-orders/:orderId',
      mount: 'router',
      requiredCapabilities: ['commercial-orders.read'],
    },
  ],
  navigation: [],
} as const);
