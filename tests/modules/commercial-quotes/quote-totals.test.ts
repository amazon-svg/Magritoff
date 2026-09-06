/**
 * Tests unitaires de `computeQuoteTotals()`/`computeQuoteWarnings()`
 * (E10.10a) : sous-total -> net_total (cible OU taux OU sous-total tel
 * quel) -> remise DEDUITE -> TVA en bas. Fonctions pures, meme discipline que
 * `quote-line-pricing.test.ts`.
 *
 * Couvre en particulier la defense en profondeur ajoutee en qa-review round
 * 1 (B1) : cette fonction est sur le chemin de TOUTE LECTURE (`findById`,
 * `findDetailById`, `list()`) et ne doit JAMAIS lever, meme si un
 * `vat_rate` negatif se retrouvait en base par un autre biais que l API
 * (le contrat/`nonNegativeRateSchema` et le CHECK
 * `commercial_quotes_vat_rate_non_negative` empechent desormais l ECRITURE
 * d une telle valeur, mais la LECTURE doit rester robuste independamment).
 */
import { describe, expect, it } from 'vitest';
import { computeQuoteTotals, computeQuoteWarnings } from '@/modules/commercial-quotes/application/quote-totals';

describe('computeQuoteTotals — cas nominal', () => {
  it('sans remise ni surcharge : net_total = sous-total, TVA du regime du tenant', () => {
    const totals = computeQuoteTotals({
      linesSubtotal: '100.00',
      globalDiscountRate: null,
      targetNetTotal: null,
      quoteVatRateOverride: null,
      tenantTaxRegime: 'metropole_fr',
    });
    expect(totals.lines_subtotal).toBe('100.00');
    expect(totals.net_total).toBe('100.00');
    expect(totals.global_discount).toBe('0.00');
    expect(totals.vat_rate).toBe('0.2000');
    expect(totals.vat_regime).toBe('metropole_fr');
    expect(totals.vat_amount).toBe('20.00');
    expect(totals.total_incl_tax).toBe('120.00');
  });

  it('remise globale en taux : net_total et remise deduits, TVA calculee sur le net', () => {
    const totals = computeQuoteTotals({
      linesSubtotal: '200.00',
      globalDiscountRate: '0.1000',
      targetNetTotal: null,
      quoteVatRateOverride: null,
      tenantTaxRegime: 'metropole_fr',
    });
    expect(totals.net_total).toBe('180.00');
    expect(totals.global_discount).toBe('20.00');
    expect(totals.vat_amount).toBe('36.00');
    expect(totals.total_incl_tax).toBe('216.00');
  });

  it('remise globale NEGATIVE (majoration) : global_discount signe negatif, net_total > sous-total', () => {
    const totals = computeQuoteTotals({
      linesSubtotal: '100.00',
      globalDiscountRate: '-0.1000',
      targetNetTotal: null,
      quoteVatRateOverride: null,
      tenantTaxRegime: 'metropole_fr',
    });
    expect(totals.net_total).toBe('110.00');
    expect(totals.global_discount).toBe('-10.00');
  });

  it('prix cible (target_net_total) : remise deduite, ignore le sous-total pour le net_total', () => {
    const totals = computeQuoteTotals({
      linesSubtotal: '150.00',
      globalDiscountRate: null,
      targetNetTotal: '120.00',
      quoteVatRateOverride: null,
      tenantTaxRegime: 'metropole_fr',
    });
    expect(totals.net_total).toBe('120.00');
    expect(totals.global_discount).toBe('30.00');
  });

  it('surcharge vat_rate explicite par devis : vat_regime devient null (surcharge, pas un regime)', () => {
    const totals = computeQuoteTotals({
      linesSubtotal: '100.00',
      globalDiscountRate: null,
      targetNetTotal: null,
      quoteVatRateOverride: '0.0850',
      tenantTaxRegime: 'metropole_fr',
    });
    expect(totals.vat_rate).toBe('0.0850');
    expect(totals.vat_regime).toBeNull();
    expect(totals.vat_amount).toBe('8.50');
  });

  it('regime a taux nul (export_world) : vat_amount et total_incl_tax egaux au net_total', () => {
    const totals = computeQuoteTotals({
      linesSubtotal: '100.00',
      globalDiscountRate: null,
      targetNetTotal: null,
      quoteVatRateOverride: null,
      tenantTaxRegime: 'export_world',
    });
    expect(totals.vat_rate).toBe('0.0000');
    expect(totals.vat_amount).toBe('0.00');
    expect(totals.total_incl_tax).toBe('100.00');
  });
});

describe('computeQuoteTotals — defense en profondeur B1 (qa-review E10.10a round 1)', () => {
  it('un vat_rate override NEGATIF (donnee corrompue hors API) est CLAMPE a zero, jamais leve', () => {
    expect(() =>
      computeQuoteTotals({
        linesSubtotal: '100.00',
        globalDiscountRate: null,
        targetNetTotal: null,
        quoteVatRateOverride: '-0.2000',
        tenantTaxRegime: 'metropole_fr',
      }),
    ).not.toThrow();

    const totals = computeQuoteTotals({
      linesSubtotal: '100.00',
      globalDiscountRate: null,
      targetNetTotal: null,
      quoteVatRateOverride: '-0.2000',
      tenantTaxRegime: 'metropole_fr',
    });
    expect(totals.vat_rate).toBe('0.0000');
    expect(totals.vat_amount).toBe('0.00');
    expect(totals.total_incl_tax).toBe(totals.net_total);
  });

  it('un vat_rate override positif normal n est PAS affecte par le clamp (chemin nominal inchange)', () => {
    const totals = computeQuoteTotals({
      linesSubtotal: '100.00',
      globalDiscountRate: null,
      targetNetTotal: null,
      quoteVatRateOverride: '0.2000',
      tenantTaxRegime: 'dom_tom',
    });
    expect(totals.vat_rate).toBe('0.2000');
    expect(totals.vat_amount).toBe('20.00');
  });
});

describe('computeQuoteWarnings — validity_expired', () => {
  it('aucune alerte quand valid_until est null', () => {
    expect(computeQuoteWarnings({ validUntil: null, now: new Date('2026-09-06T00:00:00.000Z') })).toEqual([]);
  });

  it('aucune alerte le jour meme de la date de validite (borne haute exclusive du lendemain)', () => {
    const warnings = computeQuoteWarnings({
      validUntil: '2026-09-06',
      now: new Date('2026-09-06T23:59:59.000Z'),
    });
    expect(warnings).toEqual([]);
  });

  it('alerte validity_expired des le lendemain de la date de validite', () => {
    const warnings = computeQuoteWarnings({
      validUntil: '2026-09-06',
      now: new Date('2026-09-07T00:00:00.000Z'),
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.code).toBe('validity_expired');
  });
});
