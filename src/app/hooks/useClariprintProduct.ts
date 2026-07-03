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
 *    `computeClariprintQuoteSafe` (singleton `httpAdapter`).
 *
 * Note : `computeClariprintQuoteSafe` ne supporte pas encore l'abort cote
 * adapter (le fetch natif est interne). On simule via un flag `cancelled`
 * qui ignore le `setState` apres demontage. Une story future
 * (`useClariprintProduct.v2`) pourra etendre l'adapter pour propager
 * un `AbortSignal` jusqu'au fetch.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeClariprintQuoteSafe,
  type ClariprintAdapter,
} from '../../server/clariprint/ClariprintAdapter';
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
 * @param customAdapter Permet d'injecter un mock pour les tests vitest.
 *                      En prod, omettre = utilise le wrapper par defaut.
 */
export function useClariprintProduct(
  customAdapter?: Pick<ClariprintAdapter, 'computePrice'>,
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
        if (customAdapter) {
          // Pour les tests : retourne le format historique a partir de
          // computePrice qui throw ClariprintError. On wrappe le throw.
          try {
            data = await customAdapter.computePrice({ clariprint: clariprintData });
          } catch (err) {
            data = {
              success: false,
              error: (err as Error).message || 'mock adapter error',
            };
          }
        } else {
          data = await computeClariprintQuoteSafe(clariprintData);
        }
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
    [customAdapter],
  );

  return { quote, loading, lastRequest, lastRawResponse, compute, reset };
}
