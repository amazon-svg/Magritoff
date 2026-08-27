import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ExternalServiceRequestCompletion,
  ExternalServiceRequestRegistry,
  ExternalServiceRequestStart,
} from '../../modules/external-services/application/external-service-request-registry.ts';
import type { Database, Json } from '../../types/database.types.ts';

const MAX_PAYLOAD_BYTES = 500_000;

export class SupabaseExternalServiceRequestRegistry implements ExternalServiceRequestRegistry {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async start(request: ExternalServiceRequestStart): Promise<void> {
    const { error } = await this.client.from('external_service_requests').insert({
      id: request.id,
      correlation_id: request.correlationId,
      tenant_id: request.tenantId,
      user_id: request.userId,
      provider: request.provider,
      operation: request.operation,
      method: request.method,
      url: request.url,
      state: 'pending',
      request_payload: boundedJson(request.requestPayload),
      request_size_bytes: request.requestSizeBytes,
      started_at: request.startedAt,
      metadata: boundedJson(request.metadata ?? {}),
    });
    if (error) throw new Error(`external_request_registry.start: ${error.message}`);
  }

  async complete(request: ExternalServiceRequestCompletion): Promise<void> {
    const { error } = await this.client
      .from('external_service_requests')
      .update({
        state: request.state,
        http_status: request.httpStatus ?? null,
        response_payload: request.responsePayload === undefined
          ? null
          : boundedJson(request.responsePayload),
        response_size_bytes: request.responseSizeBytes ?? null,
        response_content_type: request.responseContentType ?? null,
        duration_ms: request.durationMs,
        input_tokens: request.inputTokens ?? null,
        output_tokens: request.outputTokens ?? null,
        error_code: request.errorCode ?? null,
        error_message: request.errorMessage?.slice(0, 2_000) ?? null,
        completed_at: request.completedAt,
      })
      .eq('id', request.id);
    if (error) throw new Error(`external_request_registry.complete: ${error.message}`);
  }
}

function boundedJson(value: unknown): Json {
  const normalized = JSON.parse(JSON.stringify(value ?? null)) as Json;
  const serialized = JSON.stringify(normalized);
  if (new TextEncoder().encode(serialized).byteLength <= MAX_PAYLOAD_BYTES) return normalized;
  return {
    _truncated: true,
    original_size_bytes: new TextEncoder().encode(serialized).byteLength,
    preview: serialized.slice(0, 20_000),
  };
}
