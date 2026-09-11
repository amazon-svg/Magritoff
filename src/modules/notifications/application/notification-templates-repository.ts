import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  ChannelShapeIssue,
  CreateNotificationTemplateCommand,
  NotificationEventName,
  NotificationTemplateDto,
  UpdateNotificationTemplateCommand,
} from '../api/contracts.ts';

/** Le modele n existe pas dans le tenant du jeton (404 `notification_template.not_found`). */
export class NotificationTemplateNotFoundError extends Error {
  constructor(message = 'Modele de notification introuvable dans ce tenant.') {
    super(message);
    this.name = 'NotificationTemplateNotFoundError';
  }
}

/** L acteur n a pas le droit metier `can_manage_notifications` requis pour ecrire le referentiel (403 `identity.role_required`). */
export class NotificationTemplateAccessDeniedError extends Error {
  constructor(message = 'Le droit can_manage_notifications est requis pour administrer les modeles de notification.') {
    super(message);
    this.name = 'NotificationTemplateAccessDeniedError';
  }
}

/** Le tenant porte deja 100 modeles (422 `notification_template.limit_reached`). */
export class NotificationTemplateLimitReachedError extends Error {
  constructor(message = 'Ce tenant a deja atteint le plafond de 100 modeles de notification.') {
    super(message);
    this.name = 'NotificationTemplateLimitReachedError';
  }
}

/** `event_name` existe dans `EventName` mais n est pas au catalogue notifiable (422 `notification_template.event_not_notifiable`). Defense en profondeur : la liste blanche de `notificationEventNameSchema` rend ce cas normalement inatteignable depuis un client conforme. */
export class NotificationTemplateEventNotNotifiableError extends Error {
  constructor(message = 'Cet evenement ne fait pas partie du catalogue notifiable.') {
    super(message);
    this.name = 'NotificationTemplateEventNotNotifiableError';
  }
}

/** Audience `explicit` sans destinataire, ou destinataires renseignes avec l audience `customer` (422 `notification_template.recipients_required`). */
export class NotificationTemplateRecipientsRequiredError extends Error {
  constructor(
    message = 'Les destinataires explicites sont exiges avec l audience explicit et interdits avec l audience customer.',
  ) {
    super(message);
    this.name = 'NotificationTemplateRecipientsRequiredError';
  }
}

/** `production_step_id` pose sur un evenement autre que `order.step_changed` (422 `notification_template.step_filter_not_applicable`). */
export class NotificationTemplateStepFilterNotApplicableError extends Error {
  constructor(message = 'Le filtre d etape n est valide que sur l evenement order.step_changed.') {
    super(message);
    this.name = 'NotificationTemplateStepFilterNotApplicableError';
  }
}

/** Au moins une balise du sujet ou du corps est absente de la liste blanche de l evenement choisi (422 `notification_template.unknown_tag`, CA5). `field` designe lequel des deux textes porte la balise fautive, pour nommer correctement le champ dans `Problem.errors`. */
export class NotificationTemplateUnknownTagError extends Error {
  constructor(
    readonly tags: readonly string[],
    readonly field: 'subject' | 'body' = 'body',
  ) {
    super(`Balise(s) inconnue(s) pour cet evenement : ${tags.join(', ')}`);
    this.name = 'NotificationTemplateUnknownTagError';
  }
}

/**
 * qa-review B1 — le sujet/corps RESULTANT (courant fusionne au patch) ne
 * respecte pas la forme imposee par le `channel` (sujet exige/interdit selon
 * le canal, corps <= 480 caracteres sur `sms`). Contrat,
 * `updateNotificationTemplate` 422 : « memes motifs que
 * createNotificationTemplate, a l exception de limit_reached » — donc
 * `api.validation_failed`, PAS un code `notification_template.*` dedie
 * (meme code que la creation, ou ce sont les schemas Zod qui portent
 * directement `errors[]`).
 */
export class NotificationTemplateChannelShapeError extends Error {
  constructor(readonly issues: readonly ChannelShapeIssue[]) {
    super(`Forme invalide pour ce canal : ${issues.map((issue) => issue.message).join(' ')}`);
    this.name = 'NotificationTemplateChannelShapeError';
  }
}

