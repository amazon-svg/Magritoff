import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseId } from '../../../src/kernel/ids/index.ts';
import { SessionService } from '../../../src/modules/session/application/session-service.ts';
import { SupabaseSessionRepository } from '../../../src/adapters/supabase/session-repository.ts';
import { createApiV1Application } from '../../../src/server/api/composition.ts';
import { createSessionRoutes } from '../../../src/server/api/session-routes.ts';
import { OrdersService } from '../../../src/modules/orders/application/orders-service.ts';
import { SupabaseOrdersRepository } from '../../../src/adapters/supabase/orders-repository.ts';
import { createOrdersRoutes } from '../../../src/server/api/orders-routes.ts';
import { InvitationsService } from '../../../src/modules/invitations/application/invitations-service.ts';
import { SupabaseInvitationsRepository } from '../../../src/adapters/supabase/invitations-repository.ts';
import { createInvitationsRoutes } from '../../../src/server/api/invitations-routes.ts';
import { MembersService } from '../../../src/modules/members/application/members-service.ts';
import { SupabaseMembersRepository } from '../../../src/adapters/supabase/members-repository.ts';
import { createMembersRoutes } from '../../../src/server/api/members-routes.ts';
import { ResendInvitationEmailSender } from '../../../src/adapters/resend/invitation-email-sender.ts';
import { RolesService } from '../../../src/modules/roles/application/roles-service.ts';
import { SupabaseRolesRepository } from '../../../src/adapters/supabase/roles-repository.ts';
import { createRolesRoutes } from '../../../src/server/api/roles-routes.ts';
import { ShopsService } from '../../../src/modules/shops/application/shops-service.ts';
import { SupabaseShopsRepository } from '../../../src/adapters/supabase/shops-repository.ts';
import { createShopsRoutes } from '../../../src/server/api/shops-routes.ts';
import { CatalogService } from '../../../src/modules/catalog/application/catalog-service.ts';
import { SupabaseCatalogAutomationGateway, SupabaseCatalogRepository } from '../../../src/adapters/supabase/catalog-repository.ts';
import { createCatalogRoutes } from '../../../src/server/api/catalog-routes.ts';
import { ConversationsService } from '../../../src/modules/conversations/application/conversations-service.ts';
import { SupabaseConversationsRepository } from '../../../src/adapters/supabase/conversations-repository.ts';
import { createConversationsRoutes } from '../../../src/server/api/conversations-routes.ts';
import { DiagnosticsService } from '../../../src/modules/diagnostics/application/diagnostics-service.ts';
import { ConfiguredAiDiagnosticsGateway, aiProviderConfigurationFromEnvironment } from '../../../src/adapters/ai/configured-ai-diagnostics-gateway.ts';
import { createDiagnosticsRoutes } from '../../../src/server/api/diagnostics-routes.ts';
import { HttpClariprintDiagnosticsGateway } from '../../../src/adapters/clariprint/clariprint-diagnostics-gateway.ts';
import { QuotesService } from '../../../src/modules/quotes/application/quotes-service.ts';
import { SupabaseQuotesRepository } from '../../../src/adapters/supabase/quotes-repository.ts';
import { createQuotesRoutes } from '../../../src/server/api/quotes-routes.ts';
import { QuoteTemplatesService } from '../../../src/modules/quote-templates/application/quote-templates-service.ts';
import { SupabaseQuoteTemplatesRepository } from '../../../src/adapters/supabase/quote-templates-repository.ts';
import { createQuoteTemplatesRoutes } from '../../../src/server/api/quote-templates-routes.ts';
import { LibrariesService } from '../../../src/modules/libraries/application/libraries-service.ts';
import { SupabaseLibrariesRepository } from '../../../src/adapters/supabase/libraries-repository.ts';
import { createLibrariesRoutes } from '../../../src/server/api/libraries-routes.ts';
import { LibraryProductsService } from '../../../src/modules/libraries/application/library-products-service.ts';
import { SupabaseLibraryProductsRepository } from '../../../src/adapters/supabase/library-products-repository.ts';
import { createLibraryProductsRoutes } from '../../../src/server/api/library-products-routes.ts';
import { CommercialService } from '../../../src/modules/commercial/application/commercial-service.ts';
import { SupabaseCommercialRepository } from '../../../src/adapters/supabase/commercial-repository.ts';
import { createCommercialRoutes } from '../../../src/server/api/commercial-routes.ts';
import { AssistantService } from '../../../src/modules/diagnostics/application/assistant-service.ts';
import { ConfiguredAiCompletionGateway } from '../../../src/adapters/ai/configured-ai-completion-gateway.ts';
import { createAssistantRoutes } from '../../../src/server/api/assistant-routes.ts';
import { SupabaseAssistantAccessGateway } from '../../../src/adapters/supabase/assistant-access-gateway.ts';
import { ClariprintService } from '../../../src/modules/clariprint/application/clariprint-service.ts';
import { HttpClariprintQuoteGateway } from '../../../src/adapters/clariprint/http-clariprint-quote-gateway.ts';
import { createClariprintRoutes } from '../../../src/server/api/clariprint-routes.ts';
import { isMockupBinaryRequest, proxyMockupBinary } from '../../../src/adapters/supabase/mockup-binary-proxy.ts';
import { isAssistantChatRequest, proxyAssistantChat } from '../../../src/server/api/assistant-stream-proxy.ts';
import { ShopCustomersService } from '../../../src/modules/shop-customers/application/shop-customers-service.ts';
import { SupabaseShopCustomersRepository } from '../../../src/adapters/supabase/shop-customers-repository.ts';
import { createShopCustomersRoutes } from '../../../src/server/api/shop-customers-routes.ts';
import { StorefrontAuthenticationService } from '../../../src/modules/shop-customers/application/storefront-authentication-service.ts';
import { StorefrontRegistrationService } from '../../../src/modules/shop-customers/application/storefront-registration-service.ts';
import { StorefrontSessionService } from '../../../src/modules/shop-customers/application/storefront-session-service.ts';
import { SupabaseStorefrontAuthenticationGateway } from '../../../src/adapters/supabase/storefront-authentication-gateway.ts';
import { createStorefrontSessionRoutes } from '../../../src/server/api/storefront-session-routes.ts';
import { readStorefrontSessionCookie, storefrontSessionCookiePolicy } from '../../../src/server/storefront/session-cookie.ts';
import { StorefrontActivationService } from '../../../src/modules/shop-customers/application/storefront-activation-service.ts';
import { SupabaseStorefrontActivationGateway } from '../../../src/adapters/supabase/storefront-activation-gateway.ts';
import { createStorefrontActivationRoutes } from '../../../src/server/api/storefront-activation-routes.ts';
import { ResendStorefrontActivationEmailSender } from '../../../src/adapters/resend/storefront-activation-email-sender.ts';
import { ShopCustomerDelegationService } from '../../../src/modules/shop-customers/application/shop-customer-delegation-service.ts';
import { SupabaseShopCustomerDelegationGateway } from '../../../src/adapters/supabase/shop-customer-delegation-gateway.ts';
import { createShopCustomerDelegationRoutes } from '../../../src/server/api/shop-customer-delegation-routes.ts';
import { StorefrontPasswordRecoveryService } from '../../../src/modules/shop-customers/application/storefront-password-recovery-service.ts';
import { SupabaseStorefrontPasswordRecoveryGateway } from '../../../src/adapters/supabase/storefront-password-recovery-gateway.ts';
import { ResendStorefrontPasswordRecoveryEmailSender } from '../../../src/adapters/resend/storefront-password-recovery-email-sender.ts';
import { createStorefrontPasswordRecoveryRoutes } from '../../../src/server/api/storefront-password-recovery-routes.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
};

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = request.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !anonKey) return new Response('Configuration serveur absente', { status: 500 });

  if (isMockupBinaryRequest(request)) return withCors(await proxyMockupBinary(request, supabaseUrl, anonKey));

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  // Une session storefront est portée par son cookie opaque, jamais par le JWT
  // Magrit éventuellement encore présent dans le navigateur. Utiliser un client
  // sans ce JWT garantit que les primitives storefront restent exécutées sous
  // le rôle `anon`, y compris pendant une délégation depuis le back-office.
  const storefrontClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storefrontCookiePolicy = storefrontSessionCookiePolicy(new URL(request.url).protocol === 'https:');
  const storefrontGateway = new SupabaseStorefrontAuthenticationGateway(storefrontClient);
  const storefrontSessionService = new StorefrontSessionService(storefrontGateway);
  if (isAssistantChatRequest(request)) {
    if (authorization) {
      const { data, error } = await client.auth.getUser();
      if (!error && data.user) {
        const actorId = parseId<'UserId'>(data.user.id);
        if (!actorId.ok) return withCors(Response.json({ type: 'about:blank', title: 'Identité invalide', status: 401, code: 'identity.invalid_user', requestId: crypto.randomUUID() }, { status: 401, headers: { 'Content-Type': 'application/problem+json; charset=utf-8' } }));
        const accessGateway = new SupabaseAssistantAccessGateway(client);
        return withCors(await proxyAssistantChat(request, {
          legacyBaseUrl: `${supabaseUrl}/functions/v1/make-server-e3db71a4`,
          authorization,
          userId: data.user.id,
          authorizeTenant: (tenantId) => accessGateway.isTenantMember(actorId.value, tenantId),
        }));
      }
    }

    const opaqueToken = readStorefrontSessionCookie(request.headers.get('cookie'), storefrontCookiePolicy);
    const storefrontSession = opaqueToken ? await storefrontSessionService.current(opaqueToken) : null;
    if (!storefrontSession) return withCors(Response.json({ type: 'about:blank', title: 'Session boutique requise', status: 401, code: 'storefront.session_required', requestId: crypto.randomUUID() }, { status: 401, headers: { 'Content-Type': 'application/problem+json; charset=utf-8' } }));
    const storefrontShops = new SupabaseShopsRepository(storefrontClient, publicSupabaseUrl(request, supabaseUrl));
    return withCors(await proxyAssistantChat(request, {
      legacyBaseUrl: `${supabaseUrl}/functions/v1/make-server-e3db71a4`,
      authorization: `Bearer ${anonKey}`,
      authorizeShop: async (shopSlug) => {
        try {
          const probe = await storefrontShops.publicProbe(shopSlug);
          if (probe.id !== storefrontSession.identity.shopId) return null;
          return {
            userId: storefrontSession.identity.shopCustomerAccountId,
            tenantId: probe.tenantId,
          };
        } catch {
          return null;
        }
      },
    }));
  }
  const repository = new SupabaseSessionRepository(client);
  const service = new SessionService(repository);
  const ordersService = new OrdersService(new SupabaseOrdersRepository(client));
  const invitationEmailSender = new ResendInvitationEmailSender(
    Deno.env.get('RESEND_API_KEY') ?? null,
    Deno.env.get('MAGRIT_FROM_EMAIL') ?? 'Magrit <onboarding@resend.dev>',
  );
  const invitationsService = new InvitationsService(new SupabaseInvitationsRepository(client, invitationEmailSender));
  const membersService = new MembersService(new SupabaseMembersRepository(client));
  const rolesService = new RolesService(new SupabaseRolesRepository(client));
  const shopsService = new ShopsService(new SupabaseShopsRepository(client, publicSupabaseUrl(request, supabaseUrl)));
  const shopCustomersService = new ShopCustomersService(new SupabaseShopCustomersRepository(client));
  const storefrontAuthenticationService = new StorefrontAuthenticationService(storefrontGateway);
  const storefrontRegistrationService = new StorefrontRegistrationService(storefrontGateway);
  const storefrontActivationService = new StorefrontActivationService(
    new SupabaseStorefrontActivationGateway(client),
    new ResendStorefrontActivationEmailSender(
      Deno.env.get('RESEND_API_KEY') ?? null,
      Deno.env.get('MAGRIT_FROM_EMAIL') ?? 'Magrit <onboarding@resend.dev>',
    ),
  );
  const shopCustomerDelegationService = new ShopCustomerDelegationService(new SupabaseShopCustomerDelegationGateway(client));
  const storefrontPasswordRecoveryService = new StorefrontPasswordRecoveryService(
    new SupabaseStorefrontPasswordRecoveryGateway(storefrontClient),
    new ResendStorefrontPasswordRecoveryEmailSender(Deno.env.get('RESEND_API_KEY') ?? null, Deno.env.get('MAGRIT_FROM_EMAIL') ?? 'Magrit <onboarding@resend.dev>'),
  );
  const catalogService = new CatalogService(new SupabaseCatalogRepository(client), new SupabaseCatalogAutomationGateway(client));
  const conversationsService = new ConversationsService(new SupabaseConversationsRepository(client));
  const aiConfiguration = aiProviderConfigurationFromEnvironment((name) => Deno.env.get(name));
  const diagnosticsService = new DiagnosticsService(new ConfiguredAiDiagnosticsGateway(
    aiConfiguration,
  ), new HttpClariprintDiagnosticsGateway(
    Deno.env.get('CLARIPRINT_HOST') ?? 'https://lrdp.clariprint.com',
    Deno.env.get('CLARIPRINT_LOGIN') ?? null,
    Deno.env.get('CLARIPRINT_PASSWORD') ?? null,
  ));
  const quotesService = new QuotesService(new SupabaseQuotesRepository(client));
  const quoteTemplatesService = new QuoteTemplatesService(new SupabaseQuoteTemplatesRepository(client));
  const librariesService = new LibrariesService(new SupabaseLibrariesRepository(client));
  const libraryProductsService = new LibraryProductsService(new SupabaseLibraryProductsRepository(client));
  const commercialService = new CommercialService(new SupabaseCommercialRepository(client));
  const assistantService = new AssistantService(new ConfiguredAiCompletionGateway(aiConfiguration), new SupabaseAssistantAccessGateway(client));
  const clariprintService = new ClariprintService(new HttpClariprintQuoteGateway(
    Deno.env.get('CLARIPRINT_HOST') ?? 'https://lrdp.clariprint.com',
    Deno.env.get('CLARIPRINT_LOGIN') ?? null,
    Deno.env.get('CLARIPRINT_PASSWORD') ?? null,
  ));
  const handler = createApiV1Application({
    routes: [
      ...createSessionRoutes(service),
      ...createOrdersRoutes(ordersService, storefrontSessionService, storefrontCookiePolicy),
      ...createInvitationsRoutes(invitationsService),
      ...createMembersRoutes(membersService),
      ...createRolesRoutes(rolesService),
      ...createShopsRoutes(shopsService, storefrontSessionService, storefrontCookiePolicy),
      ...createShopCustomersRoutes(shopCustomersService),
      ...createStorefrontSessionRoutes(storefrontAuthenticationService, storefrontRegistrationService, storefrontSessionService, storefrontCookiePolicy),
      ...createStorefrontActivationRoutes(storefrontActivationService, storefrontCookiePolicy),
      ...createStorefrontPasswordRecoveryRoutes(storefrontPasswordRecoveryService),
      ...createShopCustomerDelegationRoutes(shopCustomerDelegationService, storefrontCookiePolicy),
      ...createCatalogRoutes(catalogService),
      ...createConversationsRoutes(conversationsService),
      ...createDiagnosticsRoutes(diagnosticsService),
      ...createAssistantRoutes(assistantService),
      ...createClariprintRoutes(clariprintService),
      ...createQuotesRoutes(quotesService),
      ...createQuoteTemplatesRoutes(quoteTemplatesService),
      ...createLibrariesRoutes(librariesService),
      ...createLibraryProductsRoutes(libraryProductsService),
      ...createCommercialRoutes(commercialService),
    ],
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

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([name, value]) => headers.set(name, value));
  return new Response(response.body, { status: response.status, headers });
}

function publicSupabaseUrl(request: Request, internalUrl: string): string {
  const configured = Deno.env.get('MAGRIT_PUBLIC_SUPABASE_URL');
  if (configured) return configured;
  try {
    if (new URL(internalUrl).hostname !== 'kong') return internalUrl;
    const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    if (forwardedHost && !forwardedHost.startsWith('kong')) {
      const protocol = request.headers.get('x-forwarded-proto') ?? 'http';
      const origin = new URL(`${protocol}://${forwardedHost}`);
      const forwardedPort = request.headers.get('x-forwarded-port');
      if (!origin.port && forwardedPort) origin.port = forwardedPort;
      if (!origin.port && isLoopback(origin.hostname)) origin.port = '54321';
      return origin.origin;
    }
  } catch { /* repli local ci-dessous */ }
  return 'http://127.0.0.1:54321';
}

function isLoopback(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]';
}

function normalizeApiRequest(request: Request): Request {
  const url = new URL(request.url);
  const apiPathIndex = url.pathname.indexOf('/api/v1/');
  if (apiPathIndex >= 0) url.pathname = url.pathname.slice(apiPathIndex);
  return new Request(url, request);
}

Deno.serve(handleRequest);
