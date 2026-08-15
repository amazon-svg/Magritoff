import { useCallback, useEffect, useRef } from 'react';
import {
  AssistantStreamError,
  type AssistantStreamPayload,
} from '../../modules/diagnostics';
import { useBrowserServices } from '../contexts/BrowserServicesContext';

export { AssistantStreamError as ClaudeSseStreamError };

/** Limite NFR43 du contexte transmis au fournisseur IA. */
export const MAX_CONTEXT_MESSAGES = 25;

export interface SseStreamConfig {
  authToken: string;
  body: unknown;
  onDelta?: (chunk: string) => void;
}

export type SseStreamPayload = AssistantStreamPayload;

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
 * Cycle de vie React d'un envoi assistant.
 *
 * Le protocole HTTP/SSE, son endpoint et la classification des erreurs sont
 * volontairement confinés dans AssistantGateway.
 */
export function useClaudeSseStream() {
  const { assistant } = useBrowserServices();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const send = useCallback(
    async (
      config: SseStreamConfig,
      streaming: boolean = true,
    ): Promise<SseStreamPayload> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        return await assistant.send({
          accessToken: config.authToken,
          streaming,
          body: config.body,
          signal: controller.signal,
          ...(config.onDelta ? { onDelta: config.onDelta } : {}),
        });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [assistant],
  );

  return { send, abort };
}
