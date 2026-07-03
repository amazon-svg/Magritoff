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
  validateClariprintResponse,
  type ClariprintQuoteResult,
} from "../../app/utils/clariprintQuote";
import { projectId, publicAnonKey } from "/utils/supabase/info";

/**
 * Endpoint Clariprint cote serveur (edge function Supabase). Centralise ici
 * apres R3 (enforcement Adapter) — auparavant duplique dans
 * src/app/utils/clariprintQuote.ts.
 */
const CLARIPRINT_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e3db71a4`;
const CLARIPRINT_ENDPOINT = `${CLARIPRINT_BASE}/clariprint-quote`;
const CLARIPRINT_TEST_ENDPOINT = `${CLARIPRINT_BASE}/clariprint-test`;

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

  /**
   * Verifie la connectivite avec Clariprint (endpoint /clariprint-test).
   * Utilise par les panneaux d'admin / diagnostics (DiagnosticPanel).
   * Retourne la reponse brute du healthcheck (pas de sanitization specifique).
   */
  testConnection(): Promise<unknown>;
}

/**
 * Implementation production : appelle l'edge function clariprint-quote
 * (laquelle integre deja la sanitization defensive cote serveur depuis S0.2).
 */
export class ClariprintHttpAdapter implements ClariprintAdapter {
  async computePrice(input: ClariprintQuoteInput): Promise<ClariprintQuoteResult> {
    if (!input.clariprint) {
      throw new ClariprintError(
        "missing_required_product",
        "Configuration produit absente",
      );
    }

    let result: ClariprintQuoteResult;
    try {
      const response = await fetch(CLARIPRINT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ clariprint: input.clariprint }),
      });
      result = (await response.json()) as ClariprintQuoteResult;
    } catch (err) {
      throw new ClariprintError(
        "network",
        `Erreur reseau lors de l'appel Clariprint: ${(err as Error).message}`,
        { cause: err },
      );
    }

    // Sanitization defensive : 2e ligne de defense au cas ou l'edge function
    // n'aurait pas valide (la validation primaire est cote serveur).
    result = validateClariprintResponse(result);
    // (suite ci-dessous : mapping erreur backend → ClariprintError typee)

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

  async testConnection(): Promise<unknown> {
    const response = await fetch(CLARIPRINT_TEST_ENDPOINT, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      },
    });
    return await response.json();
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

  async testConnection(): Promise<unknown> {
    return { ok: true, mock: true };
  }
}

/**
 * Singleton production. Importe ce binding par defaut dans les composants
 * et endpoints qui doivent appeler Clariprint en prod.
 */
export const httpAdapter: ClariprintAdapter = new ClariprintHttpAdapter();

/**
 * Wrapper compatibilite (R3) : appelle `httpAdapter.computePrice` et retourne
 * le format historique `ClariprintQuoteResult` au lieu de throw.
 *
 * Conserve pour les call-sites qui consomment `.success` / `.priceHT`
 * (PortalCatalog, PortalProduct, ProductCard onClick fetchClariprint) et qui
 * n'ont pas besoin de la granularite `ClariprintError.kind`.
 *
 * Pour les nouveaux call-sites, prefere `httpAdapter.computePrice()` direct
 * + gestion `ClariprintError` typee (cf. ProductOverlay pour le pattern
 * reference).
 */
export async function computeClariprintQuoteSafe(
  clariprintData: Record<string, unknown> | null | undefined,
): Promise<ClariprintQuoteResult> {
  if (!clariprintData) {
    return { success: false, error: 'Configuration produit absente' };
  }
  try {
    return await httpAdapter.computePrice({ clariprint: clariprintData });
  } catch (err) {
    if (err instanceof ClariprintError) {
      return {
        success: false,
        error: err.message,
        details: typeof err.details === 'string' ? err.details : undefined,
      };
    }
    return {
      success: false,
      error: (err as Error).message || "Erreur reseau lors de l'appel a Clariprint",
    };
  }
}
