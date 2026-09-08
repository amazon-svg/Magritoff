/**
 * Module Etapes de production contre le contrat (story E10.13).
 *
 * Exerce reellement `createProductionStepsRoutes()` via
 * `createGescomApiHandler`, avec un `ProductionStepsRepository` en memoire
 * (`InMemoryProductionStepsRepository`, aucune dependance a Supabase). Chaque
 * reponse est confrontee au contrat via `checkResponseAgainstContract`.
 *
 * Le cablage de la conversion (`api_convert_commercial_quote` pose l etape
 * initiale, arbitrage (a) du contrat) et les regles tenues EN BASE (unicite
 * du libelle, plafond, reindexation, `on delete restrict`) sont verifies
 * reellement par `tests/sql/gescom-e10-13-production-steps.sql` — ce fichier
 * valide la FORME HTTP/JSON (enveloppe, ETag, codes d erreur, gardes) contre
 * le contrat, pas l implementation SQL sous-jacente.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import {
  InMemoryIdempotencyStore,
  type ApiPrincipal,
  type PrincipalVerifier,
} from '@/modules/_shared/application';
import { ProductionStepsService } from '@/modules/production-steps/application/production-steps-service';
import type { ProductionStepDto } from '@/modules/production-steps/api/contracts';
import { createProductionStepsRoutes } from '@/server/api/production-steps-routes';
import { createGescomApiHandler } from '@/server/api';
import { InMemoryProductionStepsRepository, fakeStepUuid } from './_fakes/production-steps-repository.fake.ts';
import { checkResponseAgainstContract } from './_harness.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f');

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

const userPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: USER, tenantId: TENANT });
const studioPrincipal: ApiPrincipal = Object.freeze({
  kind: 'service',
  serviceId: 'studio',
  tenantId: TENANT,
  scopes: Object.freeze(['orders:read']),
});
const studioNoScopePrincipal: ApiPrincipal = Object.freeze({
  kind: 'service',
  serviceId: 'studio',
  tenantId: TENANT,
  scopes: Object.freeze([]),
});

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer') {
      return credential.token === 'jeton-valide' ? userPrincipal : null;
    }
    if (credential.key === 'cle-studio') return studioPrincipal;
    if (credential.key === 'cle-studio-sans-scope') return studioNoScopePrincipal;
    return null;
  },
};

let sequence = 0;
/** `[A-Za-z0-9_.:-]{8,255}` (contrat `IdempotencyKey`) : le prefixe seul est trop court. */
function idempotencyKey(): string {
  sequence += 1;
  return `idem-create-${sequence}`;
}

let repository: InMemoryProductionStepsRepository;
let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  repository = new InMemoryProductionStepsRepository();
  const service = new ProductionStepsService({ repository });
  handler = createGescomApiHandler({
    routes: createProductionStepsRoutes(service),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-13',
  });
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asUser = { Authorization: 'Bearer jeton-valide' };
const jsonHeaders = { ...asUser, 'Content-Type': 'application/json' };
const asStudio = { 'X-Magrit-Service-Key': 'cle-studio' };
const asStudioNoScope = { 'X-Magrit-Service-Key': 'cle-studio-sans-scope' };

async function expectContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<void> {
  const check = await checkResponseAgainstContract(response, expectation);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
}

