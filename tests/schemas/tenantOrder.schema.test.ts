/**
 * Tests vitest pour tenantOrder.schema.ts (Story S-MIGRATION-ORDERS, Sprint 4).
 *
 * Valide les schemas Zod tenantOrderInsertSchema + tenantOrderItemInsertSchema
 * qui valident les inserts cote front avant submitCart (defense-in-depth en
 * sus de la RLS tenant_orders_insert qui exige created_by = auth.uid()).
 */

import { describe, it, expect } from 'vitest';
import {
  tenantOrderInsertSchema,
  tenantOrderItemInsertSchema,
  tenantOrderStatusEnum,
} from '../../src/schemas/tenantOrder.schema';

const VALID_UUID_1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_UUID_2 = '9d6d69f8-e26b-4d10-8bd6-ba1519c0338b';
const VALID_UUID_3 = '8e29a136-95df-4ee2-84dd-2ea00a2e1f7c';

describe('tenantOrderInsertSchema', () => {
  it('valid input minimal (defaults applique status, currency, notes)', () => {
    const result = tenantOrderInsertSchema.safeParse({
      tenant_id: VALID_UUID_1,
      shop_id: VALID_UUID_2,
      created_by: VALID_UUID_3,
      total_ht: 1250.5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('draft');
      expect(result.data.currency).toBe('EUR');
      expect(result.data.notes).toBe('');
    }
  });

  it('rejette si created_by absent (AC9 auth required)', () => {
    const result = tenantOrderInsertSchema.safeParse({
      tenant_id: VALID_UUID_1,
      shop_id: VALID_UUID_2,
      total_ht: 100,
    });
    expect(result.success).toBe(false);
  });

  it('rejette UUID invalide sur tenant_id', () => {
    const result = tenantOrderInsertSchema.safeParse({
      tenant_id: 'not-an-uuid',
      shop_id: VALID_UUID_2,
      created_by: VALID_UUID_3,
      total_ht: 100,
    });
    expect(result.success).toBe(false);
  });

  it('rejette total_ht negatif', () => {
    const result = tenantOrderInsertSchema.safeParse({
      tenant_id: VALID_UUID_1,
      shop_id: VALID_UUID_2,
      created_by: VALID_UUID_3,
      total_ht: -10,
    });
    expect(result.success).toBe(false);
  });

  it('rejette currency != 3 caracteres', () => {
    const result = tenantOrderInsertSchema.safeParse({
      tenant_id: VALID_UUID_1,
      shop_id: VALID_UUID_2,
      created_by: VALID_UUID_3,
      total_ht: 100,
      currency: 'EURO',
    });
    expect(result.success).toBe(false);
  });

  it('accepte les 7 statuts de tenantOrderStatusEnum', () => {
    const statuses = ['draft', 'validated', 'in_production', 'shipped', 'delivered', 'invoiced', 'cancelled'];
    for (const s of statuses) {
      expect(tenantOrderStatusEnum.safeParse(s).success).toBe(true);
    }
    expect(tenantOrderStatusEnum.safeParse('pending').success).toBe(false);
  });
});

describe('tenantOrderItemInsertSchema', () => {
  it('valid input avec product_id UUID + clariprint_options', () => {
    const result = tenantOrderItemInsertSchema.safeParse({
      order_id: VALID_UUID_1,
      product_id: VALID_UUID_2,
      product_label: 'Carte de visite standard 350g',
      clariprint_options: { kind: 'leaflet', width: '8.5', height: '5.5', papers: ['350g'] },
      quantity: 500,
      unit_price_ht: 2.5,
      line_total_ht: 1250,
    });
    expect(result.success).toBe(true);
  });

  it('valid input avec product_id null (lib- legacy non UUID)', () => {
    const result = tenantOrderItemInsertSchema.safeParse({
      order_id: VALID_UUID_1,
      product_id: null,
      product_label: 'Library item legacy',
      clariprint_options: null,
      quantity: 100,
      unit_price_ht: 1.5,
      line_total_ht: 150,
    });
    expect(result.success).toBe(true);
  });

  it('rejette quantity = 0', () => {
    const result = tenantOrderItemInsertSchema.safeParse({
      order_id: VALID_UUID_1,
      product_label: 'Test',
      quantity: 0,
      unit_price_ht: 1,
      line_total_ht: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejette product_label vide', () => {
    const result = tenantOrderItemInsertSchema.safeParse({
      order_id: VALID_UUID_1,
      product_label: '',
      quantity: 1,
      unit_price_ht: 1,
      line_total_ht: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejette unit_price_ht negatif', () => {
    const result = tenantOrderItemInsertSchema.safeParse({
      order_id: VALID_UUID_1,
      product_label: 'Test',
      quantity: 1,
      unit_price_ht: -5,
      line_total_ht: -5,
    });
    expect(result.success).toBe(false);
  });

  it('rejette UUID invalide sur order_id', () => {
    const result = tenantOrderItemInsertSchema.safeParse({
      order_id: 'not-a-uuid',
      product_label: 'Test',
      quantity: 1,
      unit_price_ht: 1,
      line_total_ht: 1,
    });
    expect(result.success).toBe(false);
  });
});
