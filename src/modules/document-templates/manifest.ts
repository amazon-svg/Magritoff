import { defineModuleManifest } from '../../surfaces/registry';

export const documentTemplatesModuleManifest = defineModuleManifest({
  id: 'document-templates',
  name: 'Gabarits PDF de documents',
  features: [
    {
      id: 'document-templates.workspace-templates',
      description:
        'Importer, nommer, activer/desactiver, designer par defaut et supprimer les gabarits PDF (fond apporte par l imprimeur) du tenant.',
    },
    {
      // E10.10b-4b — editeur visuel de correspondance coordonnees.
      id: 'document-templates.workspace-fields-editor',
      description:
        'Positionner les 25 donnees de devis et le tableau des lignes sur le fond PDF d un gabarit, par glisser-deposer ou clavier.',
    },
  ],
  // Contrat E10.10b-4a, §8.18 §4 : ecran reserve aux porteurs du droit
  // metier dedie `can_manage_document_templates`, via `requiredCapabilities`
  // sur la route (voir surface-contributions.ts). Nom canonique EXACT de la
  // base (`tenant_role_definitions.capabilities`), utilise TEL QUEL — meme
  // discipline que `productionStepsModuleManifest` (E10.13).
  capabilities: [
    {
      id: 'can_manage_document_templates',
      description: 'Administrer les gabarits PDF de documents du tenant.',
    },
  ],
  surfaces: ['workspace'],
} as const);
