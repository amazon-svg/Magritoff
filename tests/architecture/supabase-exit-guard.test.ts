import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const scannedRoots = ['src', 'utils', 'supabase/functions'];
const transitionalSupabaseFileLimit = 70;
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

describe('sortie Supabase — baseline decroissante', () => {
  it('interdit toute nouvelle dependance Supabase hors des frontieres de transition', () => {
    const violations = supabaseFiles().filter((file) => !(
      file.startsWith('src/adapters/supabase/')
      || /^src\/server\/api\/[a-z0-9-]+-composition\.ts$/.test(file)
      || file.startsWith('supabase/functions/')
      || file.startsWith('utils/supabase/')
    ));

    expect(violations).toEqual([]);
  });

  it('fige un compteur qui ne peut que diminuer', () => {
    expect(supabaseFiles().length).toBeLessThanOrEqual(transitionalSupabaseFileLimit);
  });
});
