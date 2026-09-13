/**
 * Contrats Zod du module Exports de commandes (story E10.18c, lot final de
 * E10.18 : « la ressource, la file, le chemin de lecture et le CSV »).
 *
 * Miroir d execution de openapi/magrit-core.v1.yaml (`OrderExportFormat`,
 * `OrderExportGranularity`, `OrderExportStatus`, `OrderExportFilters`,
 * `RequestOrderExportCommand`, `OrderExport`). Contrat ecrit par l architecte
 * (commit bc4b8333), NON modifie ici.
 *
 * ── Aucune validation de calendrier ici (docs/api/CONVENTIONS.md §8.24
 * point 5 regle 7) ─────────────────────────────────────────────────────────
 * `created_from`/`created_to` sont verifies en FORME seulement
 * (`dateOnlySchema`, `YYYY-MM-DD`). Le refus d une date INEXISTANTE dans le
 * calendrier (`2026-06-31`) vit dans `civilDateToUtc()`
 * (`src/kernel/clock/timezone.ts`), appelee par la ROUTE avant que ce
 * contrat ne soit meme concerne — reecrire cette validation ici creerait une
 * seconde verite sur ce qu est une date valide.
 */
import { z } from 'zod';
import { problemCodeSchema, timestampSchema, uuidSchema } from '../../_shared/api/index.ts';
import { dateOnlySchema } from '../../commercial-quotes/api/contracts.ts';
import { commercialOrderStatusSchema } from '../../commercial-orders/api/contracts.ts';

export const orderExportFormatSchema = z.enum(['xlsx', 'csv']);
export const orderExportGranularitySchema = z.enum(['order', 'line']);
export const orderExportStatusSchema = z.enum(['pending', 'running', 'ready', 'failed', 'expired']);

/**
 * `OrderExportFilters` : chaque champ est le JUMEAU EXACT d un parametre de
 * requete de `listCommercialOrders` — meme nom, meme type. `{}` est valide
 * (« tout l historique de l espace »).
 */
export const orderExportFiltersSchema = z
  .object({
    customer_id: uuidSchema.nullable().optional(),
    quote_id: uuidSchema.nullable().optional(),
    status: commercialOrderStatusSchema.nullable().optional(),
    current_production_step_id: uuidSchema.nullable().optional(),
    created_from: dateOnlySchema.nullable().optional(),
    created_to: dateOnlySchema.nullable().optional(),
  })
  .strict();

export const requestOrderExportCommandSchema = z
  .object({
    format: orderExportFormatSchema,
    granularity: orderExportGranularitySchema,
    filters: orderExportFiltersSchema.optional(),
  })
  .strict();

const orderExportContentTypeSchema = z.enum([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);

/**
 * `OrderExport` : ressource de TACHE, jamais un transport de donnees — aucune
 * commande, aucun montant, aucun nom de client ne transite ici (contrat).
 */
export const orderExportSchema = z
  .object({
    id: uuidSchema,
    status: orderExportStatusSchema,
    format: orderExportFormatSchema,
    granularity: orderExportGranularitySchema,
    filters: orderExportFiltersSchema,
    layout_version: z.number().int().min(1),
    requested_by: uuidSchema.nullable(),
    requested_by_label: z.string().min(1).max(320).nullable(),
    requested_at: timestampSchema,
    started_at: timestampSchema.nullable(),
    completed_at: timestampSchema.nullable(),
    row_count: z.number().int().min(0).nullable(),
    file_name: z.string().min(1).max(255).nullable(),
    byte_size: z.number().int().min(1).nullable(),
    sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    content_type: orderExportContentTypeSchema.nullable(),
    download_url: z.string().url().nullable(),
    download_url_expires_at: timestampSchema.nullable(),
    expires_at: timestampSchema.nullable(),
    attempts: z.number().int().min(0),
    error_code: problemCodeSchema.nullable(),
    error_detail: z.string().nullable(),
  })
  .strict();

export const orderExportsListSchema = z.array(orderExportSchema);

export type OrderExportFormat = z.infer<typeof orderExportFormatSchema>;
export type OrderExportGranularity = z.infer<typeof orderExportGranularitySchema>;
export type OrderExportStatus = z.infer<typeof orderExportStatusSchema>;
export type OrderExportFiltersDto = z.infer<typeof orderExportFiltersSchema>;
export type RequestOrderExportCommand = z.infer<typeof requestOrderExportCommandSchema>;
export type OrderExportDto = z.infer<typeof orderExportSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts).
// ---------------------------------------------------------------------------
import type {
  OrderExport as OrderExportContract,
  OrderExportFilters as OrderExportFiltersContract,
  OrderExportFormat as OrderExportFormatContract,
  OrderExportGranularity as OrderExportGranularityContract,
  OrderExportStatus as OrderExportStatusContract,
  RequestOrderExportCommand as RequestOrderExportCommandContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const ORDER_EXPORTS_CONTRACT_ALIGNMENT = Object.freeze({
  format: true as AssertAssignable<OrderExportFormat, OrderExportFormatContract>,
  granularity: true as AssertAssignable<OrderExportGranularity, OrderExportGranularityContract>,
  status: true as AssertAssignable<OrderExportStatus, OrderExportStatusContract>,
  filters: true as AssertAssignable<OrderExportFiltersDto, OrderExportFiltersContract>,
  command: true as AssertAssignable<RequestOrderExportCommand, RequestOrderExportCommandContract>,
  resource: true as AssertAssignable<OrderExportDto, OrderExportContract>,
});
