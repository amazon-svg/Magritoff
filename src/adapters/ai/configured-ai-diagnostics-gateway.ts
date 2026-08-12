import type { AiProviderDiagnostic } from '../../modules/diagnostics/api/contracts.ts';
import type { AiDiagnosticsGateway } from '../../modules/diagnostics/application/ai-diagnostics-gateway.ts';

export type AiProviderId = 'anthropic' | 'openai' | 'mistral';
export type AiProviderConfiguration = Readonly<{ provider: AiProviderId; apiKey: string | null; model?: string | null }>;
const DEFAULT_MODELS: Record<AiProviderId, string> = { anthropic: 'claude-haiku-4-5-20251001', openai: 'gpt-4.1-mini', mistral: 'mistral-small-latest' };

export class ConfiguredAiDiagnosticsGateway implements AiDiagnosticsGateway {
  constructor(private readonly configuration: AiProviderConfiguration, private readonly fetchImplementation: typeof fetch = globalThis.fetch) {}
  async testConnection(): Promise<AiProviderDiagnostic> {
    const testedAt = new Date().toISOString();
    const provider = providerLabel(this.configuration.provider);
    const model = this.configuration.model?.trim() || DEFAULT_MODELS[this.configuration.provider];
    if (!this.configuration.apiKey) return { provider, configured: false, reachable: null, testedAt, summary: 'Configuration incomplète : clé API absente.', checks: [{ name: 'Configuration', status: 'skipped', details: `${keyName(this.configuration.provider)} non configurée côté serveur.` }] };
    try {
      const response = await this.fetchImplementation(...requestFor(this.configuration.provider, this.configuration.apiKey, model));
      const payload = await response.text();
      if (!response.ok) return { provider, configured: true, reachable: false, testedAt, summary: `Le fournisseur IA a refusé le test (HTTP ${response.status}).`, checks: [{ name: 'Connexion fournisseur', status: 'error', details: safeDetails(payload, response.statusText) }] };
      return { provider, configured: true, reachable: true, testedAt, summary: 'Connexion au fournisseur IA fonctionnelle.', responsePreview: responseText(this.configuration.provider, payload), checks: [{ name: 'Connexion fournisseur', status: 'ok', details: `Modèle ${model}` }] };
    } catch (error) {
      return { provider, configured: true, reachable: false, testedAt, summary: 'Connexion au fournisseur IA impossible.', checks: [{ name: 'Connexion fournisseur', status: 'error', details: error instanceof Error ? error.message.slice(0, 500) : 'Erreur réseau inconnue.' }] };
    }
  }
}

export function aiProviderConfigurationFromEnvironment(read: (name: string) => string | undefined): AiProviderConfiguration {
  const raw = read('MAGRIT_AI_PROVIDER')?.trim().toLowerCase();
  const provider: AiProviderId = raw === 'openai' || raw === 'mistral' ? raw : 'anthropic';
  const apiKey = provider === 'openai' ? read('OPENAI_API_KEY') : provider === 'mistral' ? read('MISTRAL_API_KEY') : read('ANTHROPIC_API_KEY') ?? read('Magrit3') ?? read('MAGRIT3') ?? read('MAGRIT');
  return { provider, apiKey: apiKey?.trim() || null, model: read('MAGRIT_AI_MODEL')?.trim() || null };
}

function requestFor(provider: AiProviderId, apiKey: string, model: string): [RequestInfo | URL, RequestInit] {
  const common = { method: 'POST', signal: AbortSignal.timeout(15_000) };
  if (provider === 'anthropic') return ['https://api.anthropic.com/v1/messages', { ...common, headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 50, messages: [{ role: 'user', content: 'Réponds simplement: OK' }] }) }];
  if (provider === 'openai') return ['https://api.openai.com/v1/responses', { ...common, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, input: 'Réponds simplement: OK', max_output_tokens: 50 }) }];
  return ['https://api.mistral.ai/v1/chat/completions', { ...common, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Réponds simplement: OK' }], max_tokens: 50 }) }];
}
function providerLabel(provider: AiProviderId): string { return provider === 'openai' ? 'OpenAI' : provider === 'mistral' ? 'Mistral' : 'Anthropic'; }
function keyName(provider: AiProviderId): string { return provider === 'openai' ? 'OPENAI_API_KEY' : provider === 'mistral' ? 'MISTRAL_API_KEY' : 'ANTHROPIC_API_KEY'; }
function responseText(provider: AiProviderId, payload: string): string {
  try { const parsed = JSON.parse(payload) as any; const value = provider === 'anthropic' ? parsed.content?.[0]?.text : provider === 'openai' ? parsed.output?.[0]?.content?.[0]?.text ?? parsed.output_text : parsed.choices?.[0]?.message?.content; return typeof value === 'string' ? value.slice(0, 500) : 'Réponse reçue.'; } catch { return 'Réponse reçue.'; }
}
function safeDetails(payload: string, fallback: string): string {
  if (!payload) return fallback.slice(0, 500) || 'Réponse sans détail.';
  try { const parsed = JSON.parse(payload) as any; const message = parsed.error?.message ?? parsed.message; if (typeof message === 'string') return message.slice(0, 500); } catch { /* non JSON */ }
  return payload.slice(0, 500);
}
