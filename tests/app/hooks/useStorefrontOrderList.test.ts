/**
 * Tests vitest pour `runCancelOrder` (orchestration pure extraite de
 * useStorefrontOrderList.ts — qa-review round 2, 2026-09-16, mutations
 * M4/M5). Pas de rendu React : le node applicatif est exercé via des
 * dépendances injectées (espions vitest), suivant le pattern deja en place
 * dans le depot pour tester les hooks (fonctions pures extraites, cf.
 * useCommercialManagement.test.ts, useRoleAssignmentManagement.test.ts).
 */

import { describe, it, expect, vi } from 'vitest';
import { runCancelOrder, type CancelOrderDeps } from '@/modules/orders/ui/hooks/useStorefrontOrderList';
import type { OrderUI } from '@/modules/orders/ui/storefront/PortalOrders.helpers';

function makeOrder(overrides: Partial<OrderUI> = {}): OrderUI {
  return {
    id: 'order-1',
    status: 'draft',
    source: 'v1_1',
    date: '2026-09-16T00:00:00+00:00',
    customer_name: 'Client Test',
    customer_email: 'client@example.test',
    total_ht: 100,
    total_ttc: 120,
    items: [],
    ...overrides,
  };
}

describe('runCancelOrder', () => {
  it("commande introuvable -> message d erreur immediat, AUCUN appel a transition/reload/onSuccess", async () => {
    const deps: CancelOrderDeps = {
      findOrder: () => undefined,
      transition: vi.fn(),
      reload: vi.fn(),
      onSuccess: vi.fn(),
    };
    const result = await runCancelOrder('missing-id', deps);
    expect(result).toBe('Commande introuvable');
    expect(deps.transition).not.toHaveBeenCalled();
    expect(deps.reload).not.toHaveBeenCalled();
    expect(deps.onSuccess).not.toHaveBeenCalled();
  });

  it('succes -> reload appele UNE fois, onSuccess appele, retourne null', async () => {
    const order = makeOrder();
    const transition = vi.fn().mockResolvedValue(undefined);
    const reload = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const result = await runCancelOrder(order.id, { findOrder: () => order, transition, reload, onSuccess });

    expect(result).toBeNull();
    expect(transition).toHaveBeenCalledTimes(1);
    expect(transition).toHaveBeenCalledWith(order);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  // qa-review round 2 (mutation M4) : la mutation qui supprime le reload sur
  // le chemin d'echec doit faire echouer ce test.
  it('echec (transition rejetee) -> reload appele QUAND MEME UNE fois', async () => {
    const order = makeOrder();
    const transition = vi.fn().mockRejectedValue(new Error('order_not_found: xyz'));
    const reload = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    await runCancelOrder(order.id, { findOrder: () => order, transition, reload, onSuccess });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  // qa-review round 2 (mutation M5) : la mutation qui appelle onSuccess sans
  // condition (ou qui ignore l'echec) doit faire echouer ce test.
  it('echec (transition rejetee) -> AUCUN appel a onSuccess (pas de toast de succes)', async () => {
    const order = makeOrder();
    const transition = vi.fn().mockRejectedValue(new Error('order_not_found: xyz'));
    const reload = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    await runCancelOrder(order.id, { findOrder: () => order, transition, reload, onSuccess });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('echec (transition rejetee) -> retourne le message formate (pas le texte technique)', async () => {
    const order = makeOrder();
    const transition = vi.fn().mockRejectedValue(new Error('order_not_found: 7c1f1a4e-0000-0000-0000-000000000000'));
    const reload = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const result = await runCancelOrder(order.id, { findOrder: () => order, transition, reload, onSuccess });

    expect(result).toContain("n'existe plus");
    expect(result).not.toContain('order_not_found');
  });

  it("l ordre des effets est : transition, PUIS reload (le reload voit le vrai statut post-transition)", async () => {
    const order = makeOrder();
    const calls: string[] = [];
    const transition = vi.fn().mockImplementation(async () => { calls.push('transition'); });
    const reload = vi.fn().mockImplementation(async () => { calls.push('reload'); });
    await runCancelOrder(order.id, { findOrder: () => order, transition, reload, onSuccess: vi.fn() });

    expect(calls).toEqual(['transition', 'reload']);
  });
});
