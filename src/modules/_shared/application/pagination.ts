/**
 * Pagination par curseur (story E10.0, CA7).
 *
 * Forme imposee : `?page[size]=50&page[cursor]=...`, curseur suivant dans
 * `meta.next_cursor`. Pas d offset : un offset derive des qu une ligne est
 * inseree entre deux pages, et il coute de plus en plus cher a mesure que la
 * table grossit.
 *
 * Le curseur est OPAQUE pour l appelant. Sa structure interne n est pas
 * contractuelle et peut changer sans casser v1 — c est justement pour ca qu il
 * est encode.
 */
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PAGE_CURSOR_PARAM,
  PAGE_SIZE_PARAM,
  type PageParamsDto,
} from '../api/contracts.ts';
import { problem, SHARED_PROBLEM_CODES } from './problem.ts';

export type PageParams = Readonly<{ size: number; cursor: string | null }>;

/**
 * Position de curseur. `sort` est la valeur de la colonne de tri (date, nom),
 * `id` departage les egalites — sans lui deux lignes de meme date se
 * chevauchent ou disparaissent entre deux pages.
 */
export type CursorPosition = Readonly<{ sort: string; id: string }>;

export function parsePageParams(url: URL): PageParams {
  const rawSize = url.searchParams.get(PAGE_SIZE_PARAM);
  const rawCursor = url.searchParams.get(PAGE_CURSOR_PARAM);

  let size = DEFAULT_PAGE_SIZE;
  if (rawSize !== null) {
    const parsed = Number(rawSize);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PAGE_SIZE) {
      throw problem({
        status: 422,
        title: 'Pagination invalide',
        code: SHARED_PROBLEM_CODES.invalidPageParams,
        detail: `${PAGE_SIZE_PARAM} doit etre un entier entre 1 et ${MAX_PAGE_SIZE}.`,
        errors: [{ field: PAGE_SIZE_PARAM, message: `Entier entre 1 et ${MAX_PAGE_SIZE} attendu.` }],
      });
    }
    size = parsed;
  }

  const cursor = rawCursor === null || rawCursor.length === 0 ? null : rawCursor;
  if (cursor !== null) decodeCursor(cursor);

  return Object.freeze({ size, cursor });
}

/** Vue schema des parametres, alignee sur `pageParamsSchema` du contrat. */
export function toPageParamsDto(params: PageParams): PageParamsDto {
  return { size: params.size, cursor: params.cursor };
}

export function encodeCursor(position: CursorPosition): string {
  const payload = JSON.stringify({ s: position.sort, i: position.id });
  return base64UrlEncode(payload);
}

export function decodeCursor(cursor: string): CursorPosition {
  let decoded: unknown;
  try {
    decoded = JSON.parse(base64UrlDecode(cursor)) as unknown;
  } catch {
    throw invalidCursor();
  }

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof (decoded as { s?: unknown }).s !== 'string' ||
    typeof (decoded as { i?: unknown }).i !== 'string'
  ) {
    throw invalidCursor();
  }

  const { s, i } = decoded as { s: string; i: string };
  return Object.freeze({ sort: s, id: i });
}

/**
 * Construit la page a renvoyer a partir de `size + 1` lignes lues : la ligne
 * excedentaire prouve qu il existe une page suivante sans compter la table.
 */
export function buildPage<T>(
  rows: readonly T[],
  params: PageParams,
  toPosition: (row: T) => CursorPosition,
): Readonly<{ items: readonly T[]; nextCursor: string | null }> {
  const hasMore = rows.length > params.size;
  const items = hasMore ? rows.slice(0, params.size) : [...rows];
  const last = items[items.length - 1];
  return Object.freeze({
    items,
    nextCursor: hasMore && last !== undefined ? encodeCursor(toPosition(last)) : null,
  });
}

function invalidCursor() {
  return problem({
    status: 422,
    title: 'Curseur invalide',
    code: SHARED_PROBLEM_CODES.invalidCursor,
    detail: `${PAGE_CURSOR_PARAM} doit reprendre tel quel un meta.next_cursor renvoye par l API.`,
    errors: [{ field: PAGE_CURSOR_PARAM, message: 'Curseur illisible.' }],
  });
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('curseur non base64url');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    '=',
  );
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
