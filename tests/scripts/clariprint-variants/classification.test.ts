import { describe, expect, it, vi } from 'vitest';
import {
  boundedResponseRaw,
  classifyCheckAuthCall,
  classifyQuoteCall,
  classifyResponseValue,
  collectKnownPrinterNames,
  performRawCall,
  RESPONSE_RAW_MAX_LENGTH,
  shouldIncludeResponseRaw,
  substituteKnownNames,
  TRANSPORT_TIMEOUT_MS,
} from '../../../scripts/diagnostics/clariprint-variants/classification.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe('performRawCall', () => {
  it("classe une exception reseau en 'network_error', sans httpStatus ni payload", async () => {
    const fetchImpl = async () => { throw new TypeError('fetch failed: getaddrinfo ENOTFOUND host.invalid'); };
    const result = await performRawCall(fetchImpl, 'https://host.invalid', 'body');
    expect(result).toEqual({ transport: 'network_error', httpStatus: null, payload: null, ok2xx: false });
  });

  it("classe un AbortError en 'timeout'", async () => {
    const fetchImpl = async () => { const error = new Error('aborted'); error.name = 'AbortError'; throw error; };
    const result = await performRawCall(fetchImpl, 'https://host.invalid', 'body');
    expect(result.transport).toBe('timeout');
    expect(result.ok2xx).toBe(false);
  });

  it("un statut non-2xx (5xx) reste transport 'ok' mais ok2xx=false, SANS LIRE LE CORPS", async () => {
    let bodyRead = false;
    const fetchImpl = async () => {
      const response = new Response('login=SECRET&password=SECRET', { status: 503 });
      const originalText = response.text.bind(response);
      response.text = async () => { bodyRead = true; return originalText(); };
      return response;
    };
    const result = await performRawCall(fetchImpl, 'https://host.invalid', 'body');
    expect(result).toEqual({ transport: 'ok', httpStatus: 503, payload: null, ok2xx: false });
    expect(bodyRead).toBe(false);
  });

  it("un statut non-2xx (4xx) donne aussi ok2xx=false", async () => {
    const fetchImpl = async () => new Response('not found', { status: 404 });
    const result = await performRawCall(fetchImpl, 'https://host.invalid', 'body');
    expect(result.ok2xx).toBe(false);
    expect(result.httpStatus).toBe(404);
  });

  // qa-review round 2 (MOYEN, K2) : un 403 dont le corps contient
  // `{success:false}` ne doit JAMAIS etre lu — le corps n'est pas lu du
  // tout sur un non-2xx (4xx compris), donc `payload` reste `null`.
  it('un 403 avec un corps {success:false} ne lit PAS le corps (payload reste null)', async () => {
    let bodyRead = false;
    const fetchImpl = async () => {
      const response = new Response(JSON.stringify({ success: false }), { status: 403 });
      const originalText = response.text.bind(response);
      response.text = async () => { bodyRead = true; return originalText(); };
      return response;
    };
    const result = await performRawCall(fetchImpl, 'https://host.invalid', 'body');
    expect(result).toEqual({ transport: 'ok', httpStatus: 403, payload: null, ok2xx: false });
    expect(bodyRead).toBe(false);
  });

  // qa-review round 2 (BAS, resu #2) : le delai doit bornera la LECTURE du
  // corps, pas seulement l obtention de la reponse HTTP. Un corps qui ne se
  // termine jamais ne doit jamais bloquer indefiniment : timeout attendu.
  it('un corps qui ne se termine jamais donne timeout apres le delai (la lecture du corps est bornee)', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = async () => ({
        status: 200,
        text: () => new Promise(() => { /* ne se resout jamais */ }),
      });
      const resultPromise = performRawCall(fetchImpl, 'https://host.invalid', 'body');
      await vi.advanceTimersByTimeAsync(TRANSPORT_TIMEOUT_MS + 1);
      const result = await resultPromise;
      expect(result).toEqual({ transport: 'timeout', httpStatus: null, payload: null, ok2xx: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("un corps non-JSON sur un 2xx donne transport='non_json'", async () => {
    const fetchImpl = async () => new Response('not json', { status: 200 });
    const result = await performRawCall(fetchImpl, 'https://host.invalid', 'body');
    expect(result).toEqual({ transport: 'non_json', httpStatus: 200, payload: null, ok2xx: false });
  });

  it('un JSON valide sur un 2xx donne ok2xx=true et le payload parse', async () => {
    const fetchImpl = async () => jsonResponse({ success: true, response: 12 });
    const result = await performRawCall(fetchImpl, 'https://host.invalid', 'body');
    expect(result).toEqual({ transport: 'ok', httpStatus: 200, payload: { success: true, response: 12 }, ok2xx: true });
  });
});

describe('classifyCheckAuthCall', () => {
  it('ok2xx=false -> transport_failure, quel que soit le transport', () => {
    for (const transport of ['network_error', 'timeout', 'non_json']) {
      expect(classifyCheckAuthCall({ transport, httpStatus: null, payload: null, ok2xx: false })).toMatchObject({ outcome: 'transport_failure' });
    }
    expect(classifyCheckAuthCall({ transport: 'ok', httpStatus: 503, payload: null, ok2xx: false })).toMatchObject({ outcome: 'transport_failure', httpStatus: 503 });
    expect(classifyCheckAuthCall({ transport: 'ok', httpStatus: 404, payload: null, ok2xx: false })).toMatchObject({ outcome: 'transport_failure', httpStatus: 404 });
  });

  // qa-review round 2 (MOYEN, K2) : un 403 (4xx) accompagne d un
  // `{success:false}` — meme si un futur `performRawCall` peuplait `payload`
  // par erreur sur un non-2xx — reste une `transport_failure`, JAMAIS
  // `auth_refused`. `ok2xx=false` doit primer sur tout contenu de `payload`.
  it('un 403 avec un corps {success:false} donne transport_failure, JAMAIS auth_refused', () => {
    const result = classifyCheckAuthCall({ transport: 'ok', httpStatus: 403, payload: { success: false }, ok2xx: false });
    expect(result.outcome).toBe('transport_failure');
    expect(result.outcome).not.toBe('auth_refused');
  });

  it('JSON success:false -> auth_refused', () => {
    expect(classifyCheckAuthCall({ transport: 'ok', httpStatus: 200, payload: { success: false }, ok2xx: true })).toEqual({
      outcome: 'auth_refused', transport: 'ok', httpStatus: 200, upstreamSuccess: false,
    });
  });

  it('JSON success:true (ou absent) -> allowed', () => {
    expect(classifyCheckAuthCall({ transport: 'ok', httpStatus: 200, payload: { success: true }, ok2xx: true }).outcome).toBe('allowed');
    expect(classifyCheckAuthCall({ transport: 'ok', httpStatus: 200, payload: {}, ok2xx: true }).outcome).toBe('allowed');
  });
});

describe('classifyResponseValue', () => {
  it('classe chacune des six categories', () => {
    expect(classifyResponseValue(5)).toBe('positive');
    expect(classifyResponseValue(0)).toBe('zero');
    expect(classifyResponseValue(-1)).toBe('negative');
    expect(classifyResponseValue(Number.NaN)).toBe('not_finite');
    expect(classifyResponseValue(Infinity)).toBe('not_finite');
    expect(classifyResponseValue(undefined)).toBe('absent');
    expect(classifyResponseValue(null)).toBe('absent');
    expect(classifyResponseValue('not-a-number')).toBe('non_number');
  });
});

describe('classifyQuoteCall', () => {
  it('ok2xx=false -> transport_failure', () => {
    expect(classifyQuoteCall({ transport: 'network_error', httpStatus: null, payload: null, ok2xx: false }).outcome).toBe('transport_failure');
  });

  it('success:false -> refused, jamais priced/invalid_price', () => {
    const result = classifyQuoteCall({ transport: 'ok', httpStatus: 200, payload: { success: false, error: 'x' }, ok2xx: true });
    expect(result.outcome).toBe('refused');
    expect(result.responseClass).toBeNull();
  });

  it('success:true et response nombre fini >= 0 (y compris zero) -> priced', () => {
    expect(classifyQuoteCall({ transport: 'ok', httpStatus: 200, payload: { success: true, response: 42 }, ok2xx: true }).outcome).toBe('priced');
    expect(classifyQuoteCall({ transport: 'ok', httpStatus: 200, payload: { success: true, response: 0 }, ok2xx: true }).outcome).toBe('priced');
  });

  it('success:true et response negatif/non-fini/absent/non-numerique -> invalid_price', () => {
    expect(classifyQuoteCall({ transport: 'ok', httpStatus: 200, payload: { success: true, response: -1 }, ok2xx: true }).outcome).toBe('invalid_price');
    expect(classifyQuoteCall({ transport: 'ok', httpStatus: 200, payload: { success: true, response: Number.NaN }, ok2xx: true }).outcome).toBe('invalid_price');
    expect(classifyQuoteCall({ transport: 'ok', httpStatus: 200, payload: { success: true }, ok2xx: true }).outcome).toBe('invalid_price');
    expect(classifyQuoteCall({ transport: 'ok', httpStatus: 200, payload: { success: true, response: 'x' }, ok2xx: true }).outcome).toBe('invalid_price');
  });

  // qa-review round 2 (MOYEN, K2) : un 403 (4xx) reste une transport_failure,
  // jamais `refused`, meme si `payload` etait (a tort) peuple.
  it('un 403 avec un corps {success:false} donne transport_failure, JAMAIS refused', () => {
    const result = classifyQuoteCall({ transport: 'ok', httpStatus: 403, payload: { success: false }, ok2xx: false });
    expect(result.outcome).toBe('transport_failure');
    expect(result.outcome).not.toBe('refused');
  });
});

describe('shouldIncludeResponseRaw (qa-review round 2, MOYEN, sonde n°1)', () => {
  it('autorise UNIQUEMENT les trois classes d anomalie numerique', () => {
    expect(shouldIncludeResponseRaw('negative')).toBe(true);
    expect(shouldIncludeResponseRaw('not_finite')).toBe(true);
    expect(shouldIncludeResponseRaw('zero')).toBe(true);
    expect(shouldIncludeResponseRaw('positive')).toBe(false);
    expect(shouldIncludeResponseRaw('non_number')).toBe(false);
    expect(shouldIncludeResponseRaw('absent')).toBe(false);
  });

  // Sonde qa n°1 : success:"true" (CHAINE, pas le booleen) avec
  // response:178.95 classe en invalid_price/positive — response_raw NE DOIT
  // PAS en sortir (ce serait un prix positif dans l archive commitee).
  it("sonde 1 : success chaine 'true' + response positif -> invalid_price/positive, response_raw INTERDIT", () => {
    const classified = classifyQuoteCall({ transport: 'ok', httpStatus: 200, payload: { success: 'true', response: 178.95 }, ok2xx: true });
    expect(classified.outcome).toBe('invalid_price');
    expect(classified.responseClass).toBe('positive');
    expect(shouldIncludeResponseRaw(classified.responseClass)).toBe(false);
  });

  // Sonde qa n°2 : response en texte (nom d imprimeur) -> non_number,
  // response_raw INTERDIT.
  it('sonde 2 : response en texte -> non_number, response_raw INTERDIT', () => {
    const classified = classifyQuoteCall({ transport: 'ok', httpStatus: 200, payload: { success: true, response: 'Aucun stock chez ImprimerieDupont' }, ok2xx: true });
    expect(classified.outcome).toBe('invalid_price');
    expect(classified.responseClass).toBe('non_number');
    expect(shouldIncludeResponseRaw(classified.responseClass)).toBe(false);
  });

  // Sonde qa n°3 : response en objet -> non_number, response_raw INTERDIT.
  it('sonde 3 : response en objet -> non_number, response_raw INTERDIT', () => {
    const classified = classifyQuoteCall({ transport: 'ok', httpStatus: 200, payload: { success: true, response: { html: '<div>x</div>' } }, ok2xx: true });
    expect(classified.outcome).toBe('invalid_price');
    expect(classified.responseClass).toBe('non_number');
    expect(shouldIncludeResponseRaw(classified.responseClass)).toBe(false);
  });
});

describe('collectKnownPrinterNames', () => {
  it('collecte les cles de all_faulty_process, les printer de all_process, et fournisseur — dedupliques, ordre stable', () => {
    const names = collectKnownPrinterNames({
      all_faulty_process: { ImprimerieAlpha: 'raison' },
      all_process: [{ printer: 'ImprimerieAlpha' }, { printer: 'ImprimerieBeta' }],
      fournisseur: 'ImprimerieGamma',
    });
    expect(names).toEqual(['ImprimerieAlpha', 'ImprimerieBeta', 'ImprimerieGamma']);
  });

  it('ignore les noms trop courts (moins de 3 caracteres)', () => {
    expect(collectKnownPrinterNames({ fournisseur: 'ab' })).toEqual([]);
    expect(collectKnownPrinterNames({ fournisseur: 'abc' })).toEqual(['abc']);
  });

  it('rend un tableau vide sans payload', () => {
    expect(collectKnownPrinterNames(null)).toEqual([]);
    expect(collectKnownPrinterNames(undefined)).toEqual([]);
  });
});

describe('substituteKnownNames', () => {
  it('remplace chaque nom par son ordinal, dans l ordre de la liste', () => {
    expect(substituteKnownNames('Probleme chez ImprimerieAlpha', ['ImprimerieAlpha'])).toBe('Probleme chez imprimeur_1');
  });

  it('ne modifie pas le texte si aucun nom ne correspond', () => {
    expect(substituteKnownNames('Texte neutre', ['ImprimerieAlpha'])).toBe('Texte neutre');
  });

  // qa-review round 2 (BAS, residu n°1) : substitution INSENSIBLE A LA CASSE.
  it('substitue independamment de la casse', () => {
    expect(substituteKnownNames('probleme chez imprimeriealpha', ['ImprimerieAlpha'])).toBe('probleme chez imprimeur_1');
    expect(substituteKnownNames('Probleme chez IMPRIMERIEALPHA', ['ImprimerieAlpha'])).toBe('Probleme chez imprimeur_1');
  });
});

describe('boundedResponseRaw', () => {
  it(`tronque a ${RESPONSE_RAW_MAX_LENGTH} caracteres au plus`, () => {
    const result = boundedResponseRaw('x'.repeat(200));
    expect(result).toHaveLength(RESPONSE_RAW_MAX_LENGTH);
  });

  it('garde une valeur scalaire courte telle quelle', () => {
    expect(boundedResponseRaw(-1)).toBe('-1');
  });
});
