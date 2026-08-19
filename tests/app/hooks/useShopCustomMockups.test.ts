import { describe, expect, it } from 'vitest';
import {
  indexShopCustomMockups,
  shopCustomMockupError,
} from '../../../src/app/hooks/useShopCustomMockups';
import type { ShopCustomMockup } from '../../../src/modules/shops';

describe('useShopCustomMockups helpers', () => {
  it('indexe chaque vue par type et face', () => {
    const records = [
      { id: 'one', templateType: 'flyer', view: 'front' },
      { id: 'two', templateType: 'brochure', view: 'front' },
    ] as ShopCustomMockup[];

    expect(indexShopCustomMockups(records)).toMatchObject({
      'flyer-front': { id: 'one' },
      'brochure-front': { id: 'two' },
    });
  });

  it('normalise une erreur réseau sans contrat', () => {
    expect(shopCustomMockupError(new Error('Stockage indisponible'), 'Erreur inconnue'))
      .toBe('Stockage indisponible');
    expect(shopCustomMockupError(null, 'Erreur inconnue')).toBe('Erreur inconnue');
  });
});
