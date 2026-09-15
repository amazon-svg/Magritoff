/**
 * BCP-1a (docs/api/CONVENTIONS.md §8.25 point 2.3) — le verdict Clariprint.
 *
 * À chaque appel à Clariprint, succès compris, la passerelle construit un
 * verdict : un instantané diagnostic de l'appel amont, EXPURGÉ, destiné au
 * seul journal (jamais à la réponse publique — point 2.3 (a) : « ne rien
 * ajouter » à la réponse ; « le diagnostic se lit au journal, par
 * request_id »).
 *
 * Expurgation « par liste AUTORISÉE, jamais par liste d'interdits » (point
 * 2.3) : tout ce qui n'est pas explicitement listé ici comme sortant du
 * détail interne des gammes (`all_faulty_process`) ou de la charge envoyée
 * (`reference`, `address`) est retenu tel quel. Un champ que Clariprint
 * ajouterait demain à `all_process`/`all_faulty_process` ne fuit donc pas
 * par défaut.
 *
 * Ne sortent JAMAIS d'ici : `login`, `password`, l'URL de l'hôte,
 * `external_id`, les noms d'imprimeurs (remplacés par un ordinal), `CSV`,
 * `PDF`, `quote_process`, `html`, `text`, les coûts par imprimeur — ce
 * fichier n'a d'ailleurs accès à aucun de ces champs : la passerelle ne lui
 * transmet que ce qui est déjà énuméré dans `ClariprintQuoteVerdictInput`.
 *
 * qa-review round 1 (REJET) — correction opposable : `upstreamError` ne doit
 * porter QUE `payload.error` (le texte métier que Clariprint renvoie sur un
 * refus `success:false`), jamais un extrait de réponse HTTP ni le message
 * d'une exception réseau (qui porte souvent l'hôte, ou les paramètres
 * envoyés sur un corps non-OK reflété). Ce fichier ne peut pas distinguer
 * ces cas lui-même : c'est à l'APPELANT (la passerelle) de ne JAMAIS lui
 * passer autre chose que `payload.error` dans `upstreamError`, et de
 * qualifier toute panne de transport par `failureCategory` (une catégorie
 * fermée, sans aucun contenu textuel amont).
 *
 * Arbitrage de l'architecte sur la qa-review de BCP-1a (commit `d8a0a57b`),
 * point (3) — « la liste "Ne sortent jamais" se lit par destination » :
 * `payload.error` (et, par extension, chaque texte de `all_faulty_process`)
 * PEUT nommer un imprimeur du parc. Il est AUTORISÉ au seul journal de
 * fonction, mais SEULEMENT après SUBSTITUTION de chaque nom d'imprimeur
 * connu **de la même réponse** (clés de `all_faulty_process`, champs
 * `printer` de `all_process`, `fournisseur`) par son ordinal
 * (`imprimeur_1`, `imprimeur_2`…), puis troncature. `errorClass` accompagne
 * ce texte : `'unclassified'` tant que l'énumération fermée n'est pas fixée
 * par l'architecte à l'écriture du contrat de BCP-1b (point (3)).
 */

/** Les quatre issues possibles d'un appel (docs/api/CONVENTIONS.md §8.25 point 2.2). */
export type ClariprintQuoteOutcome = 'priced' | 'not_priced' | 'unavailable' | 'not_configured';

/**
 * Catégorie d'une panne de TRANSPORT (jamais un texte amont) :
 * `'network'` (exception `fetch`), `'http_status'` (statut non-2xx),
 * `'non_json'` (corps non-JSON). qa-review round 1 : ces trois chemins ne
 * portent plus jamais le corps/le message brut, seulement cette catégorie
 * et le statut HTTP amont quand il existe (`upstreamStatus`).
 */
export type ClariprintQuoteFailureCategory = 'network' | 'http_status' | 'non_json';

/**
 * Énumération fermée, `'unclassified'` comme seule valeur tant que
 * l'architecte n'a pas fixé les classes au contrat de BCP-1b, d'après les
 * textes observés pendant la campagne du banc (point (3)).
 */
export type ClariprintQuoteErrorClass = 'unclassified';

