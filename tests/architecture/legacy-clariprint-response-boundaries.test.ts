/**
 * Correctif de securite (decision Arnaud, 2026-09-15) sur l edge function
 * legacy `make-server-e3db71a4`, appelable par quiconque detient la seule
 * cle anonyme publique du projet Supabase (`verify_jwt = true` accepte un
 * JWT anon, sans verifier une autorisation d utilisateur).
 *
 * v1 de ce test (rejetee par qa-review) ne cherchait que 4 identifiants
 * litteraux (`all_process`, `all_faulty_process`, `rawResponse`,
 * `parsedResponse`) directement en cle ou en acces de propriete. 12 des 14
 * mutations soumises par qa-review y survivaient (destructuration renommee,
 * cle calculee, variable intermediaire, spread, gabarits de chaine, etc.).
 *
 * v2 (ce fichier) impose une regle structurelle beaucoup plus stricte sur
 * les DEUX handlers `clariprint-quote` et `clariprint-test` :
 *
 *  (i)  le premier argument de CHAQUE `c.json(` doit etre un APPEL a une
 *       fonction `build*` importee de `./clariprint-responses.ts` -- jamais
 *       un objet litteral, un identifiant nu, ou un spread.
 *  (ii) aucun argument passe a un `build*` ne peut deriver de l un des
 *       identifiants sources `result`, `responseText`, `errorText`,
 *       `rawText`, `login`, `host`, `apiUrl`, `error` -- ni directement
 *       (acces de propriete, cle calculee, gabarit de chaine, spread), ni
 *       indirectement via un alias trivial (`const payload = result`,
 *       destructuration `const { x } = result`). Seule exception : l objet
 *       passe a `buildQuoteSuccessBody`, strictement limite a ses 6 cles
 *       metier (`priceHT`, `costs`, `delais`, `weight`, `fournisseur`,
 *       `processDuration`), chacune lue par un acces simple `result.xxx`.
 *
 * La resolution d alias est volontairement bornee a des formes "triviales"
 * (identifiant nu, chaine d acces de propriete/element, spread d objet) et
 * ne remonte PAS a travers une expression logique/calculee (`a && b`,
 * `a ?? b`, un appel de fonction, etc.) : sinon, quasiment toute variable de
 * ces handlers finirait par etre jugee "derivee" de `host`/`login`/`result`
 * par transitivite (ex. `apiResponse` vient d un `fetch` qui utilise `host`),
 * ce qui rendrait le garde inutilisable (faux positifs sur du code legitime
 * comme `success = apiResponse.ok && parsed?.success !== false`).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

export const BANNED_SOURCE_IDENTIFIERS = [
  'result',
  'responseText',
  'errorText',
  'rawText',
  'login',
  'host',
  'apiUrl',
  'error',
] as const;

export const SUCCESS_BODY_BUILDER = 'buildQuoteSuccessBody';
export const SUCCESS_BODY_ALLOWED_KEYS = [
  'priceHT',
  'costs',
  'delais',
  'weight',
  'fournisseur',
  'processDuration',
] as const;

export const TARGET_ROUTES: ReadonlyArray<{ method: 'post' | 'get'; path: string }> = [
  { method: 'post', path: '/make-server-e3db71a4/clariprint-quote' },
  { method: 'get', path: '/make-server-e3db71a4/clariprint-test' },
];

export interface Violation {
  route: string;
  line: number;
  reason: string;
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

/** Identifiants importes nommement de `./clariprint-responses.ts` (ou du
 * chemin donne en 2e argument, pour les tests qui pointent vers un fichier
 * de mutation isole). */
function importedBuilderNames(source: ts.SourceFile, moduleSuffix = 'clariprint-responses'): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.includes(moduleSuffix)
    ) {
      const clause = statement.importClause;
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          names.add(element.name.text);
        }
      }
    }
  }
  return names;
}

/** Un identifiant est une "reference" (lecture de variable) s il n est pas
 * lui-meme un nom de declaration ou une cle non-calculee d objet/pattern. */
