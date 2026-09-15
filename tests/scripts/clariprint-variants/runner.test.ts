import { describe, expect, it, vi } from 'vitest';
import {
  BilledCallCapExceededError,
  buildDryRunReport,
  runClariprintVariantsBench,
} from '../../../scripts/diagnostics/clariprint-variants/runner.mjs';
import { MAX_BILLED_CALLS, PHASE_B_VARIANTS, PHASE_C_FINISHING_CODES } from '../../../scripts/diagnostics/clariprint-variants/plan.mjs';

const BASE_CHARGE = Object.freeze({ reference: 'FLYER A5', quantity: '500', finishing_front: '' });

describe('buildDryRunReport (mode sec)', () => {
  it("n'accepte AUCUN appelant reseau — sa signature ne prend que la charge", () => {
    // Preuve par signature : impossible de lui faire declencher un appel,
    // puisqu'aucune fonction callCheckAuth/callQuote ne peut lui etre passee.
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

  it('annonce exactement le plan que l execution reelle suivrait (18 au plus, 9 nominal, 8 si la phase A chiffre)', () => {
    const report = buildDryRunReport(BASE_CHARGE);
    expect(report.mode).toBe('dry');
    expect(report.maxBilledCalls).toBe(MAX_BILLED_CALLS);
    expect(report.totalPlannedCalls).toBe(18);
    expect(report.callsByPhase).toEqual({ A: 4, B: 10, C: 4 });
    expect(report.steps).toHaveLength(18);
  });
});

describe('runClariprintVariantsBench — plafond et comptage', () => {
  it('incremente le compteur AVANT chaque appel, CheckAuth compris, et refuse le dix-neuvieme', async () => {
    // Plan factice qui ne s'arreterait JAMAIS de lui-meme (CheckAuth
    // toujours autorise, aucune variante ne chiffre jamais) : preuve que
    // c'est bien le PLAFOND, et non une regle d'arret de phase, qui coupe
    // l'execution.
    let quoteCalls = 0;
    const callQuote = vi.fn(async () => { quoteCalls += 1; return { priced: false }; });
    const callCheckAuth = vi.fn(async () => ({ allowed: true }));
    const archived = [];

    await expect(runClariprintVariantsBench({
      baseCharge: BASE_CHARGE,
      callCheckAuth,
      callQuote,
      archive: async (calls) => { archived.push(calls.length); },
      maxBilledCalls: 5,
    })).rejects.toThrow(BilledCallCapExceededError);

    // 1 CheckAuth + 4 quotes de phase A/B avant le refus du 6e appel.
    expect(callCheckAuth).toHaveBeenCalledTimes(1);
    expect(quoteCalls).toBe(4);
    // Chaque appel EFFECTUE a bien ete archive (5 archivages, pas 6).
    expect(archived).toEqual([1, 2, 3, 4, 5]);
  });

  it('avec le plafond par defaut (18), une campagne qui echoue partout consomme au plus 18 appels', async () => {
    const callCheckAuth = vi.fn(async () => ({ allowed: true }));
    const callQuote = vi.fn(async () => ({ priced: false }));
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth, callQuote });
    // 1 (CheckAuth) + 3 (phase A) + 10 (phase B) = 14 : la cause n'est pas
    // trouvee, la campagne s'arrete SANS jouer la phase C (point 2.3).
    expect(outcome.totalBilledCalls).toBe(14);
    expect(outcome.verdict).toBe('cause_not_found');
    expect(outcome.acceptedFinishingCodes).toEqual([]);
    expect(callQuote).toHaveBeenCalledTimes(13);
  });
});

