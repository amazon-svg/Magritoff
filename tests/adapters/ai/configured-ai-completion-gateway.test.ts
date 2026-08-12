import { describe, expect, it, vi } from 'vitest';
import { ConfiguredAiCompletionGateway } from '../../../src/adapters/ai/configured-ai-completion-gateway';
import { AiCompletionUnavailableError } from '../../../src/modules/diagnostics/application/ai-completion-gateway';

const request = { system: 'Système', messages: [{ role: 'user' as const, content: 'Bonjour' }], maxTokens: 120, temperature: 0.2 };

describe('ConfiguredAiCompletionGateway', () => {
  it('utilise le protocole Anthropic', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ model: 'claude-test', content: [{ type: 'text', text: '{"title":"A"}' }], usage: { input_tokens: 10, output_tokens: 5 } })));
    const result = await new ConfiguredAiCompletionGateway({ provider: 'anthropic', apiKey: 'a-key', model: 'claude-test' }, fetchMock as unknown as typeof fetch).complete(request);
    expect(result).toEqual({ text: '{"title":"A"}', model: 'claude-test', inputTokens: 10, outputTokens: 5 });
    expect(fetchMock).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'a-key' }) }));
  });

  it('utilise Responses API pour OpenAI', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ model: 'gpt-test', output: [{ content: [{ type: 'output_text', text: '{"intro":"B"}' }] }], usage: { input_tokens: 8, output_tokens: 4 } })));
    const result = await new ConfiguredAiCompletionGateway({ provider: 'openai', apiKey: 'o-key', model: 'gpt-test' }, fetchMock as unknown as typeof fetch).complete(request);
    expect(result.text).toBe('{"intro":"B"}');
    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/responses', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer o-key' }) }));
  });

  it('utilise Chat Completions pour Mistral', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ model: 'mistral-test', choices: [{ message: { content: '{"seo":"C"}' } }], usage: { prompt_tokens: 7, completion_tokens: 3 } })));
    const result = await new ConfiguredAiCompletionGateway({ provider: 'mistral', apiKey: 'm-key', model: 'mistral-test' }, fetchMock as unknown as typeof fetch).complete(request);
    expect(result).toMatchObject({ text: '{"seo":"C"}', inputTokens: 7, outputTokens: 3 });
    expect(fetchMock).toHaveBeenCalledWith('https://api.mistral.ai/v1/chat/completions', expect.any(Object));
  });

  it('retourne une erreur typée quand aucune clé serveur n’est configurée', async () => {
    await expect(new ConfiguredAiCompletionGateway({ provider: 'openai', apiKey: null }).complete(request)).rejects.toEqual(expect.objectContaining<Partial<AiCompletionUnavailableError>>({ code: 'not_configured' }));
  });
});
