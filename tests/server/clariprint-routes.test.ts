import { describe, expect, it } from 'vitest';
import { ClariprintApiClient } from '@/modules/clariprint/api/client';
import {
  ClariprintQuoteBudgetUnavailableError,
  type ClariprintQuoteBudget,
  type ClariprintQuoteBudgetDecision,
  type ClariprintQuoteCaller,
} from '@/modules/clariprint/application/clariprint-quote-budget';
import type { ClariprintQuoteGateway } from '@/modules/clariprint/application/clariprint-quote-gateway';
import { ClariprintService } from '@/modules/clariprint/application/clariprint-service';
import { FetchApiClient } from '@/platform/api';
import { createApiV1Application } from '@/server/api/composition';
import { createClariprintRoutes, type ClariprintQuoteCallerDependencies } from '@/server/api/clariprint-routes';

/** Budget qui autorise toujours — comportement historique avant BCP-0b. */
function alwaysAllowBudget(): ClariprintQuoteBudget {
  return { async consume() { return { allowed: true }; } };
}

/** Dependances par defaut : jamais membre, secret present, aucun evenement attendu. */
function defaultCallerDependencies(overrides: Partial<ClariprintQuoteCallerDependencies> = {}): ClariprintQuoteCallerDependencies {
  return {
    isMember: async () => false,
    ipHmacSecret: 'test-hmac-secret',
    onRateLimitEvent: () => {},
    ...overrides,
  };
}

