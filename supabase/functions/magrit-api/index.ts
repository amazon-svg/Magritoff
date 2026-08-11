import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseId } from '../../../src/kernel/ids/index.ts';
import { SessionService } from '../../../src/modules/session/application/session-service.ts';
import { SupabaseSessionRepository } from '../../../src/adapters/supabase/session-repository.ts';
import { createApiV1Application } from '../../../src/server/api/composition.ts';
import { createSessionRoutes } from '../../../src/server/api/session-routes.ts';
import { OrdersService } from '../../../src/modules/orders/application/orders-service.ts';
import { SupabaseOrdersRepository } from '../../../src/adapters/supabase/orders-repository.ts';
import { createOrdersRoutes } from '../../../src/server/api/orders-routes.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
  'Access-Control-Allow-Methods': 'GET, PATCH, PUT, OPTIONS',
};

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = request.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !anonKey) return new Response('Configuration serveur absente', { status: 500 });

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const repository = new SupabaseSessionRepository(client);
  const service = new SessionService(repository);
  const ordersService = new OrdersService(new SupabaseOrdersRepository(client));
  const handler = createApiV1Application({
    routes: [...createSessionRoutes(service), ...createOrdersRoutes(ordersService)],
    actorResolver: {
      async resolve() {
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) return null;
        const parsed = parseId<'UserId'>(data.user.id);
        return parsed.ok ? { kind: 'user', userId: parsed.value } : null;
      },
    },
    onUnexpectedError(error, requestId) {
      console.error('[magrit-api]', requestId, error);
    },
  });
  const response = await handler(normalizeApiRequest(request));
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([name, value]) => headers.set(name, value));
  return new Response(response.body, { status: response.status, headers });
}

function normalizeApiRequest(request: Request): Request {
  const url = new URL(request.url);
  const apiPathIndex = url.pathname.indexOf('/api/v1/');
  if (apiPathIndex >= 0) url.pathname = url.pathname.slice(apiPathIndex);
  return new Request(url, request);
}

Deno.serve(handleRequest);
