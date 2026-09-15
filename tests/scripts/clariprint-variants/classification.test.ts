import { describe, expect, it } from 'vitest';
import {
  boundedResponseRaw,
  classifyCheckAuthCall,
  classifyQuoteCall,
  classifyResponseValue,
  collectKnownPrinterNames,
  performRawCall,
  RESPONSE_RAW_MAX_LENGTH,
  substituteKnownNames,
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
