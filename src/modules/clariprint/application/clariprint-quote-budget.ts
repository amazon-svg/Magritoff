/**
 * BCP-0b — port du budget de débit sur `POST /api/v1/clariprint/quote`
 * (docs/api/CONVENTIONS.md §8.25 point 2.3bis). `ClariprintService.quote`
 * consulte ce port APRÈS la validation du corps et AVANT la passerelle : un
 * corps invalide ne consomme rien, et un refus n'appelle JAMAIS Clariprint
 * (point 2.3bis (8)).
 */

/**
 * L'appelant établi par la route (point 2.3bis (4) et (8)) :
 * - `member` : jeton résolu en acteur `user` ET appartenance à au moins un
 *   espace (`current_user_tenant_ids()`). Ne porte QUE son propre étage,
 *   jamais le plafond public (L3).
 * - `visitor` : tout le reste (session boutique, IP retenue, ou clé
 *   partagée si l'IP/le secret manquent). Porte L1 visiteur ET L3.
 *
 * `key` est déjà la valeur de clé prête à stocker (`key_hash` en base) :
 * l'identifiant de compte/utilisateur en clair, ou le HMAC de l'IP — jamais
 * une IP en clair.
 */
export type ClariprintQuoteCaller =
  | Readonly<{ kind: 'member'; key: string }>
  | Readonly<{ kind: 'visitor'; key: string }>;

/** Portée qui a refusé l'appel — nommage court côté TS, distinct du nom SQL de la portée (`clariprint_quote_*`). */
export type ClariprintQuoteBudgetRefusal = 'visitor' | 'member' | 'public';

export type ClariprintQuoteBudgetDecision =
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; refusedScope: ClariprintQuoteBudgetRefusal }>;

export interface ClariprintQuoteBudget {
  /** Vérifie ET incrémente, tout ou rien (migration `api_consume_clariprint_quote_budget`). */
  consume(caller: ClariprintQuoteCaller): Promise<ClariprintQuoteBudgetDecision>;
}

/**
 * Le budget a refusé l'appel : 429 `api.rate_limited` (visitor/member) ou
 * 503 `clariprint.public_quota_exhausted` (public) — traduit par la route.
 */
export class ClariprintQuoteRateLimitedError extends Error {
  constructor(public readonly refusedScope: ClariprintQuoteBudgetRefusal) {
    super(`clariprint_quote_rate_limited:${refusedScope}`);
    this.name = 'ClariprintQuoteRateLimitedError';
  }
}

/**
 * Le budget lui-même est hors service : base injoignable, clé service_role
 * absente, réponse illisible, ou vérification d'appartenance en erreur.
 * ÉCHEC FERMÉ dans tous les cas (point 2.3bis (3)) : Clariprint n'est jamais
 * appelé, la route rend 503 `clariprint.unavailable`.
 */
export class ClariprintQuoteBudgetUnavailableError extends Error {
  constructor(message = 'clariprint_quote_budget_unavailable') {
    super(message);
    this.name = 'ClariprintQuoteBudgetUnavailableError';
  }
}
