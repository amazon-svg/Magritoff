import { describe, expect, it, vi } from 'vitest';
import { buildDryRunReport, runClariprintVariantsBench } from '../../../scripts/diagnostics/clariprint-variants/runner.mjs';
import { MAX_BILLED_CALLS, PHASE_B_VARIANTS, PHASE_C_FINISHING_CODES } from '../../../scripts/diagnostics/clariprint-variants/plan.mjs';

const BASE_CHARGE = Object.freeze({ reference: 'FLYER A5', quantity: '500', finishing_front: '' });

/** Raw result de transport (forme de `performRawCall`) pour un JSON 2xx. */
function jsonOk(payload) {
  return { transport: 'ok', httpStatus: 200, payload, ok2xx: true };
}

/** Panne de transport, quelle qu'en soit la cause. */
function transportFailure(transport = 'network_error', httpStatus = null) {
  return { transport, httpStatus, payload: null, ok2xx: false };
}

const ALWAYS_ALLOWED_AUTH = async () => jsonOk({ success: true });
const NEVER_PRICED_QUOTE = async () => jsonOk({ success: false });

describe('buildDryRunReport (mode sec)', () => {
  it("n'accepte AUCUN appelant reseau — sa signature ne prend que la charge", () => {
    expect(buildDryRunReport.length).toBe(1);
  });

  it('ne touche jamais au fetch global', () => {
    const fetchSpy = vi.fn();
    const original = globalThis.fetch;
    globalThis.fetch = fetchSpy;
    try {
      buildDryRunReport(BASE_CHARGE);
    } finally {
      globalThis.fetch = original;
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('annonce exactement le plan que l execution reelle suivrait (18 au plus)', () => {
    const report = buildDryRunReport(BASE_CHARGE);
    expect(report.mode).toBe('dry');
    expect(report.maxBilledCalls).toBe(MAX_BILLED_CALLS);
    expect(report.totalPlannedCalls).toBe(18);
    expect(report.callsByPhase).toEqual({ A: 4, B: 10, C: 4 });
    expect(report.steps).toHaveLength(18);
  });

  it('imprime les charges (expurgees de reference/address), comme l exige le cadrage', () => {
    const report = buildDryRunReport({ ...BASE_CHARGE, deliveries: { d_livraison: { address: '12 rue Secrete', quantity: '500' } } });
    const quoteSteps = report.steps.filter((step) => step.kind === 'quote');
    expect(quoteSteps.length).toBeGreaterThan(0);
    for (const step of quoteSteps) {
      expect(step.charge).not.toHaveProperty('reference');
      const deliveries = step.charge.deliveries;
      if (deliveries && typeof deliveries === 'object' && !Array.isArray(deliveries) && deliveries.d_livraison) {
        expect(deliveries.d_livraison).not.toHaveProperty('address');
      }
    }
  });
});

describe('runClariprintVariantsBench — plafond (B7 : jamais au-dela de MAX_BILLED_CALLS)', () => {
  it('un plafond fourni AU-DELA de MAX_BILLED_CALLS (50) ne permet JAMAIS de le depasser', async () => {
    const callQuote = vi.fn(NEVER_PRICED_QUOTE);
    const outcome = await runClariprintVariantsBench({
      baseCharge: BASE_CHARGE,
      callCheckAuth: ALWAYS_ALLOWED_AUTH,
      callQuote,
      maxBilledCalls: 50,
    });
    expect(outcome.max_billed_calls).toBe(MAX_BILLED_CALLS);
    expect(outcome.billed_calls_used).toBeLessThanOrEqual(MAX_BILLED_CALLS);
    expect(outcome.calls.length).toBeLessThanOrEqual(MAX_BILLED_CALLS);
  });

  it('un plafond artificiellement bas coupe la campagne avec stop_reason=cap_reached', async () => {
    const callQuote = vi.fn(NEVER_PRICED_QUOTE);
    const outcome = await runClariprintVariantsBench({
      baseCharge: BASE_CHARGE,
      callCheckAuth: ALWAYS_ALLOWED_AUTH,
      callQuote,
      maxBilledCalls: 2,
    });
    expect(outcome.stop_reason).toBe('cap_reached');
    expect(outcome.billed_calls_used).toBe(2);
    expect(callQuote).toHaveBeenCalledTimes(1); // 1 CheckAuth + 1 quote = 2, le 3e est refuse AVANT d etre tente
  });
});

describe('runClariprintVariantsBench — CheckAuth (arbitrage architecte, point (1))', () => {
  it("un CheckAuth avec JSON success:false donne stop_reason=auth_refused, AUCUN devis tente", async () => {
    const callCheckAuth = vi.fn(async () => jsonOk({ success: false }));
    const callQuote = vi.fn();
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth, callQuote });
    expect(outcome.stop_reason).toBe('auth_refused');
    expect(outcome.phase_a_verdict).toBe('inconclusive');
    expect(outcome.retained_rule).toBeNull();
    expect(callQuote).not.toHaveBeenCalled();
  });

  // Mutation a tuer (coordinateur) : "un 5xx de CheckAuth lu comme refuse".
  it('un CheckAuth en 5xx est une transport_failure, JAMAIS auth_refused', async () => {
    const callCheckAuth = vi.fn(async () => transportFailure('ok', 503));
    const callQuote = vi.fn();
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth, callQuote });
    expect(outcome.stop_reason).toBe('transport_failure');
    expect(outcome.stop_reason).not.toBe('auth_refused');
    expect(outcome.phase_a_verdict).toBe('inconclusive');
    expect(callQuote).not.toHaveBeenCalled();
  });

  it('un CheckAuth en 4xx est aussi une transport_failure (faute de reponse de calcul lisible)', async () => {
    const callCheckAuth = vi.fn(async () => transportFailure('ok', 404));
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth, callQuote: vi.fn() });
    expect(outcome.stop_reason).toBe('transport_failure');
  });

  // qa-review round 2 (MOYEN, K2) : un 403 accompagne d un corps
  // {success:false} — meme defensivement peuple sur ok2xx=false — doit
  // rester une transport_failure, JAMAIS auth_refused.
  it('un CheckAuth en 403 avec un corps {success:false} reste une transport_failure, JAMAIS auth_refused', async () => {
    const callCheckAuth = vi.fn(async () => ({ transport: 'ok', httpStatus: 403, payload: { success: false }, ok2xx: false }));
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth, callQuote: vi.fn() });
    expect(outcome.stop_reason).toBe('transport_failure');
    expect(outcome.stop_reason).not.toBe('auth_refused');
  });

  it('un CheckAuth avec une erreur reseau ou un delai depasse est une transport_failure', async () => {
    const networkOutcome = await runClariprintVariantsBench({
      baseCharge: BASE_CHARGE,
      callCheckAuth: async () => transportFailure('network_error'),
      callQuote: vi.fn(),
    });
    expect(networkOutcome.stop_reason).toBe('transport_failure');

    const timeoutOutcome = await runClariprintVariantsBench({
      baseCharge: BASE_CHARGE,
      callCheckAuth: async () => transportFailure('timeout'),
      callQuote: vi.fn(),
    });
    expect(timeoutOutcome.stop_reason).toBe('transport_failure');
  });

  it('un CheckAuth avec un corps non-JSON est une transport_failure', async () => {
    const outcome = await runClariprintVariantsBench({
      baseCharge: BASE_CHARGE,
      callCheckAuth: async () => transportFailure('non_json', 200),
      callQuote: vi.fn(),
    });
    expect(outcome.stop_reason).toBe('transport_failure');
  });

  it('un CheckAuth JSON sans success:false (succes, ou absent) est ALLOUE, la campagne continue', async () => {
    const callCheckAuth = vi.fn(async () => jsonOk({}));
    const callQuote = vi.fn(NEVER_PRICED_QUOTE);
    await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth, callQuote });
    expect(callQuote).toHaveBeenCalled();
  });
});

