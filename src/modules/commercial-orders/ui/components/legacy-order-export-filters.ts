import type { ProductionStepDto } from '@/modules/production-steps';
import type { CommercialOrderSort } from '../../api/contracts.ts';

const DEFAULT_LEGACY_ORDER_SORT: CommercialOrderSort = '-created_at';

/** État conservé uniquement pour le panneau d'export historique (layout 1). */
export type OrdersListFilters = Readonly<{
  createdFrom: string;
  createdTo: string;
  customerId: string;
  productionStepId: string;
  sort: CommercialOrderSort;
}>;

export const DEFAULT_ORDERS_LIST_FILTERS: OrdersListFilters = Object.freeze({
  createdFrom: '',
  createdTo: '',
  customerId: '',
  productionStepId: '',
  sort: DEFAULT_LEGACY_ORDER_SORT,
});

type LegacyOrderFilterQuery = Readonly<{
  createdFrom?: string;
  createdTo?: string;
  customerId?: string;
  currentProductionStepId?: string;
  sort?: CommercialOrderSort;
}>;

/** Traduit l'ancien état d'écran vers les filtres de l'export version 1. */
export function buildOrdersListQuery(filters: OrdersListFilters): LegacyOrderFilterQuery {
  const query: { -readonly [K in keyof LegacyOrderFilterQuery]?: LegacyOrderFilterQuery[K] } = {};
  if (filters.createdFrom.trim()) query.createdFrom = filters.createdFrom.trim();
  if (filters.createdTo.trim()) query.createdTo = filters.createdTo.trim();
  if (filters.customerId.trim()) query.customerId = filters.customerId.trim();
  if (filters.productionStepId.trim()) query.currentProductionStepId = filters.productionStepId.trim();
  if (filters.sort !== DEFAULT_LEGACY_ORDER_SORT) query.sort = filters.sort;
  return query;
}

export function formatProductionStepLabel(step: Pick<ProductionStepDto, 'label' | 'is_active'>): string {
  return step.is_active ? step.label : `${step.label} (désactivée)`;
}

export type ProductionStepCatalog = Readonly<{
  byId: ReadonlyMap<string, ProductionStepDto>;
  ordered: readonly ProductionStepDto[];
}>;

export const EMPTY_PRODUCTION_STEP_CATALOG: ProductionStepCatalog = Object.freeze({
  byId: new Map(),
  ordered: [],
});
