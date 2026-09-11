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

  it('getCommercialSettings — expose les trois reglages de notification (E10.15a), defauts du contrat', async () => {
    const response = await call('/api/v1/commercial-settings', { headers: asUser });
    const { data } = (await response.json()) as { data: CommercialSettingsDto };
    expect(data.notification_retention_days).toBe(90);
    expect(data.notification_sms_enabled).toBe(false);
    expect(data.notification_sms_daily_cap).toBe(200);
  });

  it('updateCommercialSettings — E10.15a : garde AU CHAMP can_manage_notifications, DISTINCTE de can_manage_pricing (403 identity.capability_required)', async () => {
    const initial = await call('/api/v1/commercial-settings', { headers: asUser });
    const etag = initial.headers.get('etag')!;

    // Porte can_manage_pricing (droit MINIMAL de l operation) mais PAS
    // can_manage_notifications : un champ de PRIX reussit, un champ de
    // NOTIFICATION est refuse par un code DISTINCT de celui d E10.11.
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_pricing', true);
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_notifications', false);

    const deniedOnNotificationField = await call('/api/v1/commercial-settings', {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ notification_retention_days: 30 }),
    });
    expect(deniedOnNotificationField.status).toBe(403);
    expect(((await deniedOnNotificationField.json()) as { code: string }).code).toBe(
      'identity.capability_required',
    );

    // Le MEME acteur reussit sur un champ de PRIX (can_manage_pricing seul suffit).
    const allowedOnPricingField = await call('/api/v1/commercial-settings', {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ default_validity_days: 60 }),
    });
    await expectContract(allowedOnPricingField, { status: 200, dataSchema: 'CommercialSettings' });
    const { data: afterPricingWrite } = (await allowedOnPricingField.json()) as { data: CommercialSettingsDto };
    expect(afterPricingWrite.default_validity_days).toBe(60);
    // Aucun effet de bord sur les reglages de notification (refuses).
    expect(afterPricingWrite.notification_retention_days).toBe(90);

    // Un acteur qui porte can_manage_notifications reussit sur les trois champs.
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_notifications', true);
    const secondEtag = allowedOnPricingField.headers.get('etag')!;
    const allowedOnNotificationFields = await call('/api/v1/commercial-settings', {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': secondEtag },
      body: JSON.stringify({
        notification_retention_days: 30,
        notification_sms_enabled: true,
        notification_sms_daily_cap: 50,
      }),
    });
    await expectContract(allowedOnNotificationFields, { status: 200, dataSchema: 'CommercialSettings' });
    const { data: afterNotificationWrite } = (await allowedOnNotificationFields.json()) as {
      data: CommercialSettingsDto;
    };
    expect(afterNotificationWrite.notification_retention_days).toBe(30);
    expect(afterNotificationWrite.notification_sms_enabled).toBe(true);
    expect(afterNotificationWrite.notification_sms_daily_cap).toBe(50);
  });

  it('updateCommercialSettings — E10.15a : la garde AU CHAMP sort AVANT le 409 de conflit de version (meme ordre que can_manage_pricing)', async () => {
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_pricing', true);
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_notifications', false);

    const response = await call('/api/v1/commercial-settings', {
      method: 'PATCH',
      // If-Match volontairement PERIME : sans la garde AU CHAMP en premier,
      // ce serait un 409 qui sortirait avant le 403 attendu.
      headers: { ...jsonHeaders, 'If-Match': '"perime"' },
      body: JSON.stringify({ notification_sms_enabled: true }),
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe('identity.capability_required');
  });
});
