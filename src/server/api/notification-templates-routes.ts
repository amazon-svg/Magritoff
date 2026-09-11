/**
 * Routes HTTP du module Notifications (story E10.15a), sur la facade Gestion
 * commerciale (`defineGescomRoute`, E10.0).
 *
 * SIX operations de configuration, AUCUN ENVOI : catalogue et lecture
 * (list/get) ouverts a tout membre du tenant, ecriture (create/update)
 * gardee par le droit metier `can_manage_notifications`, verifiee par le
 * SERVICE avant toute lecture de la ressource courante — meme ordre que
 * `production-steps-routes.ts`/`document-templates-routes.ts` : un acteur
 * sans le droit ne doit pas apprendre par la forme du refus (404/409) que sa
 * commande aurait par ailleurs ete acceptee.
 *
 * AUCUNE CLE DE SERVICE sur ces cinq chemins (contrat, §8.23 §2 point 4) :
 * toutes les operations sont `authentication: 'user'`, sans `requiredScopes`.
 *
 * `listNotificationLogs` (`GET /notification-logs`) N EST PAS ICI : assigne a
 * E10.15c par le decoupage du contrat (§8.23 §8).
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1).
 */
import {
  createNotificationTemplateCommandSchema,
  notificationChannelSchema,
  notificationEventDescriptorSchema,
  notificationPreviewSchema,
  notificationTemplateSchema,
  notificationTemplateStatusFilterSchema,
  notificationTemplatesListSchema,
  previewNotificationTemplateCommandSchema,
  updateNotificationTemplateCommandSchema,
} from '../../modules/notifications/api/contracts.ts';
import type {
  NotificationChannel,
  NotificationEventName,
  NotificationTemplateStatusFilter,
} from '../../modules/notifications/api/contracts.ts';
import { notificationEventNameSchema } from '../../modules/notifications/api/contracts.ts';
import type { NotificationTemplatesService } from '../../modules/notifications/application/notification-templates-service.ts';
import {
  NotificationTemplateAccessDeniedError,
  NotificationTemplateChannelShapeError,
  NotificationTemplateEventNotNotifiableError,
  NotificationTemplateNotFoundError,
  NotificationTemplateProductionStepInvalidError,
  NotificationTemplateRecipientsRequiredError,
  NotificationTemplateStepFilterNotApplicableError,
  NotificationTemplateUnknownTagError,
} from '../../modules/notifications/application/notification-templates-repository.ts';
import { NotificationTemplateLimitReachedError } from '../../modules/notifications/application/notification-templates-repository.ts';
import {
  assertPrecondition,
  computeEntityTag,
  problem,
  roleRequired,
  SHARED_PROBLEM_CODES,
  validationFailed,
} from '../../modules/_shared/application/index.ts';
import { z } from 'zod';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

export function createNotificationTemplatesRoutes(service: NotificationTemplatesService): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/notification-events',
      operationId: 'listNotificationEvents',
      authentication: 'user',
      inputSchema: null,
      dataSchema: z.array(notificationEventDescriptorSchema),
      async handle(context) {
        const events = await service.listEvents(context.tenantId);
        return { status: 200, data: [...events] };
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/notification-templates',
      operationId: 'listNotificationTemplates',
      authentication: 'user',
      inputSchema: null,
      dataSchema: notificationTemplatesListSchema,
      async handle(context) {
        const eventName = parseEventName(context.url.searchParams.get('event_name'));
        const channel = parseChannel(context.url.searchParams.get('channel'));
        const status = parseStatus(context.url.searchParams.get('status'));
        const templates = await service.list(context.tenantId, { eventName, channel, status });
        // PAS DE PAGINATION, PAS D ETAG DE COLLECTION (contrat : plafond de
        // 100 modeles/tenant, la concurrence se joue modele par modele —
        // meme parti que `listDocumentPdfTemplates`).
        return { status: 200, data: [...templates] };
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/notification-templates',
      operationId: 'createNotificationTemplate',
      authentication: 'user',
      createsResource: true,
      inputSchema: createNotificationTemplateCommandSchema,
      dataSchema: notificationTemplateSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const actor = requireUserId(context);
          const created = await service.create(context.tenantId, actor, input);
          return { status: 201, data: created, etag: await computeEntityTag(created) };
        });
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/notification-templates/{templateId}',
      operationId: 'getNotificationTemplate',
      authentication: 'user',
      inputSchema: null,
      dataSchema: notificationTemplateSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const template = await service.getById(context.tenantId, context.params['templateId']!);
          return { status: 200, data: template, etag: await computeEntityTag(template) };
        });
      },
    }),

    defineGescomRoute({
      method: 'PATCH',
      path: '/notification-templates/{templateId}',
      operationId: 'updateNotificationTemplate',
      authentication: 'user',
      inputSchema: updateNotificationTemplateCommandSchema,
      dataSchema: notificationTemplateSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const templateId = context.params['templateId']!;
          const actor = requireUserId(context);
          // La garde precede la lecture qui alimente l `ETag` (meme ordre que
          // `updateProductionStep`/`updateDocumentPdfTemplate`).
          await service.assertCanManageNotifications(context.tenantId, actor);

          const current = await service.getById(context.tenantId, templateId);
          const currentTag = await computeEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.update(context.tenantId, actor, templateId, input);
          return { status: 200, data: updated, etag: await computeEntityTag(updated) };
        });
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/notification-templates/{templateId}/previews',
      operationId: 'previewNotificationTemplate',
      authentication: 'user',
      // 200, JAMAIS 201 : aucune ressource metier creee (contrat, decision #2
      // §8.23 §2). Pas d Idempotency-Key : fonction pure du corps envoye.
      inputSchema: previewNotificationTemplateCommandSchema,
      dataSchema: notificationPreviewSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const preview = await service.preview(context.tenantId, context.params['templateId']!, input);
          return { status: 200, data: preview };
        });
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

