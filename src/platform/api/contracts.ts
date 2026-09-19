import { z } from 'zod';

export const API_V1_BASE_PATH = '/api/v1' as const;

/**
 * Deux formes coexistent sous `errors[]`, additives l une envers l autre :
 * `{ field, message }` (forme d origine, validation de requête) et
 * `{ product_label, submitted, current }` (Q17-a, point 12 (d) — un écart de
 * prix par ligne divergente, `submitted`/`current` déjà en `Money`). Aucun
 * champ n est requis : un consommateur qui ne connaît qu une forme continue
 * de fonctionner, l autre lui étant invisible.
 */
const problemFieldErrorSchema = z.object({
  field: z.string().optional(),
  message: z.string().optional(),
  product_label: z.string().optional(),
  submitted: z.string().optional(),
  current: z.string().optional(),
});

/**
 * Forme normalisee, toujours sur `requestId` (camelCase) : c est la forme que
 * le reste de l application connaissait deja avant E10. `errors` et
 * `currentState` restent OPTIONNELS — ne pas les rendre requis casserait tous
 * les appelants historiques qui construisent un Problem sans ces champs.
 */
const apiProblemShapeSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  code: z.string(),
  detail: z.string().optional(),
  requestId: z.string(),
  errors: z.array(problemFieldErrorSchema).optional(),
  /**
   * Etat courant d un conflit optimiste (CA9, facade E10 uniquement).
   * Absent des Problem historiques.
   */
  currentState: z.record(z.string(), z.unknown()).nullable().optional(),
});

/**
 * La facade E10 (`createGescomApiHandler`) sert `request_id` en snake_case et
 * `current_state` sur un conflit optimiste ; la facade historique
 * (`createApiV1Handler`) sert `requestId` en camelCase sans `current_state`.
 * Les deux coexistent (docs/api/CONVENTIONS.md §2.3) : ce `preprocess`
 * normalise l une vers l autre AVANT validation, pour que le reste de
 * l application n ait jamais a connaitre la facade d origine.
 */
export const apiProblemSchema = z.preprocess((value) => {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'request_id' in (value as Record<string, unknown>)
  ) {
    const { request_id, current_state, ...rest } = value as Record<string, unknown>;
    return {
      ...rest,
      requestId: request_id,
      ...(current_state === undefined ? {} : { currentState: current_state }),
    };
  }
  return value;
}, apiProblemShapeSchema);

export type ApiProblem = z.infer<typeof apiProblemShapeSchema>;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  apiVersion: z.literal('v1'),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
