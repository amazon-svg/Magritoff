/**
 * Contrats Zod du module Gabarits PDF de documents (stories E10.10b-4a et
 * E10.10b-4b).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schemas `DocumentPdfTemplate`, `DocumentPdfTemplateDetail`,
 * `DocumentPdfTemplateUploadTicket`, `DocumentPdfTemplateCreated`,
 * `CreateDocumentPdfTemplateCommand`, `UpdateDocumentPdfTemplateCommand`,
 * `ConfirmDocumentPdfTemplateUploadCommand`, et depuis 4b :
 * `DocumentFieldId`, `DocumentLineFieldId`, `DocumentTextAlign`,
 * `DocumentFont`, `DocumentColor`, `DocumentFieldPlacement`,
 * `DocumentLinesColumn`, `DocumentLinesBlock`, `DocumentPdfTemplateFieldMap`,
 * `ReplaceDocumentPdfTemplateFieldsCommand`). Le YAML fait foi ;
 * docs/api/CONVENTIONS.md §8.18 en donne le detail arbitre.
 *
 * La VALIDATION SEMANTIQUE de la carte de champs (page existante, coordonnee
 * dans les bornes de la page, alignement centre/droit exigeant une largeur,
 * `rows_per_page` compatible avec la hauteur de page) n est PAS ici : ces
 * schemas Zod ne valident que la FORME. La semantique vit dans
 * `../application/document-field-map-validator.ts` (fonction pure, testee
 * unitairement), pour produire des messages d erreur par champ
 * (`Problem.errors`) — un `.refine()` Zod ne le permettrait pas aussi
 * finement, et confondrait 400 (forme) et 422 (semantique metier).
 */
import { z } from 'zod';
import { timestampSchema, uuidSchema } from '../../_shared/api/index.ts';

export const documentTypeSchema = z.enum(['quote']);

export const documentPdfTemplateStatusSchema = z.enum(['awaiting_upload', 'ready']);

/** Coordonnee/dimension en points PDF (1/72 pouce), arrondie a 2 decimales par le serveur. */
export const documentCoordinateSchema = z.number().min(0).max(20000);

export const documentPdfTemplatePageSchema = z
  .object({
    index: z.number().int().min(0).max(9),
    width_pt: documentCoordinateSchema,
    height_pt: documentCoordinateSchema,
  })
  .strict();

export const documentPdfTemplateSchema = z
  .object({
    id: uuidSchema,
    document_type: documentTypeSchema,
    name: z.string().min(1).max(120),
    status: documentPdfTemplateStatusSchema,
    is_default: z.boolean(),
    is_active: z.boolean(),
    page_count: z.number().int().min(1).max(10).nullable(),
    byte_size: z.number().int().min(1).nullable(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
  })
  .strict();

export const documentPdfTemplateDetailSchema = z
  .object({
    id: uuidSchema,
    document_type: documentTypeSchema,
    name: z.string().min(1).max(120),
    status: documentPdfTemplateStatusSchema,
    is_default: z.boolean(),
    is_active: z.boolean(),
    page_count: z.number().int().min(1).max(10).nullable(),
    byte_size: z.number().int().min(1).nullable(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
    pages: z.array(documentPdfTemplatePageSchema).max(10),
    sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    has_field_map: z.boolean(),
    background_url: z.string().url().nullable(),
    background_url_expires_at: timestampSchema.nullable(),
  })
  .strict();

export const documentPdfTemplateUploadTicketSchema = z
  .object({
    url: z.string().url(),
    token: z.string().min(1),
    path: z.string().min(1),
    content_type: z.literal('application/pdf'),
    max_byte_size: z.number().int().min(1),
    expires_at: timestampSchema,
  })
  .strict();

export const documentPdfTemplateCreatedSchema = z
  .object({
    template: documentPdfTemplateDetailSchema,
    upload: documentPdfTemplateUploadTicketSchema,
  })
  .strict();

export const documentPdfTemplatesListSchema = z.array(documentPdfTemplateSchema);

export const deleteDocumentPdfTemplateResultSchema = z.object({ deleted: z.literal(true) }).strict();

/** Creation (POST /document-pdf-templates). Ne porte NI fichier, NI coordonnee. */
export const createDocumentPdfTemplateCommandSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    document_type: documentTypeSchema.optional(),
    is_default: z.boolean().optional().default(false),
  })
  .strict();

