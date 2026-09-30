import { createApiV1Application } from '../api/composition.ts';
import { createCommercialSettingsRoutes } from '../api/commercial-settings-routes.ts';
import { createCommercialLineFilesRoutes } from '../api/commercial-line-files-routes.ts';
import { createCommercialQuotesRoutes } from '../api/commercial-quotes-routes.ts';
import { createCatalogRoutes } from '../api/catalog-routes.ts';
import { createGescomApiHandler } from '../api/gescom-middleware.ts';
import { createConversationsRoutes } from '../api/conversations-routes.ts';
import { createCustomersRoutes } from '../api/customers-routes.ts';
import { createDocumentTemplatesRoutes } from '../api/document-templates-routes.ts';
import { createDiagnosticsRoutes } from '../api/diagnostics-routes.ts';
import { createAssistantRoutes } from '../api/assistant-routes.ts';
import { createInvitationsRoutes } from '../api/invitations-routes.ts';
import { createLibrariesRoutes } from '../api/libraries-routes.ts';
import { createLibraryProductsRoutes } from '../api/library-products-routes.ts';
import { createMembersRoutes } from '../api/members-routes.ts';
import { createProjectTagsRoutes } from '../api/project-tags-routes.ts';
import { createPriceRulesRoutes } from '../api/price-rules-routes.ts';
import { createProjectsRoutes } from '../api/projects-routes.ts';
import { createProductionStepsRoutes } from '../api/production-steps-routes.ts';
import { createQuoteDocumentsRoutes } from '../api/quote-documents-routes.ts';
import { createQuoteTemplatesRoutes } from '../api/quote-templates-routes.ts';
import { createReadinessRoute } from '../api/readiness-route.ts';
import { createRolesRoutes } from '../api/roles-routes.ts';
import { createPublicShopsRoutes, createShopAdministrationRoutes } from '../api/shops-routes.ts';
import { createShopCustomerAdministrationRoutes } from '../api/shop-customers-routes.ts';
import { createShopCustomerDelegationRoutes } from '../api/shop-customer-delegation-routes.ts';
import { createStorefrontSessionRoutes } from '../api/storefront-session-routes.ts';
import { createStorefrontActivationRoutes } from '../api/storefront-activation-routes.ts';
import { createStorefrontPasswordRecoveryRoutes } from '../api/storefront-password-recovery-routes.ts';
import {
  createSessionBootstrapRoute,
  createSessionInvitationAcceptanceRoute,
  createSessionPreferencesRoutes,
  createSessionSubTenantMutationRoutes,
  createSessionTenantCreationRoute,
  createSessionTenantSettingsRoutes,
} from '../api/session-routes.ts';
import { OidcJwtVerifier } from '../../adapters/oidc/jwt-verifier.ts';
import { ConfiguredAiCompletionGateway } from '../../adapters/ai/configured-ai-completion-gateway.ts';
import { ConfiguredAiDiagnosticsGateway, aiProviderConfigurationFromEnvironment } from '../../adapters/ai/configured-ai-diagnostics-gateway.ts';
import { HttpClariprintDiagnosticsGateway } from '../../adapters/clariprint/clariprint-diagnostics-gateway.ts';
import { PostgresCommercialSettingsRepository } from '../../adapters/postgres/commercial-settings-repository.ts';
import { PostgresCommercialLineFilesRepository } from '../../adapters/postgres/commercial-line-files-repository.ts';
import { PostgresCommercialQuotesRepository } from '../../adapters/postgres/commercial-quotes-repository.ts';
import { PostgresCatalogRepository } from '../../adapters/postgres/catalog-repository.ts';
import { PostgresConversationsRepository } from '../../adapters/postgres/conversations-repository.ts';
import { PostgresCustomersRepository } from '../../adapters/postgres/customers-repository.ts';
import { PostgresDocumentTemplatesRepository } from '../../adapters/postgres/document-templates-repository.ts';
import { PostgresDiagnosticsAccessGateway } from '../../adapters/postgres/diagnostics-access-gateway.ts';
import { PostgresIdempotencyStore } from '../../adapters/postgres/idempotency-store.ts';
import { PostgresInvitationsRepository } from '../../adapters/postgres/invitations-repository.ts';
import { PostgresLibrariesRepository } from '../../adapters/postgres/libraries-repository.ts';
import { PostgresLibraryProductsRepository } from '../../adapters/postgres/library-products-repository.ts';
import { PostgresMembersRepository } from '../../adapters/postgres/members-repository.ts';
import { PostgresOidcIdentityDirectory } from '../../adapters/postgres/oidc-identity-directory.ts';
import { PostgresOutboxRepository } from '../../adapters/postgres/outbox-repository.ts';
import { PostgresPriceRulesRepository } from '../../adapters/postgres/price-rules-repository.ts';
import { PostgresProjectTagsRepository } from '../../adapters/postgres/project-tags-repository.ts';
import { PostgresProjectsRepository } from '../../adapters/postgres/projects-repository.ts';
import { PostgresQuoteDocumentsRepository } from '../../adapters/postgres/quote-documents-repository.ts';
import { PostgresQuoteTemplatesRepository } from '../../adapters/postgres/quote-templates-repository.ts';
import { PostgresRolesRepository } from '../../adapters/postgres/roles-repository.ts';
import { PostgresShopsRepository } from '../../adapters/postgres/shops-repository.ts';
import { PostgresShopCustomersRepository } from '../../adapters/postgres/shop-customers-repository.ts';
import { PostgresShopCustomerDelegationGateway } from '../../adapters/postgres/shop-customer-delegation-gateway.ts';
import { PostgresStorefrontAuthenticationGateway } from '../../adapters/postgres/storefront-authentication-gateway.ts';
import { PostgresStorefrontActivationGateway } from '../../adapters/postgres/storefront-activation-gateway.ts';
import { PostgresStorefrontPasswordRecoveryGateway } from '../../adapters/postgres/storefront-password-recovery-gateway.ts';
import { createPostgresPool } from '../../adapters/postgres/pool.ts';
import { PostgresProductionStepsRepository } from '../../adapters/postgres/production-steps-repository.ts';
import { PostgresReadinessProbe } from '../../adapters/postgres/readiness-probe.ts';
import { PostgresSessionBootstrapRepository } from '../../adapters/postgres/session-bootstrap-repository.ts';
import { PostgresTransactionRunner } from '../../adapters/postgres/transaction-runner.ts';
import { ResendInvitationEmailSender } from '../../adapters/resend/invitation-email-sender.ts';
import { ResendPasswordResetEmailSender } from '../../adapters/resend/password-reset-email-sender.ts';
import { ResendStorefrontActivationEmailSender } from '../../adapters/resend/storefront-activation-email-sender.ts';
import { ResendStorefrontPasswordRecoveryEmailSender } from '../../adapters/resend/storefront-password-recovery-email-sender.ts';
import { createS3Client } from '../../adapters/s3/client.ts';
import { S3CommercialLineFileStorage } from '../../adapters/s3/commercial-line-file-storage.ts';
import { S3ProjectCommercialFileStorage } from '../../adapters/s3/project-commercial-file-storage.ts';
import { S3ShopAssetStorage } from '../../adapters/s3/shop-asset-storage.ts';
import { SmtpInvitationEmailSender } from '../../adapters/smtp/invitation-email-sender.ts';
import { SmtpPasswordResetEmailSender } from '../../adapters/smtp/password-reset-email-sender.ts';
import { SmtpStorefrontActivationEmailSender } from '../../adapters/smtp/storefront-activation-email-sender.ts';
import { SmtpStorefrontPasswordRecoveryEmailSender } from '../../adapters/smtp/storefront-password-recovery-email-sender.ts';
import { readSmtpConfiguration, SmtpTransport } from '../../adapters/smtp/transport.ts';
import { ConversationsService } from '../../modules/conversations/application/conversations-service.ts';
import { CommercialSettingsService } from '../../modules/commercial-settings/application/commercial-settings-service.ts';
import { CommercialLineFilesService } from '../../modules/commercial-line-files/application/commercial-line-files-service.ts';
import { CommercialQuotesService } from '../../modules/commercial-quotes/application/commercial-quotes-service.ts';
import { CatalogService } from '../../modules/catalog/application/catalog-service.ts';
import { CatalogRejectedError } from '../../modules/catalog/application/catalog-repository.ts';
import { CustomersService } from '../../modules/customers/application/customers-service.ts';
import { DocumentTemplatesService } from '../../modules/document-templates/application/document-templates-service.ts';
import { DiagnosticsService } from '../../modules/diagnostics/application/diagnostics-service.ts';
import { AssistantService } from '../../modules/diagnostics/application/assistant-service.ts';
import { InvitationsService } from '../../modules/invitations/application/invitations-service.ts';
import { LibrariesService } from '../../modules/libraries/application/libraries-service.ts';
import { LibraryProductsService } from '../../modules/libraries/application/library-products-service.ts';
import { MembersService } from '../../modules/members/application/members-service.ts';
import { CustomersRepositoryDocumentDataGateway } from '../../modules/quote-documents/application/customer-document-data-gateway.ts';
import { QuoteDocumentsService } from '../../modules/quote-documents/application/quote-documents-service.ts';
import { QuoteTemplatesService } from '../../modules/quote-templates/application/quote-templates-service.ts';
import { RolesService } from '../../modules/roles/application/roles-service.ts';
import { ShopsService } from '../../modules/shops/application/shops-service.ts';
import { ShopCustomersService } from '../../modules/shop-customers/application/shop-customers-service.ts';
import { ShopCustomerDelegationService } from '../../modules/shop-customers/application/shop-customer-delegation-service.ts';
import { StorefrontAuthenticationService } from '../../modules/shop-customers/application/storefront-authentication-service.ts';
import { StorefrontRegistrationService } from '../../modules/shop-customers/application/storefront-registration-service.ts';
import { StorefrontSessionService } from '../../modules/shop-customers/application/storefront-session-service.ts';
import { StorefrontActivationService } from '../../modules/shop-customers/application/storefront-activation-service.ts';
import { StorefrontPasswordRecoveryService } from '../../modules/shop-customers/application/storefront-password-recovery-service.ts';
import { OutboxPublisher } from '../../modules/_shared/application/index.ts';
import { ProjectTagsService } from '../../modules/project-tags/application/project-tags-service.ts';
import { PriceRulesService } from '../../modules/pricing/application/price-rules-service.ts';
import { createPricingEngine } from '../../modules/pricing/application/pricing-engine-provider.ts';
import { ProjectsService } from '../../modules/projects/application/projects-service.ts';
import { ProductionStepsService } from '../../modules/production-steps/application/production-steps-service.ts';
import { SessionInvitationAcceptanceService, SessionSubTenantMutationService } from '../../modules/session/application/session-service.ts';
import { createLocalAuthentication, readLocalAuthenticationConfiguration } from '../auth/local-authentication.ts';
import { CredentialActorResolver, LocalSessionActorResolver } from '../auth/local-session-actor-resolver.ts';
import { LocalApiPrincipalVerifier } from '../auth/local-api-principal-verifier.ts';
import { OidcActorResolver } from '../auth/oidc-actor-resolver.ts';
import { createNodeHttpServer } from './http-server.ts';
import { readOidcConfiguration } from './oidc-configuration.ts';
import { createTransitionalApiHandler } from './transitional-api-handler.ts';
import { readStorefrontSessionCookie, storefrontSessionCookiePolicy } from '../storefront/session-cookie.ts';

