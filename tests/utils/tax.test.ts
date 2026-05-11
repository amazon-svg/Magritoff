/**
 * Tests vitest pour src/app/utils/tax.ts (Story R0 - Spike H).
 *
 * Couvre AC1 : getTaxRate par regime + AC8 garde-fou TVA centralise.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TAX_RATE,
  applyTax,
  extractTaxAmount,
  formatTaxLabel,
  getTaxRate,
} from '../../src/app/utils/tax';
import {
  domTomTenant,
  exportEuTenant,
  exportWorldTenant,
  franchiseTenant,
  legacyTenantNoRegime,
  metropoleTenant,
} from '../fixtures/tenants';

describe('getTaxRate - resolution du taux par regime fiscal', () => {
  it('metropole_fr → 0.20 (20 %)', () => {
    expect(getTaxRate(metropoleTenant)).toBe(0.20);
  });

  it('dom_tom → 0.085 (8.5 %)', () => {
    expect(getTaxRate(domTomTenant)).toBe(0.085);
  });

  it('franchise_tva → 0 (auto-entrepreneur art. 293 B CGI)', () => {
    expect(getTaxRate(franchiseTenant)).toBe(0);
  });

  it('export_eu → 0 (autoliquidation acheteur)', () => {
    expect(getTaxRate(exportEuTenant)).toBe(0);
  });

  it('export_world → 0 (exoneration hors UE)', () => {
    expect(getTaxRate(exportWorldTenant)).toBe(0);
  });

  it('tenant legacy sans tax_regime → defaut metropole_fr (20 %)', () => {
    expect(getTaxRate(legacyTenantNoRegime)).toBe(DEFAULT_TAX_RATE);
    expect(getTaxRate(legacyTenantNoRegime)).toBe(0.20);
  });

  it('null → defaut metropole_fr (defensif, tenant non hydrate)', () => {
    expect(getTaxRate(null)).toBe(DEFAULT_TAX_RATE);
  });

  it('undefined → defaut metropole_fr', () => {
    expect(getTaxRate(undefined)).toBe(DEFAULT_TAX_RATE);
  });

  it('tax_regime explicitement null → defaut (champ DB nullable)', () => {
    expect(getTaxRate({ tax_regime: null })).toBe(DEFAULT_TAX_RATE);
  });

  it('tax_regime inconnu (cast force) → defaut (defensif)', () => {
    expect(getTaxRate({ tax_regime: 'martian_zone' as any })).toBe(DEFAULT_TAX_RATE);
  });
});

describe('applyTax - calcul du montant TTC', () => {
  it('100 € HT @ 20 % → 120 € TTC', () => {
    expect(applyTax(100, 0.20)).toBe(120);
  });

  it('100 € HT @ 8.5 % DOM-TOM → 108.5 € TTC', () => {
    expect(applyTax(100, 0.085)).toBe(108.5);
  });

  it('100 € HT @ 0 % franchise → 100 € TTC', () => {
    expect(applyTax(100, 0)).toBe(100);
  });

  it('0 € HT → 0 € TTC quel que soit le taux', () => {
    expect(applyTax(0, 0.20)).toBe(0);
  });
});

describe('extractTaxAmount - calcul du montant de TVA', () => {
  it('100 € HT @ 20 % → 20 € de TVA', () => {
    expect(extractTaxAmount(100, 0.20)).toBe(20);
  });

  it('100 € HT @ 8.5 % → 8.5 € de TVA', () => {
    expect(extractTaxAmount(100, 0.085)).toBe(8.5);
  });

  it('100 € HT @ 0 % → 0 € de TVA', () => {
    expect(extractTaxAmount(100, 0)).toBe(0);
  });
});

describe('formatTaxLabel - format human-readable', () => {
  it('0.20 → "20 %"', () => {
    expect(formatTaxLabel(0.20)).toBe('20 %');
  });

  it('0.085 → "8,5 %" (locale fr-FR)', () => {
    expect(formatTaxLabel(0.085)).toBe('8,5 %');
  });

  it('0 → "0 %"', () => {
    expect(formatTaxLabel(0)).toBe('0 %');
  });
});

describe('DEFAULT_TAX_RATE - constante exportee', () => {
  it('est egal a 0.20 (TVA standard FR)', () => {
    expect(DEFAULT_TAX_RATE).toBe(0.20);
  });
});
