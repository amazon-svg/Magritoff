import { z } from 'zod';
import { timestampSchema, uuidSchema } from '../../_shared/api/index.ts';
import {
  commercialFileKindSchema,
  commercialFileVisibilitySchema,
} from '../../projects/api/contracts.ts';

export const commercialLineTypeSchema = z.enum(['project_item', 'quote_line', 'order_line']);

export const commercialLineFileSchema = z.object({
  id: uuidSchema,
  kind: commercialFileKindSchema,
  visibility: commercialFileVisibilitySchema,
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1).max(255),
  byte_size: z.number().int().positive().max(15_000_000),
  created_at: timestampSchema,
}).strict();

export const commercialLineFilesListSchema = z.array(commercialLineFileSchema);

export const commercialLineFileDetailSchema = commercialLineFileSchema.extend({
  preview_url: z.string().url(),
  download_url: z.string().url(),
  url_expires_at: timestampSchema,
}).strict();

export const uploadCommercialLineFileCommandSchema = z.object({
  kind: commercialFileKindSchema,
  visibility: commercialFileVisibilitySchema.optional().default('internal'),
  filename: z.string().trim().min(1).max(255),
  content_type: z.enum([
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/postscript',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/svg+xml',
  ]),
  data_base64: z.string().min(1).max(20_000_000),
}).strict();

export type CommercialLineType = z.infer<typeof commercialLineTypeSchema>;
export type CommercialLineFileDto = z.infer<typeof commercialLineFileSchema>;
export type CommercialLineFileDetailDto = z.infer<typeof commercialLineFileDetailSchema>;
export type UploadCommercialLineFileCommand = z.infer<typeof uploadCommercialLineFileCommandSchema>;
