/**
 * Module Liens de depot publics (story E10.20a) contre le contrat.
 *
 * Exerce reellement `createOrderUploadLinksRoutes()` via
 * `createGescomApiHandler`, avec un `OrderUploadLinksRepository` en memoire
 * (`InMemoryOrderUploadLinksRepository`, aucune dependance a Supabase).
 * Chaque reponse est confrontee au contrat via `checkResponseAgainstContract`.
 *
 * ATTENTION PARTICULIERE (demande explicite de la story) : ce fichier ne
 * verifie pas seulement la fonctionnalite, il verifie le CLOISONNEMENT DU
 * QUATRIEME MODE — un principal `upload_link` n atteint jamais une operation
 * d atelier, un jeton utilisateur n atteint jamais `getOrderUploadLinkContext`,
 * et le cumul d une credential explicite avec `X-Magrit-Upload-Link` est
 * refuse la ou le contrat l exige.
 *
 * Les REGLES TENUES EN BASE (isolation tenant, plafond de 10 SOUS VERROU,
 * jeton jamais stocke en clair, revocation) sont verifiees REELLEMENT par
 * `tests/sql/gescom-e10-20a-order-upload-links.sql` — ce fichier valide la
 * FORME HTTP/JSON (enveloppe, codes d erreur, gardes d authentification et
 * de cloisonnement) contre le contrat, pas l implementation SQL sous-jacente.
 *
 * PERIMETRE : E10.20a n enregistre PAS `issueOrderUploadLinkFileUrl` ni
 * `confirmOrderUploadLinkFile` (E10.20b) — ce fichier ne les exerce donc pas.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import {
  InMemoryIdempotencyStore,
  type ApiPrincipal,
  type PrincipalVerifier,
} from '@/modules/_shared/application';
import { OrderUploadLinksService } from '@/modules/order-upload-links/application/order-upload-links-service';
import type {
  OrderUploadLinkContextDto,
  OrderUploadLinkCreatedDto,
  OrderUploadLinkDto,
} from '@/modules/order-upload-links/api/contracts';
import { createOrderUploadLinksRoutes } from '@/server/api/order-upload-links-routes';
import { createGescomApiHandler } from '@/server/api';
import {
  InMemoryOrderUploadLinksRepository,
  fakeOrderUploadLinkUuid,
} from './_fakes/order-upload-links-repository.fake.ts';
import { checkResponseAgainstContract } from './_harness.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9020');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e80');

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

let orderSequence = 0;
function fakeOrderUuid(): string {
  orderSequence += 1;
  return `50000000-0000-4000-9300-${String(orderSequence).padStart(12, '0')}`;
}

const userPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: USER, tenantId: TENANT });
const studioPrincipal: ApiPrincipal = Object.freeze({
  kind: 'service',
  serviceId: 'studio',
  tenantId: TENANT,
  scopes: Object.freeze(['orders:read']),
});

let repository: InMemoryOrderUploadLinksRepository;
let handler: (request: Request) => Promise<Response>;

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer') {
      return credential.token === 'jeton-valide' ? userPrincipal : null;
    }
    if (credential.kind === 'service_key') {
      return credential.key === 'cle-studio' ? studioPrincipal : null;
    }
    if (credential.kind === 'upload_link') {
      // Meme mecanisme que SupabaseApiPrincipalVerifier.verifyUploadLink :
      // resout depuis une fonction/primitive DEDIEE (ici, le fake), jamais
      // depuis un identifiant fourni en clair par l appelant.
      const resolved = repository.resolvePrincipalForTest(credential.token);
      if (!resolved) return null;
      return Object.freeze({
        kind: 'upload_link' as const,
        linkId: resolved.linkId,
        orderId: resolved.orderId,
        tenantId: resolved.tenantId as TenantId,
        token: credential.token,
      });
    }
    return null;
  },
};

beforeEach(() => {
  repository = new InMemoryOrderUploadLinksRepository();
  const service = new OrderUploadLinksService({ repository });
  handler = createGescomApiHandler({
    routes: createOrderUploadLinksRoutes(service),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-20a',
  });
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asUser = { Authorization: 'Bearer jeton-valide' };
const jsonHeaders = { ...asUser, 'Content-Type': 'application/json' };
const asStudio = { 'X-Magrit-Service-Key': 'cle-studio' };

let idempotencySequence = 0;
function idempotencyKey(): string {
  idempotencySequence += 1;
  return `idem-upload-link-${idempotencySequence}`;
}

async function expectContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<void> {
  const check = await checkResponseAgainstContract(response, expectation);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
}

function seedOrder(): string {
  const orderId = fakeOrderUuid();
  repository.seedOrderForTest({ id: orderId, tenantId: TENANT, number: 'CDE-2026-08001', tenantName: 'Imprimerie Test' });
  return orderId;
}

async function createLink(
  orderId: string,
  body: Readonly<Record<string, unknown>> = {},
): Promise<Response> {
  return call(`/api/v1/commercial-orders/${orderId}/upload-links`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify(body),
  });
}

describe('module Liens de depot publics (E10.20a) contre le contrat', () => {
  it('createOrderUploadLink : 201, rend le jeton en clair UNE FOIS, defauts 30 jours/10 fichiers', async () => {
    const orderId = seedOrder();
    const response = await createLink(orderId);
    await expectContract(response, { status: 201, dataSchema: 'OrderUploadLinkCreated' });
    const { data } = (await response.json()) as { data: OrderUploadLinkCreatedDto };
    expect(data.token).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
    expect(data.max_files).toBe(10);
    expect(data.deposited_count).toBe(0);
    expect(data.label).toBeNull();

    const missing = await createLink(fakeOrderUuid());
    expect(missing.status).toBe(404);
    const missingBody = (await missing.json()) as { code: string };
    expect(missingBody.code).toBe('order.not_found');
  });

  it('createOrderUploadLink : reservee au jeton UTILISATEUR (403 pour une cle de service)', async () => {
    const orderId = seedOrder();
    const response = await call(`/api/v1/commercial-orders/${orderId}/upload-links`, {
      method: 'POST',
      headers: { ...asStudio, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(403);
  });

  it('createOrderUploadLink : plafond de 10 liens VIVANTS -> 409 upload_link.limit_reached', async () => {
    const orderId = seedOrder();
    for (let index = 0; index < 10; index += 1) {
      const response = await createLink(orderId);
      expect(response.status).toBe(201);
    }
    const refused = await createLink(orderId);
    expect(refused.status).toBe(409);
    const body = (await refused.json()) as { code: string };
    expect(body.code).toBe('upload_link.limit_reached');
  });

  it('listOrderUploadLinks : ouverte au jeton utilisateur, AUCUNE garde de capability, jamais le jeton', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId, { label: 'BAT flyers' });
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const asUserList = await call(`/api/v1/commercial-orders/${orderId}/upload-links`, { headers: asUser });
    await expectContract(asUserList, { status: 200 });
    const { data } = (await asUserList.json()) as { data: OrderUploadLinkDto[] };
    expect(data).toHaveLength(1);
    expect(data[0]!.id).toBe(createdData.id);
    expect(data[0]!.label).toBe('BAT flyers');
    expect((data[0] as unknown as { token?: string }).token).toBeUndefined();
  });

  it('listOrderUploadLinks : reservee au jeton UTILISATEUR (403 pour une cle de service) — ECART assume avec listOrderFiles, contrat `security: [bearerAuth]` seul sur les trois operations d atelier de ce module', async () => {
    const orderId = seedOrder();
    const response = await call(`/api/v1/commercial-orders/${orderId}/upload-links`, { headers: asStudio });
    expect(response.status).toBe(403);
  });

  it('listOrderUploadLinks : liste VIDE legitime, 404 hors tenant', async () => {
    const orderId = seedOrder();
    const response = await call(`/api/v1/commercial-orders/${orderId}/upload-links`, { headers: asUser });
    await expectContract(response, { status: 200 });
    const { data } = (await response.json()) as { data: OrderUploadLinkDto[] };
    expect(data).toEqual([]);

    const missing = await call(`/api/v1/commercial-orders/${fakeOrderUuid()}/upload-links`, { headers: asUser });
    expect(missing.status).toBe(404);
  });

  it('revokeOrderUploadLink : 204, le lien quitte la liste, rejouer rend 404 upload_link.not_found', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId);
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const response = await call(`/api/v1/commercial-orders/${orderId}/upload-links/${createdData.id}`, {
      method: 'DELETE',
      headers: asUser,
    });
    await expectContract(response, { status: 204 });

    const list = await call(`/api/v1/commercial-orders/${orderId}/upload-links`, { headers: asUser });
    const { data: listData } = (await list.json()) as { data: OrderUploadLinkDto[] };
    expect(listData).toEqual([]);

    const replay = await call(`/api/v1/commercial-orders/${orderId}/upload-links/${createdData.id}`, {
      method: 'DELETE',
      headers: asUser,
    });
    expect(replay.status).toBe(404);
    const body = (await replay.json()) as { code: string };
    expect(body.code).toBe('upload_link.not_found');
  });

  it('revokeOrderUploadLink : reservee au jeton UTILISATEUR (403 pour une cle de service)', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId);
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const response = await call(`/api/v1/commercial-orders/${orderId}/upload-links/${createdData.id}`, {
      method: 'DELETE',
      headers: asStudio,
    });
    expect(response.status).toBe(403);
  });

  it('getOrderUploadLinkContext : rend le contexte minimal, AUCUN prix/ligne/URL', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId, { label: 'votre BAT' });
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const response = await call('/api/v1/order-upload-links/current', {
      headers: { 'X-Magrit-Upload-Link': createdData.token },
    });
    await expectContract(response, { status: 200, dataSchema: 'OrderUploadLinkContext' });
    const { data } = (await response.json()) as { data: OrderUploadLinkContextDto };
    expect(data.printer_name).toBe('Imprimerie Test');
    expect(data.order_number).toBe('CDE-2026-08001');
    expect(data.label).toBe('votre BAT');
    expect(data.deposited_count).toBe(0);
    expect(data.max_byte_size).toBeGreaterThan(0);
    expect(data.accepted_content_types.length).toBeGreaterThan(0);
    // Arbitrage (E), depot seul : AUCUN champ d atelier (prix, ligne, nom de
    // client, URL) ne doit apparaitre dans ce contexte.
    expect(data).not.toHaveProperty('customer_name');
    expect(data).not.toHaveProperty('download_url');
  });

  it('getOrderUploadLinkContext : jeton absent, inexistant, expire ou revoque rendent TOUS 401 upload_link.invalid, sans distinction', async () => {
    const orderId = seedOrder();

    const noHeader = await call('/api/v1/order-upload-links/current');
    expect(noHeader.status).toBe(401);
    expect(((await noHeader.json()) as { code: string }).code).toBe('upload_link.invalid');

    const unknown = await call('/api/v1/order-upload-links/current', {
      headers: { 'X-Magrit-Upload-Link': 'jeton-qui-n-existe-pas-00000000000000000000000000' },
    });
    expect(unknown.status).toBe(401);
    expect(((await unknown.json()) as { code: string }).code).toBe('upload_link.invalid');

    const created = await createLink(orderId);
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };
    await call(`/api/v1/commercial-orders/${orderId}/upload-links/${createdData.id}`, {
      method: 'DELETE',
      headers: asUser,
    });
    const revoked = await call('/api/v1/order-upload-links/current', {
      headers: { 'X-Magrit-Upload-Link': createdData.token },
    });
    expect(revoked.status).toBe(401);
    expect(((await revoked.json()) as { code: string }).code).toBe('upload_link.invalid');
  });

  it('CLOISONNEMENT (attention particuliere de la story) : un jeton utilisateur/une cle de service n atteint JAMAIS getOrderUploadLinkContext (403)', async () => {
    const asUserOnContext = await call('/api/v1/order-upload-links/current', { headers: asUser });
    expect(asUserOnContext.status).toBe(403);
    expect(((await asUserOnContext.json()) as { code: string }).code).toBe('identity.actor_kind_required');

    const asStudioOnContext = await call('/api/v1/order-upload-links/current', { headers: asStudio });
    expect(asStudioOnContext.status).toBe(403);
  });

  it(
    'CLOISONNEMENT : un lien SEUL (sans autre credential) sur une operation d atelier est traite EXACTEMENT ' +
      'comme une requete non authentifiee (401), meme sur SA PROPRE commande — qa-review round 1 (B1) : ' +
      "l en-tete de lien est IGNORE hors de son mode, il ne designe donc meme pas un acteur qu on refuserait",
    async () => {
      const orderId = seedOrder();
      const created = await createLink(orderId);
      const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

      const list = await call(`/api/v1/commercial-orders/${orderId}/upload-links`, {
        headers: { 'X-Magrit-Upload-Link': createdData.token },
      });
      expect(list.status).toBe(401);
      expect(((await list.json()) as { code: string }).code).toBe('identity.authentication_required');

      const create = await call(`/api/v1/commercial-orders/${orderId}/upload-links`, {
        method: 'POST',
        headers: {
          'X-Magrit-Upload-Link': createdData.token,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({}),
      });
      expect(create.status).toBe(401);

      const revoke = await call(`/api/v1/commercial-orders/${orderId}/upload-links/${createdData.id}`, {
        method: 'DELETE',
        headers: { 'X-Magrit-Upload-Link': createdData.token },
      });
      expect(revoke.status).toBe(401);
    },
  );

  // NOTE : le cas « cookie de session boutique VALIDE + en-tete de lien
  // SANS RAPPORT sur une route qui ne declare pas `upload_link` » (le
  // scenario concret signale en qa-review round 1, B1 — E10.20b servant la
  // page de depot sur la MEME ORIGINE que la boutique) n a pas de fixture
  // `shop_customer` dans ce module : il est couvert par le test symetrique
  // ajoute a `tests/contract/gescom-middleware.contract.test.ts` (socle),
  // qui prouve que le cookie l emporte et que le lien est bien ignore.

  it('CLOISONNEMENT (§3.6 branche 4) : cumuler X-Magrit-Upload-Link avec un Bearer sur getOrderUploadLinkContext est refuse en 400, le cumul ne peut etre que delibere', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId);
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const response = await call('/api/v1/order-upload-links/current', {
      headers: { ...asUser, 'X-Magrit-Upload-Link': createdData.token },
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('identity.actor_kind_required');
  });

  it('CLOISONNEMENT (§3.6 branche 4) : sur une operation d atelier, X-Magrit-Upload-Link est IGNORE en presence d un Bearer, 200 normal', async () => {
    const orderId = seedOrder();
    // Un membre qui ouvrirait par ailleurs le lien de son propre client dans
    // le meme navigateur porterait passivement cet en-tete sur ses appels
    // d atelier : il doit rester sans effet, jamais une ambiguite.
    const response = await call(`/api/v1/commercial-orders/${orderId}/upload-links`, {
      headers: { ...asUser, 'X-Magrit-Upload-Link': 'peu-importe-un-jeton-quelconque-ignore-ici-0000' },
    });
    await expectContract(response, { status: 200 });
  });

  it('X-Magrit-Tenant sur getOrderUploadLinkContext est REFUSE en 400, jamais ignore (le lien porte deja le tenant)', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId);
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const response = await call('/api/v1/order-upload-links/current', {
      headers: { 'X-Magrit-Upload-Link': createdData.token, 'X-Magrit-Tenant': TENANT },
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.tenant_not_addressable');
  });
});
