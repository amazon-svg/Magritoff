/**
 * Le middleware transverse contre le contrat (story E10.0, CA4 a CA9, CA12).
 *
 * Les routes montees ici sont des FIXTURES du socle, pas des endpoints
 * publies : E10.0 n en publie aucun. Ce qui est verifie n est pas leur
 * existence dans `paths` mais le fait que les formes transverses produites par
 * la facade — enveloppe, probleme, meta, en-tetes — sont conformes aux
 * composants partages du contrat, pour toute route que les stories E10.x
 * declareront ensuite.
 */
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import {
  InMemoryIdempotencyStore,
  assertPrecondition,
  computeEntityTag,
  type ApiPrincipal,
  type PrincipalVerifier,
} from '@/modules/_shared/application';
import { createGescomApiHandler, defineGescomRoute } from '@/server/api';
import { checkResponseAgainstContract } from './_harness.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f');
const RULE_ID = 'b1c2d3e4-5f60-4a7b-8c9d-0e1f2a3b4c5d';

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

const userPrincipal: ApiPrincipal = Object.freeze({
  kind: 'user',
  userId: USER,
  tenantId: TENANT,
});

const servicePrincipal: ApiPrincipal = Object.freeze({
  kind: 'service',
  serviceId: 'studio',
  tenantId: TENANT,
  scopes: Object.freeze(['price-rules:read']),
});

/** Jeton de session storefront valide (`^[A-Za-z0-9_-]{32,512}$`). */
const STOREFRONT_TOKEN = 'z'.repeat(40);

/**
 * E10.10b-1 round 2 (§3.6/§8.13ter) — necessaire aux tests B1/B2 : un membre
 * Magrit qui porte AUSSI une session boutique (cookie) doit continuer a
 * atteindre l atelier ; une session boutique seule ne doit jamais atteindre
 * une route qui ne la declare pas.
 */
const shopCustomerPrincipal: ApiPrincipal = Object.freeze({
  kind: 'shop_customer',
  accountId: 'account-1',
  shopId: 'shop-1',
  tenantId: TENANT,
  customerId: 'customer-1',
  sessionKind: 'direct',
  sessionToken: STOREFRONT_TOKEN,
});

/**
 * E10.10b-2 (docs/api/CONVENTIONS.md §8.13quinquies, "trois points que
 * dev-story ne doit pas decouvrir en route", point 1) — SECOND compte, MEME
 * tenant, necessaire au test de la reserve d idempotence : deux acheteurs
 * distincts du meme imprimeur, chacun choisissant par hasard la MEME valeur
 * d Idempotency-Key sur une operation differente.
 */
const STOREFRONT_TOKEN_2 = 'y'.repeat(40);
const shopCustomerPrincipal2: ApiPrincipal = Object.freeze({
  kind: 'shop_customer',
  accountId: 'account-2',
  shopId: 'shop-1',
  tenantId: TENANT,
  customerId: 'customer-2',
  sessionKind: 'direct',
  sessionToken: STOREFRONT_TOKEN_2,
});

/**
 * E10.20a — quatrieme mode, le porteur d un lien public de depot. Jeton
 * opaque valide `^[A-Za-z0-9_-]{32,128}$` (contrat, schema `OrderUploadLink
 * Created.token`).
 */
const UPLOAD_LINK_TOKEN = 'w'.repeat(40);
const uploadLinkPrincipal: ApiPrincipal = Object.freeze({
  kind: 'upload_link',
  linkId: 'link-1',
  orderId: 'order-1',
  tenantId: TENANT,
  token: UPLOAD_LINK_TOKEN,
});

/**
 * qa-review round 1 (B2) — SECOND lien, MEME tenant, necessaire au test de
 * la derivation d idempotence : deux porteurs de liens DISTINCTS du meme
 * imprimeur, chacun choisissant par hasard la MEME valeur d Idempotency-Key.
 */
const UPLOAD_LINK_TOKEN_2 = 'v'.repeat(40);
const uploadLinkPrincipal2: ApiPrincipal = Object.freeze({
  kind: 'upload_link',
  linkId: 'link-2',
  orderId: 'order-2',
  tenantId: TENANT,
  token: UPLOAD_LINK_TOKEN_2,
});

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer') {
      return credential.token === 'jeton-valide' ? userPrincipal : null;
    }
    if (credential.kind === 'cookie') {
      if (credential.token === STOREFRONT_TOKEN) return shopCustomerPrincipal;
      if (credential.token === STOREFRONT_TOKEN_2) return shopCustomerPrincipal2;
      return null;
    }
    if (credential.kind === 'upload_link') {
      if (credential.token === UPLOAD_LINK_TOKEN) return uploadLinkPrincipal;
      if (credential.token === UPLOAD_LINK_TOKEN_2) return uploadLinkPrincipal2;
      return null;
    }
    return credential.key === 'cle-studio' ? servicePrincipal : null;
  },
};

