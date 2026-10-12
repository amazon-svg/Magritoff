import { describe, expect, it } from 'vitest';
import { basePlacementModel, placementPagesMatch } from '@/modules/document-templates/ui/workspace/field-editor/placement-model';
import { replaceDocumentPdfTemplateFieldsCommandSchema } from '@/modules/document-templates/api/contracts';
import { validateDocumentFieldMap } from '@/modules/document-templates/application/document-field-map-validator';

const a4 = { index: 0, width_pt: 595.28, height_pt: 841.89 };

describe('modèle de base du positionnement', () => {
  for (const type of ['order', 'quote'] as const) {
    for (const page of [a4, { index: 0, width_pt: 841.89, height_pt: 595.28 }]) {
      it(`propose un placement valide ${type}, ${page.width_pt} × ${page.height_pt}`, () => {
        const map = basePlacementModel(page, type);
        expect(replaceDocumentPdfTemplateFieldsCommandSchema.safeParse(map).success).toBe(true);
        expect(validateDocumentFieldMap([page], map, type)).toEqual([]);
        expect(map.placements.some(p => p.field === `${type}.number`)).toBe(true);
        expect(map.placements.some(p => p.field === 'totals.total_incl_tax')).toBe(true);
        expect(map.placements.some(p => p.field.startsWith(type === 'order' ? 'quote.' : 'order.'))).toBe(false);
        const block = map.lines_block!;
        const lowest = block.first_row_baseline_y - (block.rows_per_page - 1) * block.row_height;
        expect(lowest).toBeGreaterThan(page.height_pt * 0.22);
        for (const column of block.columns) expect(column.x + column.width).toBeLessThanOrEqual(page.width_pt);
      });
    }
  }
  it('crée des copies indépendantes', () => {
    const first = basePlacementModel(a4, 'order');
    first.placements[0].x = 0;
    expect(basePlacementModel(a4, 'order').placements[0].x).toBeGreaterThan(0);
  });
});

describe('compatibilité des pages à copier', () => {
  const map = basePlacementModel(a4, 'order');
  it('accepte les mêmes dimensions et des pages inutilisées supplémentaires', () => {
    expect(placementPagesMatch([a4], [a4, { ...a4, index: 1 }], map)).toBe(true);
  });
  it('refuse de copier des coordonnées sur une page d’un autre format', () => {
    expect(placementPagesMatch([a4], [{ ...a4, width_pt: 400 }], map)).toBe(false);
  });
  it('vérifie aussi la page de reprise du tableau', () => {
    const extra = { ...a4, index: 1 };
    const continuation = { ...map, lines_block: { ...map.lines_block!, continuation_page_index: 1 } };
    expect(placementPagesMatch([a4, extra], [a4], continuation)).toBe(false);
    expect(placementPagesMatch([a4, extra], [a4, extra], continuation)).toBe(true);
  });
});
