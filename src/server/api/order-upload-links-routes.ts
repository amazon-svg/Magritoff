/**
 * Routes HTTP du module Liens de depot publics (stories E10.20a/E10.20b),
 * sur la facade Gestion commerciale (`defineGescomRoute`, E10.0).
 *
 * SIX operations (contrat, docs/api/CONVENTIONS.md §8.21) :
 *  - `createOrderUploadLink`/`listOrderUploadLinks`/`revokeOrderUploadLink`
 *    sont RESERVEES au jeton UTILISATEUR (`authentication: 'user'`), jamais
 *    joignables par cle de service — meme decision que les operations
 *    d ecriture d `order-files` (E10.17a decision #5) : emettre/revoquer un
 *    lien de depot engage la responsabilite d un membre nomme.
 *  - `getOrderUploadLinkContext`/`issueOrderUploadLinkFileUrl`/
 *    `confirmOrderUploadLinkFile` sont le QUATRIEME mode d authentification
 *    (`authentication: 'upload_link'`) : ni jeton utilisateur, ni cle de
 *    service, ni session boutique n y a acces (403
 *    `identity.actor_kind_required`, cloisonnement ferme dans les deux
 *    sens — contrat §"story E10.20").
 *  - AUCUNE garde de capability sur aucune des six (meme arbitrage
 *    qu `order-files`) : tout membre du tenant peut emettre/lister/revoquer,
 *    et aucun droit metier ne gouverne le depot par un porteur de lien.
 *
 * `issueOrderUploadLinkFileUrl` REUTILISE tel quel le schema
 * `OrderFileUploadTicket` publie par `order-files` (contrat : "schema
 * OrderFileUploadTicket REUTILISE tel quel") — aucune duplication.
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1).
 */
import { z } from 'zod';
import { orderFileUploadTicketSchema } from '../../modules/order-files/api/contracts.ts';
import {
  OrderFileAlreadyConfirmedError,
  OrderFileRejectedError,
  OrderFileUploadExpiredError,
  OrderFileUploadMissingError,
} from '../../modules/order-files/application/order-files-repository.ts';
import {
  confirmOrderUploadLinkFileCommandSchema,
  createOrderUploadLinkCommandSchema,
  orderUploadLinkContextSchema,
  orderUploadLinkCreatedSchema,
  orderUploadLinkDepositSchema,
  orderUploadLinksListSchema,
} from '../../modules/order-upload-links/api/contracts.ts';
import type { OrderUploadLinksService } from '../../modules/order-upload-links/application/order-upload-links-service.ts';
import {
  OrderNotFoundError,
  OrderUploadLinkFileLimitReachedError,
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

    defineGescomRoute({
      method: 'POST',
      path: '/order-upload-links/current/file-upload-urls',
      operationId: 'issueOrderUploadLinkFileUrl',
      // QUATRIEME MODE. PATRON EXACT d `issueOrderFileUploadUrl` : 200, PAS
      // d `Idempotency-Key` (un billet n est pas une ressource metier).
      authentication: 'upload_link',
      inputSchema: null,
      dataSchema: orderFileUploadTicketSchema,
      async handle(context) {
        const principal = assertUploadLinkPrincipal(context.principal);
        try {
          const ticket = await service.issueFileUploadUrl(principal.token);
          return { status: 200, data: ticket };
        } catch (error) {
          if (error instanceof OrderUploadLinkNotFoundError) throw uploadLinkInvalid();
          if (error instanceof OrderUploadLinkFileLimitReachedError) {
            throw problem({
              status: 409,
              title: 'Plafond de fichiers atteint',
              code: 'upload_link.file_limit_reached',
              detail: error.message,
            });
          }
          throw error;
        }
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/order-upload-links/current/files',
      operationId: 'confirmOrderUploadLinkFile',
      // QUATRIEME MODE. `Idempotency-Key` EXIGEE (createsResource) : cette
      // operation cree un fichier ET publie `order.files_submitted` — la
      // rejouer NE DOIT PAS emettre un second evenement (contrat). La cle
      // STOCKEE derive du LIEN (`deriveUploadLinkIdempotencyStorageKey`,
      // gescom-middleware.ts, deja ecrite en E10.20a).
      authentication: 'upload_link',
      createsResource: true,
      inputSchema: confirmOrderUploadLinkFileCommandSchema,
      dataSchema: orderUploadLinkDepositSchema,
      async handle(context, input) {
        const principal = assertUploadLinkPrincipal(context.principal);
        try {
          const deposit = await service.confirmFileUpload(principal.token, input);
          return { status: 201, data: deposit };
        } catch (error) {
          if (error instanceof OrderUploadLinkNotFoundError) throw uploadLinkInvalid();
          if (error instanceof OrderUploadLinkFileLimitReachedError) {
            throw problem({
              status: 409,
              title: 'Plafond de fichiers atteint',
              code: 'upload_link.file_limit_reached',
              detail: error.message,
            });
          }
          if (error instanceof OrderFileAlreadyConfirmedError) {
            throw problem({
              status: 409,
              title: 'Fichier deja confirme',
              code: 'order_file.already_confirmed',
              detail: error.message,
            });
          }
          if (error instanceof OrderFileUploadMissingError) {
            throw problem({
              status: 404,
              title: 'Aucun fichier depose',
              code: 'order_file.upload_missing',
              detail: error.message,
            });
          }
          if (error instanceof OrderFileUploadExpiredError) {
            // qa-review round 1 (B2, BLOQUANT GRAVE, E10.22b/c) : meme statut
            // que `quote.decision_expired`, meme code que la voie atelier.
            throw problem({
              status: 409,
              title: 'Depot expire',
              code: 'order_file.upload_expired',
              detail: error.message,
            });
          }
          if (error instanceof OrderFileRejectedError) {
            throw problem({
              status: 422,
              title: 'Fichier refuse',
              code: 'order_file.rejected',
              detail: error.message,
            });
          }
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