/** Modification PARTIELLE (PATCH). Au moins un champ, ne touche jamais au fichier ni a la carte. */
export const updateDocumentPdfTemplateCommandSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    is_default: z.boolean().optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Au moins un champ est requis.',
  });

/** Confirmation d un depot (POST .../uploads). Le corps ne porte pas le fichier. */
export const confirmDocumentPdfTemplateUploadCommandSchema = z
  .object({
    reset_fields: z.boolean().optional().default(false),
  })
  .strict();

// ---------------------------------------------------------------------------
// E10.10b-4b — editeur de coordonnees. Catalogue de champs et carte de
// correspondance (`openapi/magrit-core.v1.yaml`, §8.18 §3).
// ---------------------------------------------------------------------------

/** Alignement du texte par rapport a l ancre. `right`/`center` exigent une largeur (validation SEMANTIQUE, pas ici). */
export const documentTextAlignSchema = z.enum(['left', 'center', 'right']);

/**
 * Role typographique, PAS un fichier de police (contrat : "une carte
 * enregistree aujourd hui reste valide quelle que soit l issue" du choix de
 * rendu, tenu par le moteur de generation E10.10b-4c).
 */
export const documentFontSchema = z.enum([
  'helvetica',
  'helvetica-bold',
  'helvetica-oblique',
  'times-roman',
  'times-bold',
  'times-italic',
  'courier',
  'courier-bold',
]);

export const documentColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

/**
 * Donnee du devis positionnable UNE fois sur le fond. Quatre familles, trois
 * regles de dessin (contrat) : `quote.`/`customer.` une fois sur leur page,
 * `totals.` sur la DERNIERE page rendue, `page.` sur TOUTES les pages.
 */
export const documentFieldIdSchema = z.enum([
  'quote.number',
  'quote.issued_at',
  'quote.valid_until',
  'quote.customer_reference',
  'customer.company_name',
  'customer.contact_name',
  'customer.billing_address_block',
  'customer.billing_line1',
  'customer.billing_line2',
  'customer.billing_postal_code',
  'customer.billing_city',
  'customer.billing_country',
  'customer.email',
  'customer.phone',
  'customer.siret',
  'customer.vat_number',
  'totals.lines_subtotal',
  'totals.global_discount',
  'totals.net_total',
  'totals.vat_rate',
  'totals.vat_amount',
  'totals.total_incl_tax',
  'page.number',
  'page.count',
  'page.number_of_count',
]);

/** Donnee de LIGNE de devis, positionnable en colonne du bloc de lignes (`line.*`, 7 valeurs). */
export const documentLineFieldIdSchema = z.enum([
  'line.position',
  'line.label',
  'line.product_config_summary',
  'line.quantity',
  'line.price_before_discount',
  'line.discount_rate',
  'line.price',
]);

/** Position d une donnee sur le fond : « le total va ici » (unite de travail de l editeur). */
export const documentFieldPlacementSchema = z
  .object({
    field: documentFieldIdSchema,
    page_index: z.number().int().min(0).max(9),
    x: documentCoordinateSchema,
    y: documentCoordinateSchema,
    width: documentCoordinateSchema.nullable().optional(),
    max_lines: z.number().int().min(1).max(10).optional().default(1),
    align: documentTextAlignSchema,
    font: documentFontSchema,
    font_size: z.number().min(4).max(72),
    color: documentColorSchema,
  })
  .strict();

