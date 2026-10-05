import { defineModuleManifest } from '../../surfaces/registry';

export const commercialOrdersModuleManifest = defineModuleManifest({
  id: 'commercial-orders',
  // Nom technique du workflow devis. Le produit expose un seul domaine
  // Commandes ; ce manifeste ne contribue plus d entree de navigation.
  name: 'Commandes issues de devis',
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
        '(created_from/created_to, fuseau Europe/Paris, E10.18a), par client et par etape de ' +
        'production courante, et triable (date de creation ou etape de production, ' +
        'E10.18e-1) — integree au modele de lecture Commandes commun — avant l export ' +
        'comptable (E10.18e-2+).',
    },
  ],
  capabilities: [
    { id: 'commercial-orders.read', description: 'Consulter les commandes de gestion commerciale du tenant.' },
  ],
  surfaces: ['workspace'],
} as const);
