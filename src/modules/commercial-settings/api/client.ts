/**
 * Client HTTP du module Reglages commerciaux (story E10.10a).
 *
 * Ressource SINGLETON du tenant courant (`/commercial-settings`) : aucun
 * identifiant au chemin, le tenant est resolu par la facade depuis le jeton
 * (CA4 du socle E10.0), meme discipline que les autres clients de module.
 * `GET` est ouvert a tout membre ; `PATCH` est reserve cote serveur au droit
 * `can_manage_pricing` (403 explicite si l appelant ne l a pas).
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, type ApiResponseWithEtag, FetchApiClient } from '../../../platform/api/index.ts';
import {
  commercialSettingsSchema,
  updateCommercialSettingsCommandSchema,
  type CommercialSettingsDto,
  type UpdateCommercialSettingsCommand,
} from './contracts.ts';

const PATH = `${API_V1_BASE_PATH}/commercial-settings`;

export class CommercialSettingsApiClient {
  constructor(private readonly client: FetchApiClient) {}

  /** Rend aussi l ETag : necessaire pour enchainer `update()` (If-Match, CA9). */
  async get(): Promise<ApiResponseWithEtag<CommercialSettingsDto>> {
    const result = await this.client.requestWithEtag({
      path: PATH,
      responseSchema: successEnvelopeSchema(commercialSettingsSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async update(
    command: UpdateCommercialSettingsCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<CommercialSettingsDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PATCH',
      path: PATH,
      body: updateCommercialSettingsCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(commercialSettingsSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }
}

function unwrapEnvelopeWithEtag<T>(
  result: ApiResponseWithEtag<{ data: T; meta: unknown }>,
): ApiResponseWithEtag<T> {
  return { data: result.data.data, etag: result.etag };
}