/** Colonne du tableau des lignes. `width` OBLIGATOIRE, contrairement a un placement simple. */
export const documentLinesColumnSchema = z
  .object({
    field: documentLineFieldIdSchema,
    x: documentCoordinateSchema,
    width: documentCoordinateSchema,
    align: documentTextAlignSchema,
    font: documentFontSchema,
    font_size: z.number().min(4).max(72),
    color: documentColorSchema,
  })
  .strict();

/** Tableau des lignes du devis : seule zone dont la hauteur n est pas connue a l avance (debordement -> page de continuation). */
export const documentLinesBlockSchema = z
  .object({
    page_index: z.number().int().min(0).max(9),
    first_row_baseline_y: documentCoordinateSchema,
    row_height: z.number().min(4).max(200),
    rows_per_page: z.number().int().min(1).max(200),
    continuation_page_index: z.number().int().min(0).max(9).nullable().optional(),
    columns: z.array(documentLinesColumnSchema).min(1).max(7),
  })
  .strict();

/** Carte de correspondance COMPLETE d un gabarit (`GET .../fields`). */
export const documentPdfTemplateFieldMapSchema = z
  .object({
    template_id: uuidSchema,
    placements: z.array(documentFieldPlacementSchema).max(60),
    lines_block: documentLinesBlockSchema.nullable(),
  })
  .strict();

/** Carte a SUBSTITUER a la carte courante (`PUT .../fields`) : remplacement integral, pas une fusion. */
export const replaceDocumentPdfTemplateFieldsCommandSchema = z
  .object({
    placements: z.array(documentFieldPlacementSchema).max(60),
    lines_block: documentLinesBlockSchema.nullable(),
  })
  .strict();

