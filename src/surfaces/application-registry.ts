import {
  accountCustomerPortalContribution,
  accountModuleManifest,
  accountWorkspaceContribution,
} from '../modules/account';
import { createContributionRegistry } from './registry';
import { ordersBackofficeContribution, ordersCustomerPortalContribution, ordersModuleManifest, ordersStorefrontContribution, ordersWorkspaceContribution } from '../modules/orders';
import { shopsBackofficeContribution, shopsModuleManifest, shopsStorefrontContribution, shopsWorkspaceContribution } from '../modules/shops';
import { quotesBackofficeContribution, quotesCustomerPortalContribution, quotesModuleManifest, quotesStorefrontContribution, quotesWorkspaceContribution } from '../modules/quotes';

export const applicationContributionRegistry = createContributionRegistry({
  manifests: [accountModuleManifest, ordersModuleManifest, shopsModuleManifest, quotesModuleManifest],
  contributions: [accountWorkspaceContribution, accountCustomerPortalContribution, ordersStorefrontContribution, ordersCustomerPortalContribution, ordersWorkspaceContribution, ordersBackofficeContribution, shopsStorefrontContribution, shopsWorkspaceContribution, shopsBackofficeContribution, quotesStorefrontContribution, quotesCustomerPortalContribution, quotesWorkspaceContribution, quotesBackofficeContribution],
});
