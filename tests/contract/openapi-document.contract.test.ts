/**
 * Conformite du contrat lui-meme (story E10.0, CA1 a CA13).
 *
 * Chaque regle est verifiee dans LES DEUX SENS : le vrai contrat doit passer,
 * et un document volontairement fautif doit etre refuse. Une regle qui ne sait
 * rien refuser ne prouve rien sur la CI.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTRACT_PATH,
  GENERATED_TYPES_PATH,
  contractSchemaNames,
  loadContract,
} from './_harness.ts';
import {
  lintConcurrency,
  lintContract,
  lintDocumentShape,
  lintEventBus,
  lintIdempotency,
  lintPagination,
  lintOperationCoverage,
  lintPathNaming,
  lintRequiredScopes,
  lintResponseShapes,
  lintSecuritySchemes,
  lintSharedParameterDefinitions,
  lintTenantNeverAddressed,
  REQUIRED_EVENT_NAMES,
} from './_lint.ts';

const contract = loadContract();

/** Document minimal conforme, servant de base aux fixtures fautives. */
function baseDocument(): Record<string, unknown> {
  return structuredClone(contract) as Record<string, unknown>;
}

function withPath(path: string, item: unknown): Record<string, unknown> {
  const document = baseDocument();
  document['paths'] = { [path]: item };
  return document;
}

