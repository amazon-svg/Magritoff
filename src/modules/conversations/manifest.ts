import { defineModuleManifest } from '../../surfaces/registry';

export const conversationsModuleManifest = defineModuleManifest({
  id: 'conversations',
  name: 'Conversations',
  features: [
    { id: 'conversations.workspace-history', description: 'Consulter et reprendre l historique des conversations du tenant.' },
  ],
  capabilities: [
    { id: 'conversations.read', description: 'Consulter les conversations du tenant.' },
  ],
  surfaces: ['workspace'],
} as const);
