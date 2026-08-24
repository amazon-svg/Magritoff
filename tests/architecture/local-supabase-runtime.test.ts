import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('runtime Supabase local', () => {
  it('versionne une stack CLI Docker reproductible', () => {
    const config = read('supabase/config.toml');
    const packageJson = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(config).toContain('project_id = "magritoff-v5"');
    expect(config).toContain('site_url = "http://127.0.0.1:5177"');
    expect(packageJson.devDependencies.supabase).toBeDefined();
    expect(packageJson.scripts['db:local:start']).toContain('supabase-local.sh start');
    expect(packageJson.scripts['db:local:reset']).toContain('supabase-local.sh reset');
    expect(packageJson.scripts['db:local:push']).toContain('supabase-local.sh push');
    expect(packageJson.scripts['test:storefront:sql']).toContain('test-storefront-sql.sh');
    const localRuntime = read('scripts/supabase-local.sh');
    expect(localRuntime).toContain('20260417000000_local_b4_baseline.sql');
    expect(localRuntime).toContain('with_local_baseline db push --local');
    expect(localRuntime).toContain('ensure_edge_runtime');
    expect(localRuntime).toContain('supabase_edge_runtime_${PROJECT_ID}');
    expect(localRuntime).toContain("docker inspect --format '{{.State.Running}}'");
    expect(localRuntime).toContain('docker start "$container"');
    expect(read('scripts/test-storefront-sql.sh')).toContain('storefront-order-identity.sql');
  });

  it('permet au front et au proxy API de cibler la stack locale', () => {
    const edgeRuntime = read('supabase/functions/magrit-api/index.ts');

    expect(read('utils/supabase/info.tsx')).toContain('import.meta.env.VITE_SUPABASE_URL');
    expect(read('utils/supabase/info.tsx')).toContain('import.meta.env.VITE_SUPABASE_ANON_KEY');
    expect(read('vite.config.ts')).toContain('env.VITE_API_PROXY_TARGET');
    expect(read('.env.local.example')).toContain('http://127.0.0.1:54321');
    expect(read('supabase/functions/magrit-api/deno.json')).toContain('npm:zod@4.4.3');
    expect(edgeRuntime).toContain("Deno.env.get('MAGRIT_PUBLIC_SUPABASE_URL')");
    expect(edgeRuntime).toContain("request.headers.get('x-forwarded-port')");
    expect(edgeRuntime).toContain("return 'http://127.0.0.1:54321'");
    expect(edgeRuntime).toContain('new SupabaseStorefrontAuthenticationGateway(storefrontClient)');
    expect(edgeRuntime).not.toContain('new SupabaseStorefrontAuthenticationGateway(client)');
  });

  it('accorde explicitement les opérations API protégées par RLS', () => {
    const grants = read('supabase/migrations/20260811000100_api_role_table_grants.sql');

    expect(grants).toContain('select, insert, update, delete');
    expect(grants).toContain('to anon, authenticated');
    expect(grants).toContain('alter default privileges for role postgres');
  });

  it('restaure les privilèges de données du service role serveur', () => {
    const grants = read('supabase/migrations/20260819000100_service_role_table_grants.sql');

    expect(grants).toContain('on all tables in schema public');
    expect(grants).toContain('to service_role');
    expect(grants).toContain('on all sequences in schema public');
    expect(grants).toContain('alter default privileges for role postgres');
    expect(grants).not.toContain('schema private to service_role');
  });

  it('ne réutilise pas une session persistée supprimée par un reset local', () => {
    const authContext = read('src/app/contexts/AuthContext.tsx');
    const authAdapter = read('src/adapters/supabase/browser-authentication-gateway.ts');

    expect(authContext).toContain('auth.verifiedUser()');
    expect(authContext).toContain('auth.clearLocalSession()');
    expect(authAdapter).toContain("scope: 'local'");
    expect(authAdapter).toContain("event !== 'INITIAL_SESSION'");
  });

  it('attend les données du user avant de conclure qu il n a aucun tenant', () => {
    const tenantContext = read('src/app/contexts/TenantContext.tsx');

    expect(tenantContext).toContain('!bootstrap.error && dataForUser === null');
  });

  it('synchronise les memberships privilégiés avec les rôles fonctionnels Orders', () => {
    const migration = read('supabase/migrations/20260811000300_sync_membership_order_roles.sql');
    const dashboard = read('src/app/components/dashboard/DashboardOrders.tsx');

    expect(migration).toContain('trg_sync_membership_functional_role');
    expect(migration).toContain("definition.name in ('Owner', 'Admin')");
    expect(migration).toContain("member.role in ('owner', 'admin')");
    expect(dashboard).toContain("currentTenant?.myRole === 'admin'");
    expect(dashboard).toContain('canValidate || isTenantAdmin');
    expect(dashboard).toContain('canModifyProduction || isTenantAdmin');
  });

  it('peut reprendre la migration self-signup après une extraction déjà effectuée', () => {
    const migration = read('supabase/migrations/20260811000800_create_order_self_signup.sql');

    expect(migration).toContain("to_regprocedure(\n    'public.api_create_tenant_order_core(uuid,text,text,jsonb,text)'");
    expect(migration).toContain('create or replace function public.api_create_tenant_order');
  });
});