const host = process.env['MAGRIT_API_HOST'] ?? '127.0.0.1';
const port = parsePort(process.env['MAGRIT_API_PORT'] ?? '8787');
const postgresPool = createPostgresPool();
postgresPool.on('error', (error) => {
  console.error(JSON.stringify({ level: 'error', event: 'postgres.pool_error', error: error.message }));
});
const oidcConfiguration = readOidcConfiguration();
const localAuthenticationConfiguration = readLocalAuthenticationConfiguration();
const fromEmail = process.env['MAGRIT_FROM_EMAIL'] ?? 'Magrit <noreply@magrit.local>';
const smtpConfiguration = readSmtpConfiguration();
const smtpTransport = smtpConfiguration === null ? null : new SmtpTransport(smtpConfiguration);
const invitationEmailSender = smtpTransport === null
  ? new ResendInvitationEmailSender(process.env['RESEND_API_KEY'] ?? null, fromEmail)
  : new SmtpInvitationEmailSender(smtpTransport, fromEmail);
const passwordResetEmailSender = smtpTransport === null
  ? new ResendPasswordResetEmailSender(process.env['RESEND_API_KEY'] ?? null, fromEmail)
  : new SmtpPasswordResetEmailSender(smtpTransport, fromEmail);
const localAuthentication = localAuthenticationConfiguration === null
  ? null
  : createLocalAuthentication(postgresPool, localAuthenticationConfiguration, passwordResetEmailSender);
