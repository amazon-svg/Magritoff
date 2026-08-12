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
