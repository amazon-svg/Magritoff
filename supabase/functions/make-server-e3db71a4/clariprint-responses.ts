// ============================================================================
// Constructions PURES des reponses JSON de clariprint-quote et clariprint-test
// ============================================================================
//
// Correctif de securite (decision Arnaud, 2026-09-15). Ces deux routes de
// l edge function legacy `make-server-e3db71a4` sont appelables par quiconque
// detient la cle anonyme publique du projet Supabase (`verify_jwt = true`
// accepte n importe quel JWT anon, il ne verifie pas qu il s agit d un
// utilisateur autorise). Elles ne doivent donc plus jamais renvoyer au client
// de donnee brute issue de Clariprint : gammes de fabrication (all_process),
// gammes en erreur (all_faulty_process), reponse HTTP entiere (rawResponse /
// parsedResponse), extrait de reponse brute, URL interne appelee, hote ou
// identifiants de connexion.
//
// Ce module est isole d index.ts (un gros serveur Hono/Deno difficile a
// executer sous vitest) pour permettre un test unitaire direct des formes de
// reponse, en plus du test d architecture qui verifie qu index.ts ne fait
// plus passer les champs sensibles vers `c.json`.
//
// Le detail brut (reponse Clariprint, erreurs HTTP, JSON invalide) continue
// d etre journalise via `console.error`/`console.log`, deja present dans
// index.ts : ces logs partent uniquement dans les logs serveur Supabase, pas
// dans la reponse HTTP au client.

/** Corps de reponse en cas de succes de clariprint-quote. Volontairement
 * limite aux 6 champs metier attendus par le front — aucune propriete
 * supplementaire (all_process, all_faulty_process, rawResponse) ne peut y
 * transiter, la signature ne les accepte pas. */
export interface ClariprintQuoteSuccessBody {
  success: true;
  priceHT: number;
  costs?: unknown;
  delais?: unknown;
  weight?: unknown;
  fournisseur?: unknown;
  processDuration?: unknown;
}

export interface ClariprintQuoteErrorBody {
  success: false;
  error?: string;
  message?: string;
  credentialsMissing?: boolean;
}

export const CLARIPRINT_GENERIC_MESSAGES = {
  httpError: "Erreur de communication avec Clariprint",
  invalidJson: "Reponse Clariprint invalide",
  calcError: "Erreur de calcul Clariprint",
  priceInvalid: "Prix Clariprint invalide",
  missingProduct: "Donnees produit Clariprint manquantes",
  serverError: "Erreur serveur",
} as const;

/** Credentials manquants (CLARIPRINT_LOGIN / CLARIPRINT_PASSWORD) : reponse
 * gracieuse deja generique, conservee telle quelle. */
export function buildQuoteCredentialsMissingBody(message: string): ClariprintQuoteErrorBody {
  return { success: false, credentialsMissing: true, message };
}

/** Corps produit Clariprint absent de la requete entrante (400). */
export function buildQuoteMissingProductBody(): ClariprintQuoteErrorBody {
  return { success: false, error: CLARIPRINT_GENERIC_MESSAGES.missingProduct };
}

/** Reponse HTTP Clariprint non-2xx. Le detail brut (texte de la reponse)
 * reste dans console.error côté appelant, jamais ici. */
export function buildQuoteHttpErrorBody(): ClariprintQuoteErrorBody {
  return { success: false, error: CLARIPRINT_GENERIC_MESSAGES.httpError };
}

/** Reponse Clariprint non parsable en JSON. Ni l URL appelee, ni l extrait
 * brut de reponse ne sont renvoyes au client. */
export function buildQuoteInvalidJsonBody(): ClariprintQuoteErrorBody {
  return { success: false, error: CLARIPRINT_GENERIC_MESSAGES.invalidJson };
}

/** Clariprint a repondu success=false. Ni all_faulty_process ni la reponse
 * Clariprint entiere ne sont renvoyes au client. */
export function buildQuoteCalcErrorBody(): ClariprintQuoteErrorBody {
  return { success: false, error: CLARIPRINT_GENERIC_MESSAGES.calcError };
}

/** Prix Clariprint invalide (absent, NaN, non-numerique ou negatif). Message
 * volontairement generique et sans argument : rien de derive de la reponse
 * Clariprint ne doit transiter par cet appel (decision qa-review 2026-09-15,
 * regle "aucun argument de constructeur ne derive de result/..."). */
export function buildQuoteInvalidPriceBody(): ClariprintQuoteErrorBody {
  return { success: false, error: CLARIPRINT_GENERIC_MESSAGES.priceInvalid };
}

/** Erreur serveur generique (catch-all). Ne recoit jamais le detail de
 * l exception (qui peut contenir l hote ou un extrait reseau) : celui-ci
 * reste dans console.error, cote appelant. */
export function buildQuoteServerErrorBody(): ClariprintQuoteErrorBody {
  return { success: false, error: CLARIPRINT_GENERIC_MESSAGES.serverError };
}

/** Masque costs.total si invalide (NaN, non-numerique ou negatif). Logique
 * de sanitisation deplacee ici (hors index.ts) pour que l appel a
 * buildQuoteSuccessBody() ne recoive, pour la cle `costs`, qu un acces
 * simple `result.costs` -- exigence de la regle AST (qa-review 2026-09-15). */
function sanitizeCosts(costs: unknown): unknown {
  if (!costs || typeof costs !== "object") return costs;
  const record = costs as Record<string, unknown>;
  if (record.total === undefined) return costs;
  const totalInvalid =
    typeof record.total !== "number" || !Number.isFinite(record.total) || record.total < 0;
  if (!totalInvalid) return costs;
  return { ...record, total: undefined };
}

/** Corps de reponse succes. Ne recoit que les 6 champs metier attendus :
 * impossible d y glisser all_process / all_faulty_process par construction.
 * `costs` est sanitise en interne (sanitizeCosts) : l appelant ne fait
 * jamais qu un acces simple `result.costs`. */
export function buildQuoteSuccessBody(input: {
  priceHT: number;
  costs?: unknown;
  delais?: unknown;
  weight?: unknown;
  fournisseur?: unknown;
  processDuration?: unknown;
}): ClariprintQuoteSuccessBody {
  const body: ClariprintQuoteSuccessBody = { success: true, priceHT: input.priceHT };
  if (input.costs !== undefined) body.costs = sanitizeCosts(input.costs);
  if (input.delais !== undefined) body.delais = input.delais;
  if (input.weight !== undefined) body.weight = input.weight;
  if (input.fournisseur !== undefined) body.fournisseur = input.fournisseur;
  if (input.processDuration !== undefined) body.processDuration = input.processDuration;
  return body;
}

/** Corps de reponse de clariprint-test (CheckAuth). Ne renvoie plus l hote,
 * le prefixe de login, ni la reponse brute/parsee de Clariprint. */
export interface ClariprintTestBody {
  timestamp: string;
  success: boolean;
  message: string;
}

export function buildAuthTestBody(params: { success: boolean; message: string }): ClariprintTestBody {
  return {
    timestamp: new Date().toISOString(),
    success: params.success,
    message: params.message,
  };
}
