import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const sourceRoot = resolve(root, 'src');

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.[cm]?[jt]sx?$/.test(path) ? [path] : [];
  });
}

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('frontières API-first après migration MUX', () => {
  const moduleUiFiles = sourceFiles(resolve(sourceRoot, 'modules'))
    .filter((file) => relative(resolve(sourceRoot, 'modules'), file).split('/').includes('ui'));

  it('charge les écrans workspace depuis les entrées UI publiques et en lazy', () => {
    const routes = read('src/app/surfaces/workspaceRuntimeRoutes.tsx');
    expect(routes).toContain("import('@/modules/account/ui')");
    expect(routes).toContain("import('@/modules/orders/ui')");
    expect(routes).toContain("import('@/modules/members/ui')");
    expect(routes).toContain('Component: lazy(loader)');
    expect(routes).not.toContain('app/components');
  });

  it('ne laisse aucun composant métier dans app/components', () => {
    expect(sourceFiles(resolve(sourceRoot, 'app/components'))).toEqual([]);
  });

  it('compose l identité workspace et le transport dans les frontières app', () => {
    const workspace = read('src/app/surfaces/WorkspaceRuntimeBoundary.tsx');
    const bridge = read('src/app/surfaces/WorkspaceModuleUiBridge.tsx');
    expect(workspace).toContain('<AuthProvider');
    expect(workspace).toContain('<ApiRuntimeProvider>');
    expect(bridge).toContain('<WorkspaceUiRuntimeProvider');
    expect(bridge).toContain('useApiRuntime');
    expect(bridge).toContain('useTenant');
  });

  it('compose un transport storefront anonyme isolé du workspace', () => {
    const boundary = read('src/app/surfaces/StorefrontRuntimeBoundary.tsx');
    expect(boundary).toContain("new FetchApiClient('', globalThis.fetch)");
    expect(boundary).toContain('<StorefrontUiRuntimeProvider');
    expect(boundary).toContain('storefrontBrowserRuntime');
    expect(boundary).not.toContain('AuthProvider');
    expect(boundary).not.toContain('ApiRuntimeProvider');
  });

  it('ne construit aucun transport HTTP dans les UI de module', () => {
    const violations = moduleUiFiles
      .filter((file) => readFileSync(file, 'utf8').includes('new FetchApiClient'))
      .map((file) => relative(sourceRoot, file));
    expect(violations).toEqual([]);
  });

  it('résout les clients workspace par le port runtime neutre', () => {
    const runtime = read('src/platform/runtime/workspace-ui-runtime.tsx');
    expect(runtime).toContain('useWorkspaceApi');
    expect(runtime).toContain('new Client(apiClient)');
    expect(runtime).not.toContain('@/app/');
    expect(runtime).not.toContain('@/modules/');
  });

  it('résout les clients storefront par un port runtime distinct', () => {
    const runtime = read('src/platform/runtime/storefront-ui-runtime.tsx');
    expect(runtime).toContain('useStorefrontApi');
    expect(runtime).toContain('new Client(apiClient)');
    expect(runtime).not.toContain('@/app/');
    expect(runtime).not.toContain('@/modules/');
  });

  it('fait passer les hooks métier workspace par les clients de module', () => {
    const samples = [
      ['src/modules/tenants/ui/hooks/useTenantSettingsForm.ts', 'useWorkspaceApi(SessionApiClient)'],
      ['src/modules/orders/ui/hooks/useDashboardOrderManagement.ts', 'useWorkspaceApi(OrdersApiClient)'],
      ['src/modules/roles/ui/hooks/useRoleCatalogManagement.ts', 'useWorkspaceApi(RolesApiClient)'],
      ['src/modules/shops/ui/runtime/ShopsContext.tsx', 'useWorkspaceApi(ShopsApiClient)'],
      ['src/modules/libraries/ui/runtime/LibraryContext.tsx', 'useWorkspaceApi(LibrariesApiClient)'],
    ] as const;
    for (const [file, contract] of samples) expect(read(file), file).toContain(contract);
  });

  it('fait passer les parcours boutique par les clients storefront', () => {
    const samples = [
      ['src/modules/shops/ui/hooks/usePublicShopCatalog.ts', 'useStorefrontApi(ShopsApiClient)'],
      ['src/modules/orders/ui/hooks/useStorefrontOrderLifecycle.ts', 'useStorefrontApi(OrdersApiClient)'],
      ['src/modules/catalog/ui/hooks/useStorefrontCategoryEditorial.ts', 'useStorefrontApi(DiagnosticsApiClient)'],
      ['src/modules/shop-customers/ui/hooks/useStorefrontSession.ts', 'useStorefrontApi(StorefrontIdentityApiClient)'],
    ] as const;
    for (const [file, contract] of samples) expect(read(file), file).toContain(contract);
  });

  it('supprime les anciens registres de clients et services app', () => {
    for (const file of [
      'BrowserServicesContext.tsx', 'ModuleClientsContext.tsx',
      'StorefrontApiRuntimeContext.tsx', 'StorefrontBrowserServicesContext.tsx',
      'StorefrontModuleClientsContext.tsx',
    ]) {
      expect(existsSync(resolve(sourceRoot, 'app/contexts', file)), file).toBe(false);
    }
  });

  it('interdit aux UI métier de revenir vers app ou les adaptateurs', () => {
    const violations = moduleUiFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return Array.from(source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g), (match) => match[2])
        .filter((dependency) => dependency.includes('/app/') || dependency.includes('/adapters/'))
        .map((dependency) => `${relative(sourceRoot, file)} -> ${dependency}`);
    });
    expect(violations).toEqual([]);
  });
});
