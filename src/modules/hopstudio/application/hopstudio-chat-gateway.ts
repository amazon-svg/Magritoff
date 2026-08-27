import type { HopeStudioChatRequest, HopeStudioChatResult } from '../api/contracts.ts';

export type HopeStudioChatGatewayRequest = HopeStudioChatRequest & Readonly<{
  signal: AbortSignal;
  traceId?: string;
}>;

export type HopeStudioTraceEvent = Readonly<{
  traceId: string;
  stage: string;
  elapsedMs?: number;
  [key: string]: unknown;
}>;

export type HopeStudioTraceSink = (event: HopeStudioTraceEvent) => void;

export interface HopeStudioChatGateway {
  chat(request: HopeStudioChatGatewayRequest): Promise<HopeStudioChatResult>;
}

export class HopeStudioChatUnavailableError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'HopeStudioChatUnavailableError';
  }
}
