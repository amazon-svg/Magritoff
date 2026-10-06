import { beforeEach, describe, expect, it } from 'vitest';
import type { TenantId, UserId } from '@/kernel/ids';
import { InMemoryIdempotencyStore, type ApiPrincipal } from '@/modules/_shared/application';
import { OrderExportsService } from '@/modules/order-exports/application/order-exports-service';
import { createOrderExportsRoutes } from '@/server/api/order-exports-routes';
import { createGescomApiHandler } from '@/server/api';
import { InMemoryOrderExportsRepository } from './_fakes/order-exports-repository.fake';
import type { CustomersService } from '@/modules/customers/application/customers-service';
import type { CommercialQuotesService } from '@/modules/commercial-quotes/application/commercial-quotes-service';
import type { ProductionStepsService } from '@/modules/production-steps/application/production-steps-service';
import { checkAgainstSchema, checkResponseAgainstContract } from './_harness';

const tenantId = '00000000-0000-4000-9000-000000000001' as TenantId;
const actor = '00000000-0000-4000-9000-000000000002' as UserId;
let repository: InMemoryOrderExportsRepository;
let handler: (request: Request) => Promise<Response>;
let principal: ApiPrincipal;
beforeEach(() => {
  principal = { kind: 'user', tenantId, userId: actor };
  repository = new InMemoryOrderExportsRepository();
  handler = createGescomApiHandler({
    routes: createOrderExportsRoutes(new OrderExportsService({ repository }), {} as CustomersService,
      {} as CommercialQuotesService, {} as ProductionStepsService, true),
    principalVerifier: { verify: async () => principal }, idempotencyStore: new InMemoryIdempotencyStore(),
  });
});
const headers = { Authorization: 'Bearer test', 'Content-Type': 'application/json', 'Idempotency-Key': 'unified-export-test' };
const call = (path: string, init: RequestInit = {}) => handler(new Request(`https://magrit.test/api/v1/order-exports${path}`, { headers, ...init }));
const request = (filters: unknown = {}) => call('', { method: 'POST', body: JSON.stringify({ format: 'csv', granularity: 'order', filters }) });

describe('exports communs E4.4b', () => {
  it('conserve exactement les filtres appliqués, la version 2 et l’idempotence', async () => {
    const filters = { origin: 'storefront', status: 'draft', customer_search: 'Jean', shop_id: tenantId,
      customer_id: actor, quote_id: tenantId, current_production_step_id: actor,
      created_from: '2026-10-05', created_to: '2026-10-05' };
    const response = await request(filters);
    expect(response.status).toBe(201);
    expect(response.headers.get('deprecation')).toBeNull();
    expect(await checkResponseAgainstContract(response, { status: 201 })).toEqual({ valid: true, errors: [] });
    const { data } = await response.json();
    expect(data).toMatchObject({ layout_version: 2, filters, status: 'pending', requested_by: actor });
    expect(checkAgainstSchema('OrderExport', data)).toEqual({ valid: true, errors: [] });
    expect((await (await request(filters)).json()).data.id).toBe(data.id);
    const listed = await call('');
    expect(listed.status).toBe(200);
    expect(listed.headers.get('deprecation')).toBeNull();
    expect((await listed.json()).data).toHaveLength(1);
    expect((await (await call(`/${data.id}`)).json()).data.filters).toEqual(filters);
  });
  it.each([{ origin: 'bad' }, { status: 'bad' }, { shop_id: 'bad' }, { customer_search: ' ' },
    { quote_id: 'bad' }, { created_from: '2026-02-30' }, { created_from: '2026-10-06', created_to: '2026-10-05' }])(
    'refuse des filtres invalides sans créer de demande (%j)', async (filters) => {
      expect((await request(filters)).status).toBe(422);
      expect((await (await call('')).json()).data).toEqual([]);
    });
  it('garde can_export_orders pour demande, registre et téléchargement', async () => {
    repository.setActorCapabilityForTest(tenantId, actor, 'can_export_orders', false);
    expect((await request()).status).toBe(403);
    expect((await call('')).status).toBe(403);
    expect((await call(`/${actor}`)).status).toBe(403);
  });
  it('refuse les clés de service', async () => {
    principal = { kind: 'service', tenantId, serviceId: 'studio', scopes: ['orders:read'] };
    expect((await call('', { headers: { 'X-Magrit-Service-Key': 'test' } })).status).toBe(403);
  });
  it('supprime uniquement un export terminé appartenant au demandeur', async () => {
    const exportId = '00000000-0000-4000-9500-000000000099';
    repository.seedForTest({ id: exportId, tenant_id: tenantId, requested_by: actor, status: 'ready' });
    const removed = await call(`/${exportId}`, { method: 'DELETE' });
    expect(removed.status).toBe(204);
    expect(await checkResponseAgainstContract(removed, { status: 204 })).toEqual({ valid: true, errors: [] });
    expect((await call(`/${exportId}`)).status).toBe(404);
  });
  it('refuse la suppression tant que la génération est en cours', async () => {
    const created = await request();
    const { data } = await created.json();
    const response = await call(`/${data.id}`, { method: 'DELETE' });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('order_export.in_progress');
  });
});
