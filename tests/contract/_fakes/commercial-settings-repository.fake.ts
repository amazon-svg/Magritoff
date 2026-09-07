/**
 * Faux repository Reglages commerciaux (E10.10a), meme principe que les
 * autres fakes de `tests/contract/_fakes/` — partage entre les tests de
 * contrat, jamais reecrit a la main deux fois.
 */
import type { TenantId, UserId } from '@/kernel';
import type { CommercialSettingsDto, UpdateCommercialSettingsCommand } from '@/modules/commercial-settings/api/contracts';
import type { CommercialSettingsRepository } from '@/modules/commercial-settings/application/commercial-settings-repository';

export class InMemoryCommercialSettingsRepository implements CommercialSettingsRepository {
  private readonly settings = new Map<string, CommercialSettingsDto>();
  /** `true` par defaut (equivalent d un `admin`) : un test force `false` pour exercer 403 `identity.role_required`. */
  private readonly actorCapabilities = new Map<string, boolean>();

  setActorCapabilityForTest(tenantId: string, actorId: string, capability: string, granted: boolean | null): void {
    const key = `${tenantId}:${actorId}:${capability}`;
    if (granted === null) this.actorCapabilities.delete(key);
    else this.actorCapabilities.set(key, granted);
  }

  async actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    return this.actorCapabilities.get(`${tenantId}:${actorId}:${capability}`) ?? true;
  }

  async get(tenantId: TenantId): Promise<CommercialSettingsDto> {
    const existing = this.settings.get(tenantId);
    if (existing) return existing;
    // Ressource SINGLETON creee IMPLICITEMENT a sa premiere lecture (contrat).
    const created: CommercialSettingsDto = {
      tenant_id: tenantId,
      default_validity_days: null,
      updated_at: new Date().toISOString(),
    };
    this.settings.set(tenantId, created);
    return created;
  }

  async update(
    tenantId: TenantId,
    command: UpdateCommercialSettingsCommand,
  ): Promise<CommercialSettingsDto> {
    const current = await this.get(tenantId);
    const updated: CommercialSettingsDto = {
      ...current,
      ...('default_validity_days' in command
        ? { default_validity_days: command.default_validity_days ?? null }
        : {}),
      updated_at: new Date().toISOString(),
    };
    this.settings.set(tenantId, updated);
    return updated;
  }
}
