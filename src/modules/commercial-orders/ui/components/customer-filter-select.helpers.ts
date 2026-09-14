/**
 * Logique PURE (hors rendu) du selecteur de client a recherche serveur de la
 * grille des commandes (E10.18e-1, docs/api/CONVENTIONS.md §8.24 point
 * (iii)) : "un SELECTEUR A RECHERCHE sur `GET /customers?q=`... Pas une
 * liste chargee d un coup — le precedent du depot... tronque en silence
 * au-dela de 200 clients".
 *
 * qa-review round 1 (2026-09-14) :
 * - **m1 (corrige)** : `debounced.cancel()` ajoute.
 * - **M5 (corrige)** : `buildCustomerSearch()` propage `nextCursor` sous
 *   forme d un indicateur `truncated`, jamais tu en silence.
 *
 * qa-review round 2 (2026-09-14), condition (b1) de l architecte — "un
 * controleur de recherche pur (`createCustomerSearchController`), teste
 * avec des timers factices, qui gere vide et cancel, chargement, erreur et
 * troncature" : `CustomerFilterSelect.tsx` avait sa PROPRE machine d etat
 * (query/results/truncated/loading/error geres par des `useState` epars et
 * un `useEffect` qui relance la recherche). Cette machine est deplacee ICI,
 * dans `createCustomerSearchController()` — le composant ne fait plus que
 * lire l etat qu il publie et lui transmettre les frappes.
 */
import type { CustomerDto, CustomersApiClient } from '@/modules/customers';

/** Taille de la page de recherche du selecteur — volontairement PETITE (menu deroulant, pas une liste complete). */
export const CUSTOMER_SEARCH_PAGE_SIZE = 20;

export type DebouncedSearch<TQuery, TResult> = ((query: TQuery) => Promise<TResult>) & {
  /**
   * Annule le timer en attente, s il y en a un — AUCUN appel a `search` n a
   * lieu pour la frappe en cours d attente. N annule PAS un appel reseau deja
   * parti (le mecanisme de generation ci-dessous s en charge : sa reponse,
   * si elle arrive, est de toute facon ignoree par le prochain appel).
   */
  cancel: () => void;
};

/**
 * Enveloppe `search` d un debounce de `delayMs` : un appel a la fonction
 * rendue REMPLACE tout appel non encore declenche (le timer precedent est
 * annule), et si `search` d une frappe ANTERIEURE resout APRES une frappe
 * plus RECENTE, sa reponse est silencieusement ignoree (jamais affichee a
 * la place de la derniere requete demandee).
 */
export function createDebouncedSearch<TQuery, TResult>(
  search: (query: TQuery) => Promise<TResult>,
  delayMs: number,
): DebouncedSearch<TQuery, TResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

  const debounced = ((query: TQuery) =>
    new Promise<TResult>((resolve, reject) => {
      if (timer !== undefined) clearTimeout(timer);
      const requestedGeneration = ++generation;
      timer = setTimeout(() => {
        search(query).then(
          (result) => {
            if (requestedGeneration === generation) resolve(result);
            // sinon : une recherche plus recente a ete lancee entre-temps,
            // cette reponse perimee est ignoree sans jamais etre affichee.
          },
          (cause) => {
            if (requestedGeneration === generation) reject(cause);
          },
        );
      }, delayMs);
    })) as DebouncedSearch<TQuery, TResult>;

  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    // Une generation neuve invalide aussi tout appel reseau DEJA parti pour
    // la frappe annulee : s il repond malgre tout, il ne sera jamais resolu.
    generation += 1;
  };

  return debounced;
}

export type CustomerSearchResult = Readonly<{
  items: readonly CustomerDto[];
  /** `true` si le serveur indique qu il existe d autres resultats au-dela de cette page — jamais tu en silence. */
  truncated: boolean;
}>;

/**
 * Construit la fonction de recherche client du selecteur — SEUL point
 * d appel a `customersApi.list()` pour ce composant. `q` est transmis TEL
 * QUEL, jamais reconstruit ; `pageSize` est TOUJOURS celui du selecteur
 * (`CUSTOMER_SEARCH_PAGE_SIZE`), jamais un chargement de tout le tenant.
 */
export function buildCustomerSearch(
  api: Pick<CustomersApiClient, 'list'>,
): (query: string) => Promise<CustomerSearchResult> {
  return async (query: string) => {
    const page = await api.list({ q: query, pageSize: CUSTOMER_SEARCH_PAGE_SIZE });
    return { items: page.items, truncated: page.nextCursor !== null };
  };
}

