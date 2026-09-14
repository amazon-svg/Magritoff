/**
 * Logique PURE de la grille des commandes (E10.18a, refondue en E10.18e-1,
 * DURCIE en qa-review round 1 puis round 2) — AUCUN calcul de prix/seuil/
 * quota (meme discipline que `order-detail.helpers.ts`).
 *
 * qa-review round 1 (2026-09-14), principe retenu, RAPPELE ET PRECISE en
 * round 2 (condition (b1) de l architecte, §8.24 e-1 point 10) : il n existe
 * AUCUN outil de rendu React dans ce depot. `OrdersListPage.tsx` est une
 * COQUILLE GENERIQUE : le reducteur, les descripteurs de COLONNES et de
 * FILTRES (chaque filtre porte sa propre action de reducteur), et le
 * chargeur d etapes sont purs et testes ICI ; le JSX ne fait plus que les
 * PARCOURIR. Ce que le JSX fait ENCORE seul (la boucle de rendu elle-meme,
 * le clic sur une option du selecteur de client) reste un point NON PROUVE
 * — explicitement signale comme tel dans le rapport de story, jamais
 * affirme comme teste.
 *
 * ── Etat et reducteur (B1/B2 round 1 ; V1/V2 round 2) ───────────────────
 * `OrdersListState`/`OrdersListAction`/`ordersListReducer` sont la SEULE
 * source de verite (filtres, tri, generation, catalogue d etapes, page,
 * statut). Chaque changement de filtre/tri incremente `generation` et remet
 * `orders`/`nextCursor` a zero dans le MEME mouvement (§8.24 e-1 point 3).
 * `loadOrdersListPage()` capture la generation ET le curseur utilise AVANT
 * l appel reseau ; le reducteur REJETTE toute reponse (`pageLoaded`/
 * `pageLoadFailed`) dont la generation ne correspond plus a l etat courant
 * — la course round 1 (tri change pendant qu une page suivante est en vol).
 * **Round 2** : pour une reponse `mode: 'more'`, le reducteur exige EN PLUS
 * `state.status === 'loading-more'` ET `action.cursor === state.nextCursor`
 * — sans cette seconde garde, un doublon de reponse "Charger plus" (meme
 * generation) ajoutait deux fois la meme page, et une reponse "more" isolee
 * pouvait s appliquer alors qu aucune requete "more" n etait attendue.
 *
 * ── Colonnes (M1 round 1 ; linkTo round 2) ───────────────────────────────
 * `ORDERS_LIST_COLUMNS` porte `header`, `cell()` ET, pour la seule colonne
 * N°, `linkTo()` — la decision "quelle colonne est cliquable et vers quoi"
 * est une PROPRIETE DE LA COLONNE, plus un index magique (`i === 0`) dans
 * le JSX (round 2, en reponse a la mutation N01 : permuter deux colonnes ne
 * doit plus deplacer le lien par accident).
 *
 * ── Filtres (round 2, condition (b1) ; DURCI round 3) ────────────────────
 * `ORDERS_LIST_FILTERS` : un descripteur par filtre — periode, etape, tri
 * ET CLIENT (round 3 : le filtre client est entre dans le MEME tableau,
 * plus d exception a part). Chaque descripteur porte `id`, `testId`,
 * `kind`, `label?` (le texte "Du"/"Au", round 3 — plus de table separee
 * indexee par id dans la page), `align?` (round 3 — plus de branche
 * `id === 'sort'` dans le JSX), `read`, `options?`, `toAction`.
 * `handleOrdersListFilterChange()` est le SEUL point qui traduit une valeur
 * saisie en action de reducteur, pour N IMPORTE LEQUEL de ces filtres —
 * client compris, via son propre type de valeur (`{ customerId, label }`
 * ou `null` pour l effacer).
 *
 * ── Resolution des clients d une page (round 3, mineur) ──────────────────
 * `missingCustomerIds()` est pure et testee : elle decide QUELS clients
 * restent a charger, a partir des commandes affichees, de ceux DEJA CONNUS
 * et de ceux DEJA EN VOL (pour ne pas les redemander). La page ne "jette"
 * plus un lot de reponses en cours quand `state.orders` change entre-temps
 * (ex. "Charger plus" resout avant les fiches clients de la page 1) — les
 * resultats sont FUSIONNES des qu ils arrivent, quel que soit l etat des
 * filtres au moment ou ils reviennent ; seul un DEMONTAGE reel du composant
 * les ignore.
 */
