import { defineModuleManifest } from '../../surfaces/registry';

export const notificationsModuleManifest = defineModuleManifest({
  id: 'notifications',
  name: 'Notifications multicanal',
  features: [
    {
      // E10.15b — l ecran de parametrage, seul livrable de ce lot. Le socle
      // (catalogue, moteur de rendu, six operations de configuration) a ete
      // livre sans UI par E10.15a ; la chaine d envoi (E10.15c) et le reste
      // du catalogue (E10.15d) restent hors perimetre.
      id: 'notifications.workspace-templates',
      description:
        'Lister, filtrer, creer et modifier les modeles de notification du tenant (courriel/sms), avec apercu sans envoi.',
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
