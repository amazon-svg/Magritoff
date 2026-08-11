/**
 * Tests vitest des ZONES MONETAIRES du prix marche.
 *
 * Arbitrage Arnaud du 2026-08-10 : « il verra un prix marche relevant
 * d imprimeurs ayant la meme monnaie que lui […] nous reserverons le droit de
 * rendre un prix marche d une monnaie X accessible dans une zone Y ».
 *
 * Ce que ces tests verrouillent :
 *   1. la zone EUR sert les memes valeurs qu avant le chantier (non-regression) ;
 *   2. une devise SANS zone calibree ne recoit AUCUN prix — jamais un prix
 *      d une autre zone simplement relibelle ;
 *   3. l ouverture inter-zones est inactive par defaut (droit reserve).
 */

import { describe, it, expect } from 'vitest';
import {
  MARKET_PRICE_ZONES,
  resolveMarketPriceFamily,
  resolveMarketPriceZone,
} from '../../src/app/utils/marketPriceZones';
import { estimateMarketPriceHT, resolvePrice } from '../../src/app/utils/priceResolver';

describe('resolveMarketPriceZone — une zone par devise', () => {
  it('EUR → zone calibree (heuristique historique)', () => {
    const zone = resolveMarketPriceZone('EUR');
    expect(zone).not.toBeNull();
    expect(zone!.currency).toBe('EUR');
    expect(zone!.status).toBe('heuristique');
    expect(zone!.basePerUnit).not.toBeNull();
  });

  it('USD → zone declaree mais NON calibree → null', () => {
    // La zone existe dans le registre (la cible est actee), mais les prix
    // d imprimeurs en dollars ne sont pas collectes : elle ne sert rien.
    expect(MARKET_PRICE_ZONES.USD).toBeDefined();
    expect(MARKET_PRICE_ZONES.USD.status).toBe('a_calibrer');
    expect(resolveMarketPriceZone('USD')).toBeNull();
  });

  it('devise hors registre (CHF, GBP, JPY) → null', () => {
    expect(resolveMarketPriceZone('CHF')).toBeNull();
    expect(resolveMarketPriceZone('GBP')).toBeNull();
    expect(resolveMarketPriceZone('JPY')).toBeNull();
  });

  it('sans argument → zone par defaut (EUR)', () => {
    expect(resolveMarketPriceZone()?.currency).toBe('EUR');
  });

  it("l ouverture inter-zones est un droit RESERVE, inactif aujourd hui", () => {
    // Un `foreignZoneAccess` non vide signifierait qu on accepte de servir un
    // prix calibre dans une autre devise. Aucune zone ne le fait pour l instant.
    for (const zone of Object.values(MARKET_PRICE_ZONES)) {
      expect(zone.foreignZoneAccess).toEqual([]);
    }
  });
});

describe('resolveMarketPriceFamily — reconnaissance de famille (independante de la devise)', () => {
  it('reconnait les familles calibrees', () => {
    expect(resolveMarketPriceFamily('Cartes de visite')).toBe('carte_visite');
    expect(resolveMarketPriceFamily('Flyer A5')).toBe('flyer');
    expect(resolveMarketPriceFamily('Tract militant')).toBe('flyer');
    expect(resolveMarketPriceFamily('Brochure 24 pages')).toBe('brochure');
    expect(resolveMarketPriceFamily('Catalogue produits')).toBe('brochure');
    expect(resolveMarketPriceFamily('Affiche A1')).toBe('affiche');
    expect(resolveMarketPriceFamily('Dépliant 3 volets')).toBe('depliant');
    expect(resolveMarketPriceFamily('Étiquette adhesive')).toBe('etiquette');
    expect(resolveMarketPriceFamily('Roll-up 85x200')).toBe('kakemono');
    expect(resolveMarketPriceFamily('Boite pliante')).toBe('packaging');
  });

  it('famille inconnue → default', () => {
    expect(resolveMarketPriceFamily('Objet non identifie')).toBe('default');
    expect(resolveMarketPriceFamily('')).toBe('default');
  });
});

describe('estimateMarketPriceHT — le prix suit la zone, jamais la conversion', () => {
  const flyer = { name: 'Flyer A5', quantity: 500 };

  it('EUR → valeur inchangee par rapport a avant le chantier (non-regression)', () => {
    // 0.12 * 500 = 60, aucune majoration applicable sur ce produit nu.
    expect(estimateMarketPriceHT(flyer, undefined, 'EUR')).toBe(60);
  });

  it('devise par defaut → identique a EUR', () => {
    expect(estimateMarketPriceHT(flyer)).toBe(estimateMarketPriceHT(flyer, undefined, 'EUR'));
  });

  it('USD → 0, PAS la valeur euro relibellee (le coeur de l arbitrage)', () => {
    // C est le defaut que l arbitrage corrige : avant, un imprimeur en dollars
    // recevait 60 — une valeur calibree en euros, affichee en dollars.
    expect(estimateMarketPriceHT(flyer, undefined, 'USD')).toBe(0);
  });

  it('CHF → 0 (aucune zone)', () => {
    expect(estimateMarketPriceHT(flyer, undefined, 'CHF')).toBe(0);
  });

  it('le plancher vient de la zone', () => {
    // Quantite 1 sur une etiquette : 0.04 → sous le plancher de 1.
    expect(estimateMarketPriceHT({ name: 'Étiquette', quantity: 1 }, undefined, 'EUR')).toBe(1);
  });

  it('quantityOverride reste prioritaire, zone respectee', () => {
    expect(estimateMarketPriceHT(flyer, 1000, 'EUR')).toBe(0.12 * 1000 * 0.9);
    expect(estimateMarketPriceHT(flyer, 1000, 'USD')).toBe(0);
  });
});

describe('resolvePrice — la cascade tombe sur zero sans zone calibree', () => {
  const nu = { name: 'Flyer A5', quantity: 500 };

  it('EUR sans cache ni Clariprint → source prix_marche', () => {
    const res = resolvePrice(nu, null, 'EUR');
    expect(res.source).toBe('prix_marche');
    expect(res.priceHT).toBeGreaterThan(0);
    expect(res.isMarketPrice).toBe(true);
  });

  it('USD sans cache ni Clariprint → source zero (« Prix sur demande »)', () => {
    const res = resolvePrice(nu, null, 'USD');
    expect(res.source).toBe('zero');
    expect(res.priceHT).toBe(0);
  });

  it('USD AVEC prix en cache bibliotheque → le cache passe avant la zone', () => {
    // Le prix en cache est un montant deja saisi ou calcule pour cet
    // imprimeur : il est dans SA devise, la zone ne le concerne pas.
    const res = resolvePrice({ ...nu, price_ht: 42 }, null, 'USD');
    expect(res.source).toBe('library_cached');
    expect(res.priceHT).toBe(42);
  });

  it('USD AVEC devis Clariprint valide → Clariprint passe avant la zone', () => {
    const res = resolvePrice(nu, { success: true, priceHT: 99 } as never, 'USD');
    expect(res.source).toBe('clariprint');
    expect(res.priceHT).toBe(99);
  });
});
