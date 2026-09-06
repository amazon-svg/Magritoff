/**
 * Client HTTP type du module Devis commerciaux (story E10.3).
 *
 * Le tenant est resolu par la facade depuis le jeton (CA4 du socle E10.0) :
 * aucun chemin ici ne le porte. `Idempotency-Key` est genere localement pour
 * la creation ; `If-Match` doit reprendre l ETag lu sur la ressource.
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, type ApiResponseWithEtag, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createQuoteFromProjectCommandSchema,
  createQuoteLineCommandSchema,
  deleteQuoteResultSchema,
  quoteAuditEntriesListSchema,
  quoteDetailSchema,
  quoteLineAuditEntriesListSchema,
  quoteLineSchema,
  quoteSchema,
  quotesListSchema,
  reorderQuoteLinesCommandSchema,
  sendQuoteCommandSchema,
  updateQuoteCommandSchema,
  updateQuoteLineCommandSchema,
  type CreateFreeQuoteLineCommand,
  type CreateQuoteFromProjectCommand,
  type CreateQuoteLineFromProjectItemCommand,
  type DeleteQuoteResultDto,
  type QuoteAuditEntryDto,
  type QuoteDetailDto,
  type QuoteDto,
  type QuoteLineAuditEntryDto,
  type QuoteLineDto,
  type QuoteStatus,
  type SendQuoteCommand,
  type UpdateQuoteCommand,
  type UpdateQuoteLineCommand,
} from './contracts.ts';

const BASE_PATH = `${API_V1_BASE_PATH}/quotes`;

export type ListQuoteAuditEntriesQuery = Readonly<{
  lineId?: string;
  pageSize?: number;
  pageCursor?: string;
}>;

export type ListQuoteAuditEntriesResponse = Readonly<{
  items: readonly QuoteLineAuditEntryDto[];
  nextCursor: string | null;
}>;

export type ListQuotesQuery = Readonly<{
  customerId?: string;
  projectId?: string;
  status?: QuoteStatus;
  pageSize?: number;
  pageCursor?: string;
}>;

export type ListQuotesResponse = Readonly<{
  items: readonly QuoteDto[];
  nextCursor: string | null;
}>;

export type ListQuoteHeaderAuditEntriesQuery = Readonly<{
  pageSize?: number;
  pageCursor?: string;
}>;

export type ListQuoteHeaderAuditEntriesResponse = Readonly<{
  items: readonly QuoteAuditEntryDto[];
  nextCursor: string | null;
}>;

export class CommercialQuotesApiClient {
  constructor(private readonly client: FetchApiClient) {}

  async list(query: ListQuotesQuery = {}): Promise<ListQuotesResponse> {
    const params = new URLSearchParams();
    if (query.customerId) params.set('customer_id', query.customerId);
    if (query.projectId) params.set('project_id', query.projectId);
    if (query.status) params.set('status', query.status);
    if (query.pageSize) params.set('page[size]', String(query.pageSize));
    if (query.pageCursor) params.set('page[cursor]', query.pageCursor);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix ? `${BASE_PATH}?${suffix}` : BASE_PATH,
      responseSchema: successEnvelopeSchema(quotesListSchema),
    });
    return { items: envelope.data, nextCursor: envelope.meta.next_cursor ?? null };
  }

  /** Cree un devis depuis des elements coches d un projet (CA2-CA5). */
  async createFromProject(command: CreateQuoteFromProjectCommand): Promise<QuoteDetailDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: BASE_PATH,
      body: createQuoteFromProjectCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(quoteDetailSchema),
    });
    return envelope.data;
  }

  async getDetail(quoteId: string): Promise<QuoteDetailDto> {
    const envelope = await this.client.request({
      path: `${BASE_PATH}/${quoteId}`,
      responseSchema: successEnvelopeSchema(quoteDetailSchema),
    });
    return envelope.data;
  }

  /** Rend aussi l ETag : necessaire pour enchainer `update()` (If-Match). */
  async getForEdit(quoteId: string): Promise<ApiResponseWithEtag<QuoteDetailDto>> {
    const result = await this.client.requestWithEtag({
      path: `${BASE_PATH}/${quoteId}`,
      responseSchema: successEnvelopeSchema(quoteDetailSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async update(
    quoteId: string,
    command: UpdateQuoteCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<QuoteDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PATCH',
      path: `${BASE_PATH}/${quoteId}`,
      body: updateQuoteCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(quoteSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async remove(quoteId: string): Promise<DeleteQuoteResultDto> {
    const envelope = await this.client.request({
      method: 'DELETE',
      path: `${BASE_PATH}/${quoteId}`,
      responseSchema: successEnvelopeSchema(deleteQuoteResultSchema),
    });
    return envelope.data;
  }

  // ---------------------------------------------------------------------------
  // E10.9 — lignes de devis.
  // ---------------------------------------------------------------------------

  /** Ajoute une ligne LIEE a un chiffrage du projet source (CA1, decision d Arnaud du 01/09). */
  async addLineFromProjectItem(
    quoteId: string,
    command: CreateQuoteLineFromProjectItemCommand,
  ): Promise<QuoteLineDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${BASE_PATH}/${quoteId}/lines`,
      body: createQuoteLineCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(quoteLineSchema),
    });
    return envelope.data;
  }

  /** Ajoute une ligne LIBRE, saisie a la main (capacite de l ancien editeur de devis). */
  async addFreeLine(quoteId: string, command: CreateFreeQuoteLineCommand): Promise<QuoteLineDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${BASE_PATH}/${quoteId}/lines`,
      body: createQuoteLineCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(quoteLineSchema),
    });
    return envelope.data;
  }

  /** Rend aussi l ETag de la LIGNE : necessaire pour enchainer `updateLine()` (If-Match). */
  async getLineForEdit(quoteId: string, lineId: string): Promise<ApiResponseWithEtag<QuoteLineDto>> {
    const result = await this.client.requestWithEtag({
      path: `${BASE_PATH}/${quoteId}/lines/${lineId}`,
      responseSchema: successEnvelopeSchema(quoteLineSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async updateLine(
    quoteId: string,
    lineId: string,
    command: UpdateQuoteLineCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<QuoteLineDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PATCH',
      path: `${BASE_PATH}/${quoteId}/lines/${lineId}`,
      body: updateQuoteLineCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(quoteLineSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async removeLine(quoteId: string, lineId: string): Promise<DeleteQuoteResultDto> {
    const envelope = await this.client.request({
      method: 'DELETE',
      path: `${BASE_PATH}/${quoteId}/lines/${lineId}`,
      responseSchema: successEnvelopeSchema(deleteQuoteResultSchema),
    });
    return envelope.data;
  }

  /** `If-Match` porte sur LE DEVIS (contrat), jamais sur une ligne. */
  async reorderLines(
    quoteId: string,
    lineIds: readonly string[],
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<QuoteDetailDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PUT',
      path: `${BASE_PATH}/${quoteId}/line-positions`,
      body: reorderQuoteLinesCommandSchema.parse({ line_ids: lineIds }),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(quoteDetailSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async listAuditEntries(
    quoteId: string,
    query: ListQuoteAuditEntriesQuery = {},
  ): Promise<ListQuoteAuditEntriesResponse> {
    const params = new URLSearchParams();
    if (query.lineId) params.set('line_id', query.lineId);
    if (query.pageSize) params.set('page[size]', String(query.pageSize));
    if (query.pageCursor) params.set('page[cursor]', query.pageCursor);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix
        ? `${BASE_PATH}/${quoteId}/audit-entries?${suffix}`
        : `${BASE_PATH}/${quoteId}/audit-entries`,
      responseSchema: successEnvelopeSchema(quoteLineAuditEntriesListSchema),
    });
    return { items: envelope.data, nextCursor: envelope.meta.next_cursor ?? null };
  }

  // ---------------------------------------------------------------------------
  // E10.10a — statut, envoi/renvoi, duplication, journal d entete.
  // ---------------------------------------------------------------------------

  /**
   * ENVOIE ou RENVOIE un devis (contrat `sendQuote`). `If-Match` EXIGE — seul
   * cas du contrat (docs/api/CONVENTIONS.md §8.12, ecart de forme n°1) : la
   * precondition doit reprendre l `ETag` deja lu sur `getQuote`/`getForEdit`.
   * `Idempotency-Key` est generee ici, jamais laissee a l appelant : un rejeu
   * apres coupure reseau doit rendre la reponse memorisee, jamais un second
   * envoi (CA8).
   */
  async send(
    quoteId: string,
    command: SendQuoteCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<QuoteDetailDto>> {
    const result = await this.client.requestWithEtag({
      method: 'POST',
      path: `${BASE_PATH}/${quoteId}/transmissions`,
      body: sendQuoteCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey(), 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(quoteDetailSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  /**
   * DUPLIQUE un devis, quel que soit son statut (contrat `duplicateQuote`) :
   * aucun `If-Match` ici, la duplication ne modifie jamais le devis source.
   */
  async duplicate(quoteId: string): Promise<ApiResponseWithEtag<QuoteDetailDto>> {
    const result = await this.client.requestWithEtag({
      method: 'POST',
      path: `${BASE_PATH}/${quoteId}/duplicates`,
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(quoteDetailSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  /**
   * Journal d audit de l ENTETE d un devis (contrat `listQuoteHeaderAuditEntries`),
   * DISTINCT du journal des lignes ci-dessus. Reserve au droit
   * `can_manage_pricing` cote serveur : un appelant sans ce droit recoit un
   * 403 explicite, jamais une page vide.
   */
  async listHeaderAuditEntries(
    quoteId: string,
    query: ListQuoteHeaderAuditEntriesQuery = {},
  ): Promise<ListQuoteHeaderAuditEntriesResponse> {
    const params = new URLSearchParams();
    if (query.pageSize) params.set('page[size]', String(query.pageSize));
    if (query.pageCursor) params.set('page[cursor]', query.pageCursor);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix
        ? `${BASE_PATH}/${quoteId}/header-audit-entries?${suffix}`
        : `${BASE_PATH}/${quoteId}/header-audit-entries`,
      responseSchema: successEnvelopeSchema(quoteAuditEntriesListSchema),
    });
    return { items: envelope.data, nextCursor: envelope.meta.next_cursor ?? null };
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
