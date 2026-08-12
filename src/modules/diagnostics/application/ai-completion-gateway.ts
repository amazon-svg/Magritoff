export type AiCompletionMessage = Readonly<{
  role: 'user' | 'assistant';
  content: string;
}>;

export type AiCompletionRequest = Readonly<{
  system?: string;
  messages: readonly AiCompletionMessage[];
  maxTokens: number;
  temperature?: number;
}>;

export type AiCompletion = Readonly<{
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}>;

export class AiCompletionUnavailableError extends Error {
  constructor(public readonly code: 'not_configured' | 'provider_error' | 'invalid_response', message: string) {
    super(message);
    this.name = 'AiCompletionUnavailableError';
  }
}

export interface AiCompletionGateway {
  complete(request: AiCompletionRequest): Promise<AiCompletion>;
}
