import { defineModuleManifest } from '../../surfaces/registry';

export const mockupsModuleManifest = defineModuleManifest({
  id: 'mockups',
  name: 'Mockups Magrit',
  features: [
    { id: 'mockups.workspace-reference', description: 'Consulter la galerie des templates visuels Magrit.' },
  ],
  capabilities: [
    { id: 'mockups.govern', description: 'Accéder aux références visuelles globales Magrit.' },
  ],
  surfaces: ['workspace'],
} as const);
