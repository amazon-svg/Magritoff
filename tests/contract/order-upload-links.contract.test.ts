/**
 * Module Liens de depot publics (stories E10.20a/E10.20b) contre le contrat.
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
 * `tests/sql/gescom-e10-20a-order-upload-links.sql`/
 * `tests/sql/gescom-e10-20b-order-upload-link-deposit.sql` — ce fichier
 * valide la FORME HTTP/JSON (enveloppe, codes d erreur, gardes
 * d authentification et de cloisonnement) contre le contrat, pas
 * l implementation SQL sous-jacente.
 *
 * E10.20b AJOUTE : `issueOrderUploadLinkFileUrl`/`confirmOrderUploadLinkFile`,
 * verifies ICI EN PLUS des quatre operations d E10.20a, avec un
 * `OutboxRepository` en memoire pour prouver que `order.files_submitted` est
 * publie UNE FOIS PAR FICHIER (arbitrage (G)), jamais sur un rejeu
 * idempotent.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import {
  InMemoryIdempotencyStore,
  OutboxPublisher,
  type ApiPrincipal,
  type OutboxEvent,
  type OutboxRepository,
  type PrincipalVerifier,
} from '@/modules/_shared/application';
import { OrderUploadLinksService } from '@/modules/order-upload-links/application/order-upload-links-service';
import type {
  OrderUploadLinkContextDto,
  OrderUploadLinkCreatedDto,
  OrderUploadLinkDepositDto,
  OrderUploadLinkDto,
} from '@/modules/order-upload-links/api/contracts';
import type { OrderFileUploadTicketDto } from '@/modules/order-files/api/contracts';
import { createOrderUploadLinksRoutes } from '@/server/api/order-upload-links-routes';
import { createGescomApiHandler } from '@/server/api';
import {
  InMemoryOrderUploadLinksRepository,
  fakeOrderUploadLinkUuid,
} from './_fakes/order-upload-links-repository.fake.ts';
import { checkResponseAgainstContract } from './_harness.ts';

class InMemoryOutboxRepository implements OutboxRepository {
  readonly events: OutboxEvent[] = [];
  async append(events: readonly OutboxEvent[]): Promise<void> {
    this.events.push(...events);
  }
}

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
let outboxRepository: InMemoryOutboxRepository;
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
  outboxRepository = new InMemoryOutboxRepository();
  const service = new OrderUploadLinksService({
    repository,
    outbox: new OutboxPublisher({
      repository: outboxRepository,
      now: () => new Date('2026-09-10T10:00:00.000Z'),
      newEventId: () => `evt-${outboxRepository.events.length + 1}`,
    }),
  });
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

  // ── E10.20b — le depot par le lien ────────────────────────────────────────

  async function issueTicket(token: string): Promise<Response> {
    return call('/api/v1/order-upload-links/current/file-upload-urls', {
      method: 'POST',
      headers: { 'X-Magrit-Upload-Link': token },
    });
  }

  async function confirmDeposit(
    token: string,
    body: Readonly<Record<string, unknown>>,
    idempotencyKeyValue: string = idempotencyKey(),
  ): Promise<Response> {
    return call('/api/v1/order-upload-links/current/files', {
      method: 'POST',
      headers: {
        'X-Magrit-Upload-Link': token,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKeyValue,
      },
      body: JSON.stringify(body),
    });
  }

  it('issueOrderUploadLinkFileUrl : 200, alloue un file_id, PAS d Idempotency-Key exigee', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId);
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const response = await issueTicket(createdData.token);
    await expectContract(response, { status: 200, dataSchema: 'OrderFileUploadTicket' });
    const { data } = (await response.json()) as { data: OrderFileUploadTicketDto };
    expect(data.file_id).toBeTruthy();
    expect(data.max_byte_size).toBeGreaterThan(0);
    expect(data.accepted_content_types.length).toBeGreaterThan(0);
  });

  it('issueOrderUploadLinkFileUrl : jeton invalide -> 401 upload_link.invalid ; jeton d un autre mode -> 403', async () => {
    const invalid = await issueTicket('jeton-qui-n-existe-pas-00000000000000000000000000');
    expect(invalid.status).toBe(401);
    expect(((await invalid.json()) as { code: string }).code).toBe('upload_link.invalid');

    const response = await call('/api/v1/order-upload-links/current/file-upload-urls', {
      method: 'POST',
      headers: asUser,
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe('identity.actor_kind_required');
  });

  it('confirmOrderUploadLinkFile : 201, cree le fichier, publie order.files_submitted UNE FOIS, deposited_count s incremente', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId, { label: 'BAT flyers' });
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const ticketResponse = await issueTicket(createdData.token);
    const { data: ticket } = (await ticketResponse.json()) as { data: OrderFileUploadTicketDto };
    repository.stageUploadForTest(ticket.file_id, { contentType: 'application/pdf', byteSize: 2048 });

    const response = await confirmDeposit(createdData.token, { file_id: ticket.file_id, filename: 'bat.pdf' });
    await expectContract(response, { status: 201, dataSchema: 'OrderUploadLinkDeposit' });
    const { data } = (await response.json()) as { data: OrderUploadLinkDepositDto };
    expect(data.file_id).toBe(ticket.file_id);
    expect(data.filename).toBe('bat.pdf');
    expect(data.deposited_count).toBe(1);
    expect(data.max_files).toBe(10);
    // Recu MINIMAL (arbitrage (E)) : aucun champ d atelier ne doit fuiter ici.
    expect(data).not.toHaveProperty('visibility');
    expect(data).not.toHaveProperty('deposited_by');

    const events = outboxRepository.events.filter((event) => event.name === 'order.files_submitted');
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toMatchObject({
      file_id: ticket.file_id,
      upload_link_id: createdData.id,
      order_id: orderId,
      order_number: 'CDE-2026-08001',
    });

    const list = await call(`/api/v1/commercial-orders/${orderId}/upload-links`, { headers: asUser });
    const { data: links } = (await list.json()) as { data: OrderUploadLinkDto[] };
    expect(links[0]!.deposited_count).toBe(1);
  });

  it('confirmOrderUploadLinkFile : Idempotency-Key rejouee a l identique rend la MEME reponse, sans second evenement', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId);
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const ticketResponse = await issueTicket(createdData.token);
    const { data: ticket } = (await ticketResponse.json()) as { data: OrderFileUploadTicketDto };
    repository.stageUploadForTest(ticket.file_id, { contentType: 'application/pdf', byteSize: 2048 });

    const key = idempotencyKey();
    const first = await confirmDeposit(createdData.token, { file_id: ticket.file_id, filename: 'bat.pdf' }, key);
    expect(first.status).toBe(201);

    const replay = await confirmDeposit(createdData.token, { file_id: ticket.file_id, filename: 'bat.pdf' }, key);
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');

    const events = outboxRepository.events.filter((event) => event.name === 'order.files_submitted');
    expect(events).toHaveLength(1);
  });

  it('confirmOrderUploadLinkFile : SANS Idempotency-Key -> refusee (CA8, createsResource)', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId);
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const response = await call('/api/v1/order-upload-links/current/files', {
      method: 'POST',
      headers: { 'X-Magrit-Upload-Link': createdData.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fakeOrderUploadLinkUuid(), filename: 'x.pdf' }),
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe('api.idempotency_key_required');
  });

  it('confirmOrderUploadLinkFile : plafond du LIEN (max_files) -> 409 upload_link.file_limit_reached', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId, { max_files: 1 });
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const firstTicket = await issueTicket(createdData.token);
    const { data: firstFile } = (await firstTicket.json()) as { data: OrderFileUploadTicketDto };
    repository.stageUploadForTest(firstFile.file_id, { contentType: 'application/pdf', byteSize: 2048 });
    const first = await confirmDeposit(createdData.token, { file_id: firstFile.file_id, filename: 'un.pdf' });
    expect(first.status).toBe(201);

    const secondTicket = await issueTicket(createdData.token);
    expect(secondTicket.status).toBe(409);
    expect(((await secondTicket.json()) as { code: string }).code).toBe('upload_link.file_limit_reached');

    // Meme plafond exige A LA CONFIRMATION, meme sans passer par un nouveau
    // billet (defense en profondeur, "verifie ICI sous verrou" — contrat) :
    // un fichier deja stage pour un id neuf est quand meme refuse.
    const secondFileId = fakeOrderUploadLinkUuid();
    repository.stageUploadForTest(secondFileId, { contentType: 'application/pdf', byteSize: 10 });
    const secondConfirm = await confirmDeposit(createdData.token, { file_id: secondFileId, filename: 'deux.pdf' });
    expect(secondConfirm.status).toBe(409);
    expect(((await secondConfirm.json()) as { code: string }).code).toBe('upload_link.file_limit_reached');
  });

  it('confirmOrderUploadLinkFile : plafond de la COMMANDE (30 fichiers vivants) -> 409 upload_link.file_limit_reached', async () => {
    const orderId = seedOrder();
    repository.seedLiveFileCountForTest(orderId, 30);
    const created = await createLink(orderId);
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const ticket = await issueTicket(createdData.token);
    expect(ticket.status).toBe(409);
    expect(((await ticket.json()) as { code: string }).code).toBe('upload_link.file_limit_reached');
  });

  it('confirmOrderUploadLinkFile : aucun objet depose au chemin attendu -> 404 order_file.upload_missing', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId);
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const response = await confirmDeposit(createdData.token, {
      file_id: fakeOrderUploadLinkUuid(),
      filename: 'introuvable.pdf',
    });
    expect(response.status).toBe(404);
    expect(((await response.json()) as { code: string }).code).toBe('order_file.upload_missing');
  });

  it('confirmOrderUploadLinkFile : meme file_id confirme deux fois -> 409 order_file.already_confirmed', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId);
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const ticketResponse = await issueTicket(createdData.token);
    const { data: ticket } = (await ticketResponse.json()) as { data: OrderFileUploadTicketDto };
    repository.stageUploadForTest(ticket.file_id, { contentType: 'application/pdf', byteSize: 2048 });
    const first = await confirmDeposit(createdData.token, { file_id: ticket.file_id, filename: 'bat.pdf' });
    expect(first.status).toBe(201);

    repository.stageUploadForTest(ticket.file_id, { contentType: 'application/pdf', byteSize: 2048 });
    const second = await confirmDeposit(createdData.token, { file_id: ticket.file_id, filename: 'bat.pdf' });
    expect(second.status).toBe(409);
    expect(((await second.json()) as { code: string }).code).toBe('order_file.already_confirmed');
  });

  it('confirmOrderUploadLinkFile : jeton invalide -> 401 upload_link.invalid ; autre mode -> 403', async () => {
    const invalid = await confirmDeposit('jeton-qui-n-existe-pas-00000000000000000000000000', {
      file_id: fakeOrderUploadLinkUuid(),
      filename: 'x.pdf',
    });
    expect(invalid.status).toBe(401);
    expect(((await invalid.json()) as { code: string }).code).toBe('upload_link.invalid');

    const response = await call('/api/v1/order-upload-links/current/files', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ file_id: fakeOrderUploadLinkUuid(), filename: 'x.pdf' }),
    });
    expect(response.status).toBe(403);
  });

  // qa-review round 1 (M2) — un nom de fichier portant un caractere de
  // controle est refuse a la VALIDATION D ENTREE (422), avant meme d
  // atteindre le repository : le texte est fourni par un tiers NON
  // AUTHENTIFIE et alimente Content-Disposition en aval (getOrderFile).
  it('confirmOrderUploadLinkFile : filename avec caractere de controle -> 422 api.validation_failed (qa-review M2)', async () => {
    const orderId = seedOrder();
    const created = await createLink(orderId);
    const { data: createdData } = (await created.json()) as { data: OrderUploadLinkCreatedDto };

    const ticketResponse = await issueTicket(createdData.token);
    const { data: ticket } = (await ticketResponse.json()) as { data: OrderFileUploadTicketDto };
    repository.stageUploadForTest(ticket.file_id, { contentType: 'application/pdf', byteSize: 2048 });

    const response = await confirmDeposit(createdData.token, {
      file_id: ticket.file_id,
      // Caractere de controle INTERIEUR (tabulation, \x09) : ni en tete
      // ni en fin de chaine, donc PAS retire par le `.trim()` qui precede
      // le refus dans la chaine Zod.
      filename: 'bat\tfacture.pdf',
    });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { code: string }).code).toBe('api.validation_failed');
  });

  it('CLOISONNEMENT : une cle de service n atteint JAMAIS les deux operations de depot (403), symetrique des trois operations d atelier verifiees plus haut', async () => {
    const asStudioIssue = await call('/api/v1/order-upload-links/current/file-upload-urls', {
      method: 'POST',
      headers: asStudio,
    });
    expect(asStudioIssue.status).toBe(403);
    expect(((await asStudioIssue.json()) as { code: string }).code).toBe('identity.actor_kind_required');

    const asStudioConfirm = await call('/api/v1/order-upload-links/current/files', {
      method: 'POST',
      headers: { ...asStudio, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ file_id: fakeOrderUploadLinkUuid(), filename: 'x.pdf' }),
    });
    expect(asStudioConfirm.status).toBe(403);
    expect(((await asStudioConfirm.json()) as { code: string }).code).toBe('identity.actor_kind_required');
  });
});
