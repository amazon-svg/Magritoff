/**
 * Tests unitaires de `SingleCostPricingEngine` (E10.21, CA7) : nominal,
 * absence de regle, regle client (margin_rate et discount_rate), arrondis,
 * et decomposition en entree acceptee sans erreur. Fonction pure, aucun fake
 * de repository ni de reseau (CA5).
 */
import { describe, expect, it } from 'vitest';
import {
  EmptyCostInputError,
  type CostInput,
  type PricingContext,
} from '@/modules/pricing/application/pricing-engine';
import { SingleCostPricingEngine } from '@/modules/pricing/application/single-cost-pricing-engine';
import { createPricingEngine } from '@/modules/pricing/application/pricing-engine-provider';
import type { PricingEngine } from '@/modules/pricing';

const RULE_ID = '11111111-1111-4111-8111-111111111111';

function totalCost(amount: string): CostInput {
  return { currency: 'EUR', posts: [{ post: 'total', amount }] };
}

function noRuleContext(defaultMarginRate: string | null = null): PricingContext {
  return { rule: null, defaultMarginRate };
}

describe('SingleCostPricingEngine — cas nominal (CA4)', () => {
  const engine = new SingleCostPricingEngine();

  it('applique la marge publique standard de la gamme quand aucune regle ne matche', () => {
    const result = engine.price(totalCost('100.00'), noRuleContext('0.5000'));

    expect(result.production_price).toBe('100.00');
    expect(result.public_price).toBe('150.00');
    expect(result.customer_price).toBe('150.00');
    expect(result.applied_margin_rate).toBe('0.5000');
    expect(result.applied_rule_id).toBeNull();
  });

  it('le breakdown porte toujours au moins un element `total`, jamais vide (red flag E10.21)', () => {
    const result = engine.price(totalCost('100.00'), noRuleContext('0.5000'));

    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0]).toEqual({
      post: 'total',
      cost: '100.00',
      margin_rate: '0.5000',
      price: '150.00',
      source: 'clariprint',
    });
  });
});

describe('SingleCostPricingEngine — absence de regle ET de marge par defaut (CA7)', () => {
  const engine = new SingleCostPricingEngine();

  it('retombe sur une marge nulle : public_price === production_price', () => {
    const result = engine.price(totalCost('42.00'), noRuleContext(null));

    expect(result.applied_margin_rate).toBe('0.0000');
    expect(result.public_price).toBe('42.00');
    expect(result.customer_price).toBe('42.00');
    expect(result.applied_rule_id).toBeNull();
  });

  it('le breakdown reste non-vide meme sur le chemin marge nulle (qa-review B2)', () => {
    const result = engine.price(totalCost('42.00'), noRuleContext(null));

    expect(result.breakdown.length).toBeGreaterThanOrEqual(1);
    expect(result.breakdown[0]).toBeDefined();
  });
});

describe('SingleCostPricingEngine — regle client margin_rate (CA7)', () => {
  const engine = new SingleCostPricingEngine();

  it('la regle remplace la marge publique standard et est tracee dans applied_rule_id', () => {
    const ctx: PricingContext = {
      rule: { id: RULE_ID, value_type: 'margin_rate', value: '0.3000' },
      defaultMarginRate: '0.5000',
    };

    const result = engine.price(totalCost('100.00'), ctx);

    expect(result.applied_margin_rate).toBe('0.3000');
    expect(result.public_price).toBe('130.00');
    expect(result.customer_price).toBe('130.00');
    expect(result.applied_rule_id).toBe(RULE_ID);
  });
});

describe('SingleCostPricingEngine — regle client discount_rate (CA7)', () => {
  const engine = new SingleCostPricingEngine();

  it('la remise retranche du prix public sans changer la marge appliquee', () => {
    const ctx: PricingContext = {
      rule: { id: RULE_ID, value_type: 'discount_rate', value: '0.1000' },
      defaultMarginRate: '0.5000',
    };

    const result = engine.price(totalCost('100.00'), ctx);

    expect(result.public_price).toBe('150.00');
    expect(result.applied_margin_rate).toBe('0.5000');
    expect(result.customer_price).toBe('135.00');
    expect(result.applied_rule_id).toBe(RULE_ID);
  });

  it('le breakdown reste non-vide sur le chemin remise (qa-review B2)', () => {
    const ctx: PricingContext = {
      rule: { id: RULE_ID, value_type: 'discount_rate', value: '0.1000' },
      defaultMarginRate: '0.5000',
    };

    const result = engine.price(totalCost('100.00'), ctx);

    expect(result.breakdown.length).toBeGreaterThanOrEqual(1);
    expect(result.breakdown[0]).toBeDefined();
  });

  it('respecte l invariant sum(breakdown[].price) === customer_price sur le chemin remise (qa-review B3)', () => {
    const ctx: PricingContext = {
      rule: { id: RULE_ID, value_type: 'discount_rate', value: '0.1000' },
      defaultMarginRate: '0.5000',
    };

    const result = engine.price(totalCost('100.00'), ctx);

    const sumBreakdownPricesCents = result.breakdown.reduce(
      (sum, item) => sum + Math.round(Number(item.price) * 100),
      0,
    );
    expect(sumBreakdownPricesCents).toBe(Math.round(Number(result.customer_price) * 100));
    // `price` porte le montant APRES remise, pas le prix public : il diverge
    // ici du prix public (150.00) alors que `margin_rate` (0.5000) reste
    // celui de l etape production -> public, non re-derivable de `price`.
    expect(result.breakdown[0]?.price).toBe(result.customer_price);
    expect(result.breakdown[0]?.price).not.toBe(result.public_price);
  });
});

