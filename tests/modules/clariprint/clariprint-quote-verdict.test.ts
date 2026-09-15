import { describe, expect, it } from 'vitest';
import {
  buildClariprintQuoteVerdict,
  countAllProcessEntries,
  expurgeAllFaultyProcess,
  expurgeSentConfig,
  logLevelForOutcome,
  MAX_FAULTY_PROCESS_ENTRIES,
  truncateUpstreamError,
  UPSTREAM_ERROR_MAX_LENGTH,
} from '@/modules/clariprint/application/clariprint-quote-verdict';

describe('truncateUpstreamError', () => {
  it('tronque a 500 caracteres', () => {
    const long = 'x'.repeat(600);
    const truncated = truncateUpstreamError(long);
    expect(truncated).toHaveLength(UPSTREAM_ERROR_MAX_LENGTH);
    expect(truncated).toBe('x'.repeat(500));
  });

  it('garde une chaine courte telle quelle', () => {
    expect(truncateUpstreamError('erreur courte')).toBe('erreur courte');
  });

  it('rend null pour une valeur non-chaine (jamais un objet ni un extrait de reponse serialise implicitement)', () => {
    expect(truncateUpstreamError(undefined)).toBeNull();
    expect(truncateUpstreamError(null)).toBeNull();
    expect(truncateUpstreamError({ some: 'object' })).toBeNull();
    expect(truncateUpstreamError(42)).toBeNull();
  });
});

describe('countAllProcessEntries', () => {
  it('compte les entrees d un tableau sans en reproduire le contenu', () => {
    expect(countAllProcessEntries([{ printer: 'Secret1' }, { printer: 'Secret2' }, { printer: 'Secret3' }])).toBe(3);
  });

  it('rend 0 pour une valeur absente ou non-tableau', () => {
    expect(countAllProcessEntries(undefined)).toBe(0);
    expect(countAllProcessEntries(null)).toBe(0);
    expect(countAllProcessEntries({ not: 'an array' })).toBe(0);
  });
});

describe('expurgeAllFaultyProcess', () => {
  it('remplace les cles (noms d imprimeurs) par un ordinal, jamais le nom reel', () => {
    const result = expurgeAllFaultyProcess({ ImprimeurSecretA: 'raison A', ImprimeurSecretB: 'raison B' });
    expect(result).toEqual([
      { printer: 'imprimeur_1', detail: 'raison A' },
      { printer: 'imprimeur_2', detail: 'raison B' },
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('ImprimeurSecretA');
    expect(serialized).not.toContain('ImprimeurSecretB');
  });

  it('plafonne a 20 entrees et 300 caracteres par detail', () => {
    const source: Record<string, string> = {};
    for (let i = 0; i < 30; i += 1) source[`imprimeur_reel_${i}`] = 'x'.repeat(400);
    const result = expurgeAllFaultyProcess(source);
    expect(result).toHaveLength(MAX_FAULTY_PROCESS_ENTRIES);
    expect(result.every((entry) => entry.detail.length === 300)).toBe(true);
  });

  it('accepte aussi un tableau (forme alternative documentee comme ambigue)', () => {
    const result = expurgeAllFaultyProcess(['raison seule']);
    expect(result).toEqual([{ printer: 'imprimeur_1', detail: 'raison seule' }]);
  });

  it('rend un tableau vide pour une valeur absente ou non-objet', () => {
    expect(expurgeAllFaultyProcess(undefined)).toEqual([]);
    expect(expurgeAllFaultyProcess(null)).toEqual([]);
    expect(expurgeAllFaultyProcess('texte')).toEqual([]);
  });
});

describe('expurgeSentConfig', () => {
  it('retire reference et address a la racine', () => {
    const result = expurgeSentConfig({ reference: 'Devis Mme Personne', quantity: '500', address: '12 rue Secrete' });
    expect(result).toEqual({ quantity: '500' });
  });

  it('retire address a l interieur de deliveries (profondeur quelconque)', () => {
    const result = expurgeSentConfig({
      quantity: '500',
      deliveries: { d_livraison: { iso: 'FR-75', address: '12 rue Secrete', quantity: '500' } },
    });
    expect(result).toEqual({ quantity: '500', deliveries: { d_livraison: { iso: 'FR-75', quantity: '500' } } });
  });

  it('garde le reste de la charge intact', () => {
    const result = expurgeSentConfig({ kind: 'leaflet', width: '14.8', height: '21', front_colors: ['4-color'] });
    expect(result).toEqual({ kind: 'leaflet', width: '14.8', height: '21', front_colors: ['4-color'] });
  });
});

describe('buildClariprintQuoteVerdict', () => {
  it('assemble tous les champs conserves', () => {
    const verdict = buildClariprintQuoteVerdict({
      upstreamStatus: 200,
      upstreamSuccess: true,
      upstreamError: 'erreur amont',
      rawResponseValue: -1,
      allProcess: [{ printer: 'a' }, { printer: 'b' }],
      allFaultyProcess: { imp: 'raison' },
      durationMs: 42,
      sentConfig: { reference: 'secret', quantity: '10' },
    });
    expect(verdict).toEqual({
      upstreamStatus: 200,
      upstreamSuccess: true,
      upstreamError: 'erreur amont',
      rawResponseValue: '-1',
      allProcessCount: 2,
      allFaultyProcess: [{ printer: 'imprimeur_1', detail: 'raison' }],
      durationMs: 42,
      sentConfig: { quantity: '10' },
    });
  });

  it('serialise une valeur de reponse numerique en chaine ("-1")', () => {
    const verdict = buildClariprintQuoteVerdict({ upstreamStatus: 200, upstreamSuccess: true, rawResponseValue: -1, durationMs: 1, sentConfig: {} });
    expect(verdict.rawResponseValue).toBe('-1');
  });

  it('rend rawResponseValue a null quand absent', () => {
    const verdict = buildClariprintQuoteVerdict({ upstreamStatus: null, upstreamSuccess: null, durationMs: 0, sentConfig: {} });
    expect(verdict.rawResponseValue).toBeNull();
  });
});

describe('logLevelForOutcome', () => {
  it('info pour un succes', () => {
    expect(logLevelForOutcome('priced')).toBe('info');
  });

  it('warn pour un refus (Clariprint a repondu sans prix exploitable)', () => {
    expect(logLevelForOutcome('not_priced')).toBe('warn');
  });

  it('error pour une indisponibilite ou une configuration absente', () => {
    expect(logLevelForOutcome('unavailable')).toBe('error');
    expect(logLevelForOutcome('not_configured')).toBe('error');
  });
});
