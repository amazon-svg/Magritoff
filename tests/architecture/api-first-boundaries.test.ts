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

  it('garde la plateforme API et la composition serveur indépendantes des fournisseurs', () => {
    const protectedRoots = ['src/platform/api', 'src/server/api'];
    const violations = protectedRoots.flatMap((root) =>
      listTypeScriptFiles(resolve(process.cwd(), root)).flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        const importsForbidden = importedModules(source).filter(
          (dependency) =>
            /^react(?:\/|$)/.test(dependency) ||
            /^@supabase(?:\/|$)/.test(dependency) ||
            /utils\/supabase/.test(dependency) ||
            /database\.types/.test(dependency),
        );
        const providerCalls = /\bsupabase\s*\.|functions\/v1/.test(source);
        return [
          ...importsForbidden.map(
            (dependency) => `${relative(process.cwd(), file)} -> ${dependency}`,
          ),
          ...(providerCalls ? [`${relative(process.cwd(), file)} -> appel fournisseur`] : []),
        ];
      }),
    );

    expect(violations).toEqual([]);
  });

  it('interdit les lectures de bootstrap fournisseur dans les contexts React', () => {
    const protectedFiles = [
      'src/app/contexts/SessionBootstrapContext.tsx',
      'src/app/contexts/PreferencesContext.tsx',
      'src/app/contexts/TenantContext.tsx',
    ];
    const forbiddenReads = [
      /\.from\(['"](?:tenant_members|user_preferences)['"]\)/,
      /\.from\(['"]tenants['"]\)[\s\S]{0,80}\.select\(/,
    ];
    const violations = protectedFiles.filter((file) =>
      forbiddenReads.some((pattern) =>
        pattern.test(readFileSync(resolve(process.cwd(), file), 'utf8')),
      ),
    );

    expect(violations).toEqual([]);
  });

  it('conserve la RLS dans la composition Edge du bootstrap', () => {
    const edgeEntry = readFileSync(
      resolve(process.cwd(), 'supabase/functions/magrit-api/index.ts'),
      'utf8',
    );

    expect(edgeEntry).toContain("Deno.env.get('SUPABASE_ANON_KEY')");
    expect(edgeEntry).toContain('Authorization: authorization');
    expect(edgeEntry).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
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
