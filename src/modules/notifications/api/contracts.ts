/**
 * Contrats Zod du module Notifications multicanal (story E10.15a — socle
 * configurable, AUCUN envoi).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schemas `NotificationChannel`, `NotificationEventName`,
 * `NotificationAudience`, `NotificationTagId`, `NotificationTag`,
 * `NotificationEventDescriptor`, `NotificationTemplateStatusFilter`,
 * `NotificationTemplate`, `CreateNotificationTemplateCommand`,
 * `UpdateNotificationTemplateCommand`, `PreviewNotificationTemplateCommand`,
 * `NotificationPreview`). Le YAML fait foi ; docs/api/CONVENTIONS.md §8.23 en
 * donne le detail arbitre.
 *
 * `NotificationLog`/`listNotificationLogs` (story E10.15c) SONT ICI : le
 * decoupage en cinq sous-stories (§8.23 §8) les assigne a ce lot (« Migration
 * notification_logs [...], GET /notification-logs »), qui pose enfin la
 * table dont E10.15a avait deja ecrit le contrat.
 */
import { z } from 'zod';
import { timestampSchema, uuidSchema } from '../../_shared/api/index.ts';

export const notificationChannelSchema = z.enum(['email', 'sms']);

/**
 * Sous-ensemble STRICT de `OUTBOX_EVENT_NAMES` (src/modules/_shared/api/contracts.ts)
 * — memes valeurs litterales, jamais un second vocabulaire. `order.created`
 * EST VOLONTAIREMENT ABSENT : ce nom n existe pas dans `OUTBOX_EVENT_NAMES`
 * (le contrat l a explicitement refuse, `QuoteConversionPayload` : « un seul
 * evenement pour ce fait, et pas un second order.created »). La naissance
 * d une commande se notifie sur `quote.converted`.
 */
export const NOTIFICATION_EVENT_NAMES = [
  'quote.sent',
  'quote.converted',
  'order.step_changed',
  'order.files_submitted',
  'customer.created',
] as const;

export const notificationEventNameSchema = z.enum(NOTIFICATION_EVENT_NAMES);

export const notificationAudienceSchema = z.enum(['customer', 'explicit']);

/**
 * Liste blanche FERMEE des balises substituables (CA5). Reprise au caractere
 * pres de `DocumentFieldId` (E10.10b-4b) quand la donnee est la meme.
 */
export const NOTIFICATION_TAG_IDS = [
  'tenant.name',
  'customer.company_name',
  'customer.contact_name',
  'quote.number',
  'quote.valid_until',
  'quote.customer_reference',
  'order.number',
  'order.customer_reference',
  'order.expected_delivery_date',
  'step.label',
  'step.previous_label',
  'files.count',
  'link.portal_quotes',
] as const;

export const notificationTagIdSchema = z.enum(NOTIFICATION_TAG_IDS);

export const notificationTagSchema = z
  .object({
    id: notificationTagIdSchema,
    syntax: z.string(),
    label: z.string(),
    nullable: z.boolean(),
    example: z.string(),
  })
  .strict();

export const notificationEventDescriptorSchema = z
  .object({
    event_name: notificationEventNameSchema,
    label: z.string(),
    description: z.string(),
    audiences: z.array(notificationAudienceSchema).min(1),
    channels: z.array(notificationChannelSchema).min(1),
    tags: z.array(notificationTagSchema).min(1),
    supports_step_filter: z.boolean(),
    coalescing_window_minutes: z.number().int().min(0).max(120),
  })
  .strict();

export const notificationTemplateStatusFilterSchema = z.enum(['active', 'disabled']);

/** Bornes reprises telles quelles du contrat (§8.23 §4, colonne `recipients`). */
const notificationRecipientsSchema = z.array(z.string().min(3).max(320)).min(1).max(10);

export const notificationTemplateSchema = z
  .object({
    id: uuidSchema,
    event_name: notificationEventNameSchema,
    channel: notificationChannelSchema,
    audience: notificationAudienceSchema,
    recipients: notificationRecipientsSchema.nullable(),
    production_step_id: uuidSchema.nullable(),
    name: z.string().min(1).max(120),
    subject: z.string().min(1).max(200).nullable(),
    body: z.string().min(1).max(4000),
    is_active: z.boolean(),
    created_at: timestampSchema,
    created_by: uuidSchema.nullable(),
    updated_at: timestampSchema,
    updated_by: uuidSchema.nullable(),
  })
  .strict();

export const notificationTemplatesListSchema = z.array(notificationTemplateSchema);

