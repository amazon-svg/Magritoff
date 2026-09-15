/**
 * BCP-1a (docs/api/CONVENTIONS.md §8.25 point 2.3) — l'exécution du plan.
 *
 * `callCheckAuth`/`callQuote` sont fournis par l'appelant et rendent le
 * résultat BRUT d'un appel transport (forme de `performRawCall`,
 * `classification.mjs`) : `{transport, httpStatus, payload, ok2xx}`. C'est
 * CE module qui classe l'appel (`classifyCheckAuthCall`/`classifyQuoteCall`)
 * et applique la règle d'arrêt — jamais l'appelant, pour que la même
 * décision serve au mode réel et aux tests (stubs triviaux).
 *
 * En mode sec (`buildDryRunReport`), AUCUN des deux exécuteurs n'est fourni
 * ni invoqué — seul le plan déclaré (`plan.mjs`) est parcouru pour produire
 * un rapport, charges expurgées comprises.
 *
 * Arbitrage architecte (qa-review de `d8a0a57b`, point (1)) : une
 * `transport_failure`, À N'IMPORTE QUEL APPEL DE N'IMPORTE QUELLE PHASE,
 * ARRÊTE la campagne. On ne rejoue pas, on ne consomme pas le reste du
 * plafond, et AUCUNE décision 422/502 n'est prise (`phase_a_verdict:
 * 'inconclusive'`).
 */
import {
  classifyCheckAuthCall,
  classifyQuoteCall,
  collectKnownPrinterNames,
  countAllProcess,
  countFaultyProcess,
  boundedResponseRaw,
  shouldIncludeResponseRaw,
  substituteKnownNames,
} from './classification.mjs';
import { buildCallRecord, buildCampaignSummary } from './archive.mjs';
import {
  MAX_BILLED_CALLS,
  PHASE_A_REPEAT_COUNT,
  PHASE_B_VARIANTS,
  PHASE_C_FINISHING_CODES,
  PLAN_VERSION,
  buildWorstCasePlan,
  chargeAlreadyHasFinishing,
  expurgeChargeForDisplay,
  planCallsByPhase,
  withFinishingCode,
} from './plan.mjs';

/**
 * Mode sec (dry-run) : imprime le plan, LES CHARGES (expurgées de
 * `reference`/`address`) et le décompte, SANS ouvrir aucune connexion.
 * Signature à un seul argument : aucune fonction réseau ne peut lui être
 * passée, preuve structurelle qu'aucun appel ne peut en sortir.
 */
export function buildDryRunReport(baseCharge) {
  const plan = buildWorstCasePlan(baseCharge);
  return {
    mode: 'dry',
    maxBilledCalls: MAX_BILLED_CALLS,
    totalPlannedCalls: plan.length,
    callsByPhase: planCallsByPhase(plan),
    steps: plan.map((step) => ({
      id: step.id,
      phase: step.phase,
      kind: step.kind,
      variant: step.variant,
      ...(step.charge ? { charge: expurgeChargeForDisplay(step.charge) } : {}),
    })),
  };
}

/**
 * Exécution réelle, sous plafond, avec les règles d'arrêt de l'arbitrage
 * architecte. Chaque appel est archivé (`archive`) DÈS qu'il est fait, pour
 * qu'une interruption ne perde pas des appels déjà payés.
 *
 * @param {object} options
 * @param {Record<string, unknown>} options.baseCharge
 * @param {() => Promise<{transport:string, httpStatus:number|null, payload:unknown, ok2xx:boolean}>} options.callCheckAuth
 * @param {(charge: Record<string, unknown>) => Promise<{transport:string, httpStatus:number|null, payload:unknown, ok2xx:boolean}>} options.callQuote
 * @param {(state: {calls: unknown[], texts: unknown[]}) => Promise<void>} [options.archive]
 * @param {number} [options.maxBilledCalls]
 * @param {number} [options.billedCallsCumulativeBefore] - total facturé des campagnes précédentes du même objet.
 */
