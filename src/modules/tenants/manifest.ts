import { defineModuleManifest } from '../../surfaces/registry';

export const tenantsModuleManifest = defineModuleManifest({
  id: 'tenants',
  name: 'Espaces Magrit',
  features: [
    { id: 'tenants.workspace-settings', description: 'Configurer l identité de l espace actif.' },
    { id: 'tenants.workspace-children', description: 'Administrer les sous-espaces du tenant racine.' },
  ],
  capabilities: [
    { id: 'tenants.manage-settings', description: 'Modifier le nom et les paramètres de l espace.' },
    { id: 'tenants.manage-children', description: 'Créer, consulter et supprimer des sous-espaces.' },
  ],
  surfaces: ['workspace'],
} as const);