const identityDirectory = new PostgresOidcIdentityDirectory(postgresPool);
const oidcJwtVerifier = oidcConfiguration === null
  ? null
  : new OidcJwtVerifier(oidcConfiguration);
const oidcActorResolver = oidcConfiguration === null
  ? null
  : new OidcActorResolver(oidcJwtVerifier!, identityDirectory);
const localSessionActorResolver = localAuthentication === null
  ? null
  : new LocalSessionActorResolver(localAuthentication.api, identityDirectory);
const actorResolver = oidcActorResolver === null && localSessionActorResolver === null
  ? undefined
  : new CredentialActorResolver(oidcActorResolver, localSessionActorResolver);
const aiConfiguration = aiProviderConfigurationFromEnvironment((name) => process.env[name]);
const diagnosticsAccess = new PostgresDiagnosticsAccessGateway(
  new PostgresTransactionRunner(postgresPool, 'magrit_api'),
);
const diagnosticsRoutes = actorResolver === undefined ? [] : createDiagnosticsRoutes(new DiagnosticsService(
  new ConfiguredAiDiagnosticsGateway(aiConfiguration),
  new HttpClariprintDiagnosticsGateway(
    process.env['CLARIPRINT_HOST'] ?? 'https://lrdp.clariprint.com',
    process.env['CLARIPRINT_LOGIN'] ?? null,
    process.env['CLARIPRINT_PASSWORD'] ?? null,
  ),
  diagnosticsAccess,
));
const assistantService = new AssistantService(
  new ConfiguredAiCompletionGateway(aiConfiguration),
  diagnosticsAccess,
);
const conversationsEnabled = actorResolver !== undefined;
const conversationsRoutes = conversationsEnabled
  ? createConversationsRoutes(new ConversationsService(new PostgresConversationsRepository(
      new PostgresTransactionRunner(postgresPool, 'magrit_api'),
    )))
  : [];
const sessionEnabled = actorResolver !== undefined;
const sessionRepository = new PostgresSessionBootstrapRepository(
  new PostgresTransactionRunner(postgresPool, 'magrit_api'),
);
const sessionService = new SessionSubTenantMutationService(sessionRepository);
const sessionInvitationAcceptanceService = new SessionInvitationAcceptanceService(sessionRepository);
const sessionRoutes = sessionEnabled
  ? [
      createSessionBootstrapRoute(sessionService),
      ...createSessionPreferencesRoutes(sessionService),
      ...createSessionTenantSettingsRoutes(sessionService),
      createSessionTenantCreationRoute(sessionService),
      ...createSessionSubTenantMutationRoutes(sessionService),
      createSessionInvitationAcceptanceRoute(sessionInvitationAcceptanceService),
    ]
  : [];
