import type { z } from 'zod';
import type { ActorContext, Clock, RequestId } from '../../kernel';
import { API_V1_BASE_PATH, healthResponseSchema } from '../../platform/api';
import { ApiHttpError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiRequestContext = Readonly<{
  request: Request;
  requestId: RequestId;
  params: Readonly<Record<string, string>>;
  actor: ActorContext | null;
}>;

export type ApiRouteResult<T> = Readonly<{
  status: number;
  body: T;
  headers?: Readonly<Record<string, string>>;
}>;

export type ApiRoute = Readonly<{
  method: HttpMethod;
  path: string;
  authentication: 'public' | 'required';
  execute(context: ApiRequestContext): Promise<ApiRouteResult<unknown>>;
}>;

export type JsonRouteDefinition<TInput, TOutput> = Readonly<{
  method: HttpMethod;
  path: string;
  authentication: 'public' | 'required';
  inputSchema: z.ZodType<TInput> | null;
  outputSchema: z.ZodType<TOutput>;
  handle(context: ApiRequestContext, input: TInput): Promise<ApiRouteResult<TOutput>>;
}>;

export function defineJsonRoute<TInput, TOutput>(
  definition: JsonRouteDefinition<TInput, TOutput>,
): ApiRoute {
  return Object.freeze({
    method: definition.method,
    path: definition.path,
    authentication: definition.authentication,
    async execute(context) {
      const input = await parseInput(context.request, definition.inputSchema);
      const result = await definition.handle(context, input);
      const parsedOutput = definition.outputSchema.safeParse(result.body);
      if (!parsedOutput.success) {
        throw new Error(`La sortie de ${definition.method} ${definition.path} viole son contrat.`);
      }

      return Object.freeze({
        ...result,
        body: parsedOutput.data,
      });
    },
  });
}

export function createHealthRoute(clock: Clock): ApiRoute {
  return defineJsonRoute({
    method: 'GET',
    path: `${API_V1_BASE_PATH}/health`,
    authentication: 'public',
    inputSchema: null,
    outputSchema: healthResponseSchema,
    async handle() {
      return {
        status: 200,
        body: {
          status: 'ok',
          apiVersion: 'v1',
          timestamp: clock.now().toISOString(),
        },
      };
    },
  });
}

async function parseInput<T>(request: Request, schema: z.ZodType<T> | null): Promise<T> {
  if (schema === null) return undefined as T;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new ApiHttpError({
      type: 'about:blank',
      title: 'Corps JSON invalide',
      status: 400,
      code: 'api.invalid_json',
    });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiHttpError({
      type: 'about:blank',
      title: 'Requête invalide',
      status: 422,
      code: 'api.validation_failed',
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}
