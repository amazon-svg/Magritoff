import type { UserId } from '../../../kernel/ids/index.ts';
import type { LibraryProductInput, UpdateLibraryProduct } from '../api/product-contracts.ts';
import type { LibraryProductsRepository } from './library-products-repository.ts';

export class LibraryProductsService {
  constructor(private readonly repository: LibraryProductsRepository) {}
  list(actor: UserId, tenantId: string) { return this.repository.list(actor, tenantId); }
  create(actor: UserId, tenantId: string, input: LibraryProductInput) { return this.repository.create(actor, tenantId, input); }
  createMany(actor: UserId, tenantId: string, products: LibraryProductInput[]) { return this.repository.createMany(actor, tenantId, products); }
  async replacePimGenerated(actor: UserId, tenantId: string, products: LibraryProductInput[]) { return { created: await this.repository.replacePimGenerated(actor, tenantId, products) }; }
  async clearPimGenerated(actor: UserId, tenantId: string) { return { removed: await this.repository.clearPimGenerated(actor, tenantId) }; }
  update(actor: UserId, tenantId: string, id: string, input: UpdateLibraryProduct) { return this.repository.update(actor, tenantId, id, input); }
  async remove(actor: UserId, tenantId: string, id: string) { await this.repository.remove(actor, tenantId, id); return { removed: true as const }; }
}
