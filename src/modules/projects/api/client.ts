/**
 * Client HTTP typo du module Projets (story E10.1).
 *
 * Le tenant est resolu par la facade depuis le jeton (CA4 du socle E10.0) :
 * aucun chemin ici ne le porte. `Idempotency-Key` est genere localement pour
 * chaque tentative de creation ; `If-Match` doit reprendre l ETag lu sur la
 * ressource (voir `requestWithEtag`).
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, type ApiResponseWithEtag, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createProjectCommandSchema,
  createProjectItemCommandSchema,
  projectDetailSchema,
  projectItemSchema,
  projectSchema,
  projectsListSchema,
  removeProjectItemResultSchema,
  replaceProjectTagsCommandSchema,
  updateProjectCommandSchema,
  type CreateProjectCommand,
  type CreateProjectItemCommand,
  type ProjectDetailDto,
  type ProjectDto,
  type ProjectItemDto,
  type ProjectStatus,
  type ReplaceProjectTagsCommand,
  type UpdateProjectCommand,
} from './contracts.ts';

const BASE_PATH = `${API_V1_BASE_PATH}/projects`;

export type ListProjectsQuery = Readonly<{
  q?: string;
  customerId?: string;
  /** Filtre multi-tags en ET logique (CA4, E10.2). */
  tagIds?: readonly string[];
  status?: ProjectStatus;
  pageSize?: number;
  pageCursor?: string;
}>;

export type ListProjectsResponse = Readonly<{
  items: readonly ProjectDto[];
  nextCursor: string | null;
}>;

export class ProjectsApiClient {
  constructor(private readonly client: FetchApiClient) {}

  async list(query: ListProjectsQuery = {}): Promise<ListProjectsResponse> {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.customerId) params.set('customer_id', query.customerId);
    if (query.tagIds && query.tagIds.length > 0) params.set('tag_ids', query.tagIds.join(','));
    if (query.status) params.set('status', query.status);
    if (query.pageSize) params.set('page[size]', String(query.pageSize));
    if (query.pageCursor) params.set('page[cursor]', query.pageCursor);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix ? `${BASE_PATH}?${suffix}` : BASE_PATH,
      responseSchema: successEnvelopeSchema(projectsListSchema),
    });
    return { items: envelope.data, nextCursor: envelope.meta.next_cursor ?? null };
  }

  async create(command: CreateProjectCommand): Promise<ProjectDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: BASE_PATH,
      body: createProjectCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(projectSchema),
    });
    return envelope.data;
  }

  async getDetail(projectId: string): Promise<ProjectDetailDto> {
    const envelope = await this.client.request({
      path: `${BASE_PATH}/${projectId}`,
      responseSchema: successEnvelopeSchema(projectDetailSchema),
    });
    return envelope.data;
  }

  /** Rend aussi l ETag : necessaire pour enchainer `update()` (If-Match). */
  async getForEdit(projectId: string): Promise<ApiResponseWithEtag<ProjectDetailDto>> {
    const result = await this.client.requestWithEtag({
      path: `${BASE_PATH}/${projectId}`,
      responseSchema: successEnvelopeSchema(projectDetailSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async update(
    projectId: string,
    command: UpdateProjectCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<ProjectDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PATCH',
      path: `${BASE_PATH}/${projectId}`,
      body: updateProjectCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(projectSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  /** Remplace la liste complete des tags du projet (CA6, E10.2), protege par If-Match (CA9). */
  async replaceTags(
    projectId: string,
    command: ReplaceProjectTagsCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<ProjectDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PUT',
      path: `${BASE_PATH}/${projectId}/tags`,
      body: replaceProjectTagsCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(projectSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async addItem(projectId: string, command: CreateProjectItemCommand): Promise<ProjectItemDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${BASE_PATH}/${projectId}/items`,
      body: createProjectItemCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(projectItemSchema),
    });
    return envelope.data;
  }

  async removeItem(projectId: string, itemId: string): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      path: `${BASE_PATH}/${projectId}/items/${itemId}`,
      responseSchema: successEnvelopeSchema(removeProjectItemResultSchema),
    });
  }
}

function unwrapEnvelopeWithEtag<T>(
  result: ApiResponseWithEtag<{ data: T; meta: unknown }>,
): ApiResponseWithEtag<T> {
  return { data: result.data.data, etag: result.etag };
}

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
