import { defineModuleManifest } from '../../surfaces/registry';

export const catalogModuleManifest = defineModuleManifest({
  id: 'catalog',
  name: 'Catalogue produits',
  features: [
    { id: 'catalog.workspace-gammes', description: 'Configurer les gammes actives du tenant.' },
    { id: 'catalog.workspace-pim', description: 'Administrer le référentiel produit Magrit.' },
  ],
  capabilities: [
    { id: 'catalog.manage-subscriptions', description: 'Gérer les souscriptions de gammes du tenant.' },
    { id: 'catalog.govern-pim', description: 'Administrer le référentiel produit global.' },
  ],
  surfaces: ['workspace'],
} as const);
