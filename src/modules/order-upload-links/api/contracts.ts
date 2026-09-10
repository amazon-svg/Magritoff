/**
 * Contrats Zod du module Liens de depot publics (story E10.20a).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schemas `OrderUploadLink`, `OrderUploadLinkCreated`,
 * `CreateOrderUploadLinkCommand`, `OrderUploadLinkContext`). Le YAML fait
 * foi ; docs/api/CONVENTIONS.md §8.21 en donne le detail arbitre.
 *
 * PERIMETRE DE CE FICHIER : les QUATRE operations de E10.20a (creation,
 * liste, revocation cote atelier ; contexte cote client). `Order
 * UploadLinkDeposit`/`ConfirmOrderUploadLinkFileCommand`/
 * `OrderFileUploadTicketDto` (le billet, deja publie par order-files) ne sont
 * PAS repris ici : `issueOrderUploadLinkFileUrl`/`confirmOrderUploadLinkFile`
 * sont le perimetre explicite d E10.20b (docs/api/CONVENTIONS.md §8.21 §5,
 * ligne E10.20a — "AUCUN DEPOT POSSIBLE").
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

export type OrderUploadLinkDto = z.infer<typeof orderUploadLinkSchema>;
export type OrderUploadLinkCreatedDto = z.infer<typeof orderUploadLinkCreatedSchema>;
export type CreateOrderUploadLinkCommand = z.infer<typeof createOrderUploadLinkCommandSchema>;
export type OrderUploadLinkContextDto = z.infer<typeof orderUploadLinkContextSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts).
// ---------------------------------------------------------------------------
import type {
  CreateOrderUploadLinkCommand as CreateOrderUploadLinkCommandContract,
  OrderUploadLink as OrderUploadLinkContract,
  OrderUploadLinkContext as OrderUploadLinkContextContract,
  OrderUploadLinkCreated as OrderUploadLinkCreatedContract,
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
});
