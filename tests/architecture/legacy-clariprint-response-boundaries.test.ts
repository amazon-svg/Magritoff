/**
 * Correctif de securite (decision Arnaud, 2026-09-15) sur l edge function
 * legacy `make-server-e3db71a4`, appelable par quiconque detient la seule
 * cle anonyme publique du projet Supabase (`verify_jwt = true` accepte un
 * JWT anon, sans verifier une autorisation d utilisateur).
 *
 * v1 (rejetee) : liste noire de 4 identifiants litteraux. 12/14 mutations
 * survivaient.
 * v2 (rejetee) : liste noire elargie a 8 identifiants + resolution d alias
 * "triviaux". 25 contournements survivaient encore (indirections a 2 niveaux,
 * fonctions locales, Object.assign, JSON.parse/stringify, fuite par en-tete
 * ou via `new Response`, chemin en template literal, mapping de cle errone
 * dans le corps succes, etc.) : une liste noire d identifiants ne peut
 * jamais couvrir toutes les facons de faire circuler une valeur.
 *
 * v3 (ce fichier) abandonne toute liste noire au profit de regles
 * STRUCTURELLES (liste blanche) sur les DEUX handlers `clariprint-quote` et
 * `clariprint-test` :
 *
 *  (i)   le premier argument de CHAQUE `<contexte>.json(` doit etre un APPEL
 *        a une fonction `build*` importee de `./clariprint-responses.ts`.
 *  (ii)  pour tout `build*` AUTRE que `buildQuoteSuccessBody` et
 *        `buildAuthTestBody` : chaque argument doit etre un LITTERAL pur
 *        (chaine, gabarit sans substitution, nombre, booleen, null, ou
 *        litteral d objet/tableau compose uniquement de litteraux). Aucune
 *        variable, aucun acces de propriete, aucun appel de fonction,
 *        aucune concatenation.
 *  (iii) pour `buildAuthTestBody` : seul l objet litteral est accepte, et
 *        SEULS les identifiants `success` et `httpStatus` peuvent y
 *        apparaitre (shorthand, condition de ternaire, substitution de
 *        gabarit) -- tout le reste doit etre litteral.
 *  (iv)  pour `buildQuoteSuccessBody` : l argument doit etre un objet
 *        litteral avec EXACTEMENT les 6 cles metier, chacune correspondant a
 *        LA propriete de meme nom sur `result` (sauf `priceHT` ->
 *        `result.response` et `processDuration` ->
 *        `result.total_process_duration`), lue par un acces simple, sans
 *        chainage optionnel.
 *  (v)   dans ces deux handlers, aucune reference a `<contexte>.text`,
 *        `<contexte>.body`, `<contexte>.html`, `<contexte>.header`, ni a
 *        `new Response` -- la seule sortie HTTP possible est
 *        `<contexte>.json(...)`, et cet appel ne prend au plus que 2
 *        arguments, le second etant obligatoirement un litteral numerique.
 *  (vi)  le chemin de route peut etre exprime en chaine simple OU en gabarit
 *        sans substitution (`` `...` ``) -- les deux sont reconnus, pour ne
 *        pas laisser un changement de syntaxe rendre le garde vacant. Un
 *        test dedie verifie que les deux handlers sont bien trouves.
 *
 * Une regle structurelle (liste blanche) est plus robuste qu une liste
 * noire d identifiants : elle ne demande pas d enumerer a l avance toutes
 * les facons de faire fuiter une donnee, seulement de decrire la forme
 * etroite que le code legitime doit prendre.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

export const SUCCESS_BODY_BUILDER = 'buildQuoteSuccessBody';
export const AUTH_TEST_BODY_BUILDER = 'buildAuthTestBody';

/** cle du corps succes -> propriete correspondante sur `result`. */
export const SUCCESS_KEY_TO_RESULT_PROP: Readonly<Record<string, string>> = {
  priceHT: 'response',
  costs: 'costs',
  delais: 'delais',
  weight: 'weight',
  fournisseur: 'fournisseur',
  processDuration: 'total_process_duration',
};

/** Identifiants autorises (en plus des litteraux) dans l argument de
 * `buildAuthTestBody`. */
export const AUTH_TEST_BODY_WHITELIST = ['success', 'httpStatus'] as const;

/** Methodes de sortie HTTP interdites sur le contexte Hono, en plus de
 * `<contexte>.json`. */
const FORBIDDEN_CONTEXT_METHODS = ['text', 'body', 'html', 'header'] as const;

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
        for (const element of clause.namedBindings.elements) names.add(element.name.text);
      }
    }
  }
  return names;
}

/** Vrai si `expr` est un litteral pur au sens strict : aucune variable,
 * aucun acces de propriete, aucun appel, aucune concatenation -- juste une
 * valeur ecrite en dur dans le code source. Recursif pour les litteraux
 * d objet/tableau, dont chaque membre doit lui-meme etre un litteral pur. */
