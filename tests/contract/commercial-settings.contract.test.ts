/**
 * Module Reglages commerciaux (E10.10a) contre le contrat.
 *
 * Ressource SINGLETON `/commercial-settings` : `GET` ouvert a tout membre,
 * `PATCH` garde par `can_manage_pricing` (E10.11, verifie par le SERVICE,
 * §8.12). Exerce reellement `createCommercialSettingsRoutes()` via
 * `createGescomApiHandler`, avec un `CommercialSettingsRepository` en
 * memoire.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import { InMemoryIdempotencyStore, type ApiPrincipal, type PrincipalVerifier } from '@/modules/_shared/application';
import { CommercialSettingsService } from '@/modules/commercial-settings/application/commercial-settings-service';
import type { CommercialSettingsDto } from '@/modules/commercial-settings/api/contracts';
import { createCommercialSettingsRoutes } from '@/server/api/commercial-settings-routes';
import { createGescomApiHandler } from '@/server/api';
import { checkResponseAgainstContract } from './_harness.ts';
import { InMemoryCommercialSettingsRepository } from './_fakes/commercial-settings-repository.fake.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9033');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e7f');

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

const userPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: USER, tenantId: TENANT });

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer' && credential.token === 'jeton-valide') return userPrincipal;
    return null;
  },
};

const asUser = { Authorization: 'Bearer jeton-valide' };
const jsonHeaders = { ...asUser, 'Content-Type': 'application/json' };

let repository: InMemoryCommercialSettingsRepository;
let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  repository = new InMemoryCommercialSettingsRepository();
  const service = new CommercialSettingsService({ repository });
  handler = createGescomApiHandler({
    routes: [...createCommercialSettingsRoutes(service)],
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-10a-settings',
  });
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

async function expectContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<void> {
  const check = await checkResponseAgainstContract(response, expectation);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
}

describe('module Reglages commerciaux (E10.10a) contre le contrat', () => {
  it('getCommercialSettings — cree implicitement la ressource, default_validity_days null par defaut', async () => {
    const response = await call('/api/v1/commercial-settings', { headers: asUser });
    await expectContract(response, { status: 200, dataSchema: 'CommercialSettings' });
    expect(response.headers.get('etag')).toBeTruthy();
    const { data } = (await response.json()) as { data: CommercialSettingsDto };
    expect(data.tenant_id).toBe(TENANT);
    expect(data.default_validity_days).toBeNull();
  });

  it('updateCommercialSettings — protege par ETag/If-Match (CA9), garde can_manage_pricing (403 identity.role_required)', async () => {
    const initial = await call('/api/v1/commercial-settings', { headers: asUser });
    const etag = initial.headers.get('etag')!;

    const withoutIfMatch = await call('/api/v1/commercial-settings', {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ default_validity_days: 30 }),
    });
    await expectContract(withoutIfMatch, { status: 428 });

    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_pricing', false);
    const denied = await call('/api/v1/commercial-settings', {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ default_validity_days: 30 }),
    });
    await expectContract(denied, { status: 403 });
    expect(((await denied.json()) as { code: string }).code).toBe('identity.role_required');
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_pricing', true);

    const patched = await call('/api/v1/commercial-settings', {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ default_validity_days: 30 }),
    });
    await expectContract(patched, { status: 200, dataSchema: 'CommercialSettings' });
    const { data } = (await patched.json()) as { data: CommercialSettingsDto };
    expect(data.default_validity_days).toBe(30);

    // If-Match perime (deja consomme par le PATCH precedent) -> 409.
    const stale = await call('/api/v1/commercial-settings', {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ default_validity_days: null }),
    });
    await expectContract(stale, { status: 409 });
    expect(((await stale.json()) as { code: string }).code).toBe('api.resource_conflict');
  });

  it('updateCommercialSettings — default_validity_days: null retire la validite par defaut', async () => {
    const initial = await call('/api/v1/commercial-settings', { headers: asUser });
    const etag = initial.headers.get('etag')!;
    const patched = await call('/api/v1/commercial-settings', {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ default_validity_days: 45 }),
    });
    const secondEtag = patched.headers.get('etag')!;

    const cleared = await call('/api/v1/commercial-settings', {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': secondEtag },
      body: JSON.stringify({ default_validity_days: null }),
    });
    await expectContract(cleared, { status: 200, dataSchema: 'CommercialSettings' });
    const { data } = (await cleared.json()) as { data: CommercialSettingsDto };
    expect(data.default_validity_days).toBeNull();
  });
});
