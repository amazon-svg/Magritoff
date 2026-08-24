import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_COMPONENTS_BROWNFIELD_BASELINE,
  SHARED_UI_PRIMITIVE_BASELINE,
} from './modular-ui-baseline';

function listSourceFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((entry) => {
    const path = resolve(root, entry);
    return statSync(path).isDirectory()
      ? listSourceFiles(path)
      : /\.[cm]?[jt]sx?$/.test(path) ? [path] : [];
  });
}

function imports(source: string): string[] {
  return Array.from(
    source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g),
    (match) => match[2],
  );
}

describe('frontières de l UX modulaire MUX0-MUX6', () => {
  const sourceRoot = resolve(process.cwd(), 'src');
  const modulesRoot = resolve(sourceRoot, 'modules');
  const moduleUiFiles = listSourceFiles(modulesRoot).filter((file) =>
    relative(modulesRoot, file).split('/').includes('ui'),
  );

  it('place le design system dans une racine partagée neutre', () => {
    const sharedUiRoot = resolve(sourceRoot, 'shared/ui');
    const files = listSourceFiles(sharedUiRoot);
    expect(files).toHaveLength(SHARED_UI_PRIMITIVE_BASELINE);
    expect(existsSync(resolve(sourceRoot, 'app/components/ui'))).toBe(false);

    const violations = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return imports(source)
        .filter((dependency) => /(?:^|\/)(?:app|modules|adapters)(?:\/|$)/.test(dependency))
        .map((dependency) => `${relative(sourceRoot, file)} -> ${dependency}`);
    });
    expect(violations).toEqual([]);
  });

  it('interdit aux UI de module de dépendre de app ou des fournisseurs', () => {
    const forbidden = [
      /(?:^|\/)app(?:\/|$)/,
      /(?:^|\/)adapters(?:\/|$)/,
      /^@supabase(?:\/|$)/,
      /utils\/supabase/,
    ];
    const violations = moduleUiFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const forbiddenImports = imports(source)
        .filter((dependency) => forbidden.some((pattern) => pattern.test(dependency)))
        .map((dependency) => `${relative(sourceRoot, file)} -> ${dependency}`);
      return /\bsupabase\s*\.|functions\/v1/.test(source)
        ? [...forbiddenImports, `${relative(sourceRoot, file)} -> appel fournisseur`]
        : forbiddenImports;
    });
    expect(violations).toEqual([]);
  });

  it('autorise uniquement les entrées publiques pour les imports inter-modules', () => {
    const violations = moduleUiFiles.flatMap((file) => {
      const owner = relative(modulesRoot, file).split('/')[0];
      return imports(readFileSync(file, 'utf8')).flatMap((dependency) => {
        const target = dependency.startsWith('@/modules/')
          ? resolve(sourceRoot, dependency.slice(2))
          : dependency.startsWith('.')
            ? resolve(dirname(file), dependency)
            : null;
        if (!target) return [];
        const targetRelative = relative(modulesRoot, target);
        if (targetRelative.startsWith('..')) return [];
        const [targetModule, ...targetPath] = targetRelative.split('/');
        if (!targetModule || targetModule === owner) return [];
        const uiRootEntry = resolve(modulesRoot, targetModule, 'ui/index.ts');
        const explicitlyPublishedLeaf = targetPath.length > 2
          && targetPath[0] === 'ui'
          && existsSync(uiRootEntry)
          && readFileSync(uiRootEntry, 'utf8').includes(`from './${targetPath.slice(1).join('/')}'`);
        const publicEntry = targetPath.length === 0
          || (targetPath.length === 1 && targetPath[0] === 'ui')
          || (targetPath.length === 2 && targetPath[0] === 'ui'
            && existsSync(resolve(modulesRoot, targetModule, ...targetPath, 'index.ts')))
          || explicitlyPublishedLeaf;
        return publicEntry
          ? []
          : [`${relative(sourceRoot, file)} -> ${dependency}`];
      });
    });
    expect(violations).toEqual([]);
  });

  it('garde le port React runtime neutre et la composition dans app', () => {
    const runtime = readFileSync(
      resolve(sourceRoot, 'platform/runtime/workspace-ui-runtime.tsx'),
      'utf8',
    );
    const bridge = readFileSync(
      resolve(sourceRoot, 'app/surfaces/WorkspaceModuleUiBridge.tsx'),
      'utf8',
    );
    expect(runtime).not.toMatch(/(?:^|\/)modules(?:\/|$)/);
    expect(runtime).not.toMatch(/(?:^|\/)app(?:\/|$)/);
    expect(runtime).not.toContain('@supabase');
    expect(runtime).toContain('FetchApiClient');
    expect(bridge).toContain('WorkspaceUiRuntimeProvider');
    expect(bridge).toContain('useAuth');
    expect(bridge).toContain('useTenant');
    expect(bridge).toContain('useApiRuntime');
  });

  it('impose une entrée publique à chaque module qui publie une UX', () => {
    const modulesWithUi = new Set(moduleUiFiles.map((file) =>
      relative(modulesRoot, file).split('/')[0],
    ));
    const missing = [...modulesWithUi].filter((moduleId) =>
      !existsSync(resolve(modulesRoot, moduleId, 'ui/index.ts')),
    );
    expect(missing).toEqual([]);
  });

  it('charge le pilote Members depuis son entrée UI publique et en lazy', () => {
    const runtime = readFileSync(
      resolve(sourceRoot, 'app/surfaces/workspaceRuntimeRoutes.tsx'),
      'utf8',
    );
    expect(runtime).toContain("import('@/modules/members/ui')");
    expect(runtime).toContain('default: module.MembersPage');
    expect(runtime).toContain('Component: lazy(loader)');
    expect(runtime).not.toContain('components/dashboard/DashboardUsers');
  });

  it('fige une baseline décroissante des composants métier encore dans app', () => {
    const files = listSourceFiles(resolve(sourceRoot, 'app/components'));
    expect(files).toHaveLength(APP_COMPONENTS_BROWNFIELD_BASELINE);
  });
});
