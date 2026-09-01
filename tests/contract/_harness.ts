/**
 * Harnais de tests de contrat (story E10.0, CA12).
 *
 * Charge openapi/magrit-core.v1.yaml et compile ses schemas en validateurs
 * JSON Schema 2020-12. Toute story E10.x valide requete et reponse de ses
 * endpoints ici : si le code s ecarte du contrat, le test echoue et la CI
 * bloque.
 *
 * Ce fichier n est pas un test (pas de suffixe .test.ts) : il est importe par
 * les tests du dossier.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

export const CONTRACT_PATH = 'openapi/magrit-core.v1.yaml';
export const GENERATED_TYPES_PATH = 'src/platform/api/generated/magrit-core.v1.ts';

const CONTRACT_SCHEMA_ID = 'magrit-core.v1';

export type OpenApiDocument = Readonly<Record<string, unknown>>;

let cachedDocument: OpenApiDocument | null = null;

export function readContractSource(): string {
  return readFileSync(resolve(process.cwd(), CONTRACT_PATH), 'utf8');
}

/** Document OpenAPI parse. Une seule lecture pour toute la suite. */
export function loadContract(): OpenApiDocument {
  cachedDocument ??= parse(readContractSource()) as OpenApiDocument;
  return cachedDocument;
}

// Ajv ignore les mots-cles OpenAPI qui ne sont pas du JSON Schema (openapi,
// info, paths, webhooks...) : `strict: false` est ce qui rend possible de
// valider directement contre le document de contrat, sans etape de bundling
// qui pourrait le deformer en route.
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: true });
addFormats(ajv);
ajv.addSchema(loadContract(), CONTRACT_SCHEMA_ID);

const validators = new Map<string, ReturnType<typeof ajv.compile>>();

/** Validateur du schema `components/schemas/<name>` du contrat. */
export function schemaValidator(name: string) {
  const cached = validators.get(name);
  if (cached) return cached;
  const compiled = ajv.compile({
    $ref: `${CONTRACT_SCHEMA_ID}#/components/schemas/${name}`,
  });
  validators.set(name, compiled);
  return compiled;
}

export type ContractCheck = Readonly<{ valid: boolean; errors: readonly string[] }>;

/** Confronte une valeur produite par le code au schema du contrat. */
export function checkAgainstSchema(name: string, value: unknown): ContractCheck {
  const validate = schemaValidator(name);
  const valid = validate(value) as boolean;
  return {
    valid,
    errors: (validate.errors ?? []).map(
      (error) => `${name}${error.instancePath} ${error.message ?? 'invalide'}`,
    ),
  };
}

/**
 * Confronte une reponse HTTP complete au contrat : statut, media type et
 * forme du corps. C est l assertion que chaque endpoint E10.x utilisera.
 */
export async function checkResponseAgainstContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<ContractCheck> {
  const errors: string[] = [];
  const contentType = response.headers.get('content-type') ?? '';
  const body = (await response.clone().json()) as unknown;

  if (response.status !== expectation.status) {
    errors.push(`statut ${response.status} au lieu de ${expectation.status}`);
  }

  if (response.status >= 400) {
    if (!contentType.startsWith('application/problem+json')) {
      errors.push(`une erreur doit etre servie en application/problem+json, recu "${contentType}"`);
    }
    const problem = checkAgainstSchema('Problem', body);
    errors.push(...problem.errors);
    return { valid: errors.length === 0, errors };
  }

  if (!contentType.startsWith('application/json')) {
    errors.push(`un succes doit etre servi en application/json, recu "${contentType}"`);
  }
  const envelope = checkAgainstSchema('SuccessEnvelope', body);
  errors.push(...envelope.errors);

  if (expectation.dataSchema !== undefined && isRecord(body)) {
    const data = checkAgainstSchema(expectation.dataSchema, body['data']);
    errors.push(...data.errors);
  }

  return { valid: errors.length === 0, errors };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Noms des schemas partages declares par le contrat. */
export function contractSchemaNames(): readonly string[] {
  const components = loadContract()['components'];
  if (!isRecord(components) || !isRecord(components['schemas'])) return [];
  return Object.keys(components['schemas']);
}
