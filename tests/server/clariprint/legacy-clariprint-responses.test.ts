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

  it('buildQuoteInvalidPriceBody ne renvoie pas la reponse Clariprint entiere', () => {
    const negative = buildQuoteInvalidPriceBody(-1.2);
    expect(negative).toEqual({ success: false, error: 'Prix Clariprint invalide (negatif)' });
    const nanCase = buildQuoteInvalidPriceBody(undefined);
    expect(nanCase).toEqual({ success: false, error: 'Prix Clariprint invalide (absent, NaN ou non-numerique)' });
    assertNoBannedToken(negative);
    assertNoBannedToken(nanCase);
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

  it('buildAuthTestBody ne renvoie que timestamp/success/message, jamais l hote ni le login', () => {
    const body = buildAuthTestBody({ success: false, message: 'Echec CheckAuth' });
    expect(Object.keys(body).sort()).toEqual(['message', 'success', 'timestamp']);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('clariprint.com');
    expect(serialized).not.toContain('CLARIPRINT_LOGIN');
    assertNoBannedToken(body);
  });
});