/**
 * Commande de creation (CA2, CA5). Les regles croisees (`recipients` exige/
 * interdit selon `audience`, `production_step_id` valide sur
 * `order.step_changed` seul, balises connues de l evenement) sont verifiees
 * par le SERVICE (`NotificationTemplatesService`), pas ici : elles produisent
 * des codes metier nommes (`notification_template.recipients_required`, etc.),
 * jamais le `api.validation_failed` generique qu un `.superRefine()` rendrait.
 * Seules les regles STRUCTURELLES par canal (sujet exige/interdit selon
 * `channel`, corps <= 480 sur `sms`) sont ici : le contrat les classe
 * lui-meme sous `api.validation_failed` (createNotificationTemplate, 422).
 */
export const createNotificationTemplateCommandSchema = z
  .object({
    event_name: notificationEventNameSchema,
    channel: notificationChannelSchema,
    audience: notificationAudienceSchema,
    recipients: notificationRecipientsSchema.optional(),
    production_step_id: uuidSchema.optional(),
    name: z.string().trim().min(1).max(120),
    subject: z.string().trim().min(1).max(200).optional(),
    body: z.string().min(1).max(4000),
    is_active: z.boolean().optional().default(false),
  })
  .strict()
  .superRefine((value, ctx) => assertChannelShape(value.channel, value.subject, value.body, ctx));

export const updateNotificationTemplateCommandSchema = z
  .object({
    audience: notificationAudienceSchema.optional(),
    recipients: notificationRecipientsSchema.nullable().optional(),
    production_step_id: uuidSchema.nullable().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    subject: z.string().trim().min(1).max(200).nullable().optional(),
    body: z.string().min(1).max(4000).optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'La modification doit porter au moins un champ.',
  });

export const previewNotificationTemplateCommandSchema = z
  .object({
    subject: z.string().min(1).max(200).optional(),
    body: z.string().min(1).max(4000).optional(),
  })
  .strict();

export const notificationPreviewSchema = z
  .object({
    channel: notificationChannelSchema,
    subject: z.string().nullable(),
    body: z.string(),
    character_count: z.number().int().min(0),
    sms_segment_count: z.number().int().min(1).nullable(),
  })
  .strict();

/**
 * Etat d acheminement d un message (story E10.15c, contrat §8.23 §4).
 * `pending` en file/en attente de reprise ; `sent` accepte par le
 * prestataire ; `failed` tente et abandonne (tentatives epuisees ou
 * fraicheur depassee) ; `dropped` jamais tente, motif connu d avance
 * (`notification.no_recipient`, etc.).
 */
export const notificationStatusSchema = z.enum(['pending', 'sent', 'failed', 'dropped']);

/**
 * Une entree du journal des notifications (story E10.15c, contrat §8.23 §4) :
 * UN message, UN destinataire, UN canal. Cette table est AUSSI la file
 * d envoi — le texte est FIGE A LA MISE EN FILE, jamais relu au modele.
 */
export const notificationLogSchema = z
  .object({
    id: uuidSchema,
    event_id: uuidSchema,
    event_name: notificationEventNameSchema,
    template_id: uuidSchema.nullable(),
    channel: notificationChannelSchema,
    status: notificationStatusSchema,
    aggregate_type: z.string(),
    aggregate_id: uuidSchema,
    recipient: z.string().nullable(),
    subject: z.string().nullable(),
    body: z.string(),
    attempts: z.number().int().min(0),
    occurrence_count: z.number().int().min(1),
    provider_message_id: z.string().nullable(),
    last_error: z.string().nullable(),
    created_at: timestampSchema,
    sent_at: timestampSchema.nullable(),
  })
  .strict();

export const notificationLogsListSchema = z.array(notificationLogSchema);

export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationEventName = z.infer<typeof notificationEventNameSchema>;
export type NotificationAudience = z.infer<typeof notificationAudienceSchema>;
export type NotificationTagId = z.infer<typeof notificationTagIdSchema>;
export type NotificationTagDto = z.infer<typeof notificationTagSchema>;
export type NotificationEventDescriptorDto = z.infer<typeof notificationEventDescriptorSchema>;
export type NotificationTemplateStatusFilter = z.infer<typeof notificationTemplateStatusFilterSchema>;
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;
export type NotificationLogDto = z.infer<typeof notificationLogSchema>;
export type NotificationTemplateDto = z.infer<typeof notificationTemplateSchema>;
export type CreateNotificationTemplateCommand = z.infer<typeof createNotificationTemplateCommandSchema>;
export type UpdateNotificationTemplateCommand = z.infer<typeof updateNotificationTemplateCommandSchema>;
export type PreviewNotificationTemplateCommand = z.infer<typeof previewNotificationTemplateCommandSchema>;
export type NotificationPreviewDto = z.infer<typeof notificationPreviewSchema>;

