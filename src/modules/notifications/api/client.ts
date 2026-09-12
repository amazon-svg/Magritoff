/**
 * Client HTTP typo du module Notifications (story E10.15a).
 *
 * Le tenant est resolu par la facade depuis le jeton (CA4 du socle E10.0) :
 * aucun chemin ici ne le porte. `Idempotency-Key` est generee localement pour
 * `create()` ; `If-Match` doit reprendre l ETag DU MODELE lu par `getForEdit()`
 * (contrat, decision #0 : l ETag d une collection ne vaut pas pour le PATCH
 * d un de ses elements).
 *
 * AUCUNE UI NE CONSOMME CE CLIENT DANS CE LOT (E10.15b, hors perimetre) :
 * ecrit maintenant pour que le module suive le meme pattern que les neuf
 * autres modules E10.x (`api/contracts.ts` + `api/client.ts` + `application/`).
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, type ApiResponseWithEtag, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createNotificationTemplateCommandSchema,
  notificationEventDescriptorSchema,
  notificationLogsListSchema,
  notificationPreviewSchema,
  notificationTemplateSchema,
  notificationTemplatesListSchema,
  previewNotificationTemplateCommandSchema,
  updateNotificationTemplateCommandSchema,
  type CreateNotificationTemplateCommand,
  type NotificationChannel,
  type NotificationEventDescriptorDto,
  type NotificationEventName,
  type NotificationLogDto,
  type NotificationPreviewDto,
  type NotificationStatus,
  type NotificationTemplateDto,
  type NotificationTemplateStatusFilter,
  type PreviewNotificationTemplateCommand,
  type UpdateNotificationTemplateCommand,
} from './contracts.ts';
import { z } from 'zod';

const EVENTS_PATH = `${API_V1_BASE_PATH}/notification-events`;
const TEMPLATES_PATH = `${API_V1_BASE_PATH}/notification-templates`;
const LOGS_PATH = `${API_V1_BASE_PATH}/notification-logs`;

export type ListNotificationTemplatesQuery = Readonly<{
  event_name?: NotificationEventName;
  channel?: NotificationChannel;
  status?: NotificationTemplateStatusFilter;
}>;

/** E10.15d-1 — filtres du journal (`listNotificationLogs`, membre, pagination par curseur). */
export type ListNotificationLogsQuery = Readonly<{
  event_name?: NotificationEventName;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  template_id?: string;
  aggregate_id?: string;
  pageSize?: number;
  pageCursor?: string;
}>;

export type ListNotificationLogsResponse = Readonly<{
  items: readonly NotificationLogDto[];
  nextCursor: string | null;
}>;

export class NotificationsApiClient {
  constructor(private readonly client: FetchApiClient) {}

  /** Catalogue des evenements notifiables (CA1, CA4). PAS DE PAGINATION (contrat). */
  async listEvents(): Promise<readonly NotificationEventDescriptorDto[]> {
    const envelope = await this.client.request({
      path: EVENTS_PATH,
      responseSchema: successEnvelopeSchema(z.array(notificationEventDescriptorSchema)),
    });
    return envelope.data;
  }

  async listTemplates(query: ListNotificationTemplatesQuery = {}): Promise<readonly NotificationTemplateDto[]> {
    const params = new URLSearchParams();
    if (query.event_name) params.set('event_name', query.event_name);
    if (query.channel) params.set('channel', query.channel);
    if (query.status) params.set('status', query.status);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix ? `${TEMPLATES_PATH}?${suffix}` : TEMPLATES_PATH,
      responseSchema: successEnvelopeSchema(notificationTemplatesListSchema),
    });
    return envelope.data;
  }

  async create(command: CreateNotificationTemplateCommand): Promise<NotificationTemplateDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: TEMPLATES_PATH,
      body: createNotificationTemplateCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(notificationTemplateSchema),
    });
    return envelope.data;
  }

  /** Rend aussi l ETag DU MODELE : necessaire pour enchainer `update()` (If-Match, CA9). */
  async getForEdit(templateId: string): Promise<ApiResponseWithEtag<NotificationTemplateDto>> {
    const result = await this.client.requestWithEtag({
      path: `${TEMPLATES_PATH}/${templateId}`,
      responseSchema: successEnvelopeSchema(notificationTemplateSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async update(
    templateId: string,
    command: UpdateNotificationTemplateCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<NotificationTemplateDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PATCH',
      path: `${TEMPLATES_PATH}/${templateId}`,
      body: updateNotificationTemplateCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(notificationTemplateSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  /**
   * Rend un jeu d exemple, SANS AUCUN ENVOI REEL (CA6). `command` vide ->
   * l apercu porte sur le modele ENREGISTRE.
   */
  async preview(
    templateId: string,
    command: PreviewNotificationTemplateCommand = {},
  ): Promise<NotificationPreviewDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${TEMPLATES_PATH}/${templateId}/previews`,
      body: previewNotificationTemplateCommandSchema.parse(command),
      responseSchema: successEnvelopeSchema(notificationPreviewSchema),
    });
    return envelope.data;
  }

  /**
   * Journal des notifications (E10.15d-1, `GET /notification-logs`) —
   * lecture ouverte a tout membre, pagination par curseur (contrat §8.23
   * §2). Sur une entree `pending` d un evenement a fenetre de regroupement,
   * `body`/`subject` peuvent encore contenir `{{files.count}}` EN CLAIR
   * (rendu differe, mecanisme livre par E10.15d-2) — CE CLIENT NE SUBSTITUE
   * RIEN : l ecran doit l afficher TEL QUEL (§8.23 §11.5).
   */
  async listLogs(query: ListNotificationLogsQuery = {}): Promise<ListNotificationLogsResponse> {
    const params = new URLSearchParams();
    if (query.event_name) params.set('event_name', query.event_name);
    if (query.channel) params.set('channel', query.channel);
    if (query.status) params.set('status', query.status);
    if (query.template_id) params.set('template_id', query.template_id);
    if (query.aggregate_id) params.set('aggregate_id', query.aggregate_id);
    if (query.pageSize) params.set('page[size]', String(query.pageSize));
    if (query.pageCursor) params.set('page[cursor]', query.pageCursor);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix ? `${LOGS_PATH}?${suffix}` : LOGS_PATH,
      responseSchema: successEnvelopeSchema(notificationLogsListSchema),
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
