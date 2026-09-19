import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { computeEntityTag } from '../../modules/_shared/application/index.ts';
import { ETAG_HEADER, IF_MATCH_HEADER } from '../../modules/_shared/api/index.ts';
import {
  orderAuditTrailSchema,
  ordersListSchema,
  portalOrdersResponseSchema,
  transitionOrderCommandSchema,
  transitionOrderResultSchema,
  createOrderCommandSchema,
  createOrderResultSchema,
  draftOrderSchema,
  updateDraftOrderCommandSchema,
  updateDraftOrderResultSchema,
  orderRolesResponseSchema,
} from '../../modules/orders/api/contracts.ts';
import type { OrdersService } from '../../modules/orders/application/orders-service.ts';
import { OrderCommandRejectedError } from '../../modules/orders/application/orders-repository.ts';
import type { StorefrontSessionService } from '../../modules/shop-customers/application/storefront-session-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';
import { readStorefrontSessionCookie, type StorefrontSessionCookiePolicy } from '../storefront/session-cookie.ts';

export function createOrdersRoutes(
  service: OrdersService,
  storefrontSessions?: StorefrontSessionService,
  storefrontCookiePolicy?: StorefrontSessionCookiePolicy,
): readonly ApiRoute[] {
  return [
    defineJsonRoute({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/orders`,
      authentication: 'public',
      inputSchema: createOrderCommandSchema,
      outputSchema: createOrderResultSchema,
      async handle(context, command) {
        try {
          const authorization = await orderCreationAuthorization(
            context, command.shopId, storefrontSessions, storefrontCookiePolicy,
          );
          return {
            status: 201,
            body: await service.create(command, new URL(context.request.url).origin, authorization),
          };
        } catch (error) {
          if (error instanceof OrderCommandRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
    defineJsonRoute({
      method: 'GET',
      path: `${API_V1_BASE_PATH}/orders/{orderId}/draft`,
      authentication: 'public',
      inputSchema: null,
      outputSchema: draftOrderSchema,
      async handle(context) {
        try {
          const body = await service.getDraft(
            context.params.orderId ?? '',
            await orderResourceAuthorization(context, storefrontSessions, storefrontCookiePolicy),
          );
          // Q17-a (docs/api/CONVENTIONS.md §8.25 point 12 (e)) — deux lignes
          // ajoutées « quand même » : cette route n a jamais porté d ETag
          // (façade historique, PUT sans précondition). Il n est PAS exigé
          // ici — un If-Match ne fermerait pas le trou constaté, la
          // vérification se refait à la transition — mais rien n empêche de
          // l émettre pour l appelant qui veut le lire.
          return { status: 200, body, headers: { [ETAG_HEADER]: await computeEntityTag(body) } };
        } catch (error) {
          if (error instanceof OrderCommandRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
    defineJsonRoute({
      method: 'PUT',
      path: `${API_V1_BASE_PATH}/orders/{orderId}/draft`,
      authentication: 'public',
      inputSchema: updateDraftOrderCommandSchema,
      outputSchema: updateDraftOrderResultSchema,
      async handle(context, command) {
        try {
          const authorization = await orderResourceAuthorization(context, storefrontSessions, storefrontCookiePolicy);
          const orderId = context.params.orderId ?? '';
          // Q17-a (point 12 (e)) — honoré QUAND IL EST PRÉSENT, jamais
          // exigé (dérogation R5 déclarée : cette route reste un PUT de la
          // façade historique sans précondition obligatoire ; l exiger
          // casserait un onglet resté ouvert. Chemin de mise en conformité :
          // la migration de cette route vers l enveloppe E10, après Q17-b).
          const ifMatch = context.request.headers.get(IF_MATCH_HEADER);
          if (ifMatch !== null && ifMatch.trim().length > 0) {
            const current = await service.getDraft(orderId, authorization);
            const currentTag = await computeEntityTag(current);
            if (ifMatch.replace(/^W\//, '').trim() !== currentTag) {
              throw new ApiHttpError({
                type: 'about:blank', title: 'Brouillon modifié depuis sa dernière lecture', status: 409,
                code: 'orders.draft_changed',
                detail: 'Le brouillon a changé depuis la lecture référencée par If-Match. Rechargez-le avant de le modifier.',
              });
            }
          }
          return {
            status: 200,
            body: await service.updateDraft(orderId, command, authorization),
          };
        } catch (error) {
          if (error instanceof OrderCommandRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
    defineJsonRoute({
      method: 'GET',
      path: `${API_V1_BASE_PATH}/orders/{orderId}/roles`,
      authentication: 'required',
      inputSchema: null,
      outputSchema: orderRolesResponseSchema,
      async handle(context) {
        requireUserId(context);
        try {
          return { status: 200, body: await service.getRoles(context.params.orderId ?? '') };
        } catch (error) {
          if (error instanceof OrderCommandRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
    defineJsonRoute({
      method: 'GET',
      path: `${API_V1_BASE_PATH}/tenants/{tenantId}/orders`,
      authentication: 'required',
      inputSchema: null,
      outputSchema: ordersListSchema,
      async handle(context) {
        requireUserId(context);
        const shopIds = new URL(context.request.url).searchParams.getAll('shopId').filter(Boolean);
        return { status: 200, body: await service.listTenantOrders(requireParam(context, 'tenantId'), shopIds) };
      },
    }),
    defineJsonRoute({
      method: 'GET',
      path: `${API_V1_BASE_PATH}/shops/{shopId}/orders`,
      authentication: 'public',
      inputSchema: null,
      outputSchema: portalOrdersResponseSchema,
      async handle(context) {
        const shopId = requireParam(context, 'shopId');
        return {
          status: 200,
          body: await service.listPortalOrders(
            shopId,
            await portalOrdersAuthorization(
              context, shopId, storefrontSessions, storefrontCookiePolicy,
            ),
          ),
        };
      },
    }),
    defineJsonRoute({
      method: 'GET',
      path: `${API_V1_BASE_PATH}/orders/{orderId}/audit`,
      authentication: 'public',
      inputSchema: null,
      outputSchema: orderAuditTrailSchema,
      async handle(context) {
        try {
          return {
            status: 200,
            body: await service.getAuditTrail(
              requireParam(context, 'orderId'),
              await orderResourceAuthorization(context, storefrontSessions, storefrontCookiePolicy),
            ),
          };
        } catch (error) {
          if (error instanceof OrderCommandRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
    defineJsonRoute({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/orders/{orderId}/transitions`,
      authentication: 'public',
      inputSchema: transitionOrderCommandSchema,
      outputSchema: transitionOrderResultSchema,
      async handle(context, command) {
        try {
          return {
            status: 200,
            body: await service.transition(
              requireParam(context, 'orderId'),
              command,
              await transitionAuthorization(context, storefrontSessions, storefrontCookiePolicy),
              new URL(context.request.url).origin,
            ),
          };
        } catch (error) {
          if (!(error instanceof OrderCommandRejectedError)) throw error;
          throw toHttpError(error);
        }
      },
    }),
  ];
}

