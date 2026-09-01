/**
 * Routes HTTP de l ouverture/revocation d un acces boutique depuis un
 * interlocuteur (story E10.5), sur la facade Gestion commerciale
 * (`defineGescomRoute`, E10.0).
 *
 * Composition volontairement au niveau ROUTE (pas application) : le module
 * Clients (E10.4) ne connait pas `shop-customers`, et reciproquement. C est
 * cette couche, et elle seule, qui assemble `CustomersService` (proprietaire
 * de `customer_contacts`) et `CustomerContactShopAccessService`
 * (proprietaire de `shop_customer_accounts`).
 *
 * Aucune route de conversion de type de compte n existe ici ni ailleurs :
 * l exclusivite `tenant_members` / `shop_customer_accounts` est portee en
 * base (CA5, migration 20260901000400).
 */
import {
  customerContactShopAccessSchema,
  openCustomerContactShopAccessCommandSchema,
  revokeCustomerContactShopAccessCommandSchema,
  revokeCustomerContactShopAccessResultSchema,
} from '../../modules/customers/api/contracts.ts';
import type { CustomersService } from '../../modules/customers/application/customers-service.ts';
import { CustomerNotFoundError } from '../../modules/customers/application/customers-repository.ts';
import {
  CustomerContactShopAccessRejectedError,
  type CustomerContactShopAccessService,
} from '../../modules/shop-customers/application/customer-contact-shop-access-service.ts';
import { ShopCustomerRejectedError } from '../../modules/shop-customers/application/shop-customers-repository.ts';
import { problem, SHARED_PROBLEM_CODES } from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

export function createCustomerShopAccessRoutes(
  customers: CustomersService,
  shopAccess: CustomerContactShopAccessService,
): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'POST',
      path: '/customers/{customerId}/contacts/{contactId}/shop-access',
      operationId: 'openCustomerContactShopAccess',
      authentication: 'user',
      createsResource: true,
      inputSchema: openCustomerContactShopAccessCommandSchema,
      dataSchema: customerContactShopAccessSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const customerId = context.params['customerId']!;
          const contactId = context.params['contactId']!;
          const contact = await customers.getContact(context.tenantId, customerId, contactId);

          await shopAccess.open(
            requireUserId(context),
            context.tenantId,
            input.shop_id,
            contactId,
            {
              email: contact.email,
              fullName: `${contact.first_name} ${contact.last_name}`.trim(),
            },
            publicAppBaseUrl(context.request),
          );

          // Toujours restitue `invited` : le sens de l appel est « un lien
          // d activation vient d etre (re)emis ». `active` n est atteint que
          // plus tard, quand l interlocuteur active reellement son compte —
          // c est `GET .../contacts` (champ `shop_accesses`) qui en fait foi
          // ensuite, meme convention que `ShopCustomerInvitationService`.
          return { status: 201, data: { shop_id: input.shop_id, status: 'invited' as const } };
        });
      },
    }),

    defineGescomRoute({
      method: 'DELETE',
      path: '/customers/{customerId}/contacts/{contactId}/shop-access',
      operationId: 'revokeCustomerContactShopAccess',
      authentication: 'user',
      inputSchema: revokeCustomerContactShopAccessCommandSchema,
      dataSchema: revokeCustomerContactShopAccessResultSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const customerId = context.params['customerId']!;
          const contactId = context.params['contactId']!;
          // 404 si le client/l interlocuteur n existe pas dans CE tenant —
          // avant meme de toucher shop_customer_accounts.
          await customers.getContact(context.tenantId, customerId, contactId);

          await shopAccess.revoke(requireUserId(context), context.tenantId, input.shop_id, contactId);
          return { status: 200, data: { revoked: true as const } };
        });
      },
    }),
  ];
}

/** L identifiant utilisateur qui agit (audit `created_by_magrit_user_id`). */
function requireUserId(context: GescomRequestContext): import('../../kernel/ids/index.ts').UserId {
  if (context.principal.kind !== 'user') {
    throw problem({
      status: 403,
      title: 'Acteur utilisateur requis',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
    });
  }
  return context.principal.userId;
}

/** Meme heuristique que `shop-customer-invitation-routes.ts` (facade historique). */
function publicAppBaseUrl(request: Request): string {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.origin;
    } catch {
      /* repli sur l’origine de la requête */
    }
  }
  return new URL(request.url).origin;
}

async function withDomainErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CustomerNotFoundError) {
      throw problem({ status: 404, title: 'Client ou interlocuteur introuvable', code: SHARED_PROBLEM_CODES.notFound });
    }
    if (error instanceof CustomerContactShopAccessRejectedError) {
      throw problem(mapShopAccessRejection(error));
    }
    if (error instanceof ShopCustomerRejectedError) {
      throw problem(mapShopCustomerRejection(error));
    }
    throw error;
  }
}

function mapShopAccessRejection(
  error: CustomerContactShopAccessRejectedError,
): Parameters<typeof problem>[0] {
  switch (error.code) {
    case 'already_open':
      return {
        status: 409,
        title: 'Acces boutique deja ouvert',
        code: 'customer_contact.shop_access_already_open',
        detail: error.message,
      };
    case 'email_conflict':
      return {
        status: 409,
        title: 'Email deja utilise dans cette boutique',
        code: 'customer_contact.shop_access_email_conflict',
        detail: error.message,
      };
    case 'not_open':
      return {
        status: 404,
        title: 'Aucun acces boutique ouvert',
        code: 'customer_contact.shop_access_not_open',
        detail: error.message,
      };
    case 'activation_unavailable':
      return {
        status: 422,
        title: 'Emission du lien impossible',
        code: 'customer_contact.shop_access_activation_unavailable',
        detail: error.message,
      };
  }
}

function mapShopCustomerRejection(error: ShopCustomerRejectedError): Parameters<typeof problem>[0] {
  const status = error.code === 'shop_not_found' || error.code === 'account_not_found'
    ? 404
    : error.code === 'duplicate_email'
      ? 409
      : error.code === 'invalid_request'
        ? 422
        : 403;
  return {
    status,
    title: status === 404 ? 'Boutique ou compte introuvable'
      : status === 409 ? 'Compte boutique deja existant'
        : status === 422 ? 'Requete invalide' : 'Gestion de l acces boutique interdite',
    code: `customer_contact.${error.code}`,
    detail: error.message,
  };
}
