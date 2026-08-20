import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboardOrders = readFileSync(
  resolve(process.cwd(), 'src/app/components/dashboard/DashboardOrders.tsx'),
  'utf8',
);

const orderHistoryTable = readFileSync(
  resolve(process.cwd(), 'src/app/components/shop/portal/OrderHistoryTable.tsx'),
  'utf8',
);

describe('surface du dashboard commandes', () => {
  it('reprend la largeur de lecture du dashboard et demande explicitement son apparence', () => {
    expect(dashboardOrders).toContain('max-w-[1400px]');
    expect(dashboardOrders).toContain('appearance="dashboard"');
  });

  it('garde une apparence portail par défaut pour ne pas modifier la boutique', () => {
    expect(orderHistoryTable).toContain("appearance?: 'portal' | 'dashboard'");
    expect(orderHistoryTable).toContain("appearance = 'portal'");
    expect(orderHistoryTable).toContain("appearance === 'dashboard'");
  });

  it('rend le tableau dashboard dans une surface compacte et scrollable', () => {
    expect(orderHistoryTable).toContain('rounded-md border border-line bg-paper');
    expect(orderHistoryTable).toContain('min-w-[1120px]');
    expect(orderHistoryTable).toContain('bg-bg px-4 py-3');
  });
});