const invitationsRoutes = actorResolver === undefined
  ? []
  : createInvitationsRoutes(new InvitationsService(
      new PostgresInvitationsRepository(
        new PostgresTransactionRunner(postgresPool, 'magrit_api'),
        invitationEmailSender,
      ),
    ));
const membersRoutes = actorResolver === undefined
  ? []
  : createMembersRoutes(new MembersService(
      new PostgresMembersRepository(
        new PostgresTransactionRunner(postgresPool, 'magrit_api'),
      ),
    ));
const librariesRoutes = actorResolver === undefined
  ? []
  : createLibrariesRoutes(new LibrariesService(new PostgresLibrariesRepository(
      new PostgresTransactionRunner(postgresPool, 'magrit_api'),
    )));
const libraryProductsRoutes = actorResolver === undefined
  ? []
  : createLibraryProductsRoutes(new LibraryProductsService(new PostgresLibraryProductsRepository(
      new PostgresTransactionRunner(postgresPool, 'magrit_api'),
    )));
const rolesRoutes = actorResolver === undefined
  ? []
  : createRolesRoutes(new RolesService(
      new PostgresRolesRepository(
        new PostgresTransactionRunner(postgresPool, 'magrit_api'),
      ),
    ));
const quoteTemplatesRoutes = actorResolver === undefined
  ? []
  : createQuoteTemplatesRoutes(new QuoteTemplatesService(new PostgresQuoteTemplatesRepository(
      new PostgresTransactionRunner(postgresPool, 'magrit_api'),
    )));
const catalogRoutes = actorResolver === undefined
  ? []
  : createCatalogRoutes(new CatalogService(
      new PostgresCatalogRepository(
        new PostgresTransactionRunner(postgresPool, 'magrit_api'),
      ),
      {
        async pendingCandidates() { throw catalogAutomationNotMigrated(); },
        async runIngest() { throw catalogAutomationNotMigrated(); },
        async generateDefinition() { throw catalogAutomationNotMigrated(); },
      },
    ));
const gescomPrincipalVerifier = oidcJwtVerifier === null && localAuthentication === null
  ? null
  : new LocalApiPrincipalVerifier({
      identities: identityDirectory,
      ...(oidcJwtVerifier === null ? {} : { oidc: oidcJwtVerifier }),
      ...(localAuthentication === null ? {} : { sessions: localAuthentication.api }),
    });
const customersRepository = new PostgresCustomersRepository(
  new PostgresTransactionRunner(postgresPool, 'magrit_api'),
);
const projectTagsRepository = new PostgresProjectTagsRepository(
  new PostgresTransactionRunner(postgresPool, 'magrit_api'),
);
const outboxPublisher = new OutboxPublisher({
  repository: new PostgresOutboxRepository(
    new PostgresTransactionRunner(postgresPool, 'magrit_api'),
  ),
  now: () => new Date(),
  newEventId: () => crypto.randomUUID(),
});
const s3Client = gescomPrincipalVerifier === null ? null : createS3Client();
const s3PublicBaseUrl = process.env['S3_PUBLIC_BASE_URL']
  ?? process.env['S3_ENDPOINT']
  ?? `https://s3.${process.env['S3_REGION'] ?? 'us-east-1'}.amazonaws.com`;
const priceRulesService = new PriceRulesService({
  repository: new PostgresPriceRulesRepository(
    new PostgresTransactionRunner(postgresPool, 'magrit_api'),
  ),
  customers: customersRepository,
  outbox: outboxPublisher,
});
const projectsRepository = s3Client === null
  ? null
  : new PostgresProjectsRepository(
      new PostgresTransactionRunner(postgresPool, 'magrit_api'),
      new S3ProjectCommercialFileStorage(s3Client),
    );
const documentTemplatesRepository = s3Client === null
  ? null
  : new PostgresDocumentTemplatesRepository(
      new PostgresTransactionRunner(postgresPool, 'magrit_api'),
      s3Client,
    );
const quoteDocumentsService = s3Client === null || documentTemplatesRepository === null
  ? null
  : new QuoteDocumentsService({
      templates: documentTemplatesRepository,
      customers: new CustomersRepositoryDocumentDataGateway(customersRepository),
      repository: new PostgresQuoteDocumentsRepository(
        new PostgresTransactionRunner(postgresPool, 'magrit_api'),
        s3Client,
      ),
    });
const commercialQuotesService = projectsRepository === null || quoteDocumentsService === null
  ? null
  : new CommercialQuotesService({
      repository: new PostgresCommercialQuotesRepository(
        new PostgresTransactionRunner(postgresPool, 'magrit_api'),
      ),
      outbox: outboxPublisher,
      projects: projectsRepository,
      priceRules: priceRulesService,
      pricingEngine: createPricingEngine(),
      documents: quoteDocumentsService,
    });
const commercialSettingsRoutes = gescomPrincipalVerifier === null
  ? []
  : createCommercialSettingsRoutes(new CommercialSettingsService({
      repository: new PostgresCommercialSettingsRepository(
        new PostgresTransactionRunner(postgresPool, 'magrit_api'),
      ),
    }));
const productionStepsRoutes = gescomPrincipalVerifier === null
  ? []
  : createProductionStepsRoutes(new ProductionStepsService({
      repository: new PostgresProductionStepsRepository(
        new PostgresTransactionRunner(postgresPool, 'magrit_api'),
      ),
    }));
