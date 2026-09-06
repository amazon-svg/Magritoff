/**
 * Implementation Supabase du referentiel Reglages commerciaux (E10.10a).
 *
 * `get()` delegue a `api_get_commercial_settings` (`security definer`,
 * migration 20260906000100) : ressource SINGLETON creee IMPLICITEMENT a sa
 * premiere lecture (contrat, `CommercialSettings`). La fonction verifie
 * elle-meme l appartenance de l acteur au tenant (elle bypasserait sinon la
 * RLS qu elle doit respecter en tant que `security definer`).
 *
 * `update()` est un simple upsert PostgREST : la RLS `commercial_settings_write`
 * (garde `can_manage_pricing`, E10.11) est la SEULE barriere ecriture — le
 * service a deja verifie la capability avant d appeler ce port, cette policy
 * est la defense en profondeur reelle (appel PostgREST direct).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import type {
  CommercialSettingsDto,
  UpdateCommercialSettingsCommand,
} from '../../modules/commercial-settings/api/contracts.ts';
import type { CommercialSettingsRepository } from '../../modules/commercial-settings/application/commercial-settings-repository.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';

export class SupabaseCommercialSettingsRepository implements CommercialSettingsRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async get(tenantId: TenantId): Promise<CommercialSettingsDto> {
    const { data, error } = await this.client.rpc('api_get_commercial_settings', {
      p_tenant_id: tenantId,
    });
    if (error) throw new Error(`Lecture des reglages commerciaux impossible: ${error.message}`);
    return toDto(toRecord(data));
  }

  async update(
    tenantId: TenantId,
    command: UpdateCommercialSettingsCommand,
  ): Promise<CommercialSettingsDto> {
    const patch: Record<string, unknown> = { tenant_id: tenantId };
    if ('default_validity_days' in command) {
      patch['default_validity_days'] = command.default_validity_days;
    }
    const { data, error } = await this.client
      .from('commercial_settings')
      .upsert(patch, { onConflict: 'tenant_id' })
      .select()
      .maybeSingle();
    if (error) throw new Error(`Modification des reglages commerciaux impossible: ${error.message}`);
    if (!data) throw new Error('Les reglages commerciaux modifies sont introuvables juste apres l ecriture.');
    return toDto(data);
  }

  /** Meme fonction SQL que `SupabaseCommercialQuotesRepository.actorHasCapability` (E10.11), autonome ici. */
  async actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('user_has_capability', {
      p_tenant_id: tenantId,
      p_capability: capability,
    });
    if (error) throw new Error(error.message);
    return Boolean(data);
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toDto(row: Record<string, unknown>): CommercialSettingsDto {
  const rawDays = row['default_validity_days'];
  return {
    tenant_id: row['tenant_id'] as string,
    default_validity_days:
      rawDays === null || rawDays === undefined ? null : Number(rawDays),
    updated_at: toIsoTimestamp(row['updated_at'] as string),
  };
}
