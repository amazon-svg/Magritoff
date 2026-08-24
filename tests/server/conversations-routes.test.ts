import { describe, expect, it } from 'vitest';
import { parseId } from '@/kernel/ids';
import { ConversationsApiClient } from '@/modules/conversations/api/client';
import { ConversationRejectedError, type ConversationsRepository } from '@/modules/conversations/application/conversations-repository';
import { ConversationsService } from '@/modules/conversations/application/conversations-service';
import { FetchApiClient } from '@/platform/api';
import { createApiV1Application } from '@/server/api/composition';
import { createConversationsRoutes } from '@/server/api/conversations-routes';

const parsed = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); if (!parsed.ok) throw new Error('actor');
const tenantId = '11111111-1111-4111-8111-111111111111';
const conversationId = 'conv-af17';
const conversation = { timestamp: 1_786_500_000_000, title: 'Flyers', messages: [{ role: 'user', content: '500 flyers' }], products: [{ id: 'flyer' }] };
function repository(overrides: Partial<ConversationsRepository> = {}): ConversationsRepository { return { async list() { return [{ id: conversationId, ...conversation }]; }, async save() {}, async remove() {}, ...overrides }; }
function handler(repo: ConversationsRepository) { return createApiV1Application({ routes: createConversationsRoutes(new ConversationsService(repo)), actorResolver: { async resolve() { return { kind: 'user', userId: parsed.value }; } }, requestIdFactory: () => 'conversations-test' }); }
function bridge(app: (request: Request) => Promise<Response>): typeof fetch { return ((input: RequestInfo | URL, init?: RequestInit) => app(new Request(input, init))) as typeof fetch; }

describe('routes API Conversations', () => {
  it('partage les contrats liste, sauvegarde et suppression avec le client', async () => {
    const calls: string[] = [];
    const repo = repository({
      async list(actor, tenant) { calls.push(`list:${actor}:${tenant}`); return [{ id: conversationId, ...conversation }]; },
      async save(actor, tenant, id) { calls.push(`save:${actor}:${tenant}:${id}`); },
      async remove(actor, tenant, id) { calls.push(`remove:${actor}:${tenant}:${id}`); },
    });
    const client = new ConversationsApiClient(new FetchApiClient('https://magrit.test', bridge(handler(repo)), () => 'token'));
    expect(await client.list(tenantId)).toEqual([{ id: conversationId, ...conversation }]);
    await client.save(tenantId, conversationId, conversation);
    await client.remove(tenantId, conversationId);
    expect(calls).toEqual([
      `list:${parsed.value}:${tenantId}`,
      `save:${parsed.value}:${tenantId}:${conversationId}`,
      `remove:${parsed.value}:${tenantId}:${conversationId}`,
    ]);
  });
  it('traduit une suppression hors périmètre en 404', async () => {
    const response = await handler(repository({ async remove() { throw new ConversationRejectedError('not_found', 'absente'); } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/conversations/${conversationId}`, { method: 'DELETE' }));
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('conversations.not_found');
  });
  it('valide le payload avant le repository', async () => {
    let called = false;
    const response = await handler(repository({ async save() { called = true; } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/conversations/${conversationId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timestamp: -1, title: 'x', messages: [], products: [] }) }));
    expect(response.status).toBe(422);
    expect(called).toBe(false);
  });
});
