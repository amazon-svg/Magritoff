/**
 * Service applicatif du module Notifications (story E10.15a).
 *
 * Orchestration pure : aucune dependance a Supabase ni au HTTP. Les erreurs
 * metier sont des types dedies ; c est la route qui les traduit en Problem
 * RFC 7807, avec le request_id qu elle seule connait.
 *
 * AUCUN ENVOI, AUCUNE FILE ICI (perimetre E10.15a) : `preview()` rend un
 * texte sur un jeu d exemple FICTIF, sans toucher `notification_logs` (qui
 * n existe pas encore) ni ouvrir de connexion reseau.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import {
  allowedTagsForEvent,
  eventSupportsStepFilter,
  exampleTagContext,
  isNotifiableEventName,
  listNotificationEventCatalog,
} from './notification-event-catalog.ts';
import { assertKnownNotificationTags, renderNotificationTags, UnknownNotificationTagError } from './notification-tag-renderer.ts';
import {
  NotificationTemplateAccessDeniedError,
  NotificationTemplateChannelShapeError,
  NotificationTemplateEventNotNotifiableError,
  NotificationTemplateProductionStepInvalidError,
  NotificationTemplateRecipientsRequiredError,
  NotificationTemplateStepFilterNotApplicableError,
  NotificationTemplateUnknownTagError,
  type NotificationTemplatesListFilter,
  type NotificationTemplatesRepository,
} from './notification-templates-repository.ts';
import { NotificationTemplateNotFoundError } from './notification-templates-repository.ts';
import {
  channelShapeIssues,
  type CreateNotificationTemplateCommand,
  type NotificationAudience,
  type NotificationChannel,
  type NotificationEventDescriptorDto,
  type NotificationEventName,
  type NotificationPreviewDto,
  type NotificationTemplateDto,
  type PreviewNotificationTemplateCommand,
  type UpdateNotificationTemplateCommand,
} from '../api/contracts.ts';

/** Droit metier exige par toute ecriture du referentiel (contrat §8.23 §2). */
const CAN_MANAGE_NOTIFICATIONS = 'can_manage_notifications';

/** Plafond SMS AU MODELE (contrat §8.23 §4) — le rendu peut depasser, cas hors perimetre de ce lot (dispatch). */
const SMS_MODEL_BODY_MAX_LENGTH = 480;

/** Longueur d un segment SMS GSM-7, ESTIMATION provisoire (contrat §8.23 §6 : « confirmee contre la documentation du prestataire retenu, jamais devinee » — aucun prestataire choisi a ce jour, reserve (b)). */
const SMS_SEGMENT_LENGTH_ESTIMATE = 160;

export type NotificationTemplatesServiceDependencies = Readonly<{
  repository: NotificationTemplatesRepository;
}>;

export class NotificationTemplatesService {
  private readonly repository: NotificationTemplatesRepository;

  constructor(dependencies: NotificationTemplatesServiceDependencies) {
    this.repository = dependencies.repository;
  }

  /**
   * Catalogue des evenements notifiables (CA1, CA4, CA5) — PAS DE PAGINATION,
   * PAS DE FILTRE PAR TENANT AU FOND : seule sa restriction `channels` varie
   * selon `CommercialSettings.notification_sms_enabled` de l espace.
   */
  async listEvents(tenantId: TenantId): Promise<readonly NotificationEventDescriptorDto[]> {
    const smsEnabled = await this.repository.isSmsEnabled(tenantId);
    return listNotificationEventCatalog(smsEnabled);
  }

  list(tenantId: TenantId, filter: NotificationTemplatesListFilter): Promise<readonly NotificationTemplateDto[]> {
    return this.repository.list(tenantId, filter);
  }

