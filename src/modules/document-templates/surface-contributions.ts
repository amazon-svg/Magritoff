import { defineSurfaceContribution } from '../../surfaces/registry';

export const documentTemplatesWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'document-templates',
  surface: 'workspace',
  routes: [
    {
      id: 'document-templates.workspace.list',
      moduleId: 'document-templates',
      featureId: 'document-templates.workspace-templates',
      surface: 'workspace',
      path: 'document-templates',
      mount: 'router',
      // Contrat §8.18 §4 : reserve aux porteurs du droit
      // `can_manage_document_templates`. Un `admin` du tenant le recoit par
      // derivation (`public.user_has_capability`) — meme raisonnement que
      // `production-steps.workspace.list` (E10.13) : cette garde est de l
      // ERGONOMIE (ne pas presenter un ecran inutilisable), pas une garde
      // d autorisation — celle-ci est tenue par la RLS
      // (`document_pdf_templates_write`, migration 20260909020000).
      requiredCapabilities: ['can_manage_document_templates'],
    },
    {
      // E10.10b-4b — editeur de coordonnees d un gabarit.
      id: 'document-templates.workspace.fields',
      moduleId: 'document-templates',
      featureId: 'document-templates.workspace-fields-editor',
      surface: 'workspace',
      path: 'document-templates/:templateId/fields',
      mount: 'router',
      requiredCapabilities: ['can_manage_document_templates'],
    },
  ],
  navigation: [
    {
      id: 'document-templates.workspace.navigation',
      moduleId: 'document-templates',
      featureId: 'document-templates.workspace-templates',
      surface: 'workspace',
      routeId: 'document-templates.workspace.list',
      // Groupe 'commercial' : le gabarit PDF habille le devis (commercial_quotes),
      // meme famille que pricing/commercial-quotes.
      groupId: 'commercial',
      label: 'Gabarits PDF',
      iconId: 'file-text',
      order: 110,
    },
  ],
} as const);
