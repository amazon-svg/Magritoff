/**
 * Routes HTTP du module Clients (story E10.4), sur la facade Gestion
 * commerciale (`defineGescomRoute`, E10.0).
 *
 * Ecriture reservee aux jetons utilisateur (`authentication: 'user'`) :
 * cette story n ouvre aucun scope d ecriture aux cles de service. Lecture
 * ouverte a Studio via `customers:read` (deja declare par E10.0).
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1) — sans quoi
 * `tests/architecture/gescom-api-socle-boundaries.test.ts` echoue.
 */
import {
  customerContactSchema,
  customerDetailSchema,
  customerSchema,
  customersListSchema,
  createCustomerCommandSchema,
  createCustomerContactCommandSchema,
  siretVerificationResultSchema,
  updateCustomerCommandSchema,
  updateCustomerContactCommandSchema,
  type CustomerDetailDto,
  type CustomerDto,
} from '../../modules/customers/api/contracts.ts';
import type { CustomersService } from '../../modules/customers/application/customers-service.ts';
import {
  CustomerCommandRejectedError,
  CustomerNotFoundError,
} from '../../modules/customers/application/customers-repository.ts';
import {
  assertPrecondition,
  buildPage,
  computeEntityTag,
  decodeCursor,
  problem,
  SHARED_PROBLEM_CODES,
} from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

const CUSTOMER_TYPES = ['company', 'individual'] as const;

export function createCustomersRoutes(service: CustomersService): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/customers',
      operationId: 'listCustomers',
      requiredScopes: ['customers:read'],
      inputSchema: null,
      dataSchema: customersListSchema,
      async handle(context) {
        const q = context.url.searchParams.get('q');
        const typeParam = context.url.searchParams.get('type');
        const type = (CUSTOMER_TYPES as readonly string[]).includes(typeParam ?? '')
          ? (typeParam as (typeof CUSTOMER_TYPES)[number])
          : null;
        const cursor = context.page.cursor ? decodeCursor(context.page.cursor) : null;

        const result = await service.list(context.tenantId, {
          q,
          type,
          size: context.page.size,
          cursor,
        });
        const page = buildPage(result.rows, context.page, (row) => ({
          sort: row.created_at,
          id: row.id,
        }));

        return {
          status: 200,
          data: page.items,
          meta: { next_cursor: page.nextCursor, page_size: context.page.size },
        };
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/customers',
      operationId: 'createCustomer',
      authentication: 'user',
      createsResource: true,
      inputSchema: createCustomerCommandSchema,
      dataSchema: customerSchema,
      async handle(context, input) {
        return withDomainErrors(async () => ({
          status: 201,
          data: await service.create(context.tenantId, requireUserId(context), input),
        }));
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/customers/{customerId}',
      operationId: 'getCustomer',
      requiredScopes: ['customers:read'],
      inputSchema: null,
      dataSchema: customerDetailSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const detail = await service.getDetail(context.tenantId, context.params['customerId']!);
          // L ETag porte sur les champs PROPRES au client (CA9), pas sur ses
          // interlocuteurs : ceux-ci sont versionnes independamment, par leur
          // propre ETag (`getCustomerContact`). Sans cette distinction, un
          // If-Match lu ici ne matcherait jamais celui verifie par
          // `updateCustomer`, qui compare le meme sous-ensemble de champs.
          return { status: 200, data: detail, etag: await computeEntityTag(customerSummaryOf(detail)) };
        });
      },
    }),

    defineGescomRoute({
      method: 'PATCH',
      path: '/customers/{customerId}',
      operationId: 'updateCustomer',
      authentication: 'user',
      inputSchema: updateCustomerCommandSchema,
      dataSchema: customerSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const customerId = context.params['customerId']!;
          const current = await service.getSummary(context.tenantId, customerId);
          const currentTag = await computeEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.update(context.tenantId, customerId, input);
          return { status: 200, data: updated, etag: await computeEntityTag(updated) };
        });
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/customers/{customerId}/contacts',
      operationId: 'listCustomerContacts',
      requiredScopes: ['customers:read'],
      inputSchema: null,
      dataSchema: customerContactSchema.array(),
      async handle(context) {
        return withDomainErrors(async () => ({
          status: 200,
          data: await service.listContacts(context.tenantId, context.params['customerId']!),
        }));
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/customers/{customerId}/contacts',
      operationId: 'createCustomerContact',
      authentication: 'user',
      createsResource: true,
      inputSchema: createCustomerContactCommandSchema,
      dataSchema: customerContactSchema,
      async handle(context, input) {
        return withDomainErrors(async () => ({
          status: 201,
          data: await service.createContact(
            context.tenantId,
            context.params['customerId']!,
            input,
          ),
        }));
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/customers/{customerId}/contacts/{contactId}',
      operationId: 'getCustomerContact',
      requiredScopes: ['customers:read'],
      inputSchema: null,
      dataSchema: customerContactSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const contact = await service.getContact(
            context.tenantId,
            context.params['customerId']!,
            context.params['contactId']!,
          );
          return { status: 200, data: contact, etag: await computeEntityTag(contact) };
        });
      },
    }),

    defineGescomRoute({
      method: 'PATCH',
      path: '/customers/{customerId}/contacts/{contactId}',
      operationId: 'updateCustomerContact',
      authentication: 'user',
      inputSchema: updateCustomerContactCommandSchema,
      dataSchema: customerContactSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const customerId = context.params['customerId']!;
          const contactId = context.params['contactId']!;
          const current = await service.getContact(context.tenantId, customerId, contactId);
          const currentTag = await computeEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.updateContact(
            context.tenantId,
            customerId,
            contactId,
            input,
          );
          return { status: 200, data: updated, etag: await computeEntityTag(updated) };
        });
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/customers/{customerId}/siret-verifications',
      operationId: 'verifyCustomerSiret',
      authentication: 'user',
      createsResource: true,
      inputSchema: null,
      dataSchema: siretVerificationResultSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const outcome = await service.verifySiret(context.tenantId, context.params['customerId']!);
          return {
            status: 201,
            data: {
              siret: outcome.siret,
              verified: outcome.verified,
              company_name: outcome.companyName,
              naf_code: outcome.nafCode,
              active: outcome.active,
              mocked: outcome.mocked,
              checked_at: outcome.checkedAt,
            },
          };
        });
      },
    }),
  ];
}

