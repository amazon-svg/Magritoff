import { describe, expect, it, vi } from 'vitest';
import { ConfiguredAiDiagnosticsGateway, aiProviderConfigurationFromEnvironment } from '../../../src/adapters/ai/configured-ai-diagnostics-gateway';

describe('ConfiguredAiDiagnosticsGateway', () => {
  it('sélectionne OpenAI et son protocole sans exposer la clé', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ output_text: 'OK' }), { status: 200 }));
    const result = await new ConfiguredAiDiagnosticsGateway({ provider: 'openai', apiKey: 'secret', model: 'gpt-test' }, fetchMock as unknown as typeof fetch).testConnection();
    expect(result).toMatchObject({ provider: 'OpenAI', configured: true, reachable: true, responsePreview: 'OK' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/responses', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer secret' }) }));
  });

  it('sélectionne Mistral et son format de réponse', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'OK Mistral' } }] }), { status: 200 }));
    const result = await new ConfiguredAiDiagnosticsGateway({ provider: 'mistral', apiKey: 'secret' }, fetchMock as unknown as typeof fetch).testConnection();
    expect(result).toMatchObject({ provider: 'Mistral', reachable: true, responsePreview: 'OK Mistral' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.mistral.ai/v1/chat/completions', expect.any(Object));
  });

  it('conserve Anthropic par défaut et reste testable sans clé', async () => {
    const values = new Map<string, string>();
    expect(aiProviderConfigurationFromEnvironment((name) => values.get(name))).toEqual({ provider: 'anthropic', apiKey: null, model: null });
    const result = await new ConfiguredAiDiagnosticsGateway({ provider: 'anthropic', apiKey: null }).testConnection();
    expect(result).toMatchObject({ provider: 'Anthropic', configured: false, reachable: null });
  });

  it('lit la clé et le modèle du fournisseur sélectionné', () => {
    const values = new Map([['MAGRIT_AI_PROVIDER', 'mistral'], ['MISTRAL_API_KEY', 'm-key'], ['MAGRIT_AI_MODEL', 'custom-model'], ['ANTHROPIC_API_KEY', 'ignored']]);
    expect(aiProviderConfigurationFromEnvironment((name) => values.get(name))).toEqual({ provider: 'mistral', apiKey: 'm-key', model: 'custom-model' });
  });
});
