/**
 * Helper PUR d `OrderStatusDialog` (E10.14) — derivation de l etat visuel de
 * chaque etape affichee en colonne droite de la modale.
 *
 * PAS UNE REGLE METIER au sens `.claude/rules/frontend.md` : aucun seuil,
 * aucune numerotation, aucun total. C est un affichage SEUL, fonde sur la
 * POSITION deja rendue par le serveur (`listProductionSteps`) et l etape
 * COURANTE deja rendue par le serveur (`CommercialOrder.current_production_
 * step_id`) — ce module ne calcule ni ne persiste jamais une progression
 * (CA4, docs/api/CONVENTIONS.md §8.16 decision #9 : le saut est autorise et
 * assume, aucune etape intermediaire n est jamais VALIDEE, ici ou ailleurs).
 */
import type { ProductionStepDto } from '@/modules/production-steps';

export type StepVisualState = 'done' | 'current' | 'pending';

/**
 * `current` si l etape EST l etape courante ; `done` si sa position est
 * STRICTEMENT inferieure a celle de l etape courante (affichage seul — ne
 * signifie PAS que la commande est reellement passee par cette etape, un
 * saut a pu l ignorer) ; `pending` sinon, y compris quand la commande ne
 * porte AUCUNE etape courante (`currentStepId` null : tout est `pending`).
 */
export function stepVisualState(
  step: Pick<ProductionStepDto, 'id' | 'position'>,
  currentStepId: string | null,
  currentPosition: number | null,
): StepVisualState {
  if (step.id === currentStepId) return 'current';
  if (currentPosition !== null && step.position < currentPosition) return 'done';
  return 'pending';
}

/** Position de l etape courante dans le catalogue, ou `null` si absente/introuvable. */
export function currentStepPosition(
  steps: readonly Pick<ProductionStepDto, 'id' | 'position'>[],
  currentStepId: string | null,
): number | null {
  if (currentStepId === null) return null;
  return steps.find((step) => step.id === currentStepId)?.position ?? null;
}
