/**
 * Correctif de securite (decision Arnaud, 2026-09-15) sur l edge function
 * legacy `make-server-e3db71a4`, appelable avec la seule cle anonyme
 * Supabase. Ces reponses ne doivent plus jamais exposer de donnee brute
 * Clariprint (gammes de fabrication, reponse HTTP entiere, hote, login).
 *
 * Ce module pur est teste ici avec des chaines temoins reproduisant des
 * payloads Clariprint reels (cf. incident documente dans le correctif) pour
 * prouver que rien n en ressort dans le corps de reponse construit.
 */
import { describe, expect, it } from 'vitest';
import {
  buildAuthTestBody,
  buildQuoteCalcErrorBody,
  buildQuoteCredentialsMissingBody,
  buildQuoteHttpErrorBody,
  buildQuoteInvalidJsonBody,
  buildQuoteInvalidPriceBody,
  buildQuoteMissingProductBody,
  buildQuoteServerErrorBody,
  buildQuoteSuccessBody,
} from '../../../supabase/functions/make-server-e3db71a4/clariprint-responses.ts';

const BANNED_TOKENS = ['all_process', 'all_faulty_process', 'rawResponse', 'parsedResponse'];

function assertNoBannedToken(body: unknown): void {
  const serialized = JSON.stringify(body);
  for (const token of BANNED_TOKENS) {
    expect(serialized).not.toContain(token);
  }
}

describe('clariprint-responses (correctif securite 2026-09-15)', () => {
  it('buildQuoteCredentialsMissingBody reste generique', () => {
    const body = buildQuoteCredentialsMissingBody('Configurez les secrets.');
    expect(body).toEqual({ success: false, credentialsMissing: true, message: 'Configurez les secrets.' });
    assertNoBannedToken(body);
  });

  it('buildQuoteMissingProductBody ne contient aucun detail brut', () => {
    const body = buildQuoteMissingProductBody();
    expect(body).toEqual({ success: false, error: 'Donnees produit Clariprint manquantes' });
    assertNoBannedToken(body);
  });

  it('buildQuoteHttpErrorBody ne renvoie ni URL ni texte HTTP brut', () => {
    const body = buildQuoteHttpErrorBody();
    expect(body).toEqual({ success: false, error: 'Erreur de communication avec Clariprint' });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('optimproject');
    expect(serialized).not.toContain('http');
    assertNoBannedToken(body);
  });

  it('buildQuoteInvalidJsonBody ne renvoie ni URL ni extrait de reponse brute', () => {
    const body = buildQuoteInvalidJsonBody();
    expect(body).toEqual({ success: false, error: 'Reponse Clariprint invalide' });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('URL appelee');
    expect(serialized).not.toContain('optimproject');
    assertNoBannedToken(body);
  });

  it('buildQuoteCalcErrorBody masque la gamme en erreur et la reponse Clariprint entiere', () => {
    // Payload temoin reproduisant un vrai succes=false de Clariprint avec
    // gammes en erreur -- rien de tout ceci ne doit ressortir.
    const clariprintFailurePayload = {
      success: false,
      error: 'Fournisseur indisponible sur la gamme X',
      all_faulty_process: { gamme_a: { code: 'ERR_STOCK', fournisseur: 'FournisseurSecretSARL' } },
      response: -1.2,
    };
    void clariprintFailurePayload; // la fonction pure n accepte pas ce payload : rien a lui passer
    const body = buildQuoteCalcErrorBody();
    expect(body).toEqual({ success: false, error: 'Erreur de calcul Clariprint' });
    assertNoBannedToken(body);
    expect(JSON.stringify(body)).not.toContain('FournisseurSecretSARL');
  });

  it('buildQuoteInvalidPriceBody ne prend plus aucun argument (rien ne peut deriver de result)', () => {
    // qa-review 2026-09-15 : un argument dependant de la reponse Clariprint,
    // meme un simple nombre, est banni pour tout constructeur autre que
    // buildQuoteSuccessBody. La fonction n a plus de parametre du tout.
    expect(buildQuoteInvalidPriceBody).toHaveLength(0);
    const body = buildQuoteInvalidPriceBody();
    expect(body).toEqual({ success: false, error: 'Prix Clariprint invalide' });
    assertNoBannedToken(body);
  });

  it('buildQuoteServerErrorBody ne prend aucun argument et masque le detail de l exception', () => {
    expect(buildQuoteServerErrorBody).toHaveLength(0);
    const body = buildQuoteServerErrorBody();
    expect(body).toEqual({ success: false, error: 'Erreur serveur' });
    assertNoBannedToken(body);
    expect(JSON.stringify(body)).not.toContain('lrdp.clariprint.com');
  });

  it('buildQuoteSuccessBody ne transporte que les 6 champs metier, jamais les gammes brutes', () => {
    // Simule un payload Clariprint OK avec gammes multiples : la fonction ne
    // les recoit meme pas dans sa signature typee, elle ne peut pas les
    // laisser fuiter.
    const body = buildQuoteSuccessBody({
      priceHT: 42.5,
      costs: { impression: 10, papier: 5 },
      delais: 3,
      weight: 1.2,
      fournisseur: 'FournisseurX',
      processDuration: 12,
    });
    expect(body).toEqual({
      success: true,
      priceHT: 42.5,
      costs: { impression: 10, papier: 5 },
      delais: 3,
      weight: 1.2,
      fournisseur: 'FournisseurX',
      processDuration: 12,
    });
    assertNoBannedToken(body);
    expect(Object.keys(body).sort()).toEqual(
      ['costs', 'delais', 'fournisseur', 'priceHT', 'processDuration', 'success', 'weight'].sort(),
    );
  });

  it('buildQuoteSuccessBody sanitise costs.total invalide (deplace hors index.ts)', () => {
    const body = buildQuoteSuccessBody({
      priceHT: 10,
      costs: { impression: 5, total: -3 },
    });
    expect((body.costs as Record<string, unknown>).total).toBeUndefined();
    expect((body.costs as Record<string, unknown>).impression).toBe(5);
  });

  it('buildAuthTestBody ne renvoie que timestamp/success/message, jamais l hote ni le login', () => {
    const body = buildAuthTestBody({ success: false, message: 'Echec CheckAuth' });
    expect(Object.keys(body).sort()).toEqual(['message', 'success', 'timestamp']);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('clariprint.com');
    expect(serialized).not.toContain('CLARIPRINT_LOGIN');
    assertNoBannedToken(body);
  });
});

