import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  clearPimGeneratedProductsResultSchema,
  createLibraryProductsSchema,
  libraryProductInputSchema,
  libraryProductRemovedSchema,
  libraryProductSchema,
  libraryProductsSchema,
  pimGeneratedProductsResultSchema,
  updateLibraryProductSchema,
  type LibraryProductDto,
  type LibraryProductInput,
  type UpdateLibraryProduct,
} from './product-contracts.ts';

export class LibraryProductsApiClient {
  constructor(private readonly client: FetchApiClient) {}

  private base(tenantId: string): string {
    return `${API_V1_BASE_PATH}/tenants/${tenantId}/library-products`;
  }

  list(tenantId: string): Promise<LibraryProductDto[]> {
    return this.client.request({ path: this.base(tenantId), responseSchema: libraryProductsSchema });
  }

  create(tenantId: string, input: LibraryProductInput): Promise<LibraryProductDto> {
    return this.client.request({ method: 'POST', path: this.base(tenantId), body: libraryProductInputSchema.parse(input), responseSchema: libraryProductSchema });
  }

  createMany(tenantId: string, products: LibraryProductInput[]): Promise<LibraryProductDto[]> {
    return this.client.request({ method: 'POST', path: `${this.base(tenantId)}/bulk`, body: createLibraryProductsSchema.parse({ products }), responseSchema: libraryProductsSchema });
  }

  replacePimGenerated(tenantId: string, products: LibraryProductInput[]): Promise<{ created: number }> {
    return this.client.request({ method: 'PUT', path: `${this.base(tenantId)}/pim-generated`, body: createLibraryProductsSchema.parse({ products }), responseSchema: pimGeneratedProductsResultSchema });
  }

  clearPimGenerated(tenantId: string): Promise<{ removed: number }> {
    return this.client.request({ method: 'DELETE', path: `${this.base(tenantId)}/pim-generated`, responseSchema: clearPimGeneratedProductsResultSchema });
  }

  update(tenantId: string, id: string, input: UpdateLibraryProduct): Promise<LibraryProductDto> {
    return this.client.request({ method: 'PUT', path: `${this.base(tenantId)}/${id}`, body: updateLibraryProductSchema.parse(input), responseSchema: libraryProductSchema });
  }

  remove(tenantId: string, id: string): Promise<void> {
    return this.client.request({ method: 'DELETE', path: `${this.base(tenantId)}/${id}`, responseSchema: libraryProductRemovedSchema }).then(() => undefined);
  }
}