describe("runClariprintVariantsBench — arret sur transport_failure, a N'IMPORTE QUEL appel de N'IMPORTE QUELLE phase", () => {
  it('une transport_failure au 2e appel de la phase A arrete la campagne IMMEDIATEMENT (2 appels au total)', async () => {
    let quoteCallCount = 0;
    const callQuote = vi.fn(async () => {
      quoteCallCount += 1;
      return quoteCallCount === 2 ? transportFailure('network_error') : jsonOk({ success: false });
    });
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
    expect(outcome.stop_reason).toBe('transport_failure');
    expect(outcome.phase_a_verdict).toBe('inconclusive');
    expect(outcome.retained_rule).toBeNull();
    // 1 CheckAuth + 2 quotes (le 2e est la panne) = 3. On ne rejoue PAS, on
    // ne consomme PAS le reste du plafond (pas de 3e quote).
    expect(outcome.billed_calls_used).toBe(3);
    expect(quoteCallCount).toBe(2);
  });

  it('une transport_failure en phase B arrete la campagne, les variantes suivantes ne sont JAMAIS appelees', async () => {
    const callQuote = vi.fn(async (charge) => {
      if (charge.finishing_front === 'B2_MARKER') return transportFailure('timeout');
      return jsonOk({ success: false });
    });
    const b2 = PHASE_B_VARIANTS.find((variant) => variant.id === 'B2');
    const originalApply = b2.apply;
    b2.apply = () => ({ ...BASE_CHARGE, finishing_front: 'B2_MARKER' });
    const laterSpies = PHASE_B_VARIANTS.filter((v) => ['B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10'].includes(v.id)).map((v) => vi.spyOn(v, 'apply'));
    try {
      const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
      expect(outcome.stop_reason).toBe('transport_failure');
      expect(outcome.phase_a_verdict).toBe('inconclusive'); // arbitrage architecte : TOUJOURS inconclusive, meme si phase A avait deja conclu
      for (const spy of laterSpies) expect(spy).not.toHaveBeenCalled();
      // 1 CheckAuth + 3 (phase A, toutes refused) + B1 (refused) + B2 (panne) = 6.
      expect(outcome.billed_calls_used).toBe(6);
    } finally {
      b2.apply = originalApply;
      laterSpies.forEach((s) => s.mockRestore());
    }
  });

  it('une transport_failure en phase C (apres une phase A entierement priced) arrete aussi la campagne', async () => {
    let call = 0;
    const callQuote = vi.fn(async () => {
      call += 1;
      if (call <= 3) return jsonOk({ success: true, response: 42 }); // 3 succes en phase A -> B sautee, C directe
      return transportFailure('network_error'); // premiere panne en C
    });
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
    expect(outcome.stop_reason).toBe('transport_failure');
    expect(outcome.phase_a_verdict).toBe('inconclusive');
    // 1 CheckAuth + 3 (phase A, priced) + 1 (C1, panne) = 5.
    expect(outcome.billed_calls_used).toBe(5);
  });
});