const asShopCustomer = { Cookie: `magrit-storefront=${STOREFRONT_TOKEN}` };
const asShopCustomer2 = { Cookie: `magrit-storefront=${STOREFRONT_TOKEN_2}` };
const asUploadLink = { 'X-Magrit-Upload-Link': UPLOAD_LINK_TOKEN };
const asUploadLink2 = { 'X-Magrit-Upload-Link': UPLOAD_LINK_TOKEN_2 };

const ruleSchema = z.object({ id: z.string(), name: z.string(), value: z.string() });
const rule = { id: RULE_ID, name: 'Fidelite', value: '0.0500' };

/** Etat courant simule d une ressource, pour exercer la concurrence optimiste. */
const storedRule = { ...rule };

function buildHandler() {
  const store = new InMemoryIdempotencyStore();
  const routes = [
    defineGescomRoute({
      method: 'GET',
      path: '/price-rules',
      operationId: 'fixtureListPriceRules',
      requiredScopes: ['price-rules:read'],
      inputSchema: null,
      dataSchema: z.array(ruleSchema),
      async handle(context) {
        return {
          status: 200,
          data: [rule],
          meta: { page_size: context.page.size, next_cursor: null },
        };
      },
    }),
    defineGescomRoute({
      method: 'POST',
      path: '/price-rules',
      operationId: 'fixtureCreatePriceRule',
      createsResource: true,
      requiredScopes: ['price-rules:write'],
      inputSchema: z.object({ name: z.string() }),
      dataSchema: ruleSchema,
      async handle(_context, input) {
        return { status: 201, data: { ...rule, name: input.name } };
      },
    }),
    defineGescomRoute({
      method: 'PATCH',
      path: '/price-rules/{ruleId}',
      operationId: 'fixtureUpdatePriceRule',
      requiredScopes: ['price-rules:write'],
      inputSchema: z.object({ name: z.string() }),
      dataSchema: ruleSchema,
      async handle(context, input) {
        const currentTag = await computeEntityTag(storedRule);
        assertPrecondition(context.ifMatch, currentTag, storedRule);
        const updated = { ...storedRule, name: input.name };
        return { status: 200, data: updated, etag: await computeEntityTag(updated) };
      },
    }),
    // E10.10b-2 (docs/api/CONVENTIONS.md §8.13quinquies, point 1) — route
    // FIXTURE `shop_customer` + `createsResource`, seule combinaison qui
    // exerce la derivation de la cle d idempotence STOCKEE par COMPTE.
    // `decideStorefrontQuote` (storefront-quotes-routes.ts) est la premiere
    // route reelle a cumuler les deux ; ce fixture isole le comportement du
    // SOCLE, independamment de ce module applicatif.
    defineGescomRoute({
      method: 'POST',
      path: '/price-rules/{ruleId}/fixture-decisions',
      operationId: 'fixtureDecideAsShopCustomer',
      authentication: 'shop_customer',
      createsResource: true,
      inputSchema: z.object({ decision: z.string() }),
      dataSchema: z.object({ ruleId: z.string(), decision: z.string(), accountId: z.string() }),
      async handle(context, input) {
        const principal = context.principal;
        if (principal.kind !== 'shop_customer') throw new Error('principal shop_customer attendu (fixture)');
        return {
          status: 201,
          data: { ruleId: context.params['ruleId']!, decision: input.decision, accountId: principal.accountId },
        };
      },
    }),
    // E10.20a — route FIXTURE `upload_link`, isole le cloisonnement du
    // QUATRIEME mode au niveau du SOCLE, independamment du module applicatif
    // `order-upload-links`.
    defineGescomRoute({
      method: 'GET',
      path: '/price-rules/{ruleId}/fixture-upload-link-contexts',
      operationId: 'fixtureUploadLinkContext',
      authentication: 'upload_link',
      inputSchema: null,
      dataSchema: z.object({ ruleId: z.string(), linkId: z.string() }),
      async handle(context) {
        const principal = context.principal;
        if (principal.kind !== 'upload_link') throw new Error('principal upload_link attendu (fixture)');
        return { status: 200, data: { ruleId: context.params['ruleId']!, linkId: principal.linkId } };
      },
    }),
    // E10.20a, qa-review round 1 (B2, BLOQUANT) — route FIXTURE `upload_link`
    // + `createsResource: true`, seule combinaison qui exerce la derivation
    // de la cle d idempotence STOCKEE par LIEN
    // (`deriveUploadLinkIdempotencyStorageKey`). Meme role que
    // `fixtureDecideAsShopCustomer` pour `shop_customer` : isole le
    // comportement du SOCLE, independamment de tout module applicatif —
    // aucune route reelle de ce lot n a encore `createsResource: true` sous
    // ce principal (E10.20b enregistrera la premiere, `confirmOrderUploadLinkFile`).
    defineGescomRoute({
      method: 'POST',
      path: '/price-rules/{ruleId}/fixture-upload-link-confirmations',
      operationId: 'fixtureConfirmAsUploadLink',
      authentication: 'upload_link',
      createsResource: true,
      inputSchema: z.object({ filename: z.string() }),
      dataSchema: z.object({ ruleId: z.string(), filename: z.string(), linkId: z.string() }),
      async handle(context, input) {
        const principal = context.principal;
        if (principal.kind !== 'upload_link') throw new Error('principal upload_link attendu (fixture)');
        return {
          status: 201,
          data: { ruleId: context.params['ruleId']!, filename: input.filename, linkId: principal.linkId },
        };
      },
    }),
  ];

  return createGescomApiHandler({
    routes,
    principalVerifier: verifier,
    idempotencyStore: store,
    requestIdFactory: () => 'req-e10-0',
  });
}