describe('contrat OpenAPI magrit-core v1', () => {
  it('CA1 — le contrat existe, est un OpenAPI 3.1 et fait foi', () => {
    expect(existsSync(resolve(process.cwd(), CONTRACT_PATH))).toBe(true);
    expect(lintDocumentShape(contract)).toEqual([]);
    expect(contract['openapi']).toMatch(/^3\.1/);
  });

  it('CA1 — l ancien contrat est explicitement deprecie pour les endpoints E10', () => {
    const legacy = readFileSync(
      resolve(process.cwd(), 'docs/architecture/api/openapi.yaml'),
      'utf8',
    );
    expect(legacy).toContain('DEPRECIE POUR TOUT NOUVEL ENDPOINT');
    expect(legacy).toContain(CONTRACT_PATH);
  });

  it('CA2 — les types TypeScript sont derives du contrat, pas ecrits a la main', () => {
    const generated = readFileSync(resolve(process.cwd(), GENERATED_TYPES_PATH), 'utf8');
    expect(generated).toContain('FICHIER GENERE — NE PAS EDITER A LA MAIN.');
    expect(generated).toContain(CONTRACT_PATH);
    // Tout schema du contrat est expose comme type racine : un schema ajoute
    // au YAML sans regeneration fait echouer ce test.
    for (const name of contractSchemaNames()) {
      expect(generated, `type manquant pour le schema ${name}`).toContain(
        `export type ${name} = components['schemas']['${name}'];`,
      );
    }
  });

  it('CA3 — prefixe /api/v1 et ressources au pluriel en kebab-case', () => {
    expect(lintPathNaming(contract)).toEqual([]);
    expect(lintPathNaming(withPath('/PriceRules', { get: {} }))).toEqual([
      'CA3 : chemin "/PriceRules" — le segment "PriceRules" doit etre en kebab-case.',
    ]);
    expect(lintPathNaming(withPath('/price-rule', { get: {} }))).toEqual([
      'CA3 : chemin "/price-rule" — la ressource "price-rule" doit etre au pluriel.',
    ]);
    expect(lintPathNaming(withPath('/api/v1/price-rules', { get: {} })).length).toBeGreaterThan(0);
  });

  it('CA3 — la regle de pluriel du contrat et celle du code sont la meme', () => {
    // Le lint et `assertRoutePath` importent tous deux `checkResourcePath` :
    // ils ne peuvent plus diverger sur les sous-ressources, ce qui etait le cas
    // quand la regle existait en deux exemplaires.
    expect(lintPathNaming(withPath('/price-rules/{ruleId}/history', { get: {} }))).toEqual([
      'CA3 : chemin "/price-rules/{ruleId}/history" — la ressource "history" doit etre au pluriel.',
    ]);
    expect(lintPathNaming(withPath('/price-rules/{ruleId}/revisions', { get: {} }))).toEqual([]);
  });

  it('CA4 — le tenant n est jamais adressable par le chemin ni la requete', () => {
    expect(lintTenantNeverAddressed(contract)).toEqual([]);
    const byPath = withPath('/tenants/{tenantId}/price-rules', { get: { responses: {} } });
    expect(lintTenantNeverAddressed(byPath).length).toBeGreaterThan(0);
    const byQuery = withPath('/price-rules', {
      get: { parameters: [{ name: 'tenant_id', in: 'query' }], responses: {} },
    });
    expect(lintTenantNeverAddressed(byQuery)).toContain(
      'CA4 : GET /price-rules declare le parametre query "tenant_id".',
    );
  });

  it('CA5 — Bearer JWT utilisateur et cle de service a scopes explicites', () => {
    expect(lintSecuritySchemes(contract)).toEqual([]);

    const schemes = (contract['components'] as Record<string, unknown>)['securitySchemes'];
    expect(schemes).toMatchObject({
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      serviceKey: { type: 'apiKey', in: 'header', name: 'X-Magrit-Service-Key' },
    });

    const stripped = baseDocument();
    delete (stripped['components'] as Record<string, unknown>)['securitySchemes'];
    expect(lintSecuritySchemes(stripped)).toEqual(['CA5 : components.securitySchemes est absent.']);
  });

  it('CA5 — une operation joignable par cle de service declare ses x-required-scopes', () => {
    expect(lintRequiredScopes(contract)).toEqual([]);

    const undeclared = withPath('/price-rules', {
      post: { security: [{ serviceKey: [] }], responses: {} },
    });
    expect(lintRequiredScopes(undeclared)).toEqual([
      'CA5 : POST /price-rules est joignable par cle de service sans x-required-scopes.',
    ]);

    const unknownScope = withPath('/price-rules', {
      post: {
        security: [{ serviceKey: [] }],
        'x-required-scopes': ['price-rules:destroy'],
        responses: {},
      },
    });
    expect(lintRequiredScopes(unknownScope)).toEqual([
      'CA5 : POST /price-rules exige le scope "price-rules:destroy", absent de x-magrit-scopes.',
    ]);

    const compliant = withPath('/price-rules', {
      post: {
        security: [{ serviceKey: [] }],
        'x-required-scopes': ['price-rules:write'],
        responses: {},
      },
    });
    expect(lintRequiredScopes(compliant)).toEqual([]);
  });

  it('CA4/CA6/CA8 — toute operation declare MagritTenant et ses statuts atteignables', () => {
    expect(lintOperationCoverage(contract)).toEqual([]);

    // MagritTenant absent : un client pilote par le contrat ignorerait qu il
    // doit choisir son espace. C etait le cas des 9 operations avant ce lot.
    const withoutTenant = withPath('/price-rules', {
      get: { responses: { '200': {}, '400': {}, '401': {}, '403': {} } },
    });
    expect(lintOperationCoverage(withoutTenant)).toEqual([
      'CA4 : GET /price-rules ne declare pas MagritTenant — un client pilote par le contrat ignorerait qu il doit choisir son espace.',
    ]);

    // Statuts que resolvePrincipal peut lever sur n importe quelle operation.
    const missingStatuses = withPath('/price-rules', {
      parameters: [{ $ref: '#/components/parameters/MagritTenant' }],
      get: { responses: { '200': {}, '401': {} } },
    });
    expect(lintOperationCoverage(missingStatuses)).toEqual([
      'CA6 : GET /price-rules ne declare pas la reponse 400, pourtant atteignable.',
      'CA6 : GET /price-rules ne declare pas la reponse 403, pourtant atteignable.',
    ]);

    // Une creation passe par l idempotence, qui peut lever 409.
    const creationWithoutConflict = withPath('/price-rules', {
      parameters: [{ $ref: '#/components/parameters/MagritTenant' }],
      post: { responses: { '201': {}, '400': {}, '401': {}, '403': {} } },
    });
    expect(lintOperationCoverage(creationWithoutConflict)).toEqual([
      'CA8 : POST /price-rules cree une ressource sans declarer 409 — l idempotence peut le lever.',
    ]);

    // Un parametre herite du CHEMIN vaut declaration : c est la semantique
    // OpenAPI, et c est la forme retenue par la facade.
    const inheritedFromPath = withPath('/price-rules', {
      parameters: [{ $ref: '#/components/parameters/MagritTenant' }],
      get: { responses: { '200': {}, '400': {}, '401': {}, '403': {} } },
    });
    expect(lintOperationCoverage(inheritedFromPath)).toEqual([]);
  });

  it('les parametres partages sont epingles sur leur nom et leur emplacement', () => {
    expect(lintSharedParameterDefinitions(contract)).toEqual([]);

    // La mutation exacte relevee par la revue : un composant qui glisse en
    // query. Les operations qui le referencent promettraient une idempotence
    // par query string, que le middleware ne lit pas.
    const slipped = baseDocument();
    const parameters = (slipped['components'] as Record<string, unknown>)['parameters'] as Record<
      string,
      Record<string, unknown>
    >;
    parameters['IdempotencyKey'] = { ...parameters['IdempotencyKey'], in: 'query' };
    expect(lintSharedParameterDefinitions(slipped)).toEqual([
      'components/parameters/IdempotencyKey doit etre transmis en header, trouve "query".',
    ]);

    const renamed = baseDocument();
    const renamedParameters = (renamed['components'] as Record<string, unknown>)[
      'parameters'
    ] as Record<string, Record<string, unknown>>;
    renamedParameters['MagritTenant'] = { ...renamedParameters['MagritTenant'], name: 'X-Tenant' };
    expect(lintSharedParameterDefinitions(renamed)).toEqual([
      'components/parameters/MagritTenant doit se nommer "X-Magrit-Tenant", trouve "X-Tenant".',
    ]);
  });

  it('un $ref est RESOLU, pas cru sur son nom', () => {
    // Sans resolution, la regle voyait « le $ref finit par /IdempotencyKey »
    // et validait, quel que soit ce que le composant declare vraiment.
    const document = baseDocument();
    const parameters = (document['components'] as Record<string, unknown>)['parameters'] as Record<
      string,
      Record<string, unknown>
    >;
    parameters['IdempotencyKey'] = { ...parameters['IdempotencyKey'], in: 'query' };
    document['paths'] = {
      '/price-rules': {
        parameters: [{ $ref: '#/components/parameters/MagritTenant' }],
        post: {
          parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
          responses: { '201': {}, '400': {}, '401': {}, '403': {}, '409': {} },
        },
      },
    };

    expect(lintIdempotency(document)).toEqual([
      'CA8 : POST /price-rules cree une ressource sans declarer Idempotency-Key.',
    ]);

    // Une reference qui pointe dans le vide ne vaut pas declaration non plus.
    const dangling = baseDocument();
    dangling['paths'] = {
      '/price-rules': {
        parameters: [{ $ref: '#/components/parameters/MagritTenant' }],
        post: {
          parameters: [{ $ref: '#/components/parameters/Inexistant' }],
          responses: { '201': {}, '400': {}, '401': {}, '403': {}, '409': {} },
        },
      },
    };
    expect(lintIdempotency(dangling)).toHaveLength(1);
  });

  it('CA4/CA6 — une operation publique est dispensee de tenant et d authentification', () => {
    // `security: []` retire toute exigence d authentification : pas d espace a
    // choisir, pas d acteur a resoudre, donc ni MagritTenant ni 401/403.
    const publicOperation = withPath('/public-catalogs', {
      get: { security: [], responses: { '200': {} } },
    });
    expect(lintOperationCoverage(publicOperation)).toEqual([]);

    // La dispense ne vaut que pour `security: []`, pas pour une operation qui
    // omet simplement le champ.
    const notPublic = withPath('/public-catalogs', { get: { responses: { '200': {} } } });
    expect(lintOperationCoverage(notPublic).length).toBeGreaterThan(0);
  });

  it('CA8/CA9 — Idempotency-Key et If-Match sont reconnus sous leur forme $ref', () => {
    // Les regles ne lisaient que la forme en clair : une operation qui
    // referencait le composant partage aurait ete signalee a tort.
    const byReference = withPath('/price-rules', {
      parameters: [{ $ref: '#/components/parameters/MagritTenant' }],
      post: {
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        responses: { '201': {}, '400': {}, '401': {}, '403': {}, '409': {} },
      },
      patch: {
        parameters: [{ $ref: '#/components/parameters/IfMatch' }],
        responses: { '200': {}, '400': {}, '401': {}, '403': {}, '409': {} },
      },
    });
    expect(lintIdempotency(byReference)).toEqual([]);
    expect(lintConcurrency(byReference)).toEqual([]);
  });

  it('CA6 — enveloppe data/meta en succes, problem+json avec code en erreur', () => {
    expect(lintResponseShapes(contract)).toEqual([]);

    const wrongMediaType = withPath('/price-rules', {
      get: { responses: { '404': { content: { 'application/json': {} } } } },
    });
    expect(lintResponseShapes(wrongMediaType)).toContain(
      'CA6 : GET /price-rules 404 doit etre servi en application/problem+json.',
    );
  });

  it('CA7 — pagination par curseur, jamais par offset', () => {
    expect(lintPagination(contract)).toEqual([]);

    const offsetPaged = withPath('/price-rules', {
      get: { parameters: [{ name: 'offset', in: 'query' }], responses: {} },
    });
    expect(lintPagination(offsetPaged)).toContain(
      'CA7 : GET /price-rules pagine par "offset" au lieu d un curseur.',
    );
  });

  it('CA8 — tout POST creant une ressource declare Idempotency-Key', () => {
    expect(lintIdempotency(contract)).toEqual([]);

    const missing = withPath('/price-rules', { post: { responses: { '201': {} } } });
    expect(lintIdempotency(missing)).toEqual([
      'CA8 : POST /price-rules cree une ressource sans declarer Idempotency-Key.',
    ]);

    const compliant = withPath('/price-rules', {
      post: {
        parameters: [{ name: 'Idempotency-Key', in: 'header' }],
        responses: { '201': {} },
      },
    });
    expect(lintIdempotency(compliant)).toEqual([]);
  });

  it('CA9 — tout PATCH declare If-Match et un conflit 409', () => {
    expect(lintConcurrency(contract)).toEqual([]);

    const missing = withPath('/price-rules/{ruleId}', { patch: { responses: { '200': {} } } });
    expect(lintConcurrency(missing)).toEqual([
      'CA9 : PATCH /price-rules/{ruleId} ne declare pas If-Match.',
      'CA9 : PATCH /price-rules/{ruleId} ne declare pas de reponse 409 de conflit.',
    ]);
  });

  it('CA9 (E10.2) — un PUT est soumis a la MEME regle qu un PATCH (If-Match + 409)', () => {
    // Le middleware socle (gescom-middleware.ts) protege PATCH ET PUT de la
    // meme garde de concurrence optimiste depuis E10.2 (PUT
    // /projects/{id}/tags) : ce controle NEGATIF prouve que le lint refuse
    // desormais un PUT fautif exactement comme il refuse deja un PATCH
    // fautif, et pas seulement que le vrai contrat est propre.
    const missingPut = withPath('/price-rules/{ruleId}/tags', { put: { responses: { '200': {} } } });
    expect(lintConcurrency(missingPut)).toEqual([
      'CA9 : PUT /price-rules/{ruleId}/tags ne declare pas If-Match.',
      'CA9 : PUT /price-rules/{ruleId}/tags ne declare pas de reponse 409 de conflit.',
    ]);

    const compliantPut = withPath('/price-rules/{ruleId}/tags', {
      put: {
        parameters: [{ name: 'If-Match', in: 'header' }],
        responses: { '200': {}, '409': {} },
      },
    });
    expect(lintConcurrency(compliantPut)).toEqual([]);
  });

  it('CA10 — les cinq evenements du sprint sont decrits, payload versionne et signe', () => {
    expect(lintEventBus(contract)).toEqual([]);

    const webhooks = contract['webhooks'] as Record<string, unknown>;
    for (const name of REQUIRED_EVENT_NAMES) expect(Object.keys(webhooks)).toContain(name);

    const stripped = baseDocument();
    stripped['webhooks'] = {};
    expect(lintEventBus(stripped).length).toBe(REQUIRED_EVENT_NAMES.length);
  });

  it('CA13 — v1 additive : la regle est ecrite dans le contrat et dans les conventions', () => {
    const source = readFileSync(resolve(process.cwd(), CONTRACT_PATH), 'utf8');
    expect(source).toContain('ADDITIVE');
    expect(source).toContain('/api/v2');

    const conventions = readFileSync(resolve(process.cwd(), 'docs/api/CONVENTIONS.md'), 'utf8');
    expect(conventions).toContain('/api/v2');
  });

  it('le contrat complet ne porte aucune violation', () => {
    expect(lintContract(contract)).toEqual([]);
  });
});
