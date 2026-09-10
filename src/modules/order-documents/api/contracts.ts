/**
 * Contrats Zod du module Document PDF de commande (story E10.19b).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schema `OrderDocument`, operations `getOrderDocument`/
 * `generateOrderDocument`). Le YAML fait foi ; docs/api/CONVENTIONS.md §8.20
 * en donne le detail arbitre.
 *
 * SCHEMA JUMEAU DE `quoteDocumentSchema` (module `quote-documents`), PAS
 * REUTILISE tel quel : `OrderDocument` porte `generated_by`/
 * `generated_by_label` (produire est le geste d une personne, contrat) —
 * deux champs absents de `QuoteDocument` (genere automatiquement a l envoi).
 * Fusionner les deux forcerait soit des champs optionnels perimes sur le
 * devis, soit un `allOf` — ecueil deja ecarte par le contrat lui-meme
 * ("un allOf combine a additionalProperties:false ferait rejeter le champ
 * propre par le membre ferme, meme ecueil que CommercialOrderDetail").
 */
import { z } from 'zod';
import { timestampSchema, uuidSchema } from '../../_shared/api/index.ts';

export const orderDocumentSchema = z
  .object({
    order_id: uuidSchema,
    template_id: uuidSchema,
    generated_at: timestampSchema,
    generated_by: uuidSchema.nullable(),
    generated_by_label: z.string().min(1).max(320).nullable(),
    byte_size: z.number().int().min(1),
    sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/),
    content_type: z.literal('application/pdf'),
    page_count: z.number().int().min(1),
    download_url: z.string().url(),
    download_url_expires_at: timestampSchema,
  })
  .strict();

export type OrderDocumentDto = z.infer<typeof orderDocumentSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts).
// ---------------------------------------------------------------------------
import type { OrderDocument as OrderDocumentContract } from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const ORDER_DOCUMENTS_CONTRACT_ALIGNMENT = Object.freeze({
  orderDocument: true as AssertAssignable<OrderDocumentDto, OrderDocumentContract>,
});
