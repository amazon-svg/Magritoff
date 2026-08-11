import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  legacyDirectEdgeUrlLimits,
  legacySupabaseUiImportFiles,
  legacySupabaseUiReferenceLimits,
} from './supabase-ui-baseline';

function listTypeScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? listTypeScriptFiles(path)
      : /\.tsx?$/.test(path)
        ? [path]
        : [];
  });
}

function importedModules(source: string): string[] {
  return Array.from(source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g), (match) => match[2]);
}

describe('frontières API-first et modulaires', () => {
  it('garde le kernel indépendant de React, des fournisseurs et du métier', () => {
    const kernelRoot = resolve(process.cwd(), 'src/kernel');
    const forbidden = [
      /^react(?:\/|$)/,
      /^@supabase(?:\/|$)/,
      /utils\/supabase/,
      /\/app(?:\/|$)/,
      /\/modules(?:\/|$)/,
      /\/platform(?:\/|$)/,
      /\/server(?:\/|$)/,
    ];
    const violations = listTypeScriptFiles(kernelRoot).flatMap((file) =>
      importedModules(readFileSync(file, 'utf8'))
        .filter((dependency) => forbidden.some((pattern) => pattern.test(dependency)))
        .map((dependency) => `${relative(process.cwd(), file)} -> ${dependency}`),
    );

    expect(violations).toEqual([]);
  });

  it('interdit les fournisseurs dans le coeur et les UI des nouveaux modules', () => {
    const modulesRoot = resolve(process.cwd(), 'src/modules');
    const protectedSegments = new Set(['domain', 'application', 'api', 'ui']);
    const violations = listTypeScriptFiles(modulesRoot).flatMap((file) => {
      const segments = relative(modulesRoot, file).split('/');
      if (!segments.some((segment) => protectedSegments.has(segment))) return [];

      const source = readFileSync(file, 'utf8');
      const importsProvider = importedModules(source).some(
        (dependency) => /^@supabase(?:\/|$)/.test(dependency) || /utils\/supabase/.test(dependency),
      );
      const callsProvider = /\bsupabase\s*\.|functions\/v1/.test(source);
      return importsProvider || callsProvider ? [relative(process.cwd(), file)] : [];
    });

    expect(violations).toEqual([]);
  });

  it('empêche toute nouvelle dépendance Supabase dans le front brownfield', () => {
    const appRoot = resolve(process.cwd(), 'src/app');
    const violations: string[] = [];
    const actualImportFiles = new Set<string>();

    for (const file of listTypeScriptFiles(appRoot)) {
      const source = readFileSync(file, 'utf8');
      const path = relative(process.cwd(), file);
      const importsSupabase = importedModules(source).some(
        (dependency) => /^@supabase(?:\/|$)/.test(dependency) || /^\/?utils\/supabase/.test(dependency),
      );
      if (importsSupabase) actualImportFiles.add(path);
      if (importsSupabase && !legacySupabaseUiImportFiles.has(path)) {
        violations.push(`${path} -> nouvelle dépendance Supabase`);
      }

      const references = source.match(/\bsupabase\s*\./g)?.length ?? 0;
      const allowedReferences = legacySupabaseUiReferenceLimits.get(path) ?? 0;
      if (references !== allowedReferences) {
        violations.push(`${path} -> ${references} références (baseline ${allowedReferences})`);
      }

      const directEdgeUrls = source.match(/functions\/v1/g)?.length ?? 0;
      const allowedDirectEdgeUrls = legacyDirectEdgeUrlLimits.get(path) ?? 0;
      if (directEdgeUrls !== allowedDirectEdgeUrls) {
        violations.push(`${path} -> ${directEdgeUrls} URL Edge directes (baseline ${allowedDirectEdgeUrls})`);
      }
    }

    const missingFromSource = Array.from(legacySupabaseUiImportFiles)
      .filter((path) => !actualImportFiles.has(path))
      .map((path) => `${path} -> entrée baseline à retirer`);
    violations.push(...missingFromSource);

    expect(violations).toEqual([]);
  });
});
