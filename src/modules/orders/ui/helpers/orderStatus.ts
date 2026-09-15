/**
 * orderStatus — référence centrale des statuts de commande (S3.1 Sprint 5).
 *
 * Centralise le mapping `STATUS_LABELS` jusqu'à présent dans
 * `components/shop/portal/PortalOrders.helpers.ts`. Anticipation S-ORDER-ROLES
 * (Sprint 6) qui ajoutera des statuts d'approbation N+1 — la structure groupée
 * permet d'étendre sans casser les call sites existants.
 *
 * Source de vérité enum DB :
 *  - tenant_orders.status : enum `tenant_order_status` (cf. Architecture §4.1)
 *    valeurs : draft, validated, in_production, shipped, delivered, invoiced, cancelled
 *  - shop_orders.status (cohort legacy figée, cf. ADR-ORDERS-1 §4.10)
 *    valeurs observées : pending, approved, cancelled (subset)
 */

export type OrderStatus =
  // tenant_orders v1.1 (canoniques)
  | "draft"
  | "validated"
  | "in_production"
  | "shipped"
  | "delivered"
  | "invoiced"
  | "cancelled"
  // shop_orders legacy (cohort figée pré-bascule 17/05)
  | "pending"
  | "approved";

export type OrderStatusGroup = "workflow" | "terminal" | "legacy";

export interface OrderStatusInfo {
  /** Label UI français affiché dans les badges et filtres. */
  label: string;
  /** Classes Tailwind cohérentes avec les tokens design system Magrit. */
  className: string;
  /** Catégorie pour groupements UI (filtres, dashboards). */
  group: OrderStatusGroup;
}

/**
 * Mapping canonique status → info UI.
 * Étendre ici quand S-ORDER-ROLES ajoutera pending_approval_n1, approved_n1, etc.
 */
export const STATUS_LABELS: Record<OrderStatus, OrderStatusInfo> = {
  // shop_orders legacy
  pending: {
    label: "En attente",
    className: "bg-warn-bg text-warn-fg border-warn-fg/20",
    group: "legacy",
  },
  approved: {
    label: "Validée",
    className: "bg-ok-bg text-ok-fg border-ok-line",
    group: "legacy",
  },
  // tenant_orders v1.1 workflow
  // BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1, decision Arnaud Q1
  // 2026-09-15) : "draft" reste conforme au PRD (FR18/FR49), seul le
  // libelle change. Cette table est la SEULE source de libelles de statut
  // sous src/modules/orders/ - gardee par
  // tests/architecture/order-status-single-source.test.ts.
  draft: {
    label: "En attente de validation",
    className: "bg-warn-bg text-warn-fg border-warn-fg/20",
    group: "workflow",
  },
  validated: {
    label: "Validée",
    className: "bg-ok-bg text-ok-fg border-ok-line",
    group: "workflow",
  },
  in_production: {
    label: "En production",
    className: "bg-info-bg text-info-fg border-info-fg/20",
    group: "workflow",
  },
  shipped: {
    label: "Expédiée",
    className: "bg-info-bg text-info-fg border-info-fg/20",
    group: "workflow",
  },
  // tenant_orders v1.1 terminal
  delivered: {
    label: "Livrée",
    className: "bg-ok-bg text-ok-fg border-ok-line",
    group: "terminal",
  },
  invoiced: {
    label: "Facturée",
    className: "bg-ok-bg text-ok-fg border-ok-line",
    group: "terminal",
  },
  cancelled: {
    label: "Annulée",
    className: "bg-err-bg text-err-fg border-err-fg/20",
    group: "terminal",
  },
};

/** Statuts workflow tenant_orders (en cours dans le pipeline). */
export const ORDER_STATUSES_WORKFLOW: OrderStatus[] = [
  "draft",
  "validated",
  "in_production",
  "shipped",
];

/** Statuts terminaux tenant_orders (commande clôturée). */
export const ORDER_STATUSES_TERMINAL: OrderStatus[] = [
  "delivered",
  "invoiced",
  "cancelled",
];

/** Statuts shop_orders legacy (cohort figée pré-bascule 17/05). */
export const ORDER_STATUSES_LEGACY: OrderStatus[] = ["pending", "approved"];

/** Liste de tous les statuts connus (workflow + terminal + legacy). */
export const ALL_ORDER_STATUSES: OrderStatus[] = [
  ...ORDER_STATUSES_WORKFLOW,
  ...ORDER_STATUSES_TERMINAL,
  ...ORDER_STATUSES_LEGACY,
];

/**
 * Lookup safe avec fallback pour statut inconnu.
 * Garantit qu'un statut envoyé depuis la DB (potentiellement future enum
 * value non encore mappée côté front) ne crashe pas l'UI.
 */
export function getStatusInfo(status: string): OrderStatusInfo {
  const known = STATUS_LABELS[status as OrderStatus];
  if (known) return known;
  return {
    label: status, // affiche le raw status si inconnu (debug-friendly)
    className: "bg-line text-ink-2 border-line",
    group: "workflow", // fallback safe — pas terminal/legacy
  };
}

/**
 * Libellés de statut de commande dans l'ordre du flux puis des statuts
 * terminaux, SANS les statuts hérités `shop_orders` (`pending`, `approved`).
 *
 * BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1(c), arbitrage architecte
 * 2026-09-15) : tout écran qui affiche « la liste des statuts » (ex.
 * `OrderRolesPage`) la tire d'ici, jamais d'une phrase écrite en dur — c'est
 * ce qui a laissé passer un huitième item fantôme (vestige du
 * `pending_validation` de maquette, jamais créé par S-ORDER-ROLES) dans
 * `OrderRolesPage.tsx`.
 */
export function getOrderStatusLegendLabels(): string[] {
  return [...ORDER_STATUSES_WORKFLOW, ...ORDER_STATUSES_TERMINAL].map(
    (status) => STATUS_LABELS[status].label,
  );
}

/**
 * Libellé de statut avec la première lettre en minuscule, pour une
 * insertion en fin ou milieu de phrase (« ... n'est plus en attente de
 * validation », « Suivre ma commande (validée) »).
 *
 * BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1(c), qa-review de BCP-5) :
 * la règle veut que « les messages d'erreur qui nomment un statut le
 * tirent eux aussi de la table ». Cette fonction est la forme DÉRIVÉE
 * autorisée — jamais une seconde table, jamais une phrase recopiée à la
 * main avec une capitale changée.
 */
export function getStatusLabelLowerFirst(status: string): string {
  const label = getStatusInfo(status).label;
  return label.length > 0 ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

/**
 * Mapping inverse label UI → status enum (pour parsing input filtre).
 * Si plusieurs statuts partagent le même label (ex: "Validée" → `validated`
 * ou `approved` legacy), retourne le premier match dans l'ordre déclaré.
 * Pour les filtres UI, préférer travailler directement sur OrderStatus.
 */
export function labelToStatus(label: string): OrderStatus | null {
  for (const status of ALL_ORDER_STATUSES) {
    if (STATUS_LABELS[status].label === label) return status;
  }
  return null;
}
