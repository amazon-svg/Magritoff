import type { MockupParams, MockupSpecs } from '../application/mockup-gateway.ts';
const CACHE_VERSION_SUFFIX = '_v7';
export function buildPublicMockupUrl(publicBucketBaseUrl: string, params: MockupParams & { view?: 'front' | 'back' }): string {
  const viewSuffix = params.view === 'back' ? '__back' : '';
  return `${publicBucketBaseUrl.replace(/\/$/, '')}/${params.tenantId}/${params.shopId}/${params.productId}${viewSuffix}${CACHE_VERSION_SUFFIX}.png`;
}
export function buildEdgeFunctionUrl(generatorUrl: string, specs: MockupSpecs): string {
  const params: Record<string, string> = { tenant: specs.tenantId, shop: specs.shopId, product: specs.productId, width: String(specs.width), height: String(specs.height), productName: specs.productName, primaryColor: specs.primaryColor };
  if (specs.template?.trim()) params.template = specs.template.trim();
  if (specs.view === 'back') params.view = 'back';
  return `${generatorUrl}?${new URLSearchParams(params)}`;
}
export function buildCacheBuster(): string { return Date.now().toString(36); }
export type { MockupParams, MockupSpecs } from '../application/mockup-gateway.ts';
