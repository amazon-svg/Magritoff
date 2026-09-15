/**
 * DEFAUT R2, recette navigateur (2026-09-15) — `POST /commercial-order-
 * exports` au-dela de trois demandes non terminees renvoyait un `detail` 422
 * qui recopiait le message SQL BRUT (`order_export.pending_limit_reached:
 * trois demandes non terminees deja en file pour cet acteur`), code
 * technique et `_` compris. Ce test exerce la ROUTE REELLE
 * (`createOrderExportsRoutes`) au-dessus du REPOSITORY REEL
 * (`SupabaseOrderExportsRepository`), avec un faux client Supabase qui rend
 * l EXACTE erreur SQL de la migration `20260913000000_gescom_e10_18c_
 * order_exports.sql` (`raise exception 'order_export.pending_limit_reached:
 * trois demandes non terminees deja en file pour cet acteur'`) — pas une
 * erreur fabriquee de toutes pieces, pour que ce test tombe reellement en
 * rouge sur le code d avant ce correctif (`mapRequestOrderExportError`
 * recopiait ce message dans le constructeur de l erreur, qui devenait alors
 * `.message`, puis `detail` a la route).
 *
 * Regle opposable (contrat §8.24 point 8) : « le "trois" vient du serveur,
 * via `detail` » — jamais le code, jamais un `_`.
 */
import { describe, expect, it } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import { InMemoryIdempotencyStore, type ApiPrincipal, type PrincipalVerifier } from '@/modules/_shared/application';
import { OrderExportsService } from '@/modules/order-exports/application/order-exports-service';
import { CustomersService } from '@/modules/customers/application/customers-service';
import { CommercialQuotesService } from '@/modules/commercial-quotes/application/commercial-quotes-service';
import { ProductionStepsService } from '@/modules/production-steps/application/production-steps-service';
import { createOrderExportsRoutes } from '@/server/api/order-exports-routes';
import { createGescomApiHandler } from '@/server/api';
import { SupabaseOrderExportsRepository } from '@/adapters/supabase/order-exports-repository';
import { InMemoryCustomersRepository } from '../../contract/_fakes/customers-repository.fake';
import { InMemoryCommercialQuotesRepository } from '../../contract/_fakes/commercial-quotes-repository.fake';
import { InMemoryProductionStepsRepository } from '../../contract/_fakes/production-steps-repository.fake';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f');

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

const userPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: USER, tenantId: TENANT });

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer' && credential.token === 'jeton-valide') return userPrincipal;
    return null;
  },
};

/**
 * Reproduit EXACTEMENT le message rendu par la fonction SQL
 * `api_request_order_export` (migration `20260913000000`, l.516) — ni plus
 * ni moins, pour ne pas fabriquer artificiellement le defaut.
 */
const RAW_SQL_ERROR_MESSAGE = 'order_export.pending_limit_reached: trois demandes non terminees deja en file pour cet acteur';

/** Faux client Supabase minimal : capability toujours accordee, RPC de demande TOUJOURS en echec de plafond. */
function fakeSupabaseClient() {
  return {
    rpc: async (fn: string, _params: unknown) => {
      if (fn === 'user_has_capability') return { data: true, error: null };
      if (fn === 'api_request_order_export') return { data: null, error: { message: RAW_SQL_ERROR_MESSAGE } };
      throw new Error(`rpc inattendu dans ce faux: ${fn}`);
    },
  };
}

function buildHandler(): (request: Request) => Promise<Response> {
  const repository = new SupabaseOrderExportsRepository(fakeSupabaseClient() as any, {} as any);
  const service = new OrderExportsService({ repository });
  const customers = new CustomersService({ repository: new InMemoryCustomersRepository() });
  const commercialQuotes = new CommercialQuotesService({
    repository: new InMemoryCommercialQuotesRepository(),
    outbox: { publish: async () => {} } as any,
    projects: { findById: async () => null } as any,
    priceRules: {} as any,
    pricingEngine: {} as any,
    documents: {} as any,
  });
  const productionSteps = new ProductionStepsService({ repository: new InMemoryProductionStepsRepository() });

  return createGescomApiHandler({
    routes: createOrderExportsRoutes(service, customers, commercialQuotes, productionSteps),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-r2-defaut',
  });
}

describe('POST /commercial-order-exports — DEFAUT R2, recette navigateur 2026-09-15', () => {
  it('le detail du 422 order_export.pending_limit_reached ne recopie PAS le message SQL brut : ni code, ni "_", et contient "trois"', async () => {
    const handler = buildHandler();

    const response = await handler(
      new Request('https://magrit.test/api/v1/commercial-order-exports', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer jeton-valide',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-r2-defaut-000001',
        },
        body: JSON.stringify({ format: 'csv', granularity: 'order' }),
      }),
    );

    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string; title: string; detail?: string };
    expect(body.code).toBe('order_export.pending_limit_reached');
    expect(body.title).toBe('Trop de demandes en file');
    // AVANT ce correctif : `detail` valait RAW_SQL_ERROR_MESSAGE tel quel,
    // donc contenait `order_export.` ET `_`.
    expect(body.detail).toBeDefined();
    expect(body.detail).not.toContain('order_export.');
    expect(body.detail).not.toMatch(/_/);
    expect(body.detail!.toLowerCase()).toContain('trois');
  });
});
