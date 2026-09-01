/**
 * Regles de conformite du contrat OpenAPI (story E10.0).
 *
 * Fonctions PURES : elles prennent un document et rendent la liste des
 * violations. Elles sont exercees dans les deux sens par les tests — contre le
 * vrai contrat (qui doit etre propre) et contre des documents volontairement
 * fautifs (qui doivent etre rejetes). Une regle qui ne sait rien refuser ne
 * garantit rien.
 *
 * Chaque regle porte le numero du critere d acceptation qu elle tient.
 */
import { isRecord } from './_harness.ts';

export const API_BASE_PATH = '/api/v1';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const KEBAB_SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PATH_PARAM_SEGMENT = /^\{[A-Za-z][A-Za-z0-9_]*\}$/;
const TENANT_TOKENS = ['tenant', 'tenant_id', 'tenantid', 'tenant-id', 'espace'];

export const REQUIRED_EVENT_NAMES = [
  'quote.converted',
  'order.step_changed',
  'order.files_submitted',
  'customer.created',
  'price_rule.changed',
] as const;

type Doc = Readonly<Record<string, unknown>>;

/** CA1 : le document est un OpenAPI 3.1 servi sous le prefixe /api/v1. */
export function lintDocumentShape(document: Doc): string[] {
  const violations: string[] = [];
  const version = document['openapi'];
  if (typeof version !== 'string' || !version.startsWith('3.1')) {
    violations.push(`CA1 : openapi doit valoir 3.1.x, trouve "${String(version)}".`);
  }
  const servers = document['servers'];
  const first = Array.isArray(servers) ? servers[0] : undefined;
  if (!isRecord(first) || first['url'] !== API_BASE_PATH) {
    violations.push(`CA3 : servers[0].url doit valoir "${API_BASE_PATH}".`);
  }
  if (!isRecord(document['components'])) {
    violations.push('CA1 : le contrat doit declarer une section components.');
  }
  return violations;
}

/** CA3 : prefixe /api/v1, ressources au pluriel en kebab-case. */
export function lintPathNaming(document: Doc): string[] {
  const violations: string[] = [];
  for (const path of Object.keys(pathsOf(document))) {
    if (!path.startsWith('/')) {
      violations.push(`CA3 : le chemin "${path}" doit commencer par /.`);
      continue;
    }
    if (path.startsWith(API_BASE_PATH)) {
      violations.push(
        `CA3 : le chemin "${path}" ne doit pas repeter le prefixe ${API_BASE_PATH}, porte par servers[0].url.`,
      );
    }
    const segments = path.slice(1).split('/');
    segments.forEach((segment, index) => {
      if (PATH_PARAM_SEGMENT.test(segment)) return;
      if (!KEBAB_SEGMENT.test(segment)) {
        violations.push(`CA3 : segment "${segment}" du chemin "${path}" non kebab-case.`);
        return;
      }
      // Les segments en position paire nomment une ressource : ils sont au
      // pluriel. Les positions impaires sont des identifiants.
      if (index % 2 === 0 && !segment.endsWith('s')) {
        violations.push(`CA3 : ressource "${segment}" du chemin "${path}" doit etre au pluriel.`);
      }
    });
  }
  return violations;
}

/** CA4 : le tenant n est jamais adressable par le chemin ni la requete. */
export function lintTenantNeverAddressed(document: Doc): string[] {
  const violations: string[] = [];
  for (const [path, item] of Object.entries(pathsOf(document))) {
    for (const token of TENANT_TOKENS) {
      if (path.toLowerCase().includes(`{${token}}`) || path.toLowerCase().includes(`/${token}s/`)) {
        violations.push(`CA4 : le chemin "${path}" adresse un tenant. Il vient du jeton.`);
      }
    }
    for (const [method, operation] of operationsOf(item)) {
      for (const parameter of parametersOf(operation)) {
        const name = typeof parameter['name'] === 'string' ? parameter['name'].toLowerCase() : '';
        const location = parameter['in'];
        if ((location === 'path' || location === 'query') && TENANT_TOKENS.includes(name)) {
          violations.push(
            `CA4 : ${method.toUpperCase()} ${path} declare le parametre ${location} "${name}".`,
          );
        }
      }
    }
  }
  return violations;
}

/** CA5 : deux modes d authentification, la cle de service porte des scopes. */
export function lintSecuritySchemes(document: Doc): string[] {
  const violations: string[] = [];
  const components = document['components'];
  const schemes = isRecord(components) ? components['securitySchemes'] : undefined;
  if (!isRecord(schemes)) {
    return ['CA5 : components.securitySchemes est absent.'];
  }

  const bearer = schemes['bearerAuth'];
  if (!isRecord(bearer) || bearer['type'] !== 'http' || bearer['scheme'] !== 'bearer') {
    violations.push('CA5 : bearerAuth doit etre un schema http bearer.');
  }

  const service = schemes['serviceKey'];
  if (!isRecord(service)) {
    violations.push('CA5 : serviceKey est absent.');
    return violations;
  }
  if (service['type'] !== 'apiKey' || service['in'] !== 'header') {
    violations.push('CA5 : serviceKey doit etre une apiKey transmise en en-tete.');
  }
  const scopes = service['x-magrit-scopes'];
  if (!isRecord(scopes) || Object.keys(scopes).length === 0) {
    violations.push('CA5 : serviceKey doit enumerer ses scopes dans x-magrit-scopes.');
  }
  return violations;
}

