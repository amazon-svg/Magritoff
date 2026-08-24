import { describe, expect, it } from 'vitest';
import { parseId } from '@/kernel/ids';
import { QuotesApiClient } from '@/modules/quotes/api/client';
import type { CreateEditableQuote, CreateQuoteDraft, QuoteRecord } from '@/modules/quotes/api/contracts';
import { QuoteRejectedError, type QuotesRepository } from '@/modules/quotes/application/quotes-repository';
import { QuotesService } from '@/modules/quotes/application/quotes-service';
import { FetchApiClient } from '@/platform/api';
import { createApiV1Application } from '@/server/api/composition';
import { createQuotesRoutes } from '@/server/api/quotes-routes';

const parsedActor = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
if (!parsedActor.ok) throw new Error('acteur invalide');
const tenantId = '11111111-1111-4111-8111-111111111111';
const command: CreateQuoteDraft = { reference: 'DEV-2026-1', productName: 'Flyer', productConfig: { quantity: 500 }, totalHt: 100, totalTtc: 120 };
const record: QuoteRecord = { id: 'quote-1', user_id: parsedActor.value, tenant_id: tenantId, reference: command.reference, product_name: 'Flyer', client_name: null, status: 'draft', total_ht: 100, total_ttc: 120, created_at: '2026-08-12T12:00:00Z', updated_at: '2026-08-12T12:00:00Z' };
const line = { id: 'line-1', quote_id: record.id, product_name: 'Flyer', product_config: {}, quantity: 1, unit_cost_ht: 100, unit_price_ht: 100, margin_pct: 0, line_total_ht: 100, position: 0 };
function repository(overrides: Partial<QuotesRepository> = {}): QuotesRepository { return { async createDraft() { return { id: record.id }; }, async list() { return [record]; }, async get() { return { ...record, lines: [line] }; }, async create() { return { id: record.id }; }, async save() {}, async setStatus() {}, async remove() {}, async duplicate() { return { id: 'quote-copy' }; }, ...overrides }; }
function app(repository: QuotesRepository) { return createApiV1Application({ routes: createQuotesRoutes(new QuotesService(repository)), actorResolver: { async resolve() { return { kind: 'user', userId: parsedActor.value }; } }, requestIdFactory: () => 'quotes-test' }); }
function bridge(handler: (request: Request) => Promise<Response>): typeof fetch { return ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch; }

describe('route API Quotes', () => {
  it('dérive l auteur du bearer et partage le contrat avec le client', async () => {
    const calls: unknown[][] = [];
    const repo = repository({ async createDraft(...args) { calls.push(args); return { id: 'quote-1' }; } });
    const client = new QuotesApiClient(new FetchApiClient('https://magrit.test', bridge(app(repo)), () => 'token'));
    expect(await client.createDraft(tenantId, command)).toEqual({ id: 'quote-1' });
    expect(calls).toEqual([[parsedActor.value, tenantId, command]]);
  });

  it('rejette le userId injecté et les montants négatifs avant le repository', async () => {
    let called = false;
    const response = await app(repository({ async createDraft() { called = true; return { id: 'x' }; } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/quotes/drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...command, userId: 'victim', totalHt: -1 }) }));
    expect(response.status).toBe(422);
    expect(called).toBe(false);
  });

  it('traduit un refus RLS en 403', async () => {
    const response = await app(repository({ async createDraft() { throw new QuoteRejectedError('permission_denied', 'interdit'); } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/quotes/drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) }));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('quotes.permission_denied');
  });

  it('partage le CRUD éditable complet avec le client', async () => {
    const calls: string[] = [];
    const repo = repository({
      async list(_actor, _tenant, scope) { calls.push(`list:${scope}`); return [record]; },
      async get() { calls.push('get'); return { ...record, lines: [line] }; },
      async create() { calls.push('create'); return { id: record.id }; },
      async save() { calls.push('save'); }, async setStatus() { calls.push('status'); }, async remove() { calls.push('remove'); },
      async duplicate() { calls.push('duplicate'); return { id: 'quote-copy' }; },
    });
    const client = new QuotesApiClient(new FetchApiClient('https://magrit.test', bridge(app(repo)), () => 'token'));
    const editable: CreateEditableQuote = { reference: record.reference, productName: record.product_name, clientName: null, totalHt: 100, totalTtc: 120, lines: [{ product_name: line.product_name, product_config: line.product_config, quantity: line.quantity, unit_cost_ht: line.unit_cost_ht, unit_price_ht: line.unit_price_ht, margin_pct: line.margin_pct, line_total_ht: line.line_total_ht, position: line.position }] };
    expect(await client.list(tenantId, 'mine')).toEqual([record]);
    expect(await client.get(tenantId, record.id)).toEqual({ ...record, lines: [line] });
    expect(await client.create(tenantId, editable)).toEqual({ id: record.id });
    await client.save(tenantId, record.id, { totalHt: 100, totalTtc: 120, lines: editable.lines });
    await client.setStatus(tenantId, record.id, 'sent');
    await client.remove(tenantId, record.id);
    expect(await client.duplicate(tenantId, record.id, 'DEV-COPY')).toEqual({ id: 'quote-copy' });
    expect(calls).toEqual(['list:mine', 'get', 'create', 'save', 'status', 'remove', 'duplicate']);
  });
});
