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
  ],
} as const);