import type { CustomerDto } from '@/modules/customers';
import type { ProductionStepDto, ProductionStepsApiClient } from '@/modules/production-steps';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { PRODUCT_REFERENCE_TIME_ZONE } from '../../../../kernel/clock/index.ts';
import type { CommercialOrderDto, CommercialOrderSort } from '../../api/contracts.ts';
import type { CommercialOrdersApiClient, ListCommercialOrdersQuery } from '../../api/client.ts';
import { customerDisplayName } from './order-detail.helpers.ts';

const T = TEST_IDS.commercialOrder;

/**
 * Formate un `Timestamp` (`created_at`) dans le fuseau de reference du
 * produit (`Europe/Paris`) — jamais dans le fuseau du navigateur, qui
 * afficherait un jour DIFFERENT de celui que `created_from`/`created_to`
 * viennent de filtrer (contrat, docs/api/CONVENTIONS.md §8.24 point 5
 * regle 8). Meme constante que le serveur : une seule source du fuseau.
 */
export function formatOrderCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: PRODUCT_REFERENCE_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Tri par defaut de la grille — identique au defaut serveur (`-created_at`),
 * jamais recopie ailleurs. Un changement de defaut se fait ICI et nulle part
 * ailleurs (consigne §8.24, point 5).
 */
export const DEFAULT_ORDERS_LIST_SORT: CommercialOrderSort = '-created_at';

/**
 * Options de tri EXPOSEES a l ecran (consigne point 5) : le defaut, plus le
 * tri par etape dans les deux sens. `created_at` (croissant) N EST PAS
 * expose — rien ne l a decide (§8.24, decision 2 d Arnaud).
 */
export const ORDERS_LIST_SORT_OPTIONS: ReadonlyArray<{ value: CommercialOrderSort; label: string }> = [
  { value: '-created_at', label: 'Plus récentes en premier' },
  { value: 'production_step', label: "Étape de production (sens du flux)" },
  { value: '-production_step', label: 'Étape de production (sens inverse)' },
];

/** Taille de page — decision d Arnaud (§8.24 point 3 : « 50 et Charger plus, inchange »), exportee pour etre testable. */
export const ORDERS_LIST_PAGE_SIZE = 50;

/** Etat UNIQUE des filtres et du tri de la grille — voir en-tete de fichier. */
export type OrdersListFilters = Readonly<{
  /** `YYYY-MM-DD`, jour civil INCLUS, fuseau de reference. Chaine vide = non renseigne. */
  createdFrom: string;
  /** `YYYY-MM-DD`, jour civil INCLUS, fuseau de reference. Chaine vide = non renseigne. */
  createdTo: string;
  /** `Customer.id`. Chaine vide = aucun client selectionne. */
  customerId: string;
  /** `ProductionStep.id`. Chaine vide = aucune etape selectionnee. */
  productionStepId: string;
  sort: CommercialOrderSort;
}>;

export const DEFAULT_ORDERS_LIST_FILTERS: OrdersListFilters = Object.freeze({
  createdFrom: '',
  createdTo: '',
  customerId: '',
  productionStepId: '',
  sort: DEFAULT_ORDERS_LIST_SORT,
});

/** Vrai si au moins un filtre (periode, client ou etape — le tri n en est pas un) est actif — round 2, remplace une enumeration a la main dans la page. */
export function hasActiveOrdersListFilters(filters: OrdersListFilters): boolean {
  return Boolean(filters.createdFrom || filters.createdTo || filters.customerId || filters.productionStepId);
}

/**
 * Tire la partie "filtres" d une requete `list()` a partir de l etat unique
 * — AUCUNE des deux cles de pagination ici (page/curseur), qui sont du
 * ressort de l appelant (`buildInitialLoadRequest`/`buildLoadMoreRequest`
 * ci-dessous). Une valeur vide/par defaut devient une cle ABSENTE, jamais
 * une chaine vide ou le defaut envoye explicitement au serveur — meme
 * discipline que l ancien `buildPeriodQuery` (E10.18a), etendue aux trois
 * nouveaux axes.
 */
type OrdersListQueryFilterKeys = 'createdFrom' | 'createdTo' | 'customerId' | 'currentProductionStepId' | 'sort';

export function buildOrdersListQuery(filters: OrdersListFilters): Pick<ListCommercialOrdersQuery, OrdersListQueryFilterKeys> {
  const query: { -readonly [K in OrdersListQueryFilterKeys]?: ListCommercialOrdersQuery[K] } = {};
  if (filters.createdFrom.trim()) query.createdFrom = filters.createdFrom.trim();
  if (filters.createdTo.trim()) query.createdTo = filters.createdTo.trim();
  if (filters.customerId.trim()) query.customerId = filters.customerId.trim();
  if (filters.productionStepId.trim()) query.currentProductionStepId = filters.productionStepId.trim();
  if (filters.sort !== DEFAULT_ORDERS_LIST_SORT) query.sort = filters.sort;
  return query;
}