function parseStatus(raw: string | null): NotificationTemplateStatusFilter | null {
  if (raw === null) return null;
  const parsed = notificationTemplateStatusFilterSchema.safeParse(raw);
  if (!parsed.success) {
    throw validationFailed([{ field: 'status', message: 'Valeur attendue : active ou disabled.' }]);
  }
  return parsed.data;
}

/** L identifiant utilisateur qui ecrit la ressource (audit `created_by` implicite via `auth.uid()` cote base). */
function requireUserId(context: GescomRequestContext): import('../../kernel/ids/index.ts').UserId {
  if (context.principal.kind !== 'user') {
    throw problem({
      status: 403,
      title: 'Acteur utilisateur requis',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
    });
  }
  return context.principal.userId;
}

/** Traduit les erreurs de domaine du module Notifications en Problem RFC 7807. */
async function withDomainErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof NotificationTemplateAccessDeniedError) {
      throw roleRequired(['can_manage_notifications']);
    }
    if (error instanceof NotificationTemplateNotFoundError) {
      throw problem({
        status: 404,
        title: 'Modèle de notification introuvable',
        code: 'notification_template.not_found',
      });
    }
    if (error instanceof NotificationTemplateUnknownTagError) {
      throw problem({
        status: 422,
        title: 'Balise inconnue',
        code: 'notification_template.unknown_tag',
        detail: error.message,
        errors: error.tags.map((tag) => ({ field: error.field, message: `Balise inconnue : ${tag}` })),
      });
    }
    if (error instanceof NotificationTemplateEventNotNotifiableError) {
      throw problem({
        status: 422,
        title: 'Événement non notifiable',
        code: 'notification_template.event_not_notifiable',
        detail: error.message,
      });
    }
    if (error instanceof NotificationTemplateRecipientsRequiredError) {
      throw problem({
        status: 422,
        title: 'Destinataires invalides',
        code: 'notification_template.recipients_required',
        detail: error.message,
      });
    }
    if (error instanceof NotificationTemplateStepFilterNotApplicableError) {
      throw problem({
        status: 422,
        title: 'Filtre d’étape non applicable',
        code: 'notification_template.step_filter_not_applicable',
        detail: error.message,
      });
    }
    if (error instanceof NotificationTemplateProductionStepInvalidError) {
      // qa-review B2 — 422 api.validation_failed generique (« etape inconnue »),
      // meme code que les autres regles structurelles, JAMAIS une violation
      // de FK brute (500).
      throw validationFailed([{ field: 'production_step_id', message: error.message }]);
    }
    if (error instanceof NotificationTemplateChannelShapeError) {
      // qa-review B1 — createNotificationTemplate ET updateNotificationTemplate
      // partagent le MEME code 422 pour ces motifs (contrat : « memes motifs
      // que createNotificationTemplate »), porte par les schemas Zod a la
      // creation et par ce mapping a la modification.
      throw validationFailed(error.issues.map((issue) => ({ field: issue.field, message: issue.message })));
    }
    if (error instanceof NotificationTemplateLimitReachedError) {
      throw problem({
        status: 422,
        title: 'Plafond atteint',
        code: 'notification_template.limit_reached',
        detail: error.message,
      });
    }
    throw error;
  }
}
