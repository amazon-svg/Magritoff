import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const sourceRoot = resolve(projectRoot, 'src');

function resolveSourceImport(importer: string, specifier: string): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/')
    ? resolve(sourceRoot, specifier.slice(2))
    : resolve(dirname(importer), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function runtimeImports(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const imports: string[] = [];

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      if (
        clause?.namedBindings
        && ts.isNamedImports(clause.namedBindings)
        && !clause.name
        && clause.namedBindings.elements.every((element) => element.isTypeOnly)
      ) continue;
      if (ts.isStringLiteral(statement.moduleSpecifier)) imports.push(statement.moduleSpecifier.text);
    }

    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (statement.isTypeOnly) continue;
      if (
        statement.exportClause
        && ts.isNamedExports(statement.exportClause)
        && statement.exportClause.elements.every((element) => element.isTypeOnly)
      ) continue;
      imports.push(statement.moduleSpecifier.text);
    }
  }

  return imports;
}

function collectStaticGraph(entry: string): string[] {
  const visited = new Set<string>();
  const pending = [entry];

  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    for (const specifier of runtimeImports(file)) {
      const dependency = resolveSourceImport(file, specifier);
      if (dependency?.startsWith(sourceRoot)) pending.push(dependency);
    }
  }

  return [...visited].map((file) => relative(projectRoot, file)).sort();
}

describe('graphe statique du runtime storefront', () => {
  it('ne charge aucun adaptateur Supabase ni runtime workspace', () => {
    const graph = collectStaticGraph(resolve(sourceRoot, 'app/surfaces/StorefrontRuntimeBoundary.tsx'));

    expect(graph).toContain('src/platform/runtime/storefront-browser-runtime.ts');
    expect(graph).not.toContain('src/platform/runtime/browser-runtime.ts');
    expect(graph.filter((file) => file.includes('/adapters/supabase/'))).toEqual([]);
  });
});
