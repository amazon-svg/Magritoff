import type {
  DocumentFieldId, DocumentFieldPlacementDto, DocumentPdfTemplatePageDto,
  DocumentType, ReplaceDocumentPdfTemplateFieldsCommand,
} from '@/modules/document-templates/api/contracts';

/** Point de départ éditable, sans données métier ni modification du fond PDF. */
export function basePlacementModel(page: DocumentPdfTemplatePageDto, type: DocumentType): ReplaceDocumentPdfTemplateFieldsCommand {
  const w = page.width_pt;
  const h = page.height_pt;
  const field = (id: DocumentFieldId, x: number, top: number, width: number, bold = false, maxLines = 1): DocumentFieldPlacementDto => ({
    field: id, page_index: page.index, x: x * w, y: (1 - top) * h, width: width * w,
    align: 'left', max_lines: maxLines, font: bold ? 'helvetica-bold' : 'helvetica', font_size: 10, color: '#111111',
  });
  // La zone des lignes s'arrête avant les totaux, y compris sur les pages de reprise.
  const rowHeight = Math.max(4, Math.min(16, h * 0.025));
  const firstBaseline = h * 0.63;
  const rows = Math.max(1, Math.min(200, Math.floor(h * 0.33 / rowHeight) + 1));
  return {
    placements: [
      field(type === 'order' ? 'order.number' : 'quote.number', 0.07, 0.12, 0.4, true),
      field(type === 'order' ? 'order.created_at' : 'quote.issued_at', 0.07, 0.17, 0.4),
      field(type === 'order' ? 'order.customer_reference' : 'quote.customer_reference', 0.07, 0.22, 0.4),
      field('customer.company_name', 0.54, 0.12, 0.39, true),
      field('customer.contact_name', 0.54, 0.17, 0.39),
      field('customer.billing_address_block', 0.54, 0.22, 0.39, false, 4),
      field('totals.net_total', 0.72, 0.78, 0.21, true),
      field('totals.vat_rate', 0.54, 0.84, 0.14),
      field('totals.vat_amount', 0.72, 0.84, 0.21),
      field('totals.total_incl_tax', 0.72, 0.90, 0.21, true),
      field('page.number_of_count', 0.82, 0.96, 0.11),
    ],
    lines_block: {
      page_index: page.index, first_row_baseline_y: firstBaseline, row_height: rowHeight,
      rows_per_page: rows, continuation_page_index: null,
      columns: [
        { field: 'line.label', x: w * 0.07, width: w * 0.55, align: 'left', font: 'helvetica', font_size: 10, color: '#111111' },
        { field: 'line.quantity', x: w * 0.64, width: w * 0.10, align: 'right', font: 'helvetica', font_size: 10, color: '#111111' },
        { field: 'line.price', x: w * 0.76, width: w * 0.17, align: 'right', font: 'helvetica', font_size: 10, color: '#111111' },
      ],
    },
  };
}

/** Copier les coordonnées exige les mêmes dimensions pour toutes les pages utilisées. */
export function placementPagesMatch(
  source: readonly DocumentPdfTemplatePageDto[], target: readonly DocumentPdfTemplatePageDto[], map: ReplaceDocumentPdfTemplateFieldsCommand,
): boolean {
  const used = new Set(map.placements.map(p => p.page_index));
  if (map.lines_block) {
    used.add(map.lines_block.page_index);
    if (map.lines_block.continuation_page_index != null) used.add(map.lines_block.continuation_page_index);
  }
  return [...used].every(index => {
    const from = source.find(page => page.index === index);
    const to = target.find(page => page.index === index);
    return from && to && from.width_pt === to.width_pt && from.height_pt === to.height_pt;
  });
}
