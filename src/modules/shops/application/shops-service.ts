import type { UserId } from '../../../kernel/ids/index.ts';
import type { CreateShopCommand, CreateShopProductCommand, MockupTemplateType, MockupView, SetShopPricingCommand, ShopBrandAssetUpload, ShopCustomMockupUpload, UpdateShopCommand, UpdateShopProductCommand } from '../api/contracts.ts';
import type { ShopsRepository } from './shops-repository.ts';
export class ShopsService {
  constructor(private readonly repository: ShopsRepository) {}
  registerBuyer(actor: UserId, shopId: string) { return this.repository.registerBuyer(actor, shopId); }
  list(actor: UserId, tenantId: string) { return this.repository.list(actor, tenantId); }
  create(actor: UserId, tenantId: string, command: CreateShopCommand) { return this.repository.create(actor, tenantId, command); }
  update(actor: UserId, tenantId: string, shopId: string, command: UpdateShopCommand) { return this.repository.update(actor, tenantId, shopId, command); }
  remove(actor: UserId, tenantId: string, shopId: string) { return this.repository.remove(actor, tenantId, shopId); }
  products(actor: UserId, tenantId: string, shopId: string) { return this.repository.products(actor, tenantId, shopId); }
  addProduct(actor: UserId, tenantId: string, shopId: string, command: CreateShopProductCommand) { return this.repository.addProduct(actor, tenantId, shopId, command); }
  updateProduct(actor: UserId, tenantId: string, shopId: string, productId: string, command: UpdateShopProductCommand) { return this.repository.updateProduct(actor, tenantId, shopId, productId, command); }
  removeProduct(actor: UserId, tenantId: string, shopId: string, productId: string) { return this.repository.removeProduct(actor, tenantId, shopId, productId); }
  publicProbe(slug: string) { return this.repository.publicProbe(slug); }
  publicCatalog(actor: UserId | null, slug: string) { return this.repository.publicCatalog(actor, slug); }
  pricing(actor: UserId, tenantId: string, shopId: string) { return this.repository.pricing(actor, tenantId, shopId); }
  setPricing(actor: UserId, tenantId: string, shopId: string, libraryProductId: string, command: SetShopPricingCommand) { return this.repository.setPricing(actor, tenantId, shopId, libraryProductId, command); }
  uploadBrandAsset(actor: UserId, tenantId: string, shopId: string, upload: ShopBrandAssetUpload) { return this.repository.uploadBrandAsset(actor, tenantId, shopId, upload); }
  customMockups(actor: UserId, tenantId: string, shopId: string) { return this.repository.customMockups(actor, tenantId, shopId); }
  uploadCustomMockup(actor: UserId, tenantId: string, shopId: string, upload: ShopCustomMockupUpload) { return this.repository.uploadCustomMockup(actor, tenantId, shopId, upload); }
  restoreCustomMockup(actor: UserId, tenantId: string, shopId: string, templateType: MockupTemplateType, view: MockupView) { return this.repository.restoreCustomMockup(actor, tenantId, shopId, templateType, view); }
}