describe('runClariprintVariantsBench — verdict de phase A (arbitrage architecte, point (1))', () => {
  // qa-review round 2 (MOYEN, K2) : un chiffrage en 403 avec {success:false}
  // (defensivement peuple sur ok2xx=false) reste une transport_failure,
  // JAMAIS refused.
  it('un chiffrage en 403 avec un corps {success:false} reste une transport_failure, JAMAIS refused', async () => {
    const callQuote = vi.fn(async () => ({ transport: 'ok', httpStatus: 403, payload: { success: false }, ok2xx: false }));
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
    expect(outcome.stop_reason).toBe('transport_failure');
    expect(outcome.phase_a_verdict).toBe('inconclusive');
  });

  it('trois refused/invalid_price (mix) -> deterministic_not_priced, retained_rule=422, phase B jouee', async () => {
    let call = 0;
    const callQuote = vi.fn(async () => {
      call += 1;
      if (call <= 3) return call === 2 ? jsonOk({ success: true, response: -1 }) : jsonOk({ success: false }); // invalid_price + refused, aucun priced
      return jsonOk({ success: false }); // phase B : tout echoue
    });
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
    expect(outcome.phase_a_verdict).toBe('deterministic_not_priced');
    expect(outcome.retained_rule).toBe(422);
    expect(call).toBeGreaterThan(3); // phase B a bien ete jouee
  });

  it('un melange priced/non-priced en phase A -> non_deterministic, retained_rule=502, phase B SAUTEE', async () => {
    let call = 0;
    const callQuote = vi.fn(async () => {
      call += 1;
      return call === 2 ? jsonOk({ success: true, response: 10 }) : jsonOk({ success: false });
    });
    const applySpies = PHASE_B_VARIANTS.map((v) => vi.spyOn(v, 'apply'));
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
    expect(outcome.phase_a_verdict).toBe('non_deterministic');
    expect(outcome.retained_rule).toBe(502);
    for (const spy of applySpies) expect(spy).not.toHaveBeenCalled();
    expect(outcome.stop_reason).toBe('completed');
    applySpies.forEach((s) => s.mockRestore());
  });

  it('trois priced -> phase_a_verdict=priced, retained_rule=null, phase B SAUTEE, phase C jouee sur la charge de base', async () => {
    const callQuote = vi.fn(async () => jsonOk({ success: true, response: 5 }));
    const applySpies = PHASE_B_VARIANTS.map((v) => vi.spyOn(v, 'apply'));
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
    expect(outcome.phase_a_verdict).toBe('priced');
    expect(outcome.retained_rule).toBeNull();
    for (const spy of applySpies) expect(spy).not.toHaveBeenCalled();
    // 1 CheckAuth + 3 (A) + 4 (C, base ne porte aucune finition) = 8.
    expect(outcome.billed_calls_used).toBe(8);
    applySpies.forEach((s) => s.mockRestore());
  });
});

