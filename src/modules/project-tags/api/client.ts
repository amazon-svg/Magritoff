/**
 * Client HTTP typo du module Tags de projet (story E10.2).
 *
 * Le tenant est resolu par la facade depuis le jeton (CA4 du socle E10.0) :
 * aucun chemin ici ne le porte. `Idempotency-Key` est genere localement pour
 * chaque tentative de creation (CA8) — distincte de l idempotence sur le
 * libelle, geree cote serveur (voir openapi/magrit-core.v1.yaml,
 * `createProjectTag`).
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createProjectTagCommandSchema,
  deleteProjectTagResultSchema,
  projectTagSchema,
  projectTagsListSchema,
  type CreateProjectTagCommand,
  type ProjectTagDto,
} from './contracts.ts';

const BASE_PATH = `${API_V1_BASE_PATH}/project-tags`;

export type ListProjectTagsQuery = Readonly<{ q?: string }>;

export class ProjectTagsApiClient {
  constructor(private readonly client: FetchApiClient) {}

  async list(query: ListProjectTagsQuery = {}): Promise<readonly ProjectTagDto[]> {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix ? `${BASE_PATH}?${suffix}` : BASE_PATH,
      responseSchema: successEnvelopeSchema(projectTagsListSchema),
    });
    return envelope.data;
  }

  /**
   * Rend le tag CREE ou l EXISTANT (CA2) : l appelant n a pas besoin de
   * distinguer les deux cas, le statut HTTP (200/201) n est pas expose ici.
   */
  async createOrGet(command: CreateProjectTagCommand): Promise<ProjectTagDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: BASE_PATH,
      body: createProjectTagCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(projectTagSchema),
    });
    return envelope.data;
  }

  async remove(tagId: string): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      path: `${BASE_PATH}/${tagId}`,
      responseSchema: successEnvelopeSchema(deleteProjectTagResultSchema),
    });
  }
}

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
