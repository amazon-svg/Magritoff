import { defineModuleManifest } from '../../surfaces/registry';

export const ordersModuleManifest = defineModuleManifest({
  id: 'orders',
  name: 'Commandes',
  features: [
    { id: 'orders.checkout', description: 'Créer une commande depuis une boutique.' },
    { id: 'orders.customer-history', description: 'Consulter et gérer ses commandes boutique.' },
    { id: 'orders.workspace-management', description: 'Piloter les commandes du tenant.' },
    { id: 'orders.production-management', description: 'Faire progresser les commandes en production.' },
  ],
  capabilities: [
    { id: 'orders.create', description: 'Créer une commande.' },
    { id: 'orders.read.own', description: 'Consulter ses propres commandes.' },
    { id: 'orders.read.tenant', description: 'Consulter les commandes du tenant.' },
    { id: 'orders.transition', description: 'Faire évoluer le statut d une commande.' },
  ],
  surfaces: ['storefront', 'customer-portal', 'workspace', 'backoffice'],
} as const);
