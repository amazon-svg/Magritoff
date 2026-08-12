import { describe, expect, it, vi } from 'vitest';
import { AnthropicAiDiagnosticsGateway } from '../../../src/adapters/anthropic/ai-diagnostics-gateway';

describe('AnthropicAiDiagnosticsGateway', () => {
  it('ne fait aucun appel externe sans clé serveur', async () => {
    const fetchMock = vi.fn();
    const result = await new AnthropicAiDiagnosticsGateway(null, fetchMock as unknown as typeof fetch).testConnection();
    expect(result).toMatchObject({ provider: 'Anthropic', configured: false, reachable: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ne renvoie ni la clé ni la réponse technique brute', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      content: [{ text: 'OK' }],
      internal: 'secret-provider-payload',
    }), { status: 200 }));
    const result = await new AnthropicAiDiagnosticsGateway(
      'sk-test-secret', fetchMock as unknown as typeof fetch, 'test-model',
    ).testConnection();
    expect(result).toMatchObject({ configured: true, reachable: true, responsePreview: 'OK' });
    expect(JSON.stringify(result)).not.toContain('sk-test-secret');
    expect(JSON.stringify(result)).not.toContain('secret-provider-payload');
  });

  it('normalise un refus fournisseur en diagnostic métier', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Crédit indisponible' } }), { status: 402 }));
    const result = await new AnthropicAiDiagnosticsGateway('key', fetchMock as unknown as typeof fetch).testConnection();
    expect(result).toMatchObject({ configured: true, reachable: false });
    expect(result.checks[0]).toMatchObject({ status: 'error', details: 'Crédit indisponible' });
  });
});
