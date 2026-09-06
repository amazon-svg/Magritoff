/**
 * Tests unitaires des helpers UI purs d E10.10a : conversion pourcentage <->
 * taux (remise globale, surcharge de TVA) et mention legale de TVA. Aucun
 * appel reseau, aucun rendu React — memes fonctions que celles utilisees par
 * `QuoteEditorPage`, testees isolement (meme discipline que
 * `quote-line-pricing.test.ts`/`quote-totals.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import { percentToRate, rateToPercent } from '@/modules/commercial-quotes/ui/helpers/rate-format';
import { vatLegalMention } from '@/modules/commercial-quotes/ui/helpers/vatMention';

describe('percentToRate', () => {
  it('convertit un pourcentage positif en taux a 4 decimales', () => {
    expect(percentToRate('10')).toBe('0.1000');
    expect(percentToRate('29')).toBe('0.2900');
  });

  it('accepte un pourcentage NEGATIF (majoration, §8.12 decision 3)', () => {
    expect(percentToRate('-15')).toBe('-0.1500');
    expect(percentToRate('-0.5')).toBe('-0.0050');
  });

  it('rend "0.0000" plutot que "-0.0000" pour une saisie negative arrondie a zero', () => {
    expect(percentToRate('-0.001')).toBe('0.0000');
  });

  it('rend null pour une saisie vide ou non numerique', () => {
    expect(percentToRate('')).toBeNull();
    expect(percentToRate('   ')).toBeNull();
    expect(percentToRate('abc')).toBeNull();
  });
});

describe('rateToPercent', () => {
  it('convertit un taux positif sans artefact flottant', () => {
    // Number("0.2900") * 100 vaut 28.999999999999996 en IEEE 754 — la
    // fonction doit rendre "29" exactement.
    expect(rateToPercent('0.2900')).toBe('29');
    expect(rateToPercent('0.1000')).toBe('10');
  });

  it('conserve le signe negatif (majoration)', () => {
    expect(rateToPercent('-0.1000')).toBe('-10');
  });

  it('conserve les decimales non nulles', () => {
    expect(rateToPercent('0.0550')).toBe('5.5');
  });

  it('est l inverse exact de percentToRate sur des valeurs rondes', () => {
    for (const percent of ['10', '-10', '5.5', '-5.5', '0']) {
      const rate = percentToRate(percent);
      expect(rate).not.toBeNull();
      expect(rateToPercent(rate!)).toBe(percent === '0' ? '0' : percent);
    }
  });
});

describe('vatLegalMention', () => {
  it('rend la mention art. 293 B du CGI pour une franchise en base', () => {
    expect(vatLegalMention('franchise_tva')).toBe('TVA non applicable, art. 293 B du CGI');
  });

  it('rend une mention d autoliquidation pour un export (UE ou hors UE)', () => {
    expect(vatLegalMention('export_eu')).toContain('Autoliquidation');
    expect(vatLegalMention('export_world')).toContain('Autoliquidation');
  });

  it('ne rend aucune mention pour la metropole ou les DOM-TOM (taux suffit)', () => {
    expect(vatLegalMention('metropole_fr')).toBeNull();
    expect(vatLegalMention('dom_tom')).toBeNull();
  });

  it('ne rend aucune mention quand aucun regime n est resolu (surcharge par devis)', () => {
    expect(vatLegalMention(null)).toBeNull();
  });
});
