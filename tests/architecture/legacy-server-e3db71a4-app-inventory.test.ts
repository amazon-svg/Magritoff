/**
 * Inventaire FIGE de tous les appels `app.*` de l edge function legacy
 * `make-server-e3db71a4` (decision qa-review round 3, 2026-09-15).
 *
 * Les gardes precedents (garde structurelle Clariprint, garde des routes
 * retirees) ne regardaient QUE le corps des handlers cibles. Un
 * contournement plus simple echappait aux deux : ajouter une inscription
 * `app.*` supplementaire (nouvelle route, `app.onError`, `app.all`, route a
 * parametre, chemin en template literal AVEC substitution), ou changer la
 * signature d une inscription existante (methode, chemin, nombre
 * d arguments). Aucun des deux gardes precedents ne scrutait la LISTE
 * complete des inscriptions -- seulement celles qui matchaient deja un
 * chemin cible.
 *
 * Ce test fige la liste ENTIERE des appels `app.*` du fichier, dans l ordre
 * du code source : methode, chemin litteral (ou `null` si le premier
 * argument n est pas une chaine/gabarit-sans-substitution -- `app.onError`,
 * `app.all` sans chemin, route parametree exprimee autrement, etc.), et
 * nombre total d arguments. Toute inscription nouvelle, modifiee,
 * reordonnee, ou dont le chemin devient dynamique fait echouer ce test par
 * simple inegalite de tableau -- sans qu il soit necessaire d enumerer a
 * l avance tous les contournements possibles.
 *
 * Au 2026-09-15 : 2 `app.use` (middlewares globaux) + 4 routes actives
 * (health, claude-proxy, claude-proxy-stream, category-editorial) + 5
 * routes retirees en 410 Gone (save-product, send-invitation-email,
 * clariprint-quote, clariprint-test, claude-test) = 11 entrees. `claude-test`
 * rejoint les routes retirees le meme jour (correctif securite qa-review) --
 * sa signature d inscription (methode, chemin, nombre d arguments) ne
 * change pas, seul le corps du handler change ; l entree correspondante ci-
 * dessous n a donc pas besoin d etre deplacee ni modifiee. Aucun
 * `app.onError`, aucun `app.all`, aucune route a parametre, aucun chemin en
 * template literal avec substitution.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

export interface AppInventoryEntry {
  method: string;
  path: string | null;
  argCount: number;
}

/** Extrait, dans l ordre du code source, toute inscription `app.<methode>(...)`.
 * Le chemin n est retenu que si le premier argument est une chaine simple ou
 * un gabarit SANS substitution (`ts.isStringLiteralLike`) ; sinon `null`
 * (couvre `app.onError(fn)`, un chemin calcule, un gabarit avec
 * substitution, etc. -- toutes des formes qui n existent pas aujourd hui et
 * qui doivent etre revues explicitement si elles apparaissent). */
export function buildAppInventory(source: ts.SourceFile): AppInventoryEntry[] {
  const entries: AppInventoryEntry[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'app'
    ) {
      const method = node.expression.name.text;
      const firstArg = node.arguments[0];
      let path: string | null = null;
      if (firstArg && ts.isStringLiteralLike(firstArg)) {
        path = firstArg.text;
      } else if (firstArg && ts.isArrayLiteralExpression(firstArg) && firstArg.elements.every((el) => ts.isStringLiteralLike(el))) {
        path = firstArg.elements.map((el) => (el as ts.StringLiteralLike).text).join(',');
      }
      entries.push({ method, path, argCount: node.arguments.length });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return entries;
}

const EXPECTED_INVENTORY: AppInventoryEntry[] = [
  { method: 'use', path: '*', argCount: 2 },
  { method: 'use', path: '/*', argCount: 2 },
  { method: 'get', path: '/make-server-e3db71a4/health', argCount: 2 },
  { method: 'get', path: '/make-server-e3db71a4/claude-test', argCount: 2 },
  { method: 'post', path: '/make-server-e3db71a4/claude-proxy', argCount: 2 },
  { method: 'post', path: '/make-server-e3db71a4/claude-proxy-stream', argCount: 2 },
  { method: 'post', path: '/make-server-e3db71a4/clariprint-quote', argCount: 2 },
  { method: 'get', path: '/make-server-e3db71a4/clariprint-test', argCount: 2 },
  { method: 'post', path: '/make-server-e3db71a4/save-product', argCount: 2 },
  { method: 'post', path: '/make-server-e3db71a4/send-invitation-email', argCount: 2 },
  { method: 'post', path: '/make-server-e3db71a4/category-editorial', argCount: 2 },
];

describe('inventaire fige de tous les app.* de make-server-e3db71a4/index.ts', () => {
  it('correspond exactement a la liste attendue (methode, chemin, nombre d arguments, dans l ordre)', () => {
    const path = resolve(process.cwd(), 'supabase/functions/make-server-e3db71a4/index.ts');
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    expect(buildAppInventory(source)).toEqual(EXPECTED_INVENTORY);
  });

  it('aucune route a parametre, aucun onError/all, aucun chemin dynamique (tous les chemins sont non-null)', () => {
    const path = resolve(process.cwd(), 'supabase/functions/make-server-e3db71a4/index.ts');
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const inventory = buildAppInventory(source);
    expect(inventory.every((e) => e.path !== null)).toBe(true);
    expect(inventory.some((e) => e.method === 'onError' || e.method === 'all')).toBe(false);
    expect(inventory.every((e) => !e.path!.includes(':'))).toBe(true);
  });
});
