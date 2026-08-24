import { defineModuleManifest } from '../../surfaces/registry';

export const shopCustomersModuleManifest = defineModuleManifest({
  id: 'shop-customers',
  name: 'Comptes clients boutique',
  features: [
    { id: 'shop-customers.storefront-session', description: 'Authentifier un compte client dans une boutique unique.' },
    { id: 'shop-customers.customer-portal-account', description: 'Gérer le compte client propre à la boutique.' },
    { id: 'shop-customers.workspace-management', description: 'Administrer les comptes clients d’une boutique.' },
    { id: 'shop-customers.workspace-delegation', description: 'Ouvrir une boutique via une délégation auditée.' },
  ],
  capabilities: [
    { id: 'shop-customers.read', description: 'Consulter les comptes clients d’une boutique.' },
    { id: 'shop-customers.manage', description: 'Créer, inviter ou suspendre les comptes clients d’une boutique.' },
    { id: 'shop-customers.delegate', description: 'Utiliser un compte boutique par délégation auditée.' },
  ],
  surfaces: ['storefront', 'customer-portal', 'workspace', 'backoffice'],
} as const);