describe('runClariprintVariantsBench — ordre des phases et regles d arret', () => {
  it('CheckAuth refuse -> arret a 1 appel, aucun devis tente', async () => {
    const callCheckAuth = vi.fn(async () => ({ allowed: false }));
    const callQuote = vi.fn();
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth, callQuote });
    expect(outcome.verdict).toBe('auth_refused');
    expect(outcome.totalBilledCalls).toBe(1);
    expect(callQuote).not.toHaveBeenCalled();
  });

  it('un prix obtenu au moins une fois en phase A -> non deterministe, la phase B est SAUTEE (les variantes ne sont JAMAIS appliquees)', async () => {
    const callCheckAuth = vi.fn(async () => ({ allowed: true }));
    let phaseACount = 0;
    const callQuote = vi.fn(async (charge) => {
      // Seuls les 3 premiers appels sont la charge IDENTIQUE de phase A ;
      // les suivants sont la phase C (finishing_front different).
      if (charge.finishing_front === BASE_CHARGE.finishing_front) {
        phaseACount += 1;
        // La 2e des 3 charges identiques de la phase A chiffre : non-determinisme.
        return phaseACount === 2 ? { priced: true, price: 42 } : { priced: false };
      }
      return { priced: false };
    });
    const applySpies = PHASE_B_VARIANTS.map((variant) => vi.spyOn(variant, 'apply'));
    const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth, callQuote });
    expect(outcome.verdict).toBe('non_deterministic');
    expect(outcome.deterministic).toBe(false);
    for (const spy of applySpies) expect(spy).not.toHaveBeenCalled();
    // 1 CheckAuth + 3 (phase A) + 4 (phase C, aucun code deja porte par BASE_CHARGE) = 8.
    expect(outcome.totalBilledCalls).toBe(8);
    expect(phaseACount).toBe(3);
    applySpies.forEach((spy) => spy.mockRestore());
  });

  it('trois echecs identiques en phase A -> phase B ; arret au PREMIER succes, les variantes suivantes ne sont JAMAIS appelees', async () => {
    const callCheckAuth = vi.fn(async () => ({ allowed: true }));
    const callQuote = vi.fn(async (charge) => (
      charge.finishing_front === 'FORCED_WINNER_MARKER' ? { priced: true, price: 10 } : { priced: false }
    ));
    // On force la variante B3 a produire un marqueur reconnaissable pour ce
    // test, et on espionne B4..B10 pour prouver qu'elles ne sont JAMAIS
    // appliquees une fois B3 gagnante.
    const b3 = PHASE_B_VARIANTS.find((variant) => variant.id === 'B3');
    const originalApply = b3.apply;
    b3.apply = () => ({ ...BASE_CHARGE, finishing_front: 'FORCED_WINNER_MARKER' });
    const laterVariants = PHASE_B_VARIANTS.filter((variant) => ['B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10'].includes(variant.id));
    const laterSpies = laterVariants.map((variant) => vi.spyOn(variant, 'apply'));
    try {
      const outcome = await runClariprintVariantsBench({ baseCharge: BASE_CHARGE, callCheckAuth, callQuote });
      expect(outcome.verdict).toBe('cause_found');
      expect(outcome.cause).toBe('B3');
      for (const spy of laterSpies) expect(spy).not.toHaveBeenCalled();
      // 1 CheckAuth + 3 (phase A) + 3 (B1, B2, B3) + 4 (phase C, le marqueur
      // de B3 n'est aucun des 4 codes du referentiel) = 11.
      expect(outcome.totalBilledCalls).toBe(11);
      expect(callQuote).toHaveBeenCalledTimes(10);
    } finally {
      b3.apply = originalApply;
      laterSpies.forEach((spy) => spy.mockRestore());
    }
  });

  it('phase C jouee apres un succes de phase A filtre le code deja present dans la base', async () => {
    const callCheckAuth = vi.fn(async () => ({ allowed: true }));
    const chargeWithFinishing = { ...BASE_CHARGE, finishing_front: PHASE_C_FINISHING_CODES[0] };
    let phaseACallCount = 0;
    const callQuote = vi.fn(async (charge) => {
      if (charge === chargeWithFinishing) {
        phaseACallCount += 1;
        return phaseACallCount === 1 ? { priced: true, price: 5 } : { priced: false };
      }
      return { priced: true, price: 1 };
    });
    const outcome = await runClariprintVariantsBench({ baseCharge: chargeWithFinishing, callCheckAuth, callQuote });
    expect(outcome.verdict).toBe('non_deterministic');
    // Les 4 codes de PHASE_C_FINISHING_CODES moins celui deja present = 3 essais de phase C.
    expect(outcome.acceptedFinishingCodes).toHaveLength(PHASE_C_FINISHING_CODES.length - 1);
    expect(outcome.acceptedFinishingCodes).not.toContain(PHASE_C_FINISHING_CODES[0]);
  });

  it('archive est appelee apres CHAQUE appel avec la liste cumulative', async () => {
    const callCheckAuth = vi.fn(async () => ({ allowed: false }));
    const archiveCalls = [];
    await runClariprintVariantsBench({
      baseCharge: BASE_CHARGE,
      callCheckAuth,
      callQuote: vi.fn(),
      archive: async (calls) => archiveCalls.push(calls),
    });
    expect(archiveCalls).toHaveLength(1);
    expect(archiveCalls[0]).toHaveLength(1);
    expect(archiveCalls[0][0]).toMatchObject({ id: 'A0', phase: 'A', kind: 'check_auth' });
  });
});
