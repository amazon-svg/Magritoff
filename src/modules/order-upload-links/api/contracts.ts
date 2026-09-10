/**
 * Contrats Zod du module Liens de depot publics (stories E10.20a/E10.20b).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schemas `OrderUploadLink`, `OrderUploadLinkCreated`,
 * `CreateOrderUploadLinkCommand`, `OrderUploadLinkContext`,
 * `ConfirmOrderUploadLinkFileCommand`, `OrderUploadLinkDeposit`). Le YAML
 * fait foi ; docs/api/CONVENTIONS.md §8.21 en donne le detail arbitre.
 *
 * PERIMETRE : les QUATRE operations d E10.20a (creation, liste, revocation
 * cote atelier ; contexte cote client) PLUS les deux operations de depot
 * d E10.20b (`issueOrderUploadLinkFileUrl`/`confirmOrderUploadLinkFile`).
 * `OrderFileUploadTicketDto` (le billet) N EST PAS reproduit ici : le
 * contrat dit "schema `OrderFileUploadTicket` REUTILISE tel quel" — reexporte
 * depuis `order-files/api/contracts.ts`, jamais duplique.
 */
import { z } from 'zod';
import { timestampSchema, uuidSchema } from '../../_shared/api/index.ts';

/** Trois echeances admises (contrat, arbitrage (B)) — jamais un entier libre. */
export const uploadLinkExpiresInDaysSchema = z
  .union([z.literal(7), z.literal(30), z.literal(90)])
  .optional()
  .default(30);

export const orderUploadLinkSchema = z
  .object({
    id: uuidSchema,
    order_id: uuidSchema,
    label: z.string().min(1).max(200).nullable(),
    expires_at: timestampSchema,
    max_files: z.number().int().min(1).max(30),
    deposited_count: z.number().int().min(0),
    use_count: z.number().int().min(0),
    first_used_at: timestampSchema.nullable(),
    last_used_at: timestampSchema.nullable(),
    created_at: timestampSchema,
    created_by: uuidSchema.nullable(),
    created_by_label: z.string().min(1).max(320).nullable(),
  })
  .strict();

export const orderUploadLinkCreatedSchema = orderUploadLinkSchema
  .extend({
    token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  })
  .strict();

export const orderUploadLinksListSchema = z.array(orderUploadLinkSchema);

/**
 * `CreateOrderUploadLinkCommand` — trois champs, tous facultatifs cote
 * REQUETE : un lien par defaut (30 jours, 10 fichiers, sans consigne) reste
 * emissible d un clic. `.default(...)` fait porter le defaut par la
 * VALIDATION elle-meme plutot que par chaque appelant, et rend le type de
 * SORTIE non-optionnel — alignement exact avec le contrat genere, qui
 * declare `expires_in_days`/`max_files` non-optionnels malgre leur defaut
 * (openapi-typescript restitue le champ comme toujours present apres
 * defaulting).
 */
export const createOrderUploadLinkCommandSchema = z
  .object({
    label: z.string().trim().min(1).max(200).nullable().optional(),
    expires_in_days: uploadLinkExpiresInDaysSchema,
    max_files: z.number().int().min(1).max(30).optional().default(10),
  })
  .strict();

export const orderUploadLinkContextSchema = z
  .object({
    printer_name: z.string().min(1).max(200),
    order_number: z.string().regex(/^CDE-[0-9]{4}-[0-9]{5}$/),
    label: z.string().min(1).max(200).nullable(),
    expires_at: timestampSchema,
    max_files: z.number().int().min(1).max(30),
    deposited_count: z.number().int().min(0),
    max_byte_size: z.number().int().min(1),
    accepted_content_types: z.array(z.string().min(1)).min(1),
  })
  .strict();

