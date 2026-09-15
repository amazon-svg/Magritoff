import { describe, expect, it } from 'vitest';
import { ClariprintApiClient } from '@/modules/clariprint/api/client';
import {
  ClariprintQuoteBudgetUnavailableError,
  type ClariprintQuoteBudget,
  type ClariprintQuoteBudgetDecision,
  type ClariprintQuoteCaller,
} from '@/modules/clariprint/application/clariprint-quote-budget';
import { hmacSha256Hex, normalizeIpForRateLimit } from '@/modules/clariprint/application/clariprint-quote-rate-limit';
import type { ClariprintQuoteGateway } from '@/modules/clariprint/application/clariprint-quote-gateway';
import { ClariprintService } from '@/modules/clariprint/application/clariprint-service';
import type { StorefrontSessionGateway } from '@/modules/shop-customers/application/storefront-session-service';
import { StorefrontSessionService } from '@/modules/shop-customers/application/storefront-session-service';
import { FetchApiClient } from '@/platform/api';
import { createApiV1Application } from '@/server/api/composition';
import {
  createClariprintRoutes,
  type ClariprintQuoteCallerDependencies,
  type ClariprintRateLimitLogEvent,
} from '@/server/api/clariprint-routes';
import { storefrontSessionCookiePolicy } from '@/server/storefront/session-cookie';

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

  // qa-review round 1, défaut T5 : un test qui ne vérifie que `kind` laisse
  // passer une mutation qui remplacerait la clé du membre par 'shared' (ou
  // toute autre valeur constante) — la clé EXACTE, `user:<id>`, est la
  // garantie que chaque membre a son PROPRE compteur (point 2.3bis (4)).
  it('un membre (jeton résolu ET appartenance) n\'est jamais bloqué par L3 : la clé transmise au budget est EXACTEMENT user:<id>', async () => {
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
    expect(seenCallers[0]).toEqual({ kind: 'member', key: 'user:jeton-valide' });
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

  // qa-review round 1, défaut T6 : la branche "compte boutique" (point (3),
  // premier de l'ordre de résolution du visiteur) n'était exercée par AUCUN
  // test — une régression qui la retirerait entièrement serait passée
  // inaperçue.
  it('un visiteur avec une session boutique VALIDE utilise sa clé de compte, EXACTEMENT account:<id>, jamais l IP', async () => {
    const shopId = '11111111-1111-4111-8111-111111111111';
    const accountId = '22222222-2222-4222-8222-222222222222';
    const cookiePolicy = storefrontSessionCookiePolicy(false);
    const opaqueToken = 'a'.repeat(40); // respecte /^[A-Za-z0-9_-]{32,512}$/
    const gateway: StorefrontSessionGateway = {
      async resolve(token) {
        if (token !== opaqueToken) return null;
        return {
          identity: { kind: 'shop_customer', shopId, shopCustomerAccountId: accountId },
          customer: { id: accountId, shopId, email: 'client@example.test', fullName: 'Client Test', status: 'active' },
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        };
      },
      async revoke() { return true; },
    };
    const seenCallers: ClariprintQuoteCaller[] = [];
    const handler = buildHandler({
      budget: { async consume(caller) { seenCallers.push(caller); return { allowed: true }; } },
      deps: defaultCallerDependencies({
        storefrontSessions: new StorefrontSessionService(gateway),
        storefrontCookiePolicy: cookiePolicy,
      }),
    });

    // L'IP est présente aussi : la session boutique doit primer dessus
    // (ordre de résolution opposable, point (3) avant l'IP).
    await postQuote(handler, {
      cookie: `${cookiePolicy.name}=${opaqueToken}`,
      'cf-connecting-ip': '203.0.113.9',
    });

    expect(seenCallers).toHaveLength(1);
    expect(seenCallers[0]).toEqual({ kind: 'visitor', key: `account:${accountId}` });
  });

  it('en-tête cf-connecting-ip forgé PLUSIEURS fois (fusionné par Headers) donne la MÊME clé partagée que sans en-tête, et journalise client_ip_missing', async () => {
    const seenCallers: ClariprintQuoteCaller[] = [];
    const events: ClariprintRateLimitLogEvent[] = [];
    const handler = buildHandler({
      budget: { async consume(caller) { seenCallers.push(caller); return { allowed: true }; } },
      deps: defaultCallerDependencies({ onRateLimitEvent: (event) => events.push(event) }),
    });

    await postQuote(handler, {}); // aucun en-tête IP
    await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9, 198.51.100.1' }); // en-tête à plusieurs entrées

    expect(seenCallers).toHaveLength(2);
    expect(seenCallers[0]).toEqual({ kind: 'visitor', key: 'shared' });
    expect(seenCallers[1]).toEqual({ kind: 'visitor', key: 'shared' });
    expect(events).toEqual([{ event: 'client_ip_missing' }, { event: 'client_ip_missing' }]);
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
    const events: ClariprintRateLimitLogEvent[] = [];
    const seenCallers: ClariprintQuoteCaller[] = [];
    const handler = buildHandler({
      budget: { async consume(caller) { seenCallers.push(caller); return { allowed: true }; } },
      deps: defaultCallerDependencies({ ipHmacSecret: null, onRateLimitEvent: (event) => events.push(event) }),
    });
    await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9' });
    expect(seenCallers[0]).toEqual({ kind: 'visitor', key: 'shared' });
    expect(events).toEqual([{ event: 'ip_hmac_secret_missing' }]);
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

  // qa-review round 1, défaut T14 : un test qui ne compare que DEUX sorties
  // entre elles ne détecte pas un secret remplacé par une CONSTANTE dans le
  // câblage de la route (`resolveClariprintQuoteCaller` passant un texte fixe
  // au lieu de `deps.ipHmacSecret`) — il faut comparer à la primitive pure
  // calculée INDÉPENDAMMENT, avec le VRAI secret injecté.
  it('la clé HMAC produite par la route est calculée avec le secret INJECTÉ, jamais une valeur constante', async () => {
    async function seenKeyFor(secret: string): Promise<string> {
      const seenCallers: ClariprintQuoteCaller[] = [];
      const handler = buildHandler({
        budget: { async consume(caller) { seenCallers.push(caller); return { allowed: true }; } },
        deps: defaultCallerDependencies({ ipHmacSecret: secret }),
      });
      await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9' });
      const caller = seenCallers[0];
      if (!caller || caller.kind !== 'visitor') throw new Error('caller visiteur attendu');
      return caller.key;
    }

    const keyWithSecretA = await seenKeyFor('secret-a');
    const keyWithSecretB = await seenKeyFor('secret-b');
    expect(keyWithSecretA).not.toBe(keyWithSecretB);

    const expectedWithSecretA = `ip:${await hmacSha256Hex('secret-a', normalizeIpForRateLimit('203.0.113.9'))}`;
    const expectedWithSecretB = `ip:${await hmacSha256Hex('secret-b', normalizeIpForRateLimit('203.0.113.9'))}`;
    expect(keyWithSecretA).toBe(expectedWithSecretA);
    expect(keyWithSecretB).toBe(expectedWithSecretB);
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

  // qa-review round 1, recette (11) : chaque refus doit se journaliser
  // (request_id, portée, type d'appelant, clé DÉJÀ hachée/préfixée — jamais
  // l'IP en clair) ; et la CAUSE d'un 503 clariprint.unavailable ne doit
  // jamais être avalée (avant ce correctif, `clariprint-routes.ts:62` ne
  // journalisait rien du tout).
  describe('journalisation des refus et des pannes (recette 11)', () => {
    // qa-review round 2 : le cadrage interdit DEUX FOIS qu une IP ou son
    // empreinte figure au journal (§8.25 (11) et point 2.4), et n autorise
    // AUCUN identifiant en clair pour un visiteur (compte boutique compris)
    // — seul le membre est tracable, par `user_id` (point 2.3bis (4)).
    // Chaque test verifie sur le JSON.stringify de l evenement, avec des
    // chaines temoins, qu AUCUNE de ces valeurs n y figure.
    const FORBIDDEN_SUBSTRINGS = ['ip:', 'account:', '203.0.113.9', 'shared'];

    it('un refus VISITEUR ANONYME (429) ne journalise NI l IP NI son empreinte NI aucune cle', async () => {
      const events: ClariprintRateLimitLogEvent[] = [];
      const handler = buildHandler({
        budget: { async consume() { return { allowed: false, refusedScope: 'visitor' }; } },
        deps: defaultCallerDependencies({ onRateLimitEvent: (event) => events.push(event) }),
      });
      await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9' });

      expect(events).toHaveLength(1);
      const event = events[0];
      expect(event?.event).toBe('refused');
      if (event?.event !== 'refused') throw new Error('événement refused attendu');
      expect(event.requestId).toBe('clariprint-rate-limit-test');
      expect(event.scope).toBe('visitor');
      expect(event.callerKind).toBe('visitor');
      expect(event.userId).toBeUndefined();
      expect('key' in event).toBe(false);

      const serialized = JSON.stringify(event);
      // HMAC hex de 64 caracteres : forme que portait l ancienne `key`.
      expect(serialized).not.toMatch(/[0-9a-f]{64}/);
      for (const forbidden of FORBIDDEN_SUBSTRINGS) {
        expect(serialized).not.toContain(forbidden);
      }
    });

    it('un refus VISITEUR AVEC SESSION BOUTIQUE (acheteur connecté) ne journalise NI le compte NI aucune cle', async () => {
      const shopId = '11111111-1111-4111-8111-111111111111';
      const accountId = '22222222-2222-4222-8222-222222222222';
      const cookiePolicy = storefrontSessionCookiePolicy(false);
      const opaqueToken = 'b'.repeat(40);
      const gateway: StorefrontSessionGateway = {
        async resolve(token) {
          if (token !== opaqueToken) return null;
          return {
            identity: { kind: 'shop_customer', shopId, shopCustomerAccountId: accountId },
            customer: { id: accountId, shopId, email: 'client@example.test', fullName: 'Client Test', status: 'active' },
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          };
        },
        async revoke() { return true; },
      };
      const events: ClariprintRateLimitLogEvent[] = [];
      const handler = buildHandler({
        budget: { async consume() { return { allowed: false, refusedScope: 'visitor' }; } },
        deps: defaultCallerDependencies({
          storefrontSessions: new StorefrontSessionService(gateway),
          storefrontCookiePolicy: cookiePolicy,
          onRateLimitEvent: (event) => events.push(event),
        }),
      });
      await postQuote(handler, { cookie: `${cookiePolicy.name}=${opaqueToken}` });

      expect(events).toHaveLength(1);
      const event = events[0];
      if (event?.event !== 'refused') throw new Error('événement refused attendu');
      expect(event.callerKind).toBe('visitor');
      expect(event.userId).toBeUndefined();
      expect('key' in event).toBe(false);

      const serialized = JSON.stringify(event);
      expect(serialized).not.toContain(accountId);
      for (const forbidden of FORBIDDEN_SUBSTRINGS) {
        expect(serialized).not.toContain(forbidden);
      }
    });

    it('un refus MEMBRE (429) journalise scope=member, callerKind=member ET son userId — jamais de cle', async () => {
      const events: ClariprintRateLimitLogEvent[] = [];
      const handler = buildHandler({
        budget: { async consume() { return { allowed: false, refusedScope: 'member' }; } },
        deps: defaultCallerDependencies({ isMember: async () => true, onRateLimitEvent: (event) => events.push(event) }),
      });
      await postQuote(handler, { authorization: 'Bearer jeton-membre' });

      expect(events).toEqual([
        { event: 'refused', requestId: 'clariprint-rate-limit-test', scope: 'member', callerKind: 'member', userId: 'jeton-membre' },
      ]);
      expect('key' in (events[0] as object)).toBe(false);
    });

    it('un refus L3 (503 public) journalise scope=public', async () => {
      const events: ClariprintRateLimitLogEvent[] = [];
      const handler = buildHandler({
        budget: { async consume() { return { allowed: false, refusedScope: 'public' }; } },
        deps: defaultCallerDependencies({ onRateLimitEvent: (event) => events.push(event) }),
      });
      await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9' });

      expect(events).toHaveLength(1);
      expect(events[0]?.event).toBe('refused');
      if (events[0]?.event === 'refused') expect(events[0].scope).toBe('public');
    });

    it('une panne du budget (503 clariprint.unavailable) journalise la CAUSE — plus jamais avalée', async () => {
      const events: ClariprintRateLimitLogEvent[] = [];
      const handler = buildHandler({
        budget: { async consume() { throw new ClariprintQuoteBudgetUnavailableError('base injoignable pendant le test'); } },
        deps: defaultCallerDependencies({ onRateLimitEvent: (event) => events.push(event) }),
      });
      const response = await postQuote(handler, { 'cf-connecting-ip': '203.0.113.9' });

      expect(response.status).toBe(503);
      expect(events).toEqual([
        { event: 'unavailable', requestId: 'clariprint-rate-limit-test', reason: 'base injoignable pendant le test' },
      ]);
    });
  });
});
