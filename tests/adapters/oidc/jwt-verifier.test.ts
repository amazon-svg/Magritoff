import { generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { OidcJwtVerifier } from '../../../src/adapters/oidc/jwt-verifier.ts';

const issuer = 'https://identity.client.example';
const audience = 'magrit-client-shop';
let privateKey: CryptoKey;
let keyResolver: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  keyResolver = async () => pair.publicKey;
});

describe('OidcJwtVerifier', () => {
  it('valide signature, issuer, audience, expiration et subject', async () => {
    const verifier = createVerifier();
    const token = await signedToken({ subject: 'client-user-42' });

    await expect(verifier.verify(token)).resolves.toEqual({
      issuer,
      subject: 'client-user-42',
    });
  });

  it('refuse issuer, audience, expiration ou signature incorrects', async () => {
    const verifier = createVerifier();
    const otherPair = await generateKeyPair('RS256');
    const cases = [
      signedToken({ subject: 'user', tokenIssuer: 'https://attacker.example' }),
      signedToken({ subject: 'user', tokenAudience: 'another-api' }),
      signedToken({ subject: 'user', expiration: '0s' }),
      new SignJWT({}).setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(issuer).setAudience(audience).setSubject('user').setExpirationTime('5m').sign(otherPair.privateKey),
    ];

    for (const token of await Promise.all(cases)) {
      await expect(verifier.verify(token)).resolves.toBeNull();
    }
  });

  it('refuse les configurations permettant une cle symetrique ou une URL JWKS non sure', () => {
    expect(() => new OidcJwtVerifier({
      issuer,
      audience,
      jwksUrl: 'https://identity.client.example/jwks',
      algorithms: ['HS256'],
    }, keyResolver)).toThrow(/asymetriques/);

    expect(() => new OidcJwtVerifier({
      issuer,
      audience,
      jwksUrl: 'http://identity.client.example/jwks',
      algorithms: ['RS256'],
    }, keyResolver)).toThrow(/HTTPS/);
  });

  it('autorise HTTP uniquement pour un fournisseur local de developpement', () => {
    expect(() => new OidcJwtVerifier({
      issuer: 'http://127.0.0.1:5556',
      audience,
      jwksUrl: 'http://127.0.0.1:5556/keys',
      algorithms: ['RS256'],
    }, keyResolver)).not.toThrow();
  });
});

function createVerifier(): OidcJwtVerifier {
  return new OidcJwtVerifier({
    issuer,
    audience,
    jwksUrl: `${issuer}/.well-known/jwks.json`,
    algorithms: ['RS256'],
  }, keyResolver);
}

async function signedToken(options: Readonly<{
  subject: string;
  tokenIssuer?: string;
  tokenAudience?: string;
  expiration?: string;
}>): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(options.tokenIssuer ?? issuer)
    .setAudience(options.tokenAudience ?? audience)
    .setSubject(options.subject)
    .setIssuedAt()
    .setExpirationTime(options.expiration ?? '5m')
    .sign(privateKey);
}