  async getById(tenantId: TenantId, templateId: string): Promise<NotificationTemplateDto> {
    const template = await this.repository.findById(tenantId, templateId);
    if (!template) throw new NotificationTemplateNotFoundError();
    return template;
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateNotificationTemplateCommand,
  ): Promise<NotificationTemplateDto> {
    await this.assertCanManageNotifications(tenantId, actor);
    await this.assertBusinessRules(tenantId, {
      eventName: command.event_name,
      channel: command.channel,
      audience: command.audience,
      recipients: command.recipients,
      productionStepId: command.production_step_id,
      subject: command.subject,
      body: command.body,
    });
    return this.repository.create(tenantId, actor, command);
  }

  async update(
    tenantId: TenantId,
    actor: UserId,
    templateId: string,
    command: UpdateNotificationTemplateCommand,
  ): Promise<NotificationTemplateDto> {
    await this.assertCanManageNotifications(tenantId, actor);
    // `event_name`/`channel` sont IMMUABLES (absents de la commande) : la
    // validation croisee se fait sur l ETAT RESULTANT (courant + patch), pas
    // seulement sur les champs presents dans la commande — sinon un PATCH
    // qui ne change QUE `body` ne revaliderait jamais une balise devenue
    // inconnue, ni la FORME PAR CANAL (qa-review B1 — `channel` est repris
    // du COURANT, jamais absent du `merged`, puisque `channelShapeIssues()`
    // en a besoin sur l ETAT RESULTANT et qu aucune commande ne le porte).
    const current = await this.getById(tenantId, templateId);
    const merged = {
      eventName: current.event_name,
      channel: current.channel,
      audience: command.audience ?? current.audience,
      recipients: 'recipients' in command ? (command.recipients ?? undefined) : (current.recipients ?? undefined),
      productionStepId:
        'production_step_id' in command
          ? (command.production_step_id ?? undefined)
          : (current.production_step_id ?? undefined),
      subject: 'subject' in command ? (command.subject ?? undefined) : (current.subject ?? undefined),
      body: command.body ?? current.body,
    };
    await this.assertBusinessRules(tenantId, merged);
    return this.repository.update(tenantId, templateId, command);
  }

  /**
   * Rend le modele (ENREGISTRE, ou le texte de l ecran si fourni) sur le jeu
   * d exemple FICTIF du catalogue (CA6). AUCUN ENVOI, AUCUNE ecriture.
   */
  async preview(
    tenantId: TenantId,
    templateId: string,
    command: PreviewNotificationTemplateCommand,
  ): Promise<NotificationPreviewDto> {
    const current = await this.getById(tenantId, templateId);
    const subject = command.subject ?? current.subject ?? undefined;
    const body = command.body ?? current.body;

    const allowedTags = allowedTagsForEvent(current.event_name);
    assertKnownNotificationTagsOrThrow(subject, 'subject', allowedTags);
    assertKnownNotificationTagsOrThrow(body, 'body', allowedTags);

    const context = exampleTagContext();
    const renderedSubject = current.channel === 'email' && subject !== undefined ? renderNotificationTags(subject, context) : null;
    const renderedBody = renderNotificationTags(body, context);
    const characterCount = renderedBody.length;
    const smsSegmentCount =
      current.channel === 'sms' ? Math.max(1, Math.ceil(characterCount / SMS_SEGMENT_LENGTH_ESTIMATE)) : null;

    return {
      channel: current.channel,
      subject: renderedSubject,
      body: renderedBody,
      character_count: characterCount,
      sms_segment_count: smsSegmentCount,
    };
  }

  /**
   * Garde d ecriture (403 `identity.role_required` si refuse), PUBLIQUE —
   * meme raison qu en E10.6/E10.13 : la route l appelle EXPLICITEMENT avant
   * de lire la ressource courante (ETag/`If-Match`), pour qu un acteur sans
   * le droit recoive 403 avant un eventuel 404/409.
   */
  async assertCanManageNotifications(tenantId: TenantId, actor: UserId): Promise<void> {
    const authorized = await this.repository.actorHasCapability(tenantId, actor, CAN_MANAGE_NOTIFICATIONS);
    if (!authorized) throw new NotificationTemplateAccessDeniedError();
  }

