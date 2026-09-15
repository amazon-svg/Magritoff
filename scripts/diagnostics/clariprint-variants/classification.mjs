/**
 * BCP-1a — arbitrages de l'architecte sur la qa-review de `d8a0a57b`
 * (docs/api/CONVENTIONS.md §8.25 point 2.3, point (1) : « Règle d'arrêt du
 * banc sur panne »). Classification d'un appel Clariprint, en fonctions
 * PURES (sauf `performRawCall`, qui fait le seul appel réseau et reçoit
 * `fetchImpl` en paramètre — jamais `globalThis.fetch` implicite).
 *
 * Chaque appel est classé dans une énumération FERMÉE. Seules trois classes
 * sont des VERDICTS (`priced`, `refused`, `invalid_price`) : une décision de
 * contrat (422/502) ne se prend JAMAIS sur la quatrième, `transport_failure`
 * — qui couvre une erreur réseau, un délai dépassé, TOUT statut HTTP non 2xx
 * (un 4xx compris : un statut n'est pas une réponse de calcul) et un corps
 * non JSON.
 */

/** Délai d'un appel, aligné sur la passerelle de production (20 s). */
export const TRANSPORT_TIMEOUT_MS = 20_000;

export const CALL_OUTCOMES = Object.freeze(['priced', 'refused', 'invalid_price', 'transport_failure']);
export const RESPONSE_CLASSES = Object.freeze(['positive', 'zero', 'negative', 'not_finite', 'absent', 'non_number']);

/** `response_raw` : au plus 32 caractères (point 2, calls.json). */
export const RESPONSE_RAW_MAX_LENGTH = 32;
/** Nom trop court pour être substitué sans risque de corrompre un texte sans rapport. */
export const MIN_PRINTER_NAME_LENGTH = 3;

/**
 * Le seul appel réseau du banc. Ne retourne JAMAIS le corps brut d'une
 * réponse non-2xx ni non-JSON : `payload` reste `null` dans ces deux cas,
 * `ok2xx` vaut `false`. C'est la classification (`classifyCheckAuthCall`/
 * `classifyQuoteCall`) qui décide de l'issue à partir de ce résultat.
 */
export async function performRawCall(fetchImpl, url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSPORT_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    const timedOut = Boolean(error) && (error.name === 'AbortError' || error.name === 'TimeoutError');
    return { transport: timedOut ? 'timeout' : 'network_error', httpStatus: null, payload: null, ok2xx: false };
  }
  clearTimeout(timer);
  const httpStatus = response.status;
  const statusOk = httpStatus >= 200 && httpStatus < 300;
  if (!statusOk) {
    // Un 4xx (ou tout autre non-2xx) n'est PAS lu : « faute de réponse de
    // calcul lisible » (arbitrage architecte, point (1)). Le corps n'est
    // donc jamais transmis à la classification.
    return { transport: 'ok', httpStatus, payload: null, ok2xx: false };
  }
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { transport: 'non_json', httpStatus, payload: null, ok2xx: false };
  }
  return { transport: 'ok', httpStatus, payload, ok2xx: true };
}

/**
 * `CheckAuth` — « identifiants refusés » exige une réponse JSON avec
 * `success: false`. Un 5xx, une erreur réseau, un délai dépassé, un 4xx ou
 * un corps non JSON donnent `transport_failure`, JAMAIS `auth_refused`.
 */
export function classifyCheckAuthCall(rawResult) {
  if (!rawResult.ok2xx) {
    return { outcome: 'transport_failure', transport: rawResult.transport, httpStatus: rawResult.httpStatus, upstreamSuccess: null };
  }
  if (rawResult.payload && rawResult.payload.success === false) {
    return { outcome: 'auth_refused', transport: 'ok', httpStatus: rawResult.httpStatus, upstreamSuccess: false };
  }
  return { outcome: 'allowed', transport: 'ok', httpStatus: rawResult.httpStatus, upstreamSuccess: true };
}

/** `response_class` : catégorie de `payload.response`, jamais sa valeur. */
export function classifyResponseValue(raw) {
  if (raw === undefined || raw === null) return 'absent';
  if (typeof raw !== 'number') return 'non_number';
  if (!Number.isFinite(raw)) return 'not_finite';
  if (raw > 0) return 'positive';
  if (raw === 0) return 'zero';
  return 'negative';
}