export const UPSTREAM_ERROR_MAX_LENGTH = 500;
export const MAX_FAULTY_PROCESS_ENTRIES = 20;
export const FAULTY_PROCESS_DETAIL_MAX_LENGTH = 300;
/** qa-review round 1 (MOYEN) : `rawResponseValue` est un scalaire borné, jamais un extrait d'objet. */
export const RAW_RESPONSE_VALUE_MAX_LENGTH = 200;
/**
 * qa-review round 1 (BAS) : la charge envoyée vient d'un appelant PUBLIC
 * (corps de requête non fiable). Sans plafond, un corps volumineux gonfle
 * le journal indéfiniment. Au-delà, le contenu est retiré et remplacé par
 * sa seule longueur d'origine.
 */
export const MAX_SENT_CONFIG_LOG_LENGTH = 4000;
/** Voir `buildPrinterNameOrdinalMap` : un nom plus court n'est jamais substitué. */
export const MIN_PRINTER_NAME_LENGTH = 3;

export type ClariprintFaultyProcessEntry = Readonly<{
  /** Ordinal, JAMAIS le nom réel de l'imprimeur (`imprimeur_1`, `imprimeur_2`…). */
  printer: string;
  detail: string;
}>;

/** `sentConfig` expurgé, ou son substitut si sa taille sérialisée dépasse le plafond. */
export type ClariprintQuoteVerdictSentConfig =
  | Readonly<Record<string, unknown>>
  | Readonly<{ truncated: true; originalLength: number }>;

export type ClariprintQuoteVerdict = Readonly<{
  upstreamStatus: number | null;
  upstreamSuccess: boolean | null;
  /**
   * UNIQUEMENT `payload.error` (texte métier Clariprint), jamais un extrait
   * de réponse HTTP — APRÈS substitution des noms d'imprimeurs connus de la
   * même réponse par leur ordinal, puis troncature (point (3)).
   */
  upstreamError: string | null;
  /** `'unclassified'` quand `upstreamError` est renseigné, sinon `null`. */
  errorClass: ClariprintQuoteErrorClass | null;
  /** Renseignée UNIQUEMENT sur une panne de transport (réseau, HTTP, JSON). */
  failureCategory: ClariprintQuoteFailureCategory | null;
  rawResponseValue: string | null;
  allProcessCount: number;
  allFaultyProcess: readonly ClariprintFaultyProcessEntry[];
  durationMs: number;
  sentConfig: ClariprintQuoteVerdictSentConfig;
}>;

export type ClariprintQuoteVerdictInput = Readonly<{
  upstreamStatus: number | null;
  upstreamSuccess: boolean | null;
  /**
   * UNIQUEMENT `payload.error` — jamais un corps de réponse brut, jamais un
   * message d'exception. Voir `failureCategory` pour toute panne de
   * transport.
   */
  upstreamError?: unknown;
  failureCategory?: ClariprintQuoteFailureCategory;
  rawResponseValue?: unknown;
  allProcess?: unknown;
  allFaultyProcess?: unknown;
  /** Lu UNIQUEMENT pour substituer ce nom s'il apparaît dans `upstreamError`/`allFaultyProcess` (point (3)). */
  fournisseur?: unknown;
  durationMs: number;
  sentConfig: Readonly<Record<string, unknown>>;
}>;

/** Tronque une erreur amont à 500 caractères. `null` si ce n'est pas une chaîne. */
export function truncateUpstreamError(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.length > UPSTREAM_ERROR_MAX_LENGTH ? value.slice(0, UPSTREAM_ERROR_MAX_LENGTH) : value;
}

