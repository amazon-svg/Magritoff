/**
 * Contrats Zod du module Fichiers de commande (story E10.17a).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schemas `OrderFileVisibility`, `OrderFile`, `OrderFileDetail`,
 * `OrderFileUploadTicket`, `ConfirmOrderFileUploadCommand`,
 * `UpdateOrderFileCommand`). Le YAML fait foi ; docs/api/CONVENTIONS.md
 * §8.19 en donne le detail arbitre.
 *
 * Mecanisme de depot REPRIS d E10.10b-4a (billet signe, confirmation en deux
 * temps) : la facade `/api/v1` ne sait lire que du JSON, le fichier ne la
 * traverse jamais (§8.19 §0 verification n°1).
 */
import { z } from 'zod';
import { timestampSchema, uuidSchema } from '../../_shared/api/index.ts';

export const orderFileVisibilitySchema = z.enum(['internal', 'customer']);

export const orderFileSchema = z
  .object({
    id: uuidSchema,
    order_id: uuidSchema,
    order_line_id: uuidSchema.nullable(),
    filename: z.string().min(1).max(255),
    content_type: z.string().min(1).max(255),
    byte_size: z.number().int().min(1),
    visibility: orderFileVisibilitySchema,
    deposited_at: timestampSchema,
    deposited_by: uuidSchema.nullable(),
    deposited_by_label: z.string().min(1).max(320).nullable(),
    updated_at: timestampSchema,
  })
  .strict();

export const orderFileDetailSchema = z
  .object({
    id: uuidSchema,
    order_id: uuidSchema,
    order_line_id: uuidSchema.nullable(),
    filename: z.string().min(1).max(255),
    content_type: z.string().min(1).max(255),
    byte_size: z.number().int().min(1),
    visibility: orderFileVisibilitySchema,
    deposited_at: timestampSchema,
    deposited_by: uuidSchema.nullable(),
    deposited_by_label: z.string().min(1).max(320).nullable(),
    updated_at: timestampSchema,
    download_url: z.string().url(),
    download_url_expires_at: timestampSchema,
  })
  .strict();

export const orderFileUploadTicketSchema = z
  .object({
    file_id: uuidSchema,
    url: z.string().url(),
    token: z.string().min(1),
    path: z.string().min(1),
    max_byte_size: z.number().int().min(1),
    accepted_content_types: z.array(z.string().min(1)).min(1),
    expires_at: timestampSchema,
  })
  .strict();

export const orderFilesListSchema = z.array(orderFileSchema);

/** Confirmation d un depot (POST .../files). Le corps ne porte pas le fichier. */
export const confirmOrderFileUploadCommandSchema = z
  .object({
    file_id: uuidSchema,
    filename: z.string().trim().min(1).max(255),
    order_line_id: uuidSchema.nullable().optional(),
    visibility: orderFileVisibilitySchema.optional(),
  })
  .strict();

/** Modification (PATCH). Un seul champ, jamais optionnel : c est le seul champ du corps. */
export const updateOrderFileCommandSchema = z
  .object({
    visibility: orderFileVisibilitySchema,
  })
  .strict();

export type OrderFileVisibility = z.infer<typeof orderFileVisibilitySchema>;
export type OrderFileDto = z.infer<typeof orderFileSchema>;
export type OrderFileDetailDto = z.infer<typeof orderFileDetailSchema>;
export type OrderFileUploadTicketDto = z.infer<typeof orderFileUploadTicketSchema>;
export type ConfirmOrderFileUploadCommand = z.infer<typeof confirmOrderFileUploadCommandSchema>;
export type UpdateOrderFileCommand = z.infer<typeof updateOrderFileCommandSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts).
// ---------------------------------------------------------------------------
import type {
  ConfirmOrderFileUploadCommand as ConfirmOrderFileUploadCommandContract,
  OrderFile as OrderFileContract,
  OrderFileDetail as OrderFileDetailContract,
  OrderFileUploadTicket as OrderFileUploadTicketContract,
  OrderFileVisibility as OrderFileVisibilityContract,
  UpdateOrderFileCommand as UpdateOrderFileCommandContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const ORDER_FILES_CONTRACT_ALIGNMENT = Object.freeze({
  visibility: true as AssertAssignable<OrderFileVisibility, OrderFileVisibilityContract>,
  file: true as AssertAssignable<OrderFileDto, OrderFileContract>,
  fileDetail: true as AssertAssignable<OrderFileDetailDto, OrderFileDetailContract>,
  uploadTicket: true as AssertAssignable<OrderFileUploadTicketDto, OrderFileUploadTicketContract>,
  confirmUploadCommand: true as AssertAssignable<
    ConfirmOrderFileUploadCommand,
    ConfirmOrderFileUploadCommandContract
  >,
  updateCommand: true as AssertAssignable<UpdateOrderFileCommand, UpdateOrderFileCommandContract>,
});