const handler = buildHandler();

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asUser = { Authorization: 'Bearer jeton-valide' };

async function expectContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<void> {
  const check = await checkResponseAgainstContract(response, expectation);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
}

describe('facade Gestion commerciale : reponses contre contrat', () => {
  it('CA6 — un succes est une enveloppe data/meta conforme', async () => {
    const response = await call('/api/v1/price-rules', { headers: asUser });
    await expectContract(response, { status: 200 });
    const body = (await response.json()) as { data: unknown[]; meta: { request_id: string } };
    expect(body.data).toEqual([rule]);
    expect(body.meta.request_id).toBe('req-e10-0');
    expect(response.headers.get('x-request-id')).toBe('req-e10-0');
  });

  it('CA6 — une erreur est un Problem servi en application/problem+json', async () => {
    const response = await call('/api/v1/price-rules');
    await expectContract(response, { status: 401 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('identity.authentication_required');
  });

  it('CA4 — adresser le tenant par la requete est refuse, pas ignore', async () => {
    const response = await call(`/api/v1/price-rules?tenant_id=${TENANT}`, { headers: asUser });
    await expectContract(response, { status: 400 });
    const body = (await response.json()) as { code: string; detail?: string };
    expect(body.code).toBe('api.tenant_not_addressable');
    expect(body.detail).toContain('tenant_id');
  });

  it('CA4 — declarer un tenant dans le chemin est refuse a la definition', () => {
    expect(() =>
      defineGescomRoute({
        method: 'GET',
        path: '/tenants/{tenantId}/price-rules',
        operationId: 'fixtureTenantInPath',
        requiredScopes: ['price-rules:read'],
        inputSchema: null,
        dataSchema: z.array(ruleSchema),
        async handle() {
          return { status: 200, data: [] };
        },
      }),
    ).toThrow(/adresse un tenant|le tenant est resolu depuis le jeton/i);
  });

  it('CA3 — une ressource au singulier ou en camelCase est refusee a la definition', () => {
    const base = {
      method: 'GET',
      operationId: 'fixtureBadPath',
      requiredScopes: ['price-rules:read'],
      inputSchema: null,
      dataSchema: z.array(ruleSchema),
      async handle() {
        return { status: 200, data: [] };
      },
    } as const;
    expect(() => defineGescomRoute({ ...base, path: '/price-rule' })).toThrow(/pluriel/i);
    expect(() => defineGescomRoute({ ...base, path: '/priceRules' })).toThrow(/kebab-case/i);
    expect(() => defineGescomRoute({ ...base, path: '/api/v1/price-rules' })).toThrow(/prefixe/i);
    // Regle unifiee avec le lint du contrat : le pluriel vaut pour TOUTE
    // ressource, pas seulement la racine.
    expect(() => defineGescomRoute({ ...base, path: '/price-rules/{ruleId}/history' })).toThrow(
      /pluriel/i,
    );
    expect(() =>
      defineGescomRoute({ ...base, path: '/price-rules/{ruleId}/revisions' }),
    ).not.toThrow();
  });

  it('CA5 — une route joignable par cle de service sans scope est refusee a la definition', () => {
    const base = {
      method: 'GET',
      path: '/price-rules',
      operationId: 'fixtureNoScopes',
      inputSchema: null,
      dataSchema: z.array(ruleSchema),
      async handle() {
        return { status: 200, data: [] };
      },
    } as const;
    // Portee fermee par defaut : `authentication` vaut 'any' sans declaration.
    expect(() => defineGescomRoute(base)).toThrow(/requiredScopes/i);
    expect(() => defineGescomRoute({ ...base, authentication: 'service' })).toThrow(
      /requiredScopes/i,
    );
    // Se restreindre aux jetons utilisateur est la seule dispense.
    expect(() => defineGescomRoute({ ...base, authentication: 'user' })).not.toThrow();
  });

  it('CA5 — une cle de service sans le scope requis recoit 403', async () => {
    const readable = await call('/api/v1/price-rules', {
      headers: { 'X-Magrit-Service-Key': 'cle-studio' },
    });
    await expectContract(readable, { status: 200 });

    const writable = await call('/api/v1/price-rules', {
      method: 'POST',
      headers: {
        'X-Magrit-Service-Key': 'cle-studio',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'creation-scope-01',
      },
      body: JSON.stringify({ name: 'Nouvelle regle' }),
    });
    await expectContract(writable, { status: 403 });
    const body = (await writable.json()) as { code: string };
    expect(body.code).toBe('identity.scope_required');
  });

  it('CA5 — presenter les deux credentials a la fois est ambigu, donc refuse', async () => {
    const response = await call('/api/v1/price-rules', {
      headers: { ...asUser, 'X-Magrit-Service-Key': 'cle-studio' },
    });
    await expectContract(response, { status: 400 });
  });

  it('B1 (§3.6, §8.13ter) — Bearer + cookie storefront sur une route atelier : le cookie est ignore, 200', async () => {
    // Scenario de production reel : un membre Magrit qui a genere un lien de
    // delegation (ou teste sa propre boutique) porte passivement le cookie
    // storefront sur CHAQUE appel d atelier. Avant le correctif, ceci rendait
    // 400 identity.actor_kind_required — regression du non-cumul introduit
    // par E10.10b-1 (§8.13 point 2, revoque).
    const response = await call('/api/v1/price-rules', {
      headers: { ...asUser, ...asShopCustomer },
    });
    await expectContract(response, { status: 200 });
    const body = (await response.json()) as { data: unknown[] };
    expect(body.data).toEqual([rule]);
  });

  it('B1 — Bearer + cookie + X-Magrit-Tenant sur une route atelier : 200, le cookie ignore ne bloque plus la selection de tenant', async () => {
    // Second blocage de la meme famille (§8.13ter) : `assertNoTenantSelectionOnCookieSession`
    // ne doit se declencher QUE si la credential RETENUE est le cookie. Ici
    // la credential retenue est le Bearer (precedence de l explicite) ; poser
    // X-Magrit-Tenant reste un usage legitime (§3.4) qui ne doit pas se
    // heurter au cookie storefront porte passivement.
    const response = await call('/api/v1/price-rules', {
      headers: { ...asUser, ...asShopCustomer, 'X-Magrit-Tenant': TENANT },
    });
    await expectContract(response, { status: 200 });
  });

  it('B2 (§3.6, §8.13ter) — une session boutique seule sur une route `any` avec des scopes requis recoit 403, jamais 200', async () => {
    // `fixtureListPriceRules` est `authentication: 'any'` (par defaut) AVEC
    // `requiredScopes` non vide : exactement le cas synthetique demande par
    // l architecte, aucune route `any` reelle n existant aujourd hui dans
    // gescom-routes.ts. Preuve que la couche 2 (createGescomApiHandler)
    // ferme bien ce mode par defaut, pas seulement 'user'/'service'.
    const response = await call('/api/v1/price-rules', { headers: asShopCustomer });
    await expectContract(response, { status: 403 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('identity.actor_kind_required');
  });

  it(
    'E10.10b-2 (§8.13quinquies, defaut de socle) — DEUX comptes clients distincts choisissant la MEME ' +
      'valeur d Idempotency-Key sur DEUX ressources differentes ne se bloquent plus mutuellement',
    async () => {
      const key = 'meme-cle-deux-comptes-distincts-fixture';

      const first = await call(`/api/v1/price-rules/${RULE_ID}/fixture-decisions`, {
        method: 'POST',
        headers: { ...asShopCustomer, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ decision: 'accepted' }),
      });
      expect(first.status).toBe(201);

      const second = await call(`/api/v1/price-rules/${RULE_ID}/fixture-decisions`, {
        method: 'POST',
        headers: { ...asShopCustomer2, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ decision: 'rejected' }),
      });
      // AVANT le correctif (portee de la cle STOCKEE = espace seul), le
      // second appel aurait recu 409 api.idempotency_key_reused : deux
      // acheteurs distincts DU MEME TENANT partageaient la meme entree
      // (tenantId, idempotency_key) — un client aurait pu en bloquer un
      // autre par pure coincidence de valeur de cle.
      expect(second.status).toBe(201);
      const secondBody = (await second.json()) as { data: { accountId: string; decision: string } };
      expect(secondBody.data.accountId).toBe('account-2');
      expect(secondBody.data.decision).toBe('rejected');
    },
  );

  it(
    'E10.10b-2 — la MEME cle, pour le MEME compte, reste rejouee (pas une seconde ecriture) — ' +
      'la derivation ne casse pas l idempotence intra-compte',
    async () => {
      const key = 'meme-compte-rejeu-fixture';
      const first = await call(`/api/v1/price-rules/${RULE_ID}/fixture-decisions`, {
        method: 'POST',
        headers: { ...asShopCustomer, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ decision: 'accepted' }),
      });
      expect(first.status).toBe(201);

      const replay = await call(`/api/v1/price-rules/${RULE_ID}/fixture-decisions`, {
        method: 'POST',
        headers: { ...asShopCustomer, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ decision: 'accepted' }),
      });
      expect(replay.status).toBe(201);
      expect(replay.headers.get('idempotency-replayed')).toBe('true');
    },
  );

  it('CA7 — la taille de page est reportee dans meta, un curseur illisible est refuse', async () => {
    const paged = await call('/api/v1/price-rules?page[size]=10', { headers: asUser });
    await expectContract(paged, { status: 200 });
    const body = (await paged.json()) as { meta: { page_size?: number; next_cursor: unknown } };
    expect(body.meta.page_size).toBe(10);
    expect(body.meta.next_cursor).toBeNull();

    const oversized = await call('/api/v1/price-rules?page[size]=5000', { headers: asUser });
    await expectContract(oversized, { status: 422 });
    expect(((await oversized.json()) as { code: string }).code).toBe('api.invalid_page_params');

    const broken = await call('/api/v1/price-rules?page[cursor]=pas-un-curseur!', {
      headers: asUser,
    });
    await expectContract(broken, { status: 422 });
    expect(((await broken.json()) as { code: string }).code).toBe('api.invalid_cursor');
  });

  it('CA8 — une creation sans Idempotency-Key est refusee', async () => {
    const response = await call('/api/v1/price-rules', {
      method: 'POST',
      headers: { ...asUser, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nouvelle regle' }),
    });
    await expectContract(response, { status: 400 });
    expect(((await response.json()) as { code: string }).code).toBe(
      'api.idempotency_key_required',
    );
  });

  it('CA8 — la meme cle rejoue la reponse, une cle reutilisee autrement est refusee', async () => {
    const request = (name: string) => ({
      method: 'POST',
      headers: {
        ...asUser,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'creation-regle-01',
      },
      body: JSON.stringify({ name }),
    });

    const first = await call('/api/v1/price-rules', request('Nouvelle regle'));
    await expectContract(first, { status: 201 });
    const firstBody = await first.json();

    const replay = await call('/api/v1/price-rules', request('Nouvelle regle'));
    await expectContract(replay, { status: 201 });
    expect(await replay.json()).toEqual(firstBody);

    const reused = await call('/api/v1/price-rules', request('Autre regle'));
    await expectContract(reused, { status: 409 });
    expect(((await reused.json()) as { code: string }).code).toBe('api.idempotency_key_reused');
  });

  it('CA8 — une reponse rejouee est signalee et recale meta.request_id sur la requete courante', async () => {
    const request = () => ({
      method: 'POST',
      headers: {
        ...asUser,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'creation-regle-replay',
      },
      body: JSON.stringify({ name: 'Regle rejouee' }),
    });

    const first = await call('/api/v1/price-rules', request());
    expect(first.headers.get('idempotency-replayed')).toBeNull();

    // Le request_id du rejeu vient de l en-tete entrant, distinct du premier.
    const replay = await handler(
      new Request('https://magrit.test/api/v1/price-rules', {
        ...request(),
        headers: { ...request().headers, 'X-Request-Id': 'req-second-essai' },
      }),
    );
    await expectContract(replay, { status: 201 });
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect(replay.headers.get('x-request-id')).toBe('req-second-essai');

    const body = (await replay.json()) as { data: unknown; meta: { request_id: string } };
    // Le contrat promet meta.request_id === X-Request-Id, rejeu compris.
    expect(body.meta.request_id).toBe('req-second-essai');
    // Les donnees, elles, sont bien celles de la premiere tentative.
    expect(body.data).toEqual({ ...rule, name: 'Regle rejouee' });
  });

  it('CA8 — la query fait partie de l empreinte : meme cle, query differente, requetes differentes', async () => {
    const request = () => ({
      method: 'POST',
      headers: {
        ...asUser,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'creation-regle-query',
      },
      body: JSON.stringify({ name: 'Regle query' }),
    });

    const first = await call('/api/v1/price-rules?source=studio', request());
    await expectContract(first, { status: 201 });

    const other = await call('/api/v1/price-rules?source=atelier', request());
    await expectContract(other, { status: 409 });
    expect(((await other.json()) as { code: string }).code).toBe('api.idempotency_key_reused');
  });

  it('CA9 — un PATCH sans If-Match est refuse en 428', async () => {
    const response = await call(`/api/v1/price-rules/${RULE_ID}`, {
      method: 'PATCH',
      headers: { ...asUser, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renommee' }),
    });
    await expectContract(response, { status: 428 });
    expect(((await response.json()) as { code: string }).code).toBe('api.if_match_required');
  });

  it('CA9 — If-Match: * est refuse, il desactiverait le controle de concurrence', async () => {
    const response = await call(`/api/v1/price-rules/${RULE_ID}`, {
      method: 'PATCH',
      headers: { ...asUser, 'Content-Type': 'application/json', 'If-Match': '*' },
      body: JSON.stringify({ name: 'Renommee' }),
    });
    await expectContract(response, { status: 400 });
    const body = (await response.json()) as { code: string; detail?: string };
    expect(body.code).toBe('api.if_match_invalid');
    expect(body.detail).toContain('desactiverait');
    // La ressource n a pas bouge : le PATCH n a jamais atteint son handler.
    expect(storedRule.name).toBe('Fidelite');
  });

  it('CA9 — un If-Match perime rend 409 avec l etat courant', async () => {
    const stale = await call(`/api/v1/price-rules/${RULE_ID}`, {
      method: 'PATCH',
      headers: {
        ...asUser,
        'Content-Type': 'application/json',
        'If-Match': '"0123456789abcdef0123456789abcdef"',
      },
      body: JSON.stringify({ name: 'Renommee' }),
    });
    await expectContract(stale, { status: 409 });
    const body = (await stale.json()) as { code: string; current_state: unknown };
    expect(body.code).toBe('api.resource_conflict');
    expect(body.current_state).toEqual(storedRule);
  });

  it('CA9 — un If-Match a jour passe et renvoie le nouvel ETag', async () => {
    const currentTag = await computeEntityTag(storedRule);
    const response = await call(`/api/v1/price-rules/${RULE_ID}`, {
      method: 'PATCH',
      headers: { ...asUser, 'Content-Type': 'application/json', 'If-Match': currentTag },
      body: JSON.stringify({ name: 'Renommee' }),
    });
    await expectContract(response, { status: 200 });
    expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]{32}"$/);
    expect(response.headers.get('etag')).not.toBe(currentTag);
  });

  it('route inconnue et methode non autorisee restent des Problem conformes', async () => {
    await expectContract(await call('/api/v1/inconnues', { headers: asUser }), { status: 404 });
    await expectContract(
      await call(`/api/v1/price-rules/${RULE_ID}`, { method: 'DELETE', headers: asUser }),
      { status: 405 },
    );
  });

  // ── E10.20a — QUATRIEME MODE, cloisonnement au niveau du SOCLE ───────────
  // (docs/api/CONVENTIONS.md §3.6 branche 4, §8.21). Meme structure que les
  // tests B1/B2 ci-dessus pour `shop_customer`, avec le meme objectif :
  // prouver le cloisonnement au niveau du SOCLE (gescom-middleware.ts /
  // tenant-resolution.ts), independamment de tout module applicatif.

  it('E10.20a — un porteur de lien atteint une route `upload_link`, et SEULEMENT elle', async () => {
    const response = await call(`/api/v1/price-rules/${RULE_ID}/fixture-upload-link-contexts`, {
      headers: asUploadLink,
    });
    await expectContract(response, { status: 200 });
    const body = (await response.json()) as { data: { linkId: string } };
    expect(body.data.linkId).toBe('link-1');
  });

  it('E10.20a — un jeton de lien absent ou invalide recoit 401 upload_link.invalid sur une route `upload_link`, CAUSE UNIQUE ET INDISTINCTE (arbitrage (F))', async () => {
    const missingHeader = await call(`/api/v1/price-rules/${RULE_ID}/fixture-upload-link-contexts`);
    expect(missingHeader.status).toBe(401);
    expect(((await missingHeader.json()) as { code: string }).code).toBe('upload_link.invalid');

    const wrongToken = await call(`/api/v1/price-rules/${RULE_ID}/fixture-upload-link-contexts`, {
      headers: { 'X-Magrit-Upload-Link': 'u'.repeat(40) },
    });
    expect(wrongToken.status).toBe(401);
    expect(((await wrongToken.json()) as { code: string }).code).toBe('upload_link.invalid');
  });

  it(
    'E10.20a — CLOISONNEMENT, sens 1 : un en-tete de lien SEUL (sans autre credential) sur une route qui ' +
      'ne declare pas `upload_link` est traite EXACTEMENT comme une requete non authentifiee (401), jamais ' +
      'resolu en principal puis refuse (qa-review round 1, B1 — correctif : l en-tete "ignore" hors de son ' +
      'mode signifie litteralement absent, pas "present mais refuse")',
    async () => {
      const response = await call('/api/v1/price-rules', { headers: asUploadLink });
      await expectContract(response, { status: 401 });
      const body = (await response.json()) as { code: string };
      // MEME code qu une requete totalement nue (aucun en-tete) : la preuve
      // que l en-tete n a eu AUCUN effet, pas meme celui de designer un
      // acteur refuse.
      expect(body.code).toBe('identity.authentication_required');
    },
  );

  it('E10.20a — CLOISONNEMENT, sens 2 : un jeton utilisateur/une cle de service/une session boutique n atteint JAMAIS une route `upload_link` (403)', async () => {
    const asUserResponse = await call(`/api/v1/price-rules/${RULE_ID}/fixture-upload-link-contexts`, {
      headers: asUser,
    });
    expect(asUserResponse.status).toBe(403);

    const asStudioResponse = await call(`/api/v1/price-rules/${RULE_ID}/fixture-upload-link-contexts`, {
      headers: { 'X-Magrit-Service-Key': 'cle-studio' },
    });
    expect(asStudioResponse.status).toBe(403);

    const asShopCustomerResponse = await call(`/api/v1/price-rules/${RULE_ID}/fixture-upload-link-contexts`, {
      headers: asShopCustomer,
    });
    expect(asShopCustomerResponse.status).toBe(403);
  });

  it('E10.20a (§3.6 branche 4) — cumuler X-Magrit-Upload-Link avec un Bearer sur une route `upload_link` est refuse en 400, le cumul ne peut etre que delibere', async () => {
    const response = await call(`/api/v1/price-rules/${RULE_ID}/fixture-upload-link-contexts`, {
      headers: { ...asUser, ...asUploadLink },
    });
    await expectContract(response, { status: 400 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('identity.actor_kind_required');
  });

  it('E10.20a (§3.6 branche 4) — sur une route qui ne declare PAS `upload_link`, l en-tete X-Magrit-Upload-Link porte passivement est IGNORE (200 normal, pas d erreur)', async () => {
    // Symetrique exact du test B1 (cookie storefront ignore sur une route
    // atelier) : un membre qui aurait par ailleurs ouvert un lien de depot
    // dans le meme navigateur ne doit jamais voir ses appels d atelier
    // bloques par cet en-tete.
    const response = await call('/api/v1/price-rules', { headers: { ...asUser, ...asUploadLink } });
    await expectContract(response, { status: 200 });
  });

  it('E10.20a — X-Magrit-Tenant sur une route `upload_link` est REFUSE en 400, jamais ignore (le lien porte deja le tenant)', async () => {
    const response = await call(`/api/v1/price-rules/${RULE_ID}/fixture-upload-link-contexts`, {
      headers: { ...asUploadLink, 'X-Magrit-Tenant': TENANT },
    });
    await expectContract(response, { status: 400 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.tenant_not_addressable');
  });

  it(
    'E10.20a (§8.21 §5, qa-review round 1 B2, BLOQUANT, corrige) — DEUX porteurs de liens DISTINCTS choisissant ' +
      'la MEME valeur d Idempotency-Key sur DEUX ressources differentes ne se bloquent plus mutuellement ' +
      '(`deriveUploadLinkIdempotencyStorageKey`, meme defaut de socle que celui corrige pour shop_customer en E10.10b-2)',
    async () => {
      const key = 'meme-cle-deux-liens-distincts-fixture';

      const first = await call(`/api/v1/price-rules/${RULE_ID}/fixture-upload-link-confirmations`, {
        method: 'POST',
        headers: { ...asUploadLink, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ filename: 'a.pdf' }),
      });
      expect(first.status).toBe(201);

      const second = await call(`/api/v1/price-rules/${RULE_ID}/fixture-upload-link-confirmations`, {
        method: 'POST',
        headers: { ...asUploadLink2, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ filename: 'b.pdf' }),
      });
      // AVANT le correctif (cle STOCKEE indexee sur le seul tenantId), le
      // second appel aurait recu 409 api.idempotency_key_reused : deux
      // porteurs de liens DISTINCTS du MEME imprimeur partageaient la meme
      // entree (tenantId, idempotency_key).
      expect(second.status).toBe(201);
      const secondBody = (await second.json()) as { data: { linkId: string; filename: string } };
      expect(secondBody.data.linkId).toBe('link-2');
      expect(secondBody.data.filename).toBe('b.pdf');
    },
  );

  it(
    'E10.20a (§8.21 §5, qa-review round 1 B2) — la MEME cle, pour le MEME lien, reste rejouee (pas une ' +
      'seconde ecriture) — la derivation ne casse pas l idempotence intra-lien',
    async () => {
      const key = 'meme-lien-rejeu-fixture';
      const first = await call(`/api/v1/price-rules/${RULE_ID}/fixture-upload-link-confirmations`, {
        method: 'POST',
        headers: { ...asUploadLink, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ filename: 'c.pdf' }),
      });
      expect(first.status).toBe(201);

      const replay = await call(`/api/v1/price-rules/${RULE_ID}/fixture-upload-link-confirmations`, {
        method: 'POST',
        headers: { ...asUploadLink, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ filename: 'c.pdf' }),
      });
      expect(replay.status).toBe(201);
      expect(replay.headers.get('idempotency-replayed')).toBe('true');
    },
  );

  it(
    'qa-review round 1 (B1, BLOQUANT, corrige) — SYMETRIQUE du test B1 shop_customer : un cookie de ' +
      'session boutique VALIDE + un en-tete X-Magrit-Upload-Link SANS RAPPORT sur une route `shop_customer` ' +
      "doit resoudre le cookie, PAS le lien — E10.20b sert la page de depot sur la MEME ORIGINE que la " +
      'boutique, le cookie et l en-tete peuvent donc s attacher ENSEMBLE a une requete boutique legitime',
    async () => {
      const response = await call(`/api/v1/price-rules/${RULE_ID}/fixture-decisions`, {
        method: 'POST',
        headers: {
          ...asShopCustomer,
          ...asUploadLink,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'b1-symmetric-cookie-plus-upload-link',
        },
        body: JSON.stringify({ decision: 'accepted' }),
      });
      // AVANT le correctif : l en-tete de lien gagnait INCONDITIONNELLEMENT
      // sur le cookie (meme hors de son propre mode) — `credential`
      // resolvait `upload_link`, `cookiePresentWithExplicit` devenait donc
      // `false` (le refus 400 attendu ne se declenchait pas non plus), et le
      // principal resolu (`upload_link`) etait refuse en 403
      // `identity.actor_kind_required` sur cette route `shop_customer` — un
      // acheteur pourtant legitimement connecte se voyait refuser l acces.
      await expectContract(response, { status: 201 });
      const body = (await response.json()) as { data: { accountId: string; decision: string } };
      expect(body.data.accountId).toBe('account-1');
    },
  );
});
