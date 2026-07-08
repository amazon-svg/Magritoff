/**
 * S2.13 — Tests unitaires productAttributeChips.
 *
 * Puces d'attributs clés sur la card : réutilisent les extracteurs PIM existants
 * (resolveTemplate de productEnrichment). Règles UX §1 :
 *  - jusqu'à 3 puces normalisées par famille ;
 *  - seules les puces avec valeur s'affichent (pas de puce vide) ;
 *  - comparables d'un produit à l'autre de la même famille.
 */

import { describe, expect, it } from 'vitest';
import { resolveProductChips } from '../../src/app/utils/productAttributeChips';

describe('productAttributeChips — resolveProductChips', () => {
  it('extrait format + grammage + finition pour une carte de visite', () => {
    const chips = resolveProductChips({
      config: {
        kind: 'carte_visite',
        width: 85,
        height: 55,
        weight: 350,
        finishing_front: 'Pelliculage mat',
      },
    });
    const values = chips.map((c) => c.value);
    expect(values).toContain('85×55 mm');
    expect(values.some((v) => v.includes('350'))).toBe(true);
    expect(values).toContain('Pelliculage mat');
    expect(chips.length).toBeLessThanOrEqual(3);
  });

  it('plafonne à 3 puces', () => {
    const chips = resolveProductChips({
      config: {
        kind: 'flyer',
        width: 148,
        height: 210,
        weight: 135,
        finishing_front: 'Brillant',
        quantity: 500,
        material: 'Couché',
      },
    });
    expect(chips.length).toBe(3);
  });

  it('ne retourne que les puces renseignées (config vide → aucune)', () => {
    expect(resolveProductChips({ config: {} })).toEqual([]);
    expect(resolveProductChips({})).toEqual([]);
  });

  it('chaque puce porte un label (a11y/title) + une valeur', () => {
    const chips = resolveProductChips({ config: { kind: 'flyer', width: 148, height: 210 } });
    expect(chips.length).toBeGreaterThan(0);
    for (const c of chips) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.value.length).toBeGreaterThan(0);
    }
  });
});
