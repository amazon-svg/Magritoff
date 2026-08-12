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
    expect(routes).toContain('workspaceRuntimeRoutes.map');
    expect(runtime).toContain("import('../components/dashboard/DashboardAccount')");
    expect(runtime).toContain('Component: lazy(loader)');
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

  it('réserve le client session direct au développement local', () => {
    const provider = readFileSync(
      resolve(process.cwd(), 'src/app/contexts/SessionBootstrapContext.tsx'),
      'utf8',
    );

    expect(provider).toContain("import.meta.env.DEV && import.meta.env.VITE_API_RUNTIME !== 'edge'");
    expect(provider).toContain('return new DevSessionClient(user.id)');
    expect(provider).toContain('return new SessionApiClient(');
  });

  it('conserve la RLS dans la composition Edge des modules métier', () => {
    const edgeEntry = readFileSync(
      resolve(process.cwd(), 'supabase/functions/magrit-api/index.ts'),
      'utf8',
    );

    expect(edgeEntry).toContain("Deno.env.get('SUPABASE_ANON_KEY')");
    expect(edgeEntry).toContain('Authorization: authorization');
    expect(edgeEntry).toContain('SupabaseOrdersRepository(client)');
    expect(edgeEntry).toContain('createOrdersRoutes(ordersService)');
    expect(edgeEntry).toContain('SupabaseInvitationsRepository(client, invitationEmailSender)');
    expect(edgeEntry).toContain('createInvitationsRoutes(invitationsService)');
    expect(edgeEntry).toContain('ResendInvitationEmailSender');
    expect(edgeEntry).toContain('SupabaseMembersRepository(client)');
    expect(edgeEntry).toContain('createMembersRoutes(membersService)');
    expect(edgeEntry).toContain('SupabaseRolesRepository(client)');
    expect(edgeEntry).toContain('createRolesRoutes(rolesService)');
    expect(edgeEntry).toContain('SupabaseShopsRepository(client, publicSupabaseUrl(request, supabaseUrl))');
    expect(edgeEntry).toContain('createShopsRoutes(shopsService)');
    expect(edgeEntry).toContain('SupabaseCatalogRepository(client)');
    expect(edgeEntry).toContain('SupabaseCatalogAutomationGateway(client)');
    expect(edgeEntry).toContain('createCatalogRoutes(catalogService)');
    expect(edgeEntry).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('sort la gestion des souscriptions de gammes du fournisseur', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/components/dashboard/DashboardTenantGammes.tsx'), 'utf8');
    expect(source).toContain('CatalogApiClient');
    expect(source).not.toContain('utils/supabase');
    expect(source).not.toMatch(/\bsupabase\s*\./);
  });

  it('sort le provider PIM du fournisseur', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/contexts/PIMContext.tsx'), 'utf8');
    expect(source).toContain('CatalogApiClient');
    expect(source).not.toContain('utils/supabase');
    expect(source).not.toMatch(/\bsupabase\s*\./);
  });

  it('sort les opérations longues du dashboard PIM du fournisseur', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/components/dashboard/DashboardAdminPIM.tsx'), 'utf8');
    expect(source).toContain('CatalogApiClient');
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
      expect(source).toContain('RolesApiClient');
      expect(source).not.toContain('utils/supabase');
      expect(source).not.toMatch(/\bsupabase\s*\./);
    }
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
    for (const file of ['src/app/contexts/ShopsContext.tsx', 'src/app/components/shop/PublicShop.tsx']) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).toContain('ShopsApiClient');
      expect(source).not.toContain('utils/supabase');
      expect(source).not.toMatch(/\bsupabase\s*\./);
    }
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
    expect(dashboard).toContain('new MembersApiClient');
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

    expect(modal).toContain('new InvitationsApiClient');
    expect(modal).toContain('invitationsApi.options');
    expect(modal).not.toContain('.functions.invoke');
    expect(modal).not.toContain('prompt(');
    expect(modal).toContain('invitation-manual-link');
    expect(modal).toContain("setScope('magrit_full')");
    expect(usersDashboard).not.toMatch(/functions\.invoke[\s\S]{0,120}invite-member/);
    expect(usersDashboard).not.toContain('send-invitation-email');
    expect(usersDashboard).not.toContain(".from('tenant_invitations')");
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