/**
 * Un appel de chiffrage. Trois verdicts, une panne :
 *  - `priced` : JSON, `success: true`, `response` nombre fini ≥ 0 ;
 *  - `refused` : JSON, `success: false` ;
 *  - `invalid_price` : JSON, `success: true`, `response` négatif, non fini,
 *    absent ou non numérique (ou une forme de `success` ni `true` ni
 *    `false`, par défaut prudent — non documentée par le cadrage) ;
 *  - `transport_failure` : voir `performRawCall`.
 */
export function classifyQuoteCall(rawResult) {
  if (!rawResult.ok2xx) {
    return { outcome: 'transport_failure', transport: rawResult.transport, httpStatus: rawResult.httpStatus, upstreamSuccess: null, responseClass: null, rawValue: undefined };
  }
  const payload = rawResult.payload;
  if (payload && payload.success === false) {
    return { outcome: 'refused', transport: 'ok', httpStatus: rawResult.httpStatus, upstreamSuccess: false, responseClass: null, rawValue: undefined };
  }
  const rawValue = payload ? payload.response : undefined;
  const responseClass = classifyResponseValue(rawValue);
  const isValidPrice = Boolean(payload) && payload.success === true && typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue >= 0;
  return {
    outcome: isValidPrice ? 'priced' : 'invalid_price',
    transport: 'ok',
    httpStatus: rawResult.httpStatus,
    upstreamSuccess: payload ? payload.success === true : null,
    responseClass,
    rawValue,
  };
}

/**
 * Les noms d'imprimeurs connus d'UNE réponse (clés de `all_faulty_process`,
 * champs `printer` de `all_process`, `fournisseur`), déduplication en
 * conservant l'ordre de première apparition. Un nom de moins de
 * `MIN_PRINTER_NAME_LENGTH` caractères n'est jamais retenu (risque de
 * corrompre un texte sans rapport par une sous-chaîne trop courte).
 */
export function collectKnownPrinterNames(payload) {
  const names = [];
  const seen = new Set();
  const add = (candidate) => {
    if (typeof candidate === 'string' && candidate.length >= MIN_PRINTER_NAME_LENGTH && !seen.has(candidate)) {
      seen.add(candidate);
      names.push(candidate);
    }
  };
  const faulty = payload && payload.all_faulty_process;
  if (faulty && typeof faulty === 'object' && !Array.isArray(faulty)) {
    for (const key of Object.keys(faulty)) add(key);
  }
  if (payload && Array.isArray(payload.all_process)) {
    for (const entry of payload.all_process) {
      if (entry && typeof entry === 'object') add(entry.printer);
    }
  }
  add(payload && payload.fournisseur);
  return names;
}

/** Remplace chaque nom connu par son ordinal (`imprimeur_1`, `imprimeur_2`…), dans l'ordre de la liste. */
export function substituteKnownNames(text, knownNames) {
  let result = text;
  knownNames.forEach((name, index) => {
    result = result.split(name).join(`imprimeur_${index + 1}`);
  });
  return result;
}

export function countAllProcess(payload) {
  return payload && Array.isArray(payload.all_process) ? payload.all_process.length : 0;
}

export function countFaultyProcess(payload) {
  const value = payload && payload.all_faulty_process;
  if (!value || typeof value !== 'object') return 0;
  return Array.isArray(value) ? value.length : Object.keys(value).length;
}

/**
 * `response_raw` (calls.json) : UNIQUEMENT pour `invalid_price`, une chaîne
 * de 32 caractères au plus. « Un `-1` est un signal d'anomalie, pas un
 * coût » (point 2) : le cadrage accepte ce résidu borné, à la différence de
 * `rawResponseValue` du verdict serveur (§8.25 point 2.3) qui remplace tout
 * objet/tableau par son seul type — ici la valeur peut être un scalaire
 * d'anomalie (`-1`, `NaN`, `null`…), jamais un coût ni un texte métier.
 */
export function boundedResponseRaw(rawValue) {
  const text = typeof rawValue === 'string' ? rawValue : safeStringify(rawValue);
  return text.length > RESPONSE_RAW_MAX_LENGTH ? text.slice(0, RESPONSE_RAW_MAX_LENGTH) : text;
}

function safeStringify(value) {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? serialized : String(value);
  } catch {
    return String(value);
  }
}
