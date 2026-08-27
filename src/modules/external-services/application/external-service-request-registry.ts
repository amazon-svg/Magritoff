export type ExternalServiceRequestState =
  | 'pending'
  | 'succeeded'
  | 'http_error'
  | 'network_error'
  | 'timeout'
  | 'invalid_response';

export type ExternalServiceRequestStart = Readonly<{
  id: string;
  correlationId: string;
  tenantId: string | null;
  userId: string | null;
  provider: string;
  operation: string;
  method: string;
  url: string;
  requestPayload: unknown;
  requestSizeBytes: number;
  startedAt: string;
  metadata?: Record<string, unknown>;
}>;

export type ExternalServiceRequestCompletion = Readonly<{
  id: string;
  state: Exclude<ExternalServiceRequestState, 'pending'>;
  httpStatus?: number | null;
  responsePayload?: unknown;
  responseSizeBytes?: number | null;
  responseContentType?: string | null;
  durationMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  completedAt: string;
}>;

export interface ExternalServiceRequestRegistry {
  start(request: ExternalServiceRequestStart): Promise<void>;
  complete(request: ExternalServiceRequestCompletion): Promise<void>;
}

export const noopExternalServiceRequestRegistry: ExternalServiceRequestRegistry = Object.freeze({
  async start() {},
  async complete() {},
});
