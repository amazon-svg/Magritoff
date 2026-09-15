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
  priceNegative: "Prix Clariprint invalide (negatif)",
  priceInvalid: "Prix Clariprint invalide (absent, NaN ou non-numerique)",
  missingProduct: "Donnees produit Clariprint manquantes",
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

/** Prix Clariprint invalide (absent, NaN, non-numerique ou negatif). La
 * reponse Clariprint entiere n est plus renvoyee au client. */
export function buildQuoteInvalidPriceBody(priceHT: unknown): ClariprintQuoteErrorBody {
  const isNegative = typeof priceHT === "number" && priceHT < 0;
  return {
    success: false,
    error: isNegative
      ? CLARIPRINT_GENERIC_MESSAGES.priceNegative
      : CLARIPRINT_GENERIC_MESSAGES.priceInvalid,
  };
}

/** Corps de reponse succes. Ne recoit que les 6 champs metier attendus :
 * impossible d y glisser all_process / all_faulty_process par construction. */
export function buildQuoteSuccessBody(input: {
  priceHT: number;
  costs?: unknown;
  delais?: unknown;
  weight?: unknown;
  fournisseur?: unknown;
  processDuration?: unknown;
}): ClariprintQuoteSuccessBody {
  const body: ClariprintQuoteSuccessBody = { success: true, priceHT: input.priceHT };
  if (input.costs !== undefined) body.costs = input.costs;
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