/**
 * Requete de PREMIERE page (chargement initial ou tout changement de filtre
 * / tri). AUCUN parametre de curseur dans sa signature : structurellement,
 * cette fonction ne peut jamais reprendre un curseur perime — c est ce qui
 * tient "tout changement de filtre ou de tri remet la liste et le curseur a
 * zero" (consigne §8.24 point 3, e-1 point 3). Voir aussi `ordersListReducer`
 * (`filtersChanged`/`customerSelected`/`customerCleared`) pour la remise a
 * zero de l ETAT (`orders`/`nextCursor`), que cette fonction seule ne peut
 * pas garantir : c est le reducteur qui la tient desormais (qa-review B2).
 */
export function buildInitialLoadRequest(filters: OrdersListFilters, pageSize: number): ListCommercialOrdersQuery {
  return { ...buildOrdersListQuery(filters), pageSize };
}

/** Requete de page SUIVANTE ("Charger plus") — seule fonction de ce fichier qui accepte un curseur. */
export function buildLoadMoreRequest(
  filters: OrdersListFilters,
  pageSize: number,
  cursor: string,
): ListCommercialOrdersQuery {
  return { ...buildOrdersListQuery(filters), pageSize, pageCursor: cursor };
}

/**
 * Libelle d une etape de production POUR L ECRAN (filtre et colonne "Etape
 * de production") : une etape DESACTIVEE reste proposee/affichee (le
 * contrat garde lisibles les commandes posees dessus, §8.24 point (iii)),
 * mais signalee comme telle — jamais confondue avec une etape active.
 */
export function formatProductionStepLabel(step: Pick<ProductionStepDto, 'label' | 'is_active'>): string {
  return step.is_active ? step.label : `${step.label} (désactivée)`;
}

/**
 * Libelle de l etape COURANTE d une commande (`current_production_step_id`),
 * pour la colonne de la grille. AUCUN appel reseau ici : `stepsById` est
 * construit UNE SEULE FOIS par la page, via `loadProductionStepCatalog()`
 * ci-dessous — jamais un appel par ligne. Une commande SANS etape (`null`)
 * ou dont l etape n est plus dans la collection (cas theorique, jamais
 * supprimee en pratique) affiche un tiret, jamais une chaine vide ni une
 * exception.
 */
export function resolveCurrentProductionStepLabel(
  currentProductionStepId: string | null,
  stepsById: ReadonlyMap<string, Pick<ProductionStepDto, 'label' | 'is_active'>>,
): string {
  if (!currentProductionStepId) return '—';
  const step = stepsById.get(currentProductionStepId);
  return step ? formatProductionStepLabel(step) : '—';
}

/**
 * Rend un montant serveur (`Money`, deja une chaine decimale figee) tel
 * quel, SANS AUCUNE conversion en `number` ni recalcul (consigne §8.24
 * point 4 : "montants rendus tels que le serveur les sert"). Utilisee pour
 * "Net HT" (`totals.net_total`) et "Total TTC" (`totals.total_incl_tax`),
 * meme rendu que la colonne Total TTC deja en place avant ce lot.
 */
export function formatOrderMoney(amount: string): string {
  return `${amount} €`;
}

// ---------------------------------------------------------------------------
// Colonnes — descripteurs UNIQUES, consommes par le JSX pour les en-tetes ET
// les cellules (qa-review round 1, M1 ; `linkTo`, round 2). `cell()` rend
// toujours une CHAINE ; `linkTo()`, quand present, rend le CHEMIN (relatif
// au dashboard tenant) vers lequel le JSX doit lier le contenu de la
// cellule — ce fichier ne connait ni React ni react-router, seulement des
// chaines.
// ---------------------------------------------------------------------------

/** Ce qu une cellule a besoin de resoudre en plus de la commande elle-meme : le nom du client et le catalogue d etapes, l un et l autre deja charges par la page (jamais un appel par ligne). */
export type OrdersListCellContext = Readonly<{
  stepsById: ReadonlyMap<string, Pick<ProductionStepDto, 'label' | 'is_active'>>;
  /** Nom d affichage d un client par identifiant — tiret si inconnu. Jamais un appel reseau depuis ici. */
  customerLabel: (customerId: string) => string;
}>;

