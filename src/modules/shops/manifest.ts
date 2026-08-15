import { defineModuleManifest } from '../../surfaces/registry';

export const shopsModuleManifest = defineModuleManifest({
  id: 'shops',
  name: 'Boutiques',
  features: [
    { id: 'shops.public-catalog', description: 'Afficher une boutique et son catalogue.' },
    { id: 'shops.workspace-management', description: 'Créer et configurer les boutiques du tenant.' },
    { id: 'shops.backoffice-governance', description: 'Administrer les boutiques et leurs actifs de marque.' },
  ],
  capabilities: [
    { id: 'shops.manage', description: 'Gérer les boutiques du tenant.' },
    { id: 'shops.govern', description: 'Administrer les boutiques depuis le backoffice.' },
  ],
  surfaces: ['storefront', 'workspace', 'backoffice'],
} as const);
