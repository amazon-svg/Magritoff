import { defineModuleManifest } from '../../surfaces/registry';

export const accountModuleManifest = defineModuleManifest({
  id: 'account',
  name: 'Compte utilisateur',
  features: [
    { id: 'account.profile', description: 'Consulter et modifier son profil.' },
    { id: 'account.preferences', description: 'Gérer ses préférences personnelles.' },
  ],
  capabilities: [
    { id: 'account.self.manage', description: 'Modifier son propre compte.' },
  ],
  surfaces: ['workspace', 'customer-portal'],
} as const);
