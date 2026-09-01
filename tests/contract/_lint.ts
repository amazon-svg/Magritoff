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
import { checkResourcePath, TENANT_ADDRESSING_TOKENS } from '@/modules/_shared/api';
import { isRecord } from './_harness.ts';

export const API_BASE_PATH = '/api/v1';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const TENANT_TOKENS = TENANT_ADDRESSING_TOKENS;

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

/**
 * CA3 : prefixe /api/v1, ressources au pluriel en kebab-case.
 *
 * La regle est celle de `checkResourcePath` (src/modules/_shared/api/path-rules.ts),
 * partagee avec `assertRoutePath` du middleware. Elle etait auparavant ecrite
 * deux fois et les deux copies divergeaient sur le pluriel des sous-ressources.
 */
export function lintPathNaming(document: Doc): string[] {
  return Object.keys(pathsOf(document)).flatMap((path) =>
    checkResourcePath(path, API_BASE_PATH)
      .filter((violation) => violation.rule === 'CA3')
      .map((violation) => `CA3 : chemin "${path}" — ${violation.message}.`),
  );
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
      for (const parameter of parametersOf(operation, item)) {
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

/**
 * CA5 : toute operation joignable par une cle de service declare ses scopes.
 *
 * Le contrat le PROMET dans la description de `serviceKey` (« chaque operation
 * declare les siens dans x-required-scopes ») ; sans cette regle, la promesse
 * n etait tenue nulle part et une operation pouvait etre ouverte a toutes les
 * cles du tenant.
 */
export function lintRequiredScopes(document: Doc): string[] {
  const violations: string[] = [];
  const components = document['components'];
  const schemes = isRecord(components) ? components['securitySchemes'] : undefined;
  const serviceKey = isRecord(schemes) ? schemes['serviceKey'] : undefined;
  const declaredScopes = isRecord(serviceKey) && isRecord(serviceKey['x-magrit-scopes'])
    ? Object.keys(serviceKey['x-magrit-scopes'] as Record<string, unknown>)
    : [];

  const rootSecurity = Array.isArray(document['security']) ? document['security'] : [];

  for (const [path, item] of Object.entries(pathsOf(document))) {
    for (const [method, operation] of operationsOf(item)) {
      const security = Array.isArray(operation['security'])
        ? operation['security']
        : rootSecurity;
      const serviceReachable = security.some(
        (requirement) => isRecord(requirement) && 'serviceKey' in requirement,
      );
      if (!serviceReachable) continue;

      const required = operation['x-required-scopes'];
      if (!Array.isArray(required) || required.length === 0) {
        violations.push(
          `CA5 : ${method.toUpperCase()} ${path} est joignable par cle de service sans x-required-scopes.`,
        );
        continue;
      }
      for (const scope of required) {
        if (typeof scope !== 'string' || !declaredScopes.includes(scope)) {
          violations.push(
            `CA5 : ${method.toUpperCase()} ${path} exige le scope "${String(scope)}", absent de x-magrit-scopes.`,
          );
        }
      }
    }
  }
  return violations;
}

/**
 * CA4, CA8, CA9 : les parametres partages sont EPINGLES sur leur emplacement
 * et leur nom.
 *
 * Une operation peut les referencer par `$ref` ; la reference est alors crue
 * sur ce que le composant declare. Si `IdempotencyKey` passait a `in: query`,
 * toutes les operations qui le referencent promettraient une idempotence par
 * query string — que le middleware ne lit pas, il ne regarde que l en-tete.
 * Le contrat mentirait sans qu aucune regle ne bronche.
 *
 * Meme principe que `lintPagination`, qui epingle deja `page[size]` et
 * `page[cursor]`.
 */
export function lintSharedParameterDefinitions(document: Doc): string[] {
  const violations: string[] = [];
  const components = document['components'];
  const parameters = isRecord(components) ? components['parameters'] : undefined;

  const pinned = [
    { component: 'IdempotencyKey', name: 'Idempotency-Key', location: 'header' },
    { component: 'IfMatch', name: 'If-Match', location: 'header' },
    { component: 'MagritTenant', name: 'X-Magrit-Tenant', location: 'header' },
    { component: 'MagritSignature', name: 'X-Magrit-Signature', location: 'header' },
  ] as const;

  for (const { component, name, location } of pinned) {
    const declared = isRecord(parameters) ? parameters[component] : undefined;
    if (!isRecord(declared)) {
      violations.push(`components/parameters/${component} est absent.`);
      continue;
    }
    if (declared['name'] !== name) {
      violations.push(
        `components/parameters/${component} doit se nommer "${name}", trouve "${String(declared['name'])}".`,
      );
    }
    if (declared['in'] !== location) {
      violations.push(
        `components/parameters/${component} doit etre transmis en ${location}, trouve "${String(declared['in'])}".`,
      );
    }
  }
  return violations;
}

/**
 * CA4 et CA6 : couverture minimale de TOUTE operation de la facade.
 *
 * Regle generique plutot que verification cas par cas : les trois manques
 * trouves par la revue (MagritTenant reference nulle part, 400 absent de trois
 * operations, 409 absent de verifyCustomerSiret) etaient tous du meme type — un
 * statut ou un en-tete que le middleware peut produire mais que le contrat
 * passait sous silence. Sans regle generique, le trou revient a la story
 * suivante.
 *
 * Ce que toute operation doit declarer :
 *  - `MagritTenant`, en clair ou herite du chemin : c est ainsi qu un client
 *    pilote par le contrat apprend qu il doit choisir son espace ;
 *  - `400`, que `resolvePrincipal` peut lever sur n importe quelle operation
 *    (espace a preciser, credentials ambigues, tenant adresse par l URL) ;
 *  - `401` et `403`, que la resolution d acteur et les scopes peuvent lever ;
 *  - `409` des lors que l operation cree une ressource (`201`), car elle passe
 *    alors par l idempotence, qui leve `api.idempotency_key_reused`.
 */
export function lintOperationCoverage(document: Doc): string[] {
  const violations: string[] = [];

  for (const [path, item] of Object.entries(pathsOf(document))) {
    for (const [method, operation] of operationsOf(item)) {
      const label = `${method.toUpperCase()} ${path}`;
      const parameters = parametersOf(operation, item);

      // Dispense pour une operation PUBLIQUE (`security: []`, la forme
      // OpenAPI qui retire toute exigence d authentification) : elle n a ni
      // espace a choisir, ni acteur a resoudre, donc ni MagritTenant ni 401 ou
      // 403 a declarer. Prevue des maintenant plutot que decouverte sous
      // contrainte a la premiere story exposant un endpoint public.
      const security = operation['security'];
      if (Array.isArray(security) && security.length === 0) continue;

      if (!declaresParameter(parameters, { name: 'X-Magrit-Tenant' }, document)) {
        violations.push(
          `CA4 : ${label} ne declare pas MagritTenant — un client pilote par le contrat ignorerait qu il doit choisir son espace.`,
        );
      }

      const responses = isRecord(operation['responses']) ? operation['responses'] : {};
      const declared = Object.keys(responses);

      for (const status of ['400', '401', '403']) {
        if (!declared.includes(status)) {
          violations.push(`CA6 : ${label} ne declare pas la reponse ${status}, pourtant atteignable.`);
        }
      }

      if (declared.includes('201') && !declared.includes('409')) {
        violations.push(
          `CA8 : ${label} cree une ressource sans declarer 409 — l idempotence peut le lever.`,
        );
      }
    }
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
      for (const parameter of parametersOf(operation, item)) {
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
      const declared = declaresParameter(
        parametersOf(operation, item),
        { name: 'Idempotency-Key' },
        document,
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
      const declared = declaresParameter(
        parametersOf(operation, item),
        { name: 'If-Match' },
        document,
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

/**
 * CA1 : chaque route DECLAREE EN CODE correspond a une operation reelle du
 * contrat.
 *
 * C est la regle qui ferme le trou principal : le reste du lint ne regarde que
 * le document, jamais le code. Une route ecrite sans entree dans le YAML
 * passait donc toutes les verifications.
 *
 * `exemptOperationIds` n existe que pour les FIXTURES de test, qui montent des
 * routes jetables pour exercer le middleware. Aucune route de production ne
 * doit y figurer.
 */
export type RegisteredRoute = Readonly<{
  method: string;
  relativePath: string;
  operationId: string;
  requiredScopes: readonly string[];
  authentication: string;
}>;

export function lintRoutesAgainstContract(
  routes: readonly RegisteredRoute[],
  document: Doc,
  exemptOperationIds: readonly string[] = [],
): string[] {
  const violations: string[] = [];
  const paths = pathsOf(document);

  for (const route of routes) {
    if (exemptOperationIds.includes(route.operationId)) continue;

    const label = `${route.method} ${route.relativePath} (${route.operationId})`;
    const item = paths[route.relativePath];
    if (!isRecord(item)) {
      violations.push(
        `CA1 : ${label} n est decrit par aucun chemin du contrat. Decrire l operation dans openapi/magrit-core.v1.yaml avant de la coder.`,
      );
      continue;
    }

    const operation = item[route.method.toLowerCase()];
    if (!isRecord(operation)) {
      violations.push(`CA1 : ${label} — le contrat ne decrit pas cette methode sur ce chemin.`);
      continue;
    }

    if (operation['operationId'] !== route.operationId) {
      violations.push(
        `CA1 : ${label} — le contrat annonce operationId "${String(operation['operationId'])}".`,
      );
    }

    // Les scopes du code et ceux du contrat doivent dire la meme chose, sinon
    // la documentation d integration ment au partenaire.
    const contractScopes = Array.isArray(operation['x-required-scopes'])
      ? (operation['x-required-scopes'] as unknown[]).map(String)
      : [];
    const missing = route.requiredScopes.filter((scope) => !contractScopes.includes(scope));
    if (route.authentication !== 'user' && missing.length > 0) {
      violations.push(
        `CA5 : ${label} exige les scopes ${missing.join(', ')}, absents de x-required-scopes du contrat.`,
      );
    }
  }
  return violations;
}

/** Agrege toutes les regles portant sur le document seul. */
export function lintContract(document: Doc): string[] {
  return [
    ...lintDocumentShape(document),
    ...lintPathNaming(document),
    ...lintTenantNeverAddressed(document),
    ...lintSecuritySchemes(document),
    ...lintRequiredScopes(document),
    ...lintSharedParameterDefinitions(document),
    ...lintOperationCoverage(document),
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

/**
 * Parametres effectifs d une operation : ceux du CHEMIN plus ceux de
 * l operation.
 *
 * OpenAPI fait heriter les parametres declares au niveau du chemin par toutes
 * ses operations. Ne lire que le niveau operation ferait passer pour absent un
 * parametre pourtant bien declare — et inversement laisserait un parametre
 * interdit au niveau chemin echapper au controle du CA4.
 */
function parametersOf(
  operation: Record<string, unknown>,
  pathItem: unknown = undefined,
): Array<Record<string, unknown>> {
  const own = Array.isArray(operation['parameters'])
    ? operation['parameters'].filter(isRecord)
    : [];
  const inherited =
    isRecord(pathItem) && Array.isArray(pathItem['parameters'])
      ? pathItem['parameters'].filter(isRecord)
      : [];
  return [...inherited, ...own];
}

/**
 * Resout un `$ref` local vers l objet qu il designe. Rend `null` si la
 * reference est externe ou pointe dans le vide.
 */
function resolveReference(node: Record<string, unknown>, document: Doc): Record<string, unknown> | null {
  const reference = node['$ref'];
  if (typeof reference !== 'string') return node;
  if (!reference.startsWith('#/')) return null;

  let current: unknown = document;
  for (const segment of reference.slice(2).split('/')) {
    if (!isRecord(current)) return null;
    current = current[segment.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  return isRecord(current) ? current : null;
}

/**
 * Un parametre est declare s il apparait en clair ou par reference vers
 * `components/parameters`. Les deux formes sont valides ; n en reconnaitre
 * qu une produirait de faux positifs.
 *
 * La reference est RESOLUE, pas reconnue a son nom. Se fier au suffixe du
 * `$ref` reviendrait a croire un composant sur parole : si
 * `components/parameters/IdempotencyKey` passait a `in: query`, la regle
 * continuerait de valider un contrat promettant une idempotence par query
 * string, que le middleware ne lit pas. C est le nom ET l emplacement reels
 * du parametre resolu qui comptent.
 */
function declaresParameter(
  parameters: Array<Record<string, unknown>>,
  expected: Readonly<{ name: string }>,
  document: Doc,
): boolean {
  return parameters.some((parameter) => {
    const resolved = resolveReference(parameter, document);
    return resolved !== null && resolved['in'] === 'header' && resolved['name'] === expected.name;
  });
}

function mediaTypesOf(response: unknown): string[] {
  if (!isRecord(response)) return [];
  const content = response['content'];
  return isRecord(content) ? Object.keys(content) : [];
}