export async function runClariprintVariantsBench({
  baseCharge,
  callCheckAuth,
  callQuote,
  archive = async () => {},
  maxBilledCalls = MAX_BILLED_CALLS,
  billedCallsCumulativeBefore = 0,
}) {
  // qa-review round 1 (BAS, B7) : `maxBilledCalls` ne peut JAMAIS dépasser
  // la constante écrite dans le code, quelle que soit la valeur fournie.
  const effectiveMaxBilledCalls = Math.min(maxBilledCalls, MAX_BILLED_CALLS);

  const calls = [];
  const texts = [];
  let stopped = null; // { stopReason, phaseAVerdict, retainedRule }
  // Connu au moment d'un `cap_reached` : si la phase A a DÉJÀ conclu avant
  // que le plafond ne coupe la campagne (en B ou en C), ce verdict est
  // préservé — seule une `transport_failure` l'efface TOUJOURS en
  // `inconclusive` (arbitrage architecte, point (1), littéral).
  let knownPhaseAVerdict = 'inconclusive';
  let knownRetainedRule = null;

  async function performCall(stepId, variant, invoke, classify) {
    const ordinal = calls.length + 1;
    if (ordinal > effectiveMaxBilledCalls) {
      stopped = { stopReason: 'cap_reached', phaseAVerdict: knownPhaseAVerdict, retainedRule: knownRetainedRule };
      return null;
    }
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    const rawResult = await invoke();
    const durationMs = Date.now() - t0;
    const classified = classify(rawResult);
    const payload = rawResult.payload;
    const errorText = payload && typeof payload.error === 'string' ? payload.error : null;
    const errorPresent = errorText !== null;
    // qa-review round 2 (MOYEN, sonde n°1) : `response_raw` n'est ecrit que
    // pour une anomalie NUMERIQUE (negative/not_finite/zero), jamais pour un
    // texte ou un objet — meme quand `outcome` vaut `invalid_price` (un
    // `success` non strictement booleen classe deja `positive`/`non_number`
    // en `invalid_price`, sans que ce soit un `response_raw` admissible).
    const responseRaw = classified.outcome === 'invalid_price' && shouldIncludeResponseRaw(classified.responseClass)
      ? boundedResponseRaw(classified.rawValue)
      : undefined;
    const record = buildCallRecord({
      ordinal,
      stepId,
      variant,
      startedAt,
      durationMs,
      classified,
      allProcessCount: countAllProcess(payload),
      faultyProcessCount: countFaultyProcess(payload),
      errorPresent,
      responseRaw,
    });
    calls.push(record);
    if (errorPresent) {
      texts.push({ step_id: stepId, text: substituteKnownNames(errorText, collectKnownPrinterNames(payload)) });
    }
    await archive({ calls: calls.slice(), texts: texts.slice() });
    if (classified.outcome === 'transport_failure') {
      stopped = { stopReason: 'transport_failure', phaseAVerdict: 'inconclusive', retainedRule: null };
    }
    return classified;
  }

  function finalize(outcome) {
    const summary = buildCampaignSummary({
      planVersion: PLAN_VERSION,
      maxBilledCalls: effectiveMaxBilledCalls,
      billedCallsUsed: calls.length,
      billedCallsCumulative: billedCallsCumulativeBefore + calls.length,
      stopReason: outcome.stopReason,
      phaseAVerdict: outcome.phaseAVerdict,
      retainedRule: outcome.retainedRule,
    });
    return { ...summary, calls, texts, cause: outcome.cause ?? null, acceptedFinishingCodes: outcome.acceptedFinishingCodes ?? [] };
  }

  // ── Phase A — CheckAuth (A1) ──────────────────────────────────────────
  const authOutcome = await performCall('A1', null, callCheckAuth, classifyCheckAuthCall);
  if (stopped) return finalize(stopped);
  if (authOutcome.outcome === 'auth_refused') {
    return finalize({ stopReason: 'auth_refused', phaseAVerdict: 'inconclusive', retainedRule: null });
  }

  // ── Phase A — 3 appels identiques (A2..A4) ───────────────────────────
  const phaseAOutcomes = [];
  for (let i = 0; i < PHASE_A_REPEAT_COUNT; i += 1) {
    const variant = { dimension: 'baseline', value: 'smoke_A5' };
    // eslint-disable-next-line no-await-in-loop -- séquentiel par construction (3 appels IDENTIQUES, dans l'ordre)
    const outcome = await performCall(`A${i + 2}`, variant, () => callQuote(baseCharge), classifyQuoteCall);
    if (stopped) return finalize(stopped);
    phaseAOutcomes.push(outcome.outcome);
  }

  const pricedCount = phaseAOutcomes.filter((outcome) => outcome === 'priced').length;
  let phaseAVerdict;
  let retainedRule;
  if (pricedCount === PHASE_A_REPEAT_COUNT) {
    phaseAVerdict = 'priced';
    retainedRule = null;
  } else if (pricedCount === 0) {
    phaseAVerdict = 'deterministic_not_priced';
    retainedRule = 422;
  } else {
    phaseAVerdict = 'non_deterministic';
    retainedRule = 502;
  }
  knownPhaseAVerdict = phaseAVerdict;
  knownRetainedRule = retainedRule;

  // ── Phase A entièrement priced OU mélange -> B est SAUTÉE, C sur baseCharge ──
  if (phaseAVerdict !== 'deterministic_not_priced') {
    const accepted = await runPhaseC(baseCharge, performCall, callQuote);
    if (stopped) return finalize(stopped);
    return finalize({ stopReason: 'completed', phaseAVerdict, retainedRule, acceptedFinishingCodes: accepted });
  }

  // ── Phase B — une dimension à la fois, arrêt au premier prix obtenu ──
  let winner = null;
  for (const variantDef of PHASE_B_VARIANTS) {
    const charge = variantDef.apply(baseCharge);
    // eslint-disable-next-line no-await-in-loop -- arrêt au premier succès : les variantes suivantes ne doivent PAS être appelées (chaque appel est facturé)
    const outcome = await performCall(variantDef.id, variantDef.variant, () => callQuote(charge), classifyQuoteCall);
    if (stopped) return finalize(stopped);
    if (outcome.outcome === 'priced') {
      winner = { id: variantDef.id, charge };
      break;
    }
  }

  if (!winner) {
    // Dix échecs -> fin de campagne à 14 appels : la cause n'est pas une
    // dimension de la charge (point 2.3).
    return finalize({ stopReason: 'completed', phaseAVerdict, retainedRule, cause: null, acceptedFinishingCodes: [] });
  }

  const acceptedFinishingCodes = await runPhaseC(winner.charge, performCall, callQuote);
  if (stopped) return finalize(stopped);
  return finalize({ stopReason: 'stopped_on_price', phaseAVerdict, retainedRule, cause: winner.id, acceptedFinishingCodes });
}

async function runPhaseC(base, performCall, callQuote) {
  const accepted = [];
  const codesToTest = PHASE_C_FINISHING_CODES.filter((code) => !chargeAlreadyHasFinishing(base, code));
  for (let index = 0; index < codesToTest.length; index += 1) {
    const code = codesToTest[index];
    const charge = withFinishingCode(base, code);
    const stepId = `C${PHASE_C_FINISHING_CODES.indexOf(code) + 1}`;
    const variant = { dimension: 'finishing_front', value: code };
    // eslint-disable-next-line no-await-in-loop -- séquentiel par construction (chaque appel est facturé)
    const outcome = await performCall(stepId, variant, () => callQuote(charge), classifyQuoteCall);
    if (!outcome) return accepted; // plafond atteint (cap_reached) : arrêt immédiat, géré par l'appelant
    if (outcome.outcome === 'transport_failure') return accepted; // arrêt géré par l'appelant (stopped déjà positionné)
    if (outcome.outcome === 'priced') accepted.push(code);
  }
  return accepted;
}
