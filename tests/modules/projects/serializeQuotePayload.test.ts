/**
 * buildQuotePayload / extractQuotePayloadAmounts — montants avant
 * persistance dans `project_items.quote_payload` (E10.1, C3 corrige suite au
 * conflit C3/C4 releve par qa-review).
 *
 * Le test unitaire precedent ne couvrait que la SERIALISATION (chaine
 * decimale) : c est exactement pour ca que le conflit avec la reprise (CA5)
 * n avait pas ete vu. Celui-ci ajoute l aller-retour complet
 * sauvegarde -> reprise -> resolvePrice(), qui est le seul test qui aurait
 * detecte la regression.
 */
import { describe, expect, it } from 'vitest';
import {
  buildQuotePayload,
  extractQuotePayloadAmounts,
  toMoneyString,
} from '@/modules/projects/ui/helpers/serializeQuotePayload';
import { resolvePrice } from '@/modules/clariprint/ui/helpers';

describe('toMoneyString', () => {
  it('serialise un flottant fini en chaine decimale a deux decimales', () => {
    expect(toMoneyString(89.9)).toBe('89.90');
    expect(toMoneyString(0)).toBe('0.00');
    expect(toMoneyString(1234)).toBe('1234.00');
  });

  it('laisse une chaine Money deja valide inchangee', () => {
    expect(toMoneyString('1234.50')).toBe('1234.50');
  });

  it('rend null pour une valeur ni flottant fini ni chaine Money valide', () => {
    expect(toMoneyString('abc')).toBeNull();
    expect(toMoneyString(Number.NaN)).toBeNull();
    expect(toMoneyString(undefined)).toBeNull();
    expect(toMoneyString(null)).toBeNull();
  });
});

describe('extractQuotePayloadAmounts', () => {
  it('extrait price et clariprintQuote.priceHT en chaine decimale', () => {
    const product = {
      id: 'p1',
      name: 'Flyer A5',
      price: 89.9,
      clariprintQuote: { success: true, priceHT: 76.4 },
    };
    const amounts = extractQuotePayloadAmounts(product);
    expect(amounts.price).toBe('89.90');
    expect(amounts.clariprint_price_ht).toBe('76.40');
  });

  it('extrait les couts Clariprint imbriques', () => {
    const product = {
      name: 'Brochure',
      clariprintQuote: {
        success: true,
        costs: { paper: 10, print: 20.5, makeready: 5, packaging: 2, delivery: 8.25, total: 45.75 },
      },
    };
    const amounts = extractQuotePayloadAmounts(product);
    expect(amounts.clariprint_costs).toEqual({
      paper: '10.00',
      print: '20.50',
      makeready: '5.00',
      packaging: '2.00',
      delivery: '8.25',
      total: '45.75',
    });
  });

  it('rend un objet vide pour un produit sans price ni clariprintQuote', () => {
    expect(extractQuotePayloadAmounts({ name: 'Sans prix' })).toEqual({});
  });
});

describe('buildQuotePayload', () => {
  it('conserve price et clariprintQuote.* EN NUMBER (CA5 en depend) et ajoute amounts en chaine', () => {
    const product = {
      name: 'Flyer A5',
      quantity: 1000,
      price: 89.9,
      clariprintQuote: { success: true, priceHT: 76.4, costs: { total: 76.4, paper: 10 } },
    };
    const payload = buildQuotePayload(product);

    // Forme de REJEU : inchangee, toujours en number.
    expect(payload['price']).toBe(89.9);
    expect(typeof payload['price']).toBe('number');
    const clariprintQuote = payload['clariprintQuote'] as Record<string, unknown>;
    expect(clariprintQuote['priceHT']).toBe(76.4);
    expect(typeof clariprintQuote['priceHT']).toBe('number');
    const costs = clariprintQuote['costs'] as Record<string, unknown>;
    expect(costs['total']).toBe(76.4);
    expect(typeof costs['total']).toBe('number');

    // Miroir Money additif, distinct, jamais lu par le chemin de reprise.
    expect(payload['amounts']).toEqual({
      price: '89.90',
      clariprint_price_ht: '76.40',
      clariprint_costs: { total: '76.40', paper: '10.00' },
    });
  });

  it('omet amounts quand aucun montant connu n est trouve', () => {
    const payload = buildQuotePayload({ name: 'Sans prix', quantity: 10 });
    expect(payload).toEqual({ name: 'Sans prix', quantity: 10 });
    expect('amounts' in payload).toBe(false);
  });

  it('ne mute jamais l objet source', () => {
    const product = { name: 'X', price: 12.3 };
    buildQuotePayload(product);
    expect(product).toEqual({ name: 'X', price: 12.3 });
  });
});

describe('aller-retour sauvegarde -> reprise -> resolvePrice (regression du conflit C3/C4)', () => {
  it('un chiffrage Clariprint valide persiste puis repris reste source clariprint, meme prix', () => {
    // 1. Sauvegarde (QuoteDialog -> AddToProjectModal -> POST /projects/{id}/items).
    const productAtSave = {
      id: 'atelier-1',
      name: 'Flyer A5',
      quantity: 1000,
      price: 76.4,
      clariprintQuote: {
        success: true,
        priceHT: 76.4,
        costs: { paper: 10, print: 20, makeready: 5, packaging: 2, delivery: 8, total: 45 },
      },
    };
    const quotePayload = buildQuotePayload(productAtSave);

    // 2. Persistance/relecture : `quote_payload` traverse JSON tel quel
    // (pas de mutation supplementaire cote API, cf. ProjectItem.quote_payload
    // au contrat, `additionalProperties: true`).
    const storedPayload = JSON.parse(JSON.stringify(quotePayload)) as Record<string, unknown>;

    // 3. Reprise (ChatInterface.tsx, effet resumeProject) : le produit rendu
    // par ProductCard est le payload etale tel quel, SANS reconversion.
    const resumedProduct = { id: 'resume-1', ...storedPayload };

    // 4. resolvePrice() doit retomber sur la branche Clariprint, PAS sur le
    // recalcul heuristique de prix marche — exactement ce que le conflit
    // C3/C4 cassait (typeof clariprintQuote.priceHT === 'number' echouait
    // sur une chaine).
    const resolution = resolvePrice(resumedProduct, (resumedProduct as any).clariprintQuote);
    expect(resolution.source).toBe('clariprint');
    expect(resolution.isMarketPrice).toBe(false);
    expect(resolution.priceHT).toBe(76.4); // le montant stocke, pas un recalcul heuristique
  });
});
