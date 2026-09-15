import { describe, expect, it, vi } from 'vitest';
import {
  dashboardOrderTransitionKey,
  runOrderTransition,
  type RunOrderTransitionDeps,
} from '@/modules/orders/ui/hooks/useDashboardOrderManagement';

describe('dashboardOrderTransitionKey', () => {
  it('stabilise la clé par commande et transition', () => {
    expect(dashboardOrderTransitionKey('order-1', 'draft', 'validated'))
      .toBe('order-transition:order-1:draft:validated');
  });
});

/**
 * qa-review round 2 (2026-09-16, mutations M4/M5) : orchestration pure
 * extraite de `useDashboardOrderManagement.transition()`. Pas de rendu React
 * — mêmes dépendances injectées (espions vitest) que pour
 * `runCancelOrder` (tests/app/hooks/useStorefrontOrderList.test.ts).
 */
describe('runOrderTransition', () => {
  it('succes -> reload appele UNE fois, retourne null', async () => {
    const transition = vi.fn().mockResolvedValue(undefined);
    const reload = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();
    const deps: RunOrderTransitionDeps = { transition, reload, onError };

    const result = await runOrderTransition(deps);

    expect(result).toBeNull();
    expect(transition).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  // Mutation M4 : une mutation qui saute le reload sur le chemin d'echec
  // (ex. `if (cause === null) await deps.reload();`) doit faire echouer ce test.
  it('echec (transition rejetee) -> reload appele QUAND MEME UNE fois', async () => {
    const cause = new Error('transition_not_allowed: validated -> cancelled');
    const transition = vi.fn().mockRejectedValue(cause);
    const reload = vi.fn().mockResolvedValue(undefined);
    const deps: RunOrderTransitionDeps = { transition, reload };

    await runOrderTransition(deps);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('echec (transition rejetee) -> retourne la cause (non null), onError appele avec la cause', async () => {
    const cause = new Error('transition_not_allowed: validated -> cancelled');
    const transition = vi.fn().mockRejectedValue(cause);
    const reload = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();
    const deps: RunOrderTransitionDeps = { transition, reload, onError };

    const result = await runOrderTransition(deps);

    expect(result).toBe(cause);
    expect(onError).toHaveBeenCalledWith(cause);
  });

  // Mutation M5 (portee dashboard : pas de toast ici, mais la meme mutation
  // de classe — "traiter l'echec comme un succes" — doit etre detectee par
  // la valeur de retour distincte de null.
  it('echec (transition rejetee) -> la valeur de retour n est JAMAIS null (distingue succes/echec)', async () => {
    const transition = vi.fn().mockRejectedValue(new Error('permission_denied: order identity mismatch'));
    const reload = vi.fn().mockResolvedValue(undefined);
    const deps: RunOrderTransitionDeps = { transition, reload };

    const result = await runOrderTransition(deps);

    expect(result).not.toBeNull();
  });

  it("l ordre des effets est : transition, PUIS reload", async () => {
    const calls: string[] = [];
    const transition = vi.fn().mockImplementation(async () => { calls.push('transition'); });
    const reload = vi.fn().mockImplementation(async () => { calls.push('reload'); });
    await runOrderTransition({ transition, reload });

    expect(calls).toEqual(['transition', 'reload']);
  });
});