function isReferenceIdentifier(id: ts.Identifier): boolean {
  const p = id.parent;
  if (!p) return true;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if (ts.isPropertyAssignment(p) && p.name === id) return false;
  if (ts.isBindingElement(p) && (p.name === id || p.propertyName === id)) return false;
  if (ts.isVariableDeclaration(p) && p.name === id) return false;
  if (ts.isParameter(p) && p.name === id) return false;
  if (ts.isImportSpecifier(p) && (p.name === id || p.propertyName === id)) return false;
  if (ts.isFunctionDeclaration(p) && p.name === id) return false;
  if (ts.isLabeledStatement(p) && p.label === id) return false;
  if (ts.isMethodDeclaration(p) && p.name === id) return false;
  return true;
}

/** Recherche, dans `scope`, une VariableDeclaration dont un des noms lies
 * (identifiant simple ou element d un pattern de destructuration) vaut
 * `name`, et retourne son initialiseur. Toutes les branches d un pattern
 * partagent le meme initialiseur : `const { a, b } = result` taint "a" ET
 * "b" via `result`, qu on lise ou non la propriete effectivement dangereuse. */
function findLocalInitializer(name: string, scope: ts.Node): ts.Expression | undefined {
  let found: ts.Expression | undefined;

  function bindingNames(bindingName: ts.BindingName, out: string[]): void {
    if (ts.isIdentifier(bindingName)) {
      out.push(bindingName.text);
      return;
    }
    for (const element of bindingName.elements) {
      if (ts.isOmittedExpression(element)) continue;
      bindingNames(element.name, out);
    }
  }

  function visit(node: ts.Node): void {
    if (found) return;
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const names: string[] = [];
      bindingNames(node.name, names);
      if (names.includes(name)) {
        found = node.initializer;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(scope);
  return found;
}

/** Determine si `expr` est un alias TRIVIAL (identifiant nu, chaine d acces
 * de propriete/element, ou spread d objet) d un identifiant banni -- sans
 * jamais suivre une expression logique/conditionnelle/un appel de fonction.
 * C est cette restriction qui evite l explosion de faux positifs. */
function isTrivialBannedExpression(expr: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(expr)) return isTrivialBannedExpression(expr.expression);
  if (ts.isAsExpression(expr) || ts.isNonNullExpression(expr)) {
    return isTrivialBannedExpression(expr.expression);
  }
  if (ts.isIdentifier(expr)) {
    return (BANNED_SOURCE_IDENTIFIERS as readonly string[]).includes(expr.text);
  }
  if (ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr)) {
    return isTrivialBannedExpression(expr.expression);
  }
  if (ts.isObjectLiteralExpression(expr)) {
    return expr.properties.some((p) => ts.isSpreadAssignment(p) && isTrivialBannedExpression(p.expression));
  }
  return false;
}

function isTrivialAliasOfBanned(name: string, scope: ts.Node): boolean {
  const initializer = findLocalInitializer(name, scope);
  if (!initializer) return false;
  return isTrivialBannedExpression(initializer);
}

/** Vrai si `expr` (un argument passe a un `build*`) contient, n importe ou
 * dans son arbre syntaxique, une reference directe a un identifiant banni,
 * ou une reference a un alias trivial d un identifiant banni. */
