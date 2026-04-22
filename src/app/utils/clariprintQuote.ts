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
    return data;
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Erreur réseau lors de l\'appel à Clariprint',
    };
  }
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
