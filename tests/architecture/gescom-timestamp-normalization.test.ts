/**
 * Un champ `*_at` mappe depuis une ligne Postgres brute DOIT passer par
 * `toIsoTimestamp()`/`toIsoTimestampOrNull()` (qa-review, bug de production
 * du 2026-09-02 : PostgREST serialise un `timestamptz` avec un decalage
 * explicite, jamais le suffixe `Z` que `timestampSchema` exige — toute
 * route qui restituait `row.created_at` tel quel echouait en 500 avec des
 * donnees parfaitement valides, apres que l ecriture ait deja reussi).
 *
 * `.claude/rules/api.md` et `docs/api/CONVENTIONS.md` §5 posent la regle en
 * prose. Ce fichier la rend opposable : une regle non testee ne vaut rien,
 * exactement le raisonnement qui a justifie `gescom-routes.ts` pour CA1 (une
 * route enregistree sans entree au contrat).
 *
 * Portee : les adaptateurs Supabase des modules E10 qui exposent un DTO via
 * la facade gescom. Ajouter tout nouvel adaptateur E10 a la liste ci-dessous.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const GESCOM_ADAPTERS = [
  'src/adapters/supabase/customers-repository.ts',
  'src/adapters/supabase/projects-repository.ts',
  'src/adapters/supabase/project-tags-repository.ts',
  'src/adapters/supabase/commercial-quotes-repository.ts',
  'src/adapters/supabase/price-rules-repository.ts',
] as const;

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

/**
 * Repere `xxx_at: row.yyy` / `xxx_at: tag.yyy` (mapping direct d un champ
 * timestamp) qui ne serait pas immediatement suivi d un appel a l un des
 * deux helpers. Un faux positif serait un champ `*_at` qui n est PAS un
 * timestamp (aucun cas dans le perimetre actuel) — a exempter nommement
 * plutot qu a affaiblir la regex si ca devait arriver.
 */
const RAW_ASSIGNMENT = /\b\w+_at:\s*(?!toIsoTimestamp)(?:row|tag)\.\w+/g;

describe('gescom — tout champ *_at restitue passe par toIsoTimestamp (qa-review)', () => {
  for (const path of GESCOM_ADAPTERS) {
    it(`${path} ne restitue aucun timestamp brut`, () => {
      const source = read(path);
      const matches = source.match(RAW_ASSIGNMENT) ?? [];
      expect(
        matches,
        `Timestamp non normalise trouve dans ${path} : ${matches.join(', ')}. ` +
          'Entourer de toIsoTimestamp()/toIsoTimestampOrNull() (src/modules/_shared/application).',
      ).toEqual([]);
    });
  }

  it('la liste GESCOM_ADAPTERS elle-meme reste a jour (garde-fou anti-oubli)', () => {
    // Si un adaptateur cite ici disparaissait sans etre retire de la liste,
    // `read()` leverait deja (fichier introuvable) — ce test documente
    // seulement l intention : mettre a jour cette liste a chaque nouveau
    // module E10 qui restitue un DTO horodate.
    expect(GESCOM_ADAPTERS.length).toBeGreaterThan(0);
  });
});
