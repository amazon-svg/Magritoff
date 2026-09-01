/**
 * Routes de la facade HISTORIQUE, sorties de l edge function.
 *
 * ------------------------------------------------------------------------
 * POURQUOI CE FICHIER EXISTE
 * ------------------------------------------------------------------------
 * La liste des ~22 fabriques vivait en dur dans
 * `supabase/functions/magrit-api/index.ts`, fichier qui n est ni typecheckee
 * ni testable. Deux consequences :
 *
 * 1. le test de composition ne pouvait exercer `assertNoFacadeCollision` que
 *    sur des routes synthetiques — la seule chose qui compte, le recouvrement
 *    entre la facade E10 et le JEU REEL de routes historiques, n etait
 *    verifiee nulle part ;
 * 2. la detection de collision n avait lieu qu a l interieur de
 *    `handleRequest`, donc a chaque requete : une collision aurait leve une
 *    erreur en continu plutot qu un echec de demarrage propre.
 *
 * `LEGACY_ROUTE_DEFINITIONS` corrige les deux : les definitions sont
 * construites au CHARGEMENT DU MODULE, et la verification de collision est
 * faite ici meme, une fois. Importer ce module echoue si les deux facades se
 * recouvrent — c est le « refus au demarrage » que la documentation promet.
 */
import type { AssistantService } from '../../modules/diagnostics/application/assistant-service.ts';
import type { CatalogService } from '../../modules/catalog/application/catalog-service.ts';
import type { ClariprintService } from '../../modules/clariprint/application/clariprint-service.ts';
import type { CommercialService } from '../../modules/commercial/application/commercial-service.ts';
import type { ConversationsService } from '../../modules/conversations/application/conversations-service.ts';
import type { DiagnosticsService } from '../../modules/diagnostics/application/diagnostics-service.ts';
import type { InvitationsService } from '../../modules/invitations/application/invitations-service.ts';
import type { LibrariesService } from '../../modules/libraries/application/libraries-service.ts';
import type { LibraryProductsService } from '../../modules/libraries/application/library-products-service.ts';
import type { MembersService } from '../../modules/members/application/members-service.ts';
import type { OrdersService } from '../../modules/orders/application/orders-service.ts';
import type { QuoteTemplatesService } from '../../modules/quote-templates/application/quote-templates-service.ts';
import type { QuotesService } from '../../modules/quotes/application/quotes-service.ts';
import type { RolesService } from '../../modules/roles/application/roles-service.ts';
import type { SessionService } from '../../modules/session/application/session-service.ts';
import type { ShopCustomerDelegationService } from '../../modules/shop-customers/application/shop-customer-delegation-service.ts';
import type { ShopCustomerInvitationService } from '../../modules/shop-customers/application/shop-customer-invitation-service.ts';
import type { ShopCustomersService } from '../../modules/shop-customers/application/shop-customers-service.ts';
import type { ShopsService } from '../../modules/shops/application/shops-service.ts';
import type { StorefrontActivationService } from '../../modules/shop-customers/application/storefront-activation-service.ts';
import type { StorefrontAuthenticationService } from '../../modules/shop-customers/application/storefront-authentication-service.ts';
import type { StorefrontPasswordRecoveryService } from '../../modules/shop-customers/application/storefront-password-recovery-service.ts';
import type { StorefrontRegistrationService } from '../../modules/shop-customers/application/storefront-registration-service.ts';
import type { StorefrontSessionService } from '../../modules/shop-customers/application/storefront-session-service.ts';
import {
  storefrontSessionCookiePolicy,
  type StorefrontSessionCookiePolicy,
} from '../storefront/session-cookie.ts';
import { assertNoFacadeCollision } from './api-facade-router.ts';
import { createAssistantRoutes, type StorefrontEditorialAuthorizer } from './assistant-routes.ts';
import { createCatalogRoutes } from './catalog-routes.ts';
import { createClariprintRoutes } from './clariprint-routes.ts';
import { createCommercialRoutes } from './commercial-routes.ts';
import { createConversationsRoutes } from './conversations-routes.ts';
import { createDiagnosticsRoutes } from './diagnostics-routes.ts';
import { GESCOM_ROUTES } from './gescom-routes.ts';
import { createInvitationsRoutes } from './invitations-routes.ts';
import { createLibrariesRoutes } from './libraries-routes.ts';
import { createLibraryProductsRoutes } from './library-products-routes.ts';
import { createMembersRoutes } from './members-routes.ts';
import { createOrdersRoutes } from './orders-routes.ts';
import { createQuoteTemplatesRoutes } from './quote-templates-routes.ts';
import { createQuotesRoutes } from './quotes-routes.ts';
import { createRolesRoutes } from './roles-routes.ts';
import { createSessionRoutes } from './session-routes.ts';
import { createShopCustomerDelegationRoutes } from './shop-customer-delegation-routes.ts';
import { createShopCustomerInvitationRoutes } from './shop-customer-invitation-routes.ts';
import { createShopCustomersRoutes } from './shop-customers-routes.ts';
import { createShopsRoutes } from './shops-routes.ts';
import { createStorefrontActivationRoutes } from './storefront-activation-routes.ts';
import { createStorefrontPasswordRecoveryRoutes } from './storefront-password-recovery-routes.ts';
import { createStorefrontSessionRoutes } from './storefront-session-routes.ts';
import type { ApiRoute } from './routes.ts';

