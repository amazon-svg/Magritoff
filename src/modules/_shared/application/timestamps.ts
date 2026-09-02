/**
 * Normalisation des timestamps Postgres/PostgREST au format que le socle
 * promet (`timestampSchema` — ISO 8601 UTC suffixe `Z`, cf. E10.0 Dev Notes
 * et `docs/api/CONVENTIONS.md` §1).
 *
 * PostgREST serialise une colonne `timestamptz` avec un decalage explicite
 * (`2026-09-02T06:54:39.688293+00:00`), jamais avec le suffixe `Z` — quel que
 * soit le fuseau stocke, meme UTC. `timestampSchema` (regex stricte) rejette
 * cette forme : toute route qui restitue une valeur de date lue telle quelle
 * depuis une ligne Postgres echoue en 500 a la validation de reponse
 * (`gescom-middleware.ts`, "la reponse viole le contrat de sa ressource"),
 * jamais en test — les fakes des suites de contrat construisent leurs dates
 * via `new Date().toISOString()`, qui produit deja `Z`. Le defaut n etait
 * donc visible qu en conditions reelles (PostgREST), pas en CI.
 */

/** Normalise un timestamp requis. `new Date(...).toISOString()` produit toujours le suffixe `Z`. */
export function toIsoTimestamp(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/** Variante nullable, pour les colonnes optionnelles (ex. `siret_verified_at`). */
export function toIsoTimestampOrNull(value: string | Date | null | undefined): string | null {
  return value === null || value === undefined ? null : toIsoTimestamp(value);
}
