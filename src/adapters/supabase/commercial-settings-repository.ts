/**
 * Implementation Supabase du referentiel Reglages commerciaux (E10.10a,
 * ETENDU par E10.22d).
 *
 * `get()` delegue a `api_get_commercial_settings` (`security definer`,
 * migration 20260906160000) : ressource SINGLETON creee IMPLICITEMENT a sa
 * premiere lecture (contrat, `CommercialSettings`). La fonction verifie
 * elle-meme l appartenance de l acteur au tenant (elle bypasserait sinon la
 * RLS qu elle doit respecter en tant que `security definer`). Elle rend
 * `to_jsonb(v_row)` sur le ROWTYPE de la table : les colonnes ajoutees par
 * E10.22d (`order_file_purge_enabled`/`_at`) y apparaissent SANS que cette
 * fonction ait besoin d etre modifiee (Postgres suit le rowtype de la table).
 *
 * `update()` est un simple upsert PostgREST : la RLS `commercial_settings_write`
 * (garde `can_manage_pricing`, E10.11) est la SEULE barriere ecriture — le
 * service a deja verifie la capability avant d appeler ce port, cette policy
 * est la defense en profondeur reelle (appel PostgREST direct). L effet de
 * bord du plancher d activation (`order_file_purge_enabled_at`) est
 * ENTIEREMENT porte par le trigger `commercial_settings_track_purge_activation`
 * (migration 20260911000000) : cet adaptateur n ecrit JAMAIS cette colonne
 * lui-meme, il ne fait que RELIRE ce que la base a decide.
 *
 * `CommercialSettings.order_file_purge_effective_from` est un CHAMP CALCULE
 * (§8.22bis §5 du contrat : "= enabled_at + 30 jours, null a l arret"),
 * derive ICI depuis `order_file_purge_enabled_at` plutot qu ajoute a
 * `api_get_commercial_settings` — la base UTC de la session Supabase rend
 * l addition JS de 30 jours (millisecondes, aucune ambiguite de fuseau sur un
 * instant timestamptz) equivalente au calcul SQL correspondant. Il n a
 * AUCUN role dans la garde de purge reelle (entierement portee par
 * `order_file_effective_purge_at` cote SQL, jamais reimplementee ici) :
 * c est un affichage, pas une decision.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import type {
  CommercialSettingsDto,
  UpdateCommercialSettingsCommand,
} from '../../modules/commercial-settings/api/contracts.ts';
import type { CommercialSettingsRepository } from '../../modules/commercial-settings/application/commercial-settings-repository.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';

/** Contrat §8.22bis §4 : meme plancher que `order_file_effective_purge_at` cote SQL (litteral duplique, meme discipline documentee que E10.22c M3). */
const ORDER_FILE_PURGE_ACTIVATION_FLOOR_DAYS = 30;

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
    if ('order_file_purge_enabled' in command) {
      // `order_file_purge_enabled_at` n est JAMAIS pose ici : le trigger
      // `commercial_settings_track_purge_activation` (20260911000000) s en
      // charge, avec la regle "ne recule jamais sur un re-clic" que ce port
      // ne reimplemente pas.
      patch['order_file_purge_enabled'] = command.order_file_purge_enabled;
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
  const rawEnabledAt = row['order_file_purge_enabled_at'] as string | null | undefined;
  return {
    tenant_id: row['tenant_id'] as string,
    default_validity_days:
      rawDays === null || rawDays === undefined ? null : Number(rawDays),
    order_file_purge_enabled: Boolean(row['order_file_purge_enabled']),
    order_file_purge_effective_from: toEffectivePurgeFrom(rawEnabledAt),
    updated_at: toIsoTimestamp(row['updated_at'] as string),
  };
}

/**
 * `null` = espace a l arret (jamais active, ou desactive). Sinon, l instant
 * de la DERNIERE activation + 30 jours pleins — voir le commentaire d en-tete
 * de ce fichier sur l equivalence avec le calcul SQL correspondant.
 */
function toEffectivePurgeFrom(enabledAt: string | null | undefined): string | null {
  if (!enabledAt) return null;
  const enabledAtMs = new Date(enabledAt).getTime();
  const floorMs = enabledAtMs + ORDER_FILE_PURGE_ACTIVATION_FLOOR_DAYS * 24 * 60 * 60 * 1000;
  return toIsoTimestamp(new Date(floorMs));
}
