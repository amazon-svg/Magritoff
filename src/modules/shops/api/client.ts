import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createShopCommandSchema, createShopProductCommandSchema, shopMutationResultSchema,
  publicShopCatalogSchema, publicShopProbeSchema, shopProductSchema, shopProductsSchema, shopRemovalResultSchema, shopSchema, tenantShopsSchema,
  setShopPricingCommandSchema, shopPricingMutationResultSchema, shopPricingOverridesSchema,
  updateShopCommandSchema, updateShopProductCommandSchema,
  type CreateShopCommand, type CreateShopProductCommand, type ShopDto,
  type ShopProductDto, type UpdateShopCommand, type UpdateShopProductCommand,
  type PublicShopCatalog, type PublicShopProbe,
  type ShopPricingOverride,
} from './contracts.ts';

export class ShopsApiClient {
  constructor(private readonly client: FetchApiClient) {}
  list(tenantId: string): Promise<ShopDto[]> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops`, responseSchema: tenantShopsSchema });
  }
  create(tenantId: string, command: CreateShopCommand): Promise<ShopDto> {
    return this.client.request({ method: 'POST', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops`, body: createShopCommandSchema.parse(command), responseSchema: shopSchema });
  }
  update(tenantId: string, shopId: string, command: UpdateShopCommand): Promise<ShopDto> {
    return this.client.request({ method: 'PATCH', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}`, body: updateShopCommandSchema.parse(command), responseSchema: shopSchema });
  }
  remove(tenantId: string, shopId: string): Promise<void> {
    return this.client.request({ method: 'DELETE', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}`, responseSchema: shopRemovalResultSchema }).then(() => undefined);
  }
  products(tenantId: string, shopId: string): Promise<ShopProductDto[]> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/products`, responseSchema: shopProductsSchema });
  }
  addProduct(tenantId: string, shopId: string, command: CreateShopProductCommand): Promise<ShopProductDto> {
    return this.client.request({ method: 'POST', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/products`, body: createShopProductCommandSchema.parse(command), responseSchema: shopProductSchema });
  }
  updateProduct(tenantId: string, shopId: string, productId: string, command: UpdateShopProductCommand): Promise<void> {
    return this.client.request({ method: 'PATCH', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/products/${productId}`, body: updateShopProductCommandSchema.parse(command), responseSchema: shopMutationResultSchema }).then(() => undefined);
  }
  removeProduct(tenantId: string, shopId: string, productId: string): Promise<void> {
    return this.client.request({ method: 'DELETE', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/products/${productId}`, responseSchema: shopRemovalResultSchema }).then(() => undefined);
  }
  publicProbe(slug: string): Promise<PublicShopProbe> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/public/shops/${encodeURIComponent(slug)}/probe`, responseSchema: publicShopProbeSchema });
  }
  publicCatalog(slug: string): Promise<PublicShopCatalog> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/public/shops/${encodeURIComponent(slug)}/catalog`, responseSchema: publicShopCatalogSchema });
  }
  pricing(tenantId: string, shopId: string): Promise<ShopPricingOverride[]> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/pricing`, responseSchema: shopPricingOverridesSchema });
  }
  setPricing(tenantId: string, shopId: string, libraryProductId: string, priceHtOverride: number | null): Promise<void> {
    return this.client.request({ method: 'PUT', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/pricing/${libraryProductId}`, body: setShopPricingCommandSchema.parse({ priceHtOverride }), responseSchema: shopPricingMutationResultSchema }).then(() => undefined);
  }
}
