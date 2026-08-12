import type { AiProviderConfiguration } from './configured-ai-diagnostics-gateway.ts';
import {
  AiCompletionUnavailableError,
  type AiCompletion,
  type AiCompletionGateway,
  type AiCompletionRequest,
} from '../../modules/diagnostics/application/ai-completion-gateway.ts';

const DEFAULT_MODELS = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4.1-mini',
  mistral: 'mistral-small-latest',
} as const;

export class ConfiguredAiCompletionGateway implements AiCompletionGateway {
  constructor(
    private readonly configuration: AiProviderConfiguration,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
  ) {}

  async complete(request: AiCompletionRequest): Promise<AiCompletion> {
    const apiKey = this.configuration.apiKey;
    if (!apiKey) throw new AiCompletionUnavailableError('not_configured', 'Clé du fournisseur IA absente.');
    const model = this.configuration.model?.trim() || DEFAULT_MODELS[this.configuration.provider];
    let response: Response;
    try {
      response = await this.fetchImplementation(...providerRequest(this.configuration.provider, apiKey, model, request));
    } catch (error) {
      throw new AiCompletionUnavailableError('provider_error', error instanceof Error ? error.message : 'Fournisseur IA inaccessible.');
    }
    const payload = await response.text();
    if (!response.ok) throw new AiCompletionUnavailableError('provider_error', providerError(payload, response.status));
    return parseCompletion(this.configuration.provider, model, payload);
  }
}

function providerRequest(provider: AiProviderConfiguration['provider'], apiKey: string, model: string, request: AiCompletionRequest): [RequestInfo | URL, RequestInit] {
  const common = { method: 'POST', signal: AbortSignal.timeout(20_000) };
  if (provider === 'anthropic') return ['https://api.anthropic.com/v1/messages', { ...common, headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: request.maxTokens, ...(request.system ? { system: request.system } : {}), messages: request.messages, ...(request.temperature === undefined ? {} : { temperature: request.temperature }) }) }];
  if (provider === 'openai') return ['https://api.openai.com/v1/responses', { ...common, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, instructions: request.system, input: request.messages.map((message) => ({ role: message.role, content: message.content })), max_output_tokens: request.maxTokens, ...(request.temperature === undefined ? {} : { temperature: request.temperature }) }) }];
  return ['https://api.mistral.ai/v1/chat/completions', { ...common, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: [...(request.system ? [{ role: 'system' as const, content: request.system }] : []), ...request.messages], max_tokens: request.maxTokens, ...(request.temperature === undefined ? {} : { temperature: request.temperature }) }) }];
}

function parseCompletion(provider: AiProviderConfiguration['provider'], model: string, payload: string): AiCompletion {
  try {
    const parsed = JSON.parse(payload) as any;
    const text = provider === 'anthropic'
      ? parsed.content?.find((part: any) => part?.type === 'text')?.text
      : provider === 'openai'
        ? parsed.output_text ?? parsed.output?.flatMap((item: any) => item?.content ?? []).find((part: any) => part?.type === 'output_text')?.text
        : parsed.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('Texte absent.');
    const usage = parsed.usage ?? {};
    const inputTokens = numberOrUndefined(usage.input_tokens ?? usage.prompt_tokens);
    const outputTokens = numberOrUndefined(usage.output_tokens ?? usage.completion_tokens);
    return {
      text,
      model: typeof parsed.model === 'string' ? parsed.model : model,
      ...(inputTokens === undefined ? {} : { inputTokens }),
      ...(outputTokens === undefined ? {} : { outputTokens }),
    };
  } catch (error) {
    if (error instanceof AiCompletionUnavailableError) throw error;
    throw new AiCompletionUnavailableError('invalid_response', 'Réponse IA inexploitable.');
  }
}

function numberOrUndefined(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function providerError(payload: string, status: number): string {
  try { const parsed = JSON.parse(payload) as any; const message = parsed.error?.message ?? parsed.message; if (typeof message === 'string') return `HTTP ${status}: ${message.slice(0, 300)}`; } catch { /* réponse non JSON */ }
  return `Le fournisseur IA a répondu HTTP ${status}.`;
}
