import { defineModuleManifest } from '../../surfaces/registry';

export const quoteTemplatesModuleManifest = defineModuleManifest({
  id: 'quote-templates',
  name: 'Gabarits de devis',
  features: [{ id: 'quote-templates.workspace-management', description: 'Créer et gérer les gabarits de devis du tenant.' }],
  capabilities: [{ id: 'quote-templates.manage', description: 'Gérer les gabarits de devis.' }],
  surfaces: ['workspace'],
} as const);
