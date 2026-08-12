import type { AiProviderDiagnostic } from '../../modules/diagnostics/api/contracts.ts';
import type { AiDiagnosticsGateway } from '../../modules/diagnostics/application/ai-diagnostics-gateway.ts';

export class AnthropicAiDiagnosticsGateway implements AiDiagnosticsGateway {
  constructor(
    private readonly apiKey: string | null,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
    private readonly model = 'claude-haiku-4-5-20251001',
  ) {}

  async testConnection(): Promise<AiProviderDiagnostic> {
    const testedAt = new Date().toISOString();
    if (!this.apiKey) {
      return {
        provider: 'Anthropic', configured: false, reachable: null, testedAt,
        summary: 'Configuration incomplète : clé API absente.',
        checks: [{ name: 'Configuration', status: 'skipped', details: 'ANTHROPIC_API_KEY non configurée côté serveur.' }],
      };
    }

    try {
      const response = await this.fetchImplementation('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: this.model, max_tokens: 50, messages: [{ role: 'user', content: 'Réponds simplement: OK' }] }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.text();
      if (!response.ok) {
        return {
          provider: 'Anthropic', configured: true, reachable: false, testedAt,
          summary: `Le fournisseur IA a refusé le test (HTTP ${response.status}).`,
          checks: [{ name: 'Connexion fournisseur', status: 'error', details: safeDetails(payload, response.statusText) }],
        };
      }
      return {
        provider: 'Anthropic', configured: true, reachable: true, testedAt,
        summary: 'Connexion au fournisseur IA fonctionnelle.',
        responsePreview: responseText(payload),
        checks: [{ name: 'Connexion fournisseur', status: 'ok', details: `Modèle ${this.model}` }],
      };
    } catch (error) {
      return {
        provider: 'Anthropic', configured: true, reachable: false, testedAt,
        summary: 'Connexion au fournisseur IA impossible.',
        checks: [{ name: 'Connexion fournisseur', status: 'error', details: error instanceof Error ? error.message.slice(0, 500) : 'Erreur réseau inconnue.' }],
      };
    }
  }
}

function responseText(payload: string): string {
  try {
    const parsed = JSON.parse(payload) as { content?: Array<{ text?: unknown }> };
    const text = parsed.content?.[0]?.text;
    return typeof text === 'string' ? text.slice(0, 500) : 'Réponse reçue.';
  } catch { return 'Réponse reçue.'; }
}

function safeDetails(payload: string, fallback: string): string {
  if (!payload) return fallback.slice(0, 500) || 'Réponse sans détail.';
  try {
    const parsed = JSON.parse(payload) as { error?: { message?: unknown } };
    const message = parsed.error?.message;
    if (typeof message === 'string') return message.slice(0, 500);
  } catch { /* réponse non JSON */ }
  return payload.slice(0, 500);
}