async function orderCreationAuthorization(
  context: ApiRequestContext,
  shopId: string,
  sessions?: StorefrontSessionService,
  policy?: StorefrontSessionCookiePolicy,
) {
  if (sessions && policy) {
    const token = readStorefrontSessionCookie(context.request.headers.get('cookie'), policy);
    const session = token ? await sessions.current(token) : null;
    if (token && session?.identity.shopId === shopId) {
      return { kind: 'storefront_session' as const, opaqueToken: token };
    }
  }
  if (context.actor?.kind !== 'user') {
    throw new ApiHttpError({
      type: 'about:blank', title: 'Authentification requise', status: 401,
      code: 'identity.authentication_required',
    });
  }
  return { kind: 'magrit_user' as const };
}

async function portalOrdersAuthorization(
  context: ApiRequestContext,
  shopId: string,
  sessions?: StorefrontSessionService,
  policy?: StorefrontSessionCookiePolicy,
) {
  if (sessions && policy) {
    const token = readStorefrontSessionCookie(context.request.headers.get('cookie'), policy);
    const session = token ? await sessions.current(token) : null;
    if (token && session?.identity.shopId === shopId) {
      return { kind: 'storefront_session' as const, opaqueToken: token };
    }
  }
  if (context.actor?.kind !== 'user') {
    throw new ApiHttpError({
      type: 'about:blank', title: 'Authentification requise', status: 401,
      code: 'identity.authentication_required',
    });
  }
  return { kind: 'magrit_user' as const, userId: requireUserId(context) };
}

