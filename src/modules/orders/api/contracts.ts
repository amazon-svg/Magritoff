import { z } from 'zod';
import { moneySchema } from '../../_shared/api/index.ts';

/**
 * Q17-a (docs/api/CONVENTIONS.md §8.25 point 12 (c)) — provenance du prix
 * d une ligne de commande boutique. Enumeration FERMEE : `catalog` (recalcule
 * et verifie par le serveur), `quoted` (Q17-b, devis serveur non perime —
 * n existe pas encore cote code), `client_unverified` (le serveur n a aucun
 * moyen de verifier ce prix), `legacy` (ligne anterieure a cette regle,
 * ecrite UNIQUEMENT par la migration de reprise, jamais par un chemin de
 * code applicatif).
 */
export const priceOriginSchema = z.enum(['catalog', 'quoted', 'client_unverified', 'legacy']);

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
  /**
   * Q17-a (point 12 (c)) — geste DISTINCT, jamais une case discrète : valider
   * une commande qui porte une ligne `client_unverified` exige ce booléen
   * explicite. Sans lui (valeur par défaut `false`), la transition
   * `draft -> validated` refuse en 409 `orders.unverified_prices` dès qu une
   * ligne n a pas pu être vérifiée.
   */
  acknowledgeUnverifiedPrices: z.boolean().default(false),
});

export const transitionOrderResultSchema = z.object({
  orderId: z.string().min(1),
  fromStatus: z.string(),
  toStatus: z.string(),
  replayed: z.boolean(),
});

/**
 * Q17-a (point 12 (f)) — `unitPriceHt` (ce que le serveur ÉCRIT) devient
 * `expectedUnitPriceHt` (ce que l acheteur a VU). Le serveur ne l écrit
 * jamais pour une ligne `catalog` — il le COMPARE au prix qu il recalcule
 * (point 12 (b), (d)) — et l écrit tel quel pour une ligne `client_unverified`
 * (point 12 (c)). `Money` : chaîne décimale à deux décimales, jamais un
 * flottant JSON (§5, dérogation R5 soldée par ce lot).
 */
export const createOrderItemSchema = z.object({
  productId: z.uuid().nullable(),
  productLabel: z.string().trim().min(1),
  clariprintOptions: z.record(z.string(), z.json()).nullable(),
  quantity: z.number().int().positive(),
  expectedUnitPriceHt: moneySchema,
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
  totalHt: moneySchema,
  currency: z.string().length(3),
  replayed: z.boolean(),
});

export const draftOrderItemSchema = z.object({
  id: z.uuid(),
  productId: z.uuid().nullable(),
  productLabel: z.string(),
  clariprintOptions: z.record(z.string(), z.json()).nullable(),
  quantity: z.number().int().positive(),
  unitPriceHt: moneySchema,
  lineTotalHt: moneySchema,
  /** Q17-a (point 12 (h)) — sert Q17-c (pastille « Prix non vérifié »). */
  priceOrigin: priceOriginSchema,
});

export const draftOrderSchema = z.object({
  orderId: z.uuid(),
  status: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  totalHt: moneySchema,
  /** Q17-a (point 12 (h)) — miroir de `tenant_orders.has_unverified_prices`. */
  hasUnverifiedPrices: z.boolean(),
  items: z.array(draftOrderItemSchema),
});

/**
 * Q17-a (point 12 (e)) — ni `productId` ni `clariprintOptions` : l identité
 * catalogue d une ligne n est PAS resoumise ici, elle reste celle déjà en
 * base. C est délibéré (point 12 (e)) : le serveur recalcule le prix contre
 * CETTE identité déjà connue, jamais contre une identité que l appelant
 * pourrait faire glisser à l édition.
 */
export const updateDraftOrderItemSchema = z.object({
  id: z.uuid(),
  productLabel: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  expectedUnitPriceHt: moneySchema,
});

export const updateDraftOrderCommandSchema = z.object({
  items: z.array(updateDraftOrderItemSchema).min(1),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export const updateDraftOrderResultSchema = z.object({
  orderId: z.uuid(),
  totalHt: moneySchema,
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

export type PriceOrigin = z.infer<typeof priceOriginSchema>;
export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type OrdersList = z.infer<typeof ordersListSchema>;
export type PortalOrdersTab = z.infer<typeof portalOrdersTabSchema>;
export type PortalOrdersCounters = z.infer<typeof portalOrdersCountersSchema>;
export type PortalOrdersResponse = z.infer<typeof portalOrdersResponseSchema>;
export type OrderAuditEvent = z.infer<typeof orderAuditEventSchema>;
export type OrderAuditTrail = z.infer<typeof orderAuditTrailSchema>;
/**
 * `z.input`, pas `z.infer` : `reason` et `acknowledgeUnverifiedPrices`
 * portent un `.default(...)`, et un appelant qui les omet (cas de très loin
 * le plus fréquent : annuler un brouillon n a rien à acquitter) doit rester
 * valide côté TypeScript. Même convention que `CreateShopCommand`
 * (`src/modules/shops/api/contracts.ts`).
 */
export type TransitionOrderCommand = z.input<typeof transitionOrderCommandSchema>;
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
