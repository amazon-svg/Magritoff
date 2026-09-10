import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const context = readFileSync(resolve(process.cwd(), 'src/modules/tenants/ui/runtime/TenantContext.tsx'), 'utf8');
const bootstrapContext = readFileSync(resolve(process.cwd(), 'src/modules/session/ui/runtime/SessionBootstrapContext.tsx'), 'utf8');
const picker = readFileSync(resolve(process.cwd(), 'src/modules/tenants/ui/workspace/TenantPickerPage.tsx'), 'utf8');
const layout = readFileSync(resolve(process.cwd(), 'src/app/layouts/TenantAwareLayout.tsx'), 'utf8');
const failure = readFileSync(resolve(process.cwd(), 'src/modules/tenants/ui/components/TenantLoadError.tsx'), 'utf8');
const appShell = readFileSync(resolve(process.cwd(), 'src/app/AppShell.tsx'), 'utf8');
const signupModal = readFileSync(resolve(process.cwd(), 'src/modules/account/ui/auth/SignupModal.tsx'), 'utf8');
const routes = readFileSync(resolve(process.cwd(), 'src/app/routes.tsx'), 'utf8');
const routeError = readFileSync(resolve(process.cwd(), 'src/app/layouts/RouteErrorPage.tsx'), 'utf8');

describe('échec du bootstrap des espaces Magrit', () => {
  it('propage l erreur sans la convertir en liste vide métier', () => {
    expect(context).toContain('error: bootstrap.error');
    expect(context).toContain('!bootstrap.error && dataForUser === null');
  });

  it('bloque les redirections picker et tenant avant leur branche zéro espace', () => {
    expect(picker.indexOf('if (user && error)')).toBeLessThan(picker.indexOf('if (tenants.length === 0)'));
    expect(layout.indexOf('if (user && error)')).toBeLessThan(layout.indexOf('if (tenants.length === 0)'));
  });

  it('explique que la session subsiste et propose un rejeu', () => {
    expect(failure).toContain('Votre session est toujours active');
    expect(failure).toContain('Aucun nouvel espace n’est nécessaire');
    expect(failure).toContain('Réessayer');
  });

  it('monte le bootstrap session avant le provider tenant qui le consomme', () => {
    expect(appShell.indexOf('<SessionBootstrapProvider')).toBeLessThan(
      appShell.indexOf('<TenantProvider>'),
    );
    expect(appShell).toContain('<SessionBootstrapProvider apiClient={client}>');
    expect(bootstrapContext).toContain('new SessionApiClient(apiClient)');
  });

  it('ne demande une confirmation email que lorsque le signup ne cree pas de session', () => {
    expect(signupModal).toContain("session ? 'authenticated' : 'confirmation_pending'");
    expect(signupModal).toContain("success === 'confirmation_pending'");
    expect(signupModal).toContain('Vous êtes maintenant connecté');
    expect(signupModal).toContain('Revenir à la connexion');
  });

  it('remplace l erreur technique du routeur par une recuperation comprehensible', () => {
    expect(routes.match(/errorElement: <RouteErrorPage \/>/g)).toHaveLength(2);
    expect(routeError).toContain('Impossible de charger cette page');
    expect(routeError).toContain('Recharger la page');
    expect(routeError).toContain('window.location.reload()');
  });
});
