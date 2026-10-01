import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { TRUSTED_CLIENT_IP_HEADER } from '../auth/client-ip.ts';
import { resolveTrustedClientIp } from './proxy-trust.ts';

export type FetchHandler = (request: Request) => Promise<Response>;

export type NodeHttpServerOptions = Readonly<{
  onUnhandledError?: (error: unknown) => void;
  trustedProxyRanges?: readonly string[];
}>;

/**
 * Adapte le transport HTTP Node au contrat Web standard deja utilise par
 * l'API et les Edge Functions. La couche metier ne connait ainsi ni Node, ni
 * Deno, ni un framework HTTP particulier.
 */
export function createNodeHttpServer(
  handler: FetchHandler,
  options: NodeHttpServerOptions = {},
): Server {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const request = toWebRequest(incoming, options.trustedProxyRanges ?? []);
      const response = await handler(request);
      await writeWebResponse(response, outgoing);
    } catch (error) {
      options.onUnhandledError?.(error);
      if (outgoing.headersSent) {
        outgoing.destroy(error instanceof Error ? error : undefined);
        return;
      }
      outgoing.statusCode = 500;
      outgoing.setHeader('content-type', 'application/problem+json; charset=utf-8');
      outgoing.end(JSON.stringify({
        type: 'about:blank',
        title: 'Erreur interne',
        status: 500,
        code: 'api.transport_error',
      }));
    }
  });

  server.headersTimeout = 15_000;
  server.requestTimeout = 120_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

function toWebRequest(incoming: IncomingMessage, trustedProxyRanges: readonly string[]): Request {
  const headers = new Headers();
  for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
    const name = incoming.rawHeaders[index];
    const value = incoming.rawHeaders[index + 1];
    if (name !== undefined && value !== undefined) headers.append(name, value);
  }
  const clientIp = resolveTrustedClientIp(
    incoming.socket.remoteAddress,
    headers.get('x-forwarded-for'),
    trustedProxyRanges,
  );
  headers.delete(TRUSTED_CLIENT_IP_HEADER);
  if (clientIp !== null) headers.set(TRUSTED_CLIENT_IP_HEADER, clientIp);

  const host = headers.get('host') ?? '127.0.0.1';
  const encrypted = 'encrypted' in incoming.socket && incoming.socket.encrypted === true;
  const url = new URL(incoming.url ?? '/', `${encrypted ? 'https' : 'http'}://${host}`);
  const abortController = new AbortController();
  incoming.once('aborted', () => abortController.abort());

  const init: RequestInit & { duplex?: 'half' } = {
    method: incoming.method ?? 'GET',
    headers,
    signal: abortController.signal,
  };
  if (init.method !== 'GET' && init.method !== 'HEAD') {
    init.body = Readable.toWeb(incoming) as BodyInit;
    init.duplex = 'half';
  }

  return new Request(url, init);
}

async function writeWebResponse(response: Response, outgoing: ServerResponse): Promise<void> {
  outgoing.statusCode = response.status;
  if (response.statusText) outgoing.statusMessage = response.statusText;

  const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() !== 'set-cookie') outgoing.setHeader(name, value);
  });
  const cookies = responseHeaders.getSetCookie?.() ?? [];
  if (cookies.length > 0) outgoing.setHeader('set-cookie', cookies);

  if (response.body === null) {
    outgoing.end();
    return;
  }

  const nodeCompatibleBody = response.body as unknown as Parameters<typeof Readable.fromWeb>[0];
  await pipeline(Readable.fromWeb(nodeCompatibleBody), outgoing);
}
