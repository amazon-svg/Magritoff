import { describe, expect, it } from 'vitest';
import { parseId } from '../../src/kernel/ids';
import { CatalogService } from '../../src/modules/catalog/application/catalog-service';
import { CatalogRejectedError, type CatalogRepository } from '../../src/modules/catalog/application/catalog-repository';
import { createApiV1Application } from '../../src/server/api/composition';
import { createCatalogRoutes } from '../../src/server/api/catalog-routes';

const parsedActor = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
if (!parsedActor.ok) throw new Error('acteur invalide');
const tenantId = '11111111-1111-4111-8111-111111111111';
const subscriptions = [{ gammeSlug: 'flyers', active: true, displayOrder: 0 }];
function repository(overrides: Partial<CatalogRepository> = {}): CatalogRepository { return { async gammeSubscriptions() { return subscriptions; }, async setGammeSubscriptions() { return subscriptions; }, ...overrides }; }
function handler(repo: CatalogRepository) { return createApiV1Application({ routes: createCatalogRoutes(new CatalogService(repo)), actorResolver: { async resolve() { return { kind: 'user', userId: parsedActor.value }; } }, requestIdFactory: () => 'catalog-test' }); }

describe('routes API catalogue', () => {
  it('dérive acteur et tenant lors d’un changement groupé', async () => {
    let received: { actor: string; tenant: string; slugs: string[] } | null = null;
    const response = await handler(repository({ async setGammeSubscriptions(actor, tenant, command) { received = { actor, tenant, slugs: command.subscriptions.map((item) => item.gammeSlug) }; return subscriptions; } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/catalog/gamme-subscriptions`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: 'forged', subscriptions: [{ gammeSlug: 'flyers', active: true }, { gammeSlug: 'brochures', active: true }] }) }));
    expect(response.status).toBe(200);
    expect(received).toEqual({ actor: parsedActor.value, tenant: tenantId, slugs: ['flyers', 'brochures'] });
  });
  it('traduit un refus RLS en 403 contractuel', async () => {
    const response = await handler(repository({ async gammeSubscriptions() { throw new CatalogRejectedError('permission_denied', 'accès refusé'); } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/catalog/gamme-subscriptions`));
    expect(response.status).toBe(403); expect((await response.json()).code).toBe('catalog.permission_denied');
  });
  it('refuse les doublons avant le repository', async () => {
    const response = await handler(repository())(new Request(`http://localhost/api/v1/tenants/${tenantId}/catalog/gamme-subscriptions`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriptions: [{ gammeSlug: 'flyers', active: true }, { gammeSlug: 'flyers', active: false }] }) }));
    expect(response.status).toBe(422); expect((await response.json()).code).toBe('api.validation_failed');
  });
});
