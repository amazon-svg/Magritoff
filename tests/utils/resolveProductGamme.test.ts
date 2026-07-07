/**
 * S-CAT-1 (ADR-4.17) — résolution de gamme autoritaire par catégorie explicite.
 *
 * gamme_slug (catégorie explicite) prime sur la résolution par format/taille.
 * Repli sur resolveGamme (règles) quand gamme_slug est absent.
 */

import { describe, expect, it } from 'vitest';
import { resolveProductGamme } from '../../src/app/utils/productEnrichment';
import type { Gamme } from '../../src/app/utils/productEnrichment';

const g = (slug: string, name: string, kind: string, extra: Partial<Gamme> = {}): Gamme =>
  ({ id: slug, slug, name, parent_slug: null, matching_rules: { kind }, display_order: 0, ...extra }) as Gamme;

const GAMMES: Gamme[] = [
  g('etiquette', 'Étiquettes / Stickers', 'sticker'),
  g('flyer', 'Flyers', 'flyer'),
];

describe('resolveProductGamme (ADR-4.17)', () => {
  it('la catégorie explicite (gamme_slug) prime, le format n intervient pas', () => {
    // Config qui, par règles, matcherait "flyer" ; mais gamme_slug dit "etiquette".
    const product = { config: { kind: 'flyer' }, name: 'Autocollants A5', gamme_slug: 'etiquette' };
    expect(resolveProductGamme(product, GAMMES)?.slug).toBe('etiquette');
  });

  it('repli sur la résolution par règles quand gamme_slug est absent', () => {
    const product = { config: { kind: 'flyer' }, name: 'Flyer A5' };
    expect(resolveProductGamme(product, GAMMES)?.slug).toBe('flyer');
  });

  it('repli sur les règles si gamme_slug pointe une gamme inconnue', () => {
    const product = { config: { kind: 'flyer' }, name: 'Flyer', gamme_slug: 'inexistante' };
    expect(resolveProductGamme(product, GAMMES)?.slug).toBe('flyer');
  });

  it('retourne null pour un produit vide', () => {
    expect(resolveProductGamme(null, GAMMES)).toBeNull();
    expect(resolveProductGamme(undefined, GAMMES)).toBeNull();
  });
});
