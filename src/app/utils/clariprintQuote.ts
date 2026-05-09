/**
 * Helper réutilisable pour appeler l'edge function clariprint-quote.
 *
 * Utilisé partout où on veut afficher un prix réel calculé par Clariprint
 * (et non une estimation locale). Prise en charge des erreurs réseau,
 * credentials manquants, et mode démo.
 */

import { projectId, publicAnonKey } from '/utils/supabase/info';

export interface ClariprintQuoteResult {
  success: boolean;
  credentialsMissing?: boolean;
  message?: string;
  error?: string;
  priceHT?: number;
  costs?: {
    paper?: number;
    print?: number;
    makeready?: number;
    packaging?: number;
    delivery?: number;
    total?: number;
  };
  delais?: number;
  weight?: number;
  fournisseur?: string;
  processDuration?: number;
  details?: string;
}

const CLARIPRINT_ENDPOINT = `https://${projectId}.supabase.co/functions/v1/make-server-e3db71a4/clariprint-quote`;

/**
 * Appelle Clariprint avec une config produit (format Clariprint JSON API).
 * Retourne systématiquement un ClariprintQuoteResult, même en cas d'erreur
 * réseau (success: false, error renseigné).
 */
export async function fetchClariprintQuote(
  clariprintData: Record<string, unknown> | null | undefined
): Promise<ClariprintQuoteResult> {
  if (!clariprintData) {
    return { success: false, error: 'Configuration produit absente' };
  }
  try {
    const response = await fetch(CLARIPRINT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ clariprint: clariprintData }),
    });
    const data = (await response.json()) as ClariprintQuoteResult;
    // Sanitization défensive : 2e ligne de défense au cas où le backend
    // n'aurait pas validé (cf. validateClariprintResponse pour la logique).
    return validateClariprintResponse(data);
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Erreur réseau lors de l\'appel à Clariprint',
    };
  }
}

/**
 * Sanitization défensive d'une réponse Clariprint.
 *
 * Filtre les anomalies connues (CONTEXT_Magrit_IA.md §3.5) :
 *  - Prix négatif (-1,2 € observé en prod)
 *  - NaN / valeur non-numérique
 *  - undefined sur priceHT alors que success=true
 *  - costs.total invalide
 *
 * Quand une anomalie est détectée, on retourne success=false avec un message
 * explicite. Le front peut alors retomber sur estimatedPrice (Décision Arnaud
 * 2026-05-09 : option C) sans afficher de prix corrompu à l'utilisateur.
 *
 * Cette fonction est appelée à 2 endroits :
 *  1. Dans l'edge function clariprint-quote (avant retour c.json) → évite la
 *     propagation au front.
 *  2. (Sécurité) Dans fetchClariprintQuote côté client (au cas où le backend
 *     n'aurait pas validé pour une raison quelconque).
 *
 * @param result Résultat brut Clariprint
 * @returns Résultat avec anomalie convertie en success=false
 */
export function validateClariprintResponse(
  result: ClariprintQuoteResult,
): ClariprintQuoteResult {
  if (!result.success) return result; // déjà en erreur, rien à faire

  // Prix HT principal
  const price = result.priceHT;
  if (price == null || typeof price !== 'number' || !Number.isFinite(price)) {
    return {
      success: false,
      error: 'Prix Clariprint invalide (absent, NaN ou non-numérique)',
      details: `priceHT reçu: ${JSON.stringify(price)}`,
    };
  }
  if (price < 0) {
    return {
      success: false,
      error: 'Prix Clariprint invalide (négatif)',
      details: `priceHT reçu: ${price}€ — anomalie connue Clariprint à signaler`,
    };
  }

  // costs.total : si présent, doit être valide ; sinon on le masque
  if (result.costs?.total !== undefined) {
    const total = result.costs.total;
    if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) {
      // On ne fail pas la réponse entière, on masque juste le total invalide
      result = {
        ...result,
        costs: { ...result.costs, total: undefined },
      };
    }
  }

  return result;
}

/**
 * Fingerprint d'une config produit : permet de détecter si le prix calculé
 * est encore valide après une modification (quantité, format, papier, finition).
 * On serialize les champs qui impactent le prix.
 */
export function priceFingerprint(config: any): string {
  if (!config) return '';
  const c = config.clariprintData ?? config;
  return JSON.stringify({
    kind: c.kind,
    quantity: c.quantity ?? config.quantity,
    width: c.width,
    height: c.height,
    front_colors: c.front_colors,
    back_colors: c.back_colors,
    papers: c.papers,
    finishing_front: c.finishing_front,
    finishing_back: c.finishing_back,
    folds: c.folds,
    binding: c.binding,
    pages: c.pages,
  });
}
