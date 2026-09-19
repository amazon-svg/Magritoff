/**
 * Q14-a (docs/api/CONVENTIONS.md §8.25 point 3.7) — fonctions pures
 * `canAddAsIs` et `addToCartButtonState`, cas par cas, comme demandé par le
 * cadrage (point 3.7 (b-bis) 4).
 */

import { describe, expect, it } from 'vitest';
import {
  ADD_AS_IS_REASON_LABELS,
  addToCartButtonState,
  canAddAsIs,
  isFirmPriceSource,
  type AddAsIsEligibility,
} from '@/modules/catalog/ui/storefront/addAsIs';
import type { ShopProduct } from '@/modules/shops';
import type { ClariprintQuoteResult } from '@/modules/clariprint';
import type { PriceResolution } from '@/modules/clariprint/ui/helpers';

function makeProduct(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    id: 'prod-1',
    shop_id: 'shop-1',
    product_id: null,
    name: 'Flyers A5 recto-verso',
    category: 'leaflet',
    description: '',
    price_ht: 0,
    image_url: '',
    config: {},
    display_order: 0,
    ...overrides,
  };
}

const successfulQuote: ClariprintQuoteResult = {
  success: true,
  priceHT: 42.5,
};

describe('canAddAsIs — point 3.7 (a), C2 seule (Q14-a)', () => {
  it('source clariprint (quote reussi) -> ok', () => {
    const product = makeProduct({ price_ht: 0 });
    const eligibility = canAddAsIs(product, successfulQuote);
    expect(eligibility).toEqual({ ok: true });
  });

  it('source library_cached (price_ht en cache, pas de quote) -> ok', () => {
    const product = makeProduct({ price_ht: 35 });
    const eligibility = canAddAsIs(product, null);
    expect(eligibility).toEqual({ ok: true });
  });

  it('source prix_marche (heuristique, aucun cache) -> price-not-firm', () => {
    const product = makeProduct({ name: 'Flyer A5', price_ht: 0 });
    const eligibility = canAddAsIs(product, null);
    expect(eligibility).toEqual({ ok: false, reason: 'price-not-firm' });
  });

  it('source zero (aucun nom, quantite nulle -> estimateMarketPriceHT rend 0) -> price-not-firm', () => {
    // `estimateMarketPriceHT` retombe sur 0 UNIQUEMENT quand le nom est vide
    // ET que la quantite resolue vaut 0 (le plancher a 1 EUR ne s applique
    // que si `name` est non vide) : c est la seule combinaison qui produit
    // reellement la source `zero` de `resolvePrice`.
    const product = makeProduct({ name: '', price_ht: 0, config: { quantity: 0 } });
    const eligibility = canAddAsIs(product, null);
    expect(eligibility).toEqual({ ok: false, reason: 'price-not-firm' });
  });

  it('produit a price_ht = 0 sans devis (source resolue prix_marche) -> price-not-firm', () => {
    // C'est le cas nomme par le cadrage : un produit dont price_ht vaut 0,
    // sans quote Clariprint reussi, retombe sur le prix marche heuristique
    // (jamais sur `zero`, tant qu'un nom de produit permet d'estimer).
    const product = makeProduct({ name: 'Brochure catalogue', price_ht: 0 });
    const eligibility = canAddAsIs(product, null);
    expect(eligibility).toEqual({ ok: false, reason: 'price-not-firm' });
  });

  it('un quote Clariprint en echec (success: false) retombe sur le prix marche -> price-not-firm', () => {
    const product = makeProduct({ name: 'Flyer A5', price_ht: 0 });
    const failedQuote: ClariprintQuoteResult = { success: false, error: 'not_priced' };
    const eligibility = canAddAsIs(product, failedQuote);
    expect(eligibility).toEqual({ ok: false, reason: 'price-not-firm' });
  });

  // Reserve tranchee par l architecte (point 3.7 (b-ter), "Reserves",
  // 2026-09-17) : un devis Clariprint REUSSI a priceHT: 0 doit echouer,
  // quelle que soit la source — un bouton actif sur une carte a 0 EUR
  // contredirait la regle "jamais 0 EUR" du point 4.
  it('devis Clariprint reussi a priceHT: 0 -> price-not-firm, MEME source clariprint', () => {
    const product = makeProduct({ price_ht: 0 });
    const zeroQuote: ClariprintQuoteResult = { success: true, priceHT: 0 };
    const eligibility = canAddAsIs(product, zeroQuote);
    expect(eligibility).toEqual({ ok: false, reason: 'price-not-firm' });
  });

  it('devis Clariprint reussi a priceHT positif -> ok (non-regression de la reserve precedente)', () => {
    const product = makeProduct({ price_ht: 0 });
    const eligibility = canAddAsIs(product, successfulQuote);
    expect(eligibility).toEqual({ ok: true });
  });
});

