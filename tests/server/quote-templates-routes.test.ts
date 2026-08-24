import { describe, expect, it } from 'vitest';
import { parseId } from '@/kernel/ids';
import { QuoteTemplatesApiClient } from '@/modules/quote-templates/api/client';
import type { QuoteTemplatesRepository } from '@/modules/quote-templates/application/quote-templates-repository';
import { QuoteTemplatesService } from '@/modules/quote-templates/application/quote-templates-service';
import { FetchApiClient } from '@/platform/api';
import { createApiV1Application } from '@/server/api/composition';
import { createQuoteTemplatesRoutes } from '@/server/api/quote-templates-routes';
const actor = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); if (!actor.ok) throw new Error('actor');
const tenant = '11111111-1111-4111-8111-111111111111';
const template = { id: 'template-1', builtin: false as const, name: 'Atelier', style: 'custom' as const };
function repo(overrides: Partial<QuoteTemplatesRepository> = {}): QuoteTemplatesRepository { return { async overview() { return { templates: [template], defaultTemplateId: template.id }; }, async create() { return template; }, async update() {}, async remove() {}, async setDefault() {}, ...overrides }; }
function app(repository: QuoteTemplatesRepository) { return createApiV1Application({ routes: createQuoteTemplatesRoutes(new QuoteTemplatesService(repository)), actorResolver: { async resolve() { return { kind: 'user', userId: actor.value }; } }, requestIdFactory: () => 'templates-test' }); }
function bridge(handler: (request: Request) => Promise<Response>): typeof fetch { return ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch; }
describe('routes API QuoteTemplates', () => {
  it('partage lecture et mutations avec le client', async () => {
    const calls: string[] = []; const repository = repo({ async create() { calls.push('create'); return template; }, async update() { calls.push('update'); }, async remove() { calls.push('remove'); }, async setDefault() { calls.push('default'); } });
    const client = new QuoteTemplatesApiClient(new FetchApiClient('https://magrit.test', bridge(app(repository)), () => 'token'));
    expect(await client.overview(tenant)).toEqual({ templates: [template], defaultTemplateId: template.id });
    expect(await client.create(tenant, { name: 'Atelier' })).toEqual(template);
    await client.update(tenant, template.id, { name: 'Atelier 2' }); await client.setDefault(tenant, template.id); await client.remove(tenant, template.id);
    expect(calls).toEqual(['create', 'update', 'default', 'remove']);
  });
});
