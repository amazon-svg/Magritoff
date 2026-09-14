import { defineSurfaceContribution } from '../../surfaces/registry';

/**
 * E10.16 (fiche) — CA6 : accessible par URL directe. E10.18a (grille,
 * `commercial-orders.workspace.list`) ajoute le point d entree qu E10.16
 * disait explicitement absent (decision #7/reserve (f) de l epoque,
 * docs/api/CONVENTIONS.md §8.17) : la grille existe desormais, portee par
 * le besoin du contrat "la periode, a la grille d abord" (§8.24 point 2).
 *
 * Chemin `commercial-orders/:orderId` (fiche) / `commercial-orders`
 * (grille), PAS `orders`/`orders/:orderId` : `orders` (path `orders`, route
 * `orders.workspace.list`) est deja pris par le module `orders` — un ecran
 * DIFFERENT et INCOMPATIBLE (commandes BOUTIQUE/storefront, `tenant_orders`),
 * meme frontiere que celle deja posee cote API entre `/commercial-orders` et
 * `/api/v1/orders` (verifiee §8.17 §0 verification n°4). Meme patron que
 * `commercial-quotes` (module voisin, meme frontiere devis boutique/gescom) :
 * liste et fiche sur DEUX chemins distincts, ici tous deux prefixes
 * `commercial-orders` (contrairement a `quotes`/`commercial-quotes/:id`,
 * heritage de l ancien module `quotes` legacy que `commercial-orders` n a
 * jamais eu a porter).
 *
 * ENTREE DE NAVIGATION "Commandes atelier" ajoutee en E10.18e-1
 * (docs/api/CONVENTIONS.md §8.24, decision 4 d Arnaud du 2026-09-14, levee
 * de la reserve posee par E10.18a) : la grille etait accessible par URL
 * directe UNIQUEMENT jusque-la — le module `orders` porte une entree de
 * sidebar "Commandes" DISTINCTE (commandes BOUTIQUE), non renommee.
 * `iconId: 'factory'` (jamais `'shopping-bag'`, deja pris par `orders` —
 * memes deux entrees, icones DIFFERENTES pour eviter la confusion), pris
 * dans le catalogue deja enregistre de `DashboardLayout.tsx`
 * (`WORKSPACE_ICONS`), deja porte par "Parcs machines" (meme precedent de
 * partage qu 'file-text' entre Devis et Gabarits PDF).
 */
export const commercialOrdersWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'commercial-orders',
  surface: 'workspace',
  routes: [
    {
      id: 'commercial-orders.workspace.list',
      moduleId: 'commercial-orders',
      featureId: 'commercial-orders.workspace-list',
      surface: 'workspace',
      path: 'commercial-orders',
      mount: 'router',
      requiredCapabilities: ['commercial-orders.read'],
    },
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
  navigation: [
    {
      id: 'commercial-orders.workspace.navigation',
      moduleId: 'commercial-orders',
      featureId: 'commercial-orders.workspace-list',
      surface: 'workspace',
      routeId: 'commercial-orders.workspace.list',
      groupId: 'commercial',
      label: 'Commandes atelier',
      iconId: 'factory',
      order: 135,
    },
  ],
} as const);
