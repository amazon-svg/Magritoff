import {
  accountCustomerPortalContribution,
  accountModuleManifest,
  accountWorkspaceContribution,
} from '../modules/account';
import { createContributionRegistry } from './registry';

export const applicationContributionRegistry = createContributionRegistry({
  manifests: [accountModuleManifest],
  contributions: [accountWorkspaceContribution, accountCustomerPortalContribution],
});
