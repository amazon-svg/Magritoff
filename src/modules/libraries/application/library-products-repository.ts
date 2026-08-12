import type { UserId } from '../../../kernel/ids/index.ts';
import type { LibraryProductDto, LibraryProductInput, UpdateLibraryProduct } from '../api/product-contracts.ts';

export class LibraryProductRejectedError extends Error {
  constructor(public readonly code: 'permission_denied' | 'not_found' | 'invalid_product', message: string) {
    super(message);
    this.name = 'LibraryProductRejectedError';
  }
}

export interface LibraryProductsRepository {
  list(actor: UserId, tenantId: string): Promise<LibraryProductDto[]>;
  create(actor: UserId, tenantId: string, input: LibraryProductInput): Promise<LibraryProductDto>;
  createMany(actor: UserId, tenantId: string, products: LibraryProductInput[]): Promise<LibraryProductDto[]>;
  replacePimGenerated(actor: UserId, tenantId: string, products: LibraryProductInput[]): Promise<number>;
  clearPimGenerated(actor: UserId, tenantId: string): Promise<number>;
  update(actor: UserId, tenantId: string, id: string, input: UpdateLibraryProduct): Promise<LibraryProductDto>;
  remove(actor: UserId, tenantId: string, id: string): Promise<void>;
}
