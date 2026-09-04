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
      // CA7 (E10.11) — reserve aux porteurs du droit `can_manage_pricing`.
      // Un `admin` du tenant le recoit par derivation
      // (`public.user_has_capability`, 20260814000200_admin_unique.sql —
      // `owner` n existe plus comme valeur de `tenant_members.role`), donc
      // ne perd rien par rapport a l ancienne garde `requiredTenantRole:
      // 'admin'` qu elle remplace ;
      // seule change la faculte de deleguer l acces a un membre porteur d
      // un role qui accorde ce droit. Rappel (§3.5, regle 5 des
      // CONVENTIONS) : cette garde est de l ERGONOMIE (ne pas presenter un
      // ecran inutilisable), pas une garde d autorisation — celle-ci est
      // tenue par la RLS (migration 20260904142026).
      requiredCapabilities: ['can_manage_pricing'],
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
