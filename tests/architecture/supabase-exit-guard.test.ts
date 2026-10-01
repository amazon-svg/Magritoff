import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const scannedRoots = ['src', 'utils'];
const supabaseClientPattern = /(?:from\s+|import\s*\()['"](?:npm:)?@supabase\/supabase-js|\bcreateClient\s*\(/;

function filesRecursively(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory()
      ? filesRecursively(path)
      : [path];
  });
}

function sourceFiles(directory: string): string[] {
  return filesRecursively(directory).filter((path) => /\.[cm]?[jt]sx?$/.test(path));
}

function supabaseFiles(): string[] {
  return scannedRoots
    .flatMap((directory) => sourceFiles(resolve(root, directory)))
    .filter((file) => supabaseClientPattern.test(readFileSync(file, 'utf8')))
    .map((file) => relative(root, file))
    .sort();
}

function packageManifest(): {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
}

function activeAutomationFiles(): string[] {
  return [
    ...filesRecursively(resolve(root, 'scripts')).filter((file) => !file.includes('/scripts/bench/')),
    ...filesRecursively(resolve(root, '.github/workflows')),
  ].filter((file) => /\.(?:[cm]?[jt]sx?|sh|ya?ml)$/.test(file));
}

describe('sortie Supabase — runtime applicatif', () => {
  it('interdit toute dependance au client Supabase dans src et utils', () => {
    expect(supabaseFiles()).toEqual([]);
  });

  it('interdit le SDK, la CLI et leurs commandes dans le manifeste', () => {
    const manifest = packageManifest();
    const dependencies = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
    };
    expect(Object.keys(dependencies).filter((name) => name.startsWith('@supabase/'))).toEqual([]);
    expect(Object.entries(manifest.scripts ?? {}).filter(([, command]) => (
      /\b(?:pnpm\s+exec|npx|bunx)\s+supabase\b/.test(command)
    ))).toEqual([]);
    expect(readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8')).not.toMatch(/@supabase\/[^:\s]+@/);
  });

  it('interdit les secrets et endpoints Supabase dans les automatisations actives', () => {
    const forbidden = /\b(?:VITE_)?SUPABASE_(?:URL|ANON_KEY|SERVICE_ROLE_KEY)\b|https?:\/\/[^\s'"]+\.supabase\.co/i;
    const offenders = activeAutomationFiles()
      .filter((file) => forbidden.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file))
      .sort();
    expect(offenders).toEqual([]);
  });
});
