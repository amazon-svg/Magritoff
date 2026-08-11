import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  legacyDirectEdgeUrlLimits,
  legacySupabaseUiImportFiles,
  legacySupabaseUiReferenceLimits,
} from './supabase-ui-baseline';

type Rule = Readonly<{
  root: string;
  forbidden: readonly RegExp[];
}>;

const rules: readonly Rule[] = [
  {
    root: 'src/modules/access-management/domain',
    forbidden: [
      /^react(?:\/|$)/,
      /^@supabase(?:\/|$)/,
      /\/platform(?:\/|$)/,
      /\/application(?:\/|$)/,
      /\/infrastructure(?:\/|$)/,
      /\/ui(?:\/|$)/,
    ],
  },
  {
    root: 'src/modules/access-management/application',
    forbidden: [
      /^react(?:\/|$)/,
      /^@supabase(?:\/|$)/,
      /\/infrastructure(?:\/|$)/,
      /\/ui(?:\/|$)/,
    ],
  },
  {
    root: 'src/modules/access-management/api',
    forbidden: [
      /^react(?:\/|$)/,
      /^@supabase(?:\/|$)/,
      /\/infrastructure(?:\/|$)/,
      /\/ui(?:\/|$)/,
    ],
  },
  {
    root: 'src/platform/access',
    forbidden: [/^react(?:\/|$)/, /^@supabase(?:\/|$)/, /\/modules\//],
  },
  {
    root: 'src/platform/audit',
    forbidden: [/^react(?:\/|$)/, /^@supabase(?:\/|$)/, /\/modules\//],
  },
  {
    root: 'src/platform/entitlements',
    forbidden: [/^react(?:\/|$)/, /^@supabase(?:\/|$)/, /\/modules\//],
  },
  {
    root: 'src/platform/identity',
    forbidden: [/^react(?:\/|$)/, /^@supabase(?:\/|$)/, /\/modules\//],
  },
  {
    root: 'src/platform/tenant',
    forbidden: [/^react(?:\/|$)/, /^@supabase(?:\/|$)/, /\/modules\//],
  },
  {
    root: 'src/modules/clariprint-data/domain',
    forbidden: [
      /^react(?:\/|$)/,
      /^@supabase(?:\/|$)/,
      /\/platform(?:\/|$)/,
      /\/application(?:\/|$)/,
      /\/infrastructure(?:\/|$)/,
      /\/ui(?:\/|$)/,
    ],
  },
  {
    root: 'src/modules/clariprint-data/api',
    forbidden: [
      /^react(?:\/|$)/,
      /^@supabase(?:\/|$)/,
      /\/infrastructure(?:\/|$)/,
      /\/ui(?:\/|$)/,
      /access-management\/(?:application|domain|infrastructure|ui)/,
    ],
  },
  {
    root: 'src/modules/clariprint-data/application',
    forbidden: [
      /^react(?:\/|$)/,
      /^@supabase(?:\/|$)/,
      /\/infrastructure(?:\/|$)/,
      /\/ui(?:\/|$)/,
      /access-management\/(?:application|domain|infrastructure|ui)/,
    ],
  },
  {
    root: 'src/modules/clariprint-data/ui',
    forbidden: [
      /^@supabase(?:\/|$)/,
      /utils\/supabase/,
      /\/infrastructure(?:\/|$)/,
      /\/server(?:\/|$)/,
      /access-management\/(?:application|domain|infrastructure|ui)/,
    ],
  },
];

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

describe('modular dependency boundaries', () => {
  it('keeps platform and Clariprint Data core independent from adapters', () => {
    const violations: string[] = [];

    for (const rule of rules) {
      const absoluteRoot = resolve(process.cwd(), rule.root);
      for (const file of listTypeScriptFiles(absoluteRoot)) {
        const source = readFileSync(file, 'utf8');
        const imports = source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g);

        for (const match of imports) {
          const importedModule = match[2];
          if (rule.forbidden.some((pattern) => pattern.test(importedModule))) {
            violations.push(`${relative(process.cwd(), file)} -> ${importedModule}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps the Clariprint Data UI independent from transports and providers', () => {
    const uiRoot = resolve(process.cwd(), 'src/modules/clariprint-data/ui');
    const violations = listTypeScriptFiles(uiRoot)
      .filter((file) => /\bsupabase\s*\.|\.(?:from|rpc)\s*\(/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(process.cwd(), file));

    expect(violations).toEqual([]);
  });

  it('prevents new direct Supabase dependencies in the brownfield UI', () => {
    const appRoot = resolve(process.cwd(), 'src/app');
    const violations: string[] = [];

    for (const file of listTypeScriptFiles(appRoot)) {
      const source = readFileSync(file, 'utf8');
      const path = relative(process.cwd(), file);
      const importsSupabase = /from\s+['"](?:@supabase|\/?utils\/supabase)/.test(source);
      if (importsSupabase && !legacySupabaseUiImportFiles.has(path)) {
        violations.push(`${path} -> nouvelle dépendance Supabase`);
      }

      const references = source.match(/\bsupabase\s*\./g)?.length ?? 0;
      const allowedReferences = legacySupabaseUiReferenceLimits.get(path) ?? 0;
      if (references > allowedReferences) {
        violations.push(`${path} -> ${references} références (baseline ${allowedReferences})`);
      }

      const directEdgeUrls = source.match(/functions\/v1/g)?.length ?? 0;
      const allowedDirectEdgeUrls = legacyDirectEdgeUrlLimits.get(path) ?? 0;
      if (directEdgeUrls > allowedDirectEdgeUrls) {
        violations.push(
          `${path} -> ${directEdgeUrls} URL Edge directes (baseline ${allowedDirectEdgeUrls})`,
        );
      }
    }

    expect(violations).toEqual([]);
  });
});
