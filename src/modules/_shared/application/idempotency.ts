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
 * Empreinte stable du couple (methode, cible, corps). La CIBLE comprend le
 * chemin ET la query : deux POST au meme chemin avec des query differentes ne
 * sont pas la meme requete, et les traiter comme telles ferait rejouer la
 * mauvaise reponse.
 *
 * Canonicalisation : les cles d objet et les parametres de query sont tries,
 * de sorte que deux requetes semantiquement identiques mais serialisees
 * differemment donnent la meme empreinte.
 */
export async function fingerprintRequest(
  method: string,
  target: string | URL,
  body: unknown,
): Promise<string> {
  const canonical = `${method.toUpperCase()} ${canonicalTarget(target)}\n${stableStringify(body)}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return toHex(digest);
}

function canonicalTarget(target: string | URL): string {
  if (typeof target === 'string') return target;
  const parameters = [...target.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey === rightKey
      ? leftValue < rightValue
        ? -1
        : leftValue > rightValue
          ? 1
          : 0
      : leftKey < rightKey
        ? -1
        : 1,
  );
  const query = parameters
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return query.length === 0 ? target.pathname : `${target.pathname}?${query}`;
}

/**
 * E10.10b-2 — derive la cle STOCKEE pour un `ShopCustomerPrincipal`
 * (docs/api/CONVENTIONS.md §8.13quinquies, "trois points que dev-story ne
 * doit pas decouvrir en route", point 1).
 *
 * Defaut de socle trouve par b-2 : `api_idempotency_keys` est unique sur
 * `(tenant_id, idempotency_key)`, et jusqu a b-1 tous les porteurs de cle
 * etaient des MEMBRES du meme espace — donc du meme cote de la confiance.
 * Une session boutique introduit un SECOND acheteur potentiel dans le meme
 * tenant : si deux clients differents du meme imprimeur choisissaient par
 * hasard la MEME valeur de `Idempotency-Key` sur deux devis differents, le
 * second aurait recu 409 `api.idempotency_key_reused` — un client empechant
 * un AUTRE de repondre a son devis, alors que rien de leur cote ne les a mis
 * en conflit.
 *
 * Correction : pour ce mode, la cle REELLEMENT stockee derive du COMPTE,
 * jamais de l espace seul — `sca.<accountId>.<sha256(cle) hex>` (105
 * caracteres pour un `accountId` UUID, sous la borne 255 du `check` existant,
 * dans le meme jeu `[A-Za-z0-9_.:-]`). Deux invariants tenus par construction :
 * la cle PRESENTEE par l appelant (celle qui apparait dans `detail` d un 409)
 * n est jamais modifiee — seule la valeur stockee derive — et aucun autre
 * mode d authentification n est affecte (fonction jamais appelee pour eux).
 */
export async function deriveShopCustomerIdempotencyStorageKey(
  accountId: string,
  presentedKey: string,
): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(presentedKey));
  return `sca.${accountId}.${toHex(digest)}`;
}

/**
 * E10.20a — derive la cle STOCKEE pour un `UploadLinkPrincipal`
 * (docs/api/CONVENTIONS.md §8.21 §5, assignee EXPLICITEMENT a cette
 * sous-story : "ApiPrincipal elargi, derivation d idempotence pour ce
 * principal, les trois operations d atelier").
 *
 * MEME DEFAUT DE SOCLE QUE `deriveShopCustomerIdempotencyStorageKey`
 * (E10.10b-2), transporte tel quel plutot que reintroduit sans y penser :
 * `api_idempotency_keys` est unique sur `(tenant_id, idempotency_key)`, et
 * DEUX LIENS DISTINCTS emis pour DEUX COMMANDES DIFFERENTES du MEME tenant
 * partagent ce meme tenant — si deux porteurs de liens distincts
 * choisissaient par hasard la MEME valeur d `Idempotency-Key` (ex. "1", un
 * choix naif frequent), le second recevrait 409
 * `api.idempotency_key_reused`, ou pire, un REJEU qui lui rendrait le recu
 * de depot de l autre. Aucune route de ce lot n a `createsResource: true`
 * sous ce principal (`getOrderUploadLinkContext` est un GET) : cette
 * fonction n a donc PAS ENCORE d appelant reel, mais le contrat assigne
 * explicitement sa livraison a CETTE sous-story, pas a E10.20b (qui
 * enregistrera `confirmOrderUploadLinkFile`, la premiere route a en avoir
 * besoin) — brancher cette fonction sera alors un CABLAGE, pas une
 * conception nouvelle.
 *
 * Cle derivee du LIEN (`linkId`), jamais de la commande ni du tenant seuls :
 * deux liens DIFFERENTS emis pour la MEME commande restent deux porteurs
 * potentiellement distincts, et ne doivent donc pas partager d espace de
 * cles non plus. `ulk.<linkId>.<sha256(cle) hex>` (109 caracteres pour un
 * `linkId` UUID, sous la borne 255 du `check` existant, meme jeu
 * `[A-Za-z0-9_.:-]` que `sca.*`). Memes deux invariants tenus par
 * construction que la fonction jumelle : la cle PRESENTEE par l appelant
 * n est jamais modifiee, et aucun autre mode n est affecte.
 */
export async function deriveUploadLinkIdempotencyStorageKey(
  linkId: string,
  presentedKey: string,
): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(presentedKey));
  return `ulk.${linkId}.${toHex(digest)}`;
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
