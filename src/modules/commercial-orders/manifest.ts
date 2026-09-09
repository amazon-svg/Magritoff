import { defineModuleManifest } from '../../surfaces/registry';

export const commercialOrdersModuleManifest = defineModuleManifest({
  id: 'commercial-orders',
  name: 'Commandes',
  features: [
    {
      id: 'commercial-orders.workspace-detail',
      description:
        'Consulter la fiche complete d une commande de gestion commerciale : entete, client, ' +
        'interlocuteur, devis d origine, lignes au format PricedLine, statut/etape de production ' +
        '(E10.16). Lecture seule (CA7) — aucune modification de prix.',
    },
  ],
  capabilities: [
    { id: 'commercial-orders.read', description: 'Consulter les commandes de gestion commerciale du tenant.' },
  ],
  surfaces: ['workspace'],
} as const);
