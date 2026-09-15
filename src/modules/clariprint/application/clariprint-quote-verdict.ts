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
 */

/** Les quatre issues possibles d'un appel (docs/api/CONVENTIONS.md §8.25 point 2.2). */
export type ClariprintQuoteOutcome = 'priced' | 'not_priced' | 'unavailable' | 'not_configured';

export const UPSTREAM_ERROR_MAX_LENGTH = 500;
export const MAX_FAULTY_PROCESS_ENTRIES = 20;
export const FAULTY_PROCESS_DETAIL_MAX_LENGTH = 300;

export type ClariprintFaultyProcessEntry = Readonly<{
  /** Ordinal, JAMAIS le nom réel de l'imprimeur (`imprimeur_1`, `imprimeur_2`…). */
  printer: string;
  detail: string;
}>;

export type ClariprintQuoteVerdict = Readonly<{
  upstreamStatus: number | null;
  upstreamSuccess: boolean | null;
  upstreamError: string | null;
  rawResponseValue: string | null;
  allProcessCount: number;
  allFaultyProcess: readonly ClariprintFaultyProcessEntry[];
  durationMs: number;
  sentConfig: Readonly<Record<string, unknown>>;
}>;

export type ClariprintQuoteVerdictInput = Readonly<{
  upstreamStatus: number | null;
  upstreamSuccess: boolean | null;
  upstreamError?: unknown;
  rawResponseValue?: unknown;
  allProcess?: unknown;
  allFaultyProcess?: unknown;
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

function stringifyFaultyDetail(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Expurge `all_faulty_process` : les clés (noms d'imprimeurs du parc du
 * compte) sont remplacées par un ordinal (`imprimeur_1`, `imprimeur_2`…), au
 * plus 20 entrées, 300 caractères chacune (point 2.3, « Sortent »).
 */
export function expurgeAllFaultyProcess(value: unknown): readonly ClariprintFaultyProcessEntry[] {
  if (!value || typeof value !== 'object') return [];
  const entries = Array.isArray(value)
    ? value.map((entry, index) => [String(index), entry] as const)
    : Object.entries(value as Record<string, unknown>);
  return entries.slice(0, MAX_FAULTY_PROCESS_ENTRIES).map(([, detail], index) => ({
    printer: `imprimeur_${index + 1}`,
    detail: stringifyFaultyDetail(detail).slice(0, FAULTY_PROCESS_DETAIL_MAX_LENGTH),
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

/**
 * Expurge la charge effectivement envoyée : sans `reference` ni aucun
 * `address` (textes libres qui peuvent porter le nom ou l'adresse d'une
 * personne), à quelque profondeur qu'ils apparaissent (ex. dans
 * `deliveries.<clé>.address`).
 */
export function expurgeSentConfig(value: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return expurgeSentConfigDeep(value) as Record<string, unknown>;
}

function safeStringifyRawResponse(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Construit le verdict à partir des observations brutes de la passerelle. */
export function buildClariprintQuoteVerdict(input: ClariprintQuoteVerdictInput): ClariprintQuoteVerdict {
  return {
    upstreamStatus: input.upstreamStatus,
    upstreamSuccess: input.upstreamSuccess,
    upstreamError: truncateUpstreamError(input.upstreamError),
    rawResponseValue: safeStringifyRawResponse(input.rawResponseValue),
    allProcessCount: countAllProcessEntries(input.allProcess),
    allFaultyProcess: expurgeAllFaultyProcess(input.allFaultyProcess),
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
