/**
 * Client HTTP typo du module Fichiers de commande (story E10.17a).
 *
 * Le tenant est resolu par la facade depuis le jeton (CA4 du socle E10.0) :
 * aucun chemin ici ne le porte.
 *
 * `uploadOrderFile()` pose le fichier par un `fetch(url, { method: 'PUT' })`
 * NU sur l URL signee du billet de depot — JAMAIS par le SDK Supabase
 * (`uploadToSignedUrl`), dont l import ferait echouer
 * `tests/architecture/modular-ui-boundaries.test.ts` (meme regle
 * qu `DocumentTemplatesApiClient.uploadPdfFile`, E10.10b-4a, reprise a
 * l identique — contrat §8.19 §0 verification n°1). Le `Content-Type` du
 * `PUT` est pose depuis le NOM DE FICHIER via la correspondance fermee de
 * `content-type-map.ts`, jamais depuis `File.type` (consigne opposable a 17b,
 * §8.19 decision #6).
 */
import { z } from 'zod';
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, type ApiResponseWithEtag, FetchApiClient } from '../../../platform/api/index.ts';
import { resolveOrderFileContentType } from './content-type-map.ts';
import {
  confirmOrderFileUploadCommandSchema,
  orderFileDetailSchema,
  orderFilesListSchema,
  orderFileSchema,
  orderFileUploadTicketSchema,
  updateOrderFileCommandSchema,
  type ConfirmOrderFileUploadCommand,
  type OrderFileDetailDto,
  type OrderFileDto,
  type OrderFileUploadTicketDto,
  type UpdateOrderFileCommand,
} from './contracts.ts';

const BASE_PATH = `${API_V1_BASE_PATH}/commercial-orders`;

export class OrderFilesApiClient {
  constructor(private readonly client: FetchApiClient) {}

  async list(orderId: string): Promise<readonly OrderFileDto[]> {
    const envelope = await this.client.request({
      path: `${BASE_PATH}/${orderId}/files`,
      responseSchema: successEnvelopeSchema(orderFilesListSchema),
    });
    return envelope.data;
  }

  /** Rend aussi l `ETag` DU FICHIER : necessaire pour enchainer `updateVisibility()` (If-Match, CA9). */
  async getForRead(orderId: string, fileId: string): Promise<ApiResponseWithEtag<OrderFileDetailDto>> {
    const result = await this.client.requestWithEtag({
      path: `${BASE_PATH}/${orderId}/files/${fileId}`,
      responseSchema: successEnvelopeSchema(orderFileDetailSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  /**
   * Emet un NOUVEAU billet de depot. PAS d `Idempotency-Key` (contrat : un
   * billet n est pas une ressource metier, le rejouer DOIT rendre un billet
   * NEUF).
   */
  async issueUploadUrl(orderId: string): Promise<OrderFileUploadTicketDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${BASE_PATH}/${orderId}/file-upload-urls`,
      responseSchema: successEnvelopeSchema(orderFileUploadTicketSchema),
    });
    return envelope.data;
  }

  /**
   * Pose le fichier sur l URL signee du billet — `PUT` NU, hors
   * `FetchApiClient` (chemin absolu, pas de prefixe `/api/v1`, aucune
   * `Authorization` Magrit). Le `Content-Type` est resolu depuis le NOM DE
   * FICHIER (`resolveOrderFileContentType`), jamais depuis `file.type`.
   *
   * `onProgress` (E10.17b, barre de progression du panneau de fichiers) est
   * FACULTATIF : quand fourni, le depot passe par `XMLHttpRequest` (seule API
   * navigateur qui expose un evenement de progression sur le CORPS envoye,
   * `fetch` n en publie aucun de facon fiable/cross-navigateur pour un `PUT`)
   * au lieu de `fetch`. Aucune des deux voies n importe le SDK Supabase ni ne
   * change le `Content-Type` pose.
   */
  async uploadOrderFile(
    ticket: OrderFileUploadTicketDto,
    filename: string,
    file: Blob,
    onProgress?: (loadedBytes: number, totalBytes: number) => void,
  ): Promise<void> {
    const contentType = resolveOrderFileContentType(filename);
    if (!onProgress) {
      const response = await fetch(ticket.url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
      if (!response.ok) {
        throw new Error(`Depot du fichier de commande impossible (HTTP ${response.status}).`);
      }
      return;
    }

    await new Promise<void>((resolvePut, rejectPut) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', ticket.url, true);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded, event.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolvePut();
        } else {
          rejectPut(new Error(`Depot du fichier de commande impossible (HTTP ${xhr.status}).`));
        }
      };
      xhr.onerror = () => rejectPut(new Error('Depot du fichier de commande impossible (erreur reseau).'));
      xhr.send(file);
    });
  }

  /**
   * Fait constater le depot par le serveur ; c est ICI, et nulle part
   * ailleurs, qu un fichier existe.
   *
   * `idempotencyKey` (E10.17b, qa-review N2, round 1) est FACULTATIF : un
   * appelant qui rejoue la MEME confirmation apres une reponse perdue (pas un
   * nouveau depot) doit fournir la MEME cle pour que le serveur reconnaisse
   * la meme intention au lieu de creer une seconde ligne pour le meme
   * fichier. Sans argument, une cle NEUVE est generee (comportement
   * d origine, inchange).
   */
  async confirmUpload(
    orderId: string,
    command: ConfirmOrderFileUploadCommand,
    idempotencyKey?: string,
  ): Promise<OrderFileDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${BASE_PATH}/${orderId}/files`,
      body: confirmOrderFileUploadCommandSchema.parse(command),
      headers: { 'Idempotency-Key': idempotencyKey ?? newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(orderFileSchema),
    });
    return envelope.data;
  }

  async updateVisibility(
    orderId: string,
    fileId: string,
    command: UpdateOrderFileCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<OrderFileDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PATCH',
      path: `${BASE_PATH}/${orderId}/files/${fileId}`,
      body: updateOrderFileCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(orderFileSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  /** 204 sans corps : octets detruits, ligne conservee comme trace. Irreversible — a confirmer cote UI (17b). */
  async remove(orderId: string, fileId: string): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      path: `${BASE_PATH}/${orderId}/files/${fileId}`,
      responseSchema: z.null(),
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
