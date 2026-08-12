import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createShopCommandSchema, createShopProductCommandSchema, shopMutationResultSchema,
  publicShopCatalogSchema, publicShopProbeSchema, shopProductSchema, shopProductsSchema, shopRemovalResultSchema, shopSchema, tenantShopsSchema,
  setShopPricingCommandSchema, shopPricingMutationResultSchema, shopPricingOverridesSchema,
  shopBrandAssetResultSchema,
  shopCustomMockupMutationResultSchema, shopCustomMockupsSchema,
  shopBuyerRegistrationResultSchema,
  updateShopCommandSchema, updateShopProductCommandSchema,
  type CreateShopCommand, type CreateShopProductCommand, type ShopDto,
  type ShopProductDto, type UpdateShopCommand, type UpdateShopProductCommand,
  type PublicShopCatalog, type PublicShopProbe,
  type ShopPricingOverride,
  type ShopBrandAssetKind,
  type MockupTemplateType, type MockupView, type ShopCustomMockup,
} from './contracts.ts';

export class ShopsApiClient {
  constructor(private readonly client: FetchApiClient) {}
  registerBuyer(shopId: string): Promise<void> {
    return this.client.request({ method: 'POST', path: `${API_V1_BASE_PATH}/shops/${shopId}/buyer-registration`, responseSchema: shopBuyerRegistrationResultSchema }).then(() => undefined);
  }
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
  async uploadBrandAsset(tenantId: string, shopId: string, kind: ShopBrandAssetKind, file: File): Promise<string> {
    const form = new FormData(); form.set('kind', kind); form.set('asset', file, file.name);
    const result = await this.client.requestForm({ method: 'POST', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/brand-assets`, form, responseSchema: shopBrandAssetResultSchema });
    return result.assetUrl;
  }
  customMockups(tenantId: string, shopId: string): Promise<ShopCustomMockup[]> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/custom-mockups`, responseSchema: shopCustomMockupsSchema });
  }
  async uploadCustomMockup(tenantId: string, shopId: string, templateType: MockupTemplateType, view: MockupView, file: File): Promise<void> {
    const form = new FormData(); form.set('templateType', templateType); form.set('view', view); form.set('asset', file, file.name);
    await this.client.requestForm({ method: 'POST', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/custom-mockups`, form, responseSchema: shopCustomMockupMutationResultSchema });
  }
  restoreCustomMockup(tenantId: string, shopId: string, templateType: MockupTemplateType, view: MockupView): Promise<void> {
    return this.client.request({ method: 'DELETE', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/custom-mockups/${templateType}/${view}`, responseSchema: shopCustomMockupMutationResultSchema }).then(() => undefined);
  }
}
