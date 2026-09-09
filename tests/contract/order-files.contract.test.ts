/**
 * Module Fichiers de commande (story E10.17a) contre le contrat.
 *
 * Exerce reellement `createOrderFilesRoutes()` via `createGescomApiHandler`,
 * avec un `OrderFilesRepository` en memoire (`InMemoryOrderFilesRepository`,
 * aucune dependance a Supabase). Chaque reponse est confrontee au contrat via
 * `checkResponseAgainstContract`.
 *
 * Les REGLES TENUES EN BASE (isolation tenant, plafond de 30 SOUS VERROU,
 * ligne d une autre commande refusee, suppression douce, ecriture PostgREST
 * directe sans effet) sont verifiees REELLEMENT par
 * `tests/sql/gescom-e10-17a-order-files.sql` — ce fichier valide la FORME
 * HTTP/JSON (enveloppe, ETag, codes d erreur, gardes d authentification)
 * contre le contrat, pas l implementation SQL sous-jacente.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import {
  InMemoryIdempotencyStore,
  type ApiPrincipal,
  type PrincipalVerifier,
} from '@/modules/_shared/application';
import { OrderFilesService } from '@/modules/order-files/application/order-files-service';
import type { OrderFileDetailDto, OrderFileDto, OrderFileUploadTicketDto } from '@/modules/order-files/api/contracts';
import { createOrderFilesRoutes } from '@/server/api/order-files-routes';
import { createGescomApiHandler } from '@/server/api';
import { InMemoryOrderFilesRepository, fakeOrderFileUuid } from './_fakes/order-files-repository.fake.ts';
import { checkResponseAgainstContract } from './_harness.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9014');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e71');

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

let orderSequence = 0;
function fakeOrderUuid(): string {
  orderSequence += 1;
  return `20000000-0000-4000-9300-${String(orderSequence).padStart(12, '0')}`;
}

let lineSequence = 0;
function fakeLineUuid(): string {
  lineSequence += 1;
  return `30000000-0000-4000-9300-${String(lineSequence).padStart(12, '0')}`;
}

const userPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: USER, tenantId: TENANT });
const studioPrincipal: ApiPrincipal = Object.freeze({
  kind: 'service',
  serviceId: 'studio',
  tenantId: TENANT,
  scopes: Object.freeze(['orders:read']),
});

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer') {
      return credential.token === 'jeton-valide' ? userPrincipal : null;
    }
    if (credential.kind === 'service_key' && credential.key === 'cle-studio') return studioPrincipal;
    return null;
  },
};

let sequence = 0;
/** `[A-Za-z0-9_.:-]{8,255}` (contrat `IdempotencyKey`) : le prefixe seul est trop court. */
function idempotencyKey(): string {
  sequence += 1;
  return `idem-order-file-${sequence}`;
}

let repository: InMemoryOrderFilesRepository;
let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  repository = new InMemoryOrderFilesRepository();
  const service = new OrderFilesService({ repository });
  handler = createGescomApiHandler({
    routes: createOrderFilesRoutes(service),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-17a',
  });
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asUser = { Authorization: 'Bearer jeton-valide' };
const jsonHeaders = { ...asUser, 'Content-Type': 'application/json' };
const asStudio = { 'X-Magrit-Service-Key': 'cle-studio' };

async function expectContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<void> {
  const check = await checkResponseAgainstContract(response, expectation);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
}

function seedOrder(lineIds: readonly string[] = []): string {
  const orderId = fakeOrderUuid();
  repository.seedOrderForTest({ id: orderId, tenantId: TENANT, lineIds });
  return orderId;
}

async function issueTicket(orderId: string): Promise<OrderFileUploadTicketDto> {
  const response = await call(`/api/v1/commercial-orders/${orderId}/file-upload-urls`, {
    method: 'POST',
    headers: asUser,
  });
  const { data } = (await response.json()) as { data: OrderFileUploadTicketDto };
  return data;
}

async function confirm(
  orderId: string,
  ticket: OrderFileUploadTicketDto,
  overrides: Readonly<Record<string, unknown>> = {},
): Promise<Response> {
  repository.stageUploadForTest(ticket.file_id, { contentType: 'application/pdf', byteSize: 12_345 });
  return call(`/api/v1/commercial-orders/${orderId}/files`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({ file_id: ticket.file_id, filename: 'bat.pdf', ...overrides }),
  });
}

