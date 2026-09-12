import { defineModuleManifest } from '../../surfaces/registry';

export const notificationsModuleManifest = defineModuleManifest({
  id: 'notifications',
  name: 'Notifications multicanal',
  features: [
    {
      // E10.15b — l ecran de parametrage. Le socle (catalogue, moteur de
      // rendu, six operations de configuration) a ete livre sans UI par
      // E10.15a.
      id: 'notifications.workspace-templates',
      description:
        'Lister, filtrer, creer et modifier les modeles de notification du tenant (courriel/sms), avec apercu sans envoi.',
    },
    {
      // E10.15d-1 — l ecran du journal (`GET /notification-logs`, table
      // posee par E10.15c). `quote.sent`/`quote.converted`/`customer.created`
      // branches par ce meme lot ; `order.files_submitted` et le rendu
      // differe de `{{files.count}}` branches par E10.15d-2.
      id: 'notifications.workspace-logs',
      description: 'Consulter le journal des notifications envoyees, tentees ou abandonnees pour le tenant.',
    },
  ],
  // Meme construction que `can_manage_document_templates`/`can_manage_pricing`
  // (docs/api/CONVENTIONS.md §8.23 §2) : lecture ouverte a tout membre,
  // ecriture reservee. Nom canonique EXACT de la base
  // (`tenant_role_definitions.capabilities`), utilise TEL QUEL.
  capabilities: [
    { id: 'can_manage_notifications', description: 'Administrer les modeles de notification du tenant.' },
  ],
  surfaces: ['workspace'],
} as const);
