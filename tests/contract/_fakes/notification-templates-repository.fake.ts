/**
 * Faux repository Notifications (E10.15a), utilise par
 * `notifications.contract.test.ts`.
 *
 * Reimplemente FIDELEMENT les regles tenues EN BASE par la migration
 * `20260911010000` : plafond de 100 modeles/tenant. `NotificationTemplate`
 * (contrat) NE PORTE PAS `tenant_id` — le fake garde donc son propre index
 * `tenantByTemplateId` pour simuler l isolation RLS.
 */
import type { TenantId, UserId } from '@/kernel';
import {
  NotificationTemplateLimitReachedError,
  NotificationTemplateNotFoundError,
  type NotificationTemplatesListFilter,
  type NotificationTemplatesRepository,
} from '@/modules/notifications/application/notification-templates-repository';
import type {
  CreateNotificationTemplateCommand,
  NotificationTemplateDto,
  UpdateNotificationTemplateCommand,
} from '@/modules/notifications/api/contracts';

let sequence = 0;
export function fakeTemplateUuid(): string {
  sequence += 1;
  return `00000000-0000-4000-9300-${String(sequence).padStart(12, '0')}`;
}

export class InMemoryNotificationTemplatesRepository implements NotificationTemplatesRepository {
  private readonly templates = new Map<string, NotificationTemplateDto>();
  private readonly tenantByTemplateId = new Map<string, string>();
  /** Droit `can_manage_notifications` par tenant+acteur. `true` par defaut (equivalent d un `admin`) — un test force `false` pour exercer la garde 403. */
  private readonly actorCapabilities = new Map<string, boolean>();
  private smsEnabled = false;
  /** qa-review B2 — etapes de production VALIDES, cle `${tenantId}:${stepId}` (simule `production_steps`, filtre par tenant). */
  private readonly validProductionSteps = new Set<string>();

  /** TEST UNIQUEMENT — declare une etape de production comme appartenant a `tenantId` (simule `production_steps`). */
  seedProductionStepForTest(tenantId: string, stepId: string): void {
    this.validProductionSteps.add(`${tenantId}:${stepId}`);
  }

  /** TEST UNIQUEMENT. */
  setActorCapabilityForTest(tenantId: string, actorId: string, capability: string, granted: boolean | null): void {
    const key = `${tenantId}:${actorId}:${capability}`;
    if (granted === null) this.actorCapabilities.delete(key);
    else this.actorCapabilities.set(key, granted);
  }

  /** TEST UNIQUEMENT — simule `CommercialSettings.notification_sms_enabled`. */
  setSmsEnabledForTest(enabled: boolean): void {
    this.smsEnabled = enabled;
  }

  /** TEST UNIQUEMENT — seed direct, sans passer par `create()` (evite le plafond pour construire un jeu de fixtures). */
  seedForTest(tenantId: TenantId, template: NotificationTemplateDto): void {
    this.tenantByTemplateId.set(template.id, tenantId);
    this.templates.set(template.id, template);
  }

  /** TEST UNIQUEMENT — force le nombre de modeles d un tenant a la valeur donnee, pour exercer le plafond sans creer 100 fixtures reelles. */
  seedCountForTest(tenantId: TenantId, count: number): void {
    for (let index = 0; index < count; index += 1) {
      const id = fakeTemplateUuid();
      const now = new Date().toISOString();
      this.seedForTest(tenantId, {
        id,
        event_name: 'customer.created',
        channel: 'email',
        audience: 'customer',
        recipients: null,
        production_step_id: null,
        name: `Plafond ${index}`,
        subject: 'Sujet',
        body: 'Corps',
        is_active: false,
        created_at: now,
        created_by: null,
        updated_at: now,
        updated_by: null,
      });
    }
  }

  async actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    return this.actorCapabilities.get(`${tenantId}:${actorId}:${capability}`) ?? true;
  }

  async isSmsEnabled(_tenantId: TenantId): Promise<boolean> {
    return this.smsEnabled;
  }

  async stepBelongsToTenant(tenantId: TenantId, stepId: string): Promise<boolean> {
    return this.validProductionSteps.has(`${tenantId}:${stepId}`);
  }

  async list(tenantId: TenantId, filter: NotificationTemplatesListFilter): Promise<readonly NotificationTemplateDto[]> {
    return [...this.templates.values()]
      .filter((template) => this.belongsToTenant(template.id, tenantId))
      .filter((template) => (filter.eventName ? template.event_name === filter.eventName : true))
      .filter((template) => (filter.channel ? template.channel === filter.channel : true))
      .filter((template) => {
        if (filter.status === 'active') return template.is_active === true;
        if (filter.status === 'disabled') return template.is_active === false;
        return true;
      })
      .sort((a, b) => a.event_name.localeCompare(b.event_name) || a.name.localeCompare(b.name));
  }

  async findById(tenantId: TenantId, templateId: string): Promise<NotificationTemplateDto | null> {
    const found = this.templates.get(templateId);
    return found && this.belongsToTenant(templateId, tenantId) ? found : null;
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateNotificationTemplateCommand,
  ): Promise<NotificationTemplateDto> {
    const tenantTemplateCount = [...this.tenantByTemplateId.values()].filter((t) => t === tenantId).length;
    if (tenantTemplateCount >= 100) throw new NotificationTemplateLimitReachedError();

    const now = new Date().toISOString();
    const id = fakeTemplateUuid();
    const template: NotificationTemplateDto = {
      id,
      event_name: command.event_name,
      channel: command.channel,
      audience: command.audience,
      recipients: command.recipients ?? null,
      production_step_id: command.production_step_id ?? null,
      name: command.name,
      subject: command.subject ?? null,
      body: command.body,
      is_active: command.is_active,
      created_at: now,
      created_by: actor,
      updated_at: now,
      updated_by: actor,
    };
    this.tenantByTemplateId.set(id, tenantId);
    this.templates.set(id, template);
    return template;
  }

  async update(
    tenantId: TenantId,
    templateId: string,
    command: UpdateNotificationTemplateCommand,
  ): Promise<NotificationTemplateDto> {
    const current = await this.findById(tenantId, templateId);
    if (!current) throw new NotificationTemplateNotFoundError();

    const updated: NotificationTemplateDto = {
      ...current,
      ...('audience' in command ? { audience: command.audience! } : {}),
      ...('recipients' in command ? { recipients: command.recipients ?? null } : {}),
      ...('production_step_id' in command ? { production_step_id: command.production_step_id ?? null } : {}),
      ...('name' in command ? { name: command.name! } : {}),
      ...('subject' in command ? { subject: command.subject ?? null } : {}),
      ...('body' in command ? { body: command.body! } : {}),
      ...('is_active' in command ? { is_active: command.is_active! } : {}),
      updated_at: new Date().toISOString(),
    };
    this.templates.set(templateId, updated);
    return updated;
  }

  private belongsToTenant(templateId: string, tenantId: TenantId): boolean {
    return this.tenantByTemplateId.get(templateId) === tenantId;
  }
}
