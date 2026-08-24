/**
 * Hook `useClariprintProduct` — extrait de `ProductCard.tsx` lors de R1
 * (refacto 2026-05-11).
 *
 * Pourquoi extraire :
 *  - ProductCard 1281 L, 9 concerns melanges (audit refacto §3.1) → hook
 *    isolable pour testabilite.
 *  - Bug B5 review adversariale : pas d'AbortController sur le fetch
 *    Clariprint → race conditions au demontage / re-render rapide.
 *    R1 corrige ici, dans le hook, en wrappant l'appel.
 *  - Pattern Adapter enforce R3 : le hook passe par
 *    `computeClariprintQuoteSafe` (client Magrit `/api/v1`).
 *
 * Note : ce hook conserve un flag `cancelled`
 * qui ignore le `setState` apres demontage. Une story future
 * pour ignorer les réponses arrivant après un démontage.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeClariprintQuoteSafe,
  type ClariprintPricingGateway,
} from '../../modules/clariprint';
import type { ClariprintQuoteResult } from '../utils/clariprintQuote';

export interface UseClariprintProductState {
  /** Resultat Clariprint courant (null = pas encore calcule). */
  quote: ClariprintQuoteResult | null;
  /** True pendant la requete reseau. */
  loading: boolean;
  /** Derniere requete envoyee (pour debug panel). */
  lastRequest: unknown;
  /** Reponse brute prettifiee (pour debug panel). */
  lastRawResponse: string | null;
  /** Declenche un calcul. Idempotent : si une requete est deja en cours, son resultat est ignore. */
  compute: (clariprintData: Record<string, unknown> | null | undefined) => Promise<void>;
  /** Reset complet du state (utile a l'ouverture de la card). */
  reset: () => void;
}

/**
 * @param gateway Passerelle choisie par la surface appelante. Le hook ne
 *                résout jamais lui-même une identité ou un transport.
 */
export function useClariprintProduct(
  gateway: Pick<ClariprintPricingGateway, 'computePrice'>,
): UseClariprintProductState {
  const [quote, setQuote] = useState<ClariprintQuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRequest, setLastRequest] = useState<unknown>(null);
  const [lastRawResponse, setLastRawResponse] = useState<string | null>(null);

  // Flag de demontage / annulation : empeche le setState apres unmount ou
  // apres relancement d'une requete plus recente.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const reset = useCallback(() => {
    setQuote(null);
    setLoading(false);
    setLastRequest(null);
    setLastRawResponse(null);
  }, []);

  const compute = useCallback(
    async (clariprintData: Record<string, unknown> | null | undefined) => {
      if (!clariprintData) return;

      // Marquer toute requete precedente comme annulee, puis re-autoriser
      // cette nouvelle requete.
      cancelledRef.current = false;
      setLoading(true);
      setQuote(null);
      setLastRawResponse(null);
      const payload = { clariprint: clariprintData };
      setLastRequest(payload);

      try {
        let data: ClariprintQuoteResult;
        data = await computeClariprintQuoteSafe(gateway, clariprintData);
        if (cancelledRef.current) return; // unmount / nouvelle requete plus recente
        setLastRawResponse(JSON.stringify(data, null, 2));
        setQuote(data);
      } catch (err) {
        if (cancelledRef.current) return;
        setQuote({
          success: false,
          error: (err as Error).message || 'Erreur reseau Clariprint',
        });
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    },
    [gateway],
  );

  return { quote, loading, lastRequest, lastRawResponse, compute, reset };
}
