/**
 * S2.15 — Tests unitaires resolveNewProducts (bloc Nouveautés home).
 *
 * "N derniers produits intégrés, triés par date d'ajout desc" (FR-ECOM-05).
 * Data-driven : tri dérivé de created_at, section vide si aucun produit.
 */

import { describe, expect, it } from 'vitest';
import { resolveNewProducts, summarizeCartResume } from '../../src/app/utils/shopHomeSections';

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

// ─── S2.16 — Panier en cours / reprise (home boutique) ──────────────────────

const line = (price_ht: number | null | undefined, qty: number) =>
  ({ product: { price_ht }, qty }) as { product: { price_ht?: number | null }; qty: number };

describe('shopHomeSections — summarizeCartResume (S2.16)', () => {
  it('retourne null si le panier est vide (repli AC3, section masquée)', () => {
    expect(summarizeCartResume([])).toBeNull();
  });

  it('compte les lignes, la somme des quantités et le total HT', () => {
    const cart = [line(10, 2), line(5, 3)]; // 20 + 15
    expect(summarizeCartResume(cart)).toEqual({ lineCount: 2, itemCount: 5, totalHT: 35 });
  });

  it('ignore les prix manquants/invalides sans casser le total', () => {
    const cart = [line(undefined, 2), line(null, 1), line(8, 2)]; // seul 8*2 compte
    expect(summarizeCartResume(cart)).toEqual({ lineCount: 3, itemCount: 5, totalHT: 16 });
  });

  it('ignore les quantités non positives dans itemCount et le total', () => {
    const cart = [line(10, 0), line(10, -3), line(10, 2)];
    expect(summarizeCartResume(cart)).toEqual({ lineCount: 3, itemCount: 2, totalHT: 20 });
  });
});
