import { defineModuleManifest } from '../../surfaces/registry';

export const hopStudioModuleManifest = defineModuleManifest({
  id: 'hopstudio',
  name: 'Clariprint Studio',
  features: [{
    id: 'hopstudio.tenant-settings',
    description: 'Configurer la connexion Clariprint Studio propre au tenant.',
  }],
  capabilities: [],
  surfaces: ['workspace'],
} as const);