const customersRoutes = gescomPrincipalVerifier === null
  ? []
  : createCustomersRoutes(new CustomersService({
      repository: customersRepository,
      outbox: outboxPublisher,
    }));
const projectTagsRoutes = gescomPrincipalVerifier === null
  ? []
  : createProjectTagsRoutes(new ProjectTagsService({
      repository: projectTagsRepository,
    }));
const priceRulesRoutes = gescomPrincipalVerifier === null
  ? []
  : createPriceRulesRoutes(priceRulesService);
const projectsRoutes = gescomPrincipalVerifier === null
  ? []
  : createProjectsRoutes(new ProjectsService({
      repository: projectsRepository!,
      customers: customersRepository,
      projectTags: projectTagsRepository,
      outbox: outboxPublisher,
    }));
const commercialLineFilesRoutes = gescomPrincipalVerifier === null
  ? []
  : createCommercialLineFilesRoutes(new CommercialLineFilesService(
      new PostgresCommercialLineFilesRepository(
        new PostgresTransactionRunner(postgresPool, 'magrit_api'),
        new S3CommercialLineFileStorage(s3Client!),
      ),
    ));
const documentTemplatesRoutes = gescomPrincipalVerifier === null
  ? []
  : createDocumentTemplatesRoutes(new DocumentTemplatesService({
      repository: documentTemplatesRepository!,
    }));
const commercialQuotesRoutes = commercialQuotesService === null
  ? []
  : createCommercialQuotesRoutes(commercialQuotesService);
const quoteDocumentsRoutes = commercialQuotesService === null || quoteDocumentsService === null
  ? []
  : createQuoteDocumentsRoutes(quoteDocumentsService, commercialQuotesService);
const shopsService = s3Client === null ? null : new ShopsService(new PostgresShopsRepository(
      new PostgresTransactionRunner(postgresPool, 'magrit_api'),
      new S3ShopAssetStorage(s3Client, s3PublicBaseUrl),
    ));
const shopAdministrationRoutes = actorResolver === undefined || shopsService === null
  ? []
  : createShopAdministrationRoutes(shopsService);
const shopCustomerAdministrationRoutes = actorResolver === undefined
  ? []
  : createShopCustomerAdministrationRoutes(new ShopCustomersService(
      new PostgresShopCustomersRepository(new PostgresTransactionRunner(postgresPool, 'magrit_api')),
    ));
const storefrontAuthenticationGateway = new PostgresStorefrontAuthenticationGateway(
  new PostgresTransactionRunner(postgresPool, 'magrit_api'),
);
const storefrontSessions = new StorefrontSessionService(storefrontAuthenticationGateway);
const storefrontCookiePolicy = storefrontSessionCookiePolicy(
  (process.env['APP_BASE_URL'] ?? '').startsWith('https://') || process.env['NODE_ENV'] === 'production',
);
const storefrontSessionRoutes = createStorefrontSessionRoutes(
  new StorefrontAuthenticationService(storefrontAuthenticationGateway),
  new StorefrontRegistrationService(storefrontAuthenticationGateway),
  storefrontSessions,
  storefrontCookiePolicy,
);
const publicShopRoutes = shopsService === null ? [] : createPublicShopsRoutes(
  shopsService,storefrontSessions,storefrontCookiePolicy,
);
const assistantRoutes = createAssistantRoutes(assistantService, async (request, shopSlug) => {
  if (shopsService === null) return null;
  const token = readStorefrontSessionCookie(
    request.headers.get('cookie'),
    storefrontCookiePolicy,
  );
  const session = token ? await storefrontSessions.current(token) : null;
  if (session === null) return null;
  try {
    const shop = await shopsService.publicProbe(shopSlug);
    return shop.id === session.identity.shopId ? { tenantId: shop.tenantId } : null;
  } catch {
    return null;
  }
});
const shopCustomerDelegationRoutes = actorResolver === undefined ? [] : createShopCustomerDelegationRoutes(
  new ShopCustomerDelegationService(new PostgresShopCustomerDelegationGateway(
    new PostgresTransactionRunner(postgresPool, 'magrit_api'),
  )),
  storefrontCookiePolicy,
);
const storefrontActivationGateway = new PostgresStorefrontActivationGateway(
  new PostgresTransactionRunner(postgresPool, 'magrit_api'),
);
const storefrontActivationEmailSender = smtpTransport === null
  ? new ResendStorefrontActivationEmailSender(process.env['RESEND_API_KEY'] ?? null, fromEmail)
  : new SmtpStorefrontActivationEmailSender(smtpTransport, fromEmail);
const storefrontActivationRoutes = actorResolver === undefined ? [] : createStorefrontActivationRoutes(
  new StorefrontActivationService(storefrontActivationGateway, storefrontActivationEmailSender),
  storefrontCookiePolicy,
);
const storefrontPasswordRecoveryGateway = new PostgresStorefrontPasswordRecoveryGateway(
  new PostgresTransactionRunner(postgresPool, 'magrit_api'),
);
const storefrontPasswordRecoveryEmailSender = smtpTransport === null
  ? new ResendStorefrontPasswordRecoveryEmailSender(process.env['RESEND_API_KEY'] ?? null, fromEmail)
  : new SmtpStorefrontPasswordRecoveryEmailSender(smtpTransport, fromEmail);
