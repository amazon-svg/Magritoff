/**
 * `computeReorderedStepIds`/`filterStepsForDisplay` (E10.13) — helpers PURS
 * extraits de `ProductionStepsPage.tsx`.
 *
 * Couvre la regression qa-review round 1 (B1) : le corps du
 * `PUT /production-step-positions` doit TOUJOURS porter le catalogue COMPLET
 * du tenant (actives ET desactivees), meme quand un filtre `status` est
 * actif a l ecran — CONVENTIONS.md §8.15 decision #5/#8.
 */
import { describe, expect, it } from 'vitest';
import {
  computeReorderedStepIds,
  filterStepsForDisplay,
} from '@/modules/production-steps/ui/workspace/production-steps.helpers';
import type { ProductionStepDto } from '@/modules/production-steps/api/contracts';

function makeStep(overrides: Partial<ProductionStepDto> & Pick<ProductionStepDto, 'id'>): ProductionStepDto {
  return {
    tenant_id: 'tenant-1',
    label: overrides.id,
    position: 0,
    color: 'slate',
    is_terminal: false,
    is_active: true,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
    ...overrides,
  };
}

// Catalogue de 6 etapes, la 3e ("PAO") desactivee — scenario reproduit par
// qa-review : filtre "Actives" => 5 lignes affichees, mais le catalogue
// complet en compte 6.
const CATALOG: readonly ProductionStepDto[] = [
  makeStep({ id: 'step-1', label: 'Reception', position: 0 }),
  makeStep({ id: 'step-2', label: 'Prepresse', position: 1 }),
  makeStep({ id: 'step-3', label: 'PAO', position: 2, is_active: false }),
  makeStep({ id: 'step-4', label: 'Impression', position: 3 }),
  makeStep({ id: 'step-5', label: 'Faconnage', position: 4 }),
  makeStep({ id: 'step-6', label: 'Expedition', position: 5, is_terminal: true }),
];

describe('computeReorderedStepIds', () => {
  it('porte le catalogue COMPLET meme quand draggedId/targetId proviennent d une liste filtree', () => {
    // Reproduit le bug B1 : la liste affichee (filtre "Actives") ne contient
    // pas "step-3" (PAO, desactivee) — mais `catalog` (jamais filtre) si.
    const filtered = filterStepsForDisplay(CATALOG, 'active');
    expect(filtered.map((step) => step.id)).toEqual(['step-1', 'step-2', 'step-4', 'step-5', 'step-6']);

    // Glisser "step-1" (Reception) sur "step-4" (Impression), tous deux
    // visibles sous le filtre "Actives".
    const reordered = computeReorderedStepIds(CATALOG, 'step-1', 'step-4');

    // Les 6 identifiants sont presents (pas 5) : "step-3" (desactivee, hors
    // filtre) n a pas disparu de la commande transmise au serveur.
    expect(reordered).not.toBeNull();
    expect(reordered).toHaveLength(6);
    expect(reordered).toContain('step-3');
    expect(new Set(reordered)).toEqual(new Set(CATALOG.map((step) => step.id)));
  });

  it('deplace bien l element vers la position cible dans le catalogue complet', () => {
    const reordered = computeReorderedStepIds(CATALOG, 'step-1', 'step-4');
    // "step-1" doit maintenant se trouver a l index ou etait "step-4"
    // (glisser-deposer = insertion a la position de la cible).
    expect(reordered).toEqual(['step-2', 'step-3', 'step-4', 'step-1', 'step-5', 'step-6']);
  });

  it('rend null si un identifiant est introuvable dans le catalogue', () => {
    expect(computeReorderedStepIds(CATALOG, 'inconnu', 'step-4')).toBeNull();
    expect(computeReorderedStepIds(CATALOG, 'step-1', 'inconnu')).toBeNull();
  });

  it('rend null si la position ne change pas (source = cible)', () => {
    expect(computeReorderedStepIds(CATALOG, 'step-2', 'step-2')).toBeNull();
  });
});

describe('filterStepsForDisplay', () => {
  it('rend le catalogue complet sans filtre', () => {
    expect(filterStepsForDisplay(CATALOG, null)).toEqual(CATALOG);
  });

  it('ne garde que les etapes actives sous le filtre "active"', () => {
    const result = filterStepsForDisplay(CATALOG, 'active');
    expect(result.every((step) => step.is_active)).toBe(true);
    expect(result).toHaveLength(5);
  });

  it('ne garde que les etapes desactivees sous le filtre "disabled"', () => {
    const result = filterStepsForDisplay(CATALOG, 'disabled');
    expect(result.map((step) => step.id)).toEqual(['step-3']);
  });

  it('ne modifie jamais le catalogue source (projection pure)', () => {
    const before = [...CATALOG];
    filterStepsForDisplay(CATALOG, 'active');
    expect(CATALOG).toEqual(before);
  });
});
