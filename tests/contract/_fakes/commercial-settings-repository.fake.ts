/**
 * Faux repository Reglages commerciaux (E10.10a, ETENDU par E10.22d), meme
 * principe que les autres fakes de `tests/contract/_fakes/` — partage entre
 * les tests de contrat, jamais reecrit a la main deux fois.
 *
 * Reproduit en memoire la regle du trigger `commercial_settings_track_purge_
 * activation` (migration 20260911000000) : une transition false->true pose
 * `enabledAt = now()` ; true->false le remet a `null` ; le booleen inchange
 * (true->true ou false->false) laisse `enabledAt` INCHANGE (le plancher ne se
 * recule pas en re-cliquant sur "activer").
 */
import type { TenantId, UserId } from '@/kernel';
import type { CommercialSettingsDto, UpdateCommercialSettingsCommand } from '@/modules/commercial-settings/api/contracts';
import type { CommercialSettingsRepository } from '@/modules/commercial-settings/application/commercial-settings-repository';

/** Meme plancher que `order_file_effective_purge_at` cote SQL (§8.22bis §4 du contrat). */
const ORDER_FILE_PURGE_ACTIVATION_FLOOR_DAYS = 30;

export class InMemoryCommercialSettingsRepository implements CommercialSettingsRepository {
  private readonly settings = new Map<string, CommercialSettingsDto>();
  /** Miroir de `commercial_settings.order_file_purge_enabled_at` — jamais expose directement au DTO, seulement via `order_file_purge_effective_from`. */
  private readonly purgeEnabledAt = new Map<string, string | null>();
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
    // Reserve (i) fermee le 2026-09-11 : order_file_purge_enabled vaut false
    // par defaut, aucune reprise pour les tenants existants.
    this.purgeEnabledAt.set(tenantId, null);
    const created: CommercialSettingsDto = {
      tenant_id: tenantId,
      default_validity_days: null,
      order_file_purge_enabled: false,
      // E10.15a — memes defauts que la migration `20260911010000`.
      notification_retention_days: 90,
      notification_sms_enabled: false,
      notification_sms_daily_cap: 200,
      order_file_purge_effective_from: null,
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
    let enabledAt = this.purgeEnabledAt.get(tenantId) ?? null;
    let enabled = current.order_file_purge_enabled ?? false;
    if ('order_file_purge_enabled' in command) {
      const requested = Boolean(command.order_file_purge_enabled);
      if (requested && !enabled) {
        enabledAt = new Date().toISOString();
      } else if (!requested) {
        enabledAt = null;
      }
      // requested === enabled === true : enabledAt INCHANGE (le plancher ne
      // se recule pas en re-cliquant sur "activer").
      enabled = requested;
    }
    this.purgeEnabledAt.set(tenantId, enabledAt);

    const updated: CommercialSettingsDto = {
      ...current,
      ...('default_validity_days' in command
        ? { default_validity_days: command.default_validity_days ?? null }
        : {}),
      order_file_purge_enabled: enabled,
      ...('notification_retention_days' in command
        ? { notification_retention_days: command.notification_retention_days }
        : {}),
      ...('notification_sms_enabled' in command
        ? { notification_sms_enabled: command.notification_sms_enabled }
        : {}),
      ...('notification_sms_daily_cap' in command
        ? { notification_sms_daily_cap: command.notification_sms_daily_cap }
        : {}),
      order_file_purge_effective_from: effectivePurgeFrom(enabledAt),
      updated_at: new Date().toISOString(),
    };
    this.settings.set(tenantId, updated);
    return updated;
  }
}

function effectivePurgeFrom(enabledAt: string | null): string | null {
  if (!enabledAt) return null;
  const floorMs = new Date(enabledAt).getTime() + ORDER_FILE_PURGE_ACTIVATION_FLOOR_DAYS * 24 * 60 * 60 * 1000;
  return new Date(floorMs).toISOString();
}
