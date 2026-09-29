import { describe, expect, it } from 'vitest';
import { readOidcConfiguration } from '../../../src/server/node/oidc-configuration.ts';

describe('configuration OIDC du serveur Node', () => {
  it('laisse le module desactive quand aucune variable n est fournie', () => {
    expect(readOidcConfiguration({})).toBeNull();
  });

  it('refuse une configuration partielle au demarrage', () => {
    expect(() => readOidcConfiguration({
      MAGRIT_OIDC_ISSUER: 'https://identity.example',
    })).toThrow(/MAGRIT_OIDC_AUDIENCE.*MAGRIT_OIDC_JWKS_URL/);
  });

  it('construit une configuration complete et des algorithmes explicites', () => {
    expect(readOidcConfiguration({
      MAGRIT_OIDC_ISSUER: 'https://identity.example',
      MAGRIT_OIDC_AUDIENCE: 'magrit',
      MAGRIT_OIDC_JWKS_URL: 'https://identity.example/jwks',
      MAGRIT_OIDC_ALGORITHMS: 'RS256, PS256',
    })).toEqual({
      issuer: 'https://identity.example',
      audience: 'magrit',
      jwksUrl: 'https://identity.example/jwks',
      algorithms: ['RS256', 'PS256'],
    });
  });
});