export type OrdersListColumn = Readonly<{
  header: string;
  cell: (order: CommercialOrderDto, ctx: OrdersListCellContext) => string;
  /** Chemin (relatif au dashboard tenant, SANS le `/dashboard/` initial) vers lequel lier cette colonne — absent si la colonne n est pas cliquable. */
  linkTo?: (order: CommercialOrderDto) => string;
}>;

/**
 * Colonnes de la grille, DANS L ORDRE ARRETE par Arnaud le 2026-09-14
 * (docs/api/CONVENTIONS.md §8.24, decision 1). Source UNIQUE pour l en-tete
 * ET la cellule de chaque colonne — plus aucune liste d intitules recopiee
 * ailleurs dans le module (qa-review round 1, M1). Round 2 : `linkTo` porte
 * sur le DESCRIPTEUR de la colonne N°, jamais sur un index de boucle — une
 * permutation de colonnes ne peut plus deplacer le lien par accident (N01).
 */
export const ORDERS_LIST_COLUMNS: readonly OrdersListColumn[] = [
  { header: 'N°', cell: (order) => order.number, linkTo: (order) => `commercial-orders/${order.id}` },
  { header: 'Client', cell: (order, ctx) => ctx.customerLabel(order.customer_id) },
  { header: 'Créée le', cell: (order) => formatOrderCreatedAt(order.created_at) },
  {
    header: 'Étape de production',
    cell: (order, ctx) => resolveCurrentProductionStepLabel(order.current_production_step_id, ctx.stepsById),
  },
  { header: 'Net HT', cell: (order) => formatOrderMoney(order.totals.net_total) },
  { header: 'Total TTC', cell: (order) => formatOrderMoney(order.totals.total_incl_tax) },
];

/**
 * Construit le contexte de cellule — PUR (round 2, DURCI round 3) : avant
 * round 2, la page construisait `cellContext` inline, avec un repli
 * `customerId` brut (au lieu d un tiret) quand le client n etait pas
 * encore charge (N19). Round 3 (X27) : le CALCUL du libelle
 * (`customerDisplayName`) lui-meme etait encore fait dans la page —
 * `customersById` porte ici les FICHES BRUTES des clients deja charges,
 * jamais un libelle pre-calcule, pour que ce calcul soit dans le
 * perimetre teste de cette fonction.
 */
export function buildCellContext(
  stepsById: ReadonlyMap<string, Pick<ProductionStepDto, 'label' | 'is_active'>>,
  customersById: ReadonlyMap<string, Pick<CustomerDto, 'type' | 'company_name' | 'first_name' | 'last_name'>>,
): OrdersListCellContext {
  return {
    stepsById,
    customerLabel: (customerId) => {
      const customer = customersById.get(customerId);
      return customer ? customerDisplayName(customer) : '—';
    },
  };
}

/**
 * Decide QUELS clients restent a charger pour une page de commandes — PUR
 * et teste (round 3, mineur X07) : avant ce correctif, la page recalculait
 * ses identifiants manquants a chaque changement de `state.orders` (ex.
 * "Charger plus") et ANNULAIT le lot de la page precedente encore en vol,
 * qui repartait donc en double. `known` (clients deja en cache) et
 * `inFlight` (clients deja en cours de chargement, suivis par un `ref` cote
 * page) sont tous deux EXCLUS — un identifiant n apparait qu une fois,
 * meme si plusieurs commandes de la page partagent le meme client.
 */
export function missingCustomerIds(
  orders: readonly CommercialOrderDto[],
  known: ReadonlySet<string>,
  inFlight: ReadonlySet<string>,
): readonly string[] {
  const seen = new Set<string>();
  const missing: string[] = [];
  for (const order of orders) {
    const id = order.customer_id;
    if (seen.has(id) || known.has(id) || inFlight.has(id)) continue;
    seen.add(id);
    missing.push(id);
  }
  return missing;
}

/**
 * Le bouton "Charger plus" doit-il seulement etre VISIBLE ? (round 3,
 * mineur X25) — distinct de `planLoadMore()` (qui decide si une NOUVELLE
 * requete doit partir) : le bouton reste visible, desactive, PENDANT un
 * chargement "more" deja en cours (`status: 'loading-more'`), il disparait
 * seulement pendant le chargement INITIAL ou en l absence de page suivante.
 */
export function canLoadMore(state: OrdersListState): boolean {
  return state.status !== 'loading' && state.nextCursor !== null;
}

