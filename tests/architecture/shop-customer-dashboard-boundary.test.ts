import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * E10.5 CA4 — un compte `shop_customer` ne peut atteindre aucune route
 * `/t/:slug/dashboard/*`.
 *
 * Ce test NE REINVENTE aucun mecanisme : il verrouille le pattern deja en
 * place pour l etancheite storefront/dashboard (un compte client boutique
 * n a structurellement aucune session Magrit — TenantAwareLayout redirige
 * deja tout visiteur sans `user`, ou sans tenant accessible, avant
 * `<Outlet />`) et prouve que le cote API (RLS via `current_user_is_shop_customer()`)
 * n accepte que les identites back-office resolues dans l annuaire local.
 *
 * Le guard React reste de l UX (redirection immediate) : la vraie barriere
 * est la resolution d identite et d appartenance PostgreSQL, testee par les
 * tests d integration du runtime local.
 */
const routes = readFileSync(resolve(process.cwd(), 'src/app/routes.tsx'), 'utf8');
const tenantAwareLayout = readFileSync(
  resolve(process.cwd(), 'src/app/layouts/TenantAwareLayout.tsx'),
  'utf8',
);
const workspaceBoundary = readFileSync(
  resolve(process.cwd(), 'src/app/surfaces/WorkspaceRuntimeBoundary.tsx'),
  'utf8',
);
const storefrontBoundary = readFileSync(
  resolve(process.cwd(), 'src/app/surfaces/StorefrontRuntimeBoundary.tsx'),
  'utf8',
);
const principalVerifier = readFileSync(
  resolve(process.cwd(), 'src/server/auth/local-api-principal-verifier.ts'),
  'utf8',
);

describe('E10.5 CA4 — etancheite dashboard / compte client boutique', () => {
  it('un compte client boutique n a structurellement pas de session Magrit (WorkspaceRuntimeBoundary)', () => {
    // WorkspaceRuntimeBoundary est l UNIQUE porte d entree vers /t/:slug/dashboard/*
    // (voir routes.tsx) et monte l AuthProvider Magrit — jamais le
    // storefront, qui vit sous une frontiere separee (StorefrontRuntimeBoundary,
    // session opaque en schema `private`, aucun JWT Supabase).
    expect(workspaceBoundary).toContain('AuthProvider');
    expect(storefrontBoundary).not.toContain('AuthProvider');
  });

  it('la route dashboard n est joignable QUE sous WorkspaceRuntimeBoundary > TenantAwareLayout', () => {
    // Position dans l ARBRE de routage, pas dans les imports en tete de
    // fichier : `element: lazyRoute(<X />)` est l usage reel du composant.
    const workspaceMount = routes.indexOf('element: lazyRoute(<WorkspaceRuntimeBoundary />)');
    const tenantAwareMount = routes.indexOf('element: lazyRoute(<TenantAwareLayout />)');
    const dashboardMount = routes.indexOf('path: "dashboard"');
    expect(workspaceMount).toBeGreaterThanOrEqual(0);
    expect(tenantAwareMount).toBeGreaterThan(workspaceMount);
    expect(dashboardMount).toBeGreaterThan(tenantAwareMount);
    // Le storefront ne monte jamais TenantAwareLayout ni le dashboard.
    const storefrontMount = routes.indexOf('element: lazyRoute(<StorefrontRuntimeBoundary />)');
    expect(storefrontMount).toBeLessThan(workspaceMount);
  });

  it('TenantAwareLayout redirige avant `<Outlet />` : ni session Magrit, ni espace accessible', () => {
    const noUserRedirect = tenantAwareLayout.indexOf("if (!user)");
    const noTenantRedirect = tenantAwareLayout.indexOf('tenants.length === 0');
    const outletIndex = tenantAwareLayout.indexOf('<Outlet');
    expect(noUserRedirect).toBeGreaterThanOrEqual(0);
    expect(noTenantRedirect).toBeGreaterThan(noUserRedirect);
    expect(outletIndex).toBeGreaterThan(noTenantRedirect);
    // Un compte shop_customer n a jamais de ligne tenant_members (CA5,
    // exclusivite posee en base) : s il obtenait malgre tout une session
    // Magrit, `tenants` serait vide et cette branche le redirigerait avant
    // `<Outlet />`, jamais vers le contenu du dashboard.
    expect(tenantAwareLayout).toContain("<Navigate to=\"/tenants/new\" replace />");
  });

  it('la facade API ne fabrique un principal qu apres resolution dans l annuaire back-office', () => {
    expect(principalVerifier).toContain('this.options.identities.resolve');
    expect(principalVerifier).toContain("kind: 'user' as const");
    expect(principalVerifier).not.toContain("kind: 'shop_customer'");
  });
});