// ---------------------------------------------------------------------------
// Controleur de recherche — condition (b1), round 2 : toute la machine
// d etat du selecteur (texte tape, chargement, resultats, troncature,
// erreur) est PURE et testee ICI, avec des timers factices. Le composant ne
// fait plus que s abonner (`notify`) et transmettre les frappes
// (`setQuery`).
// ---------------------------------------------------------------------------

export type CustomerSearchState = Readonly<{
  query: string;
  loading: boolean;
  results: readonly CustomerDto[];
  truncated: boolean;
  error: string | null;
}>;

export const INITIAL_CUSTOMER_SEARCH_STATE: CustomerSearchState = Object.freeze({
  query: '',
  loading: false,
  results: [],
  truncated: false,
  error: null,
});

export type CustomerSearchController = Readonly<{
  getState: () => CustomerSearchState;
  /** Transmet une frappe — vide ANNULE toute recherche en attente (round 1, m1 ; round 2, N05). */
  setQuery: (query: string) => void;
  /** A appeler au demontage du composant : annule toute recherche en attente. */
  dispose: () => void;
}>;

/**
 * Cree un controleur de recherche client, debattu de `delayMs`. `notify`
 * est appele a CHAQUE changement d etat (le composant y fait un simple
 * `setState` miroir). Chaque frappe non vide passe par le debounce interne
 * — round 2, R20 : il n existe plus de chemin qui appelle `search`
 * directement, en contournant le debounce, DEPUIS LE COMPOSANT ; ce chemin
 * n existe qu ICI, et une regression a cet endroit precis est testable
 * (timers factices, comme `createDebouncedSearch`).
 */
export function createCustomerSearchController(
  search: (query: string) => Promise<CustomerSearchResult>,
  delayMs: number,
  notify: (state: CustomerSearchState) => void,
): CustomerSearchController {
  let state: CustomerSearchState = INITIAL_CUSTOMER_SEARCH_STATE;
  const debounced = createDebouncedSearch(search, delayMs);

  function setState(patch: Partial<CustomerSearchState>): void {
    state = { ...state, ...patch };
    notify(state);
  }

  return {
    getState: () => state,
    setQuery(query: string) {
      const trimmed = query.trim();
      if (!trimmed) {
        // round 1 m1 / round 2 N05 : annule une recherche encore en
        // attente — sinon une frappe effacee avant le delai de debounce
        // part quand meme et peut remplir un champ deja vide a son retour.
        debounced.cancel();
        setState({ query, results: [], truncated: false, error: null, loading: false });
        return;
      }
      setState({ query, loading: true, error: null });
      debounced(trimmed).then(
        (page) => {
          // round 2, N06/N07 : `truncated` est TOUJOURS celui du resultat,
          // jamais fige a `false`.
          setState({ loading: false, results: page.items, truncated: page.truncated });
        },
        (cause: unknown) => {
          // round 2, N09 : une erreur reste une erreur, jamais deguisee en
          // "aucun resultat".
          setState({
            loading: false,
            results: [],
            truncated: false,
            error: cause instanceof Error ? cause.message : 'Recherche impossible.',
          });
        },
      );
    },
    dispose() {
      debounced.cancel();
    },
  };
}

// ---------------------------------------------------------------------------
// Options du menu — condition (b1), round 2 : "les options du selecteur de
// client, « Tous les clients » compris, construites par une fonction pure."
// ---------------------------------------------------------------------------

export type CustomerFilterOption = Readonly<{
  /** Identifiant du client, ou chaine vide pour l option "Tous les clients". */
  id: string;
  label: string;
  kind: 'all' | 'customer';
}>;

/**
 * Construit la liste d options du menu : "Tous les clients" (SEULEMENT si
 * un client est deja selectionne —§8.24 point (iii), pas d option inutile
 * quand aucun filtre n est actif), suivie des resultats de recherche.
 * `customerLabel` est fourni par l appelant (`customerDisplayName`, deja
 * teste ailleurs) — cette fonction ne fait qu assembler, elle ne calcule
 * aucun libelle de client elle-meme.
 */
export function buildCustomerFilterOptions(
  searchState: CustomerSearchState,
  hasActiveCustomerFilter: boolean,
  customerLabel: (customer: CustomerDto) => string,
): readonly CustomerFilterOption[] {
  const allOption: readonly CustomerFilterOption[] = hasActiveCustomerFilter
    ? [{ id: '', label: 'Tous les clients', kind: 'all' }]
    : [];
  return [
    ...allOption,
    ...searchState.results.map((customer) => ({ id: customer.id, label: customerLabel(customer), kind: 'customer' as const })),
  ];
}
