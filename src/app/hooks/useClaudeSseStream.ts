/**
 * Hook `useClaudeSseStream` — extrait de ChatInterface.tsx lors de R2 Phase A.
 *
 * Resout :
 *  - Bug review §1.3 E5 : troncage 25 messages au-dela (NFR43
 *    project-context §3.4) directement integre au sender.
 *  - Bug review §1.3 edge case 1.2 : AbortController associe au stream,
 *    le composant peut annuler proprement (navigation, demontage).
 *
 * Note R3 : a terme, ce hook devrait passer par un `ClaudeAdapter`
 * (pattern Adapter comme R3 pour Clariprint). Pour R2 on garde le fetch
 * direct vers les edge functions (R3 ne couvre que Clariprint).
 */

import { useCallback, useEffect, useRef } from 'react';

/** Limite de messages conservee dans le contexte envoye au LLM. */
export const MAX_CONTEXT_MESSAGES = 25;

export interface SseStreamConfig {
  endpoint: string;
  authToken: string;
  body: unknown;
  onDelta?: (chunk: string) => void;
}

export type SseStreamPayload = Record<string, unknown> & {
  /** Hint backend : Anthropic a renvoye une erreur de facturation (402, billing). */
  billingError?: boolean;
  demoMode?: boolean;
};

/**
 * Tronque une liste de messages a `MAX_CONTEXT_MESSAGES` en gardant les plus
 * recents. Retourne le nb de messages tronques (>0 si troncage effectif).
 */
export function truncateMessages<T>(
  messages: T[],
  max: number = MAX_CONTEXT_MESSAGES,
): { truncated: T[]; droppedCount: number } {
  if (messages.length <= max) {
    return { truncated: messages, droppedCount: 0 };
  }
  const droppedCount = messages.length - max;
  return { truncated: messages.slice(droppedCount), droppedCount };
}

/**
 * Detecte une erreur de facturation Anthropic depuis une Response HTTP.
 * Verifie le code (402) ou le body (mots-cles "billing" / "credit" / "quota").
 */
export async function detectBillingError(
  response: Response,
): Promise<boolean> {
  if (response.status === 402) return true;
  if (response.status >= 400 && response.status < 500) {
    try {
      const text = await response.clone().text();
      const lower = text.toLowerCase();
      return (
        lower.includes('billing') ||
        lower.includes('credit') ||
        lower.includes('insufficient_quota') ||
        lower.includes('payment')
      );
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Lit un flux SSE Claude (events `delta` + `done`) et retourne le payload final.
 *
 * Inchange vs ChatInterface.tsx legacy. Le AbortController est gere par le hook
 * appelant (cf. `useClaudeSseStream`).
 */
async function readClaudeSseStream(
  resp: Response,
  onDelta: (chunk: string) => void,
): Promise<SseStreamPayload> {
  if (!resp.body) throw new Error("Pas de body sur la response streaming");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalPayload: SseStreamPayload | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        if (event === 'delta' && typeof parsed.text === 'string') {
          onDelta(parsed.text);
        } else if (event === 'done') {
          finalPayload = parsed;
        }
      } catch {
        // ignore les payloads non JSON
      }
    }
  }
  if (!finalPayload) {
    throw new Error("Stream termine sans event 'done'");
  }
  return finalPayload;
}

/**
 * Erreur typee remontee par `useClaudeSseStream` pour discriminer billing
 * (E4) vs autre erreur reseau / serveur.
 */
export class ClaudeSseStreamError extends Error {
  constructor(
    public readonly kind: 'billing' | 'network' | 'aborted' | 'protocol',
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ClaudeSseStreamError';
  }
}

export function useClaudeSseStream() {
  const abortRef = useRef<AbortController | null>(null);

  // Annule tout stream en cours au demontage (fix edge case review §1.3 1.2).
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const send = useCallback(
    async (
      config: SseStreamConfig,
      streaming: boolean = true,
    ): Promise<SseStreamPayload> => {
      // Annule tout stream precedent si encore en cours
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.authToken}`,
            ...(streaming ? { Accept: 'text/event-stream' } : {}),
          },
          body: JSON.stringify(config.body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const isBilling = await detectBillingError(response);
          throw new ClaudeSseStreamError(
            isBilling ? 'billing' : 'network',
            `HTTP error ${response.status}`,
            response.status,
          );
        }

        if (streaming) {
          return await readClaudeSseStream(response, config.onDelta ?? (() => {}));
        }
        return (await response.json()) as SseStreamPayload;
      } catch (err) {
        if (err instanceof ClaudeSseStreamError) throw err;
        if ((err as Error).name === 'AbortError') {
          throw new ClaudeSseStreamError('aborted', 'Stream annule (navigation ou nouvelle requete)');
        }
        throw new ClaudeSseStreamError(
          'network',
          (err as Error).message || 'Erreur reseau Claude',
        );
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [],
  );

  return { send, abort };
}
