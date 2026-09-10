/**
 * Routes HTTP du module Fichiers de commande (story E10.17a), sur la facade
 * Gestion commerciale (`defineGescomRoute`, E10.0).
 *
 * SIX operations (contrat, docs/api/CONVENTIONS.md §8.19) :
 *  - `issueOrderFileUploadUrl` (200, sans Idempotency-Key) et
 *    `confirmOrderFileUpload` (201, Idempotency-Key) sont RESERVEES au jeton
 *    UTILISATEUR (`authentication: 'user'`), jamais joignables par cle de
 *    service — decision #5 du contrat : creer/deposer un fichier engage la
 *    responsabilite d un membre nomme, jamais d un module tiers.
 *  - `updateOrderFile` (visibilite) et `deleteOrderFile` sont RESERVEES au
 *    meme titre — decision #5 (asymetrie voulue avec `changeOrderProduction
 *    Step`, qui ouvre l ecriture aux cles de service `orders:write`).
 *  - `listOrderFiles`/`getOrderFile` sont ouvertes au jeton utilisateur ET
 *    aux cles de service `orders:read` (deja publie), meme regime que
 *    `listCommercialOrders`/`getCommercialOrder`.
 *  - AUCUNE garde de capability sur aucune des six (decision #4 du contrat) :
 *    tout membre du tenant peut deposer, visibiliser et supprimer — meme
 *    arbitrage que `convertQuote`/`changeOrderProductionStep`.
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1).
 */
import {
  confirmOrderFileUploadCommandSchema,
  orderFileDetailSchema,
  orderFilesListSchema,
  orderFileSchema,
  orderFileUploadTicketSchema,
  updateOrderFileCommandSchema,
  type OrderFileDto,
} from '../../modules/order-files/api/contracts.ts';
import type { OrderFilesService } from '../../modules/order-files/application/order-files-service.ts';
import {
  OrderFileAlreadyConfirmedError,
  OrderFileLimitReachedError,
  OrderFileLineNotFoundError,
  OrderFileNotFoundError,
  OrderFileRejectedError,
  OrderFileUploadExpiredError,
  OrderFileUploadMissingError,
  OrderNotFoundError,
} from '../../modules/order-files/application/order-files-repository.ts';
import {
  assertPrecondition,
  computeEntityTag,
  problem,
  SHARED_PROBLEM_CODES,
} from '../../modules/_shared/application/index.ts';
import { z } from 'zod';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

