import { defineModuleManifest } from '../../surfaces/registry';

export const productionStepsModuleManifest = defineModuleManifest({
  id: 'production-steps',
  name: 'Étapes de production',
  features: [
    {
      id: 'production-steps.workspace-steps',
      description:
        'Créer, renommer, colorer, marquer terminale, activer/désactiver, supprimer et réordonner les étapes de production (flux d’atelier) du tenant.',
    },
  ],
  // Contrat E10.13, decision #9 : ecran reserve aux porteurs du droit metier
  // dedie `can_manage_production_steps`, via `requiredCapabilities` sur la
  // route (voir surface-contributions.ts). Nom canonique EXACT de la base
  // (`tenant_role_definitions.capabilities`), utilise TEL QUEL — meme
  // discipline que `pricingModuleManifest` (E10.6/E10.11).
  capabilities: [
    {
      id: 'can_manage_production_steps',
      description: 'Administrer le référentiel des étapes de production du tenant.',
    },
  ],
  surfaces: ['workspace'],
} as const);
