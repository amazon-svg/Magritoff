import { defineModuleManifest } from '../../surfaces/registry';

export const plansModuleManifest = defineModuleManifest({
  id: 'plans',
  name: 'Plans et abonnement',
  features: [
    { id: 'plans.workspace-selection', description: 'Consulter et sélectionner le plan fonctionnel courant.' },
  ],
  capabilities: [],
  surfaces: ['workspace'],
} as const);
