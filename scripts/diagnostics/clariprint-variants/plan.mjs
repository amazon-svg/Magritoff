/**
 * BCP-1a (docs/api/CONVENTIONS.md §8.25 point 2.3) — le PLAN du banc de
 * rejeu Clariprint : une donnée déclarée (étapes et règles d'arrêt), pure,
 * sans aucune E/S. C'est ce module qui garantit que « le nombre annoncé est
 * celui que le code exécute ».
 *
 * Ce n'est PAS un endpoint, ni un rejeu automatique en production : un
 * instrument, lancé à la main (`run.mjs`), chaque appel étant FACTURÉ sur
 * le compte Clariprint de la plateforme.
 *
 * Trois phases, arrêt dès que la question est tranchée (point 2.3, tableau) :
 *  - A (4 appels au plus) : CheckAuth ×1, puis la charge exacte du smoke
 *    (A5) ×3, identique — tranche les identifiants et le déterminisme du
 *    `-1`.
 *  - B (≤ 10) : une dimension à la fois, dans l'ordre du soupçon — tranche
 *    la cause du `-1`.
 *  - C (≤ 4) : chacun des quatre codes de finition du référentiel
 *    (`clariprint-finishing-codes.ts`) que la base ne porte pas déjà —
 *    tranche les codes que le compte accepte.
 *
 * Nombre fixé avant de lancer : 18 appels au plus (4 + 10 + 4).
 */

/** Plafond écrit dans le code (Q7, décision d'Arnaud du 2026-09-15). */
export const MAX_BILLED_CALLS = 18;

/** Phase A : la charge exacte du smoke est rejouée 3 fois, identique. */
export const PHASE_A_REPEAT_COUNT = 3;

/**
 * Phase C : les quatre codes du référentiel (docs/api/CONVENTIONS.md §8.25
 * point 5.3 / `src/modules/clariprint/application/clariprint-finishing-codes.ts`).
 * Recopiés ici en donnée déclarée plutôt qu'importés : ce dossier n'est pas
 * couvert par `pnpm typecheck` (script opérationnel, hors périmètre des
 * modules — voir le story doc), donc pas d'import cross-langage TS/JS.
 * Un test compare cette liste à celle du référentiel pour qu'elle ne
 * diverge pas silencieusement.
 */
export const PHASE_C_FINISHING_CODES = Object.freeze([
  'PELLIC_ACETATE_BRILLANT',
  'PELLIC_ACETATE_MAT',
  'OFFSET_SATIN',
  'UVS_MAT_RESERVE',
]);

function withPapersQuality(charge, quality) {
  const current = charge.papers && typeof charge.papers === 'object' ? charge.papers : {};
  const key = 'custom' in current ? 'custom' : 'of' in current ? 'of' : 'custom';
  const currentEntry = current[key] && typeof current[key] === 'object' ? current[key] : {};
  return { ...charge, papers: { [key]: { ...currentEntry, quality } } };
}

function withPapersKey(charge, targetKey) {
  const current = charge.papers && typeof charge.papers === 'object' ? charge.papers : {};
  const sourceKey = Object.keys(current)[0];
  const entry = sourceKey ? current[sourceKey] : undefined;
  return { ...charge, papers: { [targetKey]: entry } };
}

function withoutKey(charge, key) {
  const { [key]: _removed, ...rest } = charge;
  return rest;
}

function withInkCode(charge, code) {
  const next = { ...charge, front_colors: [code] };
  if (Array.isArray(charge.back_colors) && charge.back_colors.length > 0) next.back_colors = [code];
  return next;
}

function withDeliveriesAsArray(charge) {
  const deliveries = charge.deliveries && typeof charge.deliveries === 'object' ? charge.deliveries : {};
  return { ...charge, deliveries: Object.values(deliveries) };
}

function withSizeInsteadOfWidthHeight(charge) {
  const { width, height, ...rest } = charge;
  return { ...rest, size: `${width}x${height}` };
}