const storefrontPasswordRecoveryRoutes = createStorefrontPasswordRecoveryRoutes(
  new StorefrontPasswordRecoveryService(storefrontPasswordRecoveryGateway, storefrontPasswordRecoveryEmailSender),
);
const gescomHandler = gescomPrincipalVerifier === null
  ? null
  : createGescomApiHandler({
      routes: [
        ...commercialSettingsRoutes,
        ...productionStepsRoutes,
        ...customersRoutes,
        ...projectTagsRoutes,
        ...priceRulesRoutes,
        ...projectsRoutes,
        ...commercialLineFilesRoutes,
        ...documentTemplatesRoutes,
        ...commercialQuotesRoutes,
        ...quoteDocumentsRoutes,
      ],
      principalVerifier: gescomPrincipalVerifier,
      idempotencyStore: new PostgresIdempotencyStore(
        new PostgresTransactionRunner(postgresPool, 'magrit_api'),
      ),
      onUnexpectedError(error, requestId) {
        console.error(JSON.stringify({ level: 'error', event: 'gescom.unexpected_error', requestId, error: errorMessage(error) }));
      },
    });
const apiHandler = createApiV1Application({
  routes: [
    createReadinessRoute(new PostgresReadinessProbe(postgresPool)),
    ...conversationsRoutes,
    ...diagnosticsRoutes,
    ...assistantRoutes,
    ...sessionRoutes,
    ...invitationsRoutes,
    ...librariesRoutes,
    ...libraryProductsRoutes,
    ...membersRoutes,
    ...rolesRoutes,
    ...quoteTemplatesRoutes,
    ...catalogRoutes,
    ...shopAdministrationRoutes,
    ...shopCustomerAdministrationRoutes,
    ...publicShopRoutes,
    ...storefrontSessionRoutes,
    ...shopCustomerDelegationRoutes,
    ...storefrontActivationRoutes,
    ...storefrontPasswordRecoveryRoutes,
  ],
  ...(actorResolver === undefined ? {} : { actorResolver }),
  onUnexpectedError(error, requestId) {
    console.error(JSON.stringify({ level: 'error', event: 'api.unexpected_error', requestId, error: errorMessage(error) }));
  },
});
const localHandler = localAuthentication === null
  ? (request: Request) => isLocalGescomPath(new URL(request.url).pathname) && gescomHandler !== null
      ? gescomHandler(request)
      : apiHandler(request)
  : (request: Request) => {
      const pathname = new URL(request.url).pathname;
      if (isLocalAuthenticationPath(pathname)) return localAuthentication.handler(request);
      if (isLocalGescomPath(pathname) && gescomHandler !== null) {
        return gescomHandler(request);
      }
      return apiHandler(request);
    };
const legacyApiUrl = process.env['MAGRIT_LEGACY_API_URL'];
const handler = createTransitionalApiHandler({
  localHandler,
  localPaths: new Set(['/api/v1/health', '/api/v1/readiness']),
  isLocalRequest: (request, url) => (
    (conversationsEnabled && isConversationsPath(url.pathname))
    || (actorResolver !== undefined && isDiagnosticsPath(url.pathname))
    || isAssistantPath(url.pathname)
    || (localAuthentication !== null && isLocalAuthenticationPath(url.pathname))
    || (sessionEnabled && isSessionPreferencesRequest(request.method, url.pathname))
    || (sessionEnabled && isSessionTenantSettingsRequest(request.method, url.pathname))
    || (sessionEnabled && request.method === 'POST' && url.pathname === '/api/v1/tenants')
    || (sessionEnabled && isSubTenantMutationRequest(request.method, url.pathname))
    || (sessionEnabled && isInvitationRequest(request.method, url.pathname))
    || (actorResolver !== undefined && isLibrariesPath(url.pathname))
    || (actorResolver !== undefined && isMembersPath(url.pathname))
    || (actorResolver !== undefined && isRolesPath(url.pathname))
    || (actorResolver !== undefined && isQuoteTemplatesPath(url.pathname))
    || (actorResolver !== undefined && isShopAdministrationPath(url.pathname))
    || isPublicShopPath(url.pathname)
    || (actorResolver !== undefined && isShopCustomerAdministrationPath(url.pathname))
    || isStorefrontSessionRequest(request.method, url.pathname)
    || (actorResolver !== undefined && isShopCustomerDelegationRequest(request.method, url.pathname))
    || (actorResolver !== undefined && isStorefrontActivationRequest(request.method, url.pathname))
    || isStorefrontPasswordRecoveryRequest(request.method, url.pathname)
    || (actorResolver !== undefined && isLocalCatalogRequest(request.method, url.pathname))
    || (gescomHandler !== null && isLocalGescomPath(url.pathname))
  ),
  ...(legacyApiUrl === undefined ? {} : { legacyApiUrl }),
});
const server = createNodeHttpServer(handler, {
  onUnhandledError(error) {
    console.error(JSON.stringify({ level: 'error', event: 'api.transport_error', error: errorMessage(error) }));
  },
});

