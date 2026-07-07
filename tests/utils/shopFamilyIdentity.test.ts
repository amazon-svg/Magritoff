/**
 * Cohérence nav (2026-07-07) — repère famille unifié sur la gamme PIM.
 * Le badge carte, le méga-menu et les pilules doivent désigner la même famille
 * (gamme racine), pas les 7 familles mockup.
 */

import { describe, expect, it } from 'vitest';
import {
  resolveRootFamilyIdentity,
  resolveShopFamily,
} from '../../src/app/utils/shopFamilyIdentity';
import type { Gamme } from '../../src/app/utils/productEnrichment';

const g = (slug: string, name: string, parent: string | null, kind: string): Gamme =>
  ({ id: slug, slug, name, parent_slug: parent, matching_rules: { kind }, display_order: 0 }) as Gamme;

const GAMMES: Gamme[] = [
  g('affiche', 'Affiches', null, 'affiche'),
  g('affiche_a2', 'Affiche A2', 'affiche', 'affichea2'),
  g('flyer', 'Flyers', null, 'flyer'),
];

describe('shopFamilyIdentity — resolveRootFamilyIdentity', () => {
  it('mappe les familles PIM connues (Affiches = rouge, propre libellé)', () => {
    const id = resolveRootFamilyIdentity('affiche', 'Affiches');
    expect(id.label).toBe('Affiches');
    expect(id.tone).toBe('#DC2626');
    expect(id.icon).toBeTruthy();
  });

  it('retombe sur un repère neutre pour un slug inconnu (jamais vide)', () => {
    const id = resolveRootFamilyIdentity('mystere', 'Mystère');
    expect(id.label).toBe('Mystère');
    expect(id.tone).toMatch(/^#/);
  });
});

describe('shopFamilyIdentity — resolveShopFamily (unifié gamme)', () => {
  it('un produit rattaché à une sous-gamme prend la famille RACINE (Affiche A2 → Affiches)', () => {
    const product = { config: { kind: 'affichea2' }, name: 'Affiche A2 brillante' };
    const fam = resolveShopFamily(product, GAMMES);
    expect(fam.key).toBe('affiche');
    expect(fam.label).toBe('Affiches');
  });

  it('repli sur la famille mockup si le produit ne matche aucune gamme', () => {
    const product = { config: {}, name: 'Objet non catalogué' };
    const fam = resolveShopFamily(product, GAMMES);
    // pas de gamme → repli mockup (label non vide, tone hex)
    expect(fam.label.length).toBeGreaterThan(0);
    expect(fam.tone).toMatch(/^#/);
  });

  it('sans gammes fournies, repli mockup direct', () => {
    const fam = resolveShopFamily({ config: { kind: 'flyer' }, name: 'Flyer' }, []);
    expect(fam.tone).toMatch(/^#/);
  });
});
