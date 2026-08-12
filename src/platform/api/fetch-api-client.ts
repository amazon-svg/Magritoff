import type { z } from 'zod';
import {
  API_V1_BASE_PATH,
  apiProblemSchema,
  healthResponseSchema,
  type ApiProblem,
  type HealthResponse,
} from './contracts';

export type AccessTokenProvider = () => Promise<string | null> | string | null;

export type ApiRequest<T> = Readonly<{
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  responseSchema: z.ZodType<T>;
  signal?: AbortSignal;
}>;

export type ApiFormRequest<T> = Readonly<{
  method: 'POST' | 'PUT' | 'PATCH';
  path: string;
  form: FormData;
  responseSchema: z.ZodType<T>;
  signal?: AbortSignal;
}>;

export class ApiClientError extends Error {
  constructor(public readonly problem: ApiProblem) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiClientError';
  }
}

export class FetchApiClient {
  private readonly fetchImplementation: typeof fetch;

  constructor(
    private readonly baseUrl = '',
    fetchImplementation: typeof fetch = globalThis.fetch,
    private readonly accessTokenProvider?: AccessTokenProvider,
  ) {
    this.fetchImplementation = fetchImplementation.bind(globalThis);
  }

  async request<T>(request: ApiRequest<T>): Promise<T> {
    assertApiPath(request.path);

    const headers = new Headers({ Accept: 'application/json' });
    if (request.body !== undefined) headers.set('Content-Type', 'application/json');

    const accessToken = await this.accessTokenProvider?.();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

    const response = await this.fetchImplementation(`${this.baseUrl}${request.path}`, {
      method: request.method ?? 'GET',
      headers,
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });

    return parseResponse(response, request.responseSchema);
  }

  async requestForm<T>(request: ApiFormRequest<T>): Promise<T> {
    assertApiPath(request.path);
    const headers = new Headers({ Accept: 'application/json' });
    const accessToken = await this.accessTokenProvider?.();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

    const response = await this.fetchImplementation(`${this.baseUrl}${request.path}`, {
      method: request.method,
      headers,
      body: request.form,
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });

    return parseResponse(response, request.responseSchema);
  }
}

function assertApiPath(path: string): void {
  if (!path.startsWith(`${API_V1_BASE_PATH}/`)) {
    throw new TypeError(`Une route API Magrit doit commencer par ${API_V1_BASE_PATH}/.`);
  }
}

async function parseResponse<T>(response: Response, responseSchema: z.ZodType<T>): Promise<T> {
  const payload = await readJson(response);
  if (!response.ok) {
    const parsedProblem = apiProblemSchema.safeParse(payload);
    if (parsedProblem.success) throw new ApiClientError(parsedProblem.data);

    throw new ApiClientError({
      type: 'about:blank',
      title: 'Erreur API Magrit',
      status: response.status,
      code: 'api.invalid_error_response',
      detail: `La réponse d erreur ne respecte pas le contrat API.`,
      requestId: response.headers.get('x-request-id') ?? 'unknown',
    });
  }

  const parsedResponse = responseSchema.safeParse(payload);
  if (!parsedResponse.success) {
    throw new ApiClientError({
      type: 'about:blank',
      title: 'Réponse API invalide',
      status: 502,
      code: 'api.invalid_success_response',
      detail: 'La réponse reçue ne respecte pas le contrat attendu.',
      requestId: response.headers.get('x-request-id') ?? 'unknown',
    });
  }

  return parsedResponse.data;
}

export class SystemApiClient {
  constructor(private readonly client: FetchApiClient) {}

  health(signal?: AbortSignal): Promise<HealthResponse> {
    return this.client.request({
      path: `${API_V1_BASE_PATH}/health`,
      responseSchema: healthResponseSchema,
      ...(signal === undefined ? {} : { signal }),
    });
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