/** CA6 : enveloppe data/meta en succes, problem+json avec code en erreur. */
export function lintResponseShapes(document: Doc): string[] {
  const violations: string[] = [];
  const components = document['components'];
  const schemas = isRecord(components) ? components['schemas'] : undefined;

  if (isRecord(schemas)) {
    const envelope = schemas['SuccessEnvelope'];
    const required = isRecord(envelope) ? envelope['required'] : undefined;
    if (!Array.isArray(required) || !required.includes('data') || !required.includes('meta')) {
      violations.push('CA6 : SuccessEnvelope doit exiger data et meta.');
    }
    const problem = schemas['Problem'];
    const problemRequired = isRecord(problem) ? problem['required'] : undefined;
    for (const field of ['type', 'title', 'status', 'code', 'request_id']) {
      if (!Array.isArray(problemRequired) || !problemRequired.includes(field)) {
        violations.push(`CA6 : Problem doit exiger le champ "${field}".`);
      }
    }
  } else {
    violations.push('CA6 : components.schemas est absent.');
  }

  // Les reponses d erreur mutualisees sont referencees par $ref depuis les
  // operations : les verifier a la source couvre tous leurs usages.
  const sharedResponses = isRecord(components) ? components['responses'] : undefined;
  if (isRecord(sharedResponses)) {
    for (const [name, response] of Object.entries(sharedResponses)) {
      const mediaTypes = mediaTypesOf(response);
      if (!mediaTypes.includes('application/problem+json')) {
        violations.push(
          `CA6 : la reponse partagee "${name}" doit etre servie en application/problem+json.`,
        );
      }
    }
  }

  for (const [path, item] of Object.entries(pathsOf(document))) {
    for (const [method, operation] of operationsOf(item)) {
      const responses = operation['responses'];
      if (!isRecord(responses)) {
        violations.push(`CA6 : ${method.toUpperCase()} ${path} ne declare aucune reponse.`);
        continue;
      }
      for (const [status, response] of Object.entries(responses)) {
        const code = Number(status);
        if (!Number.isFinite(code)) continue;
        const mediaTypes = mediaTypesOf(response);
        if (mediaTypes.length === 0) continue;
        if (code >= 400 && !mediaTypes.includes('application/problem+json')) {
          violations.push(
            `CA6 : ${method.toUpperCase()} ${path} ${status} doit etre servi en application/problem+json.`,
          );
        }
        if (code < 400 && code >= 200 && !mediaTypes.includes('application/json')) {
          violations.push(
            `CA6 : ${method.toUpperCase()} ${path} ${status} doit etre servi en application/json.`,
          );
        }
      }
    }
  }
  return violations;
}

/** CA7 : pagination par curseur, next_cursor dans meta. */
export function lintPagination(document: Doc): string[] {
  const violations: string[] = [];
  const components = document['components'];
  const parameters = isRecord(components) ? components['parameters'] : undefined;
  const schemas = isRecord(components) ? components['schemas'] : undefined;

  const size = isRecord(parameters) ? parameters['PageSize'] : undefined;
  if (!isRecord(size) || size['name'] !== 'page[size]' || size['in'] !== 'query') {
    violations.push('CA7 : le parametre PageSize doit etre la query "page[size]".');
  }
  const cursor = isRecord(parameters) ? parameters['PageCursor'] : undefined;
  if (!isRecord(cursor) || cursor['name'] !== 'page[cursor]' || cursor['in'] !== 'query') {
    violations.push('CA7 : le parametre PageCursor doit etre la query "page[cursor]".');
  }
  const meta = isRecord(schemas) ? schemas['Meta'] : undefined;
  const metaProperties = isRecord(meta) ? meta['properties'] : undefined;
  if (!isRecord(metaProperties) || !('next_cursor' in metaProperties)) {
    violations.push('CA7 : Meta doit porter next_cursor.');
  }

  // Aucune operation ne pagine par offset.
  for (const [path, item] of Object.entries(pathsOf(document))) {
    for (const [method, operation] of operationsOf(item)) {
      for (const parameter of parametersOf(operation)) {
        const name = typeof parameter['name'] === 'string' ? parameter['name'] : '';
        if (['offset', 'page', 'page[number]', 'skip'].includes(name)) {
          violations.push(
            `CA7 : ${method.toUpperCase()} ${path} pagine par "${name}" au lieu d un curseur.`,
          );
        }
      }
    }
  }
  return violations;
}

