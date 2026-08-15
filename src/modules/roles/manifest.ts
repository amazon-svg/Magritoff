import { defineModuleManifest } from '../../surfaces/registry';

export const rolesModuleManifest = defineModuleManifest({
  id: 'roles',
  name: 'Workflow et rôles',
  features: [
    { id: 'roles.workspace-administration', description: 'Configurer les rôles et responsabilités du workflow de commande.' },
  ],
  capabilities: [
    { id: 'roles.manage', description: 'Administrer les rôles et leurs capabilities.' },
  ],
  surfaces: ['workspace'],
} as const);