/**
 * Les dix variantes de la phase B, DANS L'ORDRE DU SOUPÇON (point 2.3,
 * tableau) : B1 qualité « Couché Mat PEFC » · B2 « Offset Blanc » ·
 * B3 `finishing_front: ""` · B4 `papers.of` · B5 `back_colors` absent ·
 * B6 encre `"4color"` · B7 `"quadri"` · B8 `deliveries` en tableau ·
 * B9 `size` au lieu de `width`/`height` · B10 `with_bleeds: "0"`.
 */
export const PHASE_B_VARIANTS = Object.freeze([
  { id: 'B1', label: 'qualité "Couché Mat PEFC"', apply: (charge) => withPapersQuality(charge, 'Couché Mat PEFC') },
  { id: 'B2', label: 'qualité "Offset Blanc"', apply: (charge) => withPapersQuality(charge, 'Offset Blanc') },
  { id: 'B3', label: 'finishing_front vide', apply: (charge) => ({ ...charge, finishing_front: '' }) },
  { id: 'B4', label: 'papers.of au lieu de papers.custom', apply: (charge) => withPapersKey(charge, 'of') },
  { id: 'B5', label: 'back_colors absent', apply: (charge) => withoutKey(charge, 'back_colors') },
  { id: 'B6', label: 'encre "4color"', apply: (charge) => withInkCode(charge, '4color') },
  { id: 'B7', label: 'encre "quadri"', apply: (charge) => withInkCode(charge, 'quadri') },
  { id: 'B8', label: 'deliveries en tableau', apply: (charge) => withDeliveriesAsArray(charge) },
  { id: 'B9', label: '"size" au lieu de width/height', apply: (charge) => withSizeInsteadOfWidthHeight(charge) },
  { id: 'B10', label: 'with_bleeds "0"', apply: (charge) => ({ ...charge, with_bleeds: '0' }) },
]);

/** Un code de finition figure-t-il déjà dans la charge (front OU back) ? */
export function chargeAlreadyHasFinishing(charge, code) {
  return charge.finishing_front === code || charge.finishing_back === code;
}

/** Applique un code de finition en façade (`finishing_front`), pour la phase C. */
export function withFinishingCode(charge, code) {
  return { ...charge, finishing_front: code };
}

/**
 * Le plan complet, dans le pire cas (aucun arrêt anticipé) : 1 CheckAuth +
 * 3 appels identiques (A) + 10 variantes (B) + 4 codes de finition (C).
 * Exactement `MAX_BILLED_CALLS` (18) étapes — un test le vérifie.
 *
 * C'est CE plan qu'imprime le mode sec (« il imprime le plan, les charges
 * et le décompte, et n'ouvre AUCUNE connexion »). L'exécution réelle
 * (`runner.mjs`) suit les mêmes règles d'arrêt et ne fait JAMAIS plus
 * d'appels que ce plan n'en déclare.
 */
export function buildWorstCasePlan(baseCharge) {
  const steps = [{ id: 'A0', phase: 'A', kind: 'check_auth', label: 'CheckAuth' }];
  for (let i = 1; i <= PHASE_A_REPEAT_COUNT; i += 1) {
    steps.push({ id: `A${i}`, phase: 'A', kind: 'quote', label: 'charge exacte du smoke (A5), identique', charge: baseCharge });
  }
  for (const variant of PHASE_B_VARIANTS) {
    steps.push({ id: variant.id, phase: 'B', kind: 'quote', label: variant.label, charge: variant.apply(baseCharge) });
  }
  for (const code of PHASE_C_FINISHING_CODES) {
    steps.push({ id: `C_${code}`, phase: 'C', kind: 'quote', label: `finition ${code}`, charge: withFinishingCode(baseCharge, code) });
  }
  return steps;
}

/** Répartition des appels par phase, pour le rapport du mode sec. */
export function planCallsByPhase(plan) {
  return plan.reduce((counts, step) => ({ ...counts, [step.phase]: (counts[step.phase] ?? 0) + 1 }), {});
}
