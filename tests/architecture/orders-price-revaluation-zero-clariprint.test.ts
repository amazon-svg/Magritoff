/**
 * Q17-a (docs/api/CONVENTIONS.md §8.25 point 12 (k), point 12 (j) "critère de
 * recette zéro appel facturé") — le recalcul serveur du prix d une commande
 * boutique n appelle JAMAIS Clariprint : « Le serveur n emprunte PAS
 * `estimateMarketPriceHT`. [...] Le serveur connaît (b), ou il ne connaît
 * rien » (point 12 (b)).
 *
 * Deux preuves complémentaires, pas une seule :
 *   1. STATIQUE — aucun fichier du chemin de code (migration SQL, adaptateur
 *      Supabase, service applicatif, routes) ne référence Clariprint ni un
 *      mécanisme d appel HTTP sortant (`pg_net`, `net.http_*`, `fetch`,
 *      `FetchApiClient`, `ClariprintAdapter`). Un test serveur seul ne
 *      prouverait que le câblage (leçon m5, §8.3) — la preuve SQL est ici
 *      la lecture directe du texte de la migration.
 *   2. DYNAMIQUE — `OrdersService.create` / `.updateDraft` / `.transition`
 *      exécutés de bout en bout (avec un faux repository, sans réseau)
 *      pendant qu un espion `fetch` global est posé : zéro appel, sur les
 *      trois opérations du cycle de vie visées par ce lot.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseId, type UserId } from '@/kernel';
import { OrdersService, type OrdersRepository } from '@/modules/orders';

const root = process.cwd();

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

/**
 * `clariprint_options`/`clariprint_config` sont des noms de COLONNES/CHAMPS
 * légitimes (le snapshot des options envoyé par l acheteur, préexistant à ce
 * lot) : les exclure du grep évite un faux positif qui ne prouverait rien.
 * Ce que ce test cherche, c est un APPELANT de Clariprint : le module
 * `clariprint`, ses adaptateurs, ou un mécanisme d appel sortant.
 */
const CLARIPRINT_OPTIONS_FIELD = /clariprint[_-]?options/gi;
const CLARIPRINT_CONFIG_FIELD = /clariprint[_-]?config/gi;

function withoutLegitimateFieldNames(source: string): string {
  return source
    .replace(CLARIPRINT_OPTIONS_FIELD, '')
    .replace(CLARIPRINT_CONFIG_FIELD, '');
}

const FORBIDDEN_TOKENS = [
  'clariprint',
  'Clariprint',
  'pg_net',
  'net.http_',
  'fetch(',
  'FetchApiClient',
] as const;