// ---------------------------------------------------------------------------
// Catalogue des etapes de production (M2/m3, qa-review round 1) — UN SEUL
// appel, SANS filtre de statut (§8.24 point (iii)), rendu de sorte que le
// suivi comme l ordre soient testables sans la page.
// ---------------------------------------------------------------------------

export type ProductionStepCatalog = Readonly<{
  byId: ReadonlyMap<string, ProductionStepDto>;
  /** Toutes les etapes (actives ET desactivees), triees par `position` — jamais filtrees ici. */
  ordered: readonly ProductionStepDto[];
}>;

export const EMPTY_PRODUCTION_STEP_CATALOG: ProductionStepCatalog = Object.freeze({
  byId: new Map(),
  ordered: [],
});

export type LoadProductionStepCatalogResult =
  | Readonly<{ ok: true; catalog: ProductionStepCatalog }>
  | Readonly<{ ok: false; error: string }>;

/**
 * Charge le catalogue COMPLET des etapes de production, SANS argument de
 * statut (`api.list()`, jamais `api.list({ status: 'active' })`) : filtrer
 * sur `active` ferait perdre le libelle d une etape desactivee sur laquelle
 * une commande reste posee — le contrat garde ces commandes lisibles
 * (§8.24 point (iii)). Un echec est rendu comme un RESULTAT (`ok: false`),
 * jamais une exception qui remonterait jusqu au composant.
 */
export async function loadProductionStepCatalog(
  api: Pick<ProductionStepsApiClient, 'list'>,
): Promise<LoadProductionStepCatalogResult> {
  try {
    const result = await api.list();
    const byId = new Map(result.data.map((step) => [step.id, step] as const));
    const ordered = [...result.data].sort((a, b) => a.position - b.position);
    return { ok: true, catalog: { byId, ordered } };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : 'Chargement des étapes de production impossible.',
    };
  }
}

// ---------------------------------------------------------------------------
// Etat, actions, reducteur (B1/B2 round 1 ; steps + cursor/status round 2)
// — la SEULE source de verite de la grille. Le composant ne fait plus AUCUN
// `setState` isole pour `orders`/`nextCursor`/`filters`/le catalogue
// d etapes : tout transite par ces actions (condition (b1), round 2 :
// "les etapes dans le reducteur, actions stepsLoaded/stepsFailed").
// ---------------------------------------------------------------------------

export type OrdersListStatus = 'loading' | 'loading-more' | 'idle' | 'error';

export type OrdersListState = Readonly<{
  filters: OrdersListFilters;
  /** Libelle du client selectionne (deja connu du resultat de recherche, jamais un appel supplementaire). */
  selectedCustomerLabel: string;
  /**
   * Incremente a CHAQUE changement de filtre ou de tri. Capture par
   * `loadOrdersListPage()` au moment de l appel reseau : une reponse dont la
   * generation ne correspond plus a `state.generation` au moment ou elle
   * revient est REJETEE par le reducteur (`pageLoaded`/`pageLoadFailed`).
   */
  generation: number;
  status: OrdersListStatus;
  orders: readonly CommercialOrderDto[];
  nextCursor: string | null;
  error: string | null;
  /** Round 2 (condition (b1)) : le catalogue d etapes vit ICI, plus dans un `useState` de la page. */
  stepCatalog: ProductionStepCatalog;
  stepsLoadError: string | null;
}>;

export const INITIAL_ORDERS_LIST_STATE: OrdersListState = Object.freeze({
  filters: DEFAULT_ORDERS_LIST_FILTERS,
  selectedCustomerLabel: '',
  generation: 0,
  status: 'loading',
  orders: [],
  nextCursor: null,
  error: null,
  stepCatalog: EMPTY_PRODUCTION_STEP_CATALOG,
  stepsLoadError: null,
});

export type OrdersListAction =
  | Readonly<{ type: 'filtersChanged'; patch: Partial<OrdersListFilters> }>
  | Readonly<{ type: 'customerSelected'; customerId: string; label: string }>
  | Readonly<{ type: 'customerCleared' }>
  | Readonly<{ type: 'loadMoreRequested' }>
  | Readonly<{
      type: 'pageLoaded';
      generation: number;
      mode: 'initial' | 'more';
      /** Curseur REELLEMENT utilise pour cette requete (`null` en mode initial) — round 2, V1/V2. */
      cursor: string | null;
      items: readonly CommercialOrderDto[];
      nextCursor: string | null;
    }>
  | Readonly<{
      type: 'pageLoadFailed';
      generation: number;
      mode: 'initial' | 'more';
      cursor: string | null;
      message: string;
    }>
  | Readonly<{ type: 'stepsLoaded'; catalog: ProductionStepCatalog }>
  | Readonly<{ type: 'stepsFailed'; error: string }>;

