import {
  AssistantStreamError,
  type AssistantGateway,
  type AssistantStreamPayload,
  type AssistantStreamRequest,
} from '../../modules/diagnostics/application/assistant-gateway.ts';

export class BrowserApiAssistantGateway implements AssistantGateway {
  constructor(private readonly allowAccessToken: boolean = true) {}

  async send(request: AssistantStreamRequest): Promise<AssistantStreamPayload> {
    try {
      if (!this.allowAccessToken && request.accessToken) {
        throw new AssistantStreamError(
          'protocol',
          'Un transport storefront ne peut pas envoyer de bearer Magrit',
        );
      }
      const clientRequestId = crypto.randomUUID();
      const response = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': clientRequestId,
          ...(request.accessToken ? { Authorization: `Bearer ${request.accessToken}` } : {}),
          ...(request.streaming ? { Accept: 'text/event-stream' } : {}),
        },
        body: JSON.stringify(request.body),
        signal: request.signal,
      });

      if (!response.ok) {
        const billing = await detectAssistantBillingError(response);
        const problem = await assistantHttpProblem(response);
        throw new AssistantStreamError(
          billing ? 'billing' : 'network',
          problem.detail ?? `HTTP error ${response.status}`,
          response.status,
          problem.code ?? undefined,
          problem.requestId ?? response.headers.get('x-request-id') ?? clientRequestId,
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

type AssistantHttpProblem = Readonly<{
  detail: string | null;
  code: string | null;
  requestId: string | null;
}>;

async function assistantHttpProblem(response: Response): Promise<AssistantHttpProblem> {
  try {
    const payload = await response.clone().json() as Record<string, unknown>;
    const detail = typeof payload.detail === 'string' && payload.detail.trim()
      ? payload.detail.trim()
      : typeof payload.title === 'string' && payload.title.trim()
        ? payload.title.trim()
        : null;
    return {
      detail,
      code: typeof payload.code === 'string' && payload.code.trim() ? payload.code.trim() : null,
      requestId: typeof payload.requestId === 'string' && payload.requestId.trim()
        ? payload.requestId.trim()
        : null,
    };
  } catch {
    // Une réponse non JSON conserve le message HTTP générique.
  }
  return { detail: null, code: null, requestId: null };
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
export const browserStorefrontAssistantGateway: AssistantGateway = new BrowserApiAssistantGateway(false);