/** Nombre d'entrées de `all_process` — jamais son contenu. */
export function countAllProcessEntries(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Construit, pour UNE réponse Clariprint, la correspondance nom réel ->
 * ordinal (`imprimeur_1`, `imprimeur_2`…), à partir des SEULES sources
 * documentées : les clés de `all_faulty_process` (objet), les champs
 * `printer` de `all_process`, et `fournisseur`. Ordre stable, premier vu
 * gagne (déduplication). Utilisée à la fois pour numéroter
 * `all_faulty_process` et pour substituer ces noms dans `payload.error`
 * avant de le garder au journal (point (3)).
 */
function buildPrinterNameOrdinalMap(input: ClariprintQuoteVerdictInput): ReadonlyMap<string, string> {
  const names: string[] = [];
  const seen = new Set<string>();
  const addName = (candidate: unknown): void => {
    // Un nom trop court (1-2 caractères) risquerait de correspondre à une
    // sous-chaîne d'un mot sans rapport (ex. "a" dans "amont") : la
    // substitution corromprait alors un texte qui ne nomme personne. Un nom
    // d'imprimeur réel fait toujours plus que MIN_PRINTER_NAME_LENGTH
    // caractères.
    if (typeof candidate === 'string' && candidate.length >= MIN_PRINTER_NAME_LENGTH && !seen.has(candidate)) {
      seen.add(candidate);
      names.push(candidate);
    }
  };
  const faulty = input.allFaultyProcess;
  if (faulty && typeof faulty === 'object' && !Array.isArray(faulty)) {
    for (const key of Object.keys(faulty as Record<string, unknown>)) addName(key);
  }
  if (Array.isArray(input.allProcess)) {
    for (const entry of input.allProcess) {
      if (entry && typeof entry === 'object') addName((entry as Record<string, unknown>).printer);
    }
  }
  addName(input.fournisseur);
  const map = new Map<string, string>();
  names.forEach((name, index) => map.set(name, `imprimeur_${index + 1}`));
  return map;
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remplace chaque nom connu (clé de la table) par son ordinal (valeur).
 * Aucune correspondance : texte inchangé. qa-review round 2 (BAS, résidu
 * n°1) : substitution INSENSIBLE À LA CASSE — un nom d'imprimeur cité avec
 * une casse différente de celle observée dans `all_process`/
 * `all_faulty_process`/`fournisseur` doit sortir substitué tout autant.
 */
function substituteKnownNames(text: string, ordinalMap: ReadonlyMap<string, string>): string {
  let result = text;
  for (const [name, ordinal] of ordinalMap) {
    result = result.replace(new RegExp(escapeForRegExp(name), 'gi'), ordinal);
  }
  return result;
}

/**
 * Expurge `all_faulty_process` : les clés (noms d'imprimeurs du parc du
 * compte) sont remplacées par un ordinal (`imprimeur_1`, `imprimeur_2`…), au
 * plus 20 entrées, 300 caractères chacune (point 2.3, « Sortent »).
 *
 * qa-review round 1 (MOYEN) — correction opposable : SEULES les valeurs qui
 * sont déjà des chaînes sont conservées. Une valeur qui n'en est pas une
 * (objet, tableau, nombre…) est ÉCARTÉE ENTIÈREMENT, jamais sérialisée en
 * JSON — la sérialisation précédente laissait passer `external_id`, `CSV`,
 * `PDF` ou des noms d'imprimeurs imbriqués dans ces valeurs.
 *
 * Arbitrage architecte, point (3) : le TEXTE de chaque entrée conservée
 * subit aussi la substitution des noms connus (un texte peut nommer un
 * AUTRE imprimeur que celui de sa propre clé).
 */
export function expurgeAllFaultyProcess(
  value: unknown,
  ordinalMap: ReadonlyMap<string, string> = new Map(),
): readonly ClariprintFaultyProcessEntry[] {
  if (!value || typeof value !== 'object') return [];
  const entries = Array.isArray(value)
    ? value.map((entry, index) => [String(index), entry] as const)
    : Object.entries(value as Record<string, unknown>);
  const stringEntries = entries.filter((entry): entry is readonly [string, string] => typeof entry[1] === 'string');
  return stringEntries.slice(0, MAX_FAULTY_PROCESS_ENTRIES).map(([key, detail], index) => ({
    printer: ordinalMap.get(key) ?? `imprimeur_${index + 1}`,
    detail: substituteKnownNames(detail, ordinalMap).slice(0, FAULTY_PROCESS_DETAIL_MAX_LENGTH),
  }));
}

/** Champs de texte libre pouvant porter le nom ou l'adresse d'une personne (point 2.3). */
const SENT_CONFIG_FORBIDDEN_KEYS = new Set(['reference', 'address']);

function expurgeSentConfigDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expurgeSentConfigDeep);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      if (SENT_CONFIG_FORBIDDEN_KEYS.has(key)) continue;
      result[key] = expurgeSentConfigDeep(entryValue);
    }
    return result;
  }
  return value;
}

function safeJsonStringifyLength(value: unknown): number | null {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? serialized.length : null;
  } catch {
    return null;
  }
}

