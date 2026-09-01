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
  lintPathNaming,
  lintRequiredScopes,
  lintResponseShapes,
  lintSecuritySchemes,
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
