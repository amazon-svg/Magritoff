import { defineSurfaceContribution } from '../../surfaces/registry';

export const rolesWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'roles',
  surface: 'workspace',
  // UM1 v1.1 : aucun catalogue de rôles Magrit. Les deux options produit
  // sont administrées directement depuis la fiche utilisateur.
  routes: [],
  navigation: [],
} as const);
