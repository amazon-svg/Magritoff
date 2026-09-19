import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  dashboardOrderTransitionKey,
  runDashboardOrderTransition,
  runOrderTransition,
  runValidateOrder,
  type DashboardOrderTransitionDeps,
  type RunOrderTransitionDeps,
  type RunValidateOrderDeps,
} from '@/modules/orders/ui/hooks/useDashboardOrderManagement';
// Le nettoyage des commentaires vit DESORMAIS dans un seul fichier :
// `tests/_helpers/stripComments.ts`. Il etait recopie a la main ici, et la
// copie etait plus faible que l original — d abord le `//` ancre en debut de
// ligne, puis (apres correction round 3) le `/* */` reste ancre. Le detail
// et les limites sont documentes la-bas.
import { stripComments } from '../../_helpers/stripComments';

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

/**
 * Q17-c (qa-review round 1, BLOQUANT 2, CORRIGÉ) — `acknowledgeUnverifiedPrices`
 * doit voyager du geste distinct de `ValidateOrderConfirmDialog` jusqu'à
 * `ordersApi.transition`, jamais deviné ni figé. La qa a muté ce booléen à
 * `true` en dur DANS la closure interne du hook, tout en laissant l'ancienne
 * forme dans un commentaire adjacent : les assertions texte de la version
 * précédente de ce fichier restaient vertes (3379 tests), parce qu'elles ne
 * lisaient QUE le texte source, jamais un COMPORTEMENT.
 *
 * Correction : `runDashboardOrderTransition` (extraite du hook,
 * `useDashboardOrderManagement.ts`) est exercée directement avec un faux
 * `transitionApi` — même technique que `runOrderTransition`/`runCancelOrder`,
 * déjà en place. Ce test lit l'argument RÉELLEMENT reçu par le faux client :
 * une mutation qui fige `acknowledgeUnverifiedPrices` à `true` (ou l'inverse)
 * fait échouer l'un des deux cas ci-dessous, quel que soit le commentaire
 * laissé dans le source.
 */
describe('runDashboardOrderTransition (Q17-c, BLOQUANT 2)', () => {
  function deps(transitionApi: DashboardOrderTransitionDeps['transitionApi']): DashboardOrderTransitionDeps {
    return { transitionApi, reload: vi.fn().mockResolvedValue(undefined) };
  }

  it('acknowledgeUnverifiedPrices=true est transmis TEL QUEL au client, jamais réécrit', async () => {
    const transitionApi = vi.fn().mockResolvedValue(undefined);
    await runDashboardOrderTransition({ id: 'order-1', status: 'draft' }, 'validated', true, deps(transitionApi));

    expect(transitionApi).toHaveBeenCalledWith('order-1', expect.objectContaining({
      toStatus: 'validated',
      acknowledgeUnverifiedPrices: true,
    }));
  });

  it('acknowledgeUnverifiedPrices=false est transmis TEL QUEL — jamais figé à true par défaut', async () => {
    const transitionApi = vi.fn().mockResolvedValue(undefined);
    await runDashboardOrderTransition({ id: 'order-1', status: 'draft' }, 'validated', false, deps(transitionApi));

    expect(transitionApi).toHaveBeenCalledWith('order-1', expect.objectContaining({
      acknowledgeUnverifiedPrices: false,
    }));
  });

  it('une transition cancelled/in_production/shipped porte le booléen reçu, sans distinction cachée sur toStatus', async () => {
    const transitionApi = vi.fn().mockResolvedValue(undefined);
    await runDashboardOrderTransition({ id: 'order-2', status: 'validated' }, 'cancelled', false, deps(transitionApi));

    expect(transitionApi).toHaveBeenCalledWith('order-2', expect.objectContaining({
      toStatus: 'cancelled',
      acknowledgeUnverifiedPrices: false,
    }));
  });

  it("l idempotencyKey reste stable par commande/transition (dashboardOrderTransitionKey), inchangee par l acquittement", async () => {
    const transitionApi = vi.fn().mockResolvedValue(undefined);
    await runDashboardOrderTransition({ id: 'order-3', status: 'draft' }, 'validated', true, deps(transitionApi));

    expect(transitionApi).toHaveBeenCalledWith('order-3', expect.objectContaining({
      idempotencyKey: dashboardOrderTransitionKey('order-3', 'draft', 'validated'),
    }));
  });
});

