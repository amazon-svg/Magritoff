import { z } from 'zod';

export const API_V1_BASE_PATH = '/api/v1' as const;

export const apiProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  code: z.string(),
  detail: z.string().optional(),
  requestId: z.string(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});

export type ApiProblem = z.infer<typeof apiProblemSchema>;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  apiVersion: z.literal('v1'),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
