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
  shopCustomerAccountId: z.string().nullable(),
  actedByMagritUserId: z.string().nullable(),
  roleName: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  occurredAt: z.string(),
});

export const orderAuditTrailSchema = z.object({ events: z.array(orderAuditEventSchema) });

export const transitionOrderCommandSchema = z.object({
  toStatus: z.enum(['validated', 'in_production', 'shipped', 'delivered', 'invoiced', 'cancelled']),
  reason: z.string().trim().min(1).nullable().default(null),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export const transitionOrderResultSchema = z.object({
  orderId: z.string().min(1),
  fromStatus: z.string(),
  toStatus: z.string(),
  replayed: z.boolean(),
});

export const createOrderItemSchema = z.object({
  productId: z.uuid().nullable(),
  productLabel: z.string().trim().min(1),
  clariprintOptions: z.record(z.string(), z.json()).nullable(),
  quantity: z.number().int().positive(),
  unitPriceHt: z.number().nonnegative(),
});

export const createOrderCommandSchema = z.object({
  shopId: z.uuid(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  notes: z.string().max(5000),
  items: z.array(createOrderItemSchema).min(1),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export const createOrderResultSchema = z.object({
  orderId: z.uuid(),
  tenantId: z.uuid(),
  shopId: z.uuid(),
  totalHt: z.number().nonnegative(),
  currency: z.string().length(3),
  replayed: z.boolean(),
});

export const draftOrderItemSchema = z.object({
  id: z.uuid(),
  productId: z.uuid().nullable(),
  productLabel: z.string(),
  clariprintOptions: z.record(z.string(), z.json()).nullable(),
  quantity: z.number().int().positive(),
  unitPriceHt: z.number().nonnegative(),
  lineTotalHt: z.number().nonnegative(),
});

export const draftOrderSchema = z.object({
  orderId: z.uuid(),
  status: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  totalHt: z.number().nonnegative(),
  items: z.array(draftOrderItemSchema),
});

export const updateDraftOrderItemSchema = z.object({
  id: z.uuid(),
  productLabel: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  unitPriceHt: z.number().nonnegative(),
});

export const updateDraftOrderCommandSchema = z.object({
  items: z.array(updateDraftOrderItemSchema).min(1),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export const updateDraftOrderResultSchema = z.object({
  orderId: z.uuid(),
  totalHt: z.number().nonnegative(),
  replayed: z.boolean(),
});

export const orderCapabilitySchema = z.enum([
  'can_quote', 'can_order', 'can_invite', 'can_validate', 'can_cancel',
  'can_modify', 'can_export', 'can_manage_catalog', 'can_manage_roles',
]);

export const orderCapabilitiesSchema = z.record(orderCapabilitySchema, z.boolean());

export const orderRoleAssignmentSchema = z.object({
  assignmentId: z.uuid(),
  roleDefinitionId: z.uuid(),
  name: z.string(),
  capabilities: z.partialRecord(orderCapabilitySchema, z.boolean()),
  notifyPolicy: z.enum(['chain_next', 'all_roles', 'none']),
  orderingIndex: z.number().int(),
});

export const orderRolesResponseSchema = z.object({
  roles: z.array(orderRoleAssignmentSchema),
  capabilities: orderCapabilitiesSchema,
  isCreator: z.boolean(),
});

export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type OrdersList = z.infer<typeof ordersListSchema>;
export type PortalOrdersTab = z.infer<typeof portalOrdersTabSchema>;
export type PortalOrdersCounters = z.infer<typeof portalOrdersCountersSchema>;
export type PortalOrdersResponse = z.infer<typeof portalOrdersResponseSchema>;
export type OrderAuditEvent = z.infer<typeof orderAuditEventSchema>;
export type OrderAuditTrail = z.infer<typeof orderAuditTrailSchema>;
export type TransitionOrderCommand = z.infer<typeof transitionOrderCommandSchema>;
export type TransitionOrderResult = z.infer<typeof transitionOrderResultSchema>;
export type CreateOrderCommand = z.infer<typeof createOrderCommandSchema>;
export type CreateOrderResult = z.infer<typeof createOrderResultSchema>;
export type DraftOrderItem = z.infer<typeof draftOrderItemSchema>;
export type DraftOrder = z.infer<typeof draftOrderSchema>;
export type UpdateDraftOrderCommand = z.infer<typeof updateDraftOrderCommandSchema>;
export type UpdateDraftOrderResult = z.infer<typeof updateDraftOrderResultSchema>;
export type OrderCapability = z.infer<typeof orderCapabilitySchema>;
export type OrderCapabilities = z.infer<typeof orderCapabilitiesSchema>;
export type OrderRoleAssignment = z.infer<typeof orderRoleAssignmentSchema>;
export type OrderRolesResponse = z.infer<typeof orderRolesResponseSchema>;