export function createOrderFilesRoutes(service: OrderFilesService): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'POST',
      path: '/commercial-orders/{orderId}/file-upload-urls',
      operationId: 'issueOrderFileUploadUrl',
      authentication: 'user',
      // 200, PAS d Idempotency-Key (contrat : un billet de depot n est pas
      // une ressource metier, le rejouer DOIT rendre un billet NEUF).
      inputSchema: null,
      dataSchema: orderFileUploadTicketSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const ticket = await service.issueUploadUrl(context.tenantId, context.params['orderId']!);
          return { status: 200, data: ticket };
        });
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/commercial-orders/{orderId}/files',
      operationId: 'listOrderFiles',
      requiredScopes: ['orders:read'],
      inputSchema: null,
      dataSchema: orderFilesListSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const files = await service.list(context.tenantId, context.params['orderId']!);
          // BORNEE, NON PAGINEE (plafond de 30 EN BASE), aucun filtre, AUCUNE
          // URL de telechargement (contrat).
          return { status: 200, data: [...files] };
        });
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/commercial-orders/{orderId}/files',
      operationId: 'confirmOrderFileUpload',
      authentication: 'user',
      createsResource: true,
      inputSchema: confirmOrderFileUploadCommandSchema,
      dataSchema: orderFileSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const orderId = context.params['orderId']!;
          const actor = requireUserId(context);
          const confirmed = await service.confirmUpload(context.tenantId, orderId, actor, input);
          return { status: 201, data: confirmed, etag: await fileEntityTag(confirmed) };
        });
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/commercial-orders/{orderId}/files/{fileId}',
      operationId: 'getOrderFile',
      requiredScopes: ['orders:read'],
      inputSchema: null,
      dataSchema: orderFileDetailSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const detail = await service.getById(
            context.tenantId,
            context.params['orderId']!,
            context.params['fileId']!,
          );
          // L ETag exclut `download_url`/`download_url_expires_at` : ce sont
          // des URL signees REGENEREES a chaque lecture (meme lecon que
          // `templateEntityTag`, E10.10b-4a) — les inclure ferait varier
          // l ETag entre deux lectures de la MEME ressource inchangee et
          // casserait `If-Match` sur `updateOrderFile`.
          return { status: 200, data: detail, etag: await fileDetailEntityTag(detail) };
        });
      },
    }),

    defineGescomRoute({
      method: 'PATCH',
      path: '/commercial-orders/{orderId}/files/{fileId}',
      operationId: 'updateOrderFile',
      authentication: 'user',
      inputSchema: updateOrderFileCommandSchema,
      dataSchema: orderFileSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const orderId = context.params['orderId']!;
          const fileId = context.params['fileId']!;

          // qa-review N6 : PAS `service.getById()` ici — cette lecture ne sert
          // qu a calculer la precondition `If-Match`, et l `ETag` EXCLUT deja
          // `download_url`/`download_url_expires_at` (voir `fileDetailEntityTag`) ;
          // signer une URL pour un champ qui sera de toute facon ignore etait un
          // aller-retour Storage inutile a CHAQUE bascule de visibilite, et une
          // panne Storage transitoire y aurait produit un 500 brut la ou seul un
          // 404 `order_file.not_found` a un sens. `getRawById()` rend la MEME
          // projection stable qu `OrderFile`, sans jamais toucher au Storage.
          const current = await service.getRawById(context.tenantId, orderId, fileId);
          const currentTag = await fileEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.updateVisibility(context.tenantId, orderId, fileId, input);
          return { status: 200, data: updated, etag: await fileEntityTag(updated) };
        });
      },
    }),

    defineGescomRoute({
      method: 'DELETE',
      path: '/commercial-orders/{orderId}/files/{fileId}',
      operationId: 'deleteOrderFile',
      authentication: 'user',
      inputSchema: null,
      // 204 SANS CORPS (contrat) : octets detruits, ligne CONSERVEE comme
      // trace, jamais rendue par cette operation.
      dataSchema: z.null(),
      async handle(context) {
        return withDomainErrors(async () => {
          const orderId = context.params['orderId']!;
          const fileId = context.params['fileId']!;
          const actor = requireUserId(context);
          await service.remove(context.tenantId, orderId, fileId, actor);
          return { status: 204, data: null };
        });
      },
    }),
  ];
}

/**
 * ETag calcule sur une projection STABLE d `OrderFile` (aucun champ signe ici
 * — `OrderFile` ne porte pas d URL, contrairement a `OrderFileDetail`).
 */
async function fileEntityTag(file: OrderFileDto): Promise<string> {
  return computeEntityTag(file);
}

/**
 * ETag d `OrderFileDetail` EXCLUANT `download_url`/`download_url_expires_at`
 * (URL signee regeneree a chaque lecture) : meme lecon que
 * `templateEntityTag` (E10.10b-4a), trouvee par le test de contrat de ce
 * lot-la, appliquee ici AVANT d etre reapprise.
 */
async function fileDetailEntityTag(
  detail: Readonly<Record<string, unknown>> & { download_url: string; download_url_expires_at: string },
): Promise<string> {
  const { download_url: _downloadUrl, download_url_expires_at: _downloadUrlExpiresAt, ...stable } = detail;
  return computeEntityTag(stable);
}

/** L identifiant utilisateur qui ecrit la ressource (audit `deposited_by`/`deleted_by`, resolus en base via `auth.uid()`). */
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

/** Traduit les erreurs de domaine du module Fichiers de commande en Problem RFC 7807. */
async function withDomainErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      throw problem({ status: 404, title: 'Commande introuvable', code: 'order.not_found' });
    }
    if (error instanceof OrderFileNotFoundError) {
      throw problem({
        status: 404,
        title: 'Fichier de commande introuvable',
        code: 'order_file.not_found',
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
      // qa-review round 1 (B2, BLOQUANT GRAVE, E10.22b/c) : meme statut que
      // `quote.decision_expired` (precedent du depot) pour une ressource
      // perimee.
      throw problem({
        status: 409,
        title: 'Depot expire',
        code: 'order_file.upload_expired',
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
    if (error instanceof OrderFileLimitReachedError) {
      throw problem({
        status: 409,
        title: 'Plafond atteint',
        code: 'order_file.limit_reached',
        detail: error.message,
      });
    }
    if (error instanceof OrderFileLineNotFoundError) {
      throw problem({
        status: 422,
        title: 'Ligne introuvable',
        code: 'order_file.line_not_found',
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
}
