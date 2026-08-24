import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const context = readFileSync(resolve(process.cwd(), 'src/modules/tenants/ui/runtime/TenantContext.tsx'), 'utf8');
const picker = readFileSync(resolve(process.cwd(), 'src/modules/tenants/ui/workspace/TenantPickerPage.tsx'), 'utf8');
const layout = readFileSync(resolve(process.cwd(), 'src/app/layouts/TenantAwareLayout.tsx'), 'utf8');
const failure = readFileSync(resolve(process.cwd(), 'src/modules/tenants/ui/components/TenantLoadError.tsx'), 'utf8');

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
});
