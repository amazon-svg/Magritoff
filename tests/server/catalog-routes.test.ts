import { describe, expect, it } from 'vitest';
import { parseId } from '@/kernel/ids';
import { CatalogService } from '@/modules/catalog/application/catalog-service';
import { CatalogRejectedError, type CatalogAutomationGateway, type CatalogRepository } from '@/modules/catalog/application/catalog-repository';
import { createApiV1Application } from '@/server/api/composition';
import { createCatalogRoutes } from '@/server/api/catalog-routes';

const parsedActor = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
if (!parsedActor.ok) throw new Error('acteur invalide');
const tenantId = '11111111-1111-4111-8111-111111111111';
const subscriptions = [{ gammeSlug: 'flyers', active: true, displayOrder: 0 }];
const gamme = { id: '22222222-2222-4222-8222-222222222222', slug: 'flyers', name: 'Flyers', parentSlug: null, matchingRules: {}, displayOrder: 0, imageUrl: null };
const definition = { id: '33333333-3333-4333-8333-333333333333', gammeSlug: 'flyers', variationFilter: {}, locale: 'fr', name: null, keywords: null, titleTemplate: null, shortDescriptionTemplate: null, descriptionTemplate: null, h1Template: null, seoTitle: null, seoDescription: null, schemaOrgType: null, usageExamples: [], faq: [], qualityScore: null, generatedBy: null, validatedBy: 'pending' as const, imageUrl: null, commercialPitch: null, benefits: null, useCases: null, technicalSpec: null, lastReviewedAt: null, version: 1 };
function repository(overrides: Partial<CatalogRepository> = {}): CatalogRepository { return { async gammeSubscriptions() { return subscriptions; }, async setGammeSubscriptions() { return subscriptions; }, async pimCatalog() { return { gammes: [gamme], definitions: [definition] }; }, async upsertPimGamme() { return gamme; }, async deletePimGamme() {}, async upsertPimDefinition() { return definition; }, async deletePimDefinition() {}, async assertPimAdmin() {}, ...overrides }; }
function automation(overrides: Partial<CatalogAutomationGateway> = {}): CatalogAutomationGateway { return { async pendingCandidates() { return 3; }, async runIngest(command) { return { dryRun: command.dryRun, totalCandidates: 0, matched: [], rejected: [], enriched: [], errors: [] }; }, async generateDefinition() { return { name: 'Flyer' }; }, ...overrides }; }
function handler(repo: CatalogRepository, gateway = automation()) { return createApiV1Application({ routes: createCatalogRoutes(new CatalogService(repo, gateway)), actorResolver: { async resolve() { return { kind: 'user', userId: parsedActor.value }; } }, requestIdFactory: () => 'catalog-test' }); }

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
  it('dérive l’acteur et impose le slug de route pour une gamme PIM', async () => {
    let received: { actor: string; slug: string } | null = null;
    const response = await handler(repository({ async upsertPimGamme(actor, command) { received = { actor, slug: command.slug }; return { ...gamme, slug: command.slug }; } }))(new Request('http://localhost/api/v1/catalog/pim/gammes/flyers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: 'forged', name: 'Flyers' }) }));
    expect(response.status).toBe(200); expect(received).toEqual({ actor: parsedActor.value, slug: 'flyers' });
  });
  it('valide l’identifiant avant de supprimer une définition PIM', async () => {
    const response = await handler(repository())(new Request('http://localhost/api/v1/catalog/pim/definitions/not-a-uuid', { method: 'DELETE' }));
    expect(response.status).toBe(422); expect((await response.json()).code).toBe('api.validation_failed');
  });
  it('protège et délègue l’ingestion PIM côté serveur', async () => {
    let checkedActor = ''; let receivedDryRun: boolean | null = null;
    const response = await handler(
      repository({ async assertPimAdmin(actor) { checkedActor = actor; } }),
      automation({ async runIngest(command) { receivedDryRun = command.dryRun; return { dryRun: command.dryRun, totalCandidates: 1, matched: [], rejected: [], enriched: [], errors: [] }; } }),
    )(new Request('http://localhost/api/v1/catalog/pim/ingestion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: true }) }));
    expect(response.status).toBe(200); expect(checkedActor).toBe(parsedActor.value); expect(receivedDryRun).toBe(true);
  });
  it('traduit une panne de génération PIM en 502 contractuel', async () => {
    const response = await handler(repository(), automation({ async generateDefinition() { throw new CatalogRejectedError('upstream_error', 'LLM indisponible'); } }))(
      new Request('http://localhost/api/v1/catalog/pim/generation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gammeSlug: 'flyers', locale: 'fr' }) }),
    );
    expect(response.status).toBe(502); expect((await response.json()).code).toBe('catalog.upstream_error');
  });
});
