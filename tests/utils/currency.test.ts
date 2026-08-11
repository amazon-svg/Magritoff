/**
 * Tests vitest pour src/app/utils/currency.ts — refacto multi-devise TRANCHE 1.
 *
 * Couvre les invariants du plan (`docs/REFACTO_MULTI_DEVISE.md`) :
 *   #1 la devise appartient a l imprimeur → `getCurrency(tenant)`
 *   #3 un seul helper de formatage, devise obligatoire → `formatMoney`
 *
 * Reprend au passage les cas de l ancien `formatEuro()` (supprime de
 * ProductOverlay.helpers), pour ne pas perdre la couverture du comportement
 * defensif sur lequel s appuient les ecrans du portail.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  formatCurrencyPerUnit,
  formatMoney,
  getCurrency,
  getCurrencyDecimals,
  getCurrencySymbol,
} from '../../src/app/utils/currency';

describe('getCurrency — resolution de la devise du tenant', () => {
  it('tenant avec devise → la devise du tenant', () => {
    expect(getCurrency({ currency: 'USD' })).toBe('USD');
  });

  it('tenant sans devise → DEFAULT_CURRENCY (EUR)', () => {
    expect(getCurrency({})).toBe(DEFAULT_CURRENCY);
    expect(getCurrency({ currency: null })).toBe(DEFAULT_CURRENCY);
  });

  it('null / undefined → DEFAULT_CURRENCY (composant monte avant hydratation)', () => {
    expect(getCurrency(null)).toBe(DEFAULT_CURRENCY);
    expect(getCurrency(undefined)).toBe(DEFAULT_CURRENCY);
  });

  it('minuscules et espaces → normalise en alpha-3 majuscule', () => {
    expect(getCurrency({ currency: 'usd' })).toBe('USD');
    expect(getCurrency({ currency: ' chf ' })).toBe('CHF');
  });

  it('code mal forme → DEFAULT_CURRENCY (defensif, pas de crash Intl)', () => {
    expect(getCurrency({ currency: 'EURO' })).toBe(DEFAULT_CURRENCY);
    expect(getCurrency({ currency: '€' })).toBe(DEFAULT_CURRENCY);
    expect(getCurrency({ currency: '' })).toBe(DEFAULT_CURRENCY);
    expect(getCurrency({ currency: 42 as unknown as string })).toBe(DEFAULT_CURRENCY);
  });
});

describe('formatMoney — helper unique de formatage', () => {
  it('EUR → format FR "1 234,56 €"', () => {
    // L espace insecable peut varier selon la version d Intl.
    expect(formatMoney(1234.56, 'EUR')).toMatch(/1\s*234,56\s*€/);
  });

  it('entier → 2 decimales quand meme', () => {
    expect(formatMoney(500, 'EUR')).toMatch(/500,00\s*€/);
  });

  it('arrondi a 2 decimales', () => {
    expect(formatMoney(123.456, 'EUR')).toMatch(/123,46\s*€/);
  });

  it('zero → "0,00 €" (pas de fallback tiret)', () => {
    expect(formatMoney(0, 'EUR')).toMatch(/0,00\s*€/);
  });

  it('USD → symbole dollar, pas euro', () => {
    const formatted = formatMoney(1234.56, 'USD');
    expect(formatted).toContain('$');
    expect(formatted).not.toContain('€');
  });

  it('JPY → zero decimale (ISO 4217, question ouverte n° 4)', () => {
    const formatted = formatMoney(1234.56, 'JPY');
    expect(formatted).not.toContain(',56');
    expect(formatted).not.toMatch(/[.,]\d\d/);
  });

  it('null / undefined → "—"', () => {
    expect(formatMoney(null, 'EUR')).toBe('—');
    expect(formatMoney(undefined, 'EUR')).toBe('—');
  });

  it('NaN / Infinity → "—"', () => {
    expect(formatMoney(NaN, 'EUR')).toBe('—');
    expect(formatMoney(Infinity, 'EUR')).toBe('—');
    expect(formatMoney(-Infinity, 'EUR')).toBe('—');
  });

  it('fallback personnalisable', () => {
    expect(formatMoney(null, 'EUR', { fallback: 'n/c' })).toBe('n/c');
  });

  it('locale en-US → separateurs anglo-saxons', () => {
    expect(formatMoney(1234.56, 'EUR', { locale: 'en-US' })).toContain('1,234.56');
  });

  it('fractionDigits: 0 → arrondi affiche sans decimale (KPI, budgets)', () => {
    const formatted = formatMoney(1234.56, 'EUR', { fractionDigits: 0 });
    expect(formatted).toMatch(/1\s*235/);
    expect(formatted).not.toContain(',56');
  });

  it('code devise inconnu d Intl → degrade en "montant CODE" sans lever', () => {
    // Garde-fou : une devise corrompue en base ne doit pas faire tomber
    // l ecran. Intl refuse un code non ISO — on veut un repli lisible.
    const formatted = formatMoney(12.5, 'ZZZ');
    expect(formatted).toContain('12,50');
    expect(formatted).toContain('ZZZ');
  });
});

describe('getCurrencyDecimals — decimales ISO 4217', () => {
  it('EUR / USD / CHF → 2', () => {
    expect(getCurrencyDecimals('EUR')).toBe(2);
    expect(getCurrencyDecimals('USD')).toBe(2);
    expect(getCurrencyDecimals('CHF')).toBe(2);
  });

  it('JPY → 0 (pas de sous-unite)', () => {
    expect(getCurrencyDecimals('JPY')).toBe(0);
  });

  it('devise hors liste → 2 par defaut', () => {
    expect(getCurrencyDecimals('SEK')).toBe(2);
  });
});

describe('getCurrencySymbol — libelles d unite', () => {
  it('EUR → €, USD → $', () => {
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('USD')).toContain('$');
  });

  it('devise sans symbole dedie → le code lui-meme', () => {
    expect(getCurrencySymbol('CHF')).toContain('CHF');
  });

  it('code invalide → le code, sans lever', () => {
    expect(getCurrencySymbol('ZZZ')).toBe('ZZZ');
  });
});

describe('formatCurrencyPerUnit — unites composees du parc machine', () => {
  it('EUR + h → "€/h"', () => {
    expect(formatCurrencyPerUnit('EUR', 'h')).toBe('€/h');
  });

  it('USD + kWh → "$US/kWh" (Intl desambiguise le dollar en locale FR)', () => {
    expect(formatCurrencyPerUnit('USD', 'kWh')).toBe('$US/kWh');
  });

  it('locale en-US → le dollar redevient "$" tout court', () => {
    expect(formatCurrencyPerUnit('USD', 'kWh', 'en-US')).toBe('$/kWh');
  });
});

describe('SUPPORTED_CURRENCIES — liste de selection', () => {
  it('contient EUR en premier (cas dominant Magrit 2026)', () => {
    expect(SUPPORTED_CURRENCIES[0].code).toBe('EUR');
  });

  it('tous les codes sont des alpha-3 majuscules valides', () => {
    for (const c of SUPPORTED_CURRENCIES) {
      expect(c.code).toMatch(/^[A-Z]{3}$/);
      // Le meme regex que la contrainte SQL tenants_currency_iso4217.
      expect(getCurrency({ currency: c.code })).toBe(c.code);
    }
  });

  it('chaque devise proposee est formatable sans repli degrade', () => {
    for (const c of SUPPORTED_CURRENCIES) {
      expect(formatMoney(10, c.code)).not.toContain(` ${c.code}`);
    }
  });
});
