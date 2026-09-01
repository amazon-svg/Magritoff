/**
 * formatClariprintAmount — bloc « Succès Clariprint » de ProductCardPrix
 * (E10.1, qa-review conflit C3/C4).
 *
 * Pas de rendu DOM possible ici (vitest tourne en `environment: node`, pas
 * de @testing-library/react dans ce depot — voir tests/contexts/CartContext.test.ts).
 * Ce test couvre donc directement la fonction qui a remplace l appel brut
 * `.toFixed()` responsable du crash de rendu (`TypeError: ... .toFixed is
 * not a function`) quand un montant Clariprint arrivait en chaine plutot
 * qu en number.
 */
import { describe, expect, it } from 'vitest';
import { formatClariprintAmount } from '@/modules/catalog/ui/product-card/clariprintAmount';

describe('formatClariprintAmount', () => {
  it('formate un number fini a deux decimales (cas nominal)', () => {
    expect(formatClariprintAmount(76.4)).toBe('76.40');
    expect(formatClariprintAmount(0)).toBe('0.00');
    expect(formatClariprintAmount(45)).toBe('45.00');
  });

  it('ne plante jamais sur une chaine (regression du conflit C3/C4) et la convertit si numerique', () => {
    expect(() => formatClariprintAmount('76.40')).not.toThrow();
    expect(formatClariprintAmount('76.40')).toBe('76.40');
  });

  it('rend "0.00" pour toute valeur non exploitable, sans jamais lever', () => {
    expect(formatClariprintAmount('abc')).toBe('0.00');
    expect(formatClariprintAmount(undefined)).toBe('0.00');
    expect(formatClariprintAmount(null)).toBe('0.00');
    expect(formatClariprintAmount(Number.NaN)).toBe('0.00');
    expect(() => formatClariprintAmount({})).not.toThrow();
  });
});