/**
 * Sous-ensemble d une fiche client detaillee correspondant a la ressource
 * `Customer` (sans interlocuteurs ni points d extension). Utilise UNIQUEMENT
 * pour la base de calcul de l ETag (CA9) : `getCustomer` et `updateCustomer`
 * doivent produire le meme hash pour le meme etat, quelle que soit la forme
 * du corps qu ils renvoient par ailleurs.
 */
function customerSummaryOf(detail: CustomerDetailDto): CustomerDto {
  const { contacts: _contacts, projects: _projects, quotes: _quotes, orders: _orders, ...summary } =
    detail;
  return summary;
}

/** L identifiant utilisateur qui cree la ressource (audit `created_by`). */
function requireUserId(context: GescomRequestContext): import('../../kernel/ids/index.ts').UserId {
  if (context.principal.kind !== 'user') {
    // Ne devrait jamais arriver : la route est `authentication: 'user'`, donc
    // `assertUserPrincipal` a deja ecarte toute cle de service avant `handle`.
    throw problem({
      status: 403,
      title: 'Acteur utilisateur requis',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
    });
  }
  return context.principal.userId;
}

/** Traduit les erreurs de domaine du module Clients en Problem RFC 7807. */
async function withDomainErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CustomerNotFoundError) {
      throw problem({ status: 404, title: 'Client introuvable', code: SHARED_PROBLEM_CODES.notFound });
    }
    if (error instanceof CustomerCommandRejectedError) {
      throw problem({
        status: error.code === 'customer.siret_already_used' ? 409 : 422,
        title: 'Commande refusee',
        code: error.code,
        detail: error.message,
        ...(error.fieldErrors.length > 0 ? { errors: error.fieldErrors } : {}),
      });
    }
    throw error;
  }
}
