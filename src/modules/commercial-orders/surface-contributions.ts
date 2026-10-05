import { defineSurfaceContribution } from '../../surfaces/registry';

/**
 * E10.16 (fiche) — CA6 : accessible par URL directe. E10.18a (grille,
 * `commercial-orders.workspace.list`) ajoute le point d entree qu E10.16
 * disait explicitement absent (decision #7/reserve (f) de l epoque,
 * docs/api/CONVENTIONS.md §8.17) : la grille existe desormais, portee par
 * le besoin du contrat "la periode, a la grille d abord" (§8.24 point 2).
 *
 * Depuis PD-2026-10-05-COMMANDES-UNIQUE, ces chemins ne sont plus que des
 * alias de compatibilite. La navigation et les liens nouveaux pointent vers
 * `orders`/`orders/:orderId`, objet metier et fiche uniques. Les workflows
 * d entree restent distincts ; leur origine ne cree plus un second menu.
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
  navigation: [],
} as const);
