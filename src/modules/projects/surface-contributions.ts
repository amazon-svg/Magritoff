import { defineSurfaceContribution } from '../../surfaces/registry';

export const projectsWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'projects',
  surface: 'workspace',
  routes: [
    {
      id: 'projects.workspace.list',
      moduleId: 'projects',
      featureId: 'projects.workspace-list',
      surface: 'workspace',
      path: 'projects',
      mount: 'router',
      requiredCapabilities: ['projects.read'],
    },
    {
      id: 'projects.workspace.detail',
      moduleId: 'projects',
      featureId: 'projects.workspace-detail',
      surface: 'workspace',
      path: 'projects/:projectId',
      mount: 'router',
      requiredCapabilities: ['projects.read'],
    },
  ],
  navigation: [
    {
      id: 'projects.workspace.navigation',
      moduleId: 'projects',
      featureId: 'projects.workspace-list',
      surface: 'workspace',
      routeId: 'projects.workspace.list',
      groupId: 'commercial',
      label: 'Projets',
      iconId: 'folder-kanban',
      // Avant "Devis" (100) : le projet est desormais le point d entree de
      // la creation de devis (E10.3), pas le panier.
      order: 95,
      testId: 'nav-sidebar-projects-link',
    },
  ],
} as const);
