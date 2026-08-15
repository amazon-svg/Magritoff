import { defineModuleManifest } from '../../surfaces/registry';

export const commercialModuleManifest = defineModuleManifest({
  id: 'commercial',
  name: 'Gestion commerciale',
  features: [
    { id: 'commercial.workspace-pricing', description: 'Gérer les groupes clients et les règles de prix du tenant.' },
  ],
  capabilities: [
    { id: 'commercial.manage', description: 'Gérer les prix, marges, remises et groupes clients.' },
  ],
  surfaces: ['workspace'],
} as const);
