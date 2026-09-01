/**
 * Concurrence optimiste par ETag / If-Match (story E10.0, CA9).
 *
 * Tout PATCH est protege : sans cela, deux commerciaux qui ouvrent la meme
 * fiche client ecrasent silencieusement les modifications l un de l autre, et
 * personne ne voit rien.
 *
 * Contrat :
 *  - toute reponse portant une ressource modifiable expose un `ETag` ;
 *  - `If-Match` absent sur un PATCH -> 428 `api.if_match_required` ;
 *  - `If-Match` different de l etat courant -> 409 `api.resource_conflict`,
 *    avec l ETAT COURANT dans `current_state` pour que l appelant rejoue sans
 *    relire.
 */
import { IF_MATCH_HEADER } from '../api/contracts.ts';
import { problem, resourceConflict, SHARED_PROBLEM_CODES } from './problem.ts';

/**
 * Calcule l empreinte d une representation. Le hachage porte sur la
 * serialisation canonique : deux representations egales au tri des cles pres
 * ont le meme ETag.
 */
export async function computeEntityTag(representation: unknown): Promise<string> {
  const canonical = stableStringify(representation);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return `"${toHex(digest).slice(0, 32)}"`;
}

/** Lit `If-Match`. `required` vaut vrai sur tout PATCH. */
export function readIfMatch(request: Request, required: boolean): string | null {
  const raw = request.headers.get(IF_MATCH_HEADER);

  if (raw === null || raw.trim().length === 0) {
    if (!required) return null;
    throw problem({
      status: 428,
      title: 'Precondition requise',
      code: SHARED_PROBLEM_CODES.ifMatchRequired,
      detail: `Toute modification partielle exige l en-tete ${IF_MATCH_HEADER}, repris de l ETag lu.`,
    });
  }

  const value = raw.trim();
  if (value === '*') return value;
  if (!/^(W\/)?"[^"]+"$/.test(value)) {
    throw problem({
      status: 400,
      title: 'Precondition malformee',
      code: SHARED_PROBLEM_CODES.ifMatchInvalid,
      detail: `${IF_MATCH_HEADER} doit reprendre tel quel un ETag renvoye par l API.`,
    });
  }
  return value;
}

/**
 * Verifie la precondition. En cas d ecart, leve un 409 portant l etat courant.
 * `currentState` est la representation renvoyee a l appelant, pas la ligne
 * brute de la base : elle doit rester conforme au contrat de la ressource.
 */
export function assertPrecondition(
  ifMatch: string | null,
  currentEntityTag: string,
  currentState: Readonly<Record<string, unknown>>,
): void {
  if (ifMatch === null || ifMatch === '*') return;
  if (normalize(ifMatch) === normalize(currentEntityTag)) return;
  throw resourceConflict(currentState);
}

function normalize(entityTag: string): string {
  return entityTag.replace(/^W\//, '').trim();
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
