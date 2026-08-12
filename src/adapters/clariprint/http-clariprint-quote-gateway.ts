import { clariprintQuoteResultSchema, type ClariprintQuoteCommand, type ClariprintQuoteResult } from '../../modules/clariprint/api/contracts.ts';
import type { ClariprintQuoteGateway } from '../../modules/clariprint/application/clariprint-quote-gateway.ts';

export class HttpClariprintQuoteGateway implements ClariprintQuoteGateway {
  constructor(
    private readonly host: string,
    private readonly login: string | null,
    private readonly password: string | null,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
  ) {}

  async quote(command: ClariprintQuoteCommand): Promise<ClariprintQuoteResult> {
    if (!this.login || !this.password) return { success: false, credentialsMissing: true, message: 'Configuration Clariprint incomplète.' };
    const product = structuredClone(command.clariprint);
    if (typeof product.quantity === 'number') product.quantity = String(product.quantity);
    if (!product.deliveries) product.deliveries = { d_livraison: { iso: 'FR-75', address: '', quantity: product.quantity } };
    const body = new URLSearchParams({ login: this.login, password: this.password, action: 'QuoteRequest', datas: JSON.stringify({ clariprint_product: product }) });
    let response: Response;
    try {
      response = await this.fetchImplementation(apiUrl(this.host), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(), signal: AbortSignal.timeout(20_000) });
    } catch (error) {
      return { success: false, error: 'Connexion Clariprint impossible', details: error instanceof Error ? error.message.slice(0, 500) : 'Erreur réseau inconnue' };
    }
    const text = await response.text();
    if (!response.ok) return { success: false, error: `Clariprint API HTTP ${response.status}`, details: text.slice(0, 500) };
    let payload: any;
    try { payload = JSON.parse(text); } catch { return { success: false, error: 'Réponse Clariprint invalide (non-JSON)', details: text.slice(0, 300) }; }
    if (!payload.success) return { success: false, error: typeof payload.error === 'string' ? payload.error : 'Erreur de calcul Clariprint' };
    const priceHT = payload.response;
    if (typeof priceHT !== 'number' || !Number.isFinite(priceHT) || priceHT < 0) return { success: false, error: priceHT < 0 ? 'Prix Clariprint invalide (négatif)' : 'Prix Clariprint invalide (absent, NaN ou non-numérique)', details: `priceHT brut reçu: ${JSON.stringify(priceHT)}` };
    const costs = validCosts(payload.costs);
    return clariprintQuoteResultSchema.parse({ success: true, priceHT, ...(costs ? { costs } : {}), ...(number(payload.delais) === undefined ? {} : { delais: number(payload.delais) }), ...(number(payload.weight) === undefined ? {} : { weight: number(payload.weight) }), ...(typeof payload.fournisseur === 'string' ? { fournisseur: payload.fournisseur } : {}), ...(number(payload.total_process_duration) === undefined ? {} : { processDuration: number(payload.total_process_duration) }), allResults: payload.all_process ?? [], faultyProcess: payload.all_faulty_process ?? {} });
  }
}

function apiUrl(host: string): string { const normalized = host.trim().replace(/\/+$/, ''); const absolute = /^https?:\/\//.test(normalized) ? normalized : `https://${normalized}`; return absolute.includes('/optimproject/json.wcl') ? absolute : `${absolute}/optimproject/json.wcl`; }
function number(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function validCosts(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const costs = { ...(value as Record<string, unknown>) };
  if (costs.total !== undefined && (typeof costs.total !== 'number' || !Number.isFinite(costs.total) || costs.total < 0)) delete costs.total;
  return costs;
}
