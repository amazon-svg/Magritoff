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
      // 'badge-percent' est deja pris par le module Commercial (meme groupe
      // de navigation, ordre adjacent 160) : 'percent' reste dans le meme
      // vocabulaire visuel (pourcentage/marge) sans collision (qa-review
      // E10.6, R4).
      iconId: 'percent',
      order: 165,
    },
  ],
} as const);