function seedStep(overrides: Partial<ProductionStepDto> = {}): ProductionStepDto {
  const now = new Date().toISOString();
  const step: ProductionStepDto = {
    id: fakeStepUuid(),
    tenant_id: TENANT,
    label: 'Fichier reçu',
    position: 0,
    color: 'slate',
    is_terminal: false,
    is_active: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
  repository.seedForTest(step);
  return step;
}

describe('module Etapes de production (E10.13) contre le contrat', () => {
  it('CA1/CA2 — GET /production-steps : catalogue ordonne par position, ETag de collection present, scope orders:read', async () => {
    const noScope = await call('/api/v1/production-steps', { headers: asStudioNoScope });
    expect(noScope.status).toBe(403);

    seedStep({ label: 'PAO', position: 1 });
    seedStep({ label: 'Fichier reçu', position: 0 });

    const response = await call('/api/v1/production-steps', { headers: asStudio });
    await expectContract(response, { status: 200 });
    expect(response.headers.get('etag')).toBeTruthy();
    const { data } = (await response.json()) as { data: ProductionStepDto[] };
    expect(data.map((s) => s.label)).toEqual(['Fichier reçu', 'PAO']);
  });

  it('CA1/CA7 — filtre status=active|disabled porte sur la reponse, mais l ETag reste celui du catalogue COMPLET', async () => {
    seedStep({ label: 'Active', position: 0, is_active: true });
    seedStep({ label: 'Desactivee', position: 1, is_active: false });

    const full = await call('/api/v1/production-steps', { headers: asStudio });
    const fullEtag = full.headers.get('etag');

    const filtered = await call('/api/v1/production-steps?status=active', { headers: asStudio });
    const { data } = (await filtered.json()) as { data: ProductionStepDto[] };
    expect(data).toHaveLength(1);
    expect(data[0]!.label).toBe('Active');
    // Meme ETag que la lecture non filtree : il valide le catalogue COMPLET,
    // jamais la projection (decision #7 du contrat).
    expect(filtered.headers.get('etag')).toBe(fullEtag);
  });

  it('CA2 — POST /production-steps cree en fin de flux, capability requise', async () => {
    seedStep({ label: 'Fichier reçu', position: 0 });

    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_production_steps', false);
    const forbidden = await call('/api/v1/production-steps', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ label: 'PAO' }),
    });
    expect(forbidden.status).toBe(403);

    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_production_steps', true);
    const response = await call('/api/v1/production-steps', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ label: 'PAO', is_terminal: false }),
    });
    await expectContract(response, { status: 201, dataSchema: 'ProductionStep' });
    const { data } = (await response.json()) as { data: ProductionStepDto };
    expect(data.position).toBe(1);
    expect(data.color).toBeTruthy();
  });

  it('CA2 — libelle deja pris (normalise), meme sur une etape DESACTIVEE : 409 production_step.label_conflict', async () => {
    seedStep({ label: 'PAO', position: 0, is_active: false });

    const response = await call('/api/v1/production-steps', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ label: '  pao  ' }),
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('production_step.label_conflict');
  });

  it('getProductionStep : fiche + ETag ; 404 si introuvable dans ce tenant', async () => {
    const step = seedStep();

    const response = await call(`/api/v1/production-steps/${step.id}`, { headers: asStudio });
    await expectContract(response, { status: 200, dataSchema: 'ProductionStep' });
    expect(response.headers.get('etag')).toBeTruthy();

    const missing = await call(`/api/v1/production-steps/${fakeStepUuid()}`, { headers: asStudio });
    expect(missing.status).toBe(404);
  });

  it('updateProductionStep : If-Match exige (428 si absent, 409 si perime), renommage/desactivation appliques', async () => {
    const step = seedStep();

    const withoutIfMatch = await call(`/api/v1/production-steps/${step.id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ is_active: false }),
    });
    expect(withoutIfMatch.status).toBe(428);

    const staleIfMatch = await call(`/api/v1/production-steps/${step.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': '"perime"' },
      body: JSON.stringify({ is_active: false }),
    });
    expect(staleIfMatch.status).toBe(409);

    const fresh = await call(`/api/v1/production-steps/${step.id}`, { headers: asStudio });
    const etag = fresh.headers.get('etag')!;

    const updated = await call(`/api/v1/production-steps/${step.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ label: 'Fichier reçu (renomme)', is_active: false }),
    });
    await expectContract(updated, { status: 200, dataSchema: 'ProductionStep' });
    const { data } = (await updated.json()) as { data: ProductionStepDto };
    expect(data.label).toBe('Fichier reçu (renomme)');
    expect(data.is_active).toBe(false);
  });

  it('deleteProductionStep : reussit si inutilisee (200 deleted:true) ; 409 production_step.in_use sinon ; 404 hors tenant', async () => {
    const free = seedStep({ label: 'Libre', position: 0 });
    const used = seedStep({ label: 'Utilisee', position: 1 });
    repository.setInUseForTest(used.id, true);

    const inUse = await call(`/api/v1/production-steps/${used.id}`, { method: 'DELETE', headers: asUser });
    expect(inUse.status).toBe(409);
    const inUseBody = (await inUse.json()) as { code: string };
    expect(inUseBody.code).toBe('production_step.in_use');

    const missing = await call(`/api/v1/production-steps/${fakeStepUuid()}`, { method: 'DELETE', headers: asUser });
    expect(missing.status).toBe(404);

    const deleted = await call(`/api/v1/production-steps/${free.id}`, { method: 'DELETE', headers: asUser });
    await expectContract(deleted, { status: 200 });
    const { data } = (await deleted.json()) as { data: { deleted: true } };
    expect(data.deleted).toBe(true);
  });

  it('reorderProductionSteps : If-Match sur LE CATALOGUE, reindexation 0..n-1, 422 sur ensemble incomplet', async () => {
    const a = seedStep({ label: 'A', position: 0 });
    const b = seedStep({ label: 'B', position: 1 });
    const c = seedStep({ label: 'C', position: 2 });

    const list = await call('/api/v1/production-steps', { headers: asStudio });
    const catalogEtag = list.headers.get('etag')!;

    const mismatch = await call('/api/v1/production-step-positions', {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': catalogEtag },
      body: JSON.stringify({ step_ids: [a.id, b.id] }),
    });
    expect(mismatch.status).toBe(422);
    const mismatchBody = (await mismatch.json()) as { code: string };
    expect(mismatchBody.code).toBe('production_step.positions_mismatch');

    const staleIfMatch = await call('/api/v1/production-step-positions', {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': '"perime"' },
      body: JSON.stringify({ step_ids: [c.id, b.id, a.id] }),
    });
    expect(staleIfMatch.status).toBe(409);

    const reordered = await call('/api/v1/production-step-positions', {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': catalogEtag },
      body: JSON.stringify({ step_ids: [c.id, b.id, a.id] }),
    });
    await expectContract(reordered, { status: 200 });
    const { data } = (await reordered.json()) as { data: ProductionStepDto[] };
    expect(data.map((s) => s.label)).toEqual(['C', 'B', 'A']);
    expect(data.map((s) => s.position)).toEqual([0, 1, 2]);
  });

  it('reorderProductionSteps — capability requise avant toute autre garde (403 avant 409/422)', async () => {
    const a = seedStep({ label: 'A', position: 0 });
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_production_steps', false);

    const response = await call('/api/v1/production-step-positions', {
      method: 'PUT',
      // If-Match volontairement PERIME : sans la garde de capability EN
      // PREMIER, ce serait un 409 (voire un 422 si l ensemble etait aussi
      // incomplet) qui sortirait avant le 403 attendu.
      headers: { ...jsonHeaders, 'If-Match': '"peu-importe"' },
      body: JSON.stringify({ step_ids: [a.id] }),
    });
    expect(response.status).toBe(403);
  });
});