/** CA8 : tout POST creant une ressource honore Idempotency-Key. */
export function lintIdempotency(document: Doc): string[] {
  const violations: string[] = [];
  for (const [path, item] of Object.entries(pathsOf(document))) {
    for (const [method, operation] of operationsOf(item)) {
      if (method !== 'post') continue;
      const responses = isRecord(operation['responses']) ? operation['responses'] : {};
      const creates = Object.keys(responses).includes('201');
      if (!creates) continue;
      const declared = parametersOf(operation).some(
        (parameter) => parameter['in'] === 'header' && parameter['name'] === 'Idempotency-Key',
      );
      if (!declared) {
        violations.push(`CA8 : POST ${path} cree une ressource sans declarer Idempotency-Key.`);
      }
    }
  }
  return violations;
}

/** CA9 : tout PATCH declare If-Match et une reponse 409. */
export function lintConcurrency(document: Doc): string[] {
  const violations: string[] = [];
  for (const [path, item] of Object.entries(pathsOf(document))) {
    for (const [method, operation] of operationsOf(item)) {
      if (method !== 'patch') continue;
      const declared = parametersOf(operation).some(
        (parameter) => parameter['in'] === 'header' && parameter['name'] === 'If-Match',
      );
      if (!declared) violations.push(`CA9 : PATCH ${path} ne declare pas If-Match.`);
      const responses = isRecord(operation['responses']) ? operation['responses'] : {};
      if (!Object.keys(responses).includes('409')) {
        violations.push(`CA9 : PATCH ${path} ne declare pas de reponse 409 de conflit.`);
      }
    }
  }
  return violations;
}

/** CA10 : bus d evenements, payload versionne, signature HMAC. */
export function lintEventBus(document: Doc): string[] {
  const violations: string[] = [];
  const components = document['components'];
  const schemas = isRecord(components) ? components['schemas'] : undefined;
  const parameters = isRecord(components) ? components['parameters'] : undefined;

  const eventName = isRecord(schemas) ? schemas['EventName'] : undefined;
  const declaredNames = isRecord(eventName) && Array.isArray(eventName['enum'])
    ? (eventName['enum'] as unknown[])
    : [];
  for (const expected of REQUIRED_EVENT_NAMES) {
    if (!declaredNames.includes(expected)) {
      violations.push(`CA10 : l evenement "${expected}" n est pas declare dans EventName.`);
    }
  }

  const envelope = isRecord(schemas) ? schemas['EventEnvelope'] : undefined;
  const required = isRecord(envelope) ? envelope['required'] : undefined;
  for (const field of [
    'event_id',
    'event_name',
    'event_version',
    'occurred_at',
    'tenant_id',
    'aggregate_type',
    'aggregate_id',
    'payload',
  ]) {
    if (!Array.isArray(required) || !required.includes(field)) {
      violations.push(`CA10 : EventEnvelope doit exiger "${field}".`);
    }
  }

  const signature = isRecord(parameters) ? parameters['MagritSignature'] : undefined;
  if (
    !isRecord(signature) ||
    signature['name'] !== 'X-Magrit-Signature' ||
    signature['in'] !== 'header'
  ) {
    violations.push('CA10 : le parametre MagritSignature doit etre l en-tete X-Magrit-Signature.');
  } else {
    const schema = signature['schema'];
    const pattern = isRecord(schema) ? schema['pattern'] : undefined;
    if (typeof pattern !== 'string' || !pattern.includes('sha256=')) {
      violations.push('CA10 : la signature doit imposer le format sha256=<hmac>.');
    }
  }

  const webhooks = document['webhooks'];
  if (!isRecord(webhooks)) {
    violations.push('CA10 : le contrat doit declarer la section webhooks du bus sortant.');
    return violations;
  }
  for (const expected of REQUIRED_EVENT_NAMES) {
    if (!(expected in webhooks)) {
      violations.push(`CA10 : l evenement "${expected}" n est pas decrit en webhook.`);
    }
  }
  return violations;
}

/** Agrege toutes les regles. */
export function lintContract(document: Doc): string[] {
  return [
    ...lintDocumentShape(document),
    ...lintPathNaming(document),
    ...lintTenantNeverAddressed(document),
    ...lintSecuritySchemes(document),
    ...lintResponseShapes(document),
    ...lintPagination(document),
    ...lintIdempotency(document),
    ...lintConcurrency(document),
    ...lintEventBus(document),
  ];
}

// ---------------------------------------------------------------------------

function pathsOf(document: Doc): Record<string, unknown> {
  const paths = document['paths'];
  return isRecord(paths) ? paths : {};
}

function operationsOf(item: unknown): Array<[string, Record<string, unknown>]> {
  if (!isRecord(item)) return [];
  return Object.entries(item)
    .filter(([method, operation]) => HTTP_METHODS.includes(method) && isRecord(operation))
    .map(([method, operation]) => [method, operation as Record<string, unknown>]);
}

function parametersOf(operation: Record<string, unknown>): Array<Record<string, unknown>> {
  const parameters = operation['parameters'];
  if (!Array.isArray(parameters)) return [];
  return parameters.filter(isRecord);
}

function mediaTypesOf(response: unknown): string[] {
  if (!isRecord(response)) return [];
  const content = response['content'];
  return isRecord(content) ? Object.keys(content) : [];
}
