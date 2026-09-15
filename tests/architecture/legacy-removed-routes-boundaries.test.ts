/**
 * Correctif de securite (decision Arnaud, 2026-09-15) : `save-product` et
 * `send-invitation-email`, deux routes legacy de `make-server-e3db71a4` sans
 * appelant connu (verifie par qa-review), repondent desormais 410 Gone. Le
 * flux d invitation courant passe par `POST /api/v1/invitations`
 * (magrit-api).
 *
 * Ce garde AST verifie que CHACUN des deux handlers :
 *  (i)  ne contient qu une seule instruction, un `return c.json(<appel
 *       build*>, 410)` ;
 *  (ii) ne reference nulle part `c.req`, `kv.`, `Deno.env`, ni un appel a
 *       `fetch` -- aucune lecture du corps de requete, aucun acces au KV
 *       store, a une variable d environnement ou au reseau.
 *
 * Preuve d echec sur le commit precedent (avant ce correctif, `ae14eab0`) :
 * voir le rapport de fin de tache -- ce test, pointe sur ce commit, remonte
 * des violations sur les deux routes (lecture de `c.req.json()`, acces
 * `kv.set`/`kv.get`, `Deno.env.get(...)`, `fetch(...)`).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

export const TARGET_ROUTES: ReadonlyArray<{ method: 'post' | 'get'; path: string }> = [
  { method: 'post', path: '/make-server-e3db71a4/save-product' },
  { method: 'post', path: '/make-server-e3db71a4/send-invitation-email' },
];

export interface Violation {
  route: string;
  line: number;
  reason: string;
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function importedBuilderNames(source: ts.SourceFile, moduleSuffix: string): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.includes(moduleSuffix)
    ) {
      const clause = statement.importClause;
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) names.add(element.name.text);
      }
    }
  }
  return names;
}

function findRouteHandlers(source: ts.SourceFile): Array<{ route: string; handler: ts.ArrowFunction | ts.FunctionExpression }> {
  const handlers: Array<{ route: string; handler: ts.ArrowFunction | ts.FunctionExpression }> = [];
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'app'
    ) {
      const method = node.expression.name.text;
      const firstArg = node.arguments[0];
      const lastArg = node.arguments[node.arguments.length - 1];
      if (ts.isStringLiteral(firstArg) && (ts.isArrowFunction(lastArg) || ts.isFunctionExpression(lastArg))) {
        const match = TARGET_ROUTES.find((r) => r.method === method && r.path === firstArg.text);
        if (match) handlers.push({ route: `${match.method.toUpperCase()} ${match.path}`, handler: lastArg });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return handlers;
}

/** Le "corps logique" d un handler : soit l unique instruction d un bloc
 * (`{ return X; }`), soit l expression directe d une fleche concise
 * (`(c) => X`). Retourne `undefined` si la forme ne correspond a aucun des
 * deux (plusieurs instructions, pas un simple `return`, etc.). */
function logicalBody(handler: ts.ArrowFunction | ts.FunctionExpression): ts.Expression | undefined {
  const body = handler.body;
  if (ts.isBlock(body)) {
    if (body.statements.length !== 1) return undefined;
    const only = body.statements[0];
    if (!ts.isReturnStatement(only) || !only.expression) return undefined;
    return only.expression;
  }
  return body; // fleche concise : le corps EST l expression retournee
}

function contextParamName(handler: ts.ArrowFunction | ts.FunctionExpression): string {
  const p = handler.parameters[0];
  return p && ts.isIdentifier(p.name) ? p.name.text : 'c';
}

function checkShape(
  handler: ts.ArrowFunction | ts.FunctionExpression,
  route: string,
  source: ts.SourceFile,
  allowedBuilders: Set<string>,
  violations: Violation[],
): void {
  const expr = logicalBody(handler);
  const cParam = contextParamName(handler);
  const isCJsonCall =
    expr &&
    ts.isCallExpression(expr) &&
    ts.isPropertyAccessExpression(expr.expression) &&
    ts.isIdentifier(expr.expression.expression) &&
    expr.expression.expression.text === cParam &&
    expr.expression.name.text === 'json';

  if (!expr || !isCJsonCall) {
    violations.push({
      route,
      line: lineOf(source, handler),
      reason: `le corps doit etre exactement "return ${cParam}.json(<build*>, 410)", rien d autre`,
    });
    return;
  }

  const call = expr as ts.CallExpression;
  const [arg0, arg1] = call.arguments;
  const isBuilderCall = arg0 && ts.isCallExpression(arg0) && ts.isIdentifier(arg0.expression) && allowedBuilders.has(arg0.expression.text);
  if (!isBuilderCall) {
    violations.push({ route, line: lineOf(source, call), reason: 'le premier argument doit etre un appel a une fonction build* importee' });
  }
  const is410 = arg1 && ts.isNumericLiteral(arg1) && arg1.text === '410';
  if (!is410) {
    violations.push({ route, line: lineOf(source, call), reason: 'le code de statut doit etre litteralement 410' });
  }
}

const FORBIDDEN_DESCRIPTIONS: Array<(node: ts.Node) => string | undefined> = [
  (n) =>
    ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'c' && n.name.text === 'req'
      ? 'reference a c.req interdite (aucune lecture du corps de requete)'
      : undefined,
  (n) =>
    ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'kv'
      ? 'reference a kv. interdite (aucun acces au KV store)'
      : undefined,
  (n) =>
    ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'Deno' && n.name.text === 'env'
      ? 'reference a Deno.env interdite (aucune variable d environnement)'
      : undefined,
  (n) =>
    ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'fetch'
      ? 'appel a fetch interdit (aucun acces reseau)'
      : undefined,
];

function checkForbiddenReferences(handler: ts.Node, route: string, source: ts.SourceFile, violations: Violation[]): void {
  function visit(node: ts.Node): void {
    for (const check of FORBIDDEN_DESCRIPTIONS) {
      const reason = check(node);
      if (reason) violations.push({ route, line: lineOf(source, node), reason });
    }
    ts.forEachChild(node, visit);
  }
  visit(handler);
}

/**
 * Verifie les deux routes retirees d un fichier source. Exportee pour
 * reutilisation par un eventuel test de mutation ou de preuve d echec.
 */
export function findRemovedRouteViolations(fileName: string, sourceText: string): Violation[] {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const allowedBuilders = importedBuilderNames(source, 'removed-route-responses');
  const violations: Violation[] = [];

  for (const { route, handler } of findRouteHandlers(source)) {
    checkShape(handler, route, source, allowedBuilders, violations);
    checkForbiddenReferences(handler, route, source, violations);
  }

  return violations;
}

describe('save-product / send-invitation-email : 410 Gone strict, sans effet de bord', () => {
  it('index.ts est conforme : corps unique return c.json(build*, 410), aucune reference interdite', () => {
    const path = resolve(process.cwd(), 'supabase/functions/make-server-e3db71a4/index.ts');
    const violations = findRemovedRouteViolations(path, readFileSync(path, 'utf8'));
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it('les deux routes cibles sont bien presentes dans le fichier (garde non-vacant)', () => {
    const path = resolve(process.cwd(), 'supabase/functions/make-server-e3db71a4/index.ts');
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    expect(findRouteHandlers(source).map((h) => h.route).sort()).toEqual(
      TARGET_ROUTES.map((r) => `${r.method.toUpperCase()} ${r.path}`).sort(),
    );
  });
});