describe('runClariprintVariantsBench — phase B, arret au premier prix', () => {
  it('arrete au premier succes, ne teste jamais les variantes suivantes, puis joue la phase C sur cette base', async () => {
    const callQuote = vi.fn(async (charge) => (
      charge.finishing_front === 'B3_MARKER' ? jsonOk({ success: true, response: 7 }) : jsonOk({ success: false })
    ));
    const b3 = PHASE_B_VARIANTS.find((v) => v.id === 'B3');
    const originalApply = b3.apply;
    b3.apply = () => ({ ...BASE_CHARGE, finishing_front: 'B3_MARKER' });
    const laterSpies = PHASE_B_VARIANTS.filter((v) => ['B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10'].includes(v.id)).map((v) => vi.spyOn(v, 'apply'));
    try {
      const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
      expect(outcome.stop_reason).toBe('stopped_on_price');
      expect(outcome.cause).toBe('B3');
      for (const spy of laterSpies) expect(spy).not.toHaveBeenCalled();
      // 1 CheckAuth + 3 (A, refused) + 3 (B1,B2,B3) + 4 (C, base ne porte aucune finition connue hors B3_MARKER) = 11.
      expect(outcome.billed_calls_used).toBe(11);
    } finally {
      b3.apply = originalApply;
      laterSpies.forEach((s) => s.mockRestore());
    }
  });

  it('dix echecs en phase B -> stop_reason=completed a 14 appels, aucune phase C', async () => {
    const callQuote = vi.fn(NEVER_PRICED_QUOTE);
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
    expect(outcome.stop_reason).toBe('completed');
    expect(outcome.billed_calls_used).toBe(14);
    expect(outcome.acceptedFinishingCodes).toEqual([]);
  });
});

