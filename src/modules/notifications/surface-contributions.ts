import { defineSurfaceContribution } from '../../surfaces/registry';

export const notificationsWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'notifications',
  surface: 'workspace',
  routes: [
    {
      id: 'notifications.workspace.templates',
      moduleId: 'notifications',
      featureId: 'notifications.workspace-templates',
      surface: 'workspace',
      path: 'notifications',
      mount: 'router',
      // Garde d ERGONOMIE (ne pas presenter un ecran inutilisable), pas
      // d autorisation — celle-ci reste tenue par la RLS de
      // `notification_templates` et par `x-required-capabilities` sur
      // `createNotificationTemplate`/`updateNotificationTemplate` (E10.15a).
      // Un `admin` recoit `can_manage_notifications` par derivation
      // (`public.user_has_capability`), meme discipline que `pricing`/
      // `document-templates`.
      requiredCapabilities: ['can_manage_notifications'],
    },
    {
      // E10.15d-1 — le journal. AUCUNE `requiredCapabilities` ICI (contrat
      // §8.23 §2, `listNotificationLogs` : « membre ») : la lecture est
      // ouverte a tout membre du tenant, a la difference de l ecran de
      // parametrage ci-dessus.
      id: 'notifications.workspace.logs',
      moduleId: 'notifications',
      featureId: 'notifications.workspace-logs',
      surface: 'workspace',
      path: 'notifications/logs',
      mount: 'router',
    },
  ],
  navigation: [
    {
      id: 'notifications.workspace.navigation',
      moduleId: 'notifications',
      featureId: 'notifications.workspace-templates',
      surface: 'workspace',
      routeId: 'notifications.workspace.templates',
      groupId: 'commercial',
      label: 'Notifications',
      iconId: 'bell',
      order: 170,
    },
    {
      id: 'notifications.workspace.logs.navigation',
      moduleId: 'notifications',
      featureId: 'notifications.workspace-logs',
      surface: 'workspace',
      routeId: 'notifications.workspace.logs',
      groupId: 'commercial',
      label: 'Journal des notifications',
      // `file-clock` DEJA mappe dans `WORKSPACE_ICONS` (DashboardLayout),
      // jusqu ici inutilise par aucun module — pas de nouvelle entree a
      // ajouter au registre d icones.
      iconId: 'file-clock',
      order: 171,
    },
  ],
} as const);