describe('route API devis Clariprint', () => {
  it('partage le contrat avec le client navigateur et reste disponible au storefront public', async () => {
    const gateway: ClariprintQuoteGateway = { async quote(command) { return { success: true, priceHT: command.clariprint.quantity === 500 ? 99 : 0 }; } };
    const handler = createApiV1Application({
      routes: createClariprintRoutes(new ClariprintService(gateway, alwaysAllowBudget()), defaultCallerDependencies()),
      requestIdFactory: () => 'clariprint-test',
    });
    const bridge = ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch;
    const client = new ClariprintApiClient(new FetchApiClient('https://magrit.test', bridge));
    await expect(client.quote({ clariprint: { quantity: 500 } })).resolves.toEqual({ success: true, priceHT: 99 });
  });

  it('rejette une configuration absente avant le fournisseur', async () => {
    let called = false;
    const gateway: ClariprintQuoteGateway = { async quote() { called = true; return { success: true, priceHT: 1 }; } };
    const handler = createApiV1Application({
      routes: createClariprintRoutes(new ClariprintService(gateway, alwaysAllowBudget()), defaultCallerDependencies()),
      requestIdFactory: () => 'clariprint-invalid',
    });
    const response = await handler(new Request('http://localhost/api/v1/clariprint/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
    expect(response.status).toBe(422);
    expect(called).toBe(false);
  });

  // Correctif sécurité 2026-09-15 : même si une passerelle (celle en place ou
  // une future) construit encore `allResults`/`faultyProcess`, le contrat de
  // sortie de la route est la dernière barrière avant le client. Ce test porte
  // sur cette barrière elle-même (le schéma), pas sur l'implémentation
  // HTTP actuelle de la passerelle.
  it('ne laisse jamais passer allResults/faultyProcess vers le client, meme si la passerelle les construit encore', async () => {
    const gateway: ClariprintQuoteGateway = {
      async quote() {
        return {
          success: true,
          priceHT: 99,
          // @ts-expect-error — simule une passerelle non conforme, exactement le cas corrige
          allResults: [{ imprimeur: 'ImprimeurSecretGHI', external_id: 'INT-777' }],
          // @ts-expect-error — idem
          faultyProcess: { gamme_offset: 'FaultySecretJKL' },
        };
      },
    };
    const handler = createApiV1Application({
      routes: createClariprintRoutes(new ClariprintService(gateway, alwaysAllowBudget()), defaultCallerDependencies()),
      requestIdFactory: () => 'clariprint-leak-guard',
    });
    const response = await handler(new Request('http://localhost/api/v1/clariprint/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clariprint: { quantity: 500 } }) }));
    const text = await response.text();
    expect(text).not.toContain('ImprimeurSecretGHI');
    expect(text).not.toContain('INT-777');
    expect(text).not.toContain('FaultySecretJKL');
    expect(text).not.toContain('allResults');
    expect(text).not.toContain('faultyProcess');
  });

  // Correctif sécurité 2026-09-15 (mutation M8 survivante) : le contrat de
  // sortie de la route (`outputSchema: clariprintQuoteResultSchema`) délègue
  // la forme de `costs` au sous-schéma `clariprintCostsSchema`. Si ce
  // sous-schéma redevenait `.passthrough()`, un champ non documenté glissé
  // dans `costs` par n importe quelle passerelle (simulée ici, la vraie ou
  // une future) traverserait quand meme la barrière de sortie de la route,
  // meme si `allResults`/`faultyProcess` au niveau racine restent bloqués.
  it('ne laisse jamais passer un champ inconnu de costs vers le client, meme si la passerelle le construit', async () => {
    const gateway: ClariprintQuoteGateway = {
      async quote() {
        return {
          success: true,
          priceHT: 99,
          costs: {
            paper: 1,
            // @ts-expect-error — simule une passerelle qui glisse un champ non documente dans costs
            printer: 'TEMOIN_M8',
          },
        };
      },
    };
    const handler = createApiV1Application({
      routes: createClariprintRoutes(new ClariprintService(gateway, alwaysAllowBudget()), defaultCallerDependencies()),
      requestIdFactory: () => 'clariprint-costs-leak-guard',
    });
    const response = await handler(new Request('http://localhost/api/v1/clariprint/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clariprint: { quantity: 500 } }) }));
    const text = await response.text();
    expect(text).not.toContain('TEMOIN_M8');
  });
});

// ============================================================================
// BCP-0b — limiteur de débit (docs/api/CONVENTIONS.md §8.25 point 2.3bis).
// ============================================================================
describe('BCP-0b — limiteur de débit sur POST /api/v1/clariprint/quote', () => {
  /**
   * Même principe que l'actorResolver réel de `magrit-api/index.ts` (JWT ->
   * acteur `user`, même sur une route `public`) : un simple `Bearer <token>`
   * résout `{kind:'user', userId: token}`, sans vérification de signature —
   * ce que fait le VRAI resolver n'est pas ce qui est testé ici.
   */
  async function fakeActorResolver(request: Request) {
    const header = request.headers.get('authorization');
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? { kind: 'user' as const, userId: token } : null;
  }

  function buildHandler(options: Readonly<{
    budget: ClariprintQuoteBudget;
    deps: ClariprintQuoteCallerDependencies;
    gatewayCalled?: { value: boolean };
  }>) {
    const gateway: ClariprintQuoteGateway = {
      async quote() {
        if (options.gatewayCalled) options.gatewayCalled.value = true;
        return { success: true, priceHT: 42 };
      },
    };
    return createApiV1Application({
      routes: createClariprintRoutes(new ClariprintService(gateway, options.budget), options.deps),
      requestIdFactory: () => 'clariprint-rate-limit-test',
      actorResolver: { resolve: fakeActorResolver },
    });
  }

  function postQuote(handler: (request: Request) => Promise<Response>, headers: Record<string, string> = {}) {
    return handler(new Request('http://localhost/api/v1/clariprint/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ clariprint: { quantity: 500 } }),
    }));
  }

  it("n'appelle JAMAIS Clariprint quand le budget refuse (visiteur, 429 api.rate_limited)", async () => {
    const gatewayCalled = { value: false };
    const decision: ClariprintQuoteBudgetDecision = { allowed: false, refusedScope: 'visitor' };
    const handler = buildHandler({
      budget: { async consume() { return decision; } },
      deps: defaultCallerDependencies(),
      gatewayCalled,
    });
    const response = await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9' });
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.code).toBe('api.rate_limited');
    expect(gatewayCalled.value).toBe(false);
  });

  it("n'appelle JAMAIS Clariprint quand le budget refuse (membre, 429 api.rate_limited)", async () => {
    const gatewayCalled = { value: false };
    const handler = buildHandler({
      budget: { async consume() { return { allowed: false, refusedScope: 'member' }; } },
      deps: defaultCallerDependencies({ isMember: async () => true }),
      gatewayCalled,
    });
    const response = await postQuote(handler, { authorization: 'Bearer whatever' });
    expect(response.status).toBe(429);
    expect(gatewayCalled.value).toBe(false);
  });

  it("n'appelle JAMAIS Clariprint quand L3 est épuisé (503 clariprint.public_quota_exhausted)", async () => {
    const gatewayCalled = { value: false };
    const handler = buildHandler({
      budget: { async consume() { return { allowed: false, refusedScope: 'public' }; } },
      deps: defaultCallerDependencies(),
      gatewayCalled,
    });
    const response = await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9' });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe('clariprint.public_quota_exhausted');
    expect(gatewayCalled.value).toBe(false);
  });

  it("n'appelle JAMAIS Clariprint quand le budget est indisponible (503 clariprint.unavailable)", async () => {
    const gatewayCalled = { value: false };
    const handler = buildHandler({
      budget: { async consume() { throw new ClariprintQuoteBudgetUnavailableError('base injoignable'); } },
      deps: defaultCallerDependencies(),
      gatewayCalled,
    });
    const response = await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9' });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe('clariprint.unavailable');
    expect(gatewayCalled.value).toBe(false);
  });

  it('appelle Clariprint et rend 200 quand le budget autorise', async () => {
    const gatewayCalled = { value: false };
    const handler = buildHandler({
      budget: { async consume() { return { allowed: true }; } },
      deps: defaultCallerDependencies(),
      gatewayCalled,
    });
    const response = await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9' });
    expect(response.status).toBe(200);
    expect(gatewayCalled.value).toBe(true);
  });

  it('un membre (jeton résolu ET appartenance) n\'est jamais bloqué par L3 : la clé transmise au budget porte kind="member"', async () => {
    const seenCallers: ClariprintQuoteCaller[] = [];
    const handler = buildHandler({
      budget: {
        async consume(caller) {
          seenCallers.push(caller);
          return { allowed: true };
        },
      },
      deps: defaultCallerDependencies({ isMember: async (userId) => userId === 'jeton-valide' }),
    });
    const response = await postQuote(handler, { authorization: 'Bearer jeton-valide' });
    expect(response.status).toBe(200);
    expect(seenCallers).toHaveLength(1);
    expect(seenCallers[0]?.kind).toBe('member');
  });

  it('un jeton résolu SANS appartenance (isMember=false) retombe en visiteur, pas en membre', async () => {
    const seenCallers: ClariprintQuoteCaller[] = [];
    const handler = buildHandler({
      budget: {
        async consume(caller) {
          seenCallers.push(caller);
          return { allowed: true };
        },
      },
      deps: defaultCallerDependencies({ isMember: async () => false }),
    });
    await postQuote(handler, { authorization: 'Bearer jeton-sans-espace', 'cf-connecting-ip': '203.0.113.9' });
    expect(seenCallers[0]?.kind).toBe('visitor');
  });

  it('en-tête cf-connecting-ip forgé PLUSIEURS fois (fusionné par Headers) donne la MÊME clé partagée que sans en-tête, et journalise client_ip_missing', async () => {
    const seenCallers: ClariprintQuoteCaller[] = [];
    const events: string[] = [];
    const handler = buildHandler({
      budget: { async consume(caller) { seenCallers.push(caller); return { allowed: true }; } },
      deps: defaultCallerDependencies({ onRateLimitEvent: (event) => events.push(event) }),
    });

    await postQuote(handler, {}); // aucun en-tête IP
    await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9, 198.51.100.1' }); // en-tête à plusieurs entrées

    expect(seenCallers).toHaveLength(2);
    expect(seenCallers[0]).toEqual({ kind: 'visitor', key: 'shared' });
    expect(seenCallers[1]).toEqual({ kind: 'visitor', key: 'shared' });
    expect(events).toEqual(['client_ip_missing', 'client_ip_missing']);
  });

  it('cf-connecting-ip absent donne le quota PARTAGÉ, jamais une clé tirée de x-forwarded-for/true-client-ip/x-client-ip/forwarded/x-real-ip', async () => {
    const seenCallers: ClariprintQuoteCaller[] = [];
    const handler = buildHandler({
      budget: { async consume(caller) { seenCallers.push(caller); return { allowed: true }; } },
      deps: defaultCallerDependencies(),
    });
    await postQuote(handler, {
      'x-forwarded-for': '198.51.100.50',
      'true-client-ip': '198.51.100.51',
      'x-client-ip': '198.51.100.52',
      forwarded: 'for=198.51.100.53',
      'x-real-ip': '198.51.100.54',
    });
    expect(seenCallers).toHaveLength(1);
    expect(seenCallers[0]).toEqual({ kind: 'visitor', key: 'shared' });
  });

  it('secret HMAC absent : clé PARTAGÉE (échec fermé), et ip_hmac_secret_missing journalisé, même avec une IP valide', async () => {
    const events: string[] = [];
    const seenCallers: ClariprintQuoteCaller[] = [];
    const handler = buildHandler({
      budget: { async consume(caller) { seenCallers.push(caller); return { allowed: true }; } },
      deps: defaultCallerDependencies({ ipHmacSecret: null, onRateLimitEvent: (event) => events.push(event) }),
    });
    await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9' });
    expect(seenCallers[0]).toEqual({ kind: 'visitor', key: 'shared' });
    expect(events).toEqual(['ip_hmac_secret_missing']);
  });

  it('une IP valide avec secret présent produit une clé HMAC déterministe, distincte pour deux IP différentes', async () => {
    const seenCallers: ClariprintQuoteCaller[] = [];
    const handler = buildHandler({
      budget: { async consume(caller) { seenCallers.push(caller); return { allowed: true }; } },
      deps: defaultCallerDependencies(),
    });
    await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9' });
    await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9' });
    await postQuote(handler, { 'cf-connecting-ip': '203.0.113.10' });

    expect(seenCallers[0]?.kind).toBe('visitor');
    expect((seenCallers[0] as { key: string }).key).toMatch(/^ip:[0-9a-f]{64}$/);
    expect(seenCallers[0]).toEqual(seenCallers[1]); // même IP -> même clé
    expect(seenCallers[0]).not.toEqual(seenCallers[2]); // IP différente -> clé différente
  });

  it('un corps invalide ne consomme jamais le budget (validation avant le limiteur)', async () => {
    let consumed = false;
    const handler = buildHandler({
      budget: { async consume() { consumed = true; return { allowed: true }; } },
      deps: defaultCallerDependencies(),
    });
    const response = await handler(new Request('http://localhost/api/v1/clariprint/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }));
    expect(response.status).toBe(422);
    expect(consumed).toBe(false);
  });
});
