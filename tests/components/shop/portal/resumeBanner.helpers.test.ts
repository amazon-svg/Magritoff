/**
 * Tests unitaires S7.9 — buildResumeChips (chips dérivés de la donnée).
 */

import { describe, expect, it } from 'vitest';
import {
  buildResumeChips,
  type ResumeLastOrder,
} from '@/modules/orders/ui/storefront/ResumeBanner';

const order = (over: Partial<ResumeLastOrder> = {}): ResumeLastOrder => ({
  id: 'o-1',
  status: 'validated',
  total_ht: 152,
  created_at: '2026-07-20T10:00:00Z',
  source: 'v1_1',
  ...over,
});

describe('buildResumeChips (S7.9 AC1/AC2)', () => {
  it('tout vide → aucun chip (le bandeau ne se rend pas)', () => {
    expect(buildResumeChips({ cartCount: 0, cartTotalHT: 0, lastOrder: null })).toEqual([]);
  });

  it('panier seul → chip cart avec montant HT', () => {
    const chips = buildResumeChips({ cartCount: 2, cartTotalHT: 84, lastOrder: null });
    expect(chips).toHaveLength(1);
    expect(chips[0].key).toBe('cart');
    expect(chips[0].label).toContain('84,00');
    expect(chips[0].label).toContain('HT');
  });

  it('panier à montant nul → chip cart sans « 0 € »', () => {
    const chips = buildResumeChips({ cartCount: 1, cartTotalHT: 0, lastOrder: null });
    expect(chips[0].label).toBe('Reprendre mon panier');
  });

  it('commande v1_1 → chips renouveler (date + montant) + suivi (statut FR)', () => {
    const chips = buildResumeChips({ cartCount: 0, cartTotalHT: 0, lastOrder: order() });
    expect(chips.map((c) => c.key)).toEqual(['renew', 'track']);
    expect(chips[0].label).toContain('20/07');
    expect(chips[0].label).toContain('152,00');
    expect(chips[1].label).toContain('validée');
  });

  it('commande legacy (non v1_1) → pas de renouvellement, suivi seulement', () => {
    const chips = buildResumeChips({
      cartCount: 0,
      cartTotalHT: 0,
      lastOrder: order({ source: 'legacy' }),
    });
    expect(chips.map((c) => c.key)).toEqual(['track']);
  });

  it('panier + commande → 3 chips dans l ordre cart, renew, track', () => {
    const chips = buildResumeChips({ cartCount: 1, cartTotalHT: 50, lastOrder: order() });
    expect(chips.map((c) => c.key)).toEqual(['cart', 'renew', 'track']);
  });

  it('statut inconnu → affiché tel quel (pas de crash), date invalide → tiret', () => {
    const chips = buildResumeChips({
      cartCount: 0,
      cartTotalHT: 0,
      lastOrder: order({ status: 'exotique', created_at: 'nope' }),
    });
    expect(chips[0].label).toContain('—');
    expect(chips[1].label).toContain('exotique');
  });
});
