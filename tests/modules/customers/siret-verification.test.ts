/**
 * Validation SIRET (story E10.4, CA3).
 *
 * Verifie specifiquement que l algorithme de Luhn est celui d un SIRET
 * (14 chiffres, double a partir de la DROITE), pas celui reutilise tel quel
 * du validateur SIREN (9 chiffres, dont la parite gauche/droite coincide par
 * accident de longueur impaire — ce qui casserait sur 14 chiffres, longueur
 * paire).
 */
import { describe, expect, it } from 'vitest';
import {
  checkSiretFormat,
  computeLuhnChecksum,
  lookupSiretAtInsee,
  normalizeSiret,
} from '@/modules/customers/application/siret-verification';

describe('normalizeSiret', () => {
  it('retire espaces, points et tirets de saisie', () => {
    expect(normalizeSiret('732 829 320 00074')).toBe('73282932000074');
    expect(normalizeSiret('732-829-320-00074')).toBe('73282932000074');
    expect(normalizeSiret('732.829.320.00074')).toBe('73282932000074');
  });
});

describe('computeLuhnChecksum — generique, double a partir de la droite', () => {
  it('valide un SIRET reel connu (73282932000074)', () => {
    expect(computeLuhnChecksum('73282932000074')).toBe(true);
  });

  it('valide plusieurs SIRET generes independamment', () => {
    expect(computeLuhnChecksum('56078919152347')).toBe(true);
    expect(computeLuhnChecksum('50233575070004')).toBe(true);
  });

  it('rejette un SIRET dont un chiffre a ete altere (cle invalide)', () => {
    expect(computeLuhnChecksum('73282932000075')).toBe(false);
  });

  it('reste correct sur une longueur impaire (SIREN, 9 chiffres)', () => {
    // Le validateur SIREN existant (E6.1) accepte '732829320' comme SIREN
    // valide : la meme cle de Luhn generique doit y arriver aussi, preuve que
    // la generalisation "double a partir de la droite" n est pas une
    // regression sur le cas 9 chiffres qui fonctionnait deja.
    expect(computeLuhnChecksum('732829320')).toBe(true);
  });

  it('demontre pourquoi la direction compte : gauche et droite divergent sur une longueur paire', () => {
    // Alterite avec l implementation SIREN historique (i % 2 === 1 en partant
    // de la GAUCHE) : sur un SIRET (longueur paire), doubler a partir de la
    // gauche donne un resultat DIFFERENT de la vraie regle (a partir de la
    // droite). On le prouve en comparant les deux calculs sur le meme nombre.
    const fromLeftDoublesOddLeftIndex = (digits: string): boolean => {
      let sum = 0;
      for (let i = 0; i < digits.length; i += 1) {
        const digit = Number(digits[i]);
        const weighted = i % 2 === 1 ? digit * 2 : digit;
        sum += weighted > 9 ? weighted - 9 : weighted;
      }
      return sum % 10 === 0;
    };
    const siret = '73282932000074';
    expect(computeLuhnChecksum(siret)).toBe(true);
    expect(fromLeftDoublesOddLeftIndex(siret)).toBe(false);
  });
});

describe('checkSiretFormat', () => {
  it('accepte un SIRET valide, espaces tolerees', () => {
    const result = checkSiretFormat('732 829 320 00074');
    expect(result).toEqual({ ok: true, siret: '73282932000074' });
  });

  it('refuse moins de 14 chiffres (SIREN seul, 9 chiffres)', () => {
    expect(checkSiretFormat('732829320')).toEqual({ ok: false, error: 'siret_shape' });
  });

  it('refuse 13 chiffres', () => {
    expect(checkSiretFormat('1234567890123')).toEqual({ ok: false, error: 'siret_shape' });
  });

  it('refuse 15 chiffres', () => {
    expect(checkSiretFormat('123456789012345')).toEqual({ ok: false, error: 'siret_shape' });
  });

  it('refuse des caracteres non numeriques', () => {
    expect(checkSiretFormat('7328293200007A')).toEqual({ ok: false, error: 'siret_shape' });
  });

  it('refuse 14 chiffres dont la cle de Luhn est invalide', () => {
    expect(checkSiretFormat('73282932000075')).toEqual({ ok: false, error: 'siret_checksum' });
  });
});

describe('lookupSiretAtInsee — bouchon (mock), meme principe que E6.1', () => {
  it('rend une reponse credible avec mocked: true', async () => {
    const result = await lookupSiretAtInsee('73282932000074', {
      now: () => new Date('2026-09-01T10:00:00.000Z'),
      delay: async () => undefined,
    });
    expect(result.mocked).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.siret).toBe('73282932000074');
    expect(result.companyName).toBeTruthy();
    expect(result.checkedAt).toBe('2026-09-01T10:00:00.000Z');
  });

  it('est deterministe pour un meme SIRET (meme seed de mock)', async () => {
    const deps = { now: () => new Date('2026-09-01T10:00:00.000Z'), delay: async () => undefined };
    const first = await lookupSiretAtInsee('73282932000074', deps);
    const second = await lookupSiretAtInsee('73282932000074', deps);
    expect(first.companyName).toBe(second.companyName);
    expect(first.nafCode).toBe(second.nafCode);
  });
});