describe('runClariprintVariantsBench — phase C filtre les codes deja portes par la base', () => {
  it('ne rejoue pas un code deja present, et compte les codes acceptes', async () => {
    const chargeWithFinishing = { ...BASE_CHARGE, finishing_front: PHASE_C_FINISHING_CODES[0] };
    let phaseACount = 0;
    const callQuote = vi.fn(async (charge) => {
      if (charge === chargeWithFinishing) {
        phaseACount += 1;
        return phaseACount === 1 ? jsonOk({ success: true, response: 5 }) : jsonOk({ success: false });
      }
      return jsonOk({ success: true, response: 1 });
    });
    const outcome = await runClariprintVariantsBench({ baseCharge: chargeWithFinishing, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
    expect(outcome.phase_a_verdict).toBe('non_deterministic');
    expect(outcome.acceptedFinishingCodes).toHaveLength(PHASE_C_FINISHING_CODES.length - 1);
    expect(outcome.acceptedFinishingCodes).not.toContain(PHASE_C_FINISHING_CODES[0]);
  });
});

describe("runClariprintVariantsBench — calls.json (liste fermee) : jamais un prix positif ni un nom d'imprimeur", () => {
  it("l'archive ne contient JAMAIS un prix positif, un nom d'imprimeur, ni un texte Clariprint — meme si le logger le recoit", async () => {
    const callQuote = vi.fn(async () => jsonOk({
      success: true,
      response: 178.5, // prix positif — ne doit PAS figurer dans calls.json
      fournisseur: 'ImprimerieSecreteDuParc',
      all_process: [{ printer: 'ImprimerieSecreteDuParc' }],
      all_faulty_process: { ImprimerieSecreteDuParc: 'raison' },
      error: 'Aucun papier chez ImprimerieSecreteDuParc',
    }));
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
    const serializedCalls = JSON.stringify(outcome.calls);
    expect(serializedCalls).not.toContain('178.5');
    expect(serializedCalls).not.toContain('ImprimerieSecreteDuParc');
    expect(serializedCalls).not.toContain('Aucun papier');
    for (const call of outcome.calls) {
      expect(Object.keys(call).sort()).toEqual([
        'all_process_count', 'duration_ms', 'error_class', 'error_present', 'faulty_process_count',
        'http_status', 'ordinal', 'outcome', 'response_class', 'started_at', 'step_id', 'transport',
        'upstream_success', 'variant',
      ].sort());
    }
  });

  // qa-review round 2 (MOYEN, sonde n°1) : `response_raw` etait ecrit pour
  // TOUT `invalid_price`, y compris un prix positif, un texte ou un objet.
  // Trois sondes bout-en-bout (jusqu'a `outcome.calls`, l'archive reelle).
  it('sonde 1 : success chaine "true" + response positif (178.95) -> AUCUN response_raw, AUCUN prix dans calls.json', async () => {
    const callQuote = vi.fn(async () => jsonOk({ success: 'true', response: 178.95 }));
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
    const call = outcome.calls.find((c) => c.step_id === 'A2');
    expect(call.outcome).toBe('invalid_price');
    expect(call).not.toHaveProperty('response_raw');
    expect(JSON.stringify(outcome.calls)).not.toContain('178.95');
  });

  it('sonde 2 : response en texte (nom d imprimeur) -> AUCUN response_raw, le nom n apparait nulle part dans calls.json', async () => {
    const callQuote = vi.fn(async () => jsonOk({ success: true, response: 'Aucun stock chez ImprimerieSecrete2' }));
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
    const call = outcome.calls.find((c) => c.step_id === 'A2');
    expect(call.outcome).toBe('invalid_price');
    expect(call).not.toHaveProperty('response_raw');
    expect(JSON.stringify(outcome.calls)).not.toContain('ImprimerieSecrete2');
  });

  it('sonde 3 : response en objet -> AUCUN response_raw, AUCUNE serialisation de l objet dans calls.json', async () => {
    const callQuote = vi.fn(async () => jsonOk({ success: true, response: { html: 'W_HTML_TEMOIN' } }));
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
    const call = outcome.calls.find((c) => c.step_id === 'A2');
    expect(call.outcome).toBe('invalid_price');
    expect(call).not.toHaveProperty('response_raw');
    expect(JSON.stringify(outcome.calls)).not.toContain('W_HTML_TEMOIN');
  });

  it('le texte Clariprint (substitue) va UNIQUEMENT dans `texts`, jamais dans `calls`', async () => {
    const callQuote = vi.fn(async () => jsonOk({
      success: false,
      error: 'Aucun papier chez ImprimerieDupont',
      all_process: [{ printer: 'ImprimerieDupont' }],
    }));
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth: ALWAYS_ALLOWED_AUTH, callQuote });
    expect(JSON.stringify(outcome.calls)).not.toContain('ImprimerieDupont');
    expect(JSON.stringify(outcome.calls)).not.toContain('Aucun papier');
    const text = outcome.texts.find((entry) => entry.step_id === 'A2');
    expect(text.text).toBe('Aucun papier chez imprimeur_1');
  });

  it('archive() recoit calls ET texts a chaque appel, cumulatifs', async () => {
    const archivedStates = [];
    await runClariprintVariantsBench({
      baseCharge: BASE_CHARGE,
      callCheckAuth: async () => transportFailure('network_error'),
      callQuote: vi.fn(),
      archive: async (state) => archivedStates.push(state),
    });
    expect(archivedStates).toHaveLength(1);
    expect(archivedStates[0].calls).toHaveLength(1);
    expect(archivedStates[0].texts).toEqual([]);
  });
});
