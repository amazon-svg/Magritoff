/**
 * ClariprintAdapter — interface unique d'acces au moteur de prix Clariprint.
 *
 * Story S1.2 (Epic 1 — Stack Foundations, PRD v1.1, 2026-05-09).
 *
 * Etend le travail S0.2 (validateClariprintResponse + sanitization endpoint)
 * en formalisant un pattern Adapter avec erreurs typees, permettant :
 *   - Mocking facile en tests vitest (ClariprintMockAdapter).
 *   - Evolution de l'API Clariprint sans casser Magrit (couche d'abstraction).
 *   - Gestion d'erreur typee discriminee par `kind` pour fallback metier.
 *
 * Utilisation :
 *   import { httpAdapter } from "../server/clariprint/ClariprintAdapter";
 *   try {
 *     const quote = await httpAdapter.computePrice(input);
 *     // quote.priceHT validee, sanitizee
 *   } catch (e) {
 *     if (e instanceof ClariprintError) {
 *       switch (e.kind) {
 *         case "negative_price": case "nan_price": case "undefined_field":
 *           // fallback estime + badge "Estimation" (Decision Arnaud 2026-05-09 = C)
 *           break;
 *         case "missing_required_product":
 *           // alerter user
 *           break;
 *         case "network": case "timeout":
 *           // retry avec backoff
 *           break;
 *       }
 *     }
 *   }
 *
 * Note : la sanitization elle-meme reste implementee dans
 * src/app/utils/clariprintQuote.ts (validateClariprintResponse) pour
 * compatibilite avec les call-sites existants. L'adapter delegue a cette
 * fonction pour garantir UN SEUL ENDROIT de validation (DRY).
 */

import {
  fetchClariprintQuote as legacyFetch,
  validateClariprintResponse,
  type ClariprintQuoteResult,
} from "../../app/utils/clariprintQuote";

/**
 * Erreur Clariprint typee, discriminee par `kind`.
 *
 * Cohorte alignee sur PRD v1.1 § Domain Requirements / Risk Mitigations.
 */
export class ClariprintError extends Error {
  constructor(
    public readonly kind:
      | "negative_price"        // Prix negatif (-1,2 EUR observe)
      | "nan_price"             // NaN dans priceHT
      | "undefined_field"       // priceHT absent alors que success=true
      | "missing_required_product" // Produit legalement requis manquant
      | "network"               // Erreur reseau / timeout
      | "timeout"               // Specifique timeout
      | "unauthenticated"       // Credentials Clariprint manquants/invalides
      | "unknown",
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ClariprintError";
  }
}

export interface ClariprintQuoteInput {
  /** Config produit au format Clariprint JSON API. */
  clariprint: Record<string, unknown>;
}

/**
 * Interface canonique. Toute interaction avec Clariprint depuis Magrit
 * doit passer par une implementation de cette interface (jamais de fetch
 * direct ailleurs dans le code).
 */
export interface ClariprintAdapter {
  /**
   * Calcule un prix pour une config produit. Retourne un quote sanitize
   * (validateClariprintResponse appliquee) ou throw ClariprintError typee.
   */
  computePrice(input: ClariprintQuoteInput): Promise<ClariprintQuoteResult>;
}

/**
 * Implementation production : appelle l'edge function clariprint-quote
 * (laquelle integre deja la sanitization defensive cote serveur depuis S0.2).
 */
export class ClariprintHttpAdapter implements ClariprintAdapter {
  async computePrice(input: ClariprintQuoteInput): Promise<ClariprintQuoteResult> {
    let result: ClariprintQuoteResult;
    try {
      result = await legacyFetch(input.clariprint);
    } catch (err) {
      throw new ClariprintError(
        "network",
        `Erreur reseau lors de l'appel Clariprint: ${(err as Error).message}`,
        { cause: err },
      );
    }

    // Re-validation defensive (legacyFetch valide deja, ceinture+bretelles)
    result = validateClariprintResponse(result);

    if (!result.success) {
      // Mapper le message d'erreur backend vers un kind typee
      const errMsg = (result.error ?? "").toLowerCase();
      let kind: ClariprintError["kind"] = "unknown";
      if (errMsg.includes("negatif") || errMsg.includes("negative") || errMsg.includes("négatif")) {
        kind = "negative_price";
      } else if (errMsg.includes("nan") || errMsg.includes("non-numerique") || errMsg.includes("non-numérique")) {
        kind = "nan_price";
      } else if (errMsg.includes("absent") || errMsg.includes("undefined") || errMsg.includes("missing")) {
        kind = "undefined_field";
      } else if (result.credentialsMissing) {
        kind = "unauthenticated";
      }
      throw new ClariprintError(
        kind,
        result.error ?? "Erreur Clariprint inconnue",
        { details: result.details, raw: result },
      );
    }

    return result;
  }
}

/**
 * Implementation tests : retourne des reponses programmees (pas de reseau).
 * Permet de simuler les anomalies (prix negatif, undefined, etc.) sans
 * appeler la vraie API Clariprint.
 *
 * Usage en tests vitest :
 *   const mock = new ClariprintMockAdapter();
 *   mock.setNextResponse({ success: true, priceHT: 12.5 });
 *   await mock.computePrice({ clariprint: { ... } }); // OK
 *   mock.setNextResponse({ success: true, priceHT: -1.2 }); // anomalie
 *   await expect(mock.computePrice(...)).rejects.toThrow(ClariprintError);
 */
export class ClariprintMockAdapter implements ClariprintAdapter {
  private nextResponses: ClariprintQuoteResult[] = [];

  setNextResponse(result: ClariprintQuoteResult): void {
    this.nextResponses.push(result);
  }

  reset(): void {
    this.nextResponses = [];
  }

  async computePrice(_input: ClariprintQuoteInput): Promise<ClariprintQuoteResult> {
    if (this.nextResponses.length === 0) {
      throw new ClariprintError(
        "unknown",
        "ClariprintMockAdapter: aucune reponse programmee (utiliser setNextResponse())",
      );
    }
    const response = this.nextResponses.shift()!;
    const validated = validateClariprintResponse(response);
    if (!validated.success) {
      const errMsg = (validated.error ?? "").toLowerCase();
      let kind: ClariprintError["kind"] = "unknown";
      if (errMsg.includes("negatif") || errMsg.includes("négatif")) kind = "negative_price";
      else if (errMsg.includes("nan") || errMsg.includes("non-numérique")) kind = "nan_price";
      else if (errMsg.includes("absent")) kind = "undefined_field";
      throw new ClariprintError(kind, validated.error ?? "Mock anomaly", validated);
    }
    return validated;
  }
}

/**
 * Singleton production. Importe ce binding par defaut dans les composants
 * et endpoints qui doivent appeler Clariprint en prod.
 */
export const httpAdapter: ClariprintAdapter = new ClariprintHttpAdapter();
