import { describe, expect, it } from 'vitest';
import { LEGACY_ROUTE_DEFINITIONS } from '@/server/api/legacy-routes';
import { loadContract, isRecord } from './_harness.ts';

const HTTP_METHODS = new Set(['get', 'put', 'post', 'patch', 'delete']);

function contractRoutes(): Set<string> {
  const paths = loadContract()['paths'];
  if (!isRecord(paths)) return new Set();

  return new Set(
    Object.entries(paths).flatMap(([path, item]) => {
      if (!isRecord(item)) return [];
      return Object.keys(item)
        .filter((method) => HTTP_METHODS.has(method))
        .map((method) => `${method.toUpperCase()} /api/v1${path}`);
    }),
  );
}

describe('couverture des routes API par le contrat OpenAPI', () => {
  it('documente chaque route historique active', () => {
    const documented = contractRoutes();
    const missing = LEGACY_ROUTE_DEFINITIONS
      .map((route) => `${route.method} ${route.path}`)
      .filter((route) => !documented.has(route));

    expect(missing, 'routes actives absentes du contrat OpenAPI').toEqual([]);
  });
});