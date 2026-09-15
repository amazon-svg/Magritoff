/**
 * Correctif de securite (decision Arnaud, 2026-09-15) sur l edge function
 * legacy `make-server-e3db71a4`, appelable par quiconque detient la seule
 * cle anonyme publique du projet Supabase (`verify_jwt = true` accepte un
 * JWT anon, sans verifier une autorisation d utilisateur). Avant correctif,
 * `clariprint-quote` et `clariprint-test` renvoyaient au client des donnees
 * brutes Clariprint : gammes de fabrication (`all_process`), gammes en
 * erreur (`all_faulty_process`), reponse HTTP entiere ou partiellement
 * tronquee (`rawResponse`), reponse CheckAuth parsee (`parsedResponse`).
 *
 * Ce test AST garde la regression : il echoue si `index.ts` fait a nouveau
 * reference a l un de ces quatre identifiants, que ce soit comme cle d objet
 * litteral (`rawResponse: ...`), comme acces de propriete
 * (`result.all_faulty_process`) ou comme cible d affectation
 * (`result.parsedResponse = ...`). Les commentaires ne sont pas visibles par
 * l AST (triviaux pour le compilateur TypeScript) : ce test ne se declenche
 * donc pas sur la documentation du correctif lui-meme.
 *
 * Preuve d echec sur l ancien code (avant ce correctif, commit
 * chore/chat-sonnet-5 = base de production v27) : voir le rapport de fin de
 * tache -- ce test, pointe temporairement sur le blob git de cette base,
 * remonte 8 violations aux lignes 1161, 1170-1171, 1199, 1233, 1235, 1295-1296.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const BANNED_IDENTIFIERS = ['all_process', 'all_faulty_process', 'rawResponse', 'parsedResponse'];

export interface Violation {
  identifier: string;
  line: number;
}

/**
 * Recense, dans un fichier source TypeScript/Deno, toute reference (cle d
 * objet litteral, acces de propriete, cible d affectation) a l un des
 * identifiants bannis. Fonction exportee pour reutilisation par le script de
 * preuve d echec sur l ancien code.
 */
export function findBannedIdentifierUsages(fileName: string, sourceText: string): Violation[] {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations: Violation[] = [];

  function report(nameNode: ts.Node, text: string): void {
    if (!BANNED_IDENTIFIERS.includes(text)) return;
    const { line } = source.getLineAndCharacterOfPosition(nameNode.getStart(source));
    violations.push({ identifier: text, line: line + 1 });
  }

  function visit(node: ts.Node): void {
    if (ts.isPropertyAccessExpression(node)) {
      report(node.name, node.name.text);
    } else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
      report(node.argumentExpression, node.argumentExpression.text);
    } else if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
      report(node.name, node.name.text);
    } else if (ts.isShorthandPropertyAssignment(node)) {
      report(node.name, node.name.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return violations;
}

describe('clariprint-quote / clariprint-test ne renvoient plus de donnee brute Clariprint', () => {
  it("index.ts ne fait plus passer all_process, all_faulty_process, rawResponse ou parsedResponse", () => {
    const path = resolve(process.cwd(), 'supabase/functions/make-server-e3db71a4/index.ts');
    const violations = findBannedIdentifierUsages(path, readFileSync(path, 'utf8'));

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it('le module pur clariprint-responses.ts ne reference lui non plus aucun identifiant banni', () => {
    const path = resolve(process.cwd(), 'supabase/functions/make-server-e3db71a4/clariprint-responses.ts');
    const violations = findBannedIdentifierUsages(path, readFileSync(path, 'utf8'));

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
