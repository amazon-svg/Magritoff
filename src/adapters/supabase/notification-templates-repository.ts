/**
 * Implementation Supabase du referentiel des modeles de notification (story
 * E10.15a).
 *
 * Creation et modification sont des `INSERT`/`UPDATE` DIRECTS, gardes par la
 * RLS (`notification_templates_select`/`_insert`/`_update`,
 * `can_manage_notifications`) ET par le trigger BEFORE INSERT OR UPDATE
 * `notification_templates_guard` (migration `20260911010000`) : plafond de
 * 100 modeles sous verrou consultatif par tenant, immuabilite de
 * `event_name`/`channel` sur un `UPDATE`, horodatage/auteur poses cote base.
 * Aucune fonction `security definer` dediee n est necessaire (a la
 * difference de `production_steps`, qui doit affecter une `position`) : le
 * trigger suffit et s applique QUEL QUE SOIT le chemin d ecriture (RPC ou
 * table directe), contrairement a une garde portee par une seule fonction.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type {
  CreateNotificationTemplateCommand,
  NotificationChannel,
  NotificationTemplateDto,
  UpdateNotificationTemplateCommand,
} from '../../modules/notifications/api/contracts.ts';
import {
  NotificationTemplateAccessDeniedError,
  NotificationTemplateChannelShapeError,
  NotificationTemplateLimitReachedError,
  NotificationTemplateNotFoundError,
  NotificationTemplateProductionStepInvalidError,
  NotificationTemplateRecipientsRequiredError,
  NotificationTemplateStepFilterNotApplicableError,
  type NotificationTemplatesListFilter,
  type NotificationTemplatesRepository,
} from '../../modules/notifications/application/notification-templates-repository.ts';

export class SupabaseNotificationTemplatesRepository implements NotificationTemplatesRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async list(tenantId: TenantId, filter: NotificationTemplatesListFilter): Promise<readonly NotificationTemplateDto[]> {
    let query = this.client
      .from('notification_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('event_name', { ascending: true })
      .order('name', { ascending: true });
    if (filter.eventName) query = query.eq('event_name', filter.eventName);
    if (filter.channel) query = query.eq('channel', filter.channel);
    if (filter.status === 'active') query = query.eq('is_active', true);
    if (filter.status === 'disabled') query = query.eq('is_active', false);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(toNotificationTemplateDto);
  }

  async findById(tenantId: TenantId, templateId: string): Promise<NotificationTemplateDto | null> {
    const { data, error } = await this.client
      .from('notification_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', templateId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toNotificationTemplateDto(data) : null;
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateNotificationTemplateCommand,
  ): Promise<NotificationTemplateDto> {
    void actor; // trace : le trigger `notification_templates_guard` lit auth.uid() de la session, pas ce parametre.
    const { data, error } = await this.client
      .from('notification_templates')
      .insert({
        tenant_id: tenantId,
        event_name: command.event_name,
        channel: command.channel,
        audience: command.audience,
        recipients: command.recipients ?? null,
        production_step_id: command.production_step_id ?? null,
        name: command.name,
        subject: command.subject ?? null,
        body: command.body,
        is_active: command.is_active,
      })
      .select()
      .maybeSingle();
    if (error) throw mapNotificationTemplateError(error);
    if (!data) throw new Error('Le modele de notification cree est introuvable juste apres l ecriture.');
    return toNotificationTemplateDto(data);
  }

  async update(
    tenantId: TenantId,
    templateId: string,
    command: UpdateNotificationTemplateCommand,
  ): Promise<NotificationTemplateDto> {
    const patch: Record<string, unknown> = {};
    if ('audience' in command) patch['audience'] = command.audience;
    if ('recipients' in command) patch['recipients'] = command.recipients ?? null;
    if ('production_step_id' in command) patch['production_step_id'] = command.production_step_id ?? null;
    if ('name' in command) patch['name'] = command.name;
    if ('subject' in command) patch['subject'] = command.subject ?? null;
    if ('body' in command) patch['body'] = command.body;
    if ('is_active' in command) patch['is_active'] = command.is_active;

    const { data, error } = await this.client
      .from('notification_templates')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', templateId)
      .select()
      .maybeSingle();
    if (error) throw mapNotificationTemplateError(error);
    if (!data) throw new NotificationTemplateNotFoundError();
    return toNotificationTemplateDto(data);
  }

  /** Meme fonction SQL que `SupabaseProductionStepsRepository.actorHasCapability()` (E10.13), autonome ici. */
  async actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    void actorId; // trace : `user_has_capability` lit `auth.uid()` de la session, pas ce parametre.
    const { data, error } = await this.client.rpc('user_has_capability', {
      p_tenant_id: tenantId,
      p_capability: capability,
    });
    if (error) throw new Error(error.message);
    return Boolean(data);
  }

  /** `api_get_commercial_settings` cree implicitement la ligne si elle n existe pas (meme fonction que `SupabaseCommercialSettingsRepository.get()`) : lu ici pour eviter une dependance croisee TS vers le module `commercial-settings`. */
  async isSmsEnabled(tenantId: TenantId): Promise<boolean> {
    const { data, error } = await this.client.rpc('api_get_commercial_settings', { p_tenant_id: tenantId });
    if (error) throw new Error(`Lecture des reglages de notification impossible: ${error.message}`);
    const row = (data ?? {}) as Record<string, unknown>;
    return Boolean(row['notification_sms_enabled']);
  }

  /**
   * qa-review B2 — `true` ssi `production_steps` porte une ligne `id = stepId`
   * DANS CE TENANT (`is_active` indifferent : une etape desactivee reste une
   * cible valide, contrat). Interroge la table directement (RLS
   * `production_steps_select` deja ouverte a tout membre du tenant courant) :
   * aucune ecriture, un simple `select` suffit, pas besoin de fonction dediee.
   */
  async stepBelongsToTenant(tenantId: TenantId, stepId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('production_steps')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', stepId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data !== null;
  }
}