describe('regression "constructeur qui recopie ...input" (qa-review 2026-09-15, mutation 14)', () => {
  // Chaque constructeur est appele avec des cles en trop (via `as any`, pour
  // contourner le typage strict) : si l implementation venait a faire
  // `return { ...input }` au lieu de lister ses champs un par un, ces cles
  // superflues se retrouveraient dans la reponse et ce test rougirait.
  const POISON_KEYS = ['all_process', 'all_faulty_process', 'rawResponse', 'parsedResponse', 'secretField'];

  function assertExactKeys(body: object, expectedKeys: string[]): void {
    const keys = Object.keys(body).sort();
    expect(keys).toEqual([...expectedKeys].sort());
    for (const poison of POISON_KEYS) {
      expect(keys).not.toContain(poison);
    }
  }

  it('buildQuoteCredentialsMissingBody', () => {
    const body = buildQuoteCredentialsMissingBody('msg' as any);
    assertExactKeys(body, ['success', 'credentialsMissing', 'message']);
  });

  it('buildQuoteMissingProductBody ignore un argument injecte', () => {
    const body = (buildQuoteMissingProductBody as any)({ all_process: ['x'], secretField: 1 });
    assertExactKeys(body, ['success', 'error']);
  });

  it('buildQuoteHttpErrorBody ignore un argument injecte', () => {
    const body = (buildQuoteHttpErrorBody as any)({ rawResponse: { huge: 'payload' } });
    assertExactKeys(body, ['success', 'error']);
  });

  it('buildQuoteInvalidJsonBody ignore un argument injecte', () => {
    const body = (buildQuoteInvalidJsonBody as any)({ parsedResponse: { x: 1 } });
    assertExactKeys(body, ['success', 'error']);
  });

  it('buildQuoteCalcErrorBody ignore un argument injecte', () => {
    const body = (buildQuoteCalcErrorBody as any)({ all_faulty_process: { a: 1 } });
    assertExactKeys(body, ['success', 'error']);
  });

  it('buildQuoteInvalidPriceBody ignore un argument injecte', () => {
    const body = (buildQuoteInvalidPriceBody as any)({ result: { secret: true } });
    assertExactKeys(body, ['success', 'error']);
  });

  it('buildQuoteServerErrorBody ignore un argument injecte', () => {
    const body = (buildQuoteServerErrorBody as any)({ message: String(new Error('boom au host lrdp.clariprint.com')) });
    assertExactKeys(body, ['success', 'error']);
  });

  it('buildQuoteSuccessBody ignore les cles en trop meme avec un objet force via as any', () => {
    const poisoned = {
      priceHT: 10,
      costs: { total: 5 },
      delais: 1,
      weight: 1,
      fournisseur: 'F',
      processDuration: 1,
      all_process: ['gamme-secrete'],
      all_faulty_process: { x: 1 },
      rawResponse: { everything: true },
      secretField: 'ne doit jamais sortir',
    } as any;
    const body = buildQuoteSuccessBody(poisoned);
    assertExactKeys(body, ['success', 'priceHT', 'costs', 'delais', 'weight', 'fournisseur', 'processDuration']);
  });

  it('buildAuthTestBody ignore les cles en trop meme avec un objet force via as any', () => {
    const poisoned = {
      success: true,
      message: 'ok',
      rawResponse: '...',
      parsedResponse: { a: 1 },
      environment: { CLARIPRINT_HOST: 'lrdp.clariprint.com' },
    } as any;
    const body = buildAuthTestBody(poisoned);
    assertExactKeys(body, ['timestamp', 'success', 'message']);
  });
});
