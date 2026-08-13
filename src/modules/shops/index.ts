export { ShopsApiClient } from './api/client.ts';
export * from './api/contracts.ts';
export { ShopsService } from './application/shops-service.ts';
export { ShopRejectedError, type ShopsRepository } from './application/shops-repository.ts';
export type { MockupGateway, MockupParams, MockupSpecs } from './application/mockup-gateway.ts';
export { shopsModuleManifest } from './manifest.ts';
export { shopsBackofficeContribution, shopsStorefrontContribution, shopsWorkspaceContribution } from './surface-contributions.ts';
