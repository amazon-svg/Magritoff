/**
 * BCP-1a — arbitrages de l'architecte sur la qa-review de `d8a0a57b`
 * (docs/api/CONVENTIONS.md §8.25 point 2.3, point (2) : « L'archive
 * `results/` : COMMITÉE, mais seulement sous une liste autorisée »).
 *
 * `buildCallRecord` est LA fonction pure qui écrit une ligne de
 * `calls.json`. Elle ne lit que des champs NOMMÉS sur l'entrée classifiée
 * (`classification.mjs`) — jamais un spread `{...classified}` — pour que
 * champ amont inconnu ne puisse jamais s'y glisser : « un champ amont
 * inconnu n'y est jamais écrit ».
 *
 * Hors de la liste, et donc jamais écrits par cette fonction : un prix
 * positif, `costs`, `delais`, `weight`, `fournisseur`, le contenu de
 * `all_process`, les clés et les textes de `all_faulty_process`, le texte
 * d'`error`, les identifiants, l'hôte.
 */

export const CALLS_JSON_CALL_FIELDS = Object.freeze([
  'ordinal',
  'step_id',
  'variant',
  'started_at',
  'duration_ms',
  'http_status',
  'transport',
  'upstream_success',
  'outcome',
  'response_class',
  'response_raw',
  'all_process_count',
  'faulty_process_count',
  'error_present',
  'error_class',
]);

export const STOP_REASONS = Object.freeze(['completed', 'stopped_on_price', 'transport_failure', 'auth_refused', 'cap_reached']);
export const PHASE_A_VERDICTS = Object.freeze(['deterministic_not_priced', 'non_deterministic', 'priced', 'inconclusive']);

/**
 * Construit UNE ligne de `calls.json`. `classified` est le résultat de
 * `classifyCheckAuthCall`/`classifyQuoteCall` (`classification.mjs`) ;
 * `boundedResponseRaw` doit avoir déjà été appliqué par l'appelant s'il y a
 * lieu — cette fonction ne fait que RANGER les champs nommés, jamais de
 * troncature ni de substitution.
 */
export function buildCallRecord({
  ordinal,
  stepId,
  variant,
  startedAt,
  durationMs,
  classified,
  allProcessCount = 0,
  faultyProcessCount = 0,
  errorPresent = false,
  responseRaw,
}) {
  const record = {
    ordinal,
    step_id: stepId,
    variant: variant ?? null,
    started_at: startedAt,
    duration_ms: durationMs,
    http_status: classified.httpStatus,
    transport: classified.transport,
    upstream_success: classified.upstreamSuccess,
    outcome: classified.outcome,
    response_class: classified.responseClass ?? null,
    all_process_count: allProcessCount,
    faulty_process_count: faultyProcessCount,
    error_present: errorPresent,
    error_class: errorPresent ? 'unclassified' : null,
  };
  // `response_raw` n'existe que pour `invalid_price` (point 2) : la clé
  // elle-même est absente ailleurs, jamais `null` ou vide.
  if (classified.outcome === 'invalid_price' && responseRaw !== undefined) {
    record.response_raw = responseRaw;
  }
  return record;
}

/** Construit le résumé de campagne (en-tête de `calls.json`). */
export function buildCampaignSummary({
  planVersion,
  maxBilledCalls,
  billedCallsUsed,
  billedCallsCumulative,
  stopReason,
  phaseAVerdict,
  retainedRule,
}) {
  return {
    plan_version: planVersion,
    max_billed_calls: maxBilledCalls,
    billed_calls_used: billedCallsUsed,
    billed_calls_cumulative: billedCallsCumulative,
    stop_reason: stopReason,
    phase_a_verdict: phaseAVerdict,
    retained_rule: retainedRule,
  };
}
