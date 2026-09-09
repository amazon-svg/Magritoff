/**
 * Table de correspondance enum backend -> libelle FR (E10.10b-4b), reprise du
 * wireframe valide `.design-handoff/wireframes/E10.10b-4b-editeur-coordonnees.md`
 * §1 — microcopy a reprendre LITTERALEMENT, pas reinventee.
 *
 * ALIGNEMENT DE TERMINOLOGIE (Q4 du wireframe, laissee au dev-story) : trois
 * libelles de la famille "Totaux" divergent de la version proposee au
 * wireframe, pour rester coherents avec ce qui est DEJA affiche a
 * l imprimeur sur `QuoteEditorPage` (`src/modules/commercial-quotes/ui/workspace/QuoteEditorPage.tsx`,
 * memes champs `totals.lines_subtotal`/`totals.net_total`/`totals.total_incl_tax`,
 * meme schema `CommercialQuoteTotals`) :
 *  - `totals.lines_subtotal`  : "Total des lignes (avant remise)" (wireframe) -> "Sous-total lignes" (QuoteEditorPage)
 *  - `totals.net_total`       : "Total HT" (wireframe) -> "Net HT" (QuoteEditorPage)
 *  - `totals.total_incl_tax`  : "Total TTC" — DEJA identique aux deux endroits, inchange.
 * `totals.vat_rate`/`totals.vat_amount` n ont pas d equivalent EXACT dans
 * QuoteEditorPage (qui les fusionne en un seul libelle "TVA (X %)") : les
 * libelles du wireframe ("Taux de TVA"/"Montant de TVA") sont conserves tels
 * quels, aucune divergence a arbitrer sur ces deux-la.
 */
import type { DocumentFieldId, DocumentFont, DocumentLineFieldId } from '@/modules/document-templates/api/contracts';

export type FieldFamilyId = 'quote' | 'customer' | 'totals' | 'page';

export type FieldCatalogEntry = Readonly<{
  id: DocumentFieldId;
  label: string;
  family: FieldFamilyId;
}>;

export const FIELD_FAMILY_LABELS: Readonly<Record<FieldFamilyId, string>> = Object.freeze({
  quote: 'Informations du devis',
  customer: 'Coordonnées client',
  totals: 'Totaux',
  page: 'Pagination',
});

/** Aide contextuelle A5/A6 du wireframe §4.3, affichee en tete de section. */
export const FIELD_FAMILY_HINTS: Readonly<Partial<Record<FieldFamilyId, string>>> = Object.freeze({
  totals:
    'Ces montants s’impriment automatiquement sur la dernière page du devis, même si le tableau des lignes continue sur une page suivante.',
  page: 'Ces numéros s’impriment sur chaque page du document.',
});

export const FIELD_CATALOG: readonly FieldCatalogEntry[] = Object.freeze([
  { id: 'quote.number', label: 'Numéro de devis', family: 'quote' },
  { id: 'quote.issued_at', label: 'Date d’émission', family: 'quote' },
  { id: 'quote.valid_until', label: 'Date de validité', family: 'quote' },
  { id: 'quote.customer_reference', label: 'Référence client', family: 'quote' },

  { id: 'customer.company_name', label: 'Raison sociale', family: 'customer' },
  { id: 'customer.contact_name', label: 'Nom du contact', family: 'customer' },
  { id: 'customer.billing_address_block', label: 'Adresse complète (bloc multi-lignes)', family: 'customer' },
  { id: 'customer.billing_line1', label: 'Adresse — ligne 1', family: 'customer' },
  { id: 'customer.billing_line2', label: 'Adresse — ligne 2', family: 'customer' },
  { id: 'customer.billing_postal_code', label: 'Code postal', family: 'customer' },
  { id: 'customer.billing_city', label: 'Ville', family: 'customer' },
  { id: 'customer.billing_country', label: 'Pays', family: 'customer' },
  { id: 'customer.email', label: 'E-mail', family: 'customer' },
  { id: 'customer.phone', label: 'Téléphone', family: 'customer' },
  { id: 'customer.siret', label: 'SIRET', family: 'customer' },
  { id: 'customer.vat_number', label: 'N° TVA intracommunautaire', family: 'customer' },

  // Terminologie alignee sur QuoteEditorPage (voir en-tete de fichier).
  { id: 'totals.lines_subtotal', label: 'Sous-total lignes', family: 'totals' },
  { id: 'totals.global_discount', label: 'Remise globale', family: 'totals' },
  { id: 'totals.net_total', label: 'Net HT', family: 'totals' },
  { id: 'totals.vat_rate', label: 'Taux de TVA', family: 'totals' },
  { id: 'totals.vat_amount', label: 'Montant de TVA', family: 'totals' },
  { id: 'totals.total_incl_tax', label: 'Total TTC', family: 'totals' },

  { id: 'page.number', label: 'Numéro de page', family: 'page' },
  { id: 'page.count', label: 'Nombre total de pages', family: 'page' },
  { id: 'page.number_of_count', label: 'Numéro de page / total (ex. « 2/3 »)', family: 'page' },
]);

