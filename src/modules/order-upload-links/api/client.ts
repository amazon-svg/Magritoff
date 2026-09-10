/**
 * Client HTTP typo du module Liens de depot publics (story E10.20a).
 *
 * Le tenant est resolu par la facade depuis le jeton (CA4 du socle E10.0) :
 * aucun chemin ici ne le porte. `create()` genere une `Idempotency-Key`
 * client, meme discipline que les autres POST createurs de ressource de ce
 * sprint.
 */
import { z } from 'zod';
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createOrderUploadLinkCommandSchema,
  orderUploadLinkCreatedSchema,
  orderUploadLinksListSchema,
  type CreateOrderUploadLinkCommand,
  type OrderUploadLinkCreatedDto,
  type OrderUploadLinkDto,
} from './contracts.ts';

const BASE_PATH = `${API_V1_BASE_PATH}/commercial-orders`;

export class OrderUploadLinksApiClient {
  constructor(private readonly client: FetchApiClient) {}

  async list(orderId: string): Promise<readonly OrderUploadLinkDto[]> {
    const envelope = await this.client.request({
      path: `${BASE_PATH}/${orderId}/upload-links`,
      responseSchema: successEnvelopeSchema(orderUploadLinksListSchema),
    });
    return envelope.data;
  }

  /**
   * `createOrderUploadLink` — rend le SEUL DTO de tout ce module qui porte
   * le jeton en clair. L appelant DOIT l afficher immediatement : une
   * seconde lecture ne le rendra pas (contrat).
   */
  async create(
    orderId: string,
    command: CreateOrderUploadLinkCommand,
  ): Promise<OrderUploadLinkCreatedDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${BASE_PATH}/${orderId}/upload-links`,
      body: createOrderUploadLinkCommandSchema.parse(command),
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      responseSchema: successEnvelopeSchema(orderUploadLinkCreatedSchema),
    });
    return envelope.data;
  }

  /** 204 sans corps : la ligne survit comme trace, elle quitte la liste des vivants. */
  async revoke(orderId: string, linkId: string): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      path: `${BASE_PATH}/${orderId}/upload-links/${linkId}`,
      responseSchema: z.null(),
    });
  }
}
