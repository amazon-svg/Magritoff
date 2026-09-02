import { defineSurfaceContribution } from '../../surfaces/registry';

export const pricingWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'pricing',
  surface: 'workspace',
  routes: [
    {
      id: 'pricing.workspace.rules',
      moduleId: 'pricing',
      featureId: 'pricing.workspace-rules',
      surface: 'workspace',
      path: 'pricing-rules',
      mount: 'router',
      // CA7 — reserve aux administrateurs du tenant, meme mecanisme de garde
      // que le module Plans (`plans.workspace.selection`). E10.11 (droits
      // Admin/Commercial dedies) n est pas encore livree : ce garde grossier
      // (admin uniquement, pas de role Commercial distinct) sera raffine par
      // cette story future, pas par celle-ci.
      requiredTenantRole: 'admin',
    },
  ],
  navigation: [
    {
      id: 'pricing.workspace.navigation',
      moduleId: 'pricing',
      featureId: 'pricing.workspace-rules',
      surface: 'workspace',
      routeId: 'pricing.workspace.rules',
      groupId: 'commercial',
      label: 'Règles de prix',
      iconId: 'badge-percent',
      order: 165,
    },
  ],
} as const);
