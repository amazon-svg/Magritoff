import { defineModuleManifest } from '../../surfaces/registry';

export const librariesModuleManifest = defineModuleManifest({
  id: 'libraries',
  name: 'Bibliothèques produits',
  features: [
    { id: 'libraries.workspace-list', description: 'Lister et organiser les bibliothèques du tenant.' },
    { id: 'libraries.workspace-detail', description: 'Gérer les produits d une bibliothèque.' },
  ],
  capabilities: [
    { id: 'libraries.read', description: 'Consulter les bibliothèques du tenant.' },
    { id: 'libraries.manage', description: 'Gérer les bibliothèques et leurs produits.' },
  ],
  surfaces: ['workspace'],
} as const);
