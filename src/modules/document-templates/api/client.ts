/**
 * Client HTTP typo du module Gabarits PDF de documents (story E10.10b-4a).
 *
 * Le tenant est resolu par la facade depuis le jeton (CA4 du socle E10.0) :
 * aucun chemin ici ne le porte.
 *
 * `uploadPdfFile()` pose le fichier par un `fetch(url, { method: 'PUT' })`
 * NU sur l URL signee du billet d import — JAMAIS par le SDK Supabase
 * (`uploadToSignedUrl`), dont l import ferait echouer
 * `tests/architecture/modular-ui-boundaries.test.ts` (contrat §8.18 §0 point 8).
 * L URL est une capacite au porteur, deja complete (jeton en requete) : aucun
 * en-tete d autorisation Magrit n est ajoute a cet appel, contrairement a
 * tout appel `/api/v1/...`.
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, type ApiResponseWithEtag, FetchApiClient } from '../../../platform/api/index.ts';
import {
  confirmDocumentPdfTemplateUploadCommandSchema,
  createDocumentPdfTemplateCommandSchema,
  deleteDocumentPdfTemplateResultSchema,
  documentPdfTemplateCreatedSchema,
  documentPdfTemplateDetailSchema,
  documentPdfTemplateFieldMapSchema,
  documentPdfTemplatesListSchema,
  documentPdfTemplateUploadTicketSchema,
  replaceDocumentPdfTemplateFieldsCommandSchema,
  updateDocumentPdfTemplateCommandSchema,
  type ConfirmDocumentPdfTemplateUploadCommand,
  type CreateDocumentPdfTemplateCommand,
  type DocumentPdfTemplateCreatedDto,
  type DocumentPdfTemplateDetailDto,
  type DocumentPdfTemplateDto,
  type DocumentPdfTemplateFieldMapDto,
  type DocumentPdfTemplateStatus,
  type DocumentPdfTemplateUploadTicketDto,
  type DocumentType,
  type ReplaceDocumentPdfTemplateFieldsCommand,
  type UpdateDocumentPdfTemplateCommand,
} from './contracts.ts';

const BASE_PATH = `${API_V1_BASE_PATH}/document-pdf-templates`;

export type ListDocumentPdfTemplatesQuery = Readonly<{
  documentType?: DocumentType;
  status?: DocumentPdfTemplateStatus;
}>;

export class DocumentTemplatesApiClient {
  constructor(private readonly client: FetchApiClient) {}

  async list(query: ListDocumentPdfTemplatesQuery = {}): Promise<readonly DocumentPdfTemplateDto[]> {
    const params = new URLSearchParams();
    if (query.documentType) params.set('document_type', query.documentType);
    if (query.status) params.set('status', query.status);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix ? `${BASE_PATH}?${suffix}` : BASE_PATH,
      responseSchema: successEnvelopeSchema(documentPdfTemplatesListSchema),
    });
    return envelope.data;
  }

  /** Rend le gabarit `awaiting_upload` ET son premier billet d import (contrat : un seul appel). */
  async create(command: CreateDocumentPdfTemplateCommand): Promise<DocumentPdfTemplateCreatedDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: BASE_PATH,
      body: createDocumentPdfTemplateCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(documentPdfTemplateCreatedSchema),
    });
    return envelope.data;
  }

  /** Rend aussi l ETag DU GABARIT : necessaire pour enchainer `update()` (If-Match, CA9). */
  async getForEdit(templateId: string): Promise<ApiResponseWithEtag<DocumentPdfTemplateDetailDto>> {
    const result = await this.client.requestWithEtag({
      path: `${BASE_PATH}/${templateId}`,
      responseSchema: successEnvelopeSchema(documentPdfTemplateDetailSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async update(
    templateId: string,
    command: UpdateDocumentPdfTemplateCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<DocumentPdfTemplateDetailDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PATCH',
      path: `${BASE_PATH}/${templateId}`,
      body: updateDocumentPdfTemplateCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(documentPdfTemplateDetailSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async remove(templateId: string): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      path: `${BASE_PATH}/${templateId}`,
      responseSchema: successEnvelopeSchema(deleteDocumentPdfTemplateResultSchema),
    });
  }

  /**
   * Emet un NOUVEAU billet d import (reprise apres interruption, ou
   * remplacement du fond d un gabarit deja `ready`). PAS d `Idempotency-Key`
   * (contrat : un billet n est pas une ressource metier).
   */
  async issueUploadUrl(templateId: string): Promise<DocumentPdfTemplateUploadTicketDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${BASE_PATH}/${templateId}/upload-urls`,
      responseSchema: successEnvelopeSchema(documentPdfTemplateUploadTicketSchema),
    });
    return envelope.data;
  }

  /**
   * Pose le fichier sur l URL signee du billet — PUT NU, hors `FetchApiClient`
   * (chemin absolu, pas de prefixe `/api/v1`, aucune Authorization Magrit).
   */
  async uploadPdfFile(ticket: DocumentPdfTemplateUploadTicketDto, file: Blob): Promise<void> {
    const response = await fetch(ticket.url, {
      method: 'PUT',
      headers: { 'Content-Type': ticket.content_type },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`Depot du fichier PDF impossible (HTTP ${response.status}).`);
    }
  }

  /** Fait valider le fichier depose par le serveur ; le gabarit passe `ready`. */
  async confirmUpload(
    templateId: string,
    command: ConfirmDocumentPdfTemplateUploadCommand = { reset_fields: false },
  ): Promise<ApiResponseWithEtag<DocumentPdfTemplateDetailDto>> {
    const result = await this.client.requestWithEtag({
      method: 'POST',
      path: `${BASE_PATH}/${templateId}/uploads`,
      body: confirmDocumentPdfTemplateUploadCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(documentPdfTemplateDetailSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  /**
   * E10.10b-4b — carte de correspondance. Rend aussi l ETag DE LA CARTE,
   * distinct de celui du gabarit (contrat) : necessaire pour enchainer
   * `replaceFields()` (`If-Match`).
   */
  async getFields(templateId: string): Promise<ApiResponseWithEtag<DocumentPdfTemplateFieldMapDto>> {
    const result = await this.client.requestWithEtag({
      path: `${BASE_PATH}/${templateId}/fields`,
      responseSchema: successEnvelopeSchema(documentPdfTemplateFieldMapSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  /** REMPLACE la carte ENTIERE (contrat : "ce qui n y figure pas est supprime"). */
  async replaceFields(
    templateId: string,
    command: ReplaceDocumentPdfTemplateFieldsCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<DocumentPdfTemplateFieldMapDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PUT',
      path: `${BASE_PATH}/${templateId}/fields`,
      body: replaceDocumentPdfTemplateFieldsCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(documentPdfTemplateFieldMapSchema),
    });
    return unwrapEnvelopeWithEtag(result);
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