describe('module Fichiers de commande (E10.17a) contre le contrat', () => {
  it('issueOrderFileUploadUrl : 200 sans Idempotency-Key, ALLOUE un file_id NEUF a chaque appel, 404 hors tenant', async () => {
    const orderId = seedOrder();

    const first = await call(`/api/v1/commercial-orders/${orderId}/file-upload-urls`, {
      method: 'POST',
      headers: asUser,
    });
    await expectContract(first, { status: 200, dataSchema: 'OrderFileUploadTicket' });
    const { data: firstTicket } = (await first.json()) as { data: OrderFileUploadTicketDto };
    expect(firstTicket.accepted_content_types).toContain('application/pdf');
    expect(firstTicket.accepted_content_types).toContain('application/zip');
    expect(firstTicket.accepted_content_types).toContain('application/x-zip-compressed');

    const second = await call(`/api/v1/commercial-orders/${orderId}/file-upload-urls`, {
      method: 'POST',
      headers: asUser,
    });
    const { data: secondTicket } = (await second.json()) as { data: OrderFileUploadTicketDto };
    expect(secondTicket.file_id).not.toBe(firstTicket.file_id);

    const missing = await call(`/api/v1/commercial-orders/${fakeOrderUuid()}/file-upload-urls`, {
      method: 'POST',
      headers: asUser,
    });
    expect(missing.status).toBe(404);
    const missingBody = (await missing.json()) as { code: string };
    expect(missingBody.code).toBe('order.not_found');
  });

  it('issueOrderFileUploadUrl/confirmOrderFileUpload/updateOrderFile/deleteOrderFile : 403 pour une cle de service (decision #5, reservees au jeton utilisateur)', async () => {
    const orderId = seedOrder();
    const ticket = await issueTicket(orderId);
    const confirmed = await confirm(orderId, ticket);
    const { data: file } = (await confirmed.json()) as { data: OrderFileDto };

    const issue = await call(`/api/v1/commercial-orders/${orderId}/file-upload-urls`, {
      method: 'POST',
      headers: asStudio,
    });
    expect(issue.status).toBe(403);

    const confirmAttempt = await call(`/api/v1/commercial-orders/${orderId}/files`, {
      method: 'POST',
      headers: { ...asStudio, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ file_id: fakeOrderFileUuid(), filename: 'x.pdf' }),
    });
    expect(confirmAttempt.status).toBe(403);

    const update = await call(`/api/v1/commercial-orders/${orderId}/files/${file.id}`, {
      method: 'PATCH',
      headers: { ...asStudio, 'Content-Type': 'application/json', 'If-Match': '"peu-importe"' },
      body: JSON.stringify({ visibility: 'customer' }),
    });
    expect(update.status).toBe(403);

    const remove = await call(`/api/v1/commercial-orders/${orderId}/files/${file.id}`, {
      method: 'DELETE',
      headers: asStudio,
    });
    expect(remove.status).toBe(403);
  });

  it('listOrderFiles/getOrderFile : ouvertes au jeton utilisateur ET a une cle de service orders:read, AUCUNE capability requise', async () => {
    const orderId = seedOrder();
    const ticket = await issueTicket(orderId);
    await confirm(orderId, ticket);

    const listAsUser = await call(`/api/v1/commercial-orders/${orderId}/files`, { headers: asUser });
    expect(listAsUser.status).toBe(200);
    const listAsStudio = await call(`/api/v1/commercial-orders/${orderId}/files`, { headers: asStudio });
    expect(listAsStudio.status).toBe(200);
  });

  it('listOrderFiles : liste VIDE legitime, puis triee du plus recent au plus ancien, sans URL de telechargement, 404 hors tenant', async () => {
    const orderId = seedOrder();

    const empty = await call(`/api/v1/commercial-orders/${orderId}/files`, { headers: asUser });
    await expectContract(empty, { status: 200 });
    const { data: emptyData } = (await empty.json()) as { data: OrderFileDto[] };
    expect(emptyData).toEqual([]);

    const ticketA = await issueTicket(orderId);
    await confirm(orderId, ticketA, { filename: 'a.pdf' });
    const ticketB = await issueTicket(orderId);
    await confirm(orderId, ticketB, { filename: 'b.pdf' });

    const response = await call(`/api/v1/commercial-orders/${orderId}/files`, { headers: asUser });
    await expectContract(response, { status: 200 });
    const { data } = (await response.json()) as { data: Array<OrderFileDto & { download_url?: string }> };
    expect(data.map((f) => f.filename)).toEqual(['b.pdf', 'a.pdf']);
    expect(data.every((f) => f.download_url === undefined)).toBe(true);

    const missing = await call(`/api/v1/commercial-orders/${fakeOrderUuid()}/files`, { headers: asUser });
    expect(missing.status).toBe(404);
  });

  it('confirmOrderFileUpload : cree le fichier, Idempotency-Key rejouee rend la meme reponse (pas une seconde ligne)', async () => {
    const orderId = seedOrder();
    const ticket = await issueTicket(orderId);
    repository.stageUploadForTest(ticket.file_id, { contentType: 'application/pdf', byteSize: 500 });

    const key = idempotencyKey();
    const body = JSON.stringify({ file_id: ticket.file_id, filename: 'bat.pdf' });
    const first = await call(`/api/v1/commercial-orders/${orderId}/files`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': key },
      body,
    });
    await expectContract(first, { status: 201, dataSchema: 'OrderFile' });
    expect(first.headers.get('etag')).toBeTruthy();
    const { data: firstData } = (await first.json()) as { data: OrderFileDto };
    expect(firstData.visibility).toBe('internal');
    expect(firstData.deposited_by).toBe(USER);

    const replay = await call(`/api/v1/commercial-orders/${orderId}/files`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': key },
      body,
    });
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    const { data: replayData } = (await replay.json()) as { data: OrderFileDto };
    expect(replayData.id).toBe(firstData.id);

    const list = await call(`/api/v1/commercial-orders/${orderId}/files`, { headers: asUser });
    const { data: listData } = (await list.json()) as { data: OrderFileDto[] };
    expect(listData).toHaveLength(1);
  });

  it('confirmOrderFileUpload : visibilite absente -> internal par defaut (ferme par defaut, contrat)', async () => {
    const orderId = seedOrder();
    const ticket = await issueTicket(orderId);
    const response = await confirm(orderId, ticket);
    const { data } = (await response.json()) as { data: OrderFileDto };
    expect(data.visibility).toBe('internal');
  });

  it('confirmOrderFileUpload : visibilite customer explicite acceptee (intention enregistree, capacite inexistante — decision #3)', async () => {
    const orderId = seedOrder();
    const ticket = await issueTicket(orderId);
    const response = await confirm(orderId, ticket, { visibility: 'customer' });
    const { data } = (await response.json()) as { data: OrderFileDto };
    expect(data.visibility).toBe('customer');
  });

  it('confirmOrderFileUpload : order_line_id valide sur CETTE commande accepte le rattachement', async () => {
    const lineId = fakeLineUuid();
    const orderId = seedOrder([lineId]);
    const ticket = await issueTicket(orderId);
    const response = await confirm(orderId, ticket, { order_line_id: lineId });
    await expectContract(response, { status: 201, dataSchema: 'OrderFile' });
    const { data } = (await response.json()) as { data: OrderFileDto };
    expect(data.order_line_id).toBe(lineId);
  });

  it('confirmOrderFileUpload : order_line_id d une AUTRE commande refuse -> 422 order_file.line_not_found (decision #11)', async () => {
    const foreignLineId = fakeLineUuid();
    seedOrder([foreignLineId]); // ligne existante, mais sur une AUTRE commande
    const orderId = seedOrder([]);

    const ticket = await issueTicket(orderId);
    const response = await confirm(orderId, ticket, { order_line_id: foreignLineId });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('order_file.line_not_found');
  });

  it('confirmOrderFileUpload : aucun objet depose -> 404 order_file.upload_missing', async () => {
    const orderId = seedOrder();
    const ticket = await issueTicket(orderId);
    // Pas de stageUploadForTest ici : aucun objet n a ete "depose".
    const response = await call(`/api/v1/commercial-orders/${orderId}/files`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ file_id: ticket.file_id, filename: 'bat.pdf' }),
    });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('order_file.upload_missing');
  });

  it('confirmOrderFileUpload : objet hors plafond de poids ou type refuse -> 422 order_file.rejected (defense en profondeur)', async () => {
    const orderId = seedOrder();
    const ticket = await issueTicket(orderId);
    repository.stageUploadForTest(ticket.file_id, { contentType: 'application/octet-stream', byteSize: 500 });

    const response = await call(`/api/v1/commercial-orders/${orderId}/files`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ file_id: ticket.file_id, filename: 'bat.pdf' }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('order_file.rejected');
  });

  it('confirmOrderFileUpload : commande introuvable dans le tenant -> 404 order.not_found', async () => {
    const orderId = seedOrder();
    const ticket = await issueTicket(orderId);
    repository.stageUploadForTest(ticket.file_id, { contentType: 'application/pdf', byteSize: 500 });

    const response = await call(`/api/v1/commercial-orders/${fakeOrderUuid()}/files`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ file_id: ticket.file_id, filename: 'bat.pdf' }),
    });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('order.not_found');
  });

  it('plafond de 30 fichiers vivants -> 409 order_file.limit_reached (verifie a issueOrderFileUploadUrl PAR COURTOISIE et a confirmOrderFileUpload SOUS VERROU), un fichier supprime ne compte plus', async () => {
    const orderId = seedOrder();
    const fileIds: string[] = [];
    for (let index = 0; index < 30; index += 1) {
      const ticket = await issueTicket(orderId);
      const response = await confirm(orderId, ticket, { filename: `f${index}.pdf` });
      const { data } = (await response.json()) as { data: OrderFileDto };
      fileIds.push(data.id);
    }

    // La barriere PAR COURTOISIE refuse deja a l emission du billet : inutile
    // de faire televerser 50 Mo pour rien.
    const refusedIssue = await call(`/api/v1/commercial-orders/${orderId}/file-upload-urls`, {
      method: 'POST',
      headers: asUser,
    });
    expect(refusedIssue.status).toBe(409);
    const refusedIssueBody = (await refusedIssue.json()) as { code: string };
    expect(refusedIssueBody.code).toBe('order_file.limit_reached');

    // Supprimer un fichier libere une place : un fichier supprime ne compte plus.
    const deleted = await call(`/api/v1/commercial-orders/${orderId}/files/${fileIds[0]}`, {
      method: 'DELETE',
      headers: asUser,
    });
    expect(deleted.status).toBe(204);

    const ticket31 = await issueTicket(orderId);
    const accepted = await confirm(orderId, ticket31, { filename: 'f30-bis.pdf' });
    await expectContract(accepted, { status: 201, dataSchema: 'OrderFile' });
  });

  it('confirmOrderFileUpload : plafond verifie AUSSI a la confirmation, meme si le billet a ete emis avant que la commande n atteigne 30 (barriere qui COMPTE)', async () => {
    const orderId = seedOrder();
    const tickets = [] as Awaited<ReturnType<typeof issueTicket>>[];
    // Emet les 31 billets d abord (tous acceptes : la commande est encore
    // sous le plafond a chaque emission), confirme ensuite un a un.
    for (let index = 0; index < 31; index += 1) {
      tickets.push(await issueTicket(orderId));
    }
    for (let index = 0; index < 30; index += 1) {
      const response = await confirm(orderId, tickets[index]!, { filename: `g${index}.pdf` });
      expect(response.status).toBe(201);
    }

    const refused = await confirm(orderId, tickets[30]!, { filename: 'g30.pdf' });
    expect(refused.status).toBe(409);
    const refusedBody = (await refused.json()) as { code: string };
    expect(refusedBody.code).toBe('order_file.limit_reached');
  });

  it('confirmOrderFileUpload : un file_id deja confirme -> 409 order_file.already_confirmed', async () => {
    const orderId = seedOrder();
    const ticket = await issueTicket(orderId);
    const first = await confirm(orderId, ticket);
    expect(first.status).toBe(201);

    repository.stageUploadForTest(ticket.file_id, { contentType: 'application/pdf', byteSize: 999 });
    const second = await call(`/api/v1/commercial-orders/${orderId}/files`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ file_id: ticket.file_id, filename: 'redepot.pdf' }),
    });
    expect(second.status).toBe(409);
    const body = (await second.json()) as { code: string };
    expect(body.code).toBe('order_file.already_confirmed');
  });

  it('getOrderFile : rend le fichier et son URL de telechargement signee (ETag), 404 sur un fichier inconnu ou supprime', async () => {
    const orderId = seedOrder();
    const ticket = await issueTicket(orderId);
    const confirmed = await confirm(orderId, ticket);
    const { data: file } = (await confirmed.json()) as { data: OrderFileDto };

    const response = await call(`/api/v1/commercial-orders/${orderId}/files/${file.id}`, { headers: asUser });
    await expectContract(response, { status: 200, dataSchema: 'OrderFileDetail' });
    expect(response.headers.get('etag')).toBeTruthy();
    const { data } = (await response.json()) as { data: OrderFileDetailDto };
    expect(data.download_url).toBeTruthy();
    expect(data.download_url_expires_at).toBeTruthy();

    const missing = await call(`/api/v1/commercial-orders/${orderId}/files/${fakeOrderFileUuid()}`, {
      headers: asUser,
    });
    expect(missing.status).toBe(404);
    const missingBody = (await missing.json()) as { code: string };
    expect(missingBody.code).toBe('order_file.not_found');

    const deleteResponse = await call(`/api/v1/commercial-orders/${orderId}/files/${file.id}`, {
      method: 'DELETE',
      headers: asUser,
    });
    expect(deleteResponse.status).toBe(204);

    const afterDelete = await call(`/api/v1/commercial-orders/${orderId}/files/${file.id}`, { headers: asUser });
    expect(afterDelete.status).toBe(404);
  });

  it('updateOrderFile : If-Match exige (428 si absent, 409 si perime), bascule la visibilite, ETag change', async () => {
    const orderId = seedOrder();
    const ticket = await issueTicket(orderId);
    const confirmed = await confirm(orderId, ticket);
    const { data: file } = (await confirmed.json()) as { data: OrderFileDto };

    const withoutIfMatch = await call(`/api/v1/commercial-orders/${orderId}/files/${file.id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ visibility: 'customer' }),
    });
    expect(withoutIfMatch.status).toBe(428);

    const staleIfMatch = await call(`/api/v1/commercial-orders/${orderId}/files/${file.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': '"perime"' },
      body: JSON.stringify({ visibility: 'customer' }),
    });
    expect(staleIfMatch.status).toBe(409);

    const fresh = await call(`/api/v1/commercial-orders/${orderId}/files/${file.id}`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const updated = await call(`/api/v1/commercial-orders/${orderId}/files/${file.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ visibility: 'customer' }),
    });
    await expectContract(updated, { status: 200, dataSchema: 'OrderFile' });
    const { data } = (await updated.json()) as { data: OrderFileDto };
    expect(data.visibility).toBe('customer');
    expect(updated.headers.get('etag')).not.toBe(etag);
  });

  it('updateOrderFile : 404 order_file.not_found sur un fichier supprime', async () => {
    const orderId = seedOrder();
    const ticket = await issueTicket(orderId);
    const confirmed = await confirm(orderId, ticket);
    const { data: file } = (await confirmed.json()) as { data: OrderFileDto };

    await call(`/api/v1/commercial-orders/${orderId}/files/${file.id}`, { method: 'DELETE', headers: asUser });

    const response = await call(`/api/v1/commercial-orders/${orderId}/files/${file.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': '"peu-importe"' },
      body: JSON.stringify({ visibility: 'customer' }),
    });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('order_file.not_found');
  });

  it('deleteOrderFile : 204 SANS CORPS, irreversible — rejouer la meme suppression rend 404 (jamais un second 204)', async () => {
    const orderId = seedOrder();
    const ticket = await issueTicket(orderId);
    const confirmed = await confirm(orderId, ticket);
    const { data: file } = (await confirmed.json()) as { data: OrderFileDto };

    const response = await call(`/api/v1/commercial-orders/${orderId}/files/${file.id}`, {
      method: 'DELETE',
      headers: asUser,
    });
    await expectContract(response, { status: 204 });
    expect(response.headers.get('content-length') === '0' || response.headers.get('content-length') === null).toBe(
      true,
    );

    const replayed = await call(`/api/v1/commercial-orders/${orderId}/files/${file.id}`, {
      method: 'DELETE',
      headers: asUser,
    });
    expect(replayed.status).toBe(404);
    const body = (await replayed.json()) as { code: string };
    expect(body.code).toBe('order_file.not_found');

    // Le fichier supprime disparait de la liste, mais n est jamais republie
    // (la trace vit en base, pas au contrat).
    const list = await call(`/api/v1/commercial-orders/${orderId}/files`, { headers: asUser });
    const { data: listData } = (await list.json()) as { data: OrderFileDto[] };
    expect(listData.find((f) => f.id === file.id)).toBeUndefined();
  });

  it('deleteOrderFile : 404 hors tenant/commande', async () => {
    const orderId = seedOrder();
    const response = await call(`/api/v1/commercial-orders/${orderId}/files/${fakeOrderFileUuid()}`, {
      method: 'DELETE',
      headers: asUser,
    });
    expect(response.status).toBe(404);
  });
});
