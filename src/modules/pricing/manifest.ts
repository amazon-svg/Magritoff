import { defineModuleManifest } from '../../surfaces/registry';

export const pricingModuleManifest = defineModuleManifest({
  id: 'pricing',
  name: 'Règles de prix',
  features: [
    {
      id: 'pricing.workspace-rules',
      description:
        'Lister, créer, modifier et activer/désactiver les règles de marge et de remise du tenant, et poser la marge publique standard par gamme.',
    },
  ],
  // CA7 — l écran n est accessible qu aux rôles habilités (admin), via
  // `requiredTenantRole` sur la route (même mécanisme que le module Plans).
  // E10.11 (droits Admin/Commercial dédiés) livrera un catalogue de
  // capabilities plus fin ; ce lot n en introduit aucune pour ne pas figer
  // un nom de capability qu E10.11 devrait ensuite renommer ou dupliquer.
  capabilities: [],
  surfaces: ['workspace'],
} as const);
