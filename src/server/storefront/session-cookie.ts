export const SECURE_STOREFRONT_SESSION_COOKIE = '__Host-magrit-storefront';
export const LOCAL_STOREFRONT_SESSION_COOKIE = 'magrit-storefront';

export type StorefrontSessionCookiePolicy = Readonly<{
  name: string;
  secure: boolean;
  sameSite: 'Lax';
  httpOnly: true;
  path: '/';
}>;

export function storefrontSessionCookiePolicy(secure: boolean): StorefrontSessionCookiePolicy {
  return Object.freeze({
    name: secure ? SECURE_STOREFRONT_SESSION_COOKIE : LOCAL_STOREFRONT_SESSION_COOKIE,
    secure,
    sameSite: 'Lax',
    httpOnly: true,
    path: '/',
  });
}

export function serializeStorefrontSessionCookie(
  opaqueToken: string,
  maxAgeSeconds: number,
  policy: StorefrontSessionCookiePolicy,
): string {
  assertOpaqueToken(opaqueToken);
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 1 || maxAgeSeconds > 86_400) {
    throw new TypeError('La durée du cookie storefront doit être comprise entre 1 s et 24 h.');
  }

  return serialize(policy, opaqueToken, maxAgeSeconds);
}

export function clearStorefrontSessionCookie(policy: StorefrontSessionCookiePolicy): string {
  return serialize(policy, '', 0);
}

export function readStorefrontSessionCookie(
  cookieHeader: string | null,
  policy: StorefrontSessionCookiePolicy,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== policy.name) continue;
    const value = part.slice(separator + 1).trim();
    return /^[A-Za-z0-9_-]{32,512}$/.test(value) ? value : null;
  }
  return null;
}

function serialize(
  policy: StorefrontSessionCookiePolicy,
  value: string,
  maxAgeSeconds: number,
): string {
  const parts = [
    `${policy.name}=${value}`,
    `Path=${policy.path}`,
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    `SameSite=${policy.sameSite}`,
  ];
  if (policy.secure) parts.push('Secure');
  return parts.join('; ');
}

function assertOpaqueToken(token: string): void {
  if (!/^[A-Za-z0-9_-]{32,512}$/.test(token)) {
    throw new TypeError('Le jeton de session storefront doit être opaque et encodé en base64url.');
  }
}