/**
 * Regles STRUCTURELLES par canal (contrat, motifs `api.validation_failed` de
 * `createNotificationTemplate`) : sujet exige sur `email`, interdit sur
 * `sms` ; corps plafonne a 480 caracteres sur `sms` (480 au MODELE — le texte
 * RENDU peut depasser une fois les balises substituees, ce qui est une
 * affaire de rendu/livraison, hors perimetre de ce lot).
 */
export type ChannelShapeIssue = Readonly<{ field: 'subject' | 'body'; message: string }>;

/**
 * Regles STRUCTURELLES par canal (contrat, motifs `api.validation_failed`),
 * EXPORTEE et PARTAGEE entre le schema Zod de CREATION (`.superRefine`
 * ci-dessous) et le SERVICE (qa-review B1) : `updateNotificationTemplate`
 * n a pas `channel` dans sa commande (immuable), donc AUCUN schema Zod ne
 * peut, a lui seul, revalider ces regles sur l ETAT RESULTANT d un PATCH —
 * seul le service, qui connait le `channel` courant, le peut. Une seule
 * fonction PURE, deux appelants, jamais deux implementations qui divergent.
 */
export function channelShapeIssues(
  channel: NotificationChannel,
  subject: string | null | undefined,
  body: string,
): readonly ChannelShapeIssue[] {
  const issues: ChannelShapeIssue[] = [];
  if (channel === 'email' && (subject === undefined || subject === null || subject.length === 0)) {
    issues.push({ field: 'subject', message: 'Le sujet est requis sur le canal email.' });
  }
  if (channel === 'sms' && subject !== undefined && subject !== null) {
    issues.push({ field: 'subject', message: 'Le sujet est interdit sur le canal sms.' });
  }
  if (channel === 'sms' && body.length > 480) {
    issues.push({ field: 'body', message: 'Le corps est limite a 480 caracteres sur le canal sms.' });
  }
  return issues;
}

function assertChannelShape(
  channel: NotificationChannel,
  subject: string | undefined,
  body: string,
  ctx: z.RefinementCtx,
): void {
  for (const issue of channelShapeIssues(channel, subject, body)) {
    ctx.addIssue({ code: 'custom', path: [issue.field], message: issue.message });
  }
}

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts).
// ---------------------------------------------------------------------------
import type {
  CreateNotificationTemplateCommand as CreateNotificationTemplateCommandContract,
  NotificationChannel as NotificationChannelContract,
  NotificationEventDescriptor as NotificationEventDescriptorContract,
  NotificationEventName as NotificationEventNameContract,
  NotificationLog as NotificationLogContract,
  NotificationPreview as NotificationPreviewContract,
  NotificationStatus as NotificationStatusContract,
  NotificationTemplate as NotificationTemplateContract,
  NotificationTemplateStatusFilter as NotificationTemplateStatusFilterContract,
  PreviewNotificationTemplateCommand as PreviewNotificationTemplateCommandContract,
  UpdateNotificationTemplateCommand as UpdateNotificationTemplateCommandContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const NOTIFICATIONS_CONTRACT_ALIGNMENT = Object.freeze({
  channel: true as AssertAssignable<NotificationChannel, NotificationChannelContract>,
  eventName: true as AssertAssignable<NotificationEventName, NotificationEventNameContract>,
  statusFilter: true as AssertAssignable<NotificationTemplateStatusFilter, NotificationTemplateStatusFilterContract>,
  logStatus: true as AssertAssignable<NotificationStatus, NotificationStatusContract>,
  log: true as AssertAssignable<NotificationLogDto, NotificationLogContract>,
  eventDescriptor: true as AssertAssignable<NotificationEventDescriptorDto, NotificationEventDescriptorContract>,
  template: true as AssertAssignable<NotificationTemplateDto, NotificationTemplateContract>,
  createCommand: true as AssertAssignable<
    CreateNotificationTemplateCommand,
    CreateNotificationTemplateCommandContract
  >,
  updateCommand: true as AssertAssignable<
    UpdateNotificationTemplateCommand,
    UpdateNotificationTemplateCommandContract
  >,
  previewCommand: true as AssertAssignable<
    PreviewNotificationTemplateCommand,
    PreviewNotificationTemplateCommandContract
  >,
  preview: true as AssertAssignable<NotificationPreviewDto, NotificationPreviewContract>,
});
