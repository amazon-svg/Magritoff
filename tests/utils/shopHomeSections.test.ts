/**
 * S2.15 — Tests unitaires resolveNewProducts (bloc Nouveautés home).
 *
 * "N derniers produits intégrés, triés par date d'ajout desc" (FR-ECOM-05).
 * Data-driven : tri dérivé de created_at, section vide si aucun produit.
 */

import { describe, expect, it } from 'vitest';
import { resolveNewProducts } from '../../src/app/utils/shopHomeSections';

const p = (id: string, created_at?: string) =>
  ({ id, created_at }) as { id: string; created_at?: string };

describe('shopHomeSections — resolveNewProducts', () => {
  it('trie par date d ajout décroissante', () => {
    const list = [
      p('a', '2026-01-01T00:00:00Z'),
      p('c', '2026-03-01T00:00:00Z'),
      p('b', '2026-02-01T00:00:00Z'),
    ];
    expect(resolveNewProducts(list as never, 4).map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('plafonne au nombre demandé', () => {
    const list = Array.from({ length: 10 }, (_, i) =>
      p(String(i), `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`),
    );
    expect(resolveNewProducts(list as never, 4).length).toBe(4);
  });

  it('retourne [] si aucun produit', () => {
    expect(resolveNewProducts([], 4)).toEqual([]);
  });

  it('place les produits sans date en fin (jamais en tête de Nouveautés)', () => {
    const list = [p('nodate'), p('recent', '2026-05-01T00:00:00Z')];
    expect(resolveNewProducts(list as never, 4).map((x) => x.id)).toEqual(['recent', 'nodate']);
  });
});
