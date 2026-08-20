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

  it('garde les manifestes et contributions de surfaces indépendants de React', () => {
    const protectedRoots = [
      'src/surfaces/registry',
      'src/surfaces/application-registry.ts',
      'src/modules/account/manifest.ts',
      'src/modules/account/surface-contributions.ts',
      'src/modules/orders/manifest.ts',
      'src/modules/orders/surface-contributions.ts',
      'src/modules/shops/manifest.ts',
      'src/modules/shops/surface-contributions.ts',
      'src/modules/quotes/manifest.ts',
      'src/modules/quotes/surface-contributions.ts',
      'src/modules/quote-templates/manifest.ts',
      'src/modules/quote-templates/surface-contributions.ts',
      'src/modules/libraries/manifest.ts',
      'src/modules/libraries/surface-contributions.ts',
      'src/modules/catalog/manifest.ts',
      'src/modules/catalog/surface-contributions.ts',
      'src/modules/commercial/manifest.ts',
      'src/modules/commercial/surface-contributions.ts',
      'src/modules/members/manifest.ts',
      'src/modules/members/surface-contributions.ts',
      'src/modules/tenants/manifest.ts',
      'src/modules/tenants/surface-contributions.ts',
      'src/modules/roles/manifest.ts',
      'src/modules/roles/surface-contributions.ts',
      'src/modules/conversations/manifest.ts',
      'src/modules/conversations/surface-contributions.ts',
      'src/modules/machine-parks/manifest.ts',
      'src/modules/machine-parks/surface-contributions.ts',
      'src/modules/mockups/manifest.ts',
      'src/modules/mockups/surface-contributions.ts',
      'src/modules/plans/manifest.ts',
      'src/modules/plans/surface-contributions.ts',
    ];
    const violations = protectedRoots.flatMap((root) => {
      const path = resolve(process.cwd(), root);
      const files = statSync(path).isDirectory() ? listTypeScriptFiles(path) : [path];
      return files.flatMap((file) =>
        importedModules(readFileSync(file, 'utf8'))
          .filter((dependency) => /^react(?:-router)?(?:\/|$)/.test(dependency) || /^lucide-react$/.test(dependency))
          .map((dependency) => `${relative(process.cwd(), file)} -> ${dependency}`),
      );
    });

    expect(violations).toEqual([]);
  });

  it('conserve le chargement lazy de l écran workspace témoin', () => {
    const routes = readFileSync(resolve(process.cwd(), 'src/app/routes.tsx'), 'utf8');
    const runtime = readFileSync(
      resolve(process.cwd(), 'src/app/surfaces/workspaceRuntimeRoutes.tsx'),
      'utf8',
    );

    expect(routes).not.toContain('const DashboardAccount = lazy');
    expect(routes).not.toContain('const DashboardOrders = lazy');
    expect(routes).not.toContain('const DashboardShops = lazy');
    expect(routes).not.toContain('const DashboardShopEditor = lazy');
    expect(routes).not.toContain('const DashboardQuotes = lazy');
    expect(routes).not.toContain('const DashboardQuotesPending = lazy');
    expect(routes).not.toContain('const DashboardQuoteEditor = lazy');
    expect(routes).not.toContain('const DashboardQuoteTemplates = lazy');
    expect(routes).not.toContain('const DashboardLibraries = lazy');
    expect(routes).not.toContain('const DashboardLibraryDetail = lazy');
    expect(routes).not.toContain('const DashboardTenantGammes = lazy');
    expect(routes).not.toContain('const DashboardAdminPIM = lazy');
    expect(routes).not.toContain('const DashboardCommercial = lazy');
    expect(routes).not.toContain('const DashboardUsers = lazy');
    expect(routes).not.toContain('const DashboardTenantSettings = lazy');
    expect(routes).not.toContain('const DashboardTenantSpaces = lazy');
    expect(routes).not.toContain('const OrderRoleAdminPage = lazy');
    expect(routes).not.toContain('const DashboardHistory = lazy');
    expect(routes).not.toContain('const DashboardMachines = lazy');
    expect(routes).not.toContain('const MachineParkDetail = lazy');
    expect(routes).not.toContain('const DashboardAdminMockups = lazy');
    expect(routes).not.toContain('const DashboardPlan = lazy');
    expect(routes).toContain('workspaceRuntimeRoutes.map');
    expect(runtime).toContain("import('../components/dashboard/DashboardAccount')");
    expect(runtime).toContain("import('../components/dashboard/DashboardOrders')");
    expect(runtime).toContain("import('../components/dashboard/DashboardShops')");
    expect(runtime).toContain("import('../components/dashboard/DashboardShopEditor')");
    expect(runtime).toContain("import('../components/dashboard/DashboardQuotes')");
    expect(runtime).toContain("import('../components/dashboard/DashboardQuotesPending')");
    expect(runtime).toContain("import('../components/dashboard/DashboardQuoteEditor')");
    expect(runtime).toContain("import('../components/dashboard/DashboardQuoteTemplates')");
    expect(runtime).toContain("import('../components/dashboard/DashboardLibraries')");
    expect(runtime).toContain("import('../components/dashboard/DashboardLibraryDetail')");
    expect(runtime).toContain("import('../components/dashboard/DashboardTenantGammes')");
    expect(runtime).toContain("import('../components/dashboard/DashboardAdminPIM')");
    expect(runtime).toContain("import('../components/dashboard/commercial/DashboardCommercial')");
    expect(runtime).toContain("import('../components/dashboard/DashboardUsers')");
    expect(runtime).toContain("import('../components/dashboard/DashboardTenantSettings')");
    expect(runtime).toContain("import('../components/dashboard/DashboardTenantSpaces')");
    expect(runtime).toContain("import('../components/dashboard/OrderRoleAdminPage')");
    expect(runtime).toContain("import('../components/dashboard/DashboardHistory')");
    expect(runtime).toContain("import('../components/dashboard/machines/DashboardMachines')");
    expect(runtime).toContain("import('../components/dashboard/machines/MachineParkWizard')");
    expect(runtime).toContain("import('../components/dashboard/machines/MachineParkDetail')");
    expect(runtime).toContain("import('../components/dashboard/DashboardAdminMockups')");
    expect(runtime).toContain("import('../components/dashboard/DashboardPlan')");
    expect(runtime).toContain('Component: lazy(loader)');
  });

  it('compose la sidebar workspace depuis les contributions enregistrées', () => {
    const layout = readFileSync(
      resolve(process.cwd(), 'src/app/components/dashboard/DashboardLayout.tsx'),
      'utf8',
    );

    expect(layout).toContain('workspaceSurface.navigation');
    expect(layout).toContain('composeWorkspaceGroups');
    expect(layout).toContain('WORKSPACE_ICONS[item.iconId]');
    expect(layout).not.toMatch(/const [A-Z_]+_NAVIGATION =/);
    expect(layout).not.toContain("label: 'Devis'");
    expect(layout).not.toContain("label: 'Parc machine'");
  });

  it('compose les chemins du portail depuis les routes host déclarées', () => {
    const routes = readFileSync(resolve(process.cwd(), 'src/app/routes.tsx'), 'utf8');
    const portalRoutes = readFileSync(
      resolve(process.cwd(), 'src/app/components/shop/portal/shopPortalRoutes.ts'),
      'utf8',
    );

    expect(routes).toContain('portalRuntimePaths.shopRoot');
    expect(routes).not.toContain('{ path: "/shop/:slug/*"');
    expect(routes).toContain('`/${portalRuntimePaths.shopRoot}/activate`');
    expect(routes).toContain('`/${portalRuntimePaths.shopRoot}/reset-password`');
    expect(routes).not.toContain('portalRuntimePaths.shopRoot}/:slug');
    expect(portalRoutes).toContain('portalRuntimePaths.checkout');
    expect(portalRoutes).toContain('portalRuntimePaths.orderConfirmation');
    expect(portalRoutes).toContain('portalRuntimePaths.catalog');
    expect(portalRoutes).toContain('portalRuntimePaths.gamme');
    expect(portalRoutes).toContain('portalRuntimePaths.product');
    expect(portalRoutes).toContain('ACCOUNT_PATHS.orders');
    expect(portalRoutes).not.toContain("return 'account/orders'");
    expect(portalRoutes).not.toContain("return 'thank-you'");
    expect(portalRoutes).not.toContain('`p/${param}`');
    expect(portalRoutes).not.toContain('`g/${param}`');
  });

  it('sépare la vue Account des adaptateurs brownfield', () => {
    const view = resolve(
      process.cwd(),
      'src/app/surfaces/account/AccountSettingsView.tsx',
    );
    const dependencies = importedModules(readFileSync(view, 'utf8'));

    expect(
      dependencies.filter(
        (dependency) => /contexts|supabase|platform\/api/.test(dependency),
      ),
    ).toEqual([]);
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

  it('interdit tout adaptateur concret dans l UI', () => {
    const appRoot = resolve(process.cwd(), 'src/app');
    const imports = listTypeScriptFiles(appRoot).flatMap((file) =>
      importedModules(readFileSync(file, 'utf8'))
        .filter((dependency) => /adapters\/(?:supabase|http)/.test(dependency))
        .map((dependency) => `${relative(process.cwd(), file)} -> ${dependency}`),
    );

    expect(imports).toEqual([]);
  });

  it('centralise les transports API par surface', () => {
    const contextsRoot = resolve(process.cwd(), 'src/app/contexts');
    const runtime = readFileSync(resolve(contextsRoot, 'ApiRuntimeContext.tsx'), 'utf8');
    const violations = listTypeScriptFiles(contextsRoot)
      .filter((file) => !file.endsWith('/ApiRuntimeContext.tsx'))
      .filter((file) => !file.endsWith('/StorefrontApiRuntimeContext.tsx'))
      .filter((file) => readFileSync(file, 'utf8').includes('new FetchApiClient'))
      .map((file) => relative(process.cwd(), file));

    expect(runtime).toContain("new FetchApiClient('', globalThis.fetch");
    expect(violations).toEqual([]);
  });

  it('centralise le transport API de la surface workspace', () => {
    const workspaceRoots = [
      resolve(process.cwd(), 'src/app/components/dashboard'),
      resolve(process.cwd(), 'src/app/hooks'),
      resolve(process.cwd(), 'src/app/components/DiagnosticPanel.tsx'),
    ];
    const files = workspaceRoots.flatMap((root) =>
      statSync(root).isDirectory() ? listTypeScriptFiles(root) : [root],
    );
    const directTransports = files
      .filter((file) => readFileSync(file, 'utf8').includes('new FetchApiClient'))
      .map((file) => relative(process.cwd(), file));

    expect(directTransports).toEqual([]);
  });

  it('réserve toute construction du transport au runtime API', () => {
    const directTransports = listTypeScriptFiles(resolve(process.cwd(), 'src/app'))
      .filter((file) => readFileSync(file, 'utf8').includes('new FetchApiClient'))
      .map((file) => relative(process.cwd(), file));

    expect(directTransports).toEqual([
      'src/app/contexts/ApiRuntimeContext.tsx',
      'src/app/contexts/StorefrontApiRuntimeContext.tsx',
    ]);
  });

  it('réserve toute composition de client API aux deux composition roots', () => {
    const constructors = listTypeScriptFiles(resolve(process.cwd(), 'src/app'))
      .filter((file) => /\bnew\s+[A-Za-z][A-Za-z0-9]*ApiClient\s*\(/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(process.cwd(), file));

    expect(constructors).toEqual([
      'src/app/contexts/ApiRuntimeContext.tsx',
      'src/app/contexts/ModuleClientsContext.tsx',
      'src/app/contexts/StorefrontApiRuntimeContext.tsx',
      'src/app/contexts/StorefrontModuleClientsContext.tsx',
    ]);
  });

  it('compose les façades Orders workspace et storefront dans deux roots', () => {
    const appRoot = resolve(process.cwd(), 'src/app');
    const constructors = listTypeScriptFiles(appRoot)
      .filter((file) => readFileSync(file, 'utf8').includes('new OrdersApiClient'))
      .map((file) => relative(process.cwd(), file));
    const workspaceBoundary = readFileSync(resolve(appRoot, 'surfaces/WorkspaceRuntimeBoundary.tsx'), 'utf8');
    const storefrontBoundary = readFileSync(resolve(appRoot, 'surfaces/StorefrontRuntimeBoundary.tsx'), 'utf8');

    expect(constructors).toEqual([
      'src/app/contexts/ModuleClientsContext.tsx',
      'src/app/contexts/StorefrontModuleClientsContext.tsx',
    ]);
    expect(workspaceBoundary).toContain('<ModuleClientsProvider>');
    expect(storefrontBoundary).toContain('<StorefrontModuleClientsProvider>');
  });

  it('compose les façades Shops workspace et storefront dans deux roots', () => {
    const appRoot = resolve(process.cwd(), 'src/app');
    const constructors = listTypeScriptFiles(appRoot)
      .filter((file) => readFileSync(file, 'utf8').includes('new ShopsApiClient'))
      .map((file) => relative(process.cwd(), file));
    expect(constructors).toEqual([
      'src/app/contexts/ModuleClientsContext.tsx',
      'src/app/contexts/StorefrontModuleClientsContext.tsx',
    ]);
  });

  it('compose les façades Quotes et QuoteTemplates dans un seul root', () => {
    const appRoot = resolve(process.cwd(), 'src/app');
    const appFiles = listTypeScriptFiles(appRoot);
    const quoteConstructors = appFiles
      .filter((file) => readFileSync(file, 'utf8').includes('new QuotesApiClient'))
      .map((file) => relative(process.cwd(), file));
    const templateConstructors = appFiles
      .filter((file) => readFileSync(file, 'utf8').includes('new QuoteTemplatesApiClient'))
      .map((file) => relative(process.cwd(), file));

    expect(quoteConstructors).toEqual(['src/app/contexts/ModuleClientsContext.tsx']);
    expect(templateConstructors).toEqual(['src/app/contexts/ModuleClientsContext.tsx']);
  });

  it('compose une seule façade Catalog pour les écrans PIM et gammes', () => {
    const appRoot = resolve(process.cwd(), 'src/app');
    const constructors = listTypeScriptFiles(appRoot)
      .filter((file) => readFileSync(file, 'utf8').includes('new CatalogApiClient'))
      .map((file) => relative(process.cwd(), file));

    expect(constructors).toEqual(['src/app/contexts/ModuleClientsContext.tsx']);
  });

  it('compose les façades Libraries et LibraryProducts dans un seul root', () => {
    const appRoot = resolve(process.cwd(), 'src/app');
    const appFiles = listTypeScriptFiles(appRoot);
    const libraryConstructors = appFiles
      .filter((file) => readFileSync(file, 'utf8').includes('new LibrariesApiClient'))
      .map((file) => relative(process.cwd(), file));
    const productConstructors = appFiles
      .filter((file) => readFileSync(file, 'utf8').includes('new LibraryProductsApiClient'))
      .map((file) => relative(process.cwd(), file));

    expect(libraryConstructors).toEqual(['src/app/contexts/ModuleClientsContext.tsx']);
    expect(productConstructors).toEqual(['src/app/contexts/ModuleClientsContext.tsx']);
  });

  it('compose les dernières façades hors identité dans un seul root', () => {
    const appRoot = resolve(process.cwd(), 'src/app');
    const appFiles = listTypeScriptFiles(appRoot);
    const constructorsFor = (client: string) => appFiles
      .filter((file) => readFileSync(file, 'utf8').includes(`new ${client}`))
      .map((file) => relative(process.cwd(), file));

    expect(constructorsFor('ConversationsApiClient')).toEqual(['src/app/contexts/ModuleClientsContext.tsx']);
    expect(constructorsFor('CommercialApiClient')).toEqual(['src/app/contexts/ModuleClientsContext.tsx']);
    expect(constructorsFor('DiagnosticsApiClient')).toEqual([
      'src/app/contexts/ModuleClientsContext.tsx',
      'src/app/contexts/StorefrontModuleClientsContext.tsx',
    ]);
  });

  it('compose une seule façade Session pour les parcours Magrit', () => {
    const appRoot = resolve(process.cwd(), 'src/app');
    const constructors = listTypeScriptFiles(appRoot)
      .filter((file) => readFileSync(file, 'utf8').includes('new SessionApiClient'))
      .map((file) => relative(process.cwd(), file));

    expect(constructors).toEqual(['src/app/contexts/ModuleClientsContext.tsx']);
  });

  it('compose les façades d identité workspace sans les confondre avec les comptes boutique', () => {
    const appRoot = resolve(process.cwd(), 'src/app');
    const appFiles = listTypeScriptFiles(appRoot);
    const constructorsFor = (client: string) => appFiles
      .filter((file) => readFileSync(file, 'utf8').includes(`new ${client}`))
      .map((file) => relative(process.cwd(), file));
    const clientsRoot = readFileSync(resolve(appRoot, 'contexts/ModuleClientsContext.tsx'), 'utf8');

    expect(constructorsFor('RolesApiClient')).toEqual(['src/app/contexts/ModuleClientsContext.tsx']);
    expect(constructorsFor('MembersApiClient')).toEqual(['src/app/contexts/ModuleClientsContext.tsx']);
    expect(constructorsFor('InvitationsApiClient')).toEqual(['src/app/contexts/ModuleClientsContext.tsx']);
    expect(clientsRoot).toContain('workspaceRoles');
    expect(clientsRoot).toContain('workspaceMembers');
    expect(clientsRoot).toContain('workspaceInvitations');
  });

  it('sort les paramètres tenant du fournisseur', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/components/dashboard/DashboardTenantSettings.tsx'), 'utf8');
    const settingsForm = readFileSync(resolve(process.cwd(), 'src/app/hooks/useTenantSettingsForm.ts'), 'utf8');
    expect(source).toContain('useTenantSettingsForm');
    expect(source).not.toContain('useSessionApi');
    expect(settingsForm).toContain('useSessionApi');
    expect(settingsForm).toContain('sessionApi.updateTenantSettings(tenant.id, updates)');
    for (const candidate of [source, settingsForm]) {
      expect(candidate).not.toContain('utils/supabase');
      expect(candidate).not.toMatch(/\bsupabase\s*\./);
    }
  });

  it('sort la gestion des sous-espaces du fournisseur', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/components/dashboard/DashboardTenantSpaces.tsx'), 'utf8');
    const management = readFileSync(resolve(process.cwd(), 'src/app/hooks/useSubTenantManagement.ts'), 'utf8');
    const tenantContext = readFileSync(resolve(process.cwd(), 'src/app/contexts/TenantContext.tsx'), 'utf8');
    expect(source).toContain('useSubTenantManagement');
    expect(source).not.toContain('useSessionApi');
    expect(management).toContain('useSessionApi');
    expect(management).toContain('sessionApi.subTenantsDashboard(tenantId)');
    expect(management).toContain('sessionApi.createSubTenant(actionTenantId');
    expect(management).toContain('sessionApi.removeSubTenant(actionTenantId, id)');
    expect(management).toContain('activeTenantId.current !== actionTenantId');
    for (const candidate of [source, management]) {
      expect(candidate).not.toContain('utils/supabase');
      expect(candidate).not.toMatch(/\bsupabase\s*\./);
    }
    expect(tenantContext).not.toContain('createSubTenant');
  });

  it('impose le client API session dans tous les runtimes', () => {
    const provider = readFileSync(
      resolve(process.cwd(), 'src/app/contexts/SessionBootstrapContext.tsx'),
      'utf8',
    );

    expect(provider).toContain('useSessionApi');
    expect(provider).not.toContain('new SessionApiClient(');
    expect(provider).not.toContain('DevSessionClient');
    expect(provider).not.toContain('VITE_API_RUNTIME');
  });

  it('conserve la RLS dans la composition Edge des modules métier', () => {
    const edgeEntry = readFileSync(
      resolve(process.cwd(), 'supabase/functions/magrit-api/index.ts'),
      'utf8',
    );

    expect(edgeEntry).toContain("Deno.env.get('SUPABASE_ANON_KEY')");
    expect(edgeEntry).toContain('Authorization: authorization');
    expect(edgeEntry).toContain('SupabaseOrdersRepository(client)');
    expect(edgeEntry).toContain(
      'createOrdersRoutes(ordersService, storefrontSessionService, storefrontCookiePolicy)',
    );
    expect(edgeEntry).toContain('SupabaseInvitationsRepository(client, invitationEmailSender)');
    expect(edgeEntry).toContain('createInvitationsRoutes(invitationsService)');
    expect(edgeEntry).toContain('ResendInvitationEmailSender');
    expect(edgeEntry).toContain('SupabaseMembersRepository(client)');
    expect(edgeEntry).toContain('createMembersRoutes(membersService)');
    expect(edgeEntry).toContain('SupabaseRolesRepository(client)');
    expect(edgeEntry).toContain('createRolesRoutes(rolesService)');
    expect(edgeEntry).toContain('SupabaseShopsRepository(client, publicSupabaseUrl(request, supabaseUrl))');
    expect(edgeEntry).toContain(
      'createShopsRoutes(shopsService, storefrontSessionService, storefrontCookiePolicy)',
    );
    expect(edgeEntry).toContain('SupabaseCatalogRepository(client)');
    expect(edgeEntry).toContain('SupabaseCatalogAutomationGateway(client)');
    expect(edgeEntry).toContain('createCatalogRoutes(catalogService)');
    expect(edgeEntry).toContain('SupabaseConversationsRepository(client)');
    expect(edgeEntry).toContain('createConversationsRoutes(conversationsService)');
    expect(edgeEntry).toContain('ConfiguredAiDiagnosticsGateway');
    expect(edgeEntry).toContain('aiProviderConfigurationFromEnvironment');
    expect(edgeEntry).toContain('createDiagnosticsRoutes(diagnosticsService)');
    expect(edgeEntry).toContain('HttpClariprintDiagnosticsGateway');
    expect(edgeEntry).toContain('SupabaseQuotesRepository(client)');
    expect(edgeEntry).toContain('createQuotesRoutes(quotesService)');
    expect(edgeEntry).toContain('SupabaseLibrariesRepository(client)');
    expect(edgeEntry).toContain('createLibrariesRoutes(librariesService)');
    expect(edgeEntry).toContain('SupabaseLibraryProductsRepository(client)');
    expect(edgeEntry).toContain('createLibraryProductsRoutes(libraryProductsService)');
    expect(edgeEntry).toContain('SupabaseCommercialRepository(client)');
    expect(edgeEntry).toContain('createCommercialRoutes(commercialService)');
    expect(edgeEntry).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('sort la gestion des souscriptions de gammes du fournisseur', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/components/dashboard/DashboardTenantGammes.tsx'), 'utf8');
    const hook = readFileSync(resolve(process.cwd(), 'src/app/hooks/useTenantGammeSubscriptions.ts'), 'utf8');
    expect(source).toContain('useTenantGammeSubscriptions');
    expect(source).not.toContain('useCatalogApi');
    expect(hook).toContain('useCatalogApi');
    expect(hook).toContain('gammeSubscriptions');
    expect(hook).toContain('setGammeSubscriptions');
    expect(hook).toContain('tenantIdRef.current');
    expect(source).not.toContain('new CatalogApiClient');
    for (const candidate of [source, hook]) {
      expect(candidate).not.toContain('utils/supabase');
      expect(candidate).not.toMatch(/\bsupabase\s*\./);
    }
  });

  it('sort la gestion agrégée des commandes de la vue dashboard', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/components/dashboard/DashboardOrders.tsx'), 'utf8');
    const hook = readFileSync(resolve(process.cwd(), 'src/app/hooks/useDashboardOrderManagement.ts'), 'utf8');
    expect(source).toContain('useDashboardOrderManagement');
    expect(source).not.toContain('useOrdersApi');
    expect(hook).toContain('useOrdersApi');
    expect(hook).toContain('listTenantOrders');
    expect(hook).toContain('ordersApi.transition');
    expect(hook).toContain('targetKeyRef.current');
    expect(source).toContain('auditApi={auditApi}');
    for (const candidate of [source, hook]) {
      expect(candidate).not.toContain('utils/supabase');
      expect(candidate).not.toMatch(/\bsupabase\s*\./);
    }
  });

  it('sort le provider PIM du fournisseur', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/contexts/PIMContext.tsx'), 'utf8');
    expect(source).toContain('useCatalogApi');
    expect(source).not.toContain('new CatalogApiClient');
    expect(source).not.toContain('utils/supabase');
    expect(source).not.toMatch(/\bsupabase\s*\./);
  });

  it('sort les opérations longues du dashboard PIM du fournisseur', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/components/dashboard/DashboardAdminPIM.tsx'), 'utf8');
    expect(source).toContain('useCatalogApi');
    expect(source).not.toContain('new CatalogApiClient');
    expect(source).not.toContain('utils/supabase');
    expect(source).not.toMatch(/\bsupabase\s*\./);
    expect(source).not.toContain('functions.invoke');
  });

  it('sort les écrans de gestion des rôles du fournisseur', () => {
    const files = [
      'src/app/components/dashboard/DashboardRolesSection.tsx',
      'src/app/components/dashboard/EditUserRolesModal.tsx',
      'src/app/components/dashboard/OrderRoleAdminPage.tsx',
      'src/app/components/dashboard/RoleEditorDialog.tsx',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).toContain('useWorkspaceRolesApi');
      expect(source).not.toContain('new RolesApiClient');
      expect(source).not.toContain('utils/supabase');
      expect(source).not.toMatch(/\bsupabase\s*\./);
    }
  });

  it('sort la vérification des capabilities du fournisseur', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/hooks/useUserCapability.ts'), 'utf8');
    expect(source).toContain('useWorkspaceRolesApi');
    expect(source).not.toContain('new RolesApiClient');
    expect(source).not.toContain('utils/supabase');
    expect(source).not.toMatch(/\bsupabase\s*\./);
  });

  it('réordonne deux rôles atomiquement sous la RLS utilisateur', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260812000100_api_swap_tenant_role_order.sql'), 'utf8');
    expect(migration).toContain('security invoker');
    expect(migration).toContain('set ordering_index = case');
    expect(migration).toContain('get diagnostics _matched = row_count');
    expect(migration).toContain('grant execute on function public.api_swap_tenant_role_order');
    expect(migration).not.toContain('service_role');
  });

  it('sort le contexte boutiques du fournisseur', () => {
    const workspace = readFileSync(resolve(process.cwd(), 'src/app/contexts/ShopsContext.tsx'), 'utf8');
    const storefront = readFileSync(resolve(process.cwd(), 'src/app/components/shop/PublicShop.tsx'), 'utf8');
    const storefrontCatalog = readFileSync(resolve(process.cwd(), 'src/app/hooks/usePublicShopCatalog.ts'), 'utf8');
    expect(workspace).toContain('useShopsApi');
    expect(storefront).toContain('usePublicShopCatalog');
    expect(storefront).not.toContain('useStorefrontShopsApi');
    expect(storefrontCatalog).toContain('useStorefrontShopsApi');
    expect(storefrontCatalog).toContain('resolveShopAccess');
    expect(storefrontCatalog).toContain('classifyShopLoadFailure');
    expect(storefront).not.toContain('.publicProbe(');
    expect(storefront).not.toContain('.publicCatalog(');
    for (const source of [workspace, storefront, storefrontCatalog]) {
      expect(source).not.toContain('utils/supabase');
      expect(source).not.toMatch(/\bsupabase\s*\./);
    }
  });

  it('fait dépendre le storefront du module Shops et non du contexte workspace', () => {
    const storefrontRoot = resolve(process.cwd(), 'src/app/components/shop');
    const violations = listTypeScriptFiles(storefrontRoot)
      .filter((file) => readFileSync(file, 'utf8').includes('contexts/ShopsContext'))
      .map((file) => relative(process.cwd(), file));
    const shopModule = readFileSync(resolve(process.cwd(), 'src/modules/shops/index.ts'), 'utf8');
    const workspaceContext = readFileSync(resolve(process.cwd(), 'src/app/contexts/ShopsContext.tsx'), 'utf8');

    expect(violations).toEqual([]);
    expect(shopModule).toContain("export type { Shop, ShopProduct, ShopTheme }");
    expect(workspaceContext).toContain("from '../../modules/shops'");
  });

  it('interdit aux vues storefront de piloter directement les clients de module', () => {
    const storefrontRoot = resolve(process.cwd(), 'src/app/components/shop');
    const clientHook = /\buseStorefront(?:Orders|Shops|Identity|Diagnostics)Api\b/;
    const violations = listTypeScriptFiles(storefrontRoot)
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return source.includes('StorefrontModuleClientsContext') || clientHook.test(source);
      })
      .map((file) => relative(process.cwd(), file));

    expect(violations).toEqual([]);
  });

  it('sort les redirections tenant du fournisseur', () => {
    const legacy = readFileSync(resolve(process.cwd(), 'src/app/components/tenant/LegacySlugRedirect.tsx'), 'utf8');
    const shopOnly = readFileSync(resolve(process.cwd(), 'src/app/components/tenant/LegacyShopOnlyAccessNotice.tsx'), 'utf8');
    const layout = readFileSync(resolve(process.cwd(), 'src/app/components/tenant/TenantAwareLayout.tsx'), 'utf8');
    const legacyHook = readFileSync(resolve(process.cwd(), 'src/app/hooks/useLegacyTenantSlugResolution.ts'), 'utf8');
    expect(legacy).toContain('useLegacyTenantSlugResolution');
    expect(legacy).not.toContain('useSessionApi');
    expect(legacyHook).toContain('useSessionApi');
    expect(shopOnly).not.toContain('useShopsApi');
    expect(shopOnly).not.toContain('/shop/');
    expect(shopOnly).toContain('Activation boutique nécessaire');
    expect(layout).toContain('LegacyShopOnlyAccessNotice');
    expect(layout).not.toContain('ShopOnlyRedirect');
    for (const source of [legacy, shopOnly]) {
      expect(source).not.toContain('utils/supabase');
      expect(source).not.toMatch(/\bsupabase\s*\./);
    }
  });

  it('sort le rapport de migration des comptes boutique de la vue', () => {
    const component = readFileSync(resolve(
      process.cwd(),
      'src/app/components/dashboard/LegacyShopCustomerMigrationSection.tsx',
    ), 'utf8');
    const hook = readFileSync(resolve(
      process.cwd(),
      'src/app/hooks/useLegacyShopCustomerMigrationReport.ts',
    ), 'utf8');

    expect(component).toContain('useLegacyShopCustomerMigrationReport');
    expect(component).not.toContain('useShopCustomersApi');
    expect(hook).toContain('useShopCustomersApi');
    expect(hook).toContain('api.migrationReport(tenantId)');
    for (const source of [component, hook]) {
      expect(source).not.toContain('utils/supabase');
      expect(source).not.toMatch(/\bsupabase\s*\./);
    }
  });

  it('sort la gestion des comptes clients boutique de la vue', () => {
    const component = readFileSync(resolve(
      process.cwd(),
      'src/app/components/dashboard/ShopCustomerAccountsSection.tsx',
    ), 'utf8');
    const hook = readFileSync(resolve(
      process.cwd(),
      'src/app/hooks/useShopCustomerAccountManagement.ts',
    ), 'utf8');

    expect(component).toContain('useShopCustomerAccountManagement');
    expect(component).not.toContain('useShopCustomersApi');
    expect(hook).toContain('useShopCustomersApi');
    expect(hook).toContain('api.startSelfDelegation');
    expect(hook).toContain('api.issueActivation');
    for (const source of [component, hook]) {
      expect(source).not.toContain('utils/supabase');
      expect(source).not.toMatch(/\bsupabase\s*\./);
    }
  });

  it('sort la gestion des mockups custom de la vue boutique', () => {
    const component = readFileSync(resolve(
      process.cwd(),
      'src/app/components/dashboard/ShopCustomMockups.tsx',
    ), 'utf8');
    const hook = readFileSync(resolve(
      process.cwd(),
      'src/app/hooks/useShopCustomMockups.ts',
    ), 'utf8');

    expect(component).toContain('useShopCustomMockups');
    expect(component).not.toContain('useShopsApi');
    expect(hook).toContain('useShopsApi');
    expect(hook).toContain('uploadCustomMockup');
    expect(hook).toContain('restoreCustomMockup');
    expect(hook).toContain('targetKeyRef.current');
    for (const source of [component, hook]) {
      expect(source).not.toContain('utils/supabase');
      expect(source).not.toMatch(/\bsupabase\s*\./);
    }
  });

  it('sort l acceptation d invitation et le compte portail du fournisseur', () => {
    const invitation = readFileSync(resolve(process.cwd(), 'src/app/components/tenant/AcceptInvitation.tsx'), 'utf8');
    const invitationHook = readFileSync(resolve(process.cwd(), 'src/app/hooks/useMagritInvitationAcceptance.ts'), 'utf8');
    const account = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/AccountHub.tsx'), 'utf8');
    expect(invitation).toContain('useMagritInvitationAcceptance');
    expect(invitation).not.toContain('useSessionApi');
    expect(invitation).not.toContain('useShopsApi');
    expect(invitationHook).toContain('resolveMagritInvitationDestination');
    expect(invitationHook).not.toContain('useShopsApi');
    expect(invitationHook).not.toContain('/s/');
    expect(invitation).toContain('signOut');
    expect(account).toContain('onSignOut');
    expect(account).toContain('session.customer.email');
    expect(account).not.toContain('useAuth');
    expect(account).not.toContain('useTenant');
    expect(account).not.toContain('useQuotes');
    for (const source of [invitation, account]) {
      expect(source).not.toContain('utils/supabase');
      expect(source).not.toMatch(/\bsupabase\s*\./);
    }
  });

  it('isole l identification checkout dans la session boutique', () => {
    const checkout = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/CheckoutPage.tsx'), 'utf8');
    const login = readFileSync(resolve(process.cwd(), 'src/app/components/shop/StorefrontLoginForm.tsx'), 'utf8');
    const identityForm = readFileSync(resolve(process.cwd(), 'src/app/hooks/useStorefrontIdentityForm.ts'), 'utf8');
    expect(checkout).toContain('StorefrontLoginForm');
    expect(checkout).toContain('storefrontSession?.identity.shopId === shop.id');
    expect(login).toContain('useStorefrontIdentityForm');
    expect(identityForm).toContain('api.authenticate(shopSlug');
    for (const source of [checkout, login, identityForm]) {
      expect(source).not.toContain('useAuth');
      expect(source).not.toContain('signIn');
      expect(source).not.toContain('signUp');
      expect(source).not.toContain('utils/supabase');
      expect(source).not.toMatch(/\bsupabase\s*\./);
    }
  });

  it('sort l historique des conversations du fournisseur', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/contexts/ConversationContext.tsx'), 'utf8');
    expect(source).toContain('useConversationsApi');
    expect(source).not.toContain('new ConversationsApiClient');
    expect(source).not.toContain('utils/supabase');
    expect(source).not.toMatch(/\bsupabase\s*\./);
  });

  it('sort le diagnostic IA du fournisseur et de la plateforme Edge', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/components/DiagnosticPanel.tsx'), 'utf8');
    const hook = readFileSync(resolve(process.cwd(), 'src/app/hooks/usePlatformDiagnostics.ts'), 'utf8');
    expect(source).toContain('usePlatformDiagnostics');
    expect(source).not.toContain('useDiagnosticsApi');
    expect(hook).toContain('useDiagnosticsApi');
    expect(source).not.toContain('new DiagnosticsApiClient');
    expect(source).not.toContain('utils/supabase');
    expect(source).not.toContain('functions.invoke');
    expect(source).not.toContain('claude-test');
    expect(source).not.toContain('ClariprintAdapter');
    expect(hook).toContain('diagnosticsApi.clariprint()');
    expect(hook).toContain('diagnosticsApi.aiProvider()');
    for (const candidate of [source, hook]) {
      expect(candidate).not.toContain('utils/supabase');
      expect(candidate).not.toMatch(/\bsupabase\s*\./);
    }
  });

  it('fait passer les devis Clariprint du navigateur par l API Magrit', () => {
    const adapter = readFileSync(resolve(process.cwd(), 'src/adapters/http/browser-clariprint-adapter.ts'), 'utf8');
    const configurator = readFileSync(resolve(process.cwd(), 'src/app/hooks/useProductConfigurator.ts'), 'utf8');
    const portal = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/PortalCatalog.tsx'), 'utf8');
    const product = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/PortalProduct.tsx'), 'utf8');
    const hook = readFileSync(resolve(process.cwd(), 'src/app/hooks/useClariprintProduct.ts'), 'utf8');
    const services = readFileSync(resolve(process.cwd(), 'src/app/contexts/BrowserServicesContext.tsx'), 'utf8');
    const storefrontServices = readFileSync(resolve(process.cwd(), 'src/app/contexts/StorefrontBrowserServicesContext.tsx'), 'utf8');
    const runtime = readFileSync(resolve(process.cwd(), 'src/platform/runtime/browser-runtime.ts'), 'utf8');
    const storefrontRuntime = readFileSync(resolve(process.cwd(), 'src/platform/runtime/storefront-browser-runtime.ts'), 'utf8');
    const supabaseConfig = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');
    expect(adapter).toContain('ClariprintApiClient');
    expect(adapter).not.toContain('functions/v1');
    expect(adapter).not.toContain('supabase.co');
    expect(configurator).not.toContain('server/clariprint');
    expect(hook).not.toContain('useBrowserServices');
    expect(hook).toContain("gateway: Pick<ClariprintPricingGateway, 'computePrice'>");
    expect(readFileSync(resolve(process.cwd(), 'src/app/components/ProductCard.tsx'), 'utf8'))
      .toContain('useClariprintProduct(clariprint)');
    expect(portal).not.toContain('server/clariprint');
    for (const source of [configurator, portal, product, hook]) {
      expect(source).not.toContain('adapters/http/browser-clariprint-adapter');
    }
    expect(services).toContain('runtime.createClariprint(apiRuntime.client)');
    expect(services).not.toContain('apiRuntime.anonymousClient');
    expect(storefrontServices).toContain('runtime.createClariprint(apiRuntime.client)');
    expect(storefrontServices).toContain('useStorefrontApiRuntime');
    expect(portal).toContain('useStorefrontClariprint');
    expect(product).toContain('useStorefrontClariprint');
    expect(runtime).toContain('new ClariprintHttpAdapter(');
    expect(storefrontRuntime).toContain('new ClariprintHttpAdapter(');
    expect(supabaseConfig).toMatch(/\[functions\.magrit-api\][\s\S]*verify_jwt\s*=\s*false/);
  });

  it('injecte la passerelle assistant sans singleton concret dans les composants', () => {
    const chat = readFileSync(resolve(process.cwd(), 'src/app/components/ChatInterface.tsx'), 'utf8');
    const catalog = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/PortalCatalog.tsx'), 'utf8');
    const services = readFileSync(resolve(process.cwd(), 'src/app/contexts/BrowserServicesContext.tsx'), 'utf8');
    const storefrontServices = readFileSync(resolve(process.cwd(), 'src/app/contexts/StorefrontBrowserServicesContext.tsx'), 'utf8');
    const runtime = readFileSync(resolve(process.cwd(), 'src/platform/runtime/browser-runtime.ts'), 'utf8');
    const storefrontRuntime = readFileSync(resolve(process.cwd(), 'src/platform/runtime/storefront-browser-runtime.ts'), 'utf8');

    expect(chat).not.toContain('browserAssistantGateway');
    expect(catalog).not.toContain('browserAssistantGateway');
    expect(chat).toContain('useClaudeSseStream');
    expect(catalog).toContain('useClaudeSseStream');
    expect(chat).toContain('useClaudeSseStream(assistant)');
    expect(catalog).toContain('useClaudeSseStream(storefrontAssistant)');
    expect(catalog).toContain('useStorefrontAssistant');
    expect(services).toContain('assistant: runtime.assistant');
    expect(services).not.toContain('storefrontAssistant');
    expect(storefrontServices).toContain('assistant: runtime.assistant');
    expect(storefrontServices).toContain('useStorefrontApiRuntime');
    expect(runtime).toContain('assistant: browserAssistantGateway');
    expect(runtime).not.toContain('browserStorefrontAssistantGateway');
    expect(storefrontRuntime).toContain('assistant: browserStorefrontAssistantGateway');
    expect(storefrontRuntime).not.toContain('browserAuthenticationGateway');
    expect(storefrontRuntime).not.toContain('adapters/supabase');
    expect(storefrontRuntime).not.toContain('AuthenticationGateway');
  });

  it('fait passer la création rapide des brouillons par Quotes', () => {
    const utility = readFileSync(resolve(process.cwd(), 'src/app/utils/quote.ts'), 'utf8');
    expect(utility).toContain('quotesApi.createDraft');
    expect(utility).not.toContain('utils/supabase');
    expect(utility).not.toMatch(/\bsupabase\s*\./);
  });

  it('sort le CRUD éditable des devis du fournisseur', () => {
    const context = readFileSync(resolve(process.cwd(), 'src/app/contexts/QuotesContext.tsx'), 'utf8');
    const repository = readFileSync(resolve(process.cwd(), 'src/adapters/supabase/quotes-repository.ts'), 'utf8');
    expect(context).toContain('useQuotesApi');
    expect(context).not.toContain('new QuotesApiClient');
    expect(context).not.toContain('utils/supabase');
    expect(context).not.toMatch(/\bsupabase\s*\./);
    expect(repository).toContain("scope === 'all'");
    expect(repository).toContain("rpc('user_role_in_tenant'");
    expect(repository).toContain("rpc('is_super_admin'");
  });

  it('sort les gabarits de devis du fournisseur', () => {
    const context = readFileSync(resolve(process.cwd(), 'src/app/contexts/QuoteTemplatesContext.tsx'), 'utf8');
    expect(context).toContain('useQuoteTemplatesApi');
    expect(context).not.toContain('new QuoteTemplatesApiClient');
    expect(context).not.toContain('utils/supabase');
    expect(context).not.toMatch(/\bsupabase\s*\./);
  });

  it('fait passer le CRUD des bibliothèques par le module Libraries', () => {
    const context = readFileSync(resolve(process.cwd(), 'src/app/contexts/LibraryContext.tsx'), 'utf8');
    const repository = readFileSync(resolve(process.cwd(), 'src/adapters/supabase/libraries-repository.ts'), 'utf8');
    expect(context).toContain('useLibrariesApi');
    expect(context).not.toContain('new LibrariesApiClient');
    expect(context).toContain('librariesApi.list');
    expect(context).toContain('librariesApi.create');
    expect(context).toContain('librariesApi.update');
    expect(context).toContain('librariesApi.remove');
    expect(repository).toContain(".eq('tenant_id', tenantId)");
  });

  it('sort produits, bulk et génération PIM du fournisseur', () => {
    const context = readFileSync(resolve(process.cwd(), 'src/app/contexts/LibraryContext.tsx'), 'utf8');
    const repository = readFileSync(resolve(process.cwd(), 'src/adapters/supabase/library-products-repository.ts'), 'utf8');
    expect(context).toContain('useLibraryProductsApi');
    expect(context).not.toContain('new LibraryProductsApiClient');
    expect(context).toContain('productsApi.createMany');
    expect(context).toContain('productsApi.replacePimGenerated');
    expect(context).toContain('productsApi.clearPimGenerated');
    expect(context).not.toContain('utils/supabase');
    expect(context).not.toMatch(/\bsupabase\s*\./);
    expect(repository).toContain(".eq('tenant_id', tenantId)");
    expect(repository).toContain(".filter('config->>source', 'eq', PIM_GENERATED_SOURCE)");
  });

  it('fait passer le chargement commercial par Commercial', () => {
    const dashboard = readFileSync(resolve(process.cwd(), 'src/app/components/dashboard/commercial/DashboardCommercial.tsx'), 'utf8');
    const helpers = readFileSync(resolve(process.cwd(), 'src/app/components/dashboard/commercial/commercial.helpers.ts'), 'utf8');
    const repository = readFileSync(resolve(process.cwd(), 'src/adapters/supabase/commercial-repository.ts'), 'utf8');
    expect(dashboard).toContain('useCommercialApi');
    expect(dashboard).not.toContain('new CommercialApiClient');
    expect(dashboard).toContain('commercialApi.overview');
    expect(dashboard).not.toContain('get_tenant_members_with_email');
    expect(helpers).not.toContain('utils/supabase');
    expect(repository).toContain(".eq('tenant_id', tenantId)");
  });

  it('sort les mutations commerciales du fournisseur', () => {
    const dashboard = readFileSync(resolve(process.cwd(), 'src/app/components/dashboard/commercial/DashboardCommercial.tsx'), 'utf8');
    expect(dashboard).toContain('commercialApi.createGroup');
    expect(dashboard).toContain('commercialApi.setGroupMember');
    expect(dashboard).toContain('commercialApi.createRule');
    expect(dashboard).toContain('commercialApi.setRuleActive');
    expect(dashboard).not.toContain('utils/supabase');
    expect(dashboard).not.toMatch(/\bsupabase\s*\./);
  });

  it('isole le fournisseur Auth du contexte React', () => {
    const context = readFileSync(resolve(process.cwd(), 'src/app/contexts/AuthContext.tsx'), 'utf8');
    const workspaceBoundary = readFileSync(resolve(process.cwd(), 'src/app/surfaces/WorkspaceRuntimeBoundary.tsx'), 'utf8');
    const runtime = readFileSync(resolve(process.cwd(), 'src/platform/runtime/browser-runtime.ts'), 'utf8');
    const adapter = readFileSync(resolve(process.cwd(), 'src/adapters/supabase/browser-authentication-gateway.ts'), 'utf8');
    expect(context).toContain('gateway: AuthenticationGateway');
    expect(context).not.toContain('browserAuthenticationGateway');
    expect(workspaceBoundary).toContain('browserRuntime.authentication');
    expect(runtime).toContain('browserAuthenticationGateway');
    expect(context).not.toContain('utils/supabase');
    expect(context).not.toContain('adapters/supabase');
    expect(context).not.toContain('@supabase');
    expect(context).not.toMatch(/\bsupabase\s*\./);
    expect(adapter).toContain('SupabaseBrowserAuthenticationGateway');
    expect(adapter).toContain("scope: 'local'");
  });

  it('isole le protocole binaire des mockups dans une passerelle', () => {
    const image = readFileSync(resolve(process.cwd(), 'src/app/components/mockup/MockupImage.tsx'), 'utf8');
    const admin = readFileSync(resolve(process.cwd(), 'src/app/components/dashboard/DashboardAdminMockups.tsx'), 'utf8');
    const helpers = readFileSync(resolve(process.cwd(), 'src/app/components/mockup/MockupImage.helpers.ts'), 'utf8');
    const adapter = readFileSync(resolve(process.cwd(), 'src/adapters/http/browser-mockup-gateway.ts'), 'utf8');
    expect(image).toContain('mockups.generate');
    expect(admin).toContain('mockups.previewUrl');
    expect(image).not.toContain('browserMockupGateway');
    expect(admin).not.toContain('browserMockupGateway');
    expect(image).not.toContain('utils/supabase');
    expect(admin).not.toContain('utils/supabase');
    expect(helpers).not.toContain('functions/v1');
    expect(helpers).not.toMatch(/\bsupabase\s*\./);
    expect(adapter).toContain('BrowserApiMockupGateway');
    expect(adapter).toContain('/api/v1/mockups');
    expect(adapter).not.toContain('supabase');
  });

  it('place le protocole du chat SSE derrière une façade API', () => {
    const chat = readFileSync(resolve(process.cwd(), 'src/app/components/ChatInterface.tsx'), 'utf8');
    const portal = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/PortalCatalog.tsx'), 'utf8');
    const editorial = readFileSync(resolve(process.cwd(), 'src/app/hooks/useStorefrontCategoryEditorial.ts'), 'utf8');
    const hook = readFileSync(resolve(process.cwd(), 'src/app/hooks/useClaudeSseStream.ts'), 'utf8');
    const adapter = readFileSync(resolve(process.cwd(), 'src/adapters/http/browser-assistant-gateway.ts'), 'utf8');
    expect(chat).toContain('useClaudeSseStream');
    expect(portal).toContain('useStorefrontCategoryEditorial');
    expect(editorial).toContain('api.storefrontCategoryEditorial');
    expect(chat).not.toContain('utils/supabase');
    expect(chat).not.toContain('functions/v1');
    expect(portal).not.toContain('functions/v1');
    expect(portal).not.toContain('useAuth');
    expect(portal).toContain('shopSlug: shop.slug');
    expect(hook).toContain('assistant.send');
    expect(hook).not.toContain('useBrowserServices');
    expect(hook).not.toMatch(/\bfetch\s*\(/);
    expect(hook).not.toContain("event === 'delta'");
    expect(adapter).toContain('BrowserApiAssistantGateway');
    expect(adapter).toContain("'/api/v1/assistant/chat'");
    expect(adapter).toContain("event === 'delta'");
    expect(adapter).not.toContain('supabase');
  });

  it('ne donne pas au storefront un droit Magrit de mutation du catalogue', () => {
    const portal = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/PortalCatalog.tsx'), 'utf8');
    expect(portal).not.toContain('shopsApi.persistAiProduct');
    expect(portal).not.toContain('useShopsApi');
    expect(portal).not.toContain('utils/supabase');
    expect(portal).not.toMatch(/\bsupabase\s*\./);
  });

  it('isole le renvoi des invitations derrière le port email', () => {
    const repository = readFileSync(resolve(process.cwd(), 'src/adapters/supabase/invitations-repository.ts'), 'utf8');
    expect(repository).toContain('InvitationEmailSender');
    expect(repository).not.toContain('send-invitation-email');
    expect(repository).not.toContain("functions.invoke<LegacyInviteResponse>('make-server");
    expect(repository).not.toContain('invite-member');
    expect(repository).not.toContain('.functions.invoke');
  });

  it('sécurise la création d invitation dans une commande SQL étroite', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260811000900_api_create_tenant_invitation.sql'), 'utf8');
    expect(migration).toContain('security definer');
    expect(migration).toContain("user_has_capability(p_tenant_id, 'can_invite')");
    expect(migration).toContain('role_mismatch_tenant');
    expect(migration).toContain('duplicate_pending');
    expect(migration).toContain('revoke all on function');
    expect(migration).toContain('grant execute on function');
  });

  it('sort le dashboard utilisateurs du fournisseur de données', () => {
    const dashboard = readFileSync(resolve(process.cwd(), 'src/app/components/dashboard/DashboardUsers.tsx'), 'utf8');
    expect(dashboard).toContain('useWorkspaceMembersApi');
    expect(dashboard).not.toContain('new MembersApiClient');
    expect(dashboard).not.toContain('utils/supabase');
    expect(dashboard).not.toMatch(/\bsupabase\s*\./);
  });

  it('fait passer la création des invitations par le client API Magrit', () => {
    const modal = readFileSync(
      resolve(process.cwd(), 'src/app/components/dashboard/InviteUserModalV2.tsx'),
      'utf8',
    );
    const usersDashboard = readFileSync(
      resolve(process.cwd(), 'src/app/components/dashboard/DashboardUsers.tsx'),
      'utf8',
    );

    expect(modal).toContain('useWorkspaceInvitationsApi');
    expect(modal).toContain('useWorkspaceInvitationsApiFactory');
    expect(modal).not.toContain('new InvitationsApiClient');
    expect(modal).toContain('invitationsApi.options');
    expect(modal).toContain('refreshSession');
    expect(modal).not.toContain('utils/supabase');
    expect(modal).not.toMatch(/\bsupabase\s*\./);
    expect(modal).not.toContain('.functions.invoke');
    expect(modal).not.toContain('prompt(');
    expect(modal).toContain('invitation-manual-link');
    expect(modal).not.toContain("setScope('shop_only')");
    expect(modal).toContain('Cette invitation crée uniquement un utilisateur Magrit');
    expect(usersDashboard).not.toMatch(/functions\.invoke[\s\S]{0,120}invite-member/);
    expect(usersDashboard).not.toContain('send-invitation-email');
    expect(usersDashboard).not.toContain(".from('tenant_invitations')");
  });

  it('sépare les rôles Magrit du rôle Acheteur storefront historique', () => {
    const invitationsRepository = readFileSync(
      resolve(process.cwd(), 'src/adapters/supabase/invitations-repository.ts'),
      'utf8',
    );
    const rolesRepository = readFileSync(
      resolve(process.cwd(), 'src/adapters/supabase/roles-repository.ts'),
      'utf8',
    );
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260818000200_separate_magrit_and_legacy_storefront_roles.sql'),
      'utf8',
    );

    expect(invitationsRepository).toContain(".eq('identity_context', 'magrit')");
    expect(rolesRepository.match(/\.eq\('identity_context', 'magrit'\)/g)).toHaveLength(3);
    expect(migration).toContain("identity_context = 'storefront_legacy'");
    expect(migration).toContain('tenant_role_assignments_enforce_identity_context');
    expect(migration).toContain('tenant_invitations_enforce_role_identity_context');
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