/** Remise a zero commune a tout changement de filtre/tri (qa-review B2) : nouvelle generation, liste et curseur vides, erreur effacee. */
function resetForNewQuery(state: OrdersListState): Pick<OrdersListState, 'generation' | 'status' | 'orders' | 'nextCursor' | 'error'> {
  return { generation: state.generation + 1, status: 'loading', orders: [], nextCursor: null, error: null };
}

/**
 * Un `pageLoaded`/`pageLoadFailed` de mode `'more'` n est APPLICABLE que si
 * l etat attend reellement cette reponse : encore `loading-more`, ET pour
 * le curseur qu il vient d utiliser (round 2, V1/V2 — sans ce second test,
 * un doublon de reponse, ou une reponse "more" hors contexte, corrompent la
 * liste). Un mode `'initial'` n a pas cette contrainte : seule la
 * generation compte.
 */
function isApplicableMoreResponse(state: OrdersListState, action: Readonly<{ mode: 'initial' | 'more'; cursor: string | null }>): boolean {
  if (action.mode === 'initial') return true;
  return state.status === 'loading-more' && action.cursor === state.nextCursor;
}

export function ordersListReducer(state: OrdersListState, action: OrdersListAction): OrdersListState {
  switch (action.type) {
    case 'filtersChanged':
      return { ...state, filters: { ...state.filters, ...action.patch }, ...resetForNewQuery(state) };
    case 'customerSelected':
      return {
        ...state,
        filters: { ...state.filters, customerId: action.customerId },
        selectedCustomerLabel: action.label,
        ...resetForNewQuery(state),
      };
    case 'customerCleared':
      return {
        ...state,
        filters: { ...state.filters, customerId: '' },
        selectedCustomerLabel: '',
        ...resetForNewQuery(state),
      };
    case 'loadMoreRequested':
      if (!state.nextCursor || state.status === 'loading-more') return state;
      return { ...state, status: 'loading-more', error: null };
    case 'pageLoaded': {
      // Reponse PERIMEE (une generation plus recente existe deja) : ignoree
      // sans modifier `orders` ni `nextCursor` — c est la propriete B1.
      if (action.generation !== state.generation) return state;
      // Round 2 : une reponse "more" hors contexte (deja appliquee, ou
      // alors qu aucune requete "more" n est en cours) est ignoree aussi.
      if (!isApplicableMoreResponse(state, action)) return state;
      const orders = action.mode === 'initial' ? action.items : [...state.orders, ...action.items];
      return { ...state, status: 'idle', orders, nextCursor: action.nextCursor };
    }
    case 'pageLoadFailed': {
      if (action.generation !== state.generation) return state;
      if (!isApplicableMoreResponse(state, action)) return state;
      return {
        ...state,
        status: 'error',
        error: action.message,
        ...(action.mode === 'initial' ? { orders: [], nextCursor: null } : {}),
      };
    }
    case 'stepsLoaded':
      return { ...state, stepCatalog: action.catalog, stepsLoadError: null };
    case 'stepsFailed':
      return { ...state, stepsLoadError: action.error };
    default:
      return state;
  }
}

/**
 * Orchestration reseau — SEUL point d appel de `buildInitialLoadRequest`/
 * `buildLoadMoreRequest` (qa-review round 1, M08/B1) : la requete est TOUJOURS
 * tiree de `state.filters`, jamais reconstruite ni amendee au point d appel.
 * Ne `throw` jamais : rend une action a dispatcher (`pageLoaded`/
 * `pageLoadFailed`), meme discipline que le reste du reducteur.
 */
export async function loadOrdersListPage(
  api: Pick<CommercialOrdersApiClient, 'list'>,
  state: OrdersListState,
  mode: 'initial' | 'more',
): Promise<OrdersListAction> {
  const generation = state.generation;
  const cursor = mode === 'more' ? state.nextCursor : null;
  try {
    const page =
      mode === 'initial'
        ? await api.list(buildInitialLoadRequest(state.filters, ORDERS_LIST_PAGE_SIZE))
        : await api.list(buildLoadMoreRequest(state.filters, ORDERS_LIST_PAGE_SIZE, cursor ?? ''));
    return { type: 'pageLoaded', generation, mode, cursor, items: page.items, nextCursor: page.nextCursor };
  } catch (cause) {
    return {
      type: 'pageLoadFailed',
      generation,
      mode,
      cursor,
      message: cause instanceof Error ? cause.message : 'Chargement des commandes impossible.',
    };
  }
}

