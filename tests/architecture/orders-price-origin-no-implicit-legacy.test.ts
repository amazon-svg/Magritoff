/**
 * Q17-a (docs/api/CONVENTIONS.md §8.25 point 12 (c)) — « Échec fermé : en
 * l absence de preuve, la fonction écrit `client_unverified`. Un test exige
 * qu aucun chemin de code n écrive `legacy`. » et point 12 (g) : `legacy`
 * n est écrit QUE par la migration de reprise (le backfill des lignes
 * antérieures), jamais par une RPC applicative.
 *
 * Tue la mutation M11 (« faire écrire legacy par un chemin de code ») du
 * tableau du point 12 (j) : une assertion STATIQUE sur le corps SQL des deux
 * fonctions qui écrivent des lignes de commande boutique, pas un test de
 * comportement qui pourrait rater un chemin non exercé.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH =
  'supabase/migrations/20260919000100_gescom_q17a_storefront_order_price_revaluation.sql';

function readMigration(): string {
  return readFileSync(resolve(process.cwd(), MIGRATION_PATH), 'utf8');
}

/**
 * Extrait le corps d une fonction PL/pgSQL entre son `as $$` et son premier
 * `$$;` qui suit — suffisant ici : aucune de ces fonctions ne contient de
 * corps `$$` imbriqué.
 */
function extractFunctionBody(source: string, functionName: string): string {
  const start = source.indexOf(`function ${functionName}(`);
  if (start === -1) throw new Error(`Fonction ${functionName} introuvable dans la migration Q17-a.`);
  const bodyStart = source.indexOf('as $$', start);
  const bodyEnd = source.indexOf('$$;', bodyStart);
  if (bodyStart === -1 || bodyEnd === -1) {
    throw new Error(`Corps de ${functionName} introuvable (bornes as $$ / $$; non trouvées).`);
  }
  return source.slice(bodyStart, bodyEnd);
}

describe('Q17-a — aucun chemin de code applicatif écrit price_origin = legacy (mutation M11)', () => {
  const migration = readMigration();

  it.each([
    'public.api_create_storefront_order',
    'public.api_update_order_draft_for_identity',
    'private.classify_storefront_order_line',
    'private.resolve_storefront_catalog_price',
  ])('%s ne peut pas produire "legacy"', (functionName) => {
    const body = extractFunctionBody(migration, functionName);
    expect(body, `${functionName} contient le littéral 'legacy'`).not.toContain("'legacy'");
  });

  it('"legacy" n apparaît, hors commentaires, que dans le backfill et la contrainte fermée', () => {
    // Les commentaires `--` peuvent nommer `legacy` librement (documentation) :
    // seul le CODE compte pour cette garde. Une ligne de code qui écrirait
    // `'legacy'` ailleurs (un troisième site, une RPC de plus) doit faire
    // échouer ce compteur.
    const codeOnly = migration
      .split('\n')
      .map((line) => line.replace(/--.*$/, ''))
      .join('\n');
    const occurrences = codeOnly.split("'legacy'").length - 1;
    expect(occurrences).toBe(2);
    expect(migration).toContain("set price_origin = 'legacy'");
    expect(migration).toContain("check (price_origin in ('catalog', 'quoted', 'client_unverified', 'legacy'))");
  });
});
