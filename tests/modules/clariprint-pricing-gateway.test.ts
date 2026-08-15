import { describe, expect, it } from 'vitest';
import {
  ClariprintPricingError,
  computeClariprintQuoteSafe,
  type ClariprintPricingGateway,
} from '../../src/modules/clariprint';

function gateway(
  computePrice: ClariprintPricingGateway['computePrice'],
): ClariprintPricingGateway {
  return { computePrice, async testConnection() { return { ok: true }; } };
}

describe('computeClariprintQuoteSafe', () => {
  it('ne contacte pas la passerelle sans configuration', async () => {
    let called = false;
    const result = await computeClariprintQuoteSafe(gateway(async () => {
      called = true;
      return { success: true, priceHT: 1 };
    }), null);

    expect(called).toBe(false);
    expect(result).toEqual({ success: false, error: 'Configuration produit absente' });
  });

  it('retourne le résultat injecté sans connaître le transport', async () => {
    const result = await computeClariprintQuoteSafe(
      gateway(async ({ clariprint }) => ({ success: true, priceHT: Number(clariprint.quantity) })),
      { quantity: 500 },
    );

    expect(result).toEqual({ success: true, priceHT: 500 });
  });

  it('convertit une erreur métier typée dans le contrat historique', async () => {
    const result = await computeClariprintQuoteSafe(
      gateway(async () => {
        throw new ClariprintPricingError('negative_price', 'Prix invalide', 'priceHT=-1');
      }),
      { quantity: 500 },
    );

    expect(result).toEqual({ success: false, error: 'Prix invalide', details: 'priceHT=-1' });
  });
});
