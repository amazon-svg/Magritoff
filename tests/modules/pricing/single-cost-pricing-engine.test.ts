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
