import { describe, expect, it } from 'vitest';
import { parseId } from '../../src/kernel/ids';
import { QuotesApiClient } from '../../src/modules/quotes/api/client';
import type { CreateQuoteDraft } from '../../src/modules/quotes/api/contracts';
import { QuoteRejectedError, type QuotesRepository } from '../../src/modules/quotes/application/quotes-repository';
import { QuotesService } from '../../src/modules/quotes/application/quotes-service';
import { FetchApiClient } from '../../src/platform/api';
import { createApiV1Application } from '../../src/server/api/composition';
import { createQuotesRoutes } from '../../src/server/api/quotes-routes';

const parsedActor = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
if (!parsedActor.ok) throw new Error('acteur invalide');
const tenantId = '11111111-1111-4111-8111-111111111111';
const command: CreateQuoteDraft = { reference: 'DEV-2026-1', productName: 'Flyer', productConfig: { quantity: 500 }, totalHt: 100, totalTtc: 120 };
function app(repository: QuotesRepository) { return createApiV1Application({ routes: createQuotesRoutes(new QuotesService(repository)), actorResolver: { async resolve() { return { kind: 'user', userId: parsedActor.value }; } }, requestIdFactory: () => 'quotes-test' }); }
function bridge(handler: (request: Request) => Promise<Response>): typeof fetch { return ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch; }

describe('route API Quotes', () => {
  it('dérive l auteur du bearer et partage le contrat avec le client', async () => {
    const calls: unknown[][] = [];
    const repository: QuotesRepository = { async createDraft(...args) { calls.push(args); return { id: 'quote-1' }; } };
    const client = new QuotesApiClient(new FetchApiClient('https://magrit.test', bridge(app(repository)), () => 'token'));
    expect(await client.createDraft(tenantId, command)).toEqual({ id: 'quote-1' });
    expect(calls).toEqual([[parsedActor.value, tenantId, command]]);
  });

  it('rejette le userId injecté et les montants négatifs avant le repository', async () => {
    let called = false;
    const response = await app({ async createDraft() { called = true; return { id: 'x' }; } })(new Request(`http://localhost/api/v1/tenants/${tenantId}/quotes/drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...command, userId: 'victim', totalHt: -1 }) }));
    expect(response.status).toBe(422);
    expect(called).toBe(false);
  });

  it('traduit un refus RLS en 403', async () => {
    const response = await app({ async createDraft() { throw new QuoteRejectedError('permission_denied', 'interdit'); } })(new Request(`http://localhost/api/v1/tenants/${tenantId}/quotes/drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) }));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('quotes.permission_denied');
  });
});
