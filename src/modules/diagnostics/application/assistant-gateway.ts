export type AssistantStreamPayload = Record<string, unknown> & {
  billingError?: boolean;
  demoMode?: boolean;
};

export type AssistantStreamRequest = Readonly<{
  accessToken: string;
  streaming: boolean;
  body: unknown;
  signal: AbortSignal;
  onDelta?: (chunk: string) => void;
}>;

export type AssistantStreamErrorKind = 'billing' | 'network' | 'aborted' | 'protocol';

export class AssistantStreamError extends Error {
  constructor(
    public readonly kind: AssistantStreamErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AssistantStreamError';
  }
}

export interface AssistantGateway {
  send(request: AssistantStreamRequest): Promise<AssistantStreamPayload>;
}
