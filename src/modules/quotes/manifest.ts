import { defineModuleManifest } from '../../surfaces/registry';

export const quotesModuleManifest = defineModuleManifest({
  id: 'quotes', name: 'Devis',
  features: [
    { id: 'quotes.storefront-request', description: 'Créer un devis depuis une boutique.' },
    { id: 'quotes.customer-history', description: 'Consulter ses devis depuis le portail client.' },
    { id: 'quotes.workspace-library', description: 'Gérer la bibliothèque de devis du tenant.' },
    { id: 'quotes.workspace-review', description: 'Traiter les devis en attente.' },
  ],
  capabilities: [
    { id: 'quotes.create', description: 'Créer un devis.' },
    { id: 'quotes.read.own', description: 'Consulter ses propres devis.' },
    { id: 'quotes.read.tenant', description: 'Consulter les devis du tenant.' },
    { id: 'quotes.manage', description: 'Modifier les devis du tenant.' },
    { id: 'quotes.validate', description: 'Valider les devis en attente.' },
  ],
  surfaces: ['storefront', 'customer-portal', 'workspace', 'backoffice'],
} as const);
