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
  // CA7 (E10.11) — l ecran n est accessible qu aux porteurs du droit metier
  // dedie `can_manage_pricing`, via `requiredCapabilities` sur la route
  // (voir surface-contributions.ts). Nom canonique EXACT de la base
  // (`tenant_role_definitions.capabilities`, forme `can_*`), utilise TEL
  // QUEL et non un identifiant pointe (`pricing.manage`) : `resolveCapability()`
  // ne fait la jonction entre les deux vocabulaires que via
  // `WORKSPACE_CAPABILITY_ALIASES` (src/modules/roles/ui/runtime/
  // accessProfile.helpers.ts), qui n a pas d entree pour ce module. Une
  // capability pointee SANS alias romprait silencieusement la garde pour
  // tout membre non-admin (docs/api/CONVENTIONS.md §8.11, s3).
  capabilities: [
    { id: 'can_manage_pricing', description: 'Administrer la politique tarifaire commerciale du tenant.' },
  ],
  surfaces: ['workspace'],
} as const);
