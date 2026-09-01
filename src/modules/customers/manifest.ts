import { defineModuleManifest } from '../../surfaces/registry';

export const customersModuleManifest = defineModuleManifest({
  id: 'customers',
  name: 'Clients',
  features: [
    { id: 'customers.workspace-list', description: 'Lister et rechercher les clients du tenant.' },
    {
      id: 'customers.workspace-detail',
      description:
        'Consulter et modifier la fiche d un client : coordonnees, interlocuteurs, et points d extension projets/devis/commandes.',
    },
  ],
  capabilities: [
    { id: 'customers.read', description: 'Consulter le referentiel client du tenant.' },
    { id: 'customers.manage', description: 'Creer, modifier et desactiver un client ou un interlocuteur.' },
  ],
  surfaces: ['workspace'],
} as const);
