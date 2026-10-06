import { z } from 'zod';
import { startOfDayInReferenceTimeZone, endOfDayInReferenceTimeZone } from '../../kernel/clock/index.ts';
import {
  buildPage,
  computeEntityTag,
  decodeCursor,
  resolveCalendarBoundOrThrow,
  validationFailed,
} from '../../modules/_shared/application/index.ts';
import {
  orderListEntriesSchema,
  orderListFiltersSchema,
  unifiedOrderDetailSchema,
  updateOrderMetadataCommandSchema,
} from '../../modules/orders/api/contracts.ts';
import { problem } from '../../modules/_shared/application/index.ts';
import type { OrdersService } from '../../modules/orders/application/orders-service.ts';
import { defineGescomRoute, type GescomRoute } from './gescom-middleware.ts';

/** E4.4b — lecture commune additive ; les façades historiques restent servies. */
export function createUnifiedOrdersRoutes(orders: OrdersService): readonly GescomRoute[] {
  return [defineGescomRoute({
    method: 'GET',
    path: '/order-summaries',
    operationId: 'listOrders',
    requiredScopes: ['orders:read'],
    inputSchema: null,
    dataSchema: orderListEntriesSchema,
    async handle(context) {
      const parsed = orderListFiltersSchema.safeParse(Object.fromEntries(context.url.searchParams));
      if (!parsed.success) {
        throw validationFailed(parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'), message: issue.message,
        })));
      }
      const filters = parsed.data;
      const createdAtFrom = filters.created_from
        ? resolveCalendarBoundOrThrow('created_from', filters.created_from, startOfDayInReferenceTimeZone) : null;
      const createdAtTo = filters.created_to
        ? resolveCalendarBoundOrThrow('created_to', filters.created_to, endOfDayInReferenceTimeZone) : null;
      if (createdAtFrom && createdAtTo && createdAtFrom > createdAtTo) {
        throw validationFailed([{ field: 'created_to', message: 'La fin doit suivre le début de la période.' }]);
      }
      const cursor = context.page.cursor ? decodeCursor(context.page.cursor) : null;
      if (cursor && (!z.uuid().safeParse(cursor.id).success || !z.iso.datetime({ offset: true }).safeParse(cursor.sort).success)) {
        throw validationFailed([{ field: 'page[cursor]', message: 'Position de commande invalide.' }]);
      }
      const rows = await orders.listOrders(context.tenantId, {
        actor: context.principal.kind === 'user' ? context.principal.userId : null,
        filters, size: context.page.size, cursor, createdAtFrom,
        // Minuit suivant exclusif inclut aussi les microsecondes du dernier jour.
        createdAtTo: createdAtTo ? new Date(Date.parse(createdAtTo) + 1).toISOString() : null,
      });
      const page = buildPage(rows, context.page, (row) => ({ sort: row.cursorCreatedAt ?? row.created_at, id: row.id }));
      return {
        status: 200, data: [...page.items],
        meta: { next_cursor: page.nextCursor, page_size: context.page.size },
      };
    },
  }), defineGescomRoute({
    method: 'GET',
    path: '/order-summaries/{orderId}',
    operationId: 'getUnifiedOrder',
    requiredScopes: ['orders:read'],
    inputSchema: null,
    dataSchema: unifiedOrderDetailSchema,
    async handle(context) {
      const orderId = context.params['orderId']!;
      if (!z.uuid().safeParse(orderId).success) {
        throw validationFailed([{ field: 'orderId', message: 'Identifiant de commande invalide.' }]);
      }
      const actor = context.principal.kind === 'user' ? context.principal.userId : null;
      const detail = await orders.getUnifiedDetail(context.tenantId, orderId, actor);
      if (!detail) throw problem({ status: 404, title: 'Commande introuvable', code: 'order.not_found' });
      return { status: 200, data: detail, etag: await orderTag(detail) };
    },
  }), defineGescomRoute({
    method: 'PATCH',
    path: '/order-summaries/{orderId}',
    operationId: 'updateOrderMetadata',
    authentication: 'user',
    inputSchema: updateOrderMetadataCommandSchema,
    dataSchema: unifiedOrderDetailSchema,
    async handle(context, command) {
      const orderId = context.params['orderId']!;
      if (!z.uuid().safeParse(orderId).success) {
        throw validationFailed([{ field: 'orderId', message: 'Identifiant de commande invalide.' }]);
      }
      if (context.principal.kind !== 'user' || context.ifMatch === null) {
        throw problem({ status: 403, title: 'Utilisateur requis', code: 'identity.user_actor_required' });
      }
      const detail = await orders.updateMetadata(
        context.tenantId,
        orderId,
        context.principal.userId,
        command,
        context.ifMatch,
      );
      if (!detail) throw problem({ status: 404, title: 'Commande introuvable', code: 'order.not_found' });
      return { status: 200, data: detail, etag: await orderTag(detail) };
    },
  })];
}

function orderTag(detail: { id: string; updated_at: string }) {
  return computeEntityTag(detail);
}
