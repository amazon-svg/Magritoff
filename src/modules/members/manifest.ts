import { defineModuleManifest } from '../../surfaces/registry';

export const membersModuleManifest = defineModuleManifest({
  id: 'members',
  name: 'Utilisateurs Magrit',
  features: [
    { id: 'members.workspace-administration', description: 'Administrer les membres, invitations et rôles du tenant.' },
  ],
  capabilities: [
    { id: 'members.manage', description: 'Inviter, modifier et retirer des utilisateurs Magrit.' },
  ],
  surfaces: ['workspace'],
} as const);