/** Services de la facade historique, tous lies au client Supabase de la requete. */
export type LegacyApiServices = Readonly<{
  session: SessionService;
  orders: OrdersService;
  invitations: InvitationsService;
  members: MembersService;
  roles: RolesService;
  shops: ShopsService;
  shopCustomers: ShopCustomersService;
  shopCustomerInvitations: ShopCustomerInvitationService;
  shopCustomerDelegations: ShopCustomerDelegationService;
  storefrontAuthentication: StorefrontAuthenticationService;
  storefrontRegistration: StorefrontRegistrationService;
  storefrontSessions: StorefrontSessionService;
  storefrontActivation: StorefrontActivationService;
  storefrontPasswordRecovery: StorefrontPasswordRecoveryService;
  catalog: CatalogService;
  conversations: ConversationsService;
  diagnostics: DiagnosticsService;
  assistant: AssistantService;
  clariprint: ClariprintService;
  quotes: QuotesService;
  quoteTemplates: QuoteTemplatesService;
  libraries: LibrariesService;
  libraryProducts: LibraryProductsService;
  commercial: CommercialService;
  storefrontCookiePolicy: StorefrontSessionCookiePolicy;
  authorizeStorefrontEditorial: StorefrontEditorialAuthorizer;
}>;

/** Compose la facade historique. L ordre est celui d origine, inchange. */
export function createLegacyApiRoutes(services: LegacyApiServices): readonly ApiRoute[] {
  const { storefrontCookiePolicy, storefrontSessions } = services;
  return [
    ...createSessionRoutes(services.session),
    ...createOrdersRoutes(services.orders, storefrontSessions, storefrontCookiePolicy),
    ...createInvitationsRoutes(services.invitations),
    ...createMembersRoutes(services.members),
    ...createRolesRoutes(services.roles),
    ...createShopsRoutes(services.shops, storefrontSessions, storefrontCookiePolicy),
    ...createShopCustomersRoutes(services.shopCustomers),
    ...createShopCustomerInvitationRoutes(services.shopCustomerInvitations),
    ...createStorefrontSessionRoutes(
      services.storefrontAuthentication,
      services.storefrontRegistration,
      storefrontSessions,
      storefrontCookiePolicy,
    ),
    ...createStorefrontActivationRoutes(services.storefrontActivation, storefrontCookiePolicy),
    ...createStorefrontPasswordRecoveryRoutes(services.storefrontPasswordRecovery),
    ...createShopCustomerDelegationRoutes(
      services.shopCustomerDelegations,
      storefrontCookiePolicy,
    ),
    ...createCatalogRoutes(services.catalog),
    ...createConversationsRoutes(services.conversations),
    ...createDiagnosticsRoutes(services.diagnostics),
    ...createAssistantRoutes(services.assistant, services.authorizeStorefrontEditorial),
    ...createClariprintRoutes(services.clariprint),
    ...createQuotesRoutes(services.quotes),
    ...createQuoteTemplatesRoutes(services.quoteTemplates),
    ...createLibrariesRoutes(services.libraries),
    ...createLibraryProductsRoutes(services.libraryProducts),
    ...createCommercialRoutes(services.commercial),
  ];
}

/**
 * DEFINITIONS des routes historiques : chemins et methodes, sans service reel.
 *
 * Aucune fabrique ne dereference son service a la construction — toutes se
 * contentent de le capturer pour leurs handlers. Un mandataire qui refuse
 * toute lecture suffit donc a enumerer les definitions, et garantit qu aucun
 * handler ne sera execute par erreur depuis ce jeu de routes.
 *
 * Sert a la detection de collision et aux tests, jamais a servir une requete.
 */
export const LEGACY_ROUTE_DEFINITIONS: readonly ApiRoute[] = Object.freeze(
  createLegacyApiRoutes(definitionOnlyServices()),
);

// Verification au CHARGEMENT DU MODULE : importer ce fichier — ce que fait
// l edge function a son demarrage a froid, et la CI a chaque test — echoue si
// un chemin E10 recouvre un chemin historique. La panne est alors franche et
// immediate, au lieu d une erreur levee a chaque requete en production.
assertNoFacadeCollision(GESCOM_ROUTES, LEGACY_ROUTE_DEFINITIONS);

function definitionOnlyServices(): LegacyApiServices {
  const refuse = (): never => {
    throw new Error(
      'LEGACY_ROUTE_DEFINITIONS enumere des DEFINITIONS de routes (chemins, methodes) ; ' +
        'il ne doit jamais executer de handler. Utiliser createLegacyApiRoutes() avec de vrais services.',
    );
  };
  const service = new Proxy({}, { get: refuse, apply: refuse });

  return new Proxy(
    {},
    {
      get(_target, property) {
        // Le seul argument qui n est pas un service : la politique de cookie,
        // valeur pure, sans effet sur les chemins declares.
        if (property === 'storefrontCookiePolicy') return storefrontSessionCookiePolicy(true);
        if (property === 'authorizeStorefrontEditorial') return async () => null;
        return service;
      },
    },
  ) as LegacyApiServices;
}
