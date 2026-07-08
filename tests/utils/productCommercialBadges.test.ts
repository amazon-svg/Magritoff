/**
 * S2.12 — Tests unitaires productCommercialBadges.
 *
 * Le système de badges commerciaux doit :
 *  - ne montrer QUE les badges dont le flag est vrai (data-driven) ;
 *  - respecter la priorité Express > Nouveau > Meilleure vente > Éco (UX §1) ;
 *  - plafonner à 2 badges visibles ;
 *  - fournir label + tonalité sémantique neutre par badge ;
 *  - dériver "Nouveau" d'une fenêtre de récence (fenêtre AUDIT-PENDING, testée
 *    par injection explicite du paramètre).
 */

import { describe, expect, it } from 'vitest';
import {
  resolveCommercialBadges,
  isRecentlyAdded,
  BADGE_META,
  BADGE_PRIORITY,
  type CommercialBadgeKind,
} from '../../src/app/utils/productCommercialBadges';

describe('productCommercialBadges — resolveCommercialBadges', () => {
  it('ne retourne aucun badge quand aucun flag actif (silence visuel)', () => {
    expect(resolveCommercialBadges({})).toEqual([]);
    expect(
      resolveCommercialBadges({ eco: false, isNew: false, bestseller: false, express: false }),
    ).toEqual([]);
  });

  it('respecte la priorité Express > Nouveau > Meilleure vente > Éco', () => {
    const all = resolveCommercialBadges({
      eco: true,
      isNew: true,
      bestseller: true,
      express: true,
    });
    // cap 2 → seuls les 2 plus prioritaires
    expect(all).toEqual(['express', 'new']);
  });

  it('plafonne à 2 badges', () => {
    const r = resolveCommercialBadges({ isNew: true, bestseller: true, eco: true });
    expect(r.length).toBe(2);
    expect(r).toEqual(['new', 'bestseller']);
  });

  it('retourne un seul badge si un seul flag', () => {
    expect(resolveCommercialBadges({ eco: true })).toEqual(['eco']);
  });
});

describe('productCommercialBadges — métadonnées', () => {
  it('chaque badge a un label FR + une tonalité sémantique', () => {
    const kinds: CommercialBadgeKind[] = ['express', 'new', 'bestseller', 'eco'];
    for (const k of kinds) {
      expect(BADGE_META[k].label.length).toBeGreaterThan(0);
      expect(['ok', 'warn', 'info', 'accent']).toContain(BADGE_META[k].tone);
    }
  });

  it('la priorité couvre exactement les 4 badges', () => {
    expect([...BADGE_PRIORITY].sort()).toEqual(['bestseller', 'eco', 'express', 'new'].sort());
  });
});

describe('productCommercialBadges — isRecentlyAdded (fenêtre injectée)', () => {
  const now = new Date('2026-07-07T00:00:00Z');

  it('vrai si créé dans la fenêtre', () => {
    const d = new Date('2026-07-01T00:00:00Z').toISOString(); // 6 j
    expect(isRecentlyAdded(d, 30, now)).toBe(true);
  });

  it('faux si créé hors fenêtre', () => {
    const d = new Date('2026-05-01T00:00:00Z').toISOString(); // 67 j
    expect(isRecentlyAdded(d, 30, now)).toBe(false);
  });

  it('faux si date absente ou invalide (jamais de faux positif)', () => {
    expect(isRecentlyAdded(undefined, 30, now)).toBe(false);
    expect(isRecentlyAdded('pas-une-date', 30, now)).toBe(false);
  });
});
