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
 *
 * Un premier correctif (rejete en qa-review) passait systematiquement par
 * `new Date(...).toISOString()`, qui tronque a la milliseconde : la
 * precision microseconde de Postgres, reutilisee comme curseur de
 * pagination, se perdait et pouvait faire disparaitre une ligne d une liste
 * paginee. Les tests ci-dessous couvrent ce cas et le second defaut trouve
 * (une valeur absente convertie en silence en epoque 1970 plutot que de
 * lever).
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

  it('preserve la precision microseconde (qa-review — sans quoi le curseur de pagination perd des lignes)', () => {
    const result = toIsoTimestamp('2026-09-02T06:54:39.688293+00:00');
    expect(result).toBe('2026-09-02T06:54:39.688293Z');
    // La valeur EXACTE compte : Postgres compare la valeur numerique du
    // timestamp, pas la chaine — une precision tronquee filtrerait une
    // ligne dont la fraction reelle depasse la milliseconde retenue.
    expect(result).not.toBe('2026-09-02T06:54:39.688Z');
  });

  it('deux lignes de meme instant a la microseconde pres restent distinguables par comparaison stricte', () => {
    // Cas concret : deux clients crees dans la MEME transaction
    // (`created_at default now()`) partagent exactement le meme instant au
    // niveau Postgres, mais un import ou une correction manuelle pourrait
    // les decaler d une fraction de microseconde — le curseur doit refleter
    // la valeur exacte pour que le departage par `id` reste possible sans
    // perdre la ligne dont la fraction n est pas un multiple de 1000.
    const a = toIsoTimestamp('2026-09-02T06:54:39.688293+00:00');
    const b = toIsoTimestamp('2026-09-02T06:54:39.688999+00:00');
    expect(a).not.toBe(b);
    expect(a < b).toBe(true);
  });

  it('leve explicitement sur une valeur manquante plutot que de rendre l epoque 1970', () => {
    // toIsoTimestamp(null) via new Date(null).toISOString() rendait
    // silencieusement "1970-01-01T00:00:00.000Z" — une falsification de
    // date acceptee par timestampSchema, donc invisible au garde-fou du
    // middleware. Toute colonne timestamptz nullable DOIT passer par
    // toIsoTimestampOrNull(), jamais par cette fonction.
    // @ts-expect-error — valeur volontairement invalide pour le test
    expect(() => toIsoTimestamp(null)).toThrow(TypeError);
    // @ts-expect-error — valeur volontairement invalide pour le test
    expect(() => toIsoTimestamp(undefined)).toThrow(TypeError);
    expect(() => toIsoTimestamp('')).toThrow(TypeError);
    expect(() => toIsoTimestamp('pas une date')).toThrow(TypeError);
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

  it('leve toujours sur une valeur presente mais invalide (pas de silence sur une vraie erreur)', () => {
    expect(() => toIsoTimestampOrNull('pas une date')).toThrow(TypeError);
  });
});
