import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleAccessManagementRequest } from '../../../src/modules/access-management/infrastructure/http/access-management-handler.ts';
import { createAccessManagementServices } from '../../../src/server/access-management/services.ts';

const fallbackHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, idempotency-key, if-match, x-request-id',
  'Content-Type': 'application/json',
};

serve(async (request) => {
  const requestId = request.headers.get('X-Request-Id')?.trim() || crypto.randomUUID();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'api.internal_error',
          message: 'The server is not configured.',
          retryable: true,
        },
        requestId,
      }),
      { status: 500, headers: { ...fallbackHeaders, 'X-Request-Id': requestId } },
    );
  }

  const authorization = request.headers.get('Authorization') ?? '';
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return handleAccessManagementRequest(
    request,
    createAccessManagementServices(client),
    { requestId },
  );
});

