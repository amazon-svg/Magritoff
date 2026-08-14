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
    expect(read('scripts/supabase-local.sh')).toContain('20260417000000_local_b4_baseline.sql');
  });

  it('permet au front et au proxy API de cibler la stack locale', () => {
    expect(read('utils/supabase/info.tsx')).toContain('import.meta.env.VITE_SUPABASE_URL');
    expect(read('utils/supabase/info.tsx')).toContain('import.meta.env.VITE_SUPABASE_ANON_KEY');
    expect(read('vite.config.ts')).toContain('env.VITE_API_PROXY_TARGET');
    expect(read('.env.local.example')).toContain('http://127.0.0.1:54321');
    expect(read('supabase/functions/magrit-api/deno.json')).toContain('npm:zod@4.4.3');
    expect(read('supabase/functions/magrit-api/index.ts')).toContain("Deno.env.get('MAGRIT_PUBLIC_SUPABASE_URL')");
    expect(read('supabase/functions/magrit-api/index.ts')).toContain("request.headers.get('x-forwarded-port')");
    expect(read('supabase/functions/magrit-api/index.ts')).toContain("return 'http://127.0.0.1:54321'");
  });

  it('accorde explicitement les opérations API protégées par RLS', () => {
    const grants = read('supabase/migrations/20260811000100_api_role_table_grants.sql');

    expect(grants).toContain('select, insert, update, delete');
    expect(grants).toContain('to anon, authenticated');
    expect(grants).toContain('alter default privileges for role postgres');
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

  it('fait dériver les droits owner/admin de l appartenance, sans synchronisation par nom', () => {
    // Décision Arnaud 2026-08-14 (chantier gestion des utilisateurs) : le
    // trigger AF5.1a réconciliait appartenance et rôles fonctionnels en
    // appariant sur les NOMS 'Owner'/'Admin' — renommer l un de ces rôles
    // cassait la synchronisation des droits sans erreur. Le droit dérive
    // désormais de l enum d appartenance, à la lecture.
    const retraitTrigger = read('supabase/migrations/20260814000100_droits_owner_admin_par_appartenance.sql');
    const adminUnique = read('supabase/migrations/20260814000200_admin_unique.sql');
    const dashboard = read('src/app/components/dashboard/DashboardOrders.tsx');

    expect(retraitTrigger).toContain('drop trigger if exists trg_sync_membership_functional_role');
    expect(retraitTrigger).toContain('drop function if exists public.sync_membership_functional_role');
    // Admin unique (décision Arnaud 2026-08-14) : owner inécrivable, l admin
    // porte toutes les capabilities par son appartenance.
    expect(adminUnique).toContain("check (role in ('admin', 'member', 'partner'))");
    expect(adminUnique).toContain("m.role = 'admin'");
    expect(adminUnique).not.toContain("p_capability <> 'can_manage_roles'");
    expect(dashboard).toContain("currentTenant?.myRole === 'admin'");
    expect(dashboard).toContain('canValidate || isTenantAdmin');
    expect(dashboard).toContain('canModifyProduction || isTenantAdmin');
  });
});