export const FIELD_LABELS: ReadonlyMap<DocumentFieldId, string> = new Map(
  FIELD_CATALOG.map((entry) => [entry.id, entry.label]),
);

export function fieldLabel(id: DocumentFieldId): string {
  return FIELD_LABELS.get(id) ?? id;
}

export const LINE_FIELD_CATALOG: ReadonlyArray<Readonly<{ id: DocumentLineFieldId; label: string }>> = Object.freeze([
  { id: 'line.position', label: 'N° de ligne' },
  { id: 'line.label', label: 'Désignation' },
  { id: 'line.product_config_summary', label: 'Détail de la configuration' },
  { id: 'line.quantity', label: 'Quantité' },
  { id: 'line.price_before_discount', label: 'Prix avant remise' },
  { id: 'line.discount_rate', label: 'Taux de remise' },
  { id: 'line.price', label: 'Prix' },
]);

export const LINE_FIELD_LABELS: ReadonlyMap<DocumentLineFieldId, string> = new Map(
  LINE_FIELD_CATALOG.map((entry) => [entry.id, entry.label]),
);

export function lineFieldLabel(id: DocumentLineFieldId): string {
  return LINE_FIELD_LABELS.get(id) ?? id;
}

// ---------------------------------------------------------------------------
// `DocumentFont` — deux menus couples (famille / style), wireframe §1.
// ---------------------------------------------------------------------------

export type FontFamilyId = 'sans' | 'serif' | 'mono';
export type FontStyleId = 'normal' | 'bold' | 'italic';

export const FONT_FAMILY_LABELS: Readonly<Record<FontFamilyId, string>> = Object.freeze({
  sans: 'Sans empattement',
  serif: 'Avec empattement',
  mono: 'Chasse fixe',
});

export const FONT_STYLE_LABELS: Readonly<Record<FontStyleId, string>> = Object.freeze({
  normal: 'Normal',
  bold: 'Gras',
  italic: 'Italique',
});

/** Styles disponibles par famille — "Chasse fixe" n a pas de variante italique dans le contrat. */
export const FONT_STYLES_BY_FAMILY: Readonly<Record<FontFamilyId, readonly FontStyleId[]>> = Object.freeze({
  sans: ['normal', 'bold', 'italic'],
  serif: ['normal', 'bold', 'italic'],
  mono: ['normal', 'bold'],
});

const FONT_TO_ENUM: Readonly<Record<FontFamilyId, Partial<Record<FontStyleId, DocumentFont>>>> = Object.freeze({
  sans: { normal: 'helvetica', bold: 'helvetica-bold', italic: 'helvetica-oblique' },
  serif: { normal: 'times-roman', bold: 'times-bold', italic: 'times-italic' },
  mono: { normal: 'courier', bold: 'courier-bold' },
});

const ENUM_TO_FONT: ReadonlyMap<DocumentFont, Readonly<{ family: FontFamilyId; style: FontStyleId }>> = new Map(
  (Object.entries(FONT_TO_ENUM) as Array<[FontFamilyId, Partial<Record<FontStyleId, DocumentFont>>]>).flatMap(
    ([family, styles]) =>
      (Object.entries(styles) as Array<[FontStyleId, DocumentFont]>).map(([style, enumValue]) => [
        enumValue,
        { family, style },
      ]),
  ),
);

export function fontToEnum(family: FontFamilyId, style: FontStyleId): DocumentFont {
  const value = FONT_TO_ENUM[family][style];
  // Repli defensif : un style italique demande sur "Chasse fixe" (absent du
  // contrat) retombe sur Normal plutot que de produire une valeur invalide —
  // ne devrait jamais arriver si le menu Style est filtre par `FONT_STYLES_BY_FAMILY`.
  return value ?? FONT_TO_ENUM[family].normal ?? 'helvetica';
}

export function fontFromEnum(font: DocumentFont): Readonly<{ family: FontFamilyId; style: FontStyleId }> {
  return ENUM_TO_FONT.get(font) ?? { family: 'sans', style: 'normal' };
}
