import { z } from 'zod';

export const diagnosticCheckSchema = z.object({
  name: z.string().min(1).max(120),
  status: z.enum(['ok', 'error', 'skipped']),
  details: z.string().max(500).optional(),
});

export const aiProviderDiagnosticSchema = z.object({
  provider: z.string().min(1).max(80),
  configured: z.boolean(),
  reachable: z.boolean().nullable(),
  summary: z.string().min(1).max(500),
  responsePreview: z.string().max(500).optional(),
  checks: z.array(diagnosticCheckSchema).max(20),
  testedAt: z.iso.datetime(),
});

export type AiProviderDiagnostic = z.infer<typeof aiProviderDiagnosticSchema>;

export const clariprintDiagnosticSchema = z.object({
  service: z.literal('Clariprint'),
  configured: z.boolean(),
  reachable: z.boolean().nullable(),
  authenticated: z.boolean().nullable(),
  summary: z.string().min(1).max(500),
  httpStatus: z.number().int().min(100).max(599).optional(),
  checks: z.array(diagnosticCheckSchema).max(20),
  testedAt: z.iso.datetime(),
});

export type ClariprintDiagnostic = z.infer<typeof clariprintDiagnosticSchema>;

export const categoryEditorialCommandSchema = z.object({
  familyName: z.string().trim().min(1).max(160),
  subcategories: z.array(z.string().trim().min(1).max(160)).max(12),
  sampleProducts: z.array(z.string().trim().min(1).max(200)).max(8),
}).strict();

export const categoryEditorialSchema = z.object({
  title: z.string().trim().max(60).optional(),
  intro: z.string().trim().max(240).optional(),
  seo: z.string().trim().max(155).optional(),
}).strict();

export const categoryEditorialResultSchema = z.object({
  editorial: categoryEditorialSchema,
  generated: z.boolean(),
});

export type CategoryEditorialCommand = z.infer<typeof categoryEditorialCommandSchema>;
export type CategoryEditorialResult = z.infer<typeof categoryEditorialResultSchema>;

export const assistantChatCommandSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(20_000),
  }).strict()).min(1).max(25),
  tenantId: z.string().min(1).max(200).nullable().optional(),
  shopSlug: z.string().trim().min(1).max(160).optional(),
  mode: z.enum(['open', 'strict']).optional(),
  sessionRef: z.string().trim().min(1).max(500).nullable().optional(),
  sessionDataRef: z.string().trim().min(1).max(500).nullable().optional(),
}).strict().refine(
  (command) => !(command.tenantId && command.shopSlug),
  { message: 'Un seul contexte assistant est autorisé.', path: ['shopSlug'] },
);

export type AssistantChatCommand = z.infer<typeof assistantChatCommandSchema>;