server.listen(port, host, () => {
  console.info(JSON.stringify({
    level: 'info',
    event: 'api.started',
    address: `http://${host}:${port}`,
    mode: legacyApiUrl === undefined ? 'health-only' : 'transitional-proxy',
    modules: [
      ...(conversationsEnabled ? ['conversations'] : []),
      ...(diagnosticsRoutes.length === 0 ? [] : ['diagnostics']),
      'assistant',
      ...(localAuthentication === null ? [] : ['local-authentication']),
      ...(sessionEnabled ? ['session-bootstrap'] : []),
      ...(actorResolver === undefined ? [] : ['invitations']),
      ...(librariesRoutes.length === 0 ? [] : ['libraries']),
      ...(libraryProductsRoutes.length === 0 ? [] : ['library-products']),
      ...(actorResolver === undefined ? [] : ['members']),
      ...(actorResolver === undefined ? [] : ['roles']),
      ...(quoteTemplatesRoutes.length === 0 ? [] : ['quote-templates']),
      ...(actorResolver === undefined ? [] : ['catalog']),
      ...(shopAdministrationRoutes.length === 0 ? [] : ['shops:backoffice']),
      ...(shopCustomerAdministrationRoutes.length === 0 ? [] : ['shop-customers:backoffice']),
      ...(publicShopRoutes.length === 0 ? [] : ['shops:public-catalog']),
      'storefront-sessions',
      ...(shopCustomerDelegationRoutes.length === 0 ? [] : ['storefront-delegation']),
      ...(storefrontActivationRoutes.length === 0 ? [] : ['storefront-activation']),
      'storefront-password-recovery',
      ...(gescomHandler === null ? [] : ['commercial-settings']),
      ...(gescomHandler === null ? [] : ['production-steps']),
      ...(gescomHandler === null ? [] : ['customers']),
      ...(gescomHandler === null ? [] : ['project-tags']),
      ...(gescomHandler === null ? [] : ['price-rules']),
      ...(gescomHandler === null ? [] : ['projects']),
      ...(gescomHandler === null ? [] : ['commercial-line-files:project-item']),
      ...(gescomHandler === null ? [] : ['document-pdf-templates']),
      ...(commercialQuotesService === null ? [] : ['commercial-quotes']),
      ...(quoteDocumentsService === null ? [] : ['quote-documents:backoffice']),
    ],
  }));
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(async (error) => {
      await postgresPool.end();
      if (error) {
        console.error(JSON.stringify({ level: 'error', event: 'api.shutdown_failed', error: error.message }));
        process.exitCode = 1;
      }
    });
  });
}

function parsePort(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`MAGRIT_API_PORT invalide : ${value}`);
  }
  return parsed;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function catalogAutomationNotMigrated(): CatalogRejectedError {
  return new CatalogRejectedError(
    'upstream_error',
    'Cette automatisation PIM reste temporairement servie par l’API historique.',
  );
}

function isConversationsPath(pathname: string): boolean {
  return /^\/api\/v1\/tenants\/[^/]+\/conversations(?:\/[^/]+)?\/?$/.test(pathname);
}

function isDiagnosticsPath(pathname: string): boolean {
  return pathname === '/api/v1/diagnostics/ai'
    || pathname === '/api/v1/diagnostics/clariprint';
}

function isAssistantPath(pathname: string): boolean {
  return /^\/api\/v1\/(?:tenants\/[^/]+|public\/shops\/[^/]+)\/assistant\/category-editorial\/?$/.test(pathname);
}

function isLocalAuthenticationPath(pathname: string): boolean {
  return pathname === '/api/v1/auth' || pathname.startsWith('/api/v1/auth/');
}

function isLibrariesPath(pathname:string):boolean{
  return /^\/api\/v1\/tenants\/[^/]+\/(?:libraries|library-products)(?:\/[^/]+)?\/?$/.test(pathname);
}

function isQuoteTemplatesPath(pathname:string):boolean{
  return /^\/api\/v1\/tenants\/[^/]+\/quote-templates(?:\/[^/]+)?\/?$/.test(pathname);
}

function isShopCustomerDelegationRequest(method:string,pathname:string):boolean{
  return method==='POST'&&/^\/api\/v1\/tenants\/[^/]+\/shops\/[^/]+\/customers\/self-delegation\/?$/.test(pathname);
}

function isCommercialSettingsPath(pathname: string): boolean {
  return pathname === '/api/v1/commercial-settings';
}

function isLocalCatalogRequest(method: string, pathname: string): boolean {
  if (/^\/api\/v1\/tenants\/[^/]+\/catalog\/gamme-subscriptions\/?$/.test(pathname)) {
    return method === 'GET' || method === 'PUT';
  }
  if (pathname === '/api/v1/catalog/pim' || pathname === '/api/v1/catalog/pim/') {
    return method === 'GET';
  }
  if (/^\/api\/v1\/catalog\/pim\/gammes\/[^/]+\/?$/.test(pathname)) {
    return method === 'PUT' || method === 'DELETE';
  }
  if (pathname === '/api/v1/catalog/pim/definitions' || pathname === '/api/v1/catalog/pim/definitions/') {
    return method === 'PUT';
  }
  return method === 'DELETE'
    && /^\/api\/v1\/catalog\/pim\/definitions\/[^/]+\/?$/.test(pathname);
}

