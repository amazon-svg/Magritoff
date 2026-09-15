import { clariprintQuoteResultSchema, type ClariprintQuoteCommand, type ClariprintQuoteResult } from '../../modules/clariprint/api/contracts.ts';
import type { ClariprintQuoteGateway } from '../../modules/clariprint/application/clariprint-quote-gateway.ts';
import { noopClariprintQuoteLogger, type ClariprintQuoteLogger } from '../../modules/clariprint/application/clariprint-quote-logger.ts';
import {
  buildClariprintQuoteVerdict,
  type ClariprintQuoteOutcome,
  type ClariprintQuoteVerdictInput,
} from '../../modules/clariprint/application/clariprint-quote-verdict.ts';

export class HttpClariprintQuoteGateway implements ClariprintQuoteGateway {
  constructor(
    private readonly host: string,
    private readonly login: string | null,
    private readonly password: string | null,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
    private readonly logger: ClariprintQuoteLogger = noopClariprintQuoteLogger,
  ) {}

  /**
   * `requestId` : BCP-1a (docs/api/CONVENTIONS.md §8.25 point 2.3) —
   * l'en-tête `X-Request-Id` que la façade historique pose déjà
   * (`api-v1-handler.ts:185`), pour retrouver un verdict au journal.
   * Optionnel pour ne pas casser un appelant qui ne le fournit pas encore
   * (tests, ou un futur appelant qui n'a pas de requête HTTP en cours) :
   * dans ce cas le verdict est journalisé sous `'unknown'`.
   */
  async quote(command: ClariprintQuoteCommand, requestId = 'unknown'): Promise<ClariprintQuoteResult> {
    if (!this.login || !this.password) {
      this.record(requestId, 'not_configured', { upstreamStatus: null, upstreamSuccess: null, durationMs: 0, sentConfig: {} });
      return { success: false, credentialsMissing: true, message: 'Configuration Clariprint incomplète.' };
    }
    const product = structuredClone(command.clariprint);
    if (typeof product.quantity === 'number') product.quantity = String(product.quantity);
    if (!product.deliveries) product.deliveries = { d_livraison: { iso: 'FR-75', address: '', quantity: product.quantity } };
    const body = new URLSearchParams({ login: this.login, password: this.password, action: 'QuoteRequest', datas: JSON.stringify({ clariprint_product: product }) });

    const startedAt = Date.now();
    let response: Response;
    try {
      response = await this.fetchImplementation(apiUrl(this.host), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(), signal: AbortSignal.timeout(20_000) });
    } catch {
      // qa-review round 1 (rejet) : l'exception réseau (`TypeError: fetch
      // failed`, etc.) PORTE SOUVENT L'HÔTE dans son message
      // (`getaddrinfo ENOTFOUND <hôte>`). Ce n'est PAS `payload.error` — ce
      // n'a donc rien à faire dans `upstreamError`, même au seul journal.
      // Seule une CATÉGORIE sans contenu texte est conservée
      // (`failureCategory: 'network'`) : elle suffit au diagnostic (« panne
      // de transport »), sans jamais transporter l'hôte ni le message brut
      // de l'exception. Le message d'exception n'est volontairement pas lu.
      this.record(requestId, 'unavailable', {
        upstreamStatus: null,
        upstreamSuccess: null,
        failureCategory: 'network',
        durationMs: Date.now() - startedAt,
        sentConfig: product,
      });
      return { success: false, error: 'Connexion Clariprint impossible' };
    }
    const durationMs = Date.now() - startedAt;
    const text = await response.text();
    if (!response.ok) {
      // qa-review round 1 (rejet) : `text` est le corps brut renvoyé par
      // Clariprint (ou par un relais devant lui) sur un statut non-2xx — il
      // peut reprendre les paramètres envoyés (login, mot de passe) ou du
      // HTML. Ce n'est PAS `payload.error` : il ne va JAMAIS au verdict, ni
      // au journal. Seule la catégorie (`'http_status'`) et le statut HTTP
      // amont (déjà conservé via `upstreamStatus`) sont gardés.
      this.record(requestId, 'unavailable', { upstreamStatus: response.status, upstreamSuccess: null, failureCategory: 'http_status', durationMs, sentConfig: product });
      return { success: false, error: 'Clariprint injoignable ou en erreur' };
    }
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      // qa-review round 1 (rejet) : même réserve que ci-dessus — `text` (le
      // corps non-JSON) ne va jamais au verdict.
      this.record(requestId, 'unavailable', { upstreamStatus: response.status, upstreamSuccess: null, failureCategory: 'non_json', durationMs, sentConfig: product });
      return { success: false, error: 'Réponse Clariprint invalide (non-JSON)' };
    }
    if (!payload.success) {
      // BCP-1a : `payload.error` est le texte brut d'erreur de Clariprint —
      // conservé (tronqué) dans le verdict journalisé, jamais recopié dans
      // la réponse publique (avant ce lot, `error: payload.error` fuyait
      // tel quel — dette qa de BCP-0, close ici).
      this.record(requestId, 'not_priced', {
        upstreamStatus: response.status,
        upstreamSuccess: false,
        upstreamError: payload.error,
        rawResponseValue: payload.response,
        allProcess: payload.all_process,
        allFaultyProcess: payload.all_faulty_process,
        fournisseur: payload.fournisseur,
        durationMs,
        sentConfig: product,
      });
      return { success: false, error: 'Erreur de calcul Clariprint' };
    }
    const priceHT = payload.response;
    if (typeof priceHT !== 'number' || !Number.isFinite(priceHT) || priceHT < 0) {
      this.record(requestId, 'not_priced', {
        upstreamStatus: response.status,
        upstreamSuccess: true,
        rawResponseValue: priceHT,
        allProcess: payload.all_process,
        allFaultyProcess: payload.all_faulty_process,
        fournisseur: payload.fournisseur,
        durationMs,
        sentConfig: product,
      });
      return { success: false, error: priceHT < 0 ? 'Prix Clariprint invalide (négatif)' : 'Prix Clariprint invalide (absent, NaN ou non-numérique)' };
    }
    const costs = validCosts(payload.costs);
    this.record(requestId, 'priced', {
      upstreamStatus: response.status,
      upstreamSuccess: true,
      rawResponseValue: priceHT,
      allProcess: payload.all_process,
      allFaultyProcess: payload.all_faulty_process,
      fournisseur: payload.fournisseur,
      durationMs,
      sentConfig: product,
    });
    // Correctif sécurité 2026-09-15 : `payload.all_process`/`payload.all_faulty_process`
    // portent le détail interne du compte Clariprint de la plateforme (imprimeurs,
    // identifiants externes, coûts, gammes de fabrication) ; cette route est publique
    // (authentication: 'public') et aucun écran ne lit ces champs. Ne JAMAIS les
    // reporter dans le résultat — le verdict ci-dessus les expurge pour le seul
    // journal (BCP-1a).
    return clariprintQuoteResultSchema.parse({ success: true, priceHT, ...(costs ? { costs } : {}), ...(number(payload.delais) === undefined ? {} : { delais: number(payload.delais) }), ...(number(payload.weight) === undefined ? {} : { weight: number(payload.weight) }), ...(typeof payload.fournisseur === 'string' ? { fournisseur: payload.fournisseur } : {}), ...(number(payload.total_process_duration) === undefined ? {} : { processDuration: number(payload.total_process_duration) }) });
  }

  private record(requestId: string, outcome: ClariprintQuoteOutcome, raw: ClariprintQuoteVerdictInput): void {
    this.logger.log({ event: 'clariprint.quote', requestId, outcome, verdict: buildClariprintQuoteVerdict(raw) });
  }
}

