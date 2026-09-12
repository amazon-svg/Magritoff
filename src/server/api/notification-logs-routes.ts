/**
 * Route HTTP du journal des notifications (story E10.15c, `GET
 * /notification-logs`), sur la facade Gestion commerciale
 * (`defineGescomRoute`, E10.0).
 *
 * Lecture ouverte a tout membre du tenant, AUCUNE garde de capability
 * (contrat §8.23 §2 : « membre »). Pagination par curseur (`page[size]`/
 * `page[cursor]`), comme le reste du depot (`buildPage`).
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1).
 */
import { notificationChannelSchema, notificationEventNameSchema, notificationLogsListSchema, notificationStatusSchema } from '../../modules/notifications/api/contracts.ts';
import type { NotificationChannel, NotificationEventName, NotificationStatus } from '../../modules/notifications/api/contracts.ts';
import type { NotificationLogsService } from '../../modules/notifications/application/notification-logs-service.ts';
import { uuidSchema } from '../../modules/_shared/api/index.ts';
import { buildPage, decodeCursor, problem, SHARED_PROBLEM_CODES, validationFailed } from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute } from './gescom-middleware.ts';

export function createNotificationLogsRoutes(service: NotificationLogsService): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/notification-logs',
      operationId: 'listNotificationLogs',
      authentication: 'user',
      inputSchema: null,
      dataSchema: notificationLogsListSchema,
      async handle(context) {
        const eventName = parseEventName(context.url.searchParams.get('event_name'));
        const channel = parseChannel(context.url.searchParams.get('channel'));
        const status = parseStatus(context.url.searchParams.get('status'));
        const templateId = parseUuidParam(context.url.searchParams.get('template_id'), 'template_id');
        const aggregateId = parseUuidParam(context.url.searchParams.get('aggregate_id'), 'aggregate_id');
        const cursor = context.page.cursor ? decodeCursor(context.page.cursor) : null;

        const rows = await service.list(context.tenantId, {
          eventName,
          channel,
          status,
          templateId,
          aggregateId,
          size: context.page.size,
          cursor,
        });
        const page = buildPage(rows, context.page, (row) => ({ sort: row.created_at, id: row.id }));

        return {
          status: 200,
          data: page.items,
          meta: { next_cursor: page.nextCursor, page_size: context.page.size },
        };
      },
    }),
  ];
}

function parseEventName(raw: string | null): NotificationEventName | null {
  if (raw === null) return null;
  const parsed = notificationEventNameSchema.safeParse(raw);
  if (!parsed.success) {
    throw validationFailed([{ field: 'event_name', message: 'Fait metier notifiable attendu.' }]);
  }
  return parsed.data;
}

function parseChannel(raw: string | null): NotificationChannel | null {
  if (raw === null) return null;
  const parsed = notificationChannelSchema.safeParse(raw);
  if (!parsed.success) {
    throw validationFailed([{ field: 'channel', message: 'Valeur attendue : email ou sms.' }]);
  }
  return parsed.data;
}

function parseStatus(raw: string | null): NotificationStatus | null {
  if (raw === null) return null;
  const parsed = notificationStatusSchema.safeParse(raw);
  if (!parsed.success) {
    throw validationFailed([{ field: 'status', message: 'Valeur attendue : pending, sent, failed ou dropped.' }]);
  }
  return parsed.data;
}

function parseUuidParam(raw: string | null, field: string): string | null {
  if (raw === null) return null;
  if (!uuidSchema.safeParse(raw).success) {
    throw problem({
      status: 400,
      title: 'Parametre invalide',
      code: SHARED_PROBLEM_CODES.validationFailed,
      detail: `${field} doit etre un UUID valide.`,
      errors: [{ field, message: 'UUID invalide.' }],
    });
  }
  return raw;
}
