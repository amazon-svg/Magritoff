import { describe, expect, it } from 'vitest';
import {
  buildClariprintQuoteVerdict,
  countAllProcessEntries,
  expurgeAllFaultyProcess,
  expurgeSentConfig,
  logLevelForOutcome,
  MAX_FAULTY_PROCESS_ENTRIES,
  MAX_SENT_CONFIG_LOG_LENGTH,
  RAW_RESPONSE_VALUE_MAX_LENGTH,
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

  // qa-review round 1 (MOYEN) : la version precedente serialisait en JSON
  // toute valeur non-chaine (objet, tableau), laissant fuir `external_id`,
  // `printer`, `CSV`, `PDF`. Ce test echoue sur ce code-la : il pose des
  // temoins DANS des valeurs non-chaine (objet ET tableau), et exige leur
  // absence totale, y compris comme entree conservee.
  it('ECARTE ENTIEREMENT une valeur non-chaine (objet ou tableau), ne la serialise JAMAIS', () => {
    const result = expurgeAllFaultyProcess({
      gamme_objet: { external_id: 'W_EXTID_TEMOIN', printer: 'W_PRINTER_TEMOIN', csv: 'W_CSV_TEMOIN', pdf: 'W_PDF_TEMOIN' },
      gamme_tableau: ['W_ARRAY_TEMOIN_1', 'W_ARRAY_TEMOIN_2'],
      gamme_texte: 'raison textuelle valide',
    });
    // Seule l entree dont la VALEUR est deja une chaine est conservee.
    expect(result).toEqual([{ printer: 'imprimeur_1', detail: 'raison textuelle valide' }]);
    const serialized = JSON.stringify(result);
    for (const witness of ['W_EXTID_TEMOIN', 'W_PRINTER_TEMOIN', 'W_CSV_TEMOIN', 'W_PDF_TEMOIN', 'W_ARRAY_TEMOIN_1', 'W_ARRAY_TEMOIN_2']) {
      expect(serialized).not.toContain(witness);
    }
  });

  // Arbitrage architecte (qa-review de d8a0a57b, point (3)) : le TEXTE
  // conserve subit lui-meme la substitution des noms connus, passes via la
  // table `ordinalMap`.
  it('substitue les noms connus a l interieur du texte conserve, via la table fournie', () => {
    const ordinalMap = new Map([
      ['ImprimerieDupont', 'imprimeur_1'],
      ['gamme_offset', 'imprimeur_2'],
    ]);
    const result = expurgeAllFaultyProcess({ gamme_offset: 'aucun papier chez ImprimerieDupont' }, ordinalMap);
    expect(result).toEqual([{ printer: 'imprimeur_2', detail: 'aucun papier chez imprimeur_1' }]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('ImprimerieDupont');
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

  // qa-review round 1 (BAS) : la charge vient d un appelant PUBLIC ; sans
  // plafond, un corps volumineux (attaque ou bogue cote client) gonfle le
  // journal indefiniment. Ce test echoue sans la borne : `toEqual` sur un
  // objet contenant encore le temoin de 5000 caracteres.
  it('remplace la charge par sa seule longueur au-dela du plafond, sans jamais serialiser son contenu', () => {
    const witness = 'W_OVERSIZED_CHARGE_TEMOIN_'.repeat(200); // tres au-dela de MAX_SENT_CONFIG_LOG_LENGTH
    const result = expurgeSentConfig({ kind: 'leaflet', oversizedField: witness });
    expect(result).toMatchObject({ truncated: true });
    expect((result as { originalLength: number }).originalLength).toBeGreaterThan(MAX_SENT_CONFIG_LOG_LENGTH);
    expect(JSON.stringify(result)).not.toContain('W_OVERSIZED_CHARGE_TEMOIN');
  });

  it('ne tronque pas une charge sous le plafond', () => {
    const result = expurgeSentConfig({ kind: 'leaflet', quantity: '500' });
    expect(result).toEqual({ kind: 'leaflet', quantity: '500' });
  });
});

describe('buildClariprintQuoteVerdict', () => {
  it('assemble tous les champs conserves (aucun nom d imprimeur dans la charge de test, aucune substitution attendue)', () => {
    const verdict = buildClariprintQuoteVerdict({
      upstreamStatus: 200,
      upstreamSuccess: true,
      upstreamError: 'erreur amont',
      rawResponseValue: -1,
      allProcess: [{ printer: 'ImprimerieAlpha' }, { printer: 'ImprimerieBeta' }],
      allFaultyProcess: { gamme_offset: 'raison' },
      durationMs: 42,
      sentConfig: { reference: 'secret', quantity: '10' },
    });
    expect(verdict).toEqual({
      upstreamStatus: 200,
      upstreamSuccess: true,
      upstreamError: 'erreur amont',
      errorClass: 'unclassified',
      failureCategory: null,
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

  // qa-review round 1 (MOYEN) : la version precedente serialisait un objet
  // `response` en JSON complet (sans borne), laissant fuir des cles comme
  // `html`/`quote_process`. Ce test echoue sur ce code-la.
  it('remplace un objet/tableau de reponse par son seul TYPE, jamais son contenu', () => {
    const witness = 'W_RAWRESPONSE_HTML_TEMOIN'.repeat(50);
    const objectVerdict = buildClariprintQuoteVerdict({
      upstreamStatus: 200,
      upstreamSuccess: true,
      rawResponseValue: { html: witness, quote_process: 'W_QUOTE_PROCESS_TEMOIN' },
      durationMs: 1,
      sentConfig: {},
    });
    expect(objectVerdict.rawResponseValue).toBe('[object]');
    expect(JSON.stringify(objectVerdict)).not.toContain('W_RAWRESPONSE_HTML_TEMOIN');
    expect(JSON.stringify(objectVerdict)).not.toContain('W_QUOTE_PROCESS_TEMOIN');

    const arrayVerdict = buildClariprintQuoteVerdict({ upstreamStatus: 200, upstreamSuccess: true, rawResponseValue: ['W_ARRAY_TEMOIN'], durationMs: 1, sentConfig: {} });
    expect(arrayVerdict.rawResponseValue).toBe('[array]');
    expect(JSON.stringify(arrayVerdict)).not.toContain('W_ARRAY_TEMOIN');
  });

  it('tronque une chaine de reponse longue a RAW_RESPONSE_VALUE_MAX_LENGTH', () => {
    const verdict = buildClariprintQuoteVerdict({ upstreamStatus: 200, upstreamSuccess: true, rawResponseValue: 'x'.repeat(500), durationMs: 1, sentConfig: {} });
    expect(verdict.rawResponseValue).toHaveLength(RAW_RESPONSE_VALUE_MAX_LENGTH);
  });

  // Arbitrage architecte (qa-review de d8a0a57b, point (3)) : `payload.error`
  // (et un texte de `all_faulty_process`) PEUT nommer un imprimeur du parc.
  // Ce test echoue si le nom traverse tel quel : il exige la SUBSTITUTION
  // par l ordinal, a partir des noms connus de la MEME reponse
  // (all_process[].printer, cles de all_faulty_process, fournisseur).
  it('substitue chaque nom d imprimeur connu de la meme reponse dans upstreamError, avant troncature', () => {
    const verdict = buildClariprintQuoteVerdict({
      upstreamStatus: 200,
      upstreamSuccess: false,
      upstreamError: 'Aucun papier disponible chez ImprimerieDupont pour cette gamme',
      allProcess: [{ printer: 'ImprimerieDupont' }],
      durationMs: 1,
      sentConfig: {},
    });
    expect(verdict.upstreamError).toBe('Aucun papier disponible chez imprimeur_1 pour cette gamme');
    expect(verdict.upstreamError).not.toContain('ImprimerieDupont');
    expect(verdict.errorClass).toBe('unclassified');
  });

  it('substitue aussi un nom connu UNIQUEMENT via fournisseur (aucune entree all_process/all_faulty_process)', () => {
    const verdict = buildClariprintQuoteVerdict({
      upstreamStatus: 200,
      upstreamSuccess: false,
      upstreamError: 'ImprimerieDupont indisponible',
      fournisseur: 'ImprimerieDupont',
      durationMs: 1,
      sentConfig: {},
    });
    expect(verdict.upstreamError).toBe('imprimeur_1 indisponible');
  });

  // qa-review round 2 (BAS, G10b) : une CLE de `all_faulty_process`, citee
  // dans `error`, doit etre substituee — AUCUNE entree `all_process` ni
  // `fournisseur` ici : la seule source du nom est la cle de
  // `all_faulty_process`.
  it('substitue une cle de all_faulty_process citee dans upstreamError (seule source, ni all_process ni fournisseur)', () => {
    const verdict = buildClariprintQuoteVerdict({
      upstreamStatus: 200,
      upstreamSuccess: false,
      upstreamError: 'Refus global : voir ImprimerieDesFlandres pour le detail',
      allFaultyProcess: { ImprimerieDesFlandres: 'papier indisponible' },
      durationMs: 1,
      sentConfig: {},
    });
    expect(verdict.upstreamError).toBe('Refus global : voir imprimeur_1 pour le detail');
    expect(verdict.upstreamError).not.toContain('ImprimerieDesFlandres');
  });

  // qa-review round 2 (BAS, résidu n°1) : substitution INSENSIBLE A LA CASSE.
  it('substitue independamment de la casse dans upstreamError', () => {
    const verdict = buildClariprintQuoteVerdict({
      upstreamStatus: 200,
      upstreamSuccess: false,
      upstreamError: 'probleme chez imprimeriedupont',
      fournisseur: 'ImprimerieDupont',
      durationMs: 1,
      sentConfig: {},
    });
    expect(verdict.upstreamError).toBe('probleme chez imprimeur_1');
  });

  // qa-review round 2 (BAS, résidu n°3) : `rawResponseValue`, quand c est un
  // TEXTE, doit lui aussi subir la substitution — avant troncature.
  it('substitue les noms connus DANS rawResponseValue quand c est un texte', () => {
    const verdict = buildClariprintQuoteVerdict({
      upstreamStatus: 200,
      upstreamSuccess: true,
      rawResponseValue: 'prix via ImprimerieDupont',
      fournisseur: 'ImprimerieDupont',
      durationMs: 1,
      sentConfig: {},
    });
    expect(verdict.rawResponseValue).toBe('prix via imprimeur_1');
    expect(verdict.rawResponseValue).not.toContain('ImprimerieDupont');
  });

  // qa-review round 2 (BAS, G8) : ORDRE substitution PUIS troncature à 500
  // caractères. Un nom à cheval sur la limite ne doit laisser AUCUN
  // fragment si la substitution a bien lieu avant la coupe.
  it('G8 : substitue AVANT de tronquer a 500 caracteres — aucun fragment du nom ne survit a la limite', () => {
    const name = 'ImprimerieDesFlandresATP'; // 24 caracteres, a cheval sur la position 500
    const prefix = 'x'.repeat(490);
    const suffix = 'y'.repeat(50);
    const verdict = buildClariprintQuoteVerdict({
      upstreamStatus: 200,
      upstreamSuccess: false,
      upstreamError: `${prefix}${name}${suffix}`,
      fournisseur: name,
      durationMs: 1,
      sentConfig: {},
    });
    expect(verdict.upstreamError).toHaveLength(UPSTREAM_ERROR_MAX_LENGTH);
    expect(verdict.upstreamError).not.toMatch(/Imprimerie|Flandres/i);
  });

  // qa-review round 2 (BAS, G8b) : meme regle pour `all_faulty_process`,
  // dont chaque detail est tronque a 300 caracteres.
  it('G8b : substitue AVANT de tronquer a 300 caracteres (all_faulty_process) — aucun fragment ne survit', () => {
    const name = 'ImprimerieDesFlandresATP'; // 24 caracteres, a cheval sur la position 300
    const prefix = 'x'.repeat(290);
    const suffix = 'y'.repeat(50);
    const result = expurgeAllFaultyProcess(
      { gamme_offset: `${prefix}${name}${suffix}` },
      new Map([[name, 'imprimeur_1']]),
    );
    expect(result[0]?.detail).toHaveLength(300);
    expect(result[0]?.detail).not.toMatch(/Imprimerie|Flandres/i);
  });

  it('errorClass est null quand aucun texte amont n est fourni', () => {
    const verdict = buildClariprintQuoteVerdict({ upstreamStatus: 200, upstreamSuccess: true, rawResponseValue: 5, durationMs: 1, sentConfig: {} });
    expect(verdict.errorClass).toBeNull();
    expect(verdict.upstreamError).toBeNull();
  });

  it('failureCategory est repercutee telle quelle, et null par defaut', () => {
    const withCategory = buildClariprintQuoteVerdict({ upstreamStatus: null, upstreamSuccess: null, failureCategory: 'network', durationMs: 1, sentConfig: {} });
    expect(withCategory.failureCategory).toBe('network');
    const withoutCategory = buildClariprintQuoteVerdict({ upstreamStatus: 200, upstreamSuccess: true, rawResponseValue: 5, durationMs: 1, sentConfig: {} });
    expect(withoutCategory.failureCategory).toBeNull();
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
