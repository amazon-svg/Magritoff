import { isFixedPriceProduct } from '../fixed-price-product.ts';
import { LibraryProductRejectedError } from './library-products-repository.ts';
import type { UserId } from '../../../kernel/ids/index.ts';
import type { LibraryProductInput, UpdateLibraryProduct } from '../api/product-contracts.ts';
import type { LibraryProductsRepository } from './library-products-repository.ts';

export class LibraryProductsService {
  constructor(private readonly repository: LibraryProductsRepository) {}
  list(actor: UserId, tenantId: string) { return this.repository.list(actor, tenantId); }
  async create(actor: UserId, tenantId: string, input: LibraryProductInput) { assertFixedCost(input); return this.repository.create(actor, tenantId, input); }
  async createMany(actor: UserId, tenantId: string, products: LibraryProductInput[]) { products.forEach(assertFixedCost); return this.repository.createMany(actor, tenantId, products); }
  async replacePimGenerated(actor: UserId, tenantId: string, products: LibraryProductInput[]) { return { created: await this.repository.replacePimGenerated(actor, tenantId, products) }; }
  async clearPimGenerated(actor: UserId, tenantId: string) { return { removed: await this.repository.clearPimGenerated(actor, tenantId) }; }
  async update(actor: UserId, tenantId: string, id: string, input: UpdateLibraryProduct) {
    if (input.price_ht !== undefined || input.config !== undefined) {
      const existing = (await this.repository.list(actor, tenantId)).find((product) => product.id === id);
      if (existing) assertFixedCost({ ...existing, ...input });
    }
    return this.repository.update(actor, tenantId, id, input);
  }
  async remove(actor: UserId, tenantId: string, id: string) { await this.repository.remove(actor, tenantId, id); return { removed: true as const }; }
}

function assertFixedCost(input: { config?: unknown; price_ht?: number | undefined }) {
  if (isFixedPriceProduct(input) && (typeof input.price_ht !== 'number' || !Number.isFinite(input.price_ht) || input.price_ht <= 0
    || Math.abs(input.price_ht * 100 - Math.round(input.price_ht * 100)) > 0.000001)) {
    throw new LibraryProductRejectedError('invalid_product', 'Le coût unitaire fixe doit être positif et exprimé au centime.');
  }
}
