/**
 * Idempotence des creations (story E10.0, CA8).
 *
 * Tout POST creant une ressource metier exige un en-tete `Idempotency-Key`.
 * Le reseau perd des reponses, pas des requetes : sans cette cle, un client
 * qui retente apres un timeout cree un deuxieme devis. Avec elle, il recoit la
 * reponse de la premiere tentative.
 *
 * Trois issues possibles pour une cle :
 *  - `fresh`     : premiere fois, l operation s execute et sa reponse est memorisee ;
 *  - `replayed`  : meme cle, meme corps -> on rejoue la reponse initiale ;
 *  - conflit     : meme cle, corps different -> 409 `api.idempotency_key_reused`.
 *    Rejouer une cle sur un corps different est un bug d appelant, pas un
 *    doublon : le lui dire vaut mieux que de lui rendre la mauvaise ressource.
 */
import type { TenantId } from '../../../kernel/ids/index.ts';
import { IDEMPOTENCY_KEY_HEADER, idempotencyKeySchema } from '../api/contracts.ts';
import { problem, SHARED_PROBLEM_CODES } from './problem.ts';

export type IdempotencyRecord = Readonly<{
  status: number;
  body: unknown;
  etag: string | null;
}>;

export type IdempotencyLookup =
  | Readonly<{ outcome: 'fresh' }>
  | Readonly<{ outcome: 'replayed'; record: IdempotencyRecord }>
  | Readonly<{ outcome: 'in_progress' }>
  | Readonly<{ outcome: 'conflict' }>;

export type IdempotencyRequest = Readonly<{
  tenantId: TenantId;
  key: string;
  /** Empreinte du couple (operation, corps) — voir `fingerprintRequest`. */
  fingerprint: string;
}>;

/**
 * Port de stockage des cles. L implementation durable (table
 * `api_idempotency_keys`) vit dans src/adapters/supabase/ ; le socle n en
 * connait que le contrat.
 */
export interface IdempotencyStore {
  /** Reserve la cle ou renvoie l issue deja enregistree. */
  begin(request: IdempotencyRequest): Promise<IdempotencyLookup>;
  /** Memorise la reponse produite pour cette cle. */
  complete(request: IdempotencyRequest, record: IdempotencyRecord): Promise<void>;
  /** Libere une cle dont l operation a echoue, pour qu un retry reste possible. */
  release(request: IdempotencyRequest): Promise<void>;
}

/** Lit et valide l en-tete `Idempotency-Key`. Absent sur une creation -> 400. */
export function readIdempotencyKey(request: Request, required: boolean): string | null {
  const raw = request.headers.get(IDEMPOTENCY_KEY_HEADER);

  if (raw === null || raw.trim().length === 0) {
    if (!required) return null;
    throw problem({
      status: 400,
      title: 'Cle d idempotence requise',
      code: SHARED_PROBLEM_CODES.idempotencyKeyRequired,
      detail: `Toute creation de ressource metier exige l en-tete ${IDEMPOTENCY_KEY_HEADER}.`,
    });
  }

  const parsed = idempotencyKeySchema.safeParse(raw.trim());
  if (!parsed.success) {
    throw problem({
      status: 400,
      title: 'Cle d idempotence invalide',
      code: SHARED_PROBLEM_CODES.idempotencyKeyInvalid,
      detail: '8 a 255 caracteres parmi [A-Za-z0-9_.:-].',
    });
  }
  return parsed.data;
}

/**
 * Empreinte stable du couple (methode, chemin, corps). Deux corps
 * semantiquement identiques mais serialises differemment donnent la meme
 * empreinte grace au tri des cles d objet.
 */
export async function fingerprintRequest(
  method: string,
  path: string,
  body: unknown,
): Promise<string> {
  const canonical = `${method.toUpperCase()} ${path}\n${stableStringify(body)}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return toHex(digest);
}

export function idempotencyKeyReused(key: string) {
  return problem({
    status: 409,
    title: 'Cle d idempotence deja utilisee',
    code: SHARED_PROBLEM_CODES.idempotencyKeyReused,
    detail: `La cle ${key} a deja servi pour une requete au contenu different.`,
  });
}

export function idempotencyInProgress(key: string) {
  return problem({
    status: 409,
    title: 'Requete idempotente en cours',
    code: SHARED_PROBLEM_CODES.idempotencyInProgress,
    detail: `Une requete portant la cle ${key} est en cours de traitement. Reessayer.`,
  });
}

/**
 * Implementation en memoire, destinee aux tests et au developpement local.
 * La persistance de production passe par l adaptateur Supabase.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<
    string,
    Readonly<{ fingerprint: string; record: IdempotencyRecord | null }>
  >();

  async begin(request: IdempotencyRequest): Promise<IdempotencyLookup> {
    const existing = this.entries.get(this.slot(request));
    if (existing === undefined) {
      this.entries.set(this.slot(request), { fingerprint: request.fingerprint, record: null });
      return { outcome: 'fresh' };
    }
    if (existing.fingerprint !== request.fingerprint) return { outcome: 'conflict' };
    if (existing.record === null) return { outcome: 'in_progress' };
    return { outcome: 'replayed', record: existing.record };
  }

  async complete(request: IdempotencyRequest, record: IdempotencyRecord): Promise<void> {
    this.entries.set(this.slot(request), { fingerprint: request.fingerprint, record });
  }

  async release(request: IdempotencyRequest): Promise<void> {
    this.entries.delete(this.slot(request));
  }

  private slot(request: IdempotencyRequest): string {
    return `${request.tenantId}::${request.key}`;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
