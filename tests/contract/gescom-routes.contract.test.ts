/**
 * Le CODE contre le CONTRAT (story E10.0, CA1 — correctif qa-review B2).
 *
 * Les autres tests de contrat n inspectent que le document OpenAPI. Aucun ne
 * regardait les routes reellement declarees en code : une story pouvait donc
 * appeler `defineGescomRoute({ operationId: 'createCustomer', ... })` sans
 * jamais toucher au YAML, et toute la CI restait verte.
 *
 * Ce fichier ferme le trou. Il lit le registre `GESCOM_ROUTES` et exige que
 * chaque route y figurant corresponde a une operation reelle du contrat.
 */
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { GESCOM_ROUTES, defineGescomRoute } from '@/server/api';
import { loadContract } from './_harness.ts';
import { lintRoutesAgainstContract, type RegisteredRoute } from './_lint.ts';

const contract = loadContract();

/**
 * Exemptions — FIXTURES DE TEST UNIQUEMENT.
 *
 * Ces operationId appartiennent a des routes jetables montees par
 * `gescom-middleware.contract.test.ts` pour exercer le middleware. Aucune route
 * de production ne doit figurer ici : une route exemptee est une route dont
 * personne ne verifie qu elle est decrite au partenaire.
 */
export const TEST_FIXTURE_OPERATION_IDS = [
  'fixtureListPriceRules',
  'fixtureCreatePriceRule',
  'fixtureUpdatePriceRule',
  'fixtureTenantInPath',
  'fixtureBadPath',
  'fixtureNoScopes',
] as const;

function asRegistered(routes: readonly RegisteredRoute[]): readonly RegisteredRoute[] {
  return routes;
}

describe('routes declarees en code contre le contrat', () => {
  it('CA1 — chaque route enregistree existe dans openapi/magrit-core.v1.yaml', () => {
    // E10.0 n enregistre aucune route : le socle ne publie pas d endpoint.
    // Le test n est pas decoratif pour autant — il mord des la premiere route
    // ajoutee au registre par une story E10.x.
    expect(
      lintRoutesAgainstContract(
        asRegistered(GESCOM_ROUTES),
        contract,
        TEST_FIXTURE_OPERATION_IDS,
      ),
    ).toEqual([]);
  });

  it('CA1 — une route absente du contrat est refusee, chemin comme operationId', () => {
    // E10.4 decrit desormais reellement /customers : le placeholder de ce test
    // doit rester un chemin garanti absent du contrat, pas une ressource qui a
    // fini par exister.
    const undescribed = defineGescomRoute({
      method: 'POST',
      path: '/unregistered-resources',
      operationId: 'createUnregisteredResource',
      requiredScopes: ['customers:write'],
      createsResource: true,
      inputSchema: z.object({ name: z.string() }),
      dataSchema: z.object({ id: z.string() }),
      async handle() {
        return { status: 201, data: { id: 'x' } };
      },
    });

    const violations = lintRoutesAgainstContract([undescribed], contract);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain(
      'POST /unregistered-resources (createUnregisteredResource)',
    );
    expect(violations[0]).toContain("n est decrit par aucun chemin du contrat");
  });

  it('CA1 — un operationId qui ne correspond pas a celui du contrat est refuse', () => {
    const document = structuredClone(contract) as Record<string, unknown>;
    document['paths'] = {
      '/customers': {
        post: { operationId: 'createCustomerAccount', 'x-required-scopes': ['customers:write'] },
      },
    };

    const route: RegisteredRoute = {
      method: 'POST',
      relativePath: '/customers',
      operationId: 'createCustomer',
      requiredScopes: ['customers:write'],
      authentication: 'any',
    };
    const violations = lintRoutesAgainstContract([route], document);
    expect(violations).toEqual([
      'CA1 : POST /customers (createCustomer) — le contrat annonce operationId "createCustomerAccount".',
    ]);
  });

  it('CA1 — une methode non decrite sur un chemin decrit est refusee', () => {
    const document = structuredClone(contract) as Record<string, unknown>;
    document['paths'] = { '/customers': { get: { operationId: 'listCustomers' } } };

    const route: RegisteredRoute = {
      method: 'DELETE',
      relativePath: '/customers',
      operationId: 'deleteCustomers',
      requiredScopes: ['customers:write'],
      authentication: 'any',
    };
    expect(lintRoutesAgainstContract([route], document)).toEqual([
      'CA1 : DELETE /customers (deleteCustomers) — le contrat ne decrit pas cette methode sur ce chemin.',
    ]);
  });

  it('CA5 — un scope exige par le code mais absent du contrat est refuse', () => {
    const document = structuredClone(contract) as Record<string, unknown>;
    document['paths'] = {
      '/customers': {
        post: { operationId: 'createCustomer', 'x-required-scopes': ['customers:read'] },
      },
    };

    const route: RegisteredRoute = {
      method: 'POST',
      relativePath: '/customers',
      operationId: 'createCustomer',
      requiredScopes: ['customers:write'],
      authentication: 'any',
    };
    expect(lintRoutesAgainstContract([route], document)).toEqual([
      'CA5 : POST /customers (createCustomer) exige les scopes customers:write, absents de x-required-scopes du contrat.',
    ]);
  });

  it('une route conforme au contrat ne produit aucune violation', () => {
    const document = structuredClone(contract) as Record<string, unknown>;
    document['paths'] = {
      '/customers': {
        post: { operationId: 'createCustomer', 'x-required-scopes': ['customers:write'] },
      },
    };

    const route: RegisteredRoute = {
      method: 'POST',
      relativePath: '/customers',
      operationId: 'createCustomer',
      requiredScopes: ['customers:write'],
      authentication: 'any',
    };
    expect(lintRoutesAgainstContract([route], document)).toEqual([]);
  });
});