function isPureLiteral(expr: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(expr)) return isPureLiteral(expr.expression);
  if (ts.isStringLiteralLike(expr)) return true; // StringLiteral ou NoSubstitutionTemplateLiteral
  if (ts.isNumericLiteral(expr)) return true;
  if (expr.kind === ts.SyntaxKind.TrueKeyword || expr.kind === ts.SyntaxKind.FalseKeyword) return true;
  if (expr.kind === ts.SyntaxKind.NullKeyword) return true;
  if (
    ts.isPrefixUnaryExpression(expr) &&
    (expr.operator === ts.SyntaxKind.MinusToken || expr.operator === ts.SyntaxKind.PlusToken) &&
    ts.isNumericLiteral(expr.operand)
  ) {
    return true;
  }
  if (ts.isArrayLiteralExpression(expr)) {
    return expr.elements.every((el) => !ts.isSpreadElement(el) && isPureLiteral(el));
  }
  if (ts.isObjectLiteralExpression(expr)) {
    return expr.properties.every(
      (p) => ts.isPropertyAssignment(p) && !ts.isComputedPropertyName(p.name) && isPureLiteral(p.initializer),
    );
  }
  // TemplateExpression (gabarit AVEC substitution), Identifier, appel de
  // fonction, acces de propriete/element, `await`, spread, etc. : rejetes.
  return false;
}

/** Comme `isPureLiteral`, mais autorise en plus une reference (nue, dans une
 * ternaire, ou en substitution de gabarit) a un identifiant de `whitelist`.
 * Utilise UNIQUEMENT pour `buildAuthTestBody`. */
function isLiteralOrWhitelisted(expr: ts.Expression, whitelist: readonly string[]): boolean {
  if (isPureLiteral(expr)) return true;
  if (ts.isParenthesizedExpression(expr)) return isLiteralOrWhitelisted(expr.expression, whitelist);
  if (ts.isIdentifier(expr)) return whitelist.includes(expr.text);
  if (ts.isConditionalExpression(expr)) {
    return (
      isLiteralOrWhitelisted(expr.condition, whitelist) &&
      isLiteralOrWhitelisted(expr.whenTrue, whitelist) &&
      isLiteralOrWhitelisted(expr.whenFalse, whitelist)
    );
  }
  if (ts.isTemplateExpression(expr)) {
    return expr.templateSpans.every((span) => isLiteralOrWhitelisted(span.expression, whitelist));
  }
  return false;
}

function authTestBodyArgumentViolations(call: ts.CallExpression, source: ts.SourceFile, route: string): Violation[] {
  const violations: Violation[] = [];
  const arg = call.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg) || call.arguments.length !== 1) {
    violations.push({ route, line: lineOf(source, call), reason: 'buildAuthTestBody doit recevoir un unique objet litteral' });
    return violations;
  }
  for (const prop of arg.properties) {
    if (ts.isShorthandPropertyAssignment(prop)) {
      if (!(AUTH_TEST_BODY_WHITELIST as readonly string[]).includes(prop.name.text)) {
        violations.push({ route, line: lineOf(source, prop), reason: `buildAuthTestBody: identifiant "${prop.name.text}" non autorise` });
      }
      continue;
    }
    if (!ts.isPropertyAssignment(prop) || ts.isComputedPropertyName(prop.name)) {
      violations.push({ route, line: lineOf(source, prop), reason: 'buildAuthTestBody: seules des cles nommees simples sont autorisees' });
      continue;
    }
    if (!isLiteralOrWhitelisted(prop.initializer, AUTH_TEST_BODY_WHITELIST)) {
      violations.push({
        route,
        line: lineOf(source, prop),
        reason: `buildAuthTestBody: la cle "${prop.name.getText(source)}" doit etre litterale ou limitee a success/httpStatus`,
      });
    }
  }
  return violations;
}

function successBodyArgumentViolations(call: ts.CallExpression, source: ts.SourceFile, route: string): Violation[] {
  const violations: Violation[] = [];
  const arg = call.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg) || call.arguments.length !== 1) {
    violations.push({ route, line: lineOf(source, call), reason: 'buildQuoteSuccessBody doit recevoir un unique objet litteral' });
    return violations;
  }
  const expectedKeys = Object.keys(SUCCESS_KEY_TO_RESULT_PROP);
  const seenKeys = new Set<string>();
  for (const prop of arg.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
      violations.push({ route, line: lineOf(source, prop), reason: 'buildQuoteSuccessBody: seules des cles nommees simples sont autorisees (pas de spread/calcule/shorthand)' });
      continue;
    }
    const key = prop.name.text;
    seenKeys.add(key);
    const expectedProp = SUCCESS_KEY_TO_RESULT_PROP[key];
    if (!expectedProp) {
      violations.push({ route, line: lineOf(source, prop), reason: `buildQuoteSuccessBody: cle non autorisee "${key}"` });
      continue;
    }
    const value = prop.initializer;
    const isExactResultAccess =
      ts.isPropertyAccessExpression(value) &&
      !value.questionDotToken &&
      ts.isIdentifier(value.expression) &&
      value.expression.text === 'result' &&
      value.name.text === expectedProp;
    if (!isExactResultAccess) {
      violations.push({
        route,
        line: lineOf(source, prop),
        reason: `buildQuoteSuccessBody: la cle "${key}" doit etre exactement result.${expectedProp}`,
      });
    }
  }
  for (const missing of expectedKeys) {
    if (!seenKeys.has(missing)) {
      violations.push({ route, line: lineOf(source, call), reason: `buildQuoteSuccessBody: cle manquante "${missing}"` });
    }
  }
  return violations;
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
      // (vi) le chemin peut etre une chaine simple OU un gabarit sans
      // substitution -- les deux exposent `.text` sur l AST TypeScript.
      if (firstArg && ts.isStringLiteralLike(firstArg) && (ts.isArrowFunction(lastArg) || ts.isFunctionExpression(lastArg))) {
        const match = TARGET_ROUTES.find((r) => r.method === method && r.path === firstArg.text);
        if (match) handlers.push({ route: `${match.method.toUpperCase()} ${match.path}`, handler: lastArg });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return handlers;
}

