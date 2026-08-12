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
