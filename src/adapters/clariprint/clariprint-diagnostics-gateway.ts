import type { ClariprintDiagnostic } from '../../modules/diagnostics/api/contracts.ts';
import type { ClariprintDiagnosticsGateway } from '../../modules/diagnostics/application/clariprint-diagnostics-gateway.ts';

export class HttpClariprintDiagnosticsGateway implements ClariprintDiagnosticsGateway {
  constructor(
    private readonly host: string,
    private readonly login: string | null,
    private readonly password: string | null,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
  ) {}

  async testConnection(): Promise<ClariprintDiagnostic> {
    const testedAt = new Date().toISOString();
    if (!this.login || !this.password) {
      return {
        service: 'Clariprint', configured: false, reachable: null, authenticated: null, testedAt,
        summary: 'Configuration Clariprint incomplète.',
        checks: [{ name: 'Configuration', status: 'skipped', details: 'Identifiants Clariprint absents côté serveur.' }],
      };
    }

    try {
      const body = new URLSearchParams({ login: this.login, password: this.password, action: 'CheckAuth', datas: '{}' });
      const response = await this.fetchImplementation(`${this.host.replace(/\/+$/, '')}/optimproject/json.wcl`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.text();
      const serviceSuccess = parsedSuccess(payload);
      const authenticated = response.ok && serviceSuccess !== false;
      return {
        service: 'Clariprint', configured: true, reachable: true, authenticated, testedAt,
        httpStatus: response.status,
        summary: authenticated ? 'Authentification Clariprint réussie.' : `Authentification Clariprint refusée (HTTP ${response.status}).`,
        checks: [{
          name: 'CheckAuth', status: authenticated ? 'ok' : 'error',
          details: authenticated ? 'Le service accepte les identifiants configurés.' : safeResponseDetail(payload),
        }],
      };
    } catch (error) {
      return {
        service: 'Clariprint', configured: true, reachable: false, authenticated: null, testedAt,
        summary: 'Serveur Clariprint injoignable.',
        checks: [{ name: 'Connexion', status: 'error', details: error instanceof Error ? error.message.slice(0, 500) : 'Erreur réseau inconnue.' }],
      };
    }
  }
}

function parsedSuccess(payload: string): boolean | null {
  try {
    const parsed = JSON.parse(payload) as { success?: unknown };
    return typeof parsed.success === 'boolean' ? parsed.success : null;
  } catch { return null; }
}

function safeResponseDetail(payload: string): string {
  if (!payload) return 'Réponse sans détail.';
  try {
    const parsed = JSON.parse(payload) as { error?: unknown; message?: unknown };
    const detail = typeof parsed.error === 'string' ? parsed.error : parsed.message;
    if (typeof detail === 'string') return detail.slice(0, 500);
  } catch { /* réponse non JSON */ }
  return payload.slice(0, 500);
}
