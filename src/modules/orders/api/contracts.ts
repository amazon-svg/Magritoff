import { z } from 'zod';

export const orderSourceSchema = z.enum(['legacy', 'v1_1']);
export const portalOrdersTabSchema = z.enum(['mine', 'to_validate', 'to_approve', 'to_produce']);

export const orderItemSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unitPriceHt: z.number(),
});

export const orderSummarySchema = z.object({
  id: z.string().min(1),
  shopId: z.string().min(1),
  source: orderSourceSchema,
  createdAt: z.string(),
  customerName: z.string(),
  customerEmail: z.string(),
  items: z.array(orderItemSchema),
  totalHt: z.number(),
  totalTtc: z.number(),
  status: z.string(),
});

export const ordersListSchema = z.object({ orders: z.array(orderSummarySchema) });

export const portalOrdersCountersSchema = z.object({
  mine: z.number().int().nonnegative(),
  to_validate: z.number().int().nonnegative(),
  to_approve: z.number().int().nonnegative(),
  to_produce: z.number().int().nonnegative(),
});

export const portalOrdersDatasetsSchema = z.object({
  mine: z.array(orderSummarySchema),
  to_validate: z.array(orderSummarySchema),
  to_approve: z.array(orderSummarySchema),
  to_produce: z.array(orderSummarySchema),
});

export const portalOrdersResponseSchema = z.object({
  counters: portalOrdersCountersSchema,
  datasets: portalOrdersDatasetsSchema,
});

export const orderAuditEventSchema = z.object({
  eventId: z.string().min(1),
  orderId: z.string().min(1),
  kind: z.enum(['status', 'role']),
  eventType: z.string(),
  actorId: z.string().nullable(),
  actorEmail: z.string().nullable(),
  roleName: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  occurredAt: z.string(),
});

export const orderAuditTrailSchema = z.object({ events: z.array(orderAuditEventSchema) });

export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type OrdersList = z.infer<typeof ordersListSchema>;
export type PortalOrdersTab = z.infer<typeof portalOrdersTabSchema>;
export type PortalOrdersCounters = z.infer<typeof portalOrdersCountersSchema>;
export type PortalOrdersResponse = z.infer<typeof portalOrdersResponseSchema>;
export type OrderAuditEvent = z.infer<typeof orderAuditEventSchema>;
export type OrderAuditTrail = z.infer<typeof orderAuditTrailSchema>;
