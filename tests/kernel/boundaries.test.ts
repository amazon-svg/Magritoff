import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const kernelRoot = resolve(process.cwd(), 'src/kernel');
const forbiddenImports = [
  /^react(?:\/|$)/,
  /^@supabase(?:\/|$)/,
  /^@\/app(?:\/|$)/,
  /^@\/server(?:\/|$)/,
  /^@\/schemas(?:\/|$)/,
  /^@\/types(?:\/|$)/,
];

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listTypeScriptFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('kernel dependency boundaries', () => {
  it('does not import UI, database, integration or business modules', () => {
    const violations: string[] = [];

    for (const file of listTypeScriptFiles(kernelRoot)) {
      const source = readFileSync(file, 'utf8');
      const imports = source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g);

      for (const match of imports) {
        const importedModule = match[2];
        if (forbiddenImports.some((pattern) => pattern.test(importedModule))) {
          violations.push(`${relative(kernelRoot, file)} -> ${importedModule}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
