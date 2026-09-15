/**
 * qa-review (BCP-0c, rejet du merge de `266f304e`) — la composition de
 * `magrit-api/index.ts` (cablage de `SupabasePlatformAdminGateway` en 3e
 * argument de `DiagnosticsService`) decide REELLEMENT si la garde
 * `is_super_admin()` voit le bon acteur, et n etait couvert par aucun test.
 *
 * `supabase/functions/magrit-api/index.ts` est un fichier Deno, HORS
 * `tsconfig.modular.json` (docs/api/CONVENTIONS.md, "Câblage des adaptateurs
 * dans l'edge function — non vérifiable — exécution Deno requise") : ce test
 * lit le fichier comme du TEXTE/AST TypeScript (`ts.createSourceFile`), meme
 * patron que `legacy-removed-routes-boundaries.test.ts`.
 *
 * Mutations a tuer (qa-review) :
 *   - M4a : injection du client `service_role` (ex. `documentTemplatesStorageClient`) ;
 *   - M4b : injection de `storefrontClient` (anon SANS le JWT de l appelant) ;
 *   - M4c : passerelle factice `{ isPlatformAdmin: async () => true }` au lieu
 *     de `new SupabasePlatformAdminGateway(...)`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

export interface Violation {
  line: number;
  reason: string;
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

/** Le 3e argument de `new DiagnosticsService(...)` : la passerelle d autorisation. */
function findDiagnosticsServiceThirdArg(source: ts.SourceFile): ts.Expression | undefined {
  let found: ts.Expression | undefined;
  function visit(node: ts.Node): void {
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'DiagnosticsService') {
      found = node.arguments?.[2];
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}

/**
 * Cherche `const <name> = createClient(supabaseUrl, <cle>, { ... })` dans le
 * fichier. Retourne le texte du 2e argument (le nom de la cle utilisee) et si
 * la construction porte `Authorization: authorization` dans ses en-tetes
 * globaux — seule marque du client `authenticated` (JWT de l appelant), par
 * opposition a `storefrontClient` (anon SANS JWT) ou aux clients
 * `service_role`.
 */
function findClientDeclaration(
  source: ts.SourceFile,
  name: string,
): { keyArg: string; hasAuthorizationHeader: boolean } | undefined {
  let result: { keyArg: string; hasAuthorizationHeader: boolean } | undefined;
  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'createClient'
    ) {
      const keyArgNode = node.initializer.arguments[1];
      const keyArg = keyArgNode ? keyArgNode.getText(source) : '';
      const fullText = node.initializer.getText(source);
      result = { keyArg, hasAuthorizationHeader: /Authorization\s*:\s*authorization\b/.test(fullText) };
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}

/**
 * Verifie que le 3e argument de `new DiagnosticsService(...)` est bien
 * `new SupabasePlatformAdminGateway(client)`, ou `client` est l identifiant
 * du client `authenticated` (construit avec `anonKey` ET l en-tete
 * `Authorization` de l appelant) — jamais `service_role`, jamais
 * `storefrontClient`, jamais un objet litteral factice.
 */
export function findPlatformAdminGatewayCompositionViolations(fileName: string, sourceText: string): Violation[] {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations: Violation[] = [];

  const gatewayArg = findDiagnosticsServiceThirdArg(source);
  if (!gatewayArg) {
    violations.push({ line: 1, reason: 'new DiagnosticsService(...) introuvable, ou ne recoit pas de 3e argument (la passerelle is_super_admin)' });
    return violations;
  }

  // M4c : la passerelle doit etre une VRAIE instance de SupabasePlatformAdminGateway.
  if (!ts.isNewExpression(gatewayArg) || !ts.isIdentifier(gatewayArg.expression) || gatewayArg.expression.text !== 'SupabasePlatformAdminGateway') {
    violations.push({
      line: lineOf(source, gatewayArg),
      reason: 'le 3e argument de new DiagnosticsService(...) doit etre "new SupabasePlatformAdminGateway(...)", jamais un objet litteral ni une autre passerelle',
    });
    return violations;
  }

  const gatewayArgs = gatewayArg.arguments ?? [];
  if (gatewayArgs.length !== 1 || !ts.isIdentifier(gatewayArgs[0])) {
    violations.push({
      line: lineOf(source, gatewayArg),
      reason: 'new SupabasePlatformAdminGateway(...) doit recevoir EXACTEMENT un argument, l identifiant du client authenticated',
    });
    return violations;
  }

  const clientArgName = (gatewayArgs[0] as ts.Identifier).text;

  // M4a / M4b : le client passe ne doit jamais etre un autre identifiant que "client".
  if (clientArgName !== 'client') {
    violations.push({
      line: lineOf(source, gatewayArg),
      reason: `new SupabasePlatformAdminGateway(...) recoit "${clientArgName}", attendu "client" (le client authenticated construit avec anonKey + Authorization de l appelant)`,
    });
    return violations;
  }

  const declaration = findClientDeclaration(source, clientArgName);
  if (!declaration) {
    violations.push({ line: lineOf(source, gatewayArg), reason: `aucune declaration "const ${clientArgName} = createClient(...)" trouvee dans le fichier` });
    return violations;
  }

  if (declaration.keyArg !== 'anonKey') {
    violations.push({
      line: lineOf(source, gatewayArg),
      reason: `"${clientArgName}" doit etre construit avec anonKey (role authenticated), trouve "${declaration.keyArg}"`,
    });
  }
  if (!declaration.hasAuthorizationHeader) {
    violations.push({
      line: lineOf(source, gatewayArg),
      reason: `"${clientArgName}" doit porter l en-tete "Authorization: authorization" (JWT de l appelant) dans ses en-tetes globaux`,
    });
  }

  return violations;
}

describe('composition magrit-api — SupabasePlatformAdminGateway (BCP-0c)', () => {
  it('recoit le client authenticated (anonKey + Authorization de l appelant), jamais service_role, jamais storefrontClient, jamais une passerelle factice', () => {
    const path = resolve(process.cwd(), 'supabase/functions/magrit-api/index.ts');
    const violations = findPlatformAdminGatewayCompositionViolations(path, readFileSync(path, 'utf8'));
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
