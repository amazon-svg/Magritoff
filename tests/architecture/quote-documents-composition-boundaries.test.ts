/**
 * qa-review B1 (BLOQUANT, E10.10b-4c, round 2) — regression statique.
 *
 * `SupabaseQuoteDocumentsRepository` EXIGE un client `service_role` : sa
 * migration (`20260909040000_gescom_e10_10b_4c_quote_documents.sql`) revoque
 * `insert` sur `quote_documents` pour `authenticated`. Passer le client
 * `authenticated` (`client`, construit avec la cle publique + le JWT de
 * l appelant) rendait `sendQuote` non fonctionnel a 100 % des qu un gabarit
 * etait eligible — prouve par execution reelle (qa-review, round 2, B1).
 *
 * `supabase/functions/magrit-api/index.ts` est un fichier Deno, HORS
 * `tsconfig.modular.json` (docs/api/CONVENTIONS.md, "Câblage des adaptateurs
 * dans l'edge function — non vérifiable — exécution Deno requise") : aucun
 * test TypeScript ne peut donc typer son contenu. Ce test lit le fichier
 * comme du TEXTE et verifie STATIQUEMENT que le premier argument passe a
 * `new SupabaseQuoteDocumentsRepository(...)` n est PAS la variable `client`
 * (le client authenticated), pour que cette regression precise ne puisse
 * plus repasser inapercue.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const EDGE_FUNCTION_PATH = resolve(process.cwd(), 'supabase/functions/magrit-api/index.ts');

function readEdgeFunctionSource(): string {
  return readFileSync(EDGE_FUNCTION_PATH, 'utf8');
}

describe('composition magrit-api — SupabaseQuoteDocumentsRepository (qa-review B1)', () => {
  it('passe un client construit avec service_role (documentTemplatesStorageClient), jamais le client authenticated nu', () => {
    const source = readEdgeFunctionSource();

    const match = /new SupabaseQuoteDocumentsRepository\(([^)]*)\)/.exec(source);
    expect(match, 'appel a `new SupabaseQuoteDocumentsRepository(...)` introuvable dans magrit-api/index.ts').not.toBeNull();

    const args = (match![1] ?? '').split(',').map((arg) => arg.trim());

    // Le premier argument (table + bucket `quote_documents`, ECRITURE
    // comprise) DOIT etre un client service_role. `documentTemplatesStorageClient`
    // est le client service_role DEJA instancie et verifie pour
    // `document-templates` (meme bucket-pattern, meme cle) — c est celui que
    // la composition reelle reutilise (voir le commentaire de cablage,
    // "REUTILISE tel quel").
    expect(args[0]).toBe('documentTemplatesStorageClient');

    // Defense supplementaire : le client `authenticated` NU (`client`,
    // exactement ce nom, pas un nom qui le contient) ne doit apparaitre dans
    // AUCUN argument de cet appel — c est exactement la regression B1.
    expect(args).not.toContain('client');
  });

  it('cette regression est detectable meme si un futur refactor renomme les variables : le client passe ne doit jamais etre celui construit avec `anonKey` seul (JWT de l appelant)', () => {
    const source = readEdgeFunctionSource();

    // Le client `authenticated` de la facade est construit UNE FOIS, tout en
    // haut du fichier, avec `anonKey` ET l en-tete `Authorization` de
    // l appelant — c est cette construction, et elle seule, qui designe le
    // role `authenticated`. Le client passe a `SupabaseQuoteDocumentsRepository`
    // doit provenir d une construction qui porte `serviceRoleKey`.
    const constClientMatch = /const client = createClient\(supabaseUrl, anonKey, \{[\s\S]*?Authorization/.exec(source);
    expect(constClientMatch, 'construction attendue du client authenticated introuvable — le test doit etre revu si la facade change de forme').not.toBeNull();

    const repositoryCallMatch = /new SupabaseQuoteDocumentsRepository\(([^)]*)\)/.exec(source);
    const firstArgName = (repositoryCallMatch![1] ?? '').split(',')[0]?.trim();

    const firstArgConstructionPattern = new RegExp(`const ${firstArgName} = createClient\\(supabaseUrl, serviceRoleKey`);
    expect(
      firstArgConstructionPattern.test(source),
      `${firstArgName} doit etre construit avec serviceRoleKey (service_role), pas anonKey`,
    ).toBe(true);
  });
});
