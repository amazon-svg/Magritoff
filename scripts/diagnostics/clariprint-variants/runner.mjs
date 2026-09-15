/**
 * BCP-1a (docs/api/CONVENTIONS.md §8.25 point 2.3) — l'exécution du plan.
 *
 * Fonction pure « au sens des E/S injectées » : `callCheckAuth`, `callQuote`
 * et `archive` sont fournis par l'appelant. En mode sec (`runDryPlan`),
 * AUCUN des deux appelants réseau n'est invoqué — seul le plan déclaré
 * (`plan.mjs`) est parcouru pour produire un rapport. En exécution réelle
 * (`runClariprintVariantsBench`), chaque appel est compté AVANT d'être
 * effectué, `CheckAuth` compris, et le dix-neuvième est refusé.
 */
import {
  MAX_BILLED_CALLS,
  PHASE_A_REPEAT_COUNT,
  PHASE_B_VARIANTS,
  PHASE_C_FINISHING_CODES,
  buildWorstCasePlan,
  chargeAlreadyHasFinishing,
  planCallsByPhase,
  withFinishingCode,
} from './plan.mjs';

export class BilledCallCapExceededError extends Error {
  constructor(limit) {
    super(`Plafond de ${limit} appels facturés atteint : appel refusé avant exécution.`);
    this.name = 'BilledCallCapExceededError';
  }
}

/**
 * Mode sec (dry-run) : imprime le plan, les charges et le décompte, SANS
 * ouvrir aucune connexion. `callCheckAuth`/`callQuote` ne sont jamais
 * fournis à cette fonction : c'est la preuve, par signature, qu'aucun appel
 * réseau ne peut en sortir.
 */
export function buildDryRunReport(baseCharge) {
  const plan = buildWorstCasePlan(baseCharge);
  return {
    mode: 'dry',
    maxBilledCalls: MAX_BILLED_CALLS,
    totalPlannedCalls: plan.length,
    callsByPhase: planCallsByPhase(plan),
    steps: plan.map(({ id, phase, kind, label }) => ({ id, phase, kind, label })),
  };
}

/**
 * Exécution réelle, sous plafond, avec les règles d'arrêt du point 2.3
 * (tableau des phases). Chaque appel est archivé (`archive`) DÈS qu'il est
 * fait, pour qu'une interruption ne perde pas des appels déjà payés.
 *
 * @param {object} options
 * @param {Record<string, unknown>} options.baseCharge - la charge exacte du smoke (A5).
 * @param {() => Promise<{allowed: boolean}>} options.callCheckAuth
 * @param {(charge: Record<string, unknown>) => Promise<{priced: boolean, price?: number}>} options.callQuote
 * @param {(calls: unknown[]) => Promise<void>} [options.archive]
 * @param {number} [options.maxBilledCalls]
 */
export async function runClariprintVariantsBench({
  baseCharge,
  callCheckAuth,
  callQuote,
  archive = async () => {},
  maxBilledCalls = MAX_BILLED_CALLS,
}) {
  const calls = [];
  let callCount = 0;

  async function billedCall(step, execute) {
    // Le compteur s'incrémente AVANT chaque appel réseau, CheckAuth compris
    // (point 2.3) : on ne sait pas s'il est facturé, donc il compte.
    callCount += 1;
    if (callCount > maxBilledCalls) {
      throw new BilledCallCapExceededError(maxBilledCalls);
    }
    const startedAt = Date.now();
    const result = await execute();
    const record = { ...step, callIndex: callCount, durationMs: Date.now() - startedAt, result };
    calls.push(record);
    // L'archive s'écrit APRÈS CHAQUE appel (point 2.3).
    await archive(calls.slice());
    return result;
  }

  const authResult = await billedCall({ id: 'A0', phase: 'A', kind: 'check_auth' }, () => callCheckAuth());
  if (!authResult.allowed) {
    return finalize({ verdict: 'auth_refused', deterministic: null, cause: null, acceptedFinishingCodes: [] });
  }

  const phaseAResults = [];
  for (let i = 1; i <= PHASE_A_REPEAT_COUNT; i += 1) {
    const step = { id: `A${i}`, phase: 'A', kind: 'quote', charge: baseCharge };
    // eslint-disable-next-line no-await-in-loop -- séquentiel par construction (phase A rejoue 3 fois la MÊME charge)
    const result = await billedCall(step, () => callQuote(baseCharge));
    phaseAResults.push(result);
  }
  const pricedInPhaseA = phaseAResults.some((result) => result.priced);

  if (pricedInPhaseA) {
    // Au moins un prix obtenu -> non déterministe (502 `clariprint.unavailable`,
    // point 2.2) : B est SAUTÉE, et la charge devient la base de C (point 2.3).
    const outcome = await runPhaseC(baseCharge, billedCall, callQuote);
    return finalize({ verdict: 'non_deterministic', deterministic: false, cause: null, acceptedFinishingCodes: outcome });
  }

  // Trois échecs identiques -> phase B, une dimension à la fois, arrêt au
  // premier prix obtenu.
  let phaseBWinner = null;
  for (const variant of PHASE_B_VARIANTS) {
    const charge = variant.apply(baseCharge);
    const step = { id: variant.id, phase: 'B', kind: 'quote', charge };
    // eslint-disable-next-line no-await-in-loop -- arrêt au premier succès : les variantes suivantes ne doivent PAS être appelées (chaque appel est facturé)
    const result = await billedCall(step, () => callQuote(charge));
    if (result.priced) {
      phaseBWinner = { variant, charge };
      break;
    }
  }

  if (!phaseBWinner) {
    // Dix échecs -> fin de campagne à 14 appels : la cause n'est pas une
    // dimension de la charge (point 2.3).
    return finalize({ verdict: 'cause_not_found', deterministic: true, cause: null, acceptedFinishingCodes: [] });
  }

  const acceptedFinishingCodes = await runPhaseC(phaseBWinner.charge, billedCall, callQuote);
  return finalize({
    verdict: 'cause_found',
    deterministic: true,
    cause: phaseBWinner.variant.id,
    acceptedFinishingCodes,
  });

  function finalize(outcome) {
    return { ...outcome, calls, totalBilledCalls: callCount };
  }
}

async function runPhaseC(baseChargeForC, billedCall, callQuote) {
  const accepted = [];
  const codesToTest = PHASE_C_FINISHING_CODES.filter((code) => !chargeAlreadyHasFinishing(baseChargeForC, code));
  for (const code of codesToTest) {
    const charge = withFinishingCode(baseChargeForC, code);
    const step = { id: `C_${code}`, phase: 'C', kind: 'quote', charge };
    // eslint-disable-next-line no-await-in-loop -- séquentiel par construction (chaque appel est facturé)
    const result = await billedCall(step, () => callQuote(charge));
    if (result.priced) accepted.push(code);
  }
  return accepted;
}
