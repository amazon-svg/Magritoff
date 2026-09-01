import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseId } from '../../../src/kernel/ids/index.ts';
import { SessionService } from '../../../src/modules/session/application/session-service.ts';
import { SupabaseSessionRepository } from '../../../src/adapters/supabase/session-repository.ts';
import { OrdersService } from '../../../src/modules/orders/application/orders-service.ts';
import { SupabaseOrdersRepository } from '../../../src/adapters/supabase/orders-repository.ts';
import { InvitationsService } from '../../../src/modules/invitations/application/invitations-service.ts';
import { SupabaseInvitationsRepository } from '../../../src/adapters/supabase/invitations-repository.ts';
import { MembersService } from '../../../src/modules/members/application/members-service.ts';
import { SupabaseMembersRepository } from '../../../src/adapters/supabase/members-repository.ts';
import { ResendInvitationEmailSender } from '../../../src/adapters/resend/invitation-email-sender.ts';
import { RolesService } from '../../../src/modules/roles/application/roles-service.ts';
import { SupabaseRolesRepository } from '../../../src/adapters/supabase/roles-repository.ts';
import { ShopsService } from '../../../src/modules/shops/application/shops-service.ts';
import { SupabaseShopsRepository } from '../../../src/adapters/supabase/shops-repository.ts';
import { CatalogService } from '../../../src/modules/catalog/application/catalog-service.ts';
import { SupabaseCatalogAutomationGateway, SupabaseCatalogRepository } from '../../../src/adapters/supabase/catalog-repository.ts';
import { ConversationsService } from '../../../src/modules/conversations/application/conversations-service.ts';
import { SupabaseConversationsRepository } from '../../../src/adapters/supabase/conversations-repository.ts';
import { DiagnosticsService } from '../../../src/modules/diagnostics/application/diagnostics-service.ts';
import { ConfiguredAiDiagnosticsGateway, aiProviderConfigurationFromEnvironment } from '../../../src/adapters/ai/configured-ai-diagnostics-gateway.ts';
import { HttpClariprintDiagnosticsGateway } from '../../../src/adapters/clariprint/clariprint-diagnostics-gateway.ts';
import { QuotesService } from '../../../src/modules/quotes/application/quotes-service.ts';
import { SupabaseQuotesRepository } from '../../../src/adapters/supabase/quotes-repository.ts';
import { QuoteTemplatesService } from '../../../src/modules/quote-templates/application/quote-templates-service.ts';
import { SupabaseQuoteTemplatesRepository } from '../../../src/adapters/supabase/quote-templates-repository.ts';
import { LibrariesService } from '../../../src/modules/libraries/application/libraries-service.ts';
import { SupabaseLibrariesRepository } from '../../../src/adapters/supabase/libraries-repository.ts';
import { LibraryProductsService } from '../../../src/modules/libraries/application/library-products-service.ts';
import { SupabaseLibraryProductsRepository } from '../../../src/adapters/supabase/library-products-repository.ts';
import { CommercialService } from '../../../src/modules/commercial/application/commercial-service.ts';
import { SupabaseCommercialRepository } from '../../../src/adapters/supabase/commercial-repository.ts';
import { AssistantService } from '../../../src/modules/diagnostics/application/assistant-service.ts';
import { ConfiguredAiCompletionGateway } from '../../../src/adapters/ai/configured-ai-completion-gateway.ts';
import { SupabaseAssistantAccessGateway } from '../../../src/adapters/supabase/assistant-access-gateway.ts';
import { ClariprintService } from '../../../src/modules/clariprint/application/clariprint-service.ts';
import { HttpClariprintQuoteGateway } from '../../../src/adapters/clariprint/http-clariprint-quote-gateway.ts';
import { isMockupBinaryRequest, proxyMockupBinary } from '../../../src/adapters/supabase/mockup-binary-proxy.ts';
import { isAssistantChatRequest, proxyAssistantChat } from '../../../src/server/api/assistant-stream-proxy.ts';
import { ShopCustomersService } from '../../../src/modules/shop-customers/application/shop-customers-service.ts';
import { SupabaseShopCustomersRepository } from '../../../src/adapters/supabase/shop-customers-repository.ts';
import { StorefrontAuthenticationService } from '../../../src/modules/shop-customers/application/storefront-authentication-service.ts';
import { StorefrontRegistrationService } from '../../../src/modules/shop-customers/application/storefront-registration-service.ts';
import { StorefrontSessionService } from '../../../src/modules/shop-customers/application/storefront-session-service.ts';
import { SupabaseStorefrontAuthenticationGateway } from '../../../src/adapters/supabase/storefront-authentication-gateway.ts';
import { readStorefrontSessionCookie, storefrontSessionCookiePolicy } from '../../../src/server/storefront/session-cookie.ts';
import { StorefrontActivationService } from '../../../src/modules/shop-customers/application/storefront-activation-service.ts';
import { SupabaseStorefrontActivationGateway } from '../../../src/adapters/supabase/storefront-activation-gateway.ts';
import { ResendStorefrontActivationEmailSender } from '../../../src/adapters/resend/storefront-activation-email-sender.ts';
import { ShopCustomerDelegationService } from '../../../src/modules/shop-customers/application/shop-customer-delegation-service.ts';
import { SupabaseShopCustomerDelegationGateway } from '../../../src/adapters/supabase/shop-customer-delegation-gateway.ts';
import { StorefrontPasswordRecoveryService } from '../../../src/modules/shop-customers/application/storefront-password-recovery-service.ts';
import { SupabaseStorefrontPasswordRecoveryGateway } from '../../../src/adapters/supabase/storefront-password-recovery-gateway.ts';
import { ResendStorefrontPasswordRecoveryEmailSender } from '../../../src/adapters/resend/storefront-password-recovery-email-sender.ts';
import { ShopCustomerInvitationService } from '../../../src/modules/shop-customers/application/shop-customer-invitation-service.ts';
// ── Facade Gestion commerciale (E10) ────────────────────────────────────────
import { createMagritApiApplication } from '../../../src/server/api/composition.ts';
import { createLegacyApiRoutes } from '../../../src/server/api/legacy-routes.ts';
import { CustomersService } from '../../../src/modules/customers/application/customers-service.ts';
import { SupabaseCustomersRepository } from '../../../src/adapters/supabase/customers-repository.ts';
import { CustomerContactShopAccessService } from '../../../src/modules/shop-customers/application/customer-contact-shop-access-service.ts';
import { ProjectsService } from '../../../src/modules/projects/application/projects-service.ts';
import { SupabaseProjectsRepository } from '../../../src/adapters/supabase/projects-repository.ts';
import { ProjectTagsService } from '../../../src/modules/project-tags/application/project-tags-service.ts';
import { SupabaseProjectTagsRepository } from '../../../src/adapters/supabase/project-tags-repository.ts';
import { CommercialQuotesService } from '../../../src/modules/commercial-quotes/application/commercial-quotes-service.ts';
import { SupabaseCommercialQuotesRepository } from '../../../src/adapters/supabase/commercial-quotes-repository.ts';
import { SupabaseApiPrincipalVerifier } from '../../../src/adapters/supabase/api-principal-verifier.ts';
import { InMemoryIdempotencyStore, OutboxPublisher } from '../../../src/modules/_shared/application/index.ts';
import { TENANT_SELECTION_HEADER } from '../../../src/modules/_shared/api/index.ts';
import { SupabaseOutboxRepository, bestEffortOutbox } from '../../../src/adapters/supabase/outbox-repository.ts';
import type { OutboxRepository } from '../../../src/modules/_shared/application/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // Les quatre derniers en-tetes sont exiges par la facade E10 (socle E10.0) :
  // `idempotency-key` sur toute creation (CA8), `if-match` sur tout PATCH
  // (CA9), `x-magrit-tenant` pour selectionner l espace parmi ceux du jeton,
  // `x-magrit-service-key` pour les modules tiers (CA5). Sans eux, le
  // prevol navigateur rejette la requete avant qu elle parte.
  'Access-Control-Allow-Headers':
    'authorization, content-type, x-request-id, idempotency-key, if-match, x-magrit-tenant, x-magrit-service-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  // Sans cette ligne, `response.headers.get('etag')` rend `null` dans un
  // navigateur : seuls quelques en-tetes sont lisibles par defaut en CORS.
  // Le flux `If-Match` de la facade E10 serait alors inutilisable depuis le
  // front, qui ne pourrait jamais lire l ETag qu il doit renvoyer.
  'Access-Control-Expose-Headers': 'etag, x-request-id, idempotency-replayed',
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
  const storefrontShopsRepository = new SupabaseShopsRepository(
    storefrontClient,
    publicSupabaseUrl(request, supabaseUrl),
  );
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
    return withCors(await proxyAssistantChat(request, {
      legacyBaseUrl: `${supabaseUrl}/functions/v1/make-server-e3db71a4`,
      authorization: `Bearer ${anonKey}`,
      authorizeShop: async (shopSlug) => {
        try {
          const probe = await storefrontShopsRepository.publicProbe(shopSlug);
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
  const shopCustomerInvitationService = new ShopCustomerInvitationService(
    shopCustomersService,
    storefrontActivationService,
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
  // ── Facade Gestion commerciale (E10) ──────────────────────────────────────
  // Montee A COTE de la facade historique, sur le meme prefixe /api/v1.
  // `createMagritApiApplication` aiguille par chemin et refuse de demarrer si
  // les deux facades se recouvrent (voir api-facade-router.ts).
  //
  // L outbox ecrit sous `service_role` : la table est fermee aux roles client
  // par construction. Sans cette cle, les evenements sont perdus plutot que de
  // faire echouer une operation metier deja commise — le cas est journalise.
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const outboxRepository: OutboxRepository = serviceRoleKey
    ? new SupabaseOutboxRepository(
        createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        }),
      )
    : unavailableOutbox('SUPABASE_SERVICE_ROLE_KEY absente');

  const customersRepository = new SupabaseCustomersRepository(client);
  const customersService = new CustomersService({
    repository: customersRepository,
    outbox: new OutboxPublisher({
      repository: bestEffortOutbox(outboxRepository, (error, events) => {
        console.error(
          '[magrit-api] publication outbox echouee',
          events.map((event) => event.name),
          error,
        );
      }),
      now: () => new Date(),
      newEventId: () => crypto.randomUUID(),
    }),
  });

  // E10.5 — ouverture/revocation d un acces boutique depuis un interlocuteur.
  // Reutilise deliberement les services shop-customers deja instancies plus
  // haut (memes primitives d activation que l invitation boutique classique).
  const customerShopAccessService = new CustomerContactShopAccessService(
    shopCustomersService,
    storefrontActivationService,
  );

  // E10.2 — tags libres colores sur les projets, crees a la volee.
  const projectTagsRepository = new SupabaseProjectTagsRepository(client);
  const projectTagsService = new ProjectTagsService({ repository: projectTagsRepository });

  // E10.1 — conteneur de travail Projets. Reutilise le referentiel Clients
  // (E10.4) deja instancie pour verifier l existence du `customer_id` (CA3),
  // et le referentiel Tags de projet (E10.2) pour verifier `tag_ids` avant
  // remplacement (CA6), sans dupliquer ces logiques.
  const projectsService = new ProjectsService({
    repository: new SupabaseProjectsRepository(client),
    customers: customersRepository,
    projectTags: projectTagsRepository,
    outbox: new OutboxPublisher({
      repository: bestEffortOutbox(outboxRepository, (error, events) => {
        console.error(
          '[magrit-api] publication outbox echouee',
          events.map((event) => event.name),
          error,
        );
      }),
      now: () => new Date(),
      newEventId: () => crypto.randomUUID(),
    }),
  });

  // E10.3 — creation d un devis depuis un projet (selection multi-produits).
  // L outbox publie quote.created via le meme mecanisme best-effort que
  // project.created ci-dessus (dette M2 partagee, docs/api/CONVENTIONS.md).
  const commercialQuotesService = new CommercialQuotesService({
    repository: new SupabaseCommercialQuotesRepository(client),
    outbox: new OutboxPublisher({
      repository: bestEffortOutbox(outboxRepository, (error, events) => {
        console.error(
          '[magrit-api] publication outbox echouee',
          events.map((event) => event.name),
          error,
        );
      }),
      now: () => new Date(),
      newEventId: () => crypto.randomUUID(),
    }),
  });

  const handler = createMagritApiApplication({
    gescomServices: {
      customers: customersService,
      customerShopAccess: customerShopAccessService,
      projects: projectsService,
      projectTags: projectTagsService,
      commercialQuotes: commercialQuotesService,
    },
    principalVerifier: new SupabaseApiPrincipalVerifier(client, {
      requestedTenantId: request.headers.get(TENANT_SELECTION_HEADER),
    }),
    // Store en memoire : il ne survit pas au recyclage de l isolat, donc la
    // garantie d idempotence ne couvre qu une fenetre courte. L adaptateur
    // durable sur `api_idempotency_keys` reste la dette tracee en
    // docs/api/CONVENTIONS.md §8.1.
    idempotencyStore: new InMemoryIdempotencyStore(),
    // Facade historique : la liste des fabriques vit desormais dans
    // src/server/api/legacy-routes.ts, ou elle est typecheckee et testable.
    // Importer ce module verifie AU CHARGEMENT qu aucun chemin E10 ne recouvre
    // un chemin historique.
    routes: createLegacyApiRoutes({
      session: service,
      orders: ordersService,
      invitations: invitationsService,
      members: membersService,
      roles: rolesService,
      shops: shopsService,
      shopCustomers: shopCustomersService,
      shopCustomerInvitations: shopCustomerInvitationService,
      shopCustomerDelegations: shopCustomerDelegationService,
      storefrontAuthentication: storefrontAuthenticationService,
      storefrontRegistration: storefrontRegistrationService,
      storefrontSessions: storefrontSessionService,
      storefrontActivation: storefrontActivationService,
      storefrontPasswordRecovery: storefrontPasswordRecoveryService,
      catalog: catalogService,
      conversations: conversationsService,
      diagnostics: diagnosticsService,
      assistant: assistantService,
      clariprint: clariprintService,
      quotes: quotesService,
      quoteTemplates: quoteTemplatesService,
      libraries: librariesService,
      libraryProducts: libraryProductsService,
      commercial: commercialService,
      storefrontCookiePolicy,
      authorizeStorefrontEditorial: async (storefrontRequest, shopSlug) => {
        const opaqueToken = readStorefrontSessionCookie(
          storefrontRequest.headers.get('cookie'),
          storefrontCookiePolicy,
        );
        const session = opaqueToken
          ? await storefrontSessionService.current(opaqueToken)
          : null;
        if (!session) return null;
        try {
          const probe = await storefrontShopsRepository.publicProbe(shopSlug);
          return probe.id === session.identity.shopId
            ? { tenantId: probe.tenantId }
            : null;
        } catch {
          return null;
        }
      },
    }),
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

/**
 * Depot d evenements indisponible : journalise et laisse passer.
 *
 * Faire echouer une operation metier DEJA COMMISE parce que son evenement n a
 * pas pu partir dirait au client que son operation a echoue alors qu elle a
 * reussi ; il rejouerait, et creerait un doublon. On perd l evenement,
 * bruyamment. Voir docs/api/CONVENTIONS.md §8.1.
 */
function unavailableOutbox(reason: string): OutboxRepository {
  return {
    async append(events) {
      console.error(
        `[magrit-api] outbox indisponible (${reason}) : evenements perdus`,
        events.map((event) => event.name),
      );
    },
  };
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
