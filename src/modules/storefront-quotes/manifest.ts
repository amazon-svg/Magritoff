import { defineModuleManifest } from '../../surfaces/registry';

export const storefrontQuotesModuleManifest = defineModuleManifest({
  id: 'storefront-quotes',
  name: 'Devis du portail client',
  features: [
    { id: 'storefront-quotes.customer-history', description: 'Consulter les devis mis à disposition dans sa boutique.' },
  ],
  capabilities: [
    { id: 'storefront-quotes.read.own', description: 'Consulter ses propres devis (session boutique, E10.10b-1).' },
  ],
  surfaces: ['customer-portal'],
} as const);
