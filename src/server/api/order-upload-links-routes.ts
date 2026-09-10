/**
 * Routes HTTP du module Liens de depot publics (story E10.20a), sur la
 * facade Gestion commerciale (`defineGescomRoute`, E10.0).
 *
 * QUATRE operations (contrat, docs/api/CONVENTIONS.md §8.21) :
 *  - `createOrderUploadLink`/`listOrderUploadLinks`/`revokeOrderUploadLink`
 *    sont RESERVEES au jeton UTILISATEUR (`authentication: 'user'`), jamais
 *    joignables par cle de service — meme decision que les operations
 *    d ecriture d `order-files` (E10.17a decision #5) : emettre/revoquer un
 *    lien de depot engage la responsabilite d un membre nomme.
 *  - `getOrderUploadLinkContext` est le QUATRIEME mode d authentification
 *    (`authentication: 'upload_link'`) : ni jeton utilisateur, ni cle de
 *    service, ni session boutique n y a acces (403
 *    `identity.actor_kind_required`, cloisonnement ferme dans les deux
 *    sens — contrat §"story E10.20").
 *  - AUCUNE garde de capability sur aucune des quatre (meme arbitrage
 *    qu `order-files`) : tout membre du tenant peut emettre/lister/revoquer.
 *
 * PERIMETRE STRICT DE CE LOT : `issueOrderUploadLinkFileUrl` et
 * `confirmOrderUploadLinkFile` (le billet et la confirmation de depot) ne
 * sont PAS enregistrees ici — elles sont le perimetre explicite d E10.20b
 * (docs/api/CONVENTIONS.md §8.21 §5, ligne E10.20a : "AUCUN DEPOT
 * POSSIBLE"). `tests/contract/gescom-routes.contract.test.ts` ne verifie que
 * les routes REGISTREES, jamais l exhaustivite des operations du contrat :
 * ne pas enregistrer ces deux operations ici est donc conforme au CA1.
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1).
 */
import { z } from 'zod';
import {
  createOrderUploadLinkCommandSchema,
  orderUploadLinkContextSchema,
  orderUploadLinkCreatedSchema,
  orderUploadLinksListSchema,
} from '../../modules/order-upload-links/api/contracts.ts';
import type { OrderUploadLinksService } from '../../modules/order-upload-links/application/order-upload-links-service.ts';
import {
  OrderNotFoundError,
  OrderUploadLinkLimitReachedError,
  OrderUploadLinkNotFoundError,
} from '../../modules/order-upload-links/application/order-upload-links-repository.ts';
import {
  assertUploadLinkPrincipal,
  problem,
  SHARED_PROBLEM_CODES,
  uploadLinkInvalid,
} from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

export function createOrderUploadLinksRoutes(
  service: OrderUploadLinksService,
): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'POST',
      path: '/commercial-orders/{orderId}/upload-links',
      operationId: 'createOrderUploadLink',
      authentication: 'user',
      createsResource: true,
      inputSchema: createOrderUploadLinkCommandSchema,
      dataSchema: orderUploadLinkCreatedSchema,
      async handle(context, input) {
        return withAtelierDomainErrors(async () => {
          const orderId = context.params['orderId']!;
          const actor = requireUserId(context);
          const created = await service.create(context.tenantId, orderId, actor, input);
          return { status: 201, data: created };
        });
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/commercial-orders/{orderId}/upload-links',
      operationId: 'listOrderUploadLinks',
      authentication: 'user',
      inputSchema: null,
      dataSchema: orderUploadLinksListSchema,
      async handle(context) {
        return withAtelierDomainErrors(async () => {
          const links = await service.list(context.tenantId, context.params['orderId']!);
          // BORNEE, NON PAGINEE (10 liens vivants maximum, plafond en base).
          return { status: 200, data: [...links] };
        });
      },
    }),

    defineGescomRoute({
      method: 'DELETE',
      path: '/commercial-orders/{orderId}/upload-links/{linkId}',
      operationId: 'revokeOrderUploadLink',
      authentication: 'user',
      inputSchema: null,
      // 204 SANS CORPS : la ligne survit comme trace, jamais rendue par cette operation.
      dataSchema: z.null(),
      async handle(context) {
        return withAtelierDomainErrors(async () => {
          const orderId = context.params['orderId']!;
          const linkId = context.params['linkId']!;
          const actor = requireUserId(context);
          await service.revoke(context.tenantId, orderId, linkId, actor);
          return { status: 204, data: null };
        });
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/order-upload-links/current',
      operationId: 'getOrderUploadLinkContext',
      // QUATRIEME MODE — le seul de ce fichier. `resolvePrincipal`
      // (tenant-resolution.ts) refuse deja 400 `identity.actor_kind_
      // required` sur une credential explicite cumulee, et 401
      // `upload_link.invalid` sur un jeton absent/inexploitable AVANT
      // d atteindre ce handler.
      authentication: 'upload_link',
      inputSchema: null,
      dataSchema: orderUploadLinkContextSchema,
      async handle(context) {
        const principal = assertUploadLinkPrincipal(context.principal);
        try {
          const upstreamContext = await service.getContext(principal.token);
          return { status: 200, data: upstreamContext };
        } catch (error) {
          // TOCTOU (contrat) : le principal a deja ete resolu au moment de
          // la verification de credential, mais le lien peut avoir ete
          // revoque/expire ENTRE-TEMPS. Meme code que toute autre cause
          // d invalidite — arbitrage (F), une seule reponse indistincte.
          if (error instanceof OrderUploadLinkNotFoundError) throw uploadLinkInvalid();
          throw error;
        }
      },
    }),
  ];
}

/** L identifiant utilisateur qui ecrit la ressource (audit `created_by`/`revoked_by`, resolus en base via `auth.uid()`). */
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

/** Traduit les erreurs de domaine des TROIS operations d ATELIER en Problem RFC 7807 (jamais utilise par `getOrderUploadLinkContext`, voir ci-dessus). */
async function withAtelierDomainErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      throw problem({ status: 404, title: 'Commande introuvable', code: 'order.not_found' });
    }
    if (error instanceof OrderUploadLinkLimitReachedError) {
      throw problem({
        status: 409,
        title: 'Plafond de liens atteint',
        code: 'upload_link.limit_reached',
        detail: error.message,
      });
    }
    if (error instanceof OrderUploadLinkNotFoundError) {
      throw problem({
        status: 404,
        title: 'Lien de depot introuvable',
        code: 'upload_link.not_found',
        detail: error.message,
      });
    }
    throw error;
  }
}
