/**
 * Client HTTP typo du module Liens de depot publics
 * (stories E10.20a/E10.20b).
 *
 * DEUX clients dans ce fichier, jamais confondus :
 *  - `OrderUploadLinksApiClient` — cote ATELIER, jeton utilisateur Magrit
 *    (`Authorization` injecte par `FetchApiClient`, `useWorkspaceApi`). Le
 *    tenant est resolu par la facade depuis le jeton (CA4 du socle E10.0) :
 *    aucun chemin ici ne le porte. `create()` genere une `Idempotency-Key`
 *    client, meme discipline que les autres POST createurs de ressource de
 *    ce sprint.
 *  - `OrderUploadLinkDepositApiClient` (E10.20b) — cote CLIENT, SANS AUCUNE
 *    session Magrit : le jeton du lien est pose en en-tete
 *    `X-Magrit-Upload-Link` via `FetchApiClient.withHeaders()`, jamais un
 *    `Authorization`. Consomme par la page publique de depot
 *    (`ui/UploadLinkDepositPage.tsx`), montee sur la surface `storefront`
 *    (aucune session workspace).
 */
import { z } from 'zod';
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import { orderFileUploadTicketSchema, type OrderFileUploadTicketDto } from '../../order-files/api/contracts.ts';
import { uploadFileToSignedUrl } from '../../order-files/api/signed-upload.ts';
import {
  confirmOrderUploadLinkFileCommandSchema,
  createOrderUploadLinkCommandSchema,
  orderUploadLinkContextSchema,
  orderUploadLinkCreatedSchema,
  orderUploadLinkDepositSchema,
  orderUploadLinksListSchema,
  type ConfirmOrderUploadLinkFileCommand,
  type CreateOrderUploadLinkCommand,
  type OrderUploadLinkContextDto,
  type OrderUploadLinkCreatedDto,
  type OrderUploadLinkDepositDto,
  type OrderUploadLinkDto,
} from './contracts.ts';

const BASE_PATH = `${API_V1_BASE_PATH}/commercial-orders`;
const UPLOAD_LINK_HEADER = 'X-Magrit-Upload-Link';
const CURRENT_UPLOAD_LINK_BASE_PATH = `${API_V1_BASE_PATH}/order-upload-links/current`;

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

/**
 * E10.20b — client PUBLIC du depot par un lien, SANS AUCUNE session Magrit.
 * Construit avec le `FetchApiClient` NU de la surface `storefront`
 * (`useStorefrontUiRuntime`, PAS `useWorkspaceApi`) : `withHeaders()` y
 * ajoute `X-Magrit-Upload-Link`, jamais un `Authorization`.
 *
 * TROIS operations, meme ordre que le parcours du client : contexte, billet,
 * confirmation — reprend le PATRON de `OrderFilesApiClient` (E10.17a) pour
 * `issueFileUploadUrl`/`uploadFile`/`confirmFile`, `uploadFile` DELEGUANT au
 * MEME helper (`uploadFileToSignedUrl`), jamais duplique.
 */
export class OrderUploadLinkDepositApiClient {
  private readonly client: FetchApiClient;

  constructor(client: FetchApiClient, token: string) {
    this.client = client.withHeaders({ [UPLOAD_LINK_HEADER]: token });
  }

  /** `getOrderUploadLinkContext`. Rend le strict necessaire pour deposer le bon fichier. */
  async getContext(): Promise<OrderUploadLinkContextDto> {
    const envelope = await this.client.request({
      path: CURRENT_UPLOAD_LINK_BASE_PATH,
      responseSchema: successEnvelopeSchema(orderUploadLinkContextSchema),
    });
    return envelope.data;
  }

  /**
   * `issueOrderUploadLinkFileUrl` — 200, PAS d `Idempotency-Key` (un billet
   * n est pas une ressource metier, le rejouer DOIT rendre un billet NEUF).
   */
  async issueFileUploadUrl(): Promise<OrderFileUploadTicketDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${CURRENT_UPLOAD_LINK_BASE_PATH}/file-upload-urls`,
      responseSchema: successEnvelopeSchema(orderFileUploadTicketSchema),
    });
    return envelope.data;
  }

  /**
   * Pose le fichier sur l URL signee du billet — `PUT` NU, hors
   * `FetchApiClient`, DELEGUE a `uploadFileToSignedUrl` (`order-files/api/
   * signed-upload.ts`) : MEME logique que le panneau d atelier, jamais
   * dupliquee.
   */
  async uploadFile(
    ticket: OrderFileUploadTicketDto,
    filename: string,
    file: Blob,
    onProgress?: (loadedBytes: number, totalBytes: number) => void,
  ): Promise<void> {
    return uploadFileToSignedUrl(ticket.url, filename, file, onProgress);
  }

  /**
   * `confirmOrderUploadLinkFile` — 201, `Idempotency-Key` EXIGEE (createsResource) :
   * un double-clic sur "Valider mon depot" apres un televersement long est la
   * norme. Sans argument, une cle NEUVE est generee (comportement d origine
   * pour un premier essai) ; un appelant qui REJOUE la meme confirmation
   * apres une reponse perdue doit fournir la MEME cle — meme discipline que
   * `OrderFilesApiClient.confirmUpload` (E10.17a).
   */
  async confirmFile(
    command: ConfirmOrderUploadLinkFileCommand,
    idempotencyKey?: string,
  ): Promise<OrderUploadLinkDepositDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${CURRENT_UPLOAD_LINK_BASE_PATH}/files`,
      body: confirmOrderUploadLinkFileCommandSchema.parse(command),
      headers: { 'Idempotency-Key': idempotencyKey ?? crypto.randomUUID() },
      responseSchema: successEnvelopeSchema(orderUploadLinkDepositSchema),
    });
    return envelope.data;
  }
}