export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentPdfTemplateStatus = z.infer<typeof documentPdfTemplateStatusSchema>;
export type DocumentPdfTemplatePageDto = z.infer<typeof documentPdfTemplatePageSchema>;
export type DocumentPdfTemplateDto = z.infer<typeof documentPdfTemplateSchema>;
export type DocumentPdfTemplateDetailDto = z.infer<typeof documentPdfTemplateDetailSchema>;
export type DocumentPdfTemplateUploadTicketDto = z.infer<typeof documentPdfTemplateUploadTicketSchema>;
export type DocumentPdfTemplateCreatedDto = z.infer<typeof documentPdfTemplateCreatedSchema>;
export type DeleteDocumentPdfTemplateResultDto = z.infer<typeof deleteDocumentPdfTemplateResultSchema>;
export type CreateDocumentPdfTemplateCommand = z.infer<typeof createDocumentPdfTemplateCommandSchema>;
export type UpdateDocumentPdfTemplateCommand = z.infer<typeof updateDocumentPdfTemplateCommandSchema>;
export type ConfirmDocumentPdfTemplateUploadCommand = z.infer<typeof confirmDocumentPdfTemplateUploadCommandSchema>;
export type DocumentTextAlign = z.infer<typeof documentTextAlignSchema>;
export type DocumentFont = z.infer<typeof documentFontSchema>;
export type DocumentColor = z.infer<typeof documentColorSchema>;
export type DocumentFieldId = z.infer<typeof documentFieldIdSchema>;
export type DocumentLineFieldId = z.infer<typeof documentLineFieldIdSchema>;
export type DocumentFieldPlacementDto = z.infer<typeof documentFieldPlacementSchema>;
export type DocumentLinesColumnDto = z.infer<typeof documentLinesColumnSchema>;
export type DocumentLinesBlockDto = z.infer<typeof documentLinesBlockSchema>;
export type DocumentPdfTemplateFieldMapDto = z.infer<typeof documentPdfTemplateFieldMapSchema>;
export type ReplaceDocumentPdfTemplateFieldsCommand = z.infer<typeof replaceDocumentPdfTemplateFieldsCommandSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts).
// ---------------------------------------------------------------------------
import type {
  ConfirmDocumentPdfTemplateUploadCommand as ConfirmDocumentPdfTemplateUploadCommandContract,
  CreateDocumentPdfTemplateCommand as CreateDocumentPdfTemplateCommandContract,
  DocumentColor as DocumentColorContract,
  DocumentFieldId as DocumentFieldIdContract,
  DocumentFieldPlacement as DocumentFieldPlacementContract,
  DocumentFont as DocumentFontContract,
  DocumentLineFieldId as DocumentLineFieldIdContract,
  DocumentLinesBlock as DocumentLinesBlockContract,
  DocumentLinesColumn as DocumentLinesColumnContract,
  DocumentPdfTemplate as DocumentPdfTemplateContract,
  DocumentPdfTemplateDetail as DocumentPdfTemplateDetailContract,
  DocumentPdfTemplateCreated as DocumentPdfTemplateCreatedContract,
  DocumentPdfTemplateFieldMap as DocumentPdfTemplateFieldMapContract,
  DocumentPdfTemplateUploadTicket as DocumentPdfTemplateUploadTicketContract,
  DocumentTextAlign as DocumentTextAlignContract,
  DocumentType as DocumentTypeContract,
  ReplaceDocumentPdfTemplateFieldsCommand as ReplaceDocumentPdfTemplateFieldsCommandContract,
  UpdateDocumentPdfTemplateCommand as UpdateDocumentPdfTemplateCommandContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const DOCUMENT_TEMPLATES_CONTRACT_ALIGNMENT = Object.freeze({
  documentType: true as AssertAssignable<DocumentType, DocumentTypeContract>,
  template: true as AssertAssignable<DocumentPdfTemplateDto, DocumentPdfTemplateContract>,
  templateDetail: true as AssertAssignable<DocumentPdfTemplateDetailDto, DocumentPdfTemplateDetailContract>,
  templateCreated: true as AssertAssignable<DocumentPdfTemplateCreatedDto, DocumentPdfTemplateCreatedContract>,
  uploadTicket: true as AssertAssignable<
    DocumentPdfTemplateUploadTicketDto,
    DocumentPdfTemplateUploadTicketContract
  >,
  createCommand: true as AssertAssignable<
    CreateDocumentPdfTemplateCommand,
    CreateDocumentPdfTemplateCommandContract
  >,
  updateCommand: true as AssertAssignable<
    UpdateDocumentPdfTemplateCommand,
    UpdateDocumentPdfTemplateCommandContract
  >,
  confirmUploadCommand: true as AssertAssignable<
    ConfirmDocumentPdfTemplateUploadCommand,
    ConfirmDocumentPdfTemplateUploadCommandContract
  >,
  // E10.10b-4b
  textAlign: true as AssertAssignable<DocumentTextAlign, DocumentTextAlignContract>,
  font: true as AssertAssignable<DocumentFont, DocumentFontContract>,
  color: true as AssertAssignable<DocumentColor, DocumentColorContract>,
  fieldId: true as AssertAssignable<DocumentFieldId, DocumentFieldIdContract>,
  lineFieldId: true as AssertAssignable<DocumentLineFieldId, DocumentLineFieldIdContract>,
  fieldPlacement: true as AssertAssignable<DocumentFieldPlacementDto, DocumentFieldPlacementContract>,
  linesColumn: true as AssertAssignable<DocumentLinesColumnDto, DocumentLinesColumnContract>,
  linesBlock: true as AssertAssignable<DocumentLinesBlockDto, DocumentLinesBlockContract>,
  fieldMap: true as AssertAssignable<DocumentPdfTemplateFieldMapDto, DocumentPdfTemplateFieldMapContract>,
  replaceFieldsCommand: true as AssertAssignable<
    ReplaceDocumentPdfTemplateFieldsCommand,
    ReplaceDocumentPdfTemplateFieldsCommandContract
  >,
});