/**
 * Expurge la charge effectivement envoyée : sans `reference` ni aucun
 * `address` (textes libres qui peuvent porter le nom ou l'adresse d'une
 * personne), à quelque profondeur qu'ils apparaissent (ex. dans
 * `deliveries.<clé>.address`).
 *
 * qa-review round 1 (BAS) — correction opposable : la charge vient d'un
 * appelant PUBLIC (corps de requête non fiable, `authentication: 'public'`),
 * et sa taille sérialisée n'était pas bornée. Au-delà de
 * `MAX_SENT_CONFIG_LOG_LENGTH`, le contenu est retiré et remplacé par sa
 * seule longueur d'origine.
 */
export function expurgeSentConfig(value: Readonly<Record<string, unknown>>): ClariprintQuoteVerdictSentConfig {
  const expurged = expurgeSentConfigDeep(value) as Record<string, unknown>;
  const length = safeJsonStringifyLength(expurged);
  if (length !== null && length > MAX_SENT_CONFIG_LOG_LENGTH) {
    return { truncated: true, originalLength: length };
  }
  return expurged;
}

/**
 * qa-review round 1 (MOYEN) — correction opposable : `rawResponseValue` ne
 * garde qu'un SCALAIRE (nombre, chaîne courte ou booléen), tronqué. Un objet
 * ou un tableau (qui peut porter `html`, `quote_process`, etc.) est
 * remplacé par son seul TYPE, jamais son contenu sérialisé.
 *
 * qa-review round 2 (BAS, résidu n°3) : quand `response` est un TEXTE (ex.
 * `"prix via ImprimerieDupont"`), il subit la MÊME substitution des noms
 * connus que `upstreamError`/`all_faulty_process`, AVANT troncature — sinon
 * un nom d'imprimeur sortirait tel quel par ce champ.
 */
function safeStringifyRawResponse(value: unknown, ordinalMap: ReadonlyMap<string, string>): string | null {
  if (value === undefined) return null;
  if (value === null) return 'null';
  if (typeof value === 'string') return truncateScalarString(substituteKnownNames(value, ordinalMap));
  if (typeof value === 'number' || typeof value === 'boolean') return truncateScalarString(String(value));
  if (Array.isArray(value)) return '[array]';
  if (typeof value === 'object') return '[object]';
  return truncateScalarString(String(value));
}

function truncateScalarString(value: string): string {
  return value.length > RAW_RESPONSE_VALUE_MAX_LENGTH ? value.slice(0, RAW_RESPONSE_VALUE_MAX_LENGTH) : value;
}

/** Construit le verdict à partir des observations brutes de la passerelle. */
export function buildClariprintQuoteVerdict(input: ClariprintQuoteVerdictInput): ClariprintQuoteVerdict {
  const ordinalMap = buildPrinterNameOrdinalMap(input);
  const rawUpstreamError = typeof input.upstreamError === 'string' ? input.upstreamError : null;
  const substitutedUpstreamError = rawUpstreamError === null ? null : substituteKnownNames(rawUpstreamError, ordinalMap);
  return {
    upstreamStatus: input.upstreamStatus,
    upstreamSuccess: input.upstreamSuccess,
    upstreamError: truncateUpstreamError(substitutedUpstreamError),
    errorClass: rawUpstreamError === null ? null : 'unclassified',
    failureCategory: input.failureCategory ?? null,
    rawResponseValue: safeStringifyRawResponse(input.rawResponseValue, ordinalMap),
    allProcessCount: countAllProcessEntries(input.allProcess),
    allFaultyProcess: expurgeAllFaultyProcess(input.allFaultyProcess, ordinalMap),
    durationMs: input.durationMs,
    sentConfig: expurgeSentConfig(input.sentConfig),
  };
}

/**
 * Niveau du journal (§8.25 point 2.3) : `info` pour un succès, `warn` pour
 * un refus (Clariprint a répondu mais n'a rien à facturer), `error` pour une
 * indisponibilité ou une configuration absente.
 */
export function logLevelForOutcome(outcome: ClariprintQuoteOutcome): 'info' | 'warn' | 'error' {
  if (outcome === 'priced') return 'info';
  if (outcome === 'not_priced') return 'warn';
  return 'error';
}
