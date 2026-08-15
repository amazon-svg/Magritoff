export { CatalogApiClient } from './api/client.ts';
export * from './api/contracts.ts';
export { CatalogService } from './application/catalog-service.ts';
export { CatalogRejectedError, type CatalogAutomationGateway, type CatalogRepository } from './application/catalog-repository.ts';
export { catalogModuleManifest } from './manifest.ts';
export { catalogStorefrontContribution, catalogWorkspaceContribution } from './surface-contributions.ts';
