import { defineSurfaceContribution } from '../../surfaces/registry';

export const productionStepsWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'production-steps',
  surface: 'workspace',
  routes: [
    {
      id: 'production-steps.workspace.list',
      moduleId: 'production-steps',
      featureId: 'production-steps.workspace-steps',
      surface: 'workspace',
      path: 'production-steps',
      mount: 'router',
      // Contrat, decision #9 : reserve aux porteurs du droit
      // `can_manage_production_steps`. Un `admin` du tenant le recoit par
      // derivation (`public.user_has_capability`) — meme raisonnement que
      // `pricing.workspace.rules` (E10.6/E10.11) : cette garde est de l
      // ERGONOMIE (ne pas presenter un ecran inutilisable), pas une garde
      // d autorisation — celle-ci est tenue par la RLS
      // (`production_steps_write`, migration 20260908020000).
      requiredCapabilities: ['can_manage_production_steps'],
    },
  ],
  navigation: [
    {
      id: 'production-steps.workspace.navigation',
      moduleId: 'production-steps',
      featureId: 'production-steps.workspace-steps',
      surface: 'workspace',
      routeId: 'production-steps.workspace.list',
      // Groupe 'production' (deja affiche dans DashboardLayout, titre
      // « Production ») : un flux d atelier n est pas une regle tarifaire —
      // distinct du groupe 'commercial' qui porte pricing/commercial-quotes.
      groupId: 'production',
      label: 'Étapes de production',
      iconId: 'workflow',
      order: 100,
    },
  ],
} as const);