function isNotificationChannel(value: unknown): value is NotificationChannel {
  return value === 'email' || value === 'sms';
}

function toNotificationTemplateDto(row: Record<string, any>): NotificationTemplateDto {
  return {
    id: row.id,
    event_name: row.event_name,
    channel: isNotificationChannel(row.channel) ? row.channel : 'email',
    audience: row.audience,
    recipients: row.recipients ?? null,
    production_step_id: row.production_step_id ?? null,
    name: row.name,
    subject: row.subject ?? null,
    body: row.body,
    is_active: Boolean(row.is_active),
    created_at: toIsoTimestamp(row.created_at),
    created_by: row.created_by ?? null,
    updated_at: toIsoTimestamp(row.updated_at),
    updated_by: row.updated_by ?? null,
  };
}

/**
 * Traduit une erreur Postgres (trigger `notification_templates_guard`/
 * `notification_templates_assert_same_tenant`, ou violation de contrainte)
 * en erreur de domaine. Meme discipline que `mapProductionStepError`
 * (`production-steps-repository.ts`).
 *
 * qa-review B1/B2 — CETTE FONCTION EST UNE DEFENSE EN PROFONDEUR, PAS LE
 * CHEMIN NOMINAL : le SERVICE (`NotificationTemplatesService.assertBusinessRules`)
 * pre-valide deja la forme par canal et l appartenance de `production_step_id`
 * AVANT tout appel `create()`/`update()` — ces branches ne sont donc
 * normalement jamais atteintes depuis l application elle-meme. Elles restent
 * necessaires pour qu un appel PostgREST direct (qui contournerait le
 * service) recoive un 422 nomme plutot qu un 500 brut derriere une
 * `check_violation`/violation de FK.
 */
function mapNotificationTemplateError(error: { code?: string; message: string }): Error {
  const message = error.message ?? '';

  if (message.includes('permission_denied')) {
    // La route retraduit ce cas en 403 identity.role_required via le SERVICE
    // (`assertCanManageNotifications`, appele AVANT toute ecriture) : cette
    // branche n est normalement jamais atteinte en pratique, defense en
    // profondeur si un appelant contournait le service.
    return new NotificationTemplateAccessDeniedError(message);
  }
  if (message.includes('notification_template.limit_reached')) {
    return new NotificationTemplateLimitReachedError(message);
  }
  if (message.includes('notification_template.not_found')) {
    return new NotificationTemplateNotFoundError(message);
  }
  // Trigger `notification_templates_assert_same_tenant` (qa-review B2) :
  // `production_step_id` d un AUTRE tenant, refuse EN BASE.
  if (message.includes('notification_templates_assert_same_tenant') || message.includes('meme tenant')) {
    return new NotificationTemplateProductionStepInvalidError(message);
  }
  // Violation de FK brute (`production_step_id` inexistant, jamais atteint
  // depuis l application puisque le service verifie l existence AVANT
  // d ecrire — backstop pour un appel direct).
  if (error.code === '23503') {
    return new NotificationTemplateProductionStepInvalidError(message);
  }
  // `check` de coherence (SQLSTATE 23514) : traduits par NOM DE CONTRAINTE
  // plutot que par un message generique — chacun porte un motif metier
  // distinct au contrat.
  if (error.code === '23514' || message.includes('violates check constraint')) {
    if (message.includes('notification_templates_recipients_coherence')) {
      return new NotificationTemplateRecipientsRequiredError(message);
    }
    if (message.includes('notification_templates_step_filter_coherence')) {
      return new NotificationTemplateStepFilterNotApplicableError(message);
    }
    if (
      message.includes('notification_templates_subject_coherence') ||
      message.includes('notification_templates_sms_body_length')
    ) {
      return new NotificationTemplateChannelShapeError([
        { field: 'body', message: 'Forme du modele incompatible avec son canal (contrainte tenue en base).' },
      ]);
    }
  }
  return new Error(message || 'Operation impossible sur le referentiel des modeles de notification.');
}
