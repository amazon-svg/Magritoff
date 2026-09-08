/**
 * Helpers PURS de `ProductionStepsPage` (E10.13) — glisser-deposer et filtre
 * d affichage. Aucun de ces deux calculs n est une regle metier au sens
 * `.claude/rules/frontend.md` (seuil, quota, total, numerotation) : ce sont
 * des projections/tris de LISTE UNIQUEMENT, la verite (position, unicite,
 * etat) reste posee cote serveur (`api_reorder_production_steps`, RLS).
 *
 * Regle a respecter ici (qa-review E10.13 round 1, B1) : le corps du
 * `PUT /production-step-positions` (`step_ids`) DOIT TOUJOURS porter le
 * catalogue COMPLET du tenant (actives ET desactivees) — jamais une
 * projection filtree par `status`. `computeReorderedStepIds` prend donc en
 * entree le catalogue complet, jamais la liste filtree affichee a l ecran.
 */
import type { ProductionStepDto, ProductionStepStatusFilter } from '@/modules/production-steps/api/contracts';

/**
 * Calcule le nouvel ordre des `step_ids` a transmettre au serveur.
 *
 * `catalog` DOIT etre le catalogue COMPLET du tenant (jamais une projection
 * filtree) : `draggedId`/`targetId` proviennent de la liste AFFICHEE (donc
 * potentiellement filtree), mais leur position est toujours recherchee dans
 * le catalogue complet — le reordonnancement retourne donc systematiquement
 * la totalite des identifiants, y compris les etapes desactivees non
 * visibles a l ecran au moment du glisser-deposer.
 *
 * Rend `null` si l un des deux identifiants est introuvable dans le
 * catalogue, ou si la position ne change pas (aucun reordonnancement a
 * envoyer).
 */
export function computeReorderedStepIds(
  catalog: readonly ProductionStepDto[],
  draggedId: string,
  targetId: string,
): readonly string[] | null {
  const fromIndex = catalog.findIndex((step) => step.id === draggedId);
  const toIndex = catalog.findIndex((step) => step.id === targetId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return null;

  const ids = catalog.map((step) => step.id);
  const [moved] = ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, moved!);
  return ids;
}

/**
 * Projette le catalogue COMPLET selon le filtre de statut choisi a l ecran.
 * Affichage SEUL : ce resultat n est jamais transmis au serveur pour un
 * reorder (voir `computeReorderedStepIds`, qui reste branche sur le
 * catalogue complet, pas sur cette projection).
 */
export function filterStepsForDisplay(
  catalog: readonly ProductionStepDto[],
  statusFilter: ProductionStepStatusFilter | null,
): readonly ProductionStepDto[] {
  if (!statusFilter) return catalog;
  return catalog.filter((step) => (statusFilter === 'active' ? step.is_active : !step.is_active));
}
