import { defineModuleManifest } from '../../surfaces/registry';

export const commercialQuotesModuleManifest = defineModuleManifest({
  id: 'commercial-quotes',
  name: 'Devis',
  features: [
    {
      id: 'commercial-quotes.workspace-editor',
      description:
        'Editer un devis cree depuis un projet : entete, numero, lignes issues du chiffrage.',
    },
  ],
  capabilities: [
    { id: 'commercial-quotes.read', description: 'Consulter les devis du tenant.' },
    { id: 'commercial-quotes.manage', description: 'Creer un devis depuis un projet, le modifier.' },
  ],
  surfaces: ['workspace'],
} as const);
