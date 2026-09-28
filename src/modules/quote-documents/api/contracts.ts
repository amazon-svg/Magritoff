/**
 * Contrats Zod du module Document PDF de devis (story E10.10b-4c).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schema `QuoteDocument`, operations `getQuoteDocument`/
 * `getStorefrontQuoteDocument`). Le YAML fait foi ; docs/api/CONVENTIONS.md
 * §8.18 en donne le detail arbitre.
 *
 * NE PORTE AUCUN schema de COMMANDE. Le document definitif reste une piece
 * produite une seule fois par `sendQuote`; `QuoteDocumentPreview` represente
 * uniquement un rendu temporaire et filigrane d un brouillon.
 */
import { z } from 'zod';
import { timestampSchema, uuidSchema } from '../../_shared/api/index.ts';

export const quoteDocumentSchema = z
  .object({
    quote_id: uuidSchema,
    template_id: uuidSchema,
    generated_at: timestampSchema,
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

export type QuoteDocumentDto = z.infer<typeof quoteDocumentSchema>;

export const quoteDocumentPreviewSchema = z
  .object({
    quote_id: uuidSchema,
    template_id: uuidSchema,
    generated_at: timestampSchema,
    byte_size: z.number().int().min(1),
    content_type: z.literal('application/pdf'),
    page_count: z.number().int().min(1),
    watermark: z.literal('DRAFT'),
    download_url: z.string().url(),
    download_url_expires_at: timestampSchema,
  })
  .strict();

export type QuoteDocumentPreviewDto = z.infer<typeof quoteDocumentPreviewSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts).
// ---------------------------------------------------------------------------
import type {
  QuoteDocument as QuoteDocumentContract,
  QuoteDocumentPreview as QuoteDocumentPreviewContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const QUOTE_DOCUMENTS_CONTRACT_ALIGNMENT = Object.freeze({
  quoteDocument: true as AssertAssignable<QuoteDocumentDto, QuoteDocumentContract>,
  quoteDocumentPreview: true as AssertAssignable<QuoteDocumentPreviewDto, QuoteDocumentPreviewContract>,
});
