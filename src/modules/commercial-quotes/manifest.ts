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
    {
      id: 'commercial-quotes.workspace-library',
      description:
        'Bibliotheque des devis du tenant : retrouver, filtrer et supprimer un devis en brouillon. ' +
        'Point de navigation unique "Devis" du groupe commercial (chantier d unification des ' +
        'devis, docs/api/CONVENTIONS.md §8.10 — remplace l ancien module `quotes` supprime).',
    },
  ],
  capabilities: [
    { id: 'commercial-quotes.read', description: 'Consulter les devis du tenant.' },
    { id: 'commercial-quotes.manage', description: 'Creer un devis depuis un projet, le modifier.' },
  ],
  surfaces: ['workspace'],
} as const);
