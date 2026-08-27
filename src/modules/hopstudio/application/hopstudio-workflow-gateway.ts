export type HopeStudioWorkflowRequest = Readonly<{
  tenantId: string;
  userId: string;
  traceId: string;
  body: string;
  signal: AbortSignal;
}>;

export interface HopeStudioWorkflowGateway {
  execute(request: HopeStudioWorkflowRequest): Promise<unknown>;
}

export class HopeStudioWorkflowUnavailableError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'HopeStudioWorkflowUnavailableError';
  }
}
