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
  /**
   * En-tetes supplementaires (ex. `Idempotency-Key`, `If-Match`), exiges par
   * la facade E10 (docs/api/CONVENTIONS.md CA8/CA9). `Authorization` et
   * `Content-Type` restent geres par le client, ne pas les fournir ici.
   */
  headers?: Readonly<Record<string, string>>;
  responseSchema: z.ZodType<T>;
  signal?: AbortSignal;
}>;

/** Reponse enrichie de l `ETag`, necessaire pour un futur PATCH (`If-Match`). */
export type ApiResponseWithEtag<T> = Readonly<{ data: T; etag: string | null }>;

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
    /**
     * En-tetes joints a CHAQUE requete. Sert a porter le contexte d appel que
     * les clients de module n ont pas a connaitre — aujourd hui la selection
     * de l espace de travail (`X-Magrit-Tenant`), exigee par la facade E10.
     */
    private readonly defaultHeaders: Readonly<Record<string, string>> = {},
  ) {
    this.fetchImplementation = fetchImplementation.bind(globalThis);
  }

  /**
   * Derive un client identique, enrichi d en-tetes par defaut.
   *
   * Permet a la surface applicative d attacher le contexte d appel sans que
   * les clients de module (`CustomersApiClient`, ...) aient a le transporter
   * dans chaque methode — ils continuent de ne connaitre que leur ressource.
   */
  withHeaders(headers: Readonly<Record<string, string>>): FetchApiClient {
    return new FetchApiClient(this.baseUrl, this.fetchImplementation, this.accessTokenProvider, {
      ...this.defaultHeaders,
      ...headers,
    });
  }

  async request<T>(request: ApiRequest<T>): Promise<T> {
    const response = await this.send(request);
    return parseResponse(response, request.responseSchema);
  }

  /**
   * Comme `request()`, mais rend aussi l `ETag` de la reponse (en-tete exigee
   * par la facade E10 sur toute ressource modifiable, CA9). Necessaire pour
   * enchainer un PATCH proteg par `If-Match` sans relire la ressource.
   */
  async requestWithEtag<T>(request: ApiRequest<T>): Promise<ApiResponseWithEtag<T>> {
    const response = await this.send(request);
    const data = await parseResponse(response, request.responseSchema);
    return { data, etag: response.headers.get('etag') };
  }

  private async send(request: ApiRequest<unknown>): Promise<Response> {
    assertApiPath(request.path);

    const headers = new Headers({ Accept: 'application/json' });
    if (request.body !== undefined) headers.set('Content-Type', 'application/json');
    // Les en-tetes par defaut d abord : ceux de la requete restent prioritaires.
    for (const [name, value] of Object.entries(this.defaultHeaders)) headers.set(name, value);
    if (request.headers) {
      for (const [name, value] of Object.entries(request.headers)) headers.set(name, value);
    }

    const accessToken = await this.accessTokenProvider?.();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

    return this.fetchImplementation(`${this.baseUrl}${request.path}`, {
      method: request.method ?? 'GET',
      headers,
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
  }

  async requestForm<T>(request: ApiFormRequest<T>): Promise<T> {
    assertApiPath(request.path);
    const headers = new Headers({ Accept: 'application/json' });
    for (const [name, value] of Object.entries(this.defaultHeaders)) headers.set(name, value);
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