function isLocalGescomPath(pathname: string): boolean {
  return isCommercialSettingsPath(pathname)
    || /^\/api\/v1\/production-steps(?:\/[^/]+)?\/?$/.test(pathname)
    || pathname === '/api/v1/production-step-positions'
    || /^\/api\/v1\/project-tags(?:\/[^/]+)?\/?$/.test(pathname)
    || /^\/api\/v1\/price-rules(?:\/resolve|\/[^/]+)?\/?$/.test(pathname)
    || /^\/api\/v1\/product-ranges\/[^/]+\/default-margins\/?$/.test(pathname)
    || /^\/api\/v1\/projects(?:\/[^/]+(?:\/(?:items(?:\/[^/]+)?|hopstudio-items|tags))?)?\/?$/.test(pathname)
    || /^\/api\/v1\/commercial-line-files\/project_item\/[^/]+(?:\/[^/]+)?\/?$/.test(pathname)
    || /^\/api\/v1\/document-pdf-templates(?:\/[^/]+(?:\/(?:upload-urls|uploads|fields))?)?\/?$/.test(pathname)
    || pathname === '/api/v1/quotes'
    || pathname.startsWith('/api/v1/quotes/')
    || /^\/api\/v1\/customers(?:\/[^/]+(?:\/contacts(?:\/[^/]+)?|\/siret-verifications)?)?\/?$/.test(pathname);
}

function isSessionPreferencesRequest(method: string, pathname: string): boolean {
  return (method === 'GET' && pathname === '/api/v1/session')
    || (method === 'PATCH' && pathname === '/api/v1/session/preferences')
    || (method === 'PUT' && pathname === '/api/v1/session/current-tenant');
}

function isSessionTenantSettingsRequest(method: string, pathname: string): boolean {
  return (method === 'GET' && /^\/api\/v1\/tenant-slugs\/[^/]+\/?$/.test(pathname))
    || (method === 'PATCH' && /^\/api\/v1\/tenants\/[^/]+\/?$/.test(pathname));
}

function isSubTenantMutationRequest(method: string, pathname: string): boolean {
  return (method === 'POST' && /^\/api\/v1\/tenants\/[^/]+\/subtenants\/?$/.test(pathname))
    || (method === 'DELETE'
      && /^\/api\/v1\/tenants\/[^/]+\/subtenants\/[^/]+\/?$/.test(pathname));
}

function isInvitationRequest(method: string, pathname: string): boolean {
  if (method === 'POST' && pathname === '/api/v1/session/invitations/accept') return true;
  if (method === 'POST' && /^\/api\/v1\/invitations\/?$/.test(pathname)) return true;
  if (method === 'GET' && /^\/api\/v1\/invitations\/[^/]+\/activation\/?$/.test(pathname)) return true;
  if (/^\/api\/v1\/invitations\/[^/]+\/?$/.test(pathname)) return method === 'DELETE';
  if (/^\/api\/v1\/invitations\/[^/]+\/resend\/?$/.test(pathname)) return method === 'POST';
  return method === 'GET'
    && /^\/api\/v1\/tenants\/[^/]+\/(?:invitations|invitation-options)\/?$/.test(pathname);
}

function isMembersPath(pathname: string): boolean {
  return /^\/api\/v1\/tenants\/[^/]+\/members(?:\/[^/]+(?:\/(?:role|access))?)?\/?$/.test(pathname);
}

function isRolesPath(pathname: string): boolean {
  return /^\/api\/v1\/tenants\/[^/]+\/(?:capabilities\/[^/]+|access-profile|roles-overview|roles-catalog|roles(?:\/[^/]+)?|roles-order|members\/[^/]+\/roles-detail|members\/[^/]+\/roles\/[^/]+)\/?$/.test(pathname);
}

function isShopAdministrationPath(pathname: string): boolean {
  return /^\/api\/v1\/tenants\/[^/]+\/shops(?:\/[^/]+(?:\/(?:pricing(?:\/[^/]+)?|brand-assets|custom-mockups(?:\/[^/]+\/[^/]+)?|ai-products|products(?:\/[^/]+)?))?)?\/?$/.test(pathname);
}

function isPublicShopPath(pathname:string):boolean{
  return /^\/api\/v1\/public\/shops\/[^/]+\/(?:probe|catalog)\/?$/.test(pathname);
}

function isShopCustomerAdministrationPath(pathname: string): boolean {
  return /^\/api\/v1\/tenants\/[^/]+\/shops\/[^/]+\/customers(?:\/self)?\/?$/.test(pathname);
}

function isStorefrontSessionRequest(method: string, pathname: string): boolean {
  if (pathname === '/api/v1/storefront/session/current') return method === 'GET' || method === 'DELETE';
  return method === 'POST' && /^\/api\/v1\/storefront\/[^/]+\/(?:session|registration)\/?$/.test(pathname);
}

function isStorefrontActivationRequest(method: string, pathname: string): boolean {
  return method === 'POST' && (pathname === '/api/v1/storefront/activation'
    || /^\/api\/v1\/tenants\/[^/]+\/shops\/[^/]+\/customers\/[^/]+\/activation\/?$/.test(pathname));
}

function isStorefrontPasswordRecoveryRequest(method: string, pathname: string): boolean {
  return method === 'POST' && (pathname === '/api/v1/storefront/password-reset'
    || /^\/api\/v1\/storefront\/[^/]+\/password-recovery\/?$/.test(pathname));
}
