/**
 * Q20 qa-review round 1 — garde d'architecture demandée en correction de
 * rédaction (le test "cas légitime" de `tests/hooks/useProductConfigurator.
 * test.ts` n'appelait jamais `buildConfiguredProduct` : il restait vert
 * quand on cassait le correctif, c'était une tautologie sur
 * `resolveCartLinePricing`, pas une garde).
 *
 * Le correctif de `buildConfiguredProduct` (docs/api/CONVENTIONS.md §8.25
 * point 9, Q20) suppose que le chemin d'ajout direct au panier
 * (`canAddAsIs`, arbitrage Arnaud du 16/09) n'appelle JAMAIS cette fonction
 * — un produit ajouté « tel quel » ne passe pas par le configurateur, donc
 * son `clariprintQuote` légitime n'est jamais rogné. Cette garde vérifie
 * STRUCTURELLEMENT cette hypothèse par AST TypeScript (même technique que
 * `tests/architecture/cart-line-single-constructor.test.ts`) : le seul
 * appel de `buildConfiguredProduct` dans tout `src/` doit être celui, déjà
 * existant, dans `confirm()` de `useProductConfigurator.ts`. Si un futur
 * câblage fait appeler cette fonction depuis le chemin d'ajout direct (ou
 * depuis n'importe quel autre endroit), ce test rougit.
 *
 * Une `CallExpression` (`buildConfiguredProduct(...)`) est distinguée de la
 * déclaration de fonction (`function buildConfiguredProduct(...)`) par
 * construction de l'AST : `ts.isCallExpression` ne matche jamais une
 * `FunctionDeclaration`, donc aucune exclusion textuelle n'est nécessaire.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import * as ts from 'typescript';

const root = resolve(__dirname, '../..');
const srcRoot = resolve(root, 'src');
const ALLOWED_FILE = 'src/modules/clariprint/ui/hooks/useProductConfigurator.ts';
const CALLEE_NAME = 'buildConfiguredProduct';

function listSourceFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      results.push(full);
    }
  }
  walk(dir);
  return results;
}

function countCallExpressions(src: string, fileName: string, calleeName: string): number {
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, scriptKind);
  let count = 0;
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === calleeName
    ) {
      count++;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return count;
}

describe('buildConfiguredProduct — un seul point d appel dans tout src/ (Q20 qa-review round 1)', () => {
  it('n est appele que depuis confirm() dans useProductConfigurator.ts', () => {
    const files = listSourceFiles(srcRoot);
    const callSites: Array<{ file: string; count: number }> = [];

    for (const file of files) {
      const rel = relative(root, file).replace(/\\/g, '/');
      const src = readFileSync(file, 'utf8');
      const count = countCallExpressions(src, file, CALLEE_NAME);
      if (count > 0) callSites.push({ file: rel, count });
    }

    const outsideAllowed = callSites.filter((c) => c.file !== ALLOWED_FILE);
    expect(outsideAllowed).toEqual([]);

    const allowedCallSite = callSites.find((c) => c.file === ALLOWED_FILE);
    // Sanity check du garde lui-même : si buildConfiguredProduct disparaissait
    // de useProductConfigurator.ts (renommage, suppression), ce test doit le
    // signaler plutôt que de passer par défaut sur une liste vide des deux
    // côtés.
    expect(allowedCallSite?.count).toBe(1);
  });
});
