import { describe, expect, it } from 'vitest';
import {
  formatMoneyFrench,
  formatRatePercentFrench,
  formatShortFrenchDate,
  formatShortFrenchDateFromTimestamp,
} from '@/modules/quote-documents/application/document-value-formatting';

describe('formatShortFrenchDate', () => {
  it("convertit YYYY-MM-DD en JJ/MM/AAAA, sans passer par Date (piege deja documente pour valid_until)", () => {
    expect(formatShortFrenchDate('2026-10-09')).toBe('09/10/2026');
    expect(formatShortFrenchDate('2026-01-01')).toBe('01/01/2026');
  });

  it('rend la valeur telle quelle si le format est inattendu (defensif)', () => {
    expect(formatShortFrenchDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatShortFrenchDateFromTimestamp', () => {
  it('lit les trois premiers segments d un instant ISO UTC', () => {
    expect(formatShortFrenchDateFromTimestamp('2026-09-09T14:32:00.000Z')).toBe('09/09/2026');
  });
});

describe('formatMoneyFrench', () => {
  // Espace INSECABLE (` `), pas un espace ordinaire : un separateur de
  // milliers qui casserait en fin de ligne ("1" seul sur une ligne, "234,50 €"
  // sur la suivante) serait illisible sur un document imprime.
  it('groupe les milliers par espace insecable, virgule decimale, symbole euro', () => {
    expect(formatMoneyFrench('1234.50')).toBe('1 234,50 €');
    expect(formatMoneyFrench('183.00')).toBe('183,00 €');
    expect(formatMoneyFrench('2015.00')).toBe('2 015,00 €');
    expect(formatMoneyFrench('1000000.00')).toBe('1 000 000,00 €');
  });

  it('conserve le signe (une remise globale peut etre negative)', () => {
    expect(formatMoneyFrench('-18.00')).toBe('-18,00 €');
  });

  it('gere un montant sans partie entiere significative', () => {
    expect(formatMoneyFrench('0.00')).toBe('0,00 €');
  });
});

describe('formatRatePercentFrench', () => {
  it('retire les zeros decimaux superflus sur un taux rond', () => {
    expect(formatRatePercentFrench('0.2000')).toBe('20 %');
  });

  it('conserve les decimales significatives (ex. taux de remise)', () => {
    expect(formatRatePercentFrench('0.0770')).toBe('7,7 %');
    expect(formatRatePercentFrench('0.1510')).toBe('15,1 %');
  });

  it('gere un taux nul', () => {
    expect(formatRatePercentFrench('0.0000')).toBe('0 %');
  });
});
