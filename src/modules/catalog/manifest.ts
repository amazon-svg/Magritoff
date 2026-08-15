import { defineModuleManifest } from '../../surfaces/registry';

export const catalogModuleManifest = defineModuleManifest({
  id: 'catalog',
  name: 'Catalogue produits',
  features: [
    { id: 'catalog.storefront-browse', description: 'Parcourir le catalogue, les gammes et les fiches produit d’une boutique.' },
    { id: 'catalog.workspace-gammes', description: 'Configurer les gammes actives du tenant.' },
    { id: 'catalog.workspace-pim', description: 'Administrer le référentiel produit Magrit.' },
  ],
  capabilities: [
    { id: 'catalog.read-storefront', description: 'Consulter le catalogue publié d’une boutique.' },
    { id: 'catalog.manage-subscriptions', description: 'Gérer les souscriptions de gammes du tenant.' },
    { id: 'catalog.govern-pim', description: 'Administrer le référentiel produit global.' },
  ],
  surfaces: ['storefront', 'workspace'],
} as const);
