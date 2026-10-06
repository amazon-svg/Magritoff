import type { UnifiedOrderDetail } from '@/modules/orders/api/contracts';

const id = '00000000-0000-4000-9000-000000000003';
const relatedId = '00000000-0000-4000-9000-000000000004';
const timestamp = '2026-10-05T12:00:00.000Z';
const header = {
  id, number: null, shop_id: relatedId, customer_id: null, quote_id: null,
  customer_reference: null, notes: '',
  created_at: timestamp, updated_at: timestamp, status: 'draft' as const, currency: 'EUR',
  total_ht: '25.00', total_ttc: '30.00', has_unverified_prices: true,
  current_production_step_id: null,
};
export const storefrontDetail: UnifiedOrderDetail = {
  ...header, origin: 'storefront', detail: {
    orderId: id, shopId: relatedId, shopName: 'Atelier Lumière', source: 'v1_1', status: 'draft',
    createdAt: timestamp, updatedAt: timestamp, customerName: 'Jean', customerEmail: null,
    currency: 'EUR', notes: '', totalHt: '25.00', totalTtc: '30.00', hasUnverifiedPrices: true,
    items: [{ id: relatedId, productId: null, productLabel: 'Flyer', clariprintOptions: { paper: 'mat' },
      quantity: 2, unitPriceHt: '12.50', lineTotalHt: '25.00', priceOrigin: 'client_unverified' }],
  },
};
export const quoteDetail: UnifiedOrderDetail = {
  ...header, origin: 'quote', status: 'validated', shop_id: null, customer_id: relatedId, quote_id: relatedId,
  number: 'CDE-2026-00001', total_ht: '123.45', total_ttc: '130.24', has_unverified_prices: false,
  detail: {
    id, tenant_id: '00000000-0000-4000-9000-000000000001', customer_id: relatedId, quote_id: relatedId,
    number: 'CDE-2026-00001', status: 'validated', source_quote_status: 'accepted',
    current_production_step_id: null, created_by: null, created_at: timestamp, updated_at: timestamp,
    customer_contact_id: null, expected_delivery_date: null,
    totals: { lines_subtotal: '123.45', global_discount: '0.00', effective_discount_rate: null,
      net_total: '123.45', vat_rate: '0.0550', vat_regime: null, vat_amount: '6.79', total_incl_tax: '130.24' },
    lines: [{ id: relatedId, order_id: id, source_quote_line_id: relatedId, origin: 'free',
      label: 'Flyer', description_html: null, product_config: { paper: 'mat' }, quantity: 2, position: 0,
      production_price: '80.00', public_price: '130.00', customer_price: '123.45', applied_margin_rate: '0.5000',
      applied_rule_id: null, sale_price: '123.45', sale_margin_rate: null, discount_rate: null, margin_variation: null,
      breakdown: [{ post: 'printing', cost: '80.00', margin_rate: '0.5000', price: '123.45', source: 'prix_marche' }],
      created_at: timestamp }],
  },
};
