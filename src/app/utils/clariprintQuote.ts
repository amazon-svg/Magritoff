/**
 * Utilitaires purs autour des reponses Clariprint.
 *
 * R3 (refacto 2026-05-11) : ce module ne fait plus de fetch direct vers
 * l'edge function `clariprint-quote`. Tout appel reseau passe maintenant
 * par `ClariprintHttpAdapter` (cf. `src/server/clariprint/ClariprintAdapter.ts`)
 * conformement a l'ADR architecture.md §4.4.
 *
 * Ne sont conserves ici que les utilitaires purs (sans I/O) :
 *  - `ClariprintQuoteResult` : type du payload Clariprint.
 *  - `validateClariprintResponse` : sanitization defensive (prix negatifs / NaN
 *    / undefined → success=false). Appele par l'edge function ET par
 *    `ClariprintHttpAdapter` (ceinture+bretelles).
 *  - `priceFingerprint` : detection de staleness sur la config.
 *
 * Le wrapper de compatibilite `computeClariprintQuoteSafe()` qui retourne le
 * format historique `ClariprintQuoteResult` (au lieu de throw) est expose
 * depuis `ClariprintAdapter.ts` pour eviter une dependance circulaire.
 */

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
 *  2. (Sécurité) Dans `ClariprintHttpAdapter.computePrice` côté client (au cas
 *     où le backend n'aurait pas validé pour une raison quelconque).
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
