import { describe, expect, it } from 'vitest';
import {
  MAX_BILLED_CALLS,
  PHASE_A_REPEAT_COUNT,
  PHASE_B_VARIANTS,
  PHASE_C_FINISHING_CODES,
  buildWorstCasePlan,
  chargeAlreadyHasFinishing,
  planCallsByPhase,
  withFinishingCode,
} from '../../../scripts/diagnostics/clariprint-variants/plan.mjs';
import { CLARIPRINT_FINISHING_LABELS } from '@/modules/clariprint/application/clariprint-finishing-codes';

const BASE_CHARGE = Object.freeze({
  reference: 'FLYER A5',
  kind: 'leaflet',
  quantity: '500',
  width: '14.8',
  height: '21',
  papers: { custom: { quality: 'Couché Brillant', weight: '135' } },
  front_colors: ['4-color'],
  back_colors: ['4-color'],
  finishing_front: '',
  with_bleeds: '1',
  deliveries: { d_livraison: { iso: 'FR-75', address: '', quantity: '500' } },
});

describe('MAX_BILLED_CALLS', () => {
  // docs/api/CONVENTIONS.md §8.25 point 2.3 : "Nombre fixé avant de lancer :
  // 18 appels au plus (4 + 10 + 4)." — plafond écrit dans le code (Q7).
  it('vaut 18', () => {
    expect(MAX_BILLED_CALLS).toBe(18);
  });
});

describe('buildWorstCasePlan', () => {
  it('compte exactement 18 etapes dans le pire cas (4 + 10 + 4)', () => {
    const plan = buildWorstCasePlan(BASE_CHARGE);
    expect(plan).toHaveLength(MAX_BILLED_CALLS);
  });

  it('repartit les etapes par phase : A=4 (1 CheckAuth + 3 identiques), B=10, C=4', () => {
    const plan = buildWorstCasePlan(BASE_CHARGE);
    const byPhase = planCallsByPhase(plan);
    expect(byPhase).toEqual({ A: 1 + PHASE_A_REPEAT_COUNT, B: PHASE_B_VARIANTS.length, C: PHASE_C_FINISHING_CODES.length });
    expect(byPhase.A).toBe(4);
    expect(byPhase.B).toBe(10);
    expect(byPhase.C).toBe(4);
  });

  it('la phase A commence par un CheckAuth puis 3 fois EXACTEMENT la meme charge (point 2.3)', () => {
    const plan = buildWorstCasePlan(BASE_CHARGE);
    expect(plan[0]).toMatchObject({ id: 'A0', phase: 'A', kind: 'check_auth' });
    const phaseAQuotes = plan.filter((step) => step.phase === 'A' && step.kind === 'quote');
    expect(phaseAQuotes).toHaveLength(3);
    for (const step of phaseAQuotes) expect(step.charge).toEqual(BASE_CHARGE);
  });

  it('les variantes de la phase B suivent l ordre du soupcon B1..B10', () => {
    const plan = buildWorstCasePlan(BASE_CHARGE);
    const phaseBIds = plan.filter((step) => step.phase === 'B').map((step) => step.id);
    expect(phaseBIds).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10']);
  });

  it('la phase C porte les quatre codes du referentiel des finitions, EXACTEMENT ceux de src/modules/clariprint', () => {
    const plan = buildWorstCasePlan(BASE_CHARGE);
    const phaseCIds = plan.filter((step) => step.phase === 'C').map((step) => step.id);
    expect(phaseCIds).toEqual(PHASE_C_FINISHING_CODES.map((code) => `C_${code}`));
    // Le referentiel applicatif (src/modules/clariprint) et la copie
    // declarative du banc (plan.mjs, hors perimetre tsc) ne doivent jamais
    // diverger : les quatre codes sont les memes cles, moins la ligne vide.
    const referentialCodes = Object.keys(CLARIPRINT_FINISHING_LABELS).filter((code) => code !== '');
    expect([...PHASE_C_FINISHING_CODES].sort()).toEqual([...referentialCodes].sort());
  });
});

describe('les variantes B1-B10 modifient bien la dimension qu elles ciblent', () => {
  it('B1/B2 changent la qualite papier sans toucher au reste', () => {
    const b1 = PHASE_B_VARIANTS.find((v) => v.id === 'B1').apply(BASE_CHARGE);
    expect(b1.papers.custom.quality).toBe('Couché Mat PEFC');
    expect(b1.papers.custom.weight).toBe('135');
    const b2 = PHASE_B_VARIANTS.find((v) => v.id === 'B2').apply(BASE_CHARGE);
    expect(b2.papers.custom.quality).toBe('Offset Blanc');
  });

  it('B4 bascule papers.custom vers papers.of en gardant la valeur', () => {
    const b4 = PHASE_B_VARIANTS.find((v) => v.id === 'B4').apply(BASE_CHARGE);
    expect(b4.papers).toEqual({ of: BASE_CHARGE.papers.custom });
  });

  it('B5 retire back_colors', () => {
    const b5 = PHASE_B_VARIANTS.find((v) => v.id === 'B5').apply(BASE_CHARGE);
    expect(b5).not.toHaveProperty('back_colors');
    expect(b5.front_colors).toEqual(BASE_CHARGE.front_colors);
  });

  it('B6/B7 changent le code d encre', () => {
    const b6 = PHASE_B_VARIANTS.find((v) => v.id === 'B6').apply(BASE_CHARGE);
    expect(b6.front_colors).toEqual(['4color']);
    expect(b6.back_colors).toEqual(['4color']);
    const b7 = PHASE_B_VARIANTS.find((v) => v.id === 'B7').apply(BASE_CHARGE);
    expect(b7.front_colors).toEqual(['quadri']);
  });

  it('B8 transforme deliveries en tableau', () => {
    const b8 = PHASE_B_VARIANTS.find((v) => v.id === 'B8').apply(BASE_CHARGE);
    expect(Array.isArray(b8.deliveries)).toBe(true);
    expect(b8.deliveries).toEqual([BASE_CHARGE.deliveries.d_livraison]);
  });

  it('B9 remplace width/height par size', () => {
    const b9 = PHASE_B_VARIANTS.find((v) => v.id === 'B9').apply(BASE_CHARGE);
    expect(b9).not.toHaveProperty('width');
    expect(b9).not.toHaveProperty('height');
    expect(b9.size).toBe('14.8x21');
  });

  it('B10 pose with_bleeds a "0"', () => {
    const b10 = PHASE_B_VARIANTS.find((v) => v.id === 'B10').apply(BASE_CHARGE);
    expect(b10.with_bleeds).toBe('0');
  });
});

describe('chargeAlreadyHasFinishing / withFinishingCode', () => {
  it('detecte un code deja present en facade ou en dos', () => {
    expect(chargeAlreadyHasFinishing({ finishing_front: 'PELLIC_ACETATE_MAT' }, 'PELLIC_ACETATE_MAT')).toBe(true);
    expect(chargeAlreadyHasFinishing({ finishing_back: 'OFFSET_SATIN' }, 'OFFSET_SATIN')).toBe(true);
    expect(chargeAlreadyHasFinishing({ finishing_front: '' }, 'OFFSET_SATIN')).toBe(false);
  });

  it('pose le code en facade sans toucher au reste', () => {
    const result = withFinishingCode(BASE_CHARGE, 'OFFSET_SATIN');
    expect(result.finishing_front).toBe('OFFSET_SATIN');
    expect(result.quantity).toBe(BASE_CHARGE.quantity);
  });
});
