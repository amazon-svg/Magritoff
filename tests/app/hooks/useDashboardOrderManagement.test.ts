import { describe, expect, it } from 'vitest';
import { dashboardOrderTransitionKey } from '../../../src/app/hooks/useDashboardOrderManagement';

describe('dashboardOrderTransitionKey', () => {
  it('stabilise la clé par commande et transition', () => {
    expect(dashboardOrderTransitionKey('order-1', 'draft', 'validated'))
      .toBe('order-transition:order-1:draft:validated');
  });
});
