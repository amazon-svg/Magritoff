import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const scannedRoots = ['src', 'utils'];
const supabaseClientPattern = /(?:from\s+|import\s*\()['"](?:npm:)?@supabase\/supabase-js|\bcreateClient\s*\(/;

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.[cm]?[jt]sx?$/.test(path) ? [path] : [];
  });
}

function supabaseFiles(): string[] {
  return scannedRoots
    .flatMap((directory) => sourceFiles(resolve(root, directory)))
    .filter((file) => supabaseClientPattern.test(readFileSync(file, 'utf8')))
    .map((file) => relative(root, file))
    .sort();
}

describe('sortie Supabase — runtime applicatif', () => {
  it('interdit toute dependance au client Supabase dans src et utils', () => {
    expect(supabaseFiles()).toEqual([]);
  });
});