function contextParamName(handler: ts.ArrowFunction | ts.FunctionExpression): string {
  const p = handler.parameters[0];
  return p && ts.isIdentifier(p.name) ? p.name.text : 'c';
}

/**
 * Verifie les deux handlers cibles d un fichier source contre les regles
 * (i) a (vi). Fonction exportee pour reutilisation par les tests de
 * mutation ci-dessous (chaque mutation est projetee dans un petit fichier
 * source autonome qui redeclare le meme squelette `app.post`/`app.get`).
 */
export function findLegacyClariprintResponseViolations(fileName: string, sourceText: string): Violation[] {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const allowedBuilders = importedBuilderNames(source);
  const violations: Violation[] = [];

  for (const { route, handler } of findRouteHandlers(source)) {
    const cParam = contextParamName(handler);

    function visit(node: ts.Node): void {
      // (v) aucune autre sortie HTTP que <contexte>.json(...).
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === cParam) {
        if ((FORBIDDEN_CONTEXT_METHODS as readonly string[]).includes(node.name.text)) {
          violations.push({ route, line: lineOf(source, node), reason: `reference a ${cParam}.${node.name.text} interdite (seule sortie autorisee : ${cParam}.json)` });
        }
      }
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Response') {
        violations.push({ route, line: lineOf(source, node), reason: 'new Response(...) interdit (seule sortie autorisee : ' + cParam + '.json)' });
      }

      // (i) <contexte>.json( doit recevoir un appel build*, jamais un appel
      // homonyme comme `c.req.json()` (lecture du corps de requete).
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'json' &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === cParam
      ) {
        // (v) au plus 2 arguments, le 2e etant un litteral numerique.
        if (node.arguments.length > 2) {
          violations.push({ route, line: lineOf(source, node), reason: `${cParam}.json ne peut prendre plus de 2 arguments` });
        }
        if (node.arguments.length === 2 && !ts.isNumericLiteral(node.arguments[1])) {
          violations.push({ route, line: lineOf(source, node), reason: `${cParam}.json: le 2e argument doit etre un litteral numerique` });
        }

        const arg = node.arguments[0];
        const isBuilderCall = arg && ts.isCallExpression(arg) && ts.isIdentifier(arg.expression) && allowedBuilders.has(arg.expression.text);

        if (!isBuilderCall) {
          violations.push({
            route,
            line: lineOf(source, node),
            reason: `le premier argument de ${cParam}.json( doit etre un appel a une fonction build* importee de clariprint-responses.ts`,
          });
        } else if (ts.isCallExpression(arg) && ts.isIdentifier(arg.expression)) {
          const builderName = arg.expression.text;
          if (builderName === SUCCESS_BODY_BUILDER) {
            violations.push(...successBodyArgumentViolations(arg, source, route));
          } else if (builderName === AUTH_TEST_BODY_BUILDER) {
            violations.push(...authTestBodyArgumentViolations(arg, source, route));
          } else {
            for (const builderArg of arg.arguments) {
              if (!isPureLiteral(builderArg)) {
                violations.push({
                  route,
                  line: lineOf(source, builderArg),
                  reason: `${builderName}: seuls des arguments litteraux sont autorises`,
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
  it('index.ts est conforme aux regles structurelles (i) a (vi)', () => {
    const path = resolve(process.cwd(), 'supabase/functions/make-server-e3db71a4/index.ts');
    const violations = findLegacyClariprintResponseViolations(path, readFileSync(path, 'utf8'));
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it('(d) garde non-vacant : les deux handlers sont bien trouves dans index.ts', () => {
    const path = resolve(process.cwd(), 'supabase/functions/make-server-e3db71a4/index.ts');
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    expect(findRouteHandlers(source).map((h) => h.route).sort()).toEqual(
      TARGET_ROUTES.map((r) => `${r.method.toUpperCase()} ${r.path}`).sort(),
    );
  });
});
