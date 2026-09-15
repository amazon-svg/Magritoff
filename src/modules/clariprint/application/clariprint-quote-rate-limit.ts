/**
 * BCP-0b — primitives PURES du limiteur de débit de
 * `POST /api/v1/clariprint/quote` (docs/api/CONVENTIONS.md §8.25 point
 * 2.3bis). Aucune de ces fonctions ne fait d'E/S : elles sont testables sans
 * base ni requête réseau, et c'est la ROUTE (`clariprint-routes.ts`) qui les
 * compose avec les dépendances injectées (session boutique, appartenance à
 * un espace, secret HMAC).
 *
 * Règle IP opposable (point (5), mesure du 2026-09-15) : `cf-connecting-ip`
 * est lu SEUL, en une seule entrée. Absent, vide ou à plusieurs entrées ->
 * quota partagé. JAMAIS `x-forwarded-for` (à aucune position), ni
 * `true-client-ip`, `x-client-ip`, `forwarded`, `x-real-ip`, ni `remoteAddr`.
 */

export type ClientIpResolution =
  | Readonly<{ ok: true; ip: string }>
  | Readonly<{ ok: false }>;

/**
 * Lit la valeur de `cf-connecting-ip` telle que rendue par `Headers.get()`.
 * `Headers.get()` fusionne des en-têtes dupliqués avec `, ` (Fetch standard) :
 * une valeur contenant une virgule ou un espace est donc le signe de
 * PLUSIEURS entrées, jamais une IP valide. Absente ou vide -> même repli.
 */
export function resolveClientIp(headerValue: string | null): ClientIpResolution {
  if (headerValue === null) return { ok: false };
  const trimmed = headerValue.trim();
  if (trimmed.length === 0) return { ok: false };
  if (/[,\s]/.test(trimmed)) return { ok: false };
  return { ok: true, ip: trimmed };
}

/**
 * Ramène une IPv6 à son préfixe /64 (un abonné en dispose couramment de
 * milliers d'adresses ; une clé par adresse ne limiterait rien). Une IPv4
 * est rendue inchangée. Adresse IPv6 non reconnaissable -> rendue telle
 * quelle (aucune tentative de normaliser au hasard une valeur invalide).
 */
export function normalizeIpForRateLimit(ip: string): string {
  return ip.includes(':') ? toIpv6Slash64(ip) : ip;
}

function toIpv6Slash64(ip: string): string {
  const withoutZone = ip.split('%')[0] ?? ip;
  const halves = withoutZone.split('::');
  if (halves.length > 2) return withoutZone;

  const head = halves[0] ? halves[0].split(':').filter((part) => part.length > 0) : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':').filter((part) => part.length > 0) : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return withoutZone;

  const expanded = [...head, ...Array.from({ length: missing }, () => '0'), ...tail];
  const prefixGroups = expanded.slice(0, 4).map((group) => group.padStart(4, '0'));
  while (prefixGroups.length < 4) prefixGroups.push('0000');
  return `${prefixGroups.join(':')}/64`;
}

/**
 * HMAC-SHA256 hexadécimal, même primitive que `signEventBody`
 * (`src/modules/_shared/application/outbox.ts`) mais sans le préfixe
 * `sha256=` : ici la valeur alimente une clé de compteur, pas un en-tête de
 * signature.
 */
export async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  if (secret.length === 0) throw new TypeError('Le secret HMAC ne peut pas être vide.');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
