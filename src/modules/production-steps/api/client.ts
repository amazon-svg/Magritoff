/**
 * Client HTTP typo du module Etapes de production (story E10.13).
 *
 * Le tenant est resolu par la facade depuis le jeton (CA4 du socle E10.0) :
 * aucun chemin ici ne le porte. `Idempotency-Key` est generee localement pour
 * chaque tentative de creation ; `If-Match` doit reprendre l ETag lu sur la
 * ressource — CELUI DU CATALOGUE (`listProductionSteps`) pour `reorder()`,
 * celui de L ETAPE (`getForEdit()`) pour `update()` : deux portees distinctes,
 * jamais interchangeables (contrat, decision #7).
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, type ApiResponseWithEtag, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createProductionStepCommandSchema,
  deleteProductionStepResultSchema,
  productionStepSchema,
  productionStepsListSchema,
  reorderProductionStepsCommandSchema,
  updateProductionStepCommandSchema,
  type CreateProductionStepCommand,
  type ProductionStepDto,
  type ProductionStepStatusFilter,
  type ReorderProductionStepsCommand,
  type UpdateProductionStepCommand,
} from './contracts.ts';

const BASE_PATH = `${API_V1_BASE_PATH}/production-steps`;
const POSITIONS_PATH = `${API_V1_BASE_PATH}/production-step-positions`;

export type ListProductionStepsQuery = Readonly<{
  status?: ProductionStepStatusFilter;
}>;

export class ProductionStepsApiClient {
  constructor(private readonly client: FetchApiClient) {}

  /**
   * Rend aussi l `ETag` DU CATALOGUE COMPLET (meme quand `status` a filtre la
   * reponse) : c est lui qui se repasse dans l `If-Match` de `reorder()`.
   */
  async list(query: ListProductionStepsQuery = {}): Promise<ApiResponseWithEtag<readonly ProductionStepDto[]>> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    const suffix = params.toString();

    const result = await this.client.requestWithEtag({
      path: suffix ? `${BASE_PATH}?${suffix}` : BASE_PATH,
      responseSchema: successEnvelopeSchema(productionStepsListSchema),
    });
    return { data: result.data.data, etag: result.etag };
  }

  async create(command: CreateProductionStepCommand): Promise<ProductionStepDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: BASE_PATH,
      body: createProductionStepCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(productionStepSchema),
    });
    return envelope.data;
  }

  /** Rend aussi l ETag de L ETAPE : necessaire pour enchainer `update()` (If-Match, CA9). */
  async getForEdit(stepId: string): Promise<ApiResponseWithEtag<ProductionStepDto>> {
    const result = await this.client.requestWithEtag({
      path: `${BASE_PATH}/${stepId}`,
      responseSchema: successEnvelopeSchema(productionStepSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async update(
    stepId: string,
    command: UpdateProductionStepCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<ProductionStepDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PATCH',
      path: `${BASE_PATH}/${stepId}`,
      body: updateProductionStepCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(productionStepSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  /** Bascule `is_active` seule — utilise `update()`, aucun code d erreur distinct. */
  async setActive(stepId: string, isActive: boolean, ifMatch: string): Promise<ApiResponseWithEtag<ProductionStepDto>> {
    return this.update(stepId, { is_active: isActive }, ifMatch);
  }

  async remove(stepId: string): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      path: `${BASE_PATH}/${stepId}`,
      responseSchema: successEnvelopeSchema(deleteProductionStepResultSchema),
    });
  }

  /**
   * `If-Match` EXIGE, et il porte sur LE CATALOGUE (`listProductionSteps`),
   * jamais celui d une etape isolee. Rend le catalogue COMPLET dans le nouvel
   * ordre, avec son `ETag` recalcule.
   */
  async reorder(
    command: ReorderProductionStepsCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<readonly ProductionStepDto[]>> {
    const result = await this.client.requestWithEtag({
      method: 'PUT',
      path: POSITIONS_PATH,
      body: reorderProductionStepsCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(productionStepsListSchema),
    });
    return { data: result.data.data, etag: result.etag };
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