function apiUrl(host: string): string { const normalized = host.trim().replace(/\/+$/, ''); const absolute = /^https?:\/\//.test(normalized) ? normalized : `https://${normalized}`; return absolute.includes('/optimproject/json.wcl') ? absolute : `${absolute}/optimproject/json.wcl`; }
function number(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
// Correctif sécurité BCP-0 (complément 2026-09-15) : ne recopier que les six
// clés documentées de `costs` (JsonApi.txt) — jamais les clés brutes reçues
// de Clariprint. `payload.costs` peut porter `printer`/`external_id` (détail
// interne du compte Clariprint de la plateforme) ; les recopier ici les
// exposait à l'appelant anonyme de cette route publique même si
// `clariprintCostsSchema` filtrait ensuite (défense en profondeur : ce
// gateway ne doit produire que la forme autorisée, pas s'en remettre au seul
// schéma en aval).
const ALLOWED_COST_KEYS = ['paper', 'print', 'makeready', 'packaging', 'delivery', 'total'] as const;
function validCosts(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const costs: Record<string, unknown> = {};
  for (const key of ALLOWED_COST_KEYS) {
    if (source[key] !== undefined) costs[key] = source[key];
  }
  if (costs.total !== undefined && (typeof costs.total !== 'number' || !Number.isFinite(costs.total) || costs.total < 0)) delete costs.total;
  return costs;
}
