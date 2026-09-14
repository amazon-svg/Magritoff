/**
 * `createDebouncedSearch`/`buildCustomerSearch`/`createCustomerSearchController`/
 * `buildCustomerFilterOptions` (E10.18e-1, selecteur de client de la grille
 * des commandes, DURCIS en qa-review round 1 puis round 2, 2026-09-14) —
 * testes avec des timers factices et des fakes, sans
 * `@testing-library/react` (absente de ce depot) : ce fichier ne rend rien,
 * il n exerce que des fonctions pures.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCustomerFilterOptions,
  buildCustomerSearch,
  createCustomerSearchController,
  createDebouncedSearch,
  CUSTOMER_SEARCH_PAGE_SIZE,
  INITIAL_CUSTOMER_SEARCH_STATE,
  type CustomerSearchState,
} from '@/modules/commercial-orders/ui/components/customer-filter-select.helpers';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createDebouncedSearch', () => {
  it('n appelle la recherche sous-jacente qu apres le delai, pas a chaque frappe', async () => {
    // Mutation : appeler `search` immediatement (sans `setTimeout`) ferait
    // tomber ce test, qui exige zero appel avant l ecoulement du delai.
    const search = vi.fn().mockResolvedValue(['r']);
    const debounced = createDebouncedSearch(search, 300);

    void debounced('a');
    expect(search).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(299);
    expect(search).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('a');
  });

  it('annule la frappe precedente : seule la DERNIERE requete declenche un appel reseau', async () => {
    // Mutation : ne pas annuler le timer precedent ferait deux appels
    // reseau (un par frappe) au lieu d un seul apres la derniere frappe.
    const search = vi.fn().mockResolvedValue([]);
    const debounced = createDebouncedSearch(search, 300);

    void debounced('a');
    await vi.advanceTimersByTimeAsync(100);
    void debounced('ab');
    await vi.advanceTimersByTimeAsync(100);
    void debounced('abc');
    await vi.advanceTimersByTimeAsync(300);

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('abc');
  });

  it('ignore une reponse PERIMEE : une recherche anterieure qui repond APRES une plus recente ne resout jamais', async () => {
    // Mutation : resoudre la promesse sans verifier la generation courante
    // ferait courir le risque d afficher les resultats d une frappe
    // anterieure a la place de la derniere demandee (course).
    let resolveFirst!: (value: readonly string[]) => void;
    let resolveSecond!: (value: readonly string[]) => void;
    const search = vi
      .fn()
      .mockImplementationOnce(() => new Promise<readonly string[]>((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => new Promise<readonly string[]>((resolve) => (resolveSecond = resolve)));
    const debounced = createDebouncedSearch(search, 300);

    const firstPromise = debounced('a');
    await vi.advanceTimersByTimeAsync(300);
    // Une deuxieme frappe intervient APRES que la premiere ait declenche son appel reseau.
    const secondPromise = debounced('ab');
    await vi.advanceTimersByTimeAsync(300);

    expect(search).toHaveBeenCalledTimes(2);

    let firstResolved = false;
    void firstPromise.then(() => {
      firstResolved = true;
    });

    // La reponse de la recherche PERIMEE ('a') arrive APRES celle de la recherche courante.
    resolveSecond(['ab-result']);
    await Promise.resolve();
    await Promise.resolve();
    await expect(secondPromise).resolves.toEqual(['ab-result']);

    resolveFirst(['a-result']);
    await Promise.resolve();
    await Promise.resolve();
    expect(firstResolved).toBe(false);
  });

  it('un nouvel appel remplace le timer meme avant l expiration du delai precedent', async () => {
    const search = vi.fn().mockResolvedValue(['only-b']);
    const debounced = createDebouncedSearch(search, 300);

    void debounced('a');
    await vi.advanceTimersByTimeAsync(200);
    const result = debounced('b');
    await vi.advanceTimersByTimeAsync(300);

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('b');
    await expect(result).resolves.toEqual(['only-b']);
  });

  it('cancel() annule la frappe programmee : aucun appel reseau si le delai n a pas encore expire (qa-review round 1, m1)', async () => {
    // Mutation qui ferait tomber ce test : ne pas appeler `clearTimeout`
    // dans `cancel()` — sans lui, une frappe effacee avant le delai de
    // debounce part quand meme en arriere-plan et peut remplir un champ
    // deja vide a son retour.
    const search = vi.fn().mockResolvedValue([]);
    const debounced = createDebouncedSearch(search, 300);

    void debounced('dup').catch(() => undefined);
    debounced.cancel();
    await vi.advanceTimersByTimeAsync(300);

    expect(search).not.toHaveBeenCalled();
  });

  it('cancel() apres un appel reseau deja parti (encore EN VOL) empeche sa reponse de resoudre (generation invalidee)', async () => {
    let resolveSearch!: (value: readonly string[]) => void;
    const search = vi.fn().mockImplementation(() => new Promise<readonly string[]>((resolve) => (resolveSearch = resolve)));
    const debounced = createDebouncedSearch(search, 300);

    const promise = debounced('a');
    await vi.advanceTimersByTimeAsync(300);
    expect(search).toHaveBeenCalledTimes(1);
    // L appel reseau est parti mais N A PAS ENCORE REPONDU : cancel() intervient pendant qu il est en vol.
    debounced.cancel();

    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });
    resolveSearch(['perime']);
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);
  });
});

describe('buildCustomerSearch (qa-review round 1, M5) — plus de troncature silencieuse', () => {
  it('transmet `q` tel quel et la taille de page du selecteur, jamais un chargement de tout le tenant', () => {
    // Mutation qui ferait tomber ce test : appeler `api.list({ pageSize: 200 })`
    // sans `q` (le meme anti-patron deja denonce pour `PriceRuleFormModal`/
    // `PricingRulesPage`/`AddToProjectModal`).
    const list = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const search = buildCustomerSearch({ list });

    void search('dup');

    expect(list).toHaveBeenCalledWith({ q: 'dup', pageSize: CUSTOMER_SEARCH_PAGE_SIZE });
  });

  it('signale une recherche TRONQUEE via `truncated`, jamais en silence', async () => {
    const list = vi.fn().mockResolvedValue({ items: [{ id: 'c1' }], nextCursor: 'cursor-2' });
    const search = buildCustomerSearch({ list });

    const result = await search('dup');

    expect(result.truncated).toBe(true);
    expect(result.items).toEqual([{ id: 'c1' }]);
  });

  it('`truncated` est faux quand il n y a pas de page suivante', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const search = buildCustomerSearch({ list });

    const result = await search('dup');

    expect(result.truncated).toBe(false);
  });
});

describe('createCustomerSearchController (qa-review round 2, condition (b1) — R20/N05/N06/N09)', () => {
  it('R20 — une frappe non vide passe TOUJOURS par le debounce interne, jamais un appel direct a `search`', async () => {
    // Mutation qui ferait tomber ce test : `setQuery` appelant `search(trimmed)`
    // directement au lieu de `debounced(trimmed)` (R20 — round 1 mutait le
    // composant a cet endroit ; round 2 deplace ce risque ICI, dans le
    // controleur, qui EST teste).
    const search = vi.fn().mockResolvedValue({ items: [], truncated: false });
    const notify = vi.fn();
    const controller = createCustomerSearchController(search, 300, notify);

    controller.setQuery('a');
    expect(search).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('a');
  });

  it('N05 — un champ redevenu vide annule une recherche encore en attente', async () => {
    const search = vi.fn().mockResolvedValue({ items: [], truncated: false });
    const notify = vi.fn();
    const controller = createCustomerSearchController(search, 300, notify);

    controller.setQuery('dup');
    controller.setQuery('');
    await vi.advanceTimersByTimeAsync(300);

    expect(search).not.toHaveBeenCalled();
    expect(controller.getState().results).toEqual([]);
  });

  it('N06 — `truncated` reflete TOUJOURS le resultat de la recherche, jamais fige a faux', async () => {
    // Mutation qui ferait tomber ce test : `setQuery` posant `truncated: false`
    // en dur dans la branche de succes au lieu de `page.truncated`.
    const search = vi.fn().mockResolvedValue({ items: [{ id: 'c1' }], truncated: true });
    const notify = vi.fn();
    const controller = createCustomerSearchController(search, 300, notify);

    controller.setQuery('dup');
    await vi.advanceTimersByTimeAsync(300);
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.getState().truncated).toBe(true);
  });

  it('N09 — une recherche en echec pose une erreur DISTINCTE, jamais deguisee en "aucun resultat"', async () => {
    // Mutation qui ferait tomber ce test : `setQuery` avalant `cause` dans le
    // `catch` (`void cause;`) sans jamais renseigner `error`.
    const search = vi.fn().mockRejectedValue(new Error('recherche indisponible'));
    const notify = vi.fn();
    const controller = createCustomerSearchController(search, 300, notify);

    controller.setQuery('dup');
    await vi.advanceTimersByTimeAsync(300);
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.getState().error).toBe('recherche indisponible');
    expect(controller.getState().results).toEqual([]);
  });

  it('bascule `loading` a `true` pendant la recherche, `false` une fois resolue', async () => {
    let resolveSearch!: (value: { items: never[]; truncated: boolean }) => void;
    const search = vi.fn().mockImplementation(() => new Promise((resolve) => (resolveSearch = resolve)));
    const notify = vi.fn();
    const controller = createCustomerSearchController(search, 300, notify);

    controller.setQuery('dup');
    await vi.advanceTimersByTimeAsync(300);
    expect(controller.getState().loading).toBe(true);
    resolveSearch({ items: [], truncated: false });
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getState().loading).toBe(false);
  });

  it('notify() est appele a chaque changement d etat, avec l etat courant', () => {
    const search = vi.fn().mockResolvedValue({ items: [], truncated: false });
    const notify = vi.fn();
    const controller = createCustomerSearchController(search, 300, notify);

    controller.setQuery('a');

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ query: 'a', loading: true }));
  });

  it('dispose() annule une recherche en attente (demontage du composant)', async () => {
    const search = vi.fn().mockResolvedValue({ items: [], truncated: false });
    const controller = createCustomerSearchController(search, 300, vi.fn());

    controller.setQuery('a');
    controller.dispose();
    await vi.advanceTimersByTimeAsync(300);

    expect(search).not.toHaveBeenCalled();
  });

  it('l etat initial est vide (aucune recherche lancee)', () => {
    const controller = createCustomerSearchController(vi.fn(), 300, vi.fn());
    expect(controller.getState()).toEqual(INITIAL_CUSTOMER_SEARCH_STATE);
  });
});

describe('buildCustomerFilterOptions (qa-review round 2, condition (b1) — "les options... « Tous les clients » compris")', () => {
  const searchStateWithResults: CustomerSearchState = {
    ...INITIAL_CUSTOMER_SEARCH_STATE,
    results: [{ id: 'c1' } as never, { id: 'c2' } as never],
  };

  it('n expose PAS "Tous les clients" quand aucun filtre client n est actif', () => {
    const options = buildCustomerFilterOptions(searchStateWithResults, false, () => 'X');
    expect(options.map((o) => o.kind)).toEqual(['customer', 'customer']);
  });

  it('expose "Tous les clients" EN PREMIER quand un filtre client est actif', () => {
    const options = buildCustomerFilterOptions(searchStateWithResults, true, () => 'X');
    expect(options[0]).toEqual({ id: '', label: 'Tous les clients', kind: 'all' });
    expect(options).toHaveLength(3);
  });

  it('construit le libelle de chaque option client via la fonction fournie, jamais recalcule elle-meme', () => {
    const customerLabel = vi.fn((c: { id: string }) => `Client ${c.id}`);
    const options = buildCustomerFilterOptions(searchStateWithResults, false, customerLabel as never);
    expect(options.map((o) => o.label)).toEqual(['Client c1', 'Client c2']);
    expect(customerLabel).toHaveBeenCalledTimes(2);
  });

  it('rend une liste vide quand la recherche n a aucun resultat et qu aucun filtre n est actif', () => {
    expect(buildCustomerFilterOptions(INITIAL_CUSTOMER_SEARCH_STATE, false, () => 'X')).toEqual([]);
  });
});
