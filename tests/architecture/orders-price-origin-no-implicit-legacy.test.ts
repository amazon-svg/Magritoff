/**
 * Q17-a (docs/api/CONVENTIONS.md §8.25 point 12 (c)) — « Échec fermé : en
 * l absence de preuve, la fonction écrit `client_unverified`. Un test exige
 * qu aucun chemin de code n écrive `legacy`. » et point 12 (g) : `legacy`
 * n est écrit QUE par la migration de reprise (le backfill des lignes
 * antérieures), jamais par une RPC applicative.
 *
 * Tue la mutation M11 (« faire écrire legacy par un chemin de code ») du
 * tableau du point 12 (j) : une assertion STATIQUE sur le corps SQL des
 * fonctions qui écrivent des lignes de commande boutique, pas un test de
 * comportement qui pourrait rater un chemin non exercé.
 *
 * DURCISSEMENT D4 (qa-review round 1, corrigé) — round 1 ne lisait qu UN
 * SEUL fichier de migration en dur (`20260919000100_...`). Un `'legacy'`
 * écrit par une future migration (une RPC ajoutée par une story ultérieure)
 * passait sans que ce test ne le voie. Ce test balaie maintenant TOUT
 * `supabase/migrations/*.sql`, avec une liste d EXCEPTIONS NOMMÉE : chaque
 * occurrence tolérée doit être déclarée explicitement (fichier + motif), une
 * occurrence non déclarée fait échouer le test.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = 'supabase/migrations';
const Q17A_MIGRATION = '20260919000100_gescom_q17a_storefront_order_price_revaluation.sql';

/**
 * Liste FERMÉE des occurrences de `'legacy'` (hors commentaires) tolérées
 * dans le corpus des migrations. Toute nouvelle occurrence doit être ajoutée
 * ICI, nommément motivée — jamais silencieusement laissée passer par un
 * assouplissement du test.
 */
const NAMED_EXCEPTIONS: ReadonlyArray<{ file: string; snippet: string; reason: string }> = [
  {
    file: Q17A_MIGRATION,
    snippet: "set price_origin = 'legacy'",
    reason: 'Backfill de reprise (point 12 (g)) : les lignes ANTÉRIEURES à Q17-a reçoivent legacy UNE FOIS, à l application de cette migration. Ce n est pas un chemin de code applicatif exécuté à chaque requête.',
  },
  {
    file: Q17A_MIGRATION,
    snippet: "check (price_origin in ('catalog', 'quoted', 'client_unverified', 'legacy'))",
    reason: 'Contrainte CHECK fermée : legacy doit être une valeur AUTORISÉE par la colonne pour que le backfill ci-dessus soit valide. Une contrainte ne "produit" pas la valeur, elle la borne.',
  },
];

function readSource(file: string): string {
  return readFileSync(resolve(process.cwd(), MIGRATIONS_DIR, file), 'utf8');
}

function stripSqlComments(source: string): string {
  // Commentaires de ligne `--...` uniquement : aucune migration de ce
  // dépôt n utilise `/* ... */` sur plusieurs lignes autour de `legacy`
  // (vérifié) ; un bloc `$$ ... $$` PL/pgSQL n est pas un commentaire et
  // doit rester lisible pour ce grep.
  return source
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

describe('Q17-a — aucun chemin de code applicatif écrit price_origin = legacy (mutation M11, durcissement D4)', () => {
  const migrationFiles = readdirSync(resolve(process.cwd(), MIGRATIONS_DIR))
    .filter((name) => name.endsWith('.sql'));

  it('le corpus de migrations contient au moins un fichier (garde-fou du test lui-même)', () => {
    expect(migrationFiles.length).toBeGreaterThan(50);
  });

  it.each(migrationFiles)('%s ne contient, hors commentaires, aucun "legacy" non déclaré', (file) => {
    const codeOnly = stripSqlComments(readSource(file));
    const allowedForThisFile = NAMED_EXCEPTIONS.filter((exception) => exception.file === file);

    let remaining = codeOnly;
    for (const exception of allowedForThisFile) {
      // Chaque occurrence déclarée est retirée UNE FOIS avant de vérifier
      // qu il n en reste plus : une exception nommée ne blanchit pas TOUTES
      // les occurrences futures de ce même texte dans le même fichier.
      const index = remaining.indexOf(exception.snippet);
      if (index === -1) {
        throw new Error(
          `Exception nommée introuvable dans ${file} : "${exception.snippet}" (${exception.reason}). ` +
          'Le texte a-t-il changé ? Mettre à jour NAMED_EXCEPTIONS.',
        );
      }
      remaining = remaining.slice(0, index) + remaining.slice(index + exception.snippet.length);
    }

    const stray = remaining.match(/'legacy'/g);
    expect(
      stray,
      `${file} contient "'legacy'" en dehors des exceptions nommées (${allowedForThisFile.length} déclarée(s) pour ce fichier)`,
    ).toBeNull();
  });

  it('chaque exception déclarée référence un fichier de migration existant', () => {
    for (const exception of NAMED_EXCEPTIONS) {
      expect(migrationFiles, `${exception.file} n existe pas dans ${MIGRATIONS_DIR}`).toContain(exception.file);
    }
  });

  it.each([
    'public.api_create_storefront_order',
    'public.api_update_order_draft_for_identity',
    'public.api_update_tenant_order_draft',
    'public.api_create_tenant_order',
    'private.classify_storefront_order_line',
    'private.resolve_storefront_catalog_price',
  ])('%s (Q17-a) ne peut pas produire "legacy"', (functionName) => {
    const body = extractFunctionBody(readSource(Q17A_MIGRATION), functionName);
    expect(body, `${functionName} contient le littéral 'legacy'`).not.toContain("'legacy'");
  });
});

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