/**
 * Q17-c (qa-review round 2, BLOQUANT 1 — troisième round) — le test textuel
 * qui vérifiait le câblage de `validate()` a été démontré défaillant : un
 * `//` de fin de ligne défait `stripComments`, et la mutation exacte
 * (`transition(order ?? {...}, 'validated', true)` figé, ancien texte en
 * commentaire adjacent) restait invisible. Décision du coordinateur : on ne
 * répare pas ce test, on le remplace. `validate()` délègue désormais à
 * `runValidateOrder`, exportée et exercée ci-dessous avec un faux
 * `transition` — comportement réel, aucune lecture de source.
 */
describe('runValidateOrder (Q17-c, BLOQUANT 1 round 3)', () => {
  function deps(transition: RunValidateOrderDeps['transition'], order?: { id: string; status: string }): RunValidateOrderDeps {
    return {
      findOrder: () => order,
      transition,
    };
  }

  it('acknowledgeUnverifiedPrices=true est transmis TEL QUEL à transition(), jamais réécrit', async () => {
    const transition = vi.fn().mockResolvedValue(null);
    const order = { id: 'order-1', status: 'draft' };

    await runValidateOrder('order-1', true, deps(transition, order));

    expect(transition).toHaveBeenCalledWith(order, 'validated', true);
  });

  it('acknowledgeUnverifiedPrices=false est transmis TEL QUEL — jamais figé à true par défaut', async () => {
    const transition = vi.fn().mockResolvedValue(null);
    const order = { id: 'order-1', status: 'draft' };

    await runValidateOrder('order-1', false, deps(transition, order));

    expect(transition).toHaveBeenCalledWith(order, 'validated', false);
  });

  it('commande introuvable localement -> repli { id: orderId, status: draft }, acquittement toujours transmis tel quel', async () => {
    const transition = vi.fn().mockResolvedValue(null);

    await runValidateOrder('order-inconnu', true, deps(transition, undefined));

    expect(transition).toHaveBeenCalledWith({ id: 'order-inconnu', status: 'draft' }, 'validated', true);
  });

  it('transition en échec -> message formaté retourné (pas la cause brute)', async () => {
    const transition = vi.fn().mockResolvedValue(new Error('permission_denied: order identity mismatch'));

    const result = await runValidateOrder('order-1', false, deps(transition, { id: 'order-1', status: 'draft' }));

    expect(result).not.toBeNull();
    expect(result).not.toBeInstanceOf(Error);
  });

  it('transition réussie -> null', async () => {
    const transition = vi.fn().mockResolvedValue(null);

    const result = await runValidateOrder('order-1', false, deps(transition, { id: 'order-1', status: 'draft' }));

    expect(result).toBeNull();
  });
});

/**
 * Câblage restant, non extractible en fonction pure (closures internes du
 * hook React) : vérifié sur le texte source, commentaires retirés d'abord.
 * `cancel()` n a pas été identifiée comme vulnérable par la qa (elle ne
 * transmet aucun acquittement, `transition()` défaut à `false` par
 * construction) — laissée en l état, non touchée par cette correction.
 */
describe('useDashboardOrderManagement — câblage source, commentaires retirés (Q17-c)', () => {
  const source = stripComments(readFileSync(
    resolve(process.cwd(), 'src/modules/orders/ui/hooks/useDashboardOrderManagement.ts'),
    'utf8',
  ));

  it('cancel() ne relaie AUCUN acquittement (annuler un brouillon n a rien à acquitter)', () => {
    expect(source).toMatch(/transition\(order \?\? \{ id: orderId, status: 'draft' \}, 'cancelled'\);/);
  });
});
