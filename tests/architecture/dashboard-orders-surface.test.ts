import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboardOrders = readFileSync(
  resolve(process.cwd(), 'src/modules/orders/ui/workspace/OrdersPage.tsx'),
  'utf8',
);

const orderHistoryTable = readFileSync(
  resolve(process.cwd(), 'src/modules/orders/ui/storefront/OrderHistoryTable.tsx'),
  'utf8',
);
const commercialOrdersUiIndex = readFileSync(
  resolve(process.cwd(), 'src/modules/commercial-orders/ui/index.ts'),
  'utf8',
);
const unifiedOrderDetail = readFileSync(
  resolve(process.cwd(), 'src/app/surfaces/UnifiedOrderDetailPage.tsx'),
  'utf8',
);
const unifiedOrderDetailView = readFileSync(
  resolve(process.cwd(), 'src/app/surfaces/UnifiedOrderDetailView.tsx'),
  'utf8',
);
const orderStatusDialog = readFileSync(
  resolve(process.cwd(), 'src/modules/commercial-orders/ui/components/OrderStatusDialog.tsx'),
  'utf8',
);

describe('surface du dashboard commandes', () => {
  it('utilise la largeur disponible du dashboard et demande explicitement son apparence', () => {
    expect(dashboardOrders).toContain('w-full min-w-0');
    expect(dashboardOrders).toContain('appearance="dashboard"');
  });

  it('garde une apparence portail par défaut pour ne pas modifier la boutique', () => {
    expect(orderHistoryTable).toContain("appearance?: 'portal' | 'dashboard'");
    expect(orderHistoryTable).toContain("appearance = 'portal'");
    expect(orderHistoryTable).toContain("appearance === 'dashboard'");
  });

  it('rend le tableau dashboard dans une surface compacte, stable et scrollable', () => {
    expect(orderHistoryTable).toContain('rounded-md border border-line bg-paper');
    expect(orderHistoryTable).toContain('min-w-[1610px] table-fixed');
    expect(orderHistoryTable).toContain('<colgroup>');
    expect(orderHistoryTable).toContain('N°');
    expect(orderHistoryTable).toContain('o.number ??');
    expect(orderHistoryTable).toContain('onClick={() => onOpenOrder(o)}');
    expect(orderHistoryTable).toContain('onClick={() => onOpenCustomer(o)}');
    expect(dashboardOrders).toContain('/dashboard/customers/${order.customer_id}');
    expect(orderHistoryTable).toContain("<col style={{ width: '390px' }} />");
    expect(orderHistoryTable).toContain('justify-start gap-1.5 whitespace-nowrap');
    expect(orderHistoryTable).toContain('text-[10.5px] tracking-[0.08em]');
    expect(orderHistoryTable).toContain('Actions');
    expect(orderHistoryTable).toContain('bg-bg px-4 py-3');
  });

  it('ne propose aucune transition directe depuis la grille dense', () => {
    expect(dashboardOrders).not.toContain('onValidateOrder=');
    expect(dashboardOrders).not.toContain('onStartProductionOrder=');
    expect(dashboardOrders).not.toContain('onMarkShippedOrder=');
    expect(dashboardOrders).not.toContain('onCancelOrder=');
  });

  it('ne remet pas l ancienne grille commerciale dans le bundle', () => {
    expect(existsSync(resolve(process.cwd(), 'src/modules/commercial-orders/ui/workspace/OrdersListPage.tsx'))).toBe(false);
    expect(commercialOrdersUiIndex).not.toContain('DashboardCommercialOrders');
  });

  it('garde les écrans actifs sur la lecture commune', () => {
    expect(dashboardOrders).not.toContain('CommercialOrdersApiClient');
    expect(unifiedOrderDetail).toContain('getUnifiedDetail');
    expect(unifiedOrderDetail).toContain('UnifiedOrderDetailView');
    expect(unifiedOrderDetail).not.toContain('resolved.origin');
    expect(orderStatusDialog).toContain('getUnifiedDetail');
    expect(orderStatusDialog).not.toContain('ordersApi.getDetail');
  });

  it('ne conserve qu une seule implementation de la fiche commande', () => {
    expect(existsSync(resolve(process.cwd(), 'src/modules/orders/ui/workspace/OrderDetailPage.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/modules/commercial-orders/ui/hooks/useOrderDetail.ts'))).toBe(false);
    expect(unifiedOrderDetailView).toContain('data-testid="unified-order-detail"');
    expect(unifiedOrderDetailView).toContain('normalizeLines(order)');
  });
});