describe('isFirmPriceSource — reserve non bloquante de la qa-review round 1', () => {
  it('clariprint et library_cached -> true', () => {
    expect(isFirmPriceSource('clariprint')).toBe(true);
    expect(isFirmPriceSource('library_cached')).toBe(true);
  });

  it('prix_marche et zero -> false', () => {
    expect(isFirmPriceSource('prix_marche')).toBe(false);
    expect(isFirmPriceSource('zero')).toBe(false);
  });

  it('une source HORS enumeration (defense en profondeur, liste blanche jamais liste noire) -> false', () => {
    // Une liste NOIRE (`!== 'prix_marche' && !== 'zero'`) rendrait `true` ici
    // — c'est exactement la mutation que la reserve de la qa-review vise a
    // empecher de survivre. Le forçage de type est deliberement force par
    // `as` : ce cas ne peut survenir qu'en defense en profondeur (bug de
    // resolvePrice, evolution future de PriceSource).
    const forgedSource = 'unknown_future_source' as unknown as PriceResolution['source'];
    expect(isFirmPriceSource(forgedSource)).toBe(false);
  });
});

describe('ADD_AS_IS_REASON_LABELS — table fermee, point 3.7 (b-bis) 1', () => {
  it('chaque motif a un libelle non vide', () => {
    for (const reason of Object.keys(ADD_AS_IS_REASON_LABELS) as Array<
      keyof typeof ADD_AS_IS_REASON_LABELS
    >) {
      expect(ADD_AS_IS_REASON_LABELS[reason].length).toBeGreaterThan(0);
    }
  });

  it('les libelles sont deux a deux distincts', () => {
    const values = Object.values(ADD_AS_IS_REASON_LABELS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('le libelle de price-not-firm est EXACTEMENT la chaine du cadrage', () => {
    expect(ADD_AS_IS_REASON_LABELS['price-not-firm']).toBe(
      'Configurez ce produit pour obtenir son prix définitif.',
    );
  });

  it('le libelle de config-incomplete (Q14-b) est deja fixe pour ne rien laisser a inventer', () => {
    expect(ADD_AS_IS_REASON_LABELS['config-incomplete']).toBe(
      'Configurez ce produit pour préciser ses caractéristiques.',
    );
  });
});

describe('addToCartButtonState — point 3.7 (b-bis) 2', () => {
  it('eligibilite ok -> disabled: false, aucune description', () => {
    const state = addToCartButtonState({ ok: true }, 'reason-id-1');
    expect(state.disabled).toBe(false);
    expect(state.describedBy).toBeUndefined();
    expect(state.reason).toBeUndefined();
    expect(state.label).toBeUndefined();
  });

  it('echec -> disabled: true, describedBy EGAL a l identifiant passe, label EGAL a la table', () => {
    const eligibility: AddAsIsEligibility = { ok: false, reason: 'price-not-firm' };
    const state = addToCartButtonState(eligibility, 'add-as-is-reason-prod-42');
    expect(state).toEqual({
      disabled: true,
      describedBy: 'add-as-is-reason-prod-42',
      reason: 'price-not-firm',
      label: ADD_AS_IS_REASON_LABELS['price-not-firm'],
    });
  });

  it('lit REELLEMENT la table (motif config-incomplete -> son propre libelle, pas celui de price-not-firm)', () => {
    // Mutation exigee au cadrage (point 3.7 (b-ter) 4) : "remplacer la table
    // par un litteral" doit rougir. Un litteral fige sur le SEUL motif que
    // Q14-a produit aujourd'hui (`price-not-firm`) ne serait pas vu par les
    // tests ci-dessus, qui n'exercent que ce motif : ce test force l'appel a
    // consulter la table pour un AUTRE motif de l'union.
    const eligibility: AddAsIsEligibility = { ok: false, reason: 'config-incomplete' };
    const state = addToCartButtonState(eligibility, 'reason-config-incomplete');
    expect(state.label).toBe(ADD_AS_IS_REASON_LABELS['config-incomplete']);
    expect(state.label).not.toBe(ADD_AS_IS_REASON_LABELS['price-not-firm']);
  });

  it('deux instances de la meme carte recoivent deux identifiants distincts, non recycles', () => {
    const eligibility: AddAsIsEligibility = { ok: false, reason: 'price-not-firm' };
    const first = addToCartButtonState(eligibility, 'reason-instance-a');
    const second = addToCartButtonState(eligibility, 'reason-instance-b');
    expect(first.describedBy).not.toBe(second.describedBy);
  });
});