async function orderResourceAuthorization(
  context: ApiRequestContext,
  sessions?: StorefrontSessionService,
  policy?: StorefrontSessionCookiePolicy,
) {
  let storefrontToken: string | null = null;
  if (sessions && policy) {
    const token = readStorefrontSessionCookie(context.request.headers.get('cookie'), policy);
    if (token && await sessions.current(token)) storefrontToken = token;
  }
  if (!storefrontToken && context.actor?.kind !== 'user') {
    throw new ApiHttpError({
      type: 'about:blank', title: 'Authentification requise', status: 401,
      code: 'identity.authentication_required',
    });
  }
  return { storefrontToken };
}

async function transitionAuthorization(
  context: ApiRequestContext,
  sessions?: StorefrontSessionService,
  policy?: StorefrontSessionCookiePolicy,
) {
  let storefrontToken: string | null = null;
  if (sessions && policy) {
    const token = readStorefrontSessionCookie(context.request.headers.get('cookie'), policy);
    if (token && await sessions.current(token)) storefrontToken = token;
  }
  const magritUserId = context.actor?.kind === 'user' ? requireUserId(context) : null;
  if (!storefrontToken && !magritUserId) {
    throw new ApiHttpError({
      type: 'about:blank', title: 'Authentification requise', status: 401,
      code: 'identity.authentication_required',
    });
  }
  return { storefrontToken, magritUserId };
}

function toHttpError(error: OrderCommandRejectedError): ApiHttpError {
  const status = error.code === 'order_not_found' || error.code === 'shop_not_found' ? 404
    : error.code === 'permission_denied' ? 403
      // Q17-a (point 12 (b)) — un product_id hors catalogue de la boutique
      // est un panier INVALIDE, au même titre qu un libellé ou un prix
      // absent : 422, pas 409 (le corps n a rien à comparer, contrairement à
      // price_changed).
      : (error.code === 'invalid_order_items' || error.code === 'product_not_in_shop') ? 422 : 409;
  return new ApiHttpError({
    type: 'about:blank',
    title: status === 404 ? 'Ressource Orders introuvable'
      : status === 403 ? 'Commande interdite'
        : status === 422 ? 'Articles de commande invalides'
          : error.code === 'order_not_editable' ? 'Commande non modifiable'
            // Q17-a (point 12 (d), (c)) — deux 409 nouveaux, distincts du
            // conflit de transition générique.
            : error.code === 'price_changed' ? 'Le prix a changé'
              : error.code === 'unverified_prices' ? 'Prix non vérifiés'
                : 'Transition impossible',
    status,
    code: `orders.${error.code}`,
    detail: error.message,
    // Q17-a (point 12 (d)) — une entrée par ligne divergente, jamais vide
    // quand le code est price_changed.
    ...(error.priceMismatches.length > 0 ? {
      errors: error.priceMismatches.map((mismatch) => ({
        product_label: mismatch.productLabel,
        submitted: mismatch.submitted,
        current: mismatch.current,
      })),
    } : {}),
  });
}

function requireUserId(context: ApiRequestContext): UserId {
  if (context.actor?.kind !== 'user') {
    throw new ApiHttpError({
      type: 'about:blank', title: 'Acteur utilisateur requis', status: 403,
      code: 'identity.user_actor_required',
    });
  }
  const parsed = parseId<'UserId'>(context.actor.userId);
  if (!parsed.ok) throw new Error('Identifiant utilisateur invalide.');
  return parsed.value;
}

function requireParam(context: ApiRequestContext, name: string): string {
  const value = context.params[name]?.trim();
  if (!value) throw new Error(`Paramètre ${name} absent.`);
  return value;
}
