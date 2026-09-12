import { defineModuleManifest } from '../../surfaces/registry';

export const commercialOrdersModuleManifest = defineModuleManifest({
  id: 'commercial-orders',
  // "Commandes atelier", PAS "Commandes" (qa-review E10.18a round 1,
  // arbitrage Arnaud 2026-09-12) : `src/modules/orders/manifest.ts` (module
  // COMMANDES BOUTIQUE, domaine sans rapport) declare deja `name: 'Commandes'`
  // — une collision de libelle qui deviendrait visible des que l un des deux
  // modules gagne une entree de navigation ou un selecteur de module.
  name: 'Commandes atelier',
  features: [
    {
      id: 'commercial-orders.workspace-detail',
      description:
        'Consulter la fiche complete d une commande de gestion commerciale : entete, client, ' +
        'interlocuteur, devis d origine, lignes au format PricedLine, statut/etape de production ' +
        '(E10.16). Lecture seule (CA7) — aucune modification de prix.',
    },
    {
      id: 'commercial-orders.workspace-list',
      description:
        'Grille des commandes de gestion commerciale, filtrable par periode de creation ' +
        '(created_from/created_to, fuseau Europe/Paris, E10.18a) — "la periode, a la grille ' +
        'd abord" avant l export comptable (E10.18b+).',
    },
  ],
  capabilities: [
    { id: 'commercial-orders.read', description: 'Consulter les commandes de gestion commerciale du tenant.' },
  ],
  surfaces: ['workspace'],
} as const);
