import type { OidcJwtVerifierConfiguration } from '../../adapters/oidc/jwt-verifier.ts';

const REQUIRED_KEYS = [
  'MAGRIT_OIDC_ISSUER',
  'MAGRIT_OIDC_AUDIENCE',
  'MAGRIT_OIDC_JWKS_URL',
] as const;

export function readOidcConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): OidcJwtVerifierConfiguration | null {
  const configured = REQUIRED_KEYS.filter((key) => nonEmpty(environment[key]) !== null);
  if (configured.length === 0) return null;
  if (configured.length !== REQUIRED_KEYS.length) {
    const missing = REQUIRED_KEYS.filter((key) => nonEmpty(environment[key]) === null);
    throw new Error(`Configuration OIDC incomplete : ${missing.join(', ')}`);
  }

  const algorithms = (nonEmpty(environment['MAGRIT_OIDC_ALGORITHMS']) ?? 'RS256')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return Object.freeze({
    issuer: nonEmpty(environment['MAGRIT_OIDC_ISSUER'])!,
    audience: nonEmpty(environment['MAGRIT_OIDC_AUDIENCE'])!,
    jwksUrl: nonEmpty(environment['MAGRIT_OIDC_JWKS_URL'])!,
    algorithms,
  });
}

function nonEmpty(value: string | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}
