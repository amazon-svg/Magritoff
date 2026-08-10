import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Rule = Readonly<{
  root: string;
  forbidden: readonly RegExp[];
}>;

const rules: readonly Rule[] = [
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
    root: 'src/modules/clariprint-data/application',
    forbidden: [
      /^react(?:\/|$)/,
      /^@supabase(?:\/|$)/,
      /\/infrastructure(?:\/|$)/,
      /\/ui(?:\/|$)/,
    ],
  },
];

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listTypeScriptFiles(path) : path.endsWith('.ts') ? [path] : [];
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
});