/**
 * Decision PURE : faut-il seulement TENTER une requete "Charger plus" ?
 * (round 2, mineur V1/N04) — extrait pour que la garde ne depende plus
 * d un `if` ecrit dans la page (impossible a prouver sans rendre le
 * composant) : `requestMoreOrders()` ci-dessous l applique elle-meme.
 */
export function planLoadMore(state: OrdersListState): boolean {
  return state.nextCursor !== null && state.status !== 'loading-more';
}

/**
 * Combine `planLoadMore()` et `loadOrdersListPage(..., 'more')` : SEUL point
 * d appel reseau pour "Charger plus" (round 2, N04/N18). Rend `null` sans
 * jamais appeler l API si la tentative n est pas pertinente — la page n a
 * plus de logique a porter elle-meme pour eviter une requete gaspillee.
 */
export async function requestMoreOrders(
  api: Pick<CommercialOrdersApiClient, 'list'>,
  state: OrdersListState,
): Promise<OrdersListAction | null> {
  if (!planLoadMore(state)) return null;
  return loadOrdersListPage(api, state, 'more');
}

/**
 * Orchestre ENTIEREMENT le clic "Charger plus" (round 3, moyen X24) : avant
 * ce correctif, la page dispatchait `loadMoreRequested` PUIS appelait
 * `requestMoreOrders`/`dispatch` elle-meme — deux etapes ecrites a la main,
 * et un oubli de la premiere aurait laisse le bouton sans effet, EN
 * SILENCE, sans qu aucun test ne le remarque. Cette fonction est le SEUL
 * point d entree du clic : elle ne fait rien si `planLoadMore()` refuse, et
 * emet TOUJOURS `loadMoreRequested` AVANT la reponse reseau sinon.
 */
export async function loadMoreOrders(
  dispatch: (action: OrdersListAction) => void,
  api: Pick<CommercialOrdersApiClient, 'list'>,
  state: OrdersListState,
): Promise<void> {
  if (!planLoadMore(state)) return;
  dispatch({ type: 'loadMoreRequested' });
  const action = await loadOrdersListPage(api, state, 'more');
  dispatch(action);
}

/**
 * Combine `loadProductionStepCatalog()` et le choix de l action a
 * dispatcher (round 2, N10/M2/m3) : SEUL point d appel reseau pour le
 * catalogue d etapes. Avant ce correctif, ce choix (dispatcher `stepsLoaded`
 * ou `stepsFailed`) etait ecrit dans la page, donc non testable — un echec
 * pouvait y etre avale (mutation N10) sans qu aucun test ne le remarque.
 */
export async function loadOrdersListStepsAction(
  api: Pick<ProductionStepsApiClient, 'list'>,
): Promise<OrdersListAction> {
  const result = await loadProductionStepCatalog(api);
  return result.ok ? { type: 'stepsLoaded', catalog: result.catalog } : { type: 'stepsFailed', error: result.error };
}

// ---------------------------------------------------------------------------
// Filtres — descripteurs UNIQUES (condition (b1), round 2 ; DURCI round 3 :
// le filtre CLIENT entre dans le MEME tableau, `label`/`align` deplaces sur
// le descripteur). Chaque filtre porte sa propre lecture d etat, son
// options (le cas echeant) et sa traduction en action.
// `handleOrdersListFilterChange()` est le SEUL point qui dispatche une
// action pour N IMPORTE LEQUEL de ces filtres, identifie par `id` — jamais
// un `onChange`/`onSelect`/`onClear` distinct par filtre ecrit a la main
// dans le JSX.
// ---------------------------------------------------------------------------

export type OrdersListFilterKind = 'date' | 'select' | 'customer-search';

export type OrdersListFilterOption = Readonly<{ value: string; label: string }>;

export type OrdersListFilterOptionsContext = Readonly<{ stepCatalog: ProductionStepCatalog }>;

/** Selection portee par un filtre `kind: 'customer-search'` — `null` efface le filtre. */
export type OrdersListCustomerSelection = Readonly<{ customerId: string; label: string }> | null;

/**
 * Valeur transmise a `toAction()` : une chaine pour `date`/`select`, une
 * selection (ou `null`) pour `customer-search`. Le type reel depend du
 * `kind` du descripteur, verifie par construction (chaque descripteur ne
 * lit que la forme qu il attend), pas par une discrimination au point
 * d appel.
 */
