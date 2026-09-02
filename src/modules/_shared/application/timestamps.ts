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
 *
 * ----------------------------------------------------------------------
 * PRECISION SOUS-MILLISECONDE (qa-review, 1er correctif rejete)
 * ----------------------------------------------------------------------
 * `new Date(...).toISOString()` seul TRONQUE a la milliseconde. Postgres
 * stocke et PostgREST restitue jusqu a la microseconde
 * (`.688293`) : cette fraction alimente le curseur de pagination
 * (`sort: row.created_at`, cf. `*-routes.ts`), compare ensuite en base a la
 * colonne reelle. La tronquer fait echouer le departage par egalite exacte
 * de deux lignes crees dans la MEME transaction (`created_at default now()`,
 * `updated_at` pose par trigger) : une ligne peut alors disparaitre d une
 * liste paginee sans qu aucune erreur ne soit levee. La fraction d une
 * seconde est INVARIANTE a une conversion de decalage horaire (seules les
 * heures/minutes/secondes entieres bougent) : on la reattache donc telle
 * quelle a la partie temporelle recalculee par `Date` (qui gere
 * correctement, elle, le passage a `Z` d un decalage non nul).
 */

/** Normalise un timestamp requis. Leve explicitement plutot que de produire une date fausse. */
export function toIsoTimestamp(value: string | Date): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError('toIsoTimestamp: Date invalide (NaN).');
    }
    return value.toISOString();
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(
      `toIsoTimestamp: valeur manquante ou invalide (${JSON.stringify(value)}). ` +
        'Utiliser toIsoTimestampOrNull() si le champ est nullable.',
    );
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(`toIsoTimestamp: date invalide (${JSON.stringify(value)}).`);
  }
  const base = parsed.toISOString(); // Heure/date correctement recalculees en UTC, fraction en ms seulement.

  // Fraction d origine (> 3 chiffres = precision au-dela de la milliseconde
  // que `Date` aurait tronquee). Invariante au decalage horaire : on peut la
  // reattacher a la partie temporelle de `base` sans risque de decalage.
  const fractionMatch = value.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})?$/);
  const fraction = fractionMatch?.[1];
  if (!fraction || fraction.length <= 3) return base;

  const wholeSecondPart = base.slice(0, base.indexOf('.'));
  return `${wholeSecondPart}.${fraction}Z`;
}

/** Variante nullable, pour les colonnes optionnelles (ex. `siret_verified_at`). */
export function toIsoTimestampOrNull(value: string | Date | null | undefined): string | null {
  return value === null || value === undefined ? null : toIsoTimestamp(value);
}
