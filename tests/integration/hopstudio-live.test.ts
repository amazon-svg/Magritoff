import { existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { beforeAll, describe, expect, it } from 'vitest';
import { HttpHopeStudioChatGateway } from '@/adapters/hopstudio/http-hopstudio-chat-gateway';
import type { HopeStudioChatResult } from '@/modules/hopstudio/api/contracts';

const CONFIG_PATH = '.env.hopstudio.test.local';

if (existsSync(CONFIG_PATH)) {
  loadEnv({ path: CONFIG_PATH, override: false, quiet: true });
}

const liveTestsEnabled = process.env.HOPSTUDIO_LIVE_TEST === '1';
const continuationEnabled = process.env.HOPSTUDIO_TEST_CONTINUATION === '1';
const traceEnabled = process.env.HOPSTUDIO_TEST_TRACE === '1';

describe.skipIf(!liveTestsEnabled)('HopeStudio — connexion réelle', () => {
  let gateway: HttpHopeStudioChatGateway;
  let firstResult: HopeStudioChatResult;
  let tenantId: string;
  let userId: string;

  beforeAll(() => {
    if (!existsSync(CONFIG_PATH)) {
      throw new Error(
        `Configuration absente. Copiez .env.hopstudio.test.example vers ${CONFIG_PATH}.`,
      );
    }

    const hopeStudioUrl = requiredEnv('HOPSTUDIO_TEST_URL');
    tenantId = requiredEnv('HOPSTUDIO_TEST_TENANT_ID');
    userId = requiredEnv('HOPSTUDIO_TEST_USER_ID');

    const clariprintUser = optionalEnv('HOPSTUDIO_TEST_CLARIPRINT_USER');
    const clariprintPassword = optionalEnv('HOPSTUDIO_TEST_CLARIPRINT_PASS');
    if ((clariprintUser === null) !== (clariprintPassword === null)) {
      throw new Error(
        'HOPSTUDIO_TEST_CLARIPRINT_USER et HOPSTUDIO_TEST_CLARIPRINT_PASS doivent être fournis ensemble, ou laissés vides ensemble.',
      );
    }

    gateway = new HttpHopeStudioChatGateway(
      {
        hopeStudioUrl,
        apiToken: optionalEnv('HOPSTUDIO_TEST_API_TOKEN'),
        ...(clariprintUser && clariprintPassword ? {
          clariprint: {
            user: clariprintUser,
            password: clariprintPassword,
            url: optionalEnv('HOPSTUDIO_TEST_CLARIPRINT_URL') ?? undefined,
          },
        } : {}),
      },
      null,
      undefined,
      traceEnabled ? createTracingFetch() : globalThis.fetch,
    );
  });

  it('appelle CallAI et valide le contrat utilisé par Magrit', async () => {
    firstResult = await gateway.chat({
      messages: [{
        role: 'user',
        content: optionalEnv('HOPSTUDIO_TEST_PROMPT')
          ?? 'Je veux 500 dépliants 2 volets A4 quadri recto verso sur papier couché demi-mat 170g',
      }],
      tenantId,
      userId,
      signal: AbortSignal.timeout(60_000),
    });

    expect(firstResult).toMatchObject({
      success: true,
      provider: 'hopstudio',
      demoMode: false,
    });
    expect(Array.isArray(firstResult.configs)).toBe(true);
  }, 70_000);

  it.skipIf(!continuationEnabled)(
    'réutilise session_id et DBK lors du message suivant',
    async () => {
      expect(firstResult.sessionRef, 'HopeStudio doit retourner un identifiant de session').toBeTruthy();
      expect(firstResult.sessionDataRef, 'HopeStudio doit retourner une référence DBK').toBeTruthy();

      const continuation = await gateway.chat({
        messages: [{ role: 'user', content: 'Et pour 1000 exemplaires ?' }],
        tenantId,
        userId,
        sessionRef: firstResult.sessionRef,
        sessionDataRef: firstResult.sessionDataRef,
        signal: AbortSignal.timeout(60_000),
      });

      expect(continuation).toMatchObject({
        success: true,
        provider: 'hopstudio',
      });
      expect(continuation.sessionRef).toBeTruthy();
    },
    70_000,
  );
});

function requiredEnv(name: string): string {
  const value = optionalEnv(name);
  if (value === null) throw new Error(`${name} est requis dans ${CONFIG_PATH}.`);
  return value;
}

function optionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function createTracingFetch(fetchImplementation: typeof fetch = globalThis.fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestHeaders = new Headers(init?.headers);
    const requestBody = decodeFormBody(init?.body);

    console.log('\n[HopeStudio trace] REQUÊTE');
    console.log(JSON.stringify({
      url: input instanceof Request ? input.url : String(input),
      method: init?.method ?? (input instanceof Request ? input.method : 'GET'),
      headers: redactHeaders(requestHeaders),
      body: requestBody,
    }, null, 2));

    const response = await fetchImplementation(input, init);
    const responseText = await response.clone().text();

    console.log('[HopeStudio trace] RÉPONSE');
    console.log(JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      body: parseJsonOrText(responseText),
    }, null, 2));

    return response;
  }) as typeof fetch;
}

function decodeFormBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string') return body ? '[corps binaire non affiché]' : null;

  const form = new URLSearchParams(body);
  const decoded = Object.fromEntries(form.entries()) as Record<string, unknown>;
  if (typeof decoded.parameters_value === 'string') {
    decoded.parameters_value = parseJsonOrText(decoded.parameters_value);
  }
  return decoded;
}

function redactHeaders(headers: Headers): Record<string, string> {
  const sensitiveHeaders = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'x-clariprint-user',
    'x-clariprint-pass',
  ]);

  return Object.fromEntries([...headers.entries()].map(([name, value]) => [
    name,
    sensitiveHeaders.has(name.toLowerCase()) ? '[MASQUÉ]' : value,
  ]));
}

function parseJsonOrText(value: string): unknown {
  if (!value) return '';
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
