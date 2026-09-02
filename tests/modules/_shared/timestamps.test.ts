/**
 * `toIsoTimestamp`/`toIsoTimestampOrNull` — regression sur un bug de
 * production reel, pas hypothetique.
 *
 * PostgREST serialise une colonne `timestamptz` avec un decalage explicite
 * (`+00:00`), jamais avec le suffixe `Z` que `timestampSchema` exige. Chaque
 * adaptateur qui restituait `row.created_at` tel quel (customers, projects,
 * project-tags, commercial-quotes) faisait donc echouer la validation de
 * reponse en 500 `api.internal_error` sur TOUT create/get/list reel, y
 * compris avec des donnees parfaitement valides — invisible en test parce
 * que les fakes construisent leurs dates via `new Date().toISOString()`, qui
 * produit deja `Z`. Reproduit en production le 2026-09-02 (signalement
 * Arnaud : "erreur interne" a la creation d un client, quel que soit le type).
 */
import { describe, expect, it } from 'vitest';
import { toIsoTimestamp, toIsoTimestampOrNull } from '@/modules/_shared/application/timestamps';
import { timestampSchema } from '@/modules/_shared/api/contracts';

const TIMESTAMP_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

describe('toIsoTimestamp — normalise le format PostgREST reel', () => {
  it('convertit un timestamp avec decalage explicite (+00:00) en suffixe Z', () => {
    const postgrest = '2026-09-02T06:54:39.688293+00:00';
    const result = toIsoTimestamp(postgrest);
    expect(result).toMatch(TIMESTAMP_Z);
    expect(timestampSchema.safeParse(result).success).toBe(true);
    // La regression exacte : le format brut PostgREST viole le contrat.
    expect(timestampSchema.safeParse(postgrest).success).toBe(false);
  });

  it('conserve un timestamp deja au format Z (cas des fakes de test)', () => {
    const iso = new Date('2026-09-02T06:54:39.688Z').toISOString();
    expect(toIsoTimestamp(iso)).toBe(iso);
  });

  it('accepte un decalage non nul et le convertit correctement en UTC', () => {
    const result = toIsoTimestamp('2026-09-02T08:54:39+02:00');
    expect(result).toBe('2026-09-02T06:54:39.000Z');
  });

  it('accepte une instance Date directement', () => {
    const date = new Date('2026-09-02T06:54:39.688Z');
    expect(toIsoTimestamp(date)).toBe(date.toISOString());
  });
});

describe('toIsoTimestampOrNull — variante nullable (siret_verified_at, etc.)', () => {
  it('rend null sur null ou undefined, sans lever', () => {
    expect(toIsoTimestampOrNull(null)).toBeNull();
    expect(toIsoTimestampOrNull(undefined)).toBeNull();
  });

  it('normalise une valeur presente comme toIsoTimestamp', () => {
    expect(toIsoTimestampOrNull('2026-09-02T06:54:39.688293+00:00')).toMatch(TIMESTAMP_Z);
  });
});
