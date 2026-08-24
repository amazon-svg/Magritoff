import { describe, expect, it } from 'vitest';
import {
  clearStorefrontSessionCookie,
  LOCAL_STOREFRONT_SESSION_COOKIE,
  SECURE_STOREFRONT_SESSION_COOKIE,
  serializeStorefrontSessionCookie,
  storefrontSessionCookiePolicy,
} from '../../../src/server/storefront/session-cookie';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-opaque';

describe('cookie de session storefront', () => {
  it('utilise un cookie __Host HttpOnly et Secure en production', () => {
    const header = serializeStorefrontSessionCookie(
      TOKEN,
      3_600,
      storefrontSessionCookiePolicy(true),
    );
    expect(header).toContain(`${SECURE_STOREFRONT_SESSION_COOKIE}=${TOKEN}`);
    expect(header).toContain('Path=/');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Secure');
    expect(header).not.toContain('Domain=');
  });

  it('autorise explicitement le runtime Docker local en HTTP', () => {
    const header = serializeStorefrontSessionCookie(
      TOKEN,
      3_600,
      storefrontSessionCookiePolicy(false),
    );
    expect(header).toContain(`${LOCAL_STOREFRONT_SESSION_COOKIE}=${TOKEN}`);
    expect(header).not.toContain('Secure');
    expect(header).toContain('HttpOnly');
  });

  it('efface le cookie avec la même politique et refuse les jetons faibles', () => {
    expect(clearStorefrontSessionCookie(storefrontSessionCookiePolicy(true)))
      .toContain('Max-Age=0');
    expect(() => serializeStorefrontSessionCookie('secret lisible', 60, storefrontSessionCookiePolicy(true)))
      .toThrow();
  });
});