export type OrdersListFilterValue = string | OrdersListCustomerSelection;

export type OrdersListFilterDescriptor = Readonly<{
  id: 'createdFrom' | 'createdTo' | 'productionStepId' | 'sort' | 'customerId';
  testId: string;
  kind: OrdersListFilterKind;
  /** Libelle visuel place devant le champ (round 3, X08) — absent pour un `<select>`/le widget client, qui n en ont pas besoin. */
  label?: string;
  /** Alignement dans la barre de filtres (round 3) — absent = flux normal ; `'end'` = pousse a droite (`margin-left: auto`). */
  align?: 'end';
  /** Valeur actuelle a afficher — LUE depuis l etat, jamais recalculee ailleurs. */
  read: (state: OrdersListState) => string;
  /** Options d un filtre `kind: 'select'` — pure, calculee depuis le contexte (catalogue d etapes, options de tri fixes). */
  options?: (ctx: OrdersListFilterOptionsContext) => readonly OrdersListFilterOption[];
  /** Traduit une valeur choisie a l ecran en action du reducteur. */
  toAction: (value: OrdersListFilterValue) => OrdersListAction;
}>;

export const ORDERS_LIST_FILTERS: readonly OrdersListFilterDescriptor[] = [
  {
    id: 'createdFrom',
    testId: T.listCreatedFromInput,
    kind: 'date',
    label: 'Du',
    read: (state) => state.filters.createdFrom,
    toAction: (value) => ({ type: 'filtersChanged', patch: { createdFrom: value as string } }),
  },
  {
    id: 'createdTo',
    testId: T.listCreatedToInput,
    kind: 'date',
    label: 'Au',
    read: (state) => state.filters.createdTo,
    toAction: (value) => ({ type: 'filtersChanged', patch: { createdTo: value as string } }),
  },
  {
    id: 'customerId',
    testId: T.listCustomerFilter,
    kind: 'customer-search',
    read: (state) => state.filters.customerId,
    toAction: (value) => {
      const selection = value as OrdersListCustomerSelection;
      return selection ? customerFilterSelected(selection.customerId, selection.label) : customerFilterCleared();
    },
  },
  {
    id: 'productionStepId',
    testId: T.listStepFilter,
    kind: 'select',
    read: (state) => state.filters.productionStepId,
    options: (ctx) => [
      { value: '', label: 'Toutes les étapes' },
      ...ctx.stepCatalog.ordered.map((step) => ({ value: step.id, label: formatProductionStepLabel(step) })),
    ],
    toAction: (value) => ({ type: 'filtersChanged', patch: { productionStepId: value as string } }),
  },
  {
    id: 'sort',
    testId: T.listSortSelect,
    kind: 'select',
    align: 'end',
    read: (state) => state.filters.sort,
    options: () => ORDERS_LIST_SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    toAction: (value) => ({ type: 'filtersChanged', patch: { sort: value as CommercialOrderSort } }),
  },
];

/**
 * SEUL point qui traduit "le filtre identifie par `filterId` a reçu
 * `value`" en `dispatch()` — pour N IMPORTE LEQUEL des filtres de
 * `ORDERS_LIST_FILTERS`, CLIENT COMPRIS (round 3 : plus d exception, plus
 * de `dispatch(customerFilterSelected(...))` ecrit a la main dans la page).
 * Round 2 : remplace un `onChange` distinct par filtre ecrit a la main
 * dans le JSX (mutations R08b/R32/N16 : valeur envoyee au mauvais filtre,
 * ou filtre qui ne dispatche rien).
 */
export function handleOrdersListFilterChange(
  dispatch: (action: OrdersListAction) => void,
  filters: readonly OrdersListFilterDescriptor[],
  filterId: string,
  value: OrdersListFilterValue,
): void {
  const descriptor = filters.find((filter) => filter.id === filterId);
  if (!descriptor) return;
  dispatch(descriptor.toAction(value));
}

/**
 * Actions du filtre CLIENT — fonctions pures et testees, SEUL point de
 * construction de `customerSelected`/`customerCleared`, utilisees par le
 * descripteur `customerId` ci-dessus (round 2, N14 : avant ce correctif,
 * l objet d action etait construit en ligne dans la page, qui pouvait
 * perdre le libelle sans qu aucun test ne le remarque).
 */
export function customerFilterSelected(customerId: string, label: string): OrdersListAction {
  return { type: 'customerSelected', customerId, label };
}

export function customerFilterCleared(): OrdersListAction {
  return { type: 'customerCleared' };
}