/**
 * qa-review B2 (MAJEUR) — `production_step_id` ne designe aucune etape du
 * TENANT COURANT (absente, ou appartenant a un autre tenant). 422
 * `api.validation_failed` (« etape inconnue »), JAMAIS une violation de FK
 * brute (23503) ni, pire, une cascade de suppression inter-tenant si l id
 * pointait reellement vers l etape d un tiers (voir le trigger EN BASE
 * `notification_templates_assert_same_tenant`, meme patron que
 * `project_tag_links_assert_same_tenant`, qui ferme ce chemin meme pour un
 * appel PostgREST direct).
 */
export class NotificationTemplateProductionStepInvalidError extends Error {
  constructor(message = 'Etape de production introuvable dans ce tenant.') {
    super(message);
    this.name = 'NotificationTemplateProductionStepInvalidError';
  }
}

export type NotificationTemplatesListFilter = Readonly<{
  eventName: NotificationEventName | null;
  channel: 'email' | 'sms' | null;
  status: 'active' | 'disabled' | null;
}>;

/**
 * Port (interface) du referentiel des modeles de notification (E10.15a).
 * L implementation Supabase vit dans
 * src/adapters/supabase/notification-templates-repository.ts ; ce module n en
 * connait que le contrat.
 */
export interface NotificationTemplatesRepository {
  list(tenantId: TenantId, filter: NotificationTemplatesListFilter): Promise<readonly NotificationTemplateDto[]>;

  /** `null` si absent ou hors du tenant (404 cote route, jamais 403). */
  findById(tenantId: TenantId, templateId: string): Promise<NotificationTemplateDto | null>;

  /**
   * Insertion directe, gardee par la RLS (`notification_templates_write`,
   * `can_manage_notifications`) ET par le trigger
   * `notification_templates_guard` (plafond de 100 sous verrou consultatif
   * par tenant, immuabilite de `event_name`/`channel`, horodatage/auteur).
   * Leve `NotificationTemplateLimitReachedError`/`NotificationTemplateAccessDeniedError`.
   */
  create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateNotificationTemplateCommand,
  ): Promise<NotificationTemplateDto>;

  /**
   * `UPDATE` direct, garde par la meme RLS/trigger que `create()`. Leve
   * `NotificationTemplateNotFoundError`/`NotificationTemplateAccessDeniedError`.
   */
  update(
    tenantId: TenantId,
    templateId: string,
    command: UpdateNotificationTemplateCommand,
  ): Promise<NotificationTemplateDto>;

  /**
   * Evalue le droit metier `can_manage_notifications` de l acteur dans le
   * tenant, via `public.user_has_capability` — meme mecanisme que
   * `ProductionStepsRepository.actorHasCapability()`, reimplemente ici plutot
   * que partage entre modules (convention du depot).
   */
  actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean>;

  /**
   * Etat du reglage `CommercialSettings.notification_sms_enabled` de l espace
   * — necessaire a `listNotificationEvents` pour filtrer `channels` (contrat,
   * `NotificationEventDescriptor.channels`). Lu ICI plutot que par une
   * dependance croisee vers le module `commercial-settings` (meme
   * raisonnement documente que `CommercialSettingsRepository` sur
   * `default_validity_days`).
   */
  isSmsEnabled(tenantId: TenantId): Promise<boolean>;

  /**
   * qa-review B2 — `true` ssi `stepId` designe une etape de production QUI
   * APPARTIENT AU TENANT COURANT (existante, quel que soit son `is_active`).
   * Appele par le SERVICE avant toute ecriture qui pose `production_step_id`
   * (create/update), pour rendre 422 `api.validation_failed` (« etape
   * inconnue ») plutot que de laisser une FK inter-tenant s ecrire puis se
   * faire detruire en cascade par un tiers.
   */
  stepBelongsToTenant(tenantId: TenantId, stepId: string): Promise<boolean>;
}
