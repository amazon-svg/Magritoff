import type { UserId } from '../../../kernel/ids/index.ts';
import type { CreateShopCommand, CreateShopProductCommand, MockupTemplateType, MockupView, PersistAiShopProductCommand, PublicShopCatalog, PublicShopProbe, SetShopPricingCommand, ShopBrandAssetUpload, ShopCustomMockup, ShopCustomMockupUpload, ShopDto, ShopPricingOverride, ShopProductDto, UpdateShopCommand, UpdateShopProductCommand } from '../api/contracts.ts';

export class ShopRejectedError extends Error {
  constructor(public readonly code: 'authentication_required' | 'permission_denied' | 'shop_not_found' | 'product_not_found' | 'conflict' | 'invalid_request', message: string) {
    super(message); this.name = 'ShopRejectedError';
  }
}
export type PublicShopCatalogAccess = Readonly<{
  magritUserId: UserId | null;
  storefront: Readonly<{
    kind: 'shop_customer';
    shopId: string;
    shopCustomerAccountId: string;
  }> | null;
}>;
export interface ShopsRepository {
  list(actor: UserId, tenantId: string): Promise<ShopDto[]>;
  create(actor: UserId, tenantId: string, command: CreateShopCommand): Promise<ShopDto>;
  update(actor: UserId, tenantId: string, shopId: string, command: UpdateShopCommand): Promise<ShopDto>;
  remove(actor: UserId, tenantId: string, shopId: string): Promise<void>;
  products(actor: UserId, tenantId: string, shopId: string): Promise<ShopProductDto[]>;
  addProduct(actor: UserId, tenantId: string, shopId: string, command: CreateShopProductCommand): Promise<ShopProductDto>;
  updateProduct(actor: UserId, tenantId: string, shopId: string, productId: string, command: UpdateShopProductCommand): Promise<void>;
  removeProduct(actor: UserId, tenantId: string, shopId: string, productId: string): Promise<void>;
  publicProbe(slug: string): Promise<PublicShopProbe>;
  publicCatalog(access: PublicShopCatalogAccess, slug: string): Promise<PublicShopCatalog>;
  pricing(actor: UserId, tenantId: string, shopId: string): Promise<ShopPricingOverride[]>;
  setPricing(actor: UserId, tenantId: string, shopId: string, libraryProductId: string, command: SetShopPricingCommand): Promise<void>;
  uploadBrandAsset(actor: UserId, tenantId: string, shopId: string, upload: ShopBrandAssetUpload): Promise<string>;
  customMockups(actor: UserId, tenantId: string, shopId: string): Promise<ShopCustomMockup[]>;
  uploadCustomMockup(actor: UserId, tenantId: string, shopId: string, upload: ShopCustomMockupUpload): Promise<void>;
  restoreCustomMockup(actor: UserId, tenantId: string, shopId: string, templateType: MockupTemplateType, view: MockupView): Promise<void>;
  persistAiProduct(actor: UserId, tenantId: string, shopId: string, command: PersistAiShopProductCommand): Promise<void>;
}
