import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspaceHomePath } from '@/app/layouts/header-navigation';

describe('lien vers l espace courant dans la barre supérieure', () => {
  it('construit la route canonique de l accueil tenant', () => {
    expect(workspaceHomePath('atelier-paris')).toBe('/t/atelier-paris');
    expect(workspaceHomePath('atelier test')).toBe('/t/atelier%20test');
  });

  it('affiche le nom du tenant courant comme lien accessible à côté de Magrit', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/layouts/Header.tsx'),
      'utf8',
    );

    expect(source).toContain('TEST_IDS.nav.currentSpaceLink');
    expect(source).toContain('workspaceHomePath(currentTenant.slug)');
    expect(source).toContain('Ouvrir l’espace ${currentTenant.name}');
    expect(source).toContain('{currentTenant.name}');
  });
});