  /**
   * Regles croisees du CA5 (contrat, motifs 422 de `createNotificationTemplate`,
   * ET de `updateNotificationTemplate` — « memes motifs [...] a l exception
   * de limit_reached », qa-review B1) : forme par canal sur l ETAT RESULTANT
   * (sujet exige/interdit, corps <= 480 sur sms), destinataires exiges/
   * interdits selon l audience, filtre d etape valide sur `order.step_changed`
   * seul ET etape EXISTANTE DANS CE TENANT (qa-review B2), balises connues de
   * l evenement.
   */
  private async assertBusinessRules(
    tenantId: TenantId,
    input: {
      eventName: NotificationEventName;
      channel: NotificationChannel;
      audience: NotificationAudience;
      recipients: readonly string[] | undefined;
      productionStepId: string | undefined;
      subject: string | undefined;
      body: string;
    },
  ): Promise<void> {
    if (!isNotifiableEventName(input.eventName)) {
      throw new NotificationTemplateEventNotNotifiableError();
    }

    const shapeIssues = channelShapeIssues(input.channel, input.subject, input.body);
    if (shapeIssues.length > 0) {
      throw new NotificationTemplateChannelShapeError(shapeIssues);
    }

    const hasRecipients = (input.recipients?.length ?? 0) > 0;
    if (input.audience === 'explicit' && !hasRecipients) {
      throw new NotificationTemplateRecipientsRequiredError(
        "Un destinataire explicite est exige lorsque l'audience vaut explicit.",
      );
    }
    if (input.audience === 'customer' && hasRecipients) {
      throw new NotificationTemplateRecipientsRequiredError(
        "Aucun destinataire ne doit etre fourni lorsque l'audience vaut customer.",
      );
    }

    if (input.productionStepId !== undefined) {
      if (!eventSupportsStepFilter(input.eventName)) {
        throw new NotificationTemplateStepFilterNotApplicableError();
      }
      // qa-review B2 (MAJEUR) — refuse ICI un `production_step_id` absent ou
      // appartenant a un AUTRE TENANT, avant toute ecriture : sans ce
      // controle, un id d un tenant tiers etait accepte, et la FK `on delete
      // cascade` de la migration laissait ce tiers DETRUIRE en cascade une
      // ligne qui ne lui appartient pas — alors que le contrat garantit
      // qu il n existe PAS de DELETE sur cette ressource. Le trigger EN BASE
      // `notification_templates_assert_same_tenant` ferme le meme trou pour
      // un appel PostgREST direct (defense en profondeur, meme patron que
      // `project_tag_links_assert_same_tenant`) ; ce controle-ci rend le cas
      // API propre : 422 plutot qu une violation de FK/trigger brute.
      const stepIsValid = await this.repository.stepBelongsToTenant(tenantId, input.productionStepId);
      if (!stepIsValid) {
        throw new NotificationTemplateProductionStepInvalidError();
      }
    }

    const allowedTags = allowedTagsForEvent(input.eventName);
    assertKnownNotificationTagsOrThrow(input.subject, 'subject', allowedTags);
    assertKnownNotificationTagsOrThrow(input.body, 'body', allowedTags);
  }
}

export { SMS_MODEL_BODY_MAX_LENGTH };

/**
 * Enveloppe `assertKnownNotificationTags` (moteur de rendu, grammaire
 * fermee) et retraduit `UnknownNotificationTagError` en
 * `NotificationTemplateUnknownTagError` NOMMANT LE CHAMP fautif
 * (`subject`/`body`) — c est ce nom que la route reporte dans
 * `Problem.errors[].field`.
 */
function assertKnownNotificationTagsOrThrow(
  text: string | undefined,
  field: 'subject' | 'body',
  allowedTags: ReadonlySet<string>,
): void {
  if (text === undefined) return;
  try {
    assertKnownNotificationTags(text, allowedTags);
  } catch (error) {
    if (error instanceof UnknownNotificationTagError) {
      throw new NotificationTemplateUnknownTagError(error.tags, field);
    }
    throw error;
  }
}
