/**
 * `SupabaseCommercialSettingsRepository` (E10.10a, ETENDU par E10.22d).
 *
 * Seule logique de CALCUL introduite par E10.22d cote adaptateur :
 * `order_file_purge_effective_from` = `order_file_purge_enabled_at` + 30
 * jours pleins (§8.22bis §5 du contrat), `null` a l arret. Ce calcul n a
 * AUCUN role dans la garde de purge reelle (entierement portee par
 * `order_file_effective_purge_at` cote SQL, voir `tests/sql/gescom-e10-22d-
 * purge-activation.sql`) : c est un affichage, jamais une decision — mais
 * c est un calcul de date, donc teste unitairement ici (regle du dossier).
 */
import { describe, expect, it } from 'vitest';
import { SupabaseCommercialSettingsRepository } from '@/adapters/supabase/commercial-settings-repository';

const TENANT = 'tenant-1';

function fakeClient(row: Record<string, unknown>) {
  return {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      if (fn === 'api_get_commercial_settings') {
        expect(params['p_tenant_id']).toBe(TENANT);
        return { data: row, error: null };
      }
      throw new Error(`RPC inattendue dans ce faux: ${fn}`);
    },
  };
}

describe('SupabaseCommercialSettingsRepository — order_file_purge_effective_from (E10.22d)', () => {
  it('espace jamais active (order_file_purge_enabled_at null) — enabled=false, effective_from=null', async () => {
    const repository = new SupabaseCommercialSettingsRepository(
      fakeClient({
        tenant_id: TENANT,
        default_validity_days: null,
        order_file_purge_enabled: false,
        order_file_purge_enabled_at: null,
        updated_at: '2026-09-11T00:00:00.000000+00:00',
      }) as any,
    );

    const dto = await repository.get(TENANT as any);

    expect(dto.order_file_purge_enabled).toBe(false);
    expect(dto.order_file_purge_effective_from).toBeNull();
  });

  it('espace ARME — effective_from = order_file_purge_enabled_at + 30 jours PLEINS, exactement', async () => {
    const enabledAt = '2026-09-11T08:00:00.000000+00:00';
    const repository = new SupabaseCommercialSettingsRepository(
      fakeClient({
        tenant_id: TENANT,
        default_validity_days: null,
        order_file_purge_enabled: true,
        order_file_purge_enabled_at: enabledAt,
        updated_at: enabledAt,
      }) as any,
    );

    const dto = await repository.get(TENANT as any);

    expect(dto.order_file_purge_enabled).toBe(true);
    // 2026-09-11T08:00:00Z + 30 jours = 2026-10-11T08:00:00Z, exactement --
    // aucune derive de fuseau/heure d ete sur un ecart de jours ENTIERS entre
    // deux instants absolus (timestamptz).
    expect(dto.order_file_purge_effective_from).toBe('2026-10-11T08:00:00.000Z');
  });

  it('format ISO 8601 suffixe Z (timestampSchema), jamais le decalage brut de PostgREST', async () => {
    const repository = new SupabaseCommercialSettingsRepository(
      fakeClient({
        tenant_id: TENANT,
        default_validity_days: null,
        order_file_purge_enabled: true,
        order_file_purge_enabled_at: '2026-01-01T00:00:00.123456+00:00',
        updated_at: '2026-01-01T00:00:00.123456+00:00',
      }) as any,
    );

    const dto = await repository.get(TENANT as any);

    expect(dto.order_file_purge_effective_from).toMatch(/Z$/);
    expect(dto.order_file_purge_effective_from).not.toContain('+00:00');
  });
});
