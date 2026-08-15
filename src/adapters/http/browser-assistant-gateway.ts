import {
  AssistantStreamError,
  type AssistantGateway,
  type AssistantStreamPayload,
  type AssistantStreamRequest,
} from '../../modules/diagnostics/application/assistant-gateway.ts';

export class BrowserApiAssistantGateway implements AssistantGateway {
  async send(request: AssistantStreamRequest): Promise<AssistantStreamPayload> {
    try {
      const response = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${request.accessToken}`,
          ...(request.streaming ? { Accept: 'text/event-stream' } : {}),
        },
        body: JSON.stringify(request.body),
        signal: request.signal,
      });

      if (!response.ok) {
        const billing = await detectAssistantBillingError(response);
        throw new AssistantStreamError(
          billing ? 'billing' : 'network',
          `HTTP error ${response.status}`,
          response.status,
        );
      }

      if (!request.streaming) return await response.json() as AssistantStreamPayload;
      return readAssistantSseStream(response, request.onDelta ?? (() => {}));
    } catch (error) {
      if (error instanceof AssistantStreamError) throw error;
      if ((error as Error).name === 'AbortError') {
        throw new AssistantStreamError('aborted', 'Stream annule (navigation ou nouvelle requete)');
      }
      throw new AssistantStreamError(
        'network',
        (error as Error).message || 'Erreur reseau assistant',
      );
    }
  }
}

export async function detectAssistantBillingError(response: Response): Promise<boolean> {
  if (response.status === 402) return true;
  if (response.status < 400 || response.status >= 500) return false;
  try {
    const normalized = (await response.clone().text()).toLowerCase();
    return ['billing', 'credit', 'insufficient_quota', 'payment']
      .some((marker) => normalized.includes(marker));
  } catch {
    return false;
  }
}

async function readAssistantSseStream(
  response: Response,
  onDelta: (chunk: string) => void,
): Promise<AssistantStreamPayload> {
  if (!response.body) throw new AssistantStreamError('protocol', 'Réponse streaming sans body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalPayload: AssistantStreamPayload | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator: number;
    while ((separator = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        if (event === 'delta' && typeof parsed.text === 'string') onDelta(parsed.text);
        else if (event === 'done') finalPayload = parsed;
      } catch {
        // Les événements non JSON ne font pas partie du contrat assistant.
      }
    }
  }

  if (!finalPayload) {
    throw new AssistantStreamError('protocol', "Stream termine sans event 'done'");
  }
  return finalPayload;
}

export const browserAssistantGateway: AssistantGateway = new BrowserApiAssistantGateway();
