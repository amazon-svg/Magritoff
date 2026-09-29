import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';

export type OidcJwtVerifierConfiguration = Readonly<{
  issuer: string;
  audience: string;
  jwksUrl: string;
  algorithms: readonly string[];
}>;

export type VerifiedOidcIdentity = Readonly<{
  issuer: string;
  subject: string;
}>;

/**
 * Verification cryptographique d'un access token OpenID/OAuth standard.
 * L'URL JWKS vient exclusivement de la configuration approuvee : les en-tetes
 * `jku`/`jwk` du jeton ne sont jamais utilises comme source de confiance.
 */
export class OidcJwtVerifier {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly algorithms: string[];
  private readonly keyResolver: JWTVerifyGetKey;

  constructor(
    configuration: OidcJwtVerifierConfiguration,
    keyResolver?: JWTVerifyGetKey,
  ) {
    this.issuer = normalizedIssuer(configuration.issuer);
    this.audience = requiredValue(configuration.audience, 'audience');
    this.algorithms = validatedAlgorithms(configuration.algorithms);
    const jwksUrl = trustedJwksUrl(configuration.jwksUrl);
    this.keyResolver = keyResolver ?? createRemoteJWKSet(jwksUrl, {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 600_000,
    });
  }

  async verify(token: string): Promise<VerifiedOidcIdentity | null> {
    if (token.trim().length === 0) return null;
    try {
      const { payload } = await jwtVerify(token, this.keyResolver, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: this.algorithms,
        typ: 'JWT',
      });
      if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) return null;
      return Object.freeze({ issuer: this.issuer, subject: payload.sub });
    } catch (error) {
      if (error instanceof errors.JOSEError) return null;
      throw error;
    }
  }
}

function normalizedIssuer(value: string): string {
  const issuer = new URL(requiredValue(value, 'issuer'));
  if (issuer.protocol !== 'https:' && !isLocalHttp(issuer)) {
    throw new Error('OIDC issuer doit utiliser HTTPS hors environnement local.');
  }
  issuer.hash = '';
  issuer.search = '';
  return issuer.href.replace(/\/$/, '');
}

function trustedJwksUrl(value: string): URL {
  const url = new URL(requiredValue(value, 'jwksUrl'));
  if (url.protocol !== 'https:' && !isLocalHttp(url)) {
    throw new Error('OIDC jwksUrl doit utiliser HTTPS hors environnement local.');
  }
  if (url.username || url.password || url.hash) {
    throw new Error('OIDC jwksUrl ne doit contenir ni identifiants ni fragment.');
  }
  return url;
}

function validatedAlgorithms(values: readonly string[]): string[] {
  if (values.length === 0) throw new Error('Au moins un algorithme OIDC est requis.');
  const algorithms = [...new Set(values)];
  if (algorithms.some((algorithm) => !/^(?:RS|PS|ES|EdDSA)/.test(algorithm))) {
    throw new Error('Seuls les algorithmes de signature asymetriques sont autorises.');
  }
  return algorithms;
}

function isLocalHttp(url: URL): boolean {
  return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
}

function requiredValue(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`OIDC ${name} est requis.`);
  return normalized;
}