function argumentIsTainted(expr: ts.Node, scope: ts.Node): boolean {
  let tainted = false;
  function walk(node: ts.Node): void {
    if (tainted) return;
    if (ts.isIdentifier(node) && isReferenceIdentifier(node)) {
      if ((BANNED_SOURCE_IDENTIFIERS as readonly string[]).includes(node.text)) {
        tainted = true;
        return;
      }
      if (isTrivialAliasOfBanned(node.text, scope)) {
        tainted = true;
        return;
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(expr);
  return tainted;
}

/** Verifie que l objet passe a `buildQuoteSuccessBody` respecte l exception
 * exacte de la regle (ii) : uniquement les 6 cles metier, chacune une
 * PropertyAssignment dont la valeur est un acces simple `result.<prop>`. */
function successBodyArgumentViolations(call: ts.CallExpression, source: ts.SourceFile, route: string): Violation[] {
  const violations: Violation[] = [];
  const arg = call.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) {
    violations.push({
      route,
      line: lineOf(source, call),
      reason: 'buildQuoteSuccessBody doit recevoir un unique objet litteral',
    });
    return violations;
  }
  for (const prop of arg.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
      violations.push({
        route,
        line: lineOf(source, prop),
        reason: 'buildQuoteSuccessBody: seules des cles nommees simples sont autorisees (pas de spread/calcule/shorthand)',
      });
      continue;
    }
    const key = prop.name.text;
    if (!(SUCCESS_BODY_ALLOWED_KEYS as readonly string[]).includes(key)) {
      violations.push({ route, line: lineOf(source, prop), reason: `buildQuoteSuccessBody: cle non autorisee "${key}"` });
      continue;
    }
    const value = prop.initializer;
    const isSimpleResultAccess =
      ts.isPropertyAccessExpression(value) &&
      !value.questionDotToken &&
      ts.isIdentifier(value.expression) &&
      value.expression.text === 'result';
    if (!isSimpleResultAccess) {
      violations.push({
        route,
        line: lineOf(source, prop),
        reason: `buildQuoteSuccessBody: la cle "${key}" doit etre lue par un acces simple result.xxx`,
      });
    }
  }
  return violations;
}

function findEnclosingFunction(node: ts.Node): ts.Node {
  let current: ts.Node | undefined = node.parent;
  while (current && !ts.isArrowFunction(current) && !ts.isFunctionExpression(current) && !ts.isFunctionDeclaration(current)) {
    current = current.parent;
  }
  return current ?? node.getSourceFile();
}

function findRouteHandlers(source: ts.SourceFile): Array<{ route: string; handler: ts.Node }> {
  const handlers: Array<{ route: string; handler: ts.Node }> = [];
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
      if (
        ts.isStringLiteral(firstArg) &&
        (ts.isArrowFunction(lastArg) || ts.isFunctionExpression(lastArg))
      ) {
        const match = TARGET_ROUTES.find((r) => r.method === method && r.path === firstArg.text);
        if (match) handlers.push({ route: `${match.method.toUpperCase()} ${match.path}`, handler: lastArg });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return handlers;
}

/**
 * Verifie les deux handlers cibles d un fichier source contre les regles
 * (i) et (ii). Fonction exportee pour reutilisation par les tests de
 * mutation ci-dessous (chaque mutation est projetee dans un petit fichier
 * source autonome qui redeclare le meme squelette `app.post`/`app.get`).
 */
export function findLegacyClariprintResponseViolations(fileName: string, sourceText: string): Violation[] {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const allowedBuilders = importedBuilderNames(source);
  const violations: Violation[] = [];

  for (const { route, handler } of findRouteHandlers(source)) {
    const contextParamName =
      (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) &&
      handler.parameters[0] &&
      ts.isIdentifier(handler.parameters[0].name)
        ? (handler.parameters[0].name as ts.Identifier).text
        : 'c';

    function visit(node: ts.Node): void {
      // Ne cible QUE `<contexte>.json(...)` (la reponse HTTP), jamais un
      // appel homonyme comme `c.req.json()` (lecture du corps de requete).
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'json' &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === contextParamName
      ) {
        const arg = node.arguments[0];
        const isBuilderCall =
          arg && ts.isCallExpression(arg) && ts.isIdentifier(arg.expression) && allowedBuilders.has(arg.expression.text);

        if (!isBuilderCall) {
          violations.push({
            route,
            line: lineOf(source, node),
            reason: 'le premier argument de c.json( doit etre un appel a une fonction build* importee de clariprint-responses.ts',
          });
        } else if (ts.isCallExpression(arg) && ts.isIdentifier(arg.expression)) {
          const builderName = arg.expression.text;
          if (builderName === SUCCESS_BODY_BUILDER) {
            violations.push(...successBodyArgumentViolations(arg, source, route));
          } else {
            for (const builderArg of arg.arguments) {
              if (argumentIsTainted(builderArg, findEnclosingFunction(node))) {
                violations.push({
                  route,
                  line: lineOf(source, builderArg),
                  reason: `${builderName}: un argument derive de ${BANNED_SOURCE_IDENTIFIERS.join('/')}`,
                });
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(handler);
  }

  return violations;
}

describe('clariprint-quote / clariprint-test : reponses strictement construites par les build*', () => {
  it('index.ts est conforme aux regles (i) et (ii)', () => {
    const path = resolve(process.cwd(), 'supabase/functions/make-server-e3db71a4/index.ts');
    const violations = findLegacyClariprintResponseViolations(path, readFileSync(path, 'utf8'));
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