describe('SingleCostPricingEngine — arrondis (CA7)', () => {
  const engine = new SingleCostPricingEngine();

  it('arrondit au centime le plus proche, moitie superieure', () => {
    // 33.33 * 1.15 = 38.3295 -> 38.33 (arrondi superieur au-dela de 38.325)
    const result = engine.price(totalCost('33.33'), noRuleContext('0.1500'));
    expect(result.public_price).toBe('38.33');
  });

  it('arrondit une remise fractionnaire de centime', () => {
    // public_price 150.00 * (1 - 0.3333) = 100.005 -> 100.01
    const ctx: PricingContext = {
      rule: { id: RULE_ID, value_type: 'discount_rate', value: '0.3333' },
      defaultMarginRate: '0.5000',
    };
    const result = engine.price(totalCost('100.00'), ctx);
    expect(result.public_price).toBe('150.00');
    expect(result.customer_price).toBe('100.01');
  });

  it('cas discriminant flottant vs bigint (qa-review N2) : 0.60 * 1.0250 = 0.62, pas 0.61', () => {
    // Un flottant IEEE-754 naif donne Math.round(0.60 * 1.025 * 100) / 100 === 0.61
    // (imprecision de 0.6 * 1.025 avant arrondi), alors que l arithmetique en
    // centimes/bigint de ce module donne le resultat mathematiquement exact.
    const result = engine.price(totalCost('0.60'), noRuleContext('0.0250'));
    expect(result.public_price).toBe('0.62');
  });

  it('applique la remise au public_price DEJA ARRONDI, jamais a une valeur intermediaire non arrondie (qa-review N3)', () => {
    // production_price 10.00, marge 7.51% -> public_price brut 10.751 -> arrondi 10.75.
    // Remise de 34.84% appliquee sur 10.75 (arrondi) donne 7.00 ; appliquee sur le
    // 10.751 non arrondi elle donnerait 7.01 (verifie par calcul independant,
    // qa-review) : ce test distingue les deux implementations.
    const ctx: PricingContext = {
      rule: { id: RULE_ID, value_type: 'discount_rate', value: '0.3484' },
      defaultMarginRate: '0.0751',
    };
    const result = engine.price(totalCost('10.00'), ctx);
    expect(result.public_price).toBe('10.75');
    expect(result.customer_price).toBe('7.00');
  });
});

describe('SingleCostPricingEngine — provenance du cout, `source` (qa-review B4, derogation p7)', () => {
  const engine = new SingleCostPricingEngine();

  it('vaut `clariprint` par defaut quand aucun poste d entree ne precise de provenance', () => {
    const result = engine.price(totalCost('100.00'), noRuleContext('0.5000'));

    expect(result.breakdown[0].source).toBe('clariprint');
  });

  it('propage la provenance explicite `prix_marche` d un poste d entree', () => {
    const cost: CostInput = {
      currency: 'EUR',
      posts: [{ post: 'total', amount: '100.00', source: 'prix_marche' }],
    };

    const result = engine.price(cost, noRuleContext('0.5000'));

    expect(result.breakdown[0].source).toBe('prix_marche');
  });

  it('un appelant historique qui ne fournit pas `source` n est pas casse (champ additif)', () => {
    // Meme entree que le tout premier test de ce fichier, sans aucune notion
    // de `source` : reste valide et compile, `source` sort quand meme en
    // sortie avec sa valeur par defaut.
    const cost: CostInput = { currency: 'EUR', posts: [{ post: 'total', amount: '10.00' }] };
    const result = engine.price(cost, noRuleContext(null));
    expect(result.breakdown[0].source).toBe('clariprint');
  });
});

describe('SingleCostPricingEngine — decomposition en entree (CA2, CA7)', () => {
  const engine = new SingleCostPricingEngine();

  it('accepte une decomposition par poste sans erreur et l agrege en un `total` (implementation provisoire)', () => {
    const cost: CostInput = {
      currency: 'EUR',
      posts: [
        { post: 'printing', amount: '60.00' },
        { post: 'finishing', amount: '20.00' },
        { post: 'packaging', amount: '10.00' },
        { post: 'shipping', amount: '10.00' },
      ],
    };

    const result = engine.price(cost, noRuleContext('0.5000'));

    expect(result.production_price).toBe('100.00');
    expect(result.public_price).toBe('150.00');
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0]?.post).toBe('total');
  });

  it('rejette un cout sans aucun poste', () => {
    const cost: CostInput = { currency: 'EUR', posts: [] };
    expect(() => engine.price(cost, noRuleContext(null))).toThrow(EmptyCostInputError);
  });
});

describe('createPricingEngine — fournisseur unique (CA6)', () => {
  it('rend une instance conforme a PricingEngine, sans que l appelant connaisse la classe concrete', () => {
    const engine: PricingEngine = createPricingEngine();
    const result = engine.price(totalCost('10.00'), noRuleContext('0.1000'));
    expect(result.public_price).toBe('11.00');
  });
});