describe('Q17-a — zéro appel Clariprint sur le chemin du recalcul serveur', () => {
  it('la migration SQL du recalcul ne référence aucun mécanisme d appel sortant', () => {
    const migration = withoutLegitimateFieldNames(read(
      'supabase/migrations/20260919000100_gescom_q17a_storefront_order_price_revaluation.sql',
    ));
    for (const token of ['pg_net', 'net.http_', 'clariprint', 'Clariprint', 'http_post']) {
      expect(migration, `la migration Q17-a contient "${token}" hors clariprint_options/config`).not.toContain(token);
    }
  });

  it('l adaptateur Supabase Orders ne référence ni Clariprint ni un client HTTP', () => {
    const adapter = withoutLegitimateFieldNames(read('src/adapters/supabase/orders-repository.ts'));
    for (const token of FORBIDDEN_TOKENS) {
      expect(adapter, `orders-repository.ts (adapter) contient "${token}"`).not.toContain(token);
    }
  });

  it('le service applicatif Orders ne référence ni Clariprint ni un client HTTP', () => {
    const service = withoutLegitimateFieldNames(read('src/modules/orders/application/orders-service.ts'));
    for (const token of FORBIDDEN_TOKENS) {
      expect(service, `orders-service.ts contient "${token}"`).not.toContain(token);
    }
  });

  it('les routes Orders ne référencent ni Clariprint ni un client HTTP', () => {
    const routes = withoutLegitimateFieldNames(read('src/server/api/orders-routes.ts'));
    for (const token of FORBIDDEN_TOKENS) {
      expect(routes, `orders-routes.ts contient "${token}"`).not.toContain(token);
    }
  });

  describe('preuve dynamique — fetch espionné pendant tout le cycle de vie', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('création, modification et transition d une commande n appellent jamais fetch', async () => {
      const fetchSpy = vi.fn(async () => {
        throw new Error('fetch ne doit jamais être appelé par le chemin de recalcul Q17-a');
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const repository = fakeRepository();
      const service = new OrdersService(repository);

      await service.create({
        shopId: '11111111-1111-4111-8111-111111111111',
        currency: 'EUR', notes: '', idempotencyKey: 'q17a-zero-clariprint-create',
        items: [{
          productId: null, productLabel: 'Flyers', clariprintOptions: null,
          quantity: 1, expectedUnitPriceHt: '12.00',
        }],
      }, 'https://magrit.test');

      await service.updateDraft('22222222-2222-4222-8222-222222222222', {
        items: [{
          id: '44444444-4444-4444-8444-444444444444',
          productLabel: 'Flyers', quantity: 1, expectedUnitPriceHt: '12.00',
        }],
        idempotencyKey: 'q17a-zero-clariprint-update',
      });

      await service.transition('22222222-2222-4222-8222-222222222222', {
        toStatus: 'validated', reason: null, idempotencyKey: 'q17a-zero-clariprint-transition',
        acknowledgeUnverifiedPrices: true,
      }, { storefrontToken: null, magritUserId: id('user-q17a') }, 'https://magrit.test');

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});

function fakeRepository(): OrdersRepository {
  return {
    getTenantTaxRegime: async () => 'metropole_fr',
    getShopTaxRegime: async () => 'metropole_fr',
    listTenantOrders: async () => [],
    listTenantOrdersByIds: async () => [],
    listLegacyOrders: async () => [],
    getPortalCounters: async () => ({ mine: 0, to_validate: 0, to_approve: 0, to_produce: 0 }),
    getPortalOrderIds: async () => [],
    getAuthenticatedUserEmail: async () => null,
    getStorefrontPortalOrders: async () => ({ orders: [], taxRegime: null }),
    listAuditEvents: async () => [],
    transitionOrder: async (orderId, command) => ({
      orderId, fromStatus: 'draft', toStatus: command.toStatus, replayed: false,
    }),
    notifyTransition: async () => undefined,
    createOrder: async (command) => ({
      orderId: '22222222-2222-4222-8222-222222222222',
      tenantId: '33333333-3333-4333-8333-333333333333',
      shopId: command.shopId,
      totalHt: command.items.reduce((sum, item) => sum + item.quantity * Number(item.expectedUnitPriceHt), 0).toFixed(2),
      currency: command.currency,
      replayed: false,
    }),
    notifyOrderCreated: async () => undefined,
    getDraftOrder: async (orderId) => ({
      orderId, status: 'draft', createdAt: '2026-09-19T00:00:00.000Z', totalHt: '12.00',
      hasUnverifiedPrices: false,
      items: [{
        id: '44444444-4444-4444-8444-444444444444', productId: null,
        productLabel: 'Flyers', clariprintOptions: null, quantity: 1,
        unitPriceHt: '12.00', lineTotalHt: '12.00', priceOrigin: 'client_unverified',
      }],
    }),
    updateDraftOrder: async (orderId, command) => ({
      orderId,
      totalHt: command.items.reduce((sum, item) => sum + item.quantity * Number(item.expectedUnitPriceHt), 0).toFixed(2),
      replayed: false,
    }),
    getOrderRoles: async () => ({
      roles: [], isCreator: true,
      capabilities: {
        can_quote: false, can_order: true, can_invite: false, can_validate: true,
        can_cancel: false, can_modify: false, can_export: false,
        can_manage_catalog: false, can_manage_roles: false,
      },
    }),
  };
}

function id(value: string): UserId {
  const parsed = parseId<'UserId'>(value);
  if (!parsed.ok) throw new Error('ID invalide');
  return parsed.value;
}