/**
 * `ConfirmOrderUploadLinkFileCommand` (E10.20b) — DEUX champs, deliberement
 * moins que `ConfirmOrderFileUploadCommand` : le porteur du lien ne choisit
 * ni la visibilite (toujours `internal`) ni la ligne de commande (il ne les
 * connait pas).
 *
 * qa-review round 1 (M2) — `filename` REFUSE les caracteres de controle
 * (`\x00`-`\x1F`, `\x7F`) : ce texte est fourni par un tiers NON
 * AUTHENTIFIE, stocke tel quel et rendu a l atelier (jamais interprete, mais
 * il alimente `Content-Disposition` via `createSignedUrl` en aval,
 * `getOrderFile`/E10.17a). Le chemin de stockage reste RECALCULE (jamais
 * ce nom), donc aucune traversee de chemin n est possible — ce refus porte
 * sur l HYGIENE de la valeur affichee/servie, pas sur une faille de chemin.
 * MEME check repris cote SQL (`commercial_order_files_filename_check`,
 * migration `20260910000400`) : deux barrieres, jamais une seule.
 */
export const confirmOrderUploadLinkFileCommandSchema = z
  .object({
    file_id: uuidSchema,
    filename: z
      .string()
      .trim()
      .min(1)
      .max(255)
      // eslint-disable-next-line no-control-regex -- refus DELIBERE des caracteres de controle (qa-review M2)
      .regex(/^[^\x00-\x1F\x7F]+$/, 'Le nom de fichier ne doit pas contenir de caracteres de controle.'),
  })
  .strict();

/**
 * `OrderUploadLinkDeposit` (E10.20b) — RECU MINIMAL rendu au porteur du lien,
 * DELIBEREMENT distinct d `OrderFile` : ni visibilite, ni deposant, ni
 * rattachement de ligne, ni URL (arbitrage (E), depot seul).
 */
export const orderUploadLinkDepositSchema = z
  .object({
    file_id: uuidSchema,
    filename: z.string().min(1).max(255),
    content_type: z.string().min(1).max(255),
    byte_size: z.number().int().min(1),
    deposited_at: timestampSchema,
    deposited_count: z.number().int().min(1),
    max_files: z.number().int().min(1).max(30),
  })
  .strict();

export type OrderUploadLinkDto = z.infer<typeof orderUploadLinkSchema>;
export type OrderUploadLinkCreatedDto = z.infer<typeof orderUploadLinkCreatedSchema>;
export type CreateOrderUploadLinkCommand = z.infer<typeof createOrderUploadLinkCommandSchema>;
export type OrderUploadLinkContextDto = z.infer<typeof orderUploadLinkContextSchema>;
export type ConfirmOrderUploadLinkFileCommand = z.infer<typeof confirmOrderUploadLinkFileCommandSchema>;
export type OrderUploadLinkDepositDto = z.infer<typeof orderUploadLinkDepositSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts).
// ---------------------------------------------------------------------------
import type {
  ConfirmOrderUploadLinkFileCommand as ConfirmOrderUploadLinkFileCommandContract,
  CreateOrderUploadLinkCommand as CreateOrderUploadLinkCommandContract,
  OrderUploadLink as OrderUploadLinkContract,
  OrderUploadLinkContext as OrderUploadLinkContextContract,
  OrderUploadLinkCreated as OrderUploadLinkCreatedContract,
  OrderUploadLinkDeposit as OrderUploadLinkDepositContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const ORDER_UPLOAD_LINKS_CONTRACT_ALIGNMENT = Object.freeze({
  link: true as AssertAssignable<OrderUploadLinkDto, OrderUploadLinkContract>,
  linkCreated: true as AssertAssignable<OrderUploadLinkCreatedDto, OrderUploadLinkCreatedContract>,
  createCommand: true as AssertAssignable<
    CreateOrderUploadLinkCommand,
    CreateOrderUploadLinkCommandContract
  >,
  context: true as AssertAssignable<OrderUploadLinkContextDto, OrderUploadLinkContextContract>,
  confirmFileCommand: true as AssertAssignable<
    ConfirmOrderUploadLinkFileCommand,
    ConfirmOrderUploadLinkFileCommandContract
  >,
  deposit: true as AssertAssignable<OrderUploadLinkDepositDto, OrderUploadLinkDepositContract>,
});
