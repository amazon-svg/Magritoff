import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import { createLibrarySchema, librariesSchema, libraryRemovedSchema, librarySchema, updateLibrarySchema, type CreateLibrary, type LibraryDto, type UpdateLibrary } from './contracts.ts';
export class LibrariesApiClient { constructor(private readonly client: FetchApiClient) {} private base(t: string) { return `${API_V1_BASE_PATH}/tenants/${t}/libraries`; }
  list(t: string): Promise<LibraryDto[]> { return this.client.request({ path: this.base(t), responseSchema: librariesSchema }); }
  create(t: string, input: CreateLibrary): Promise<LibraryDto> { return this.client.request({ method: 'POST', path: this.base(t), body: createLibrarySchema.parse(input), responseSchema: librarySchema }); }
  update(t: string, id: string, input: UpdateLibrary): Promise<LibraryDto> { return this.client.request({ method: 'PUT', path: `${this.base(t)}/${id}`, body: updateLibrarySchema.parse(input), responseSchema: librarySchema }); }
  remove(t: string, id: string): Promise<void> { return this.client.request({ method: 'DELETE', path: `${this.base(t)}/${id}`, responseSchema: libraryRemovedSchema }).then(() => undefined); }
}
