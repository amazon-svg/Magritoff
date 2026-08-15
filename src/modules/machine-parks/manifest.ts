import { defineModuleManifest } from '../../surfaces/registry';

export const machineParksModuleManifest = defineModuleManifest({
  id: 'machine-parks',
  name: 'Parcs machine',
  features: [
    { id: 'machine-parks.workspace-list', description: 'Consulter les parcs de production du tenant.' },
    { id: 'machine-parks.workspace-wizard', description: 'Constituer un parc avec l assistant guidé.' },
    { id: 'machine-parks.workspace-detail', description: 'Configurer les machines et coûts d un parc.' },
  ],
  capabilities: [
    { id: 'machine-parks.read', description: 'Consulter les parcs machine.' },
    { id: 'machine-parks.manage', description: 'Créer et configurer les parcs machine.' },
  ],
  surfaces: ['workspace'],
} as const);
