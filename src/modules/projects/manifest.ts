import { defineModuleManifest } from '../../surfaces/registry';

export const projectsModuleManifest = defineModuleManifest({
  id: 'projects',
  name: 'Projets',
  features: [
    { id: 'projects.workspace-list', description: 'Lister et rechercher les projets du tenant.' },
    {
      id: 'projects.workspace-detail',
      description:
        'Consulter et modifier un projet : nom, client, statut, et ses elements de chiffrage.',
    },
  ],
  capabilities: [
    { id: 'projects.read', description: 'Consulter les projets du tenant.' },
    { id: 'projects.manage', description: 'Creer, modifier, archiver un projet ou ses elements.' },
  ],
  surfaces: ['workspace'],
} as const);
