import { z } from 'zod';

const recordSchema = z.record(z.string(), z.unknown());

export const hopStudioChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(20_000),
}).strict();

export const hopStudioChatRequestSchema = z.object({
  messages: z.array(hopStudioChatMessageSchema).min(1).max(25),
  // Identité Magrit stable, résolue côté serveur. HopeStudio s'en sert pour
  // partitionner les sessions et retrouver l'historique du même utilisateur.
  tenantId: z.string().min(1).max(200),
  userId: z.string().min(1).max(200),
  sessionRef: z.string().trim().min(1).max(500).nullable().optional(),
  sessionDataRef: z.string().trim().min(1).max(500).nullable().optional(),
}).strict();

export const hopStudioProductConfigSchema = z.object({
  clariprint: recordSchema,
  display: recordSchema,
  hopStudio: z.object({
    cardRef: z.string().nullable(),
    dataRef: z.string().nullable(),
  }).strict(),
}).strict();

export const hopStudioChatResultSchema = z.object({
  success: z.literal(true),
  configs: z.array(hopStudioProductConfigSchema),
  teachingNote: z.string().nullable(),
  demoMode: z.literal(false),
  provider: z.literal('hopstudio'),
  sessionRef: z.string().nullable(),
  sessionDataRef: z.string().nullable(),
}).strict();

/**
 * Contrat volontairement permissif de l'enveloppe HopeStudio. Les champs
 * techniques DBK/UID restent confinés à l'adaptateur et ne deviennent pas le
 * vocabulaire public de Magrit.
 */
export const hopStudioRawEnvelopeSchema = z.object({
  response: recordSchema,
}).passthrough();

/**
 * Enveloppe du callback customApiFetch. Elle reprend le WorkflowController
 * historique tout en interdisant au navigateur de choisir l'URL sortante.
 */
export const hopeStudioWorkflowCommandSchema = z.object({
  hook: z.string().trim().min(1).max(200),
  event: z.string().trim().min(1).max(200),
  provider: z.string().trim().min(1).max(200),
  context: z.object({
    tenantId: z.string().trim().min(1).max(200),
    userId: z.string().trim().min(1).max(200),
    method: z.string().trim().max(20).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().max(2_000_000),
  }).passthrough(),
}).strict();

export type HopeStudioChatMessage = z.infer<typeof hopStudioChatMessageSchema>;
export type HopeStudioChatRequest = z.infer<typeof hopStudioChatRequestSchema>;
export type HopeStudioProductConfig = z.infer<typeof hopStudioProductConfigSchema>;
export type HopeStudioChatResult = z.infer<typeof hopStudioChatResultSchema>;
export type HopeStudioWorkflowCommand = z.infer<typeof hopeStudioWorkflowCommandSchema>;
