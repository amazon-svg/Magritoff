import { describe, expect, it } from 'vitest';
import { buildCallRecord, buildCampaignSummary, CALLS_JSON_CALL_FIELDS } from '../../../scripts/diagnostics/clariprint-variants/archive.mjs';

describe('buildCallRecord — liste fermee (arbitrage architecte, point (2))', () => {
  it("n'ecrit JAMAIS un champ non nomme, meme si `classified` en porte un malveillant", () => {
    const record = buildCallRecord({
      ordinal: 1,
      stepId: 'A2',
      variant: { dimension: 'baseline', value: 'smoke_A5' },
      startedAt: '2026-09-15T00:00:00.000Z',
      durationMs: 12,
      classified: {
        outcome: 'priced',
        transport: 'ok',
        httpStatus: 200,
        upstreamSuccess: true,
        responseClass: 'positive',
        rawValue: 178.5, // temoin : NE DOIT PAS figurer dans le record
        fournisseur: 'ImprimerieSecrete', // temoin
        printer: 'ImprimerieSecrete', // temoin
      },
      allProcessCount: 1,
      faultyProcessCount: 0,
      errorPresent: false,
    });
    expect(Object.keys(record).sort()).toEqual(
      ['ordinal', 'step_id', 'variant', 'started_at', 'duration_ms', 'http_status', 'transport', 'upstream_success', 'outcome', 'response_class', 'all_process_count', 'faulty_process_count', 'error_present', 'error_class'].sort(),
    );
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('178.5');
    expect(serialized).not.toContain('ImprimerieSecrete');
  });

  it('response_raw n existe QUE pour invalid_price', () => {
    const priced = buildCallRecord({
      ordinal: 1, stepId: 'A2', variant: null, startedAt: 'x', durationMs: 1,
      classified: { outcome: 'priced', transport: 'ok', httpStatus: 200, upstreamSuccess: true, responseClass: 'positive' },
      responseRaw: '999', // ne doit PAS apparaitre : outcome != invalid_price
    });
    expect(priced).not.toHaveProperty('response_raw');

    const invalid = buildCallRecord({
      ordinal: 1, stepId: 'A2', variant: null, startedAt: 'x', durationMs: 1,
      classified: { outcome: 'invalid_price', transport: 'ok', httpStatus: 200, upstreamSuccess: true, responseClass: 'negative' },
      responseRaw: '-1',
    });
    expect(invalid.response_raw).toBe('-1');
  });

  it('error_class vaut unclassified uniquement quand error_present est vrai', () => {
    const withError = buildCallRecord({ ordinal: 1, stepId: 'A2', variant: null, startedAt: 'x', durationMs: 1, classified: { outcome: 'refused', transport: 'ok', httpStatus: 200, upstreamSuccess: false }, errorPresent: true });
    expect(withError.error_class).toBe('unclassified');
    const withoutError = buildCallRecord({ ordinal: 1, stepId: 'A2', variant: null, startedAt: 'x', durationMs: 1, classified: { outcome: 'priced', transport: 'ok', httpStatus: 200, upstreamSuccess: true }, errorPresent: false });
    expect(withoutError.error_class).toBeNull();
  });

  it('CALLS_JSON_CALL_FIELDS documente exactement les 15 champs autorises', () => {
    expect(CALLS_JSON_CALL_FIELDS).toHaveLength(15);
    expect(CALLS_JSON_CALL_FIELDS).toContain('response_raw');
    expect(CALLS_JSON_CALL_FIELDS).not.toContain('error');
    expect(CALLS_JSON_CALL_FIELDS).not.toContain('fournisseur');
  });
});

describe('buildCampaignSummary', () => {
  it('assemble les champs de campagne en snake_case', () => {
    const summary = buildCampaignSummary({
      planVersion: '1', maxBilledCalls: 18, billedCallsUsed: 9, billedCallsCumulative: 9,
      stopReason: 'completed', phaseAVerdict: 'deterministic_not_priced', retainedRule: 422,
    });
    expect(summary).toEqual({
      plan_version: '1', max_billed_calls: 18, billed_calls_used: 9, billed_calls_cumulative: 9,
      stop_reason: 'completed', phase_a_verdict: 'deterministic_not_priced', retained_rule: 422,
    });
  });
});
