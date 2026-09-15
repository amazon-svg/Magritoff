/**
 * DashboardCommercialOrders — grille des commandes de gestion commerciale
 * (E10.18a, "la periode, a la grille d abord" ; REFONDUE en E10.18e-1,
 * docs/api/CONVENTIONS.md §8.24, levee de la condition posee sur la grille
 * d origine — revue tenue avec Arnaud le 2026-09-14 ; DURCIE en qa-review
 * round 1, round 2 puis round 3, 2026-09-14).
 *
 * Colonnes, DANS L ORDRE ARRETE par Arnaud : N°, Client, Creee le, Etape de
 * production, Net HT (`totals.net_total`), Total TTC
 * (`totals.total_incl_tax`) — voir `ORDERS_LIST_COLUMNS`
 * (`orders-list.helpers.ts`), descripteurs UNIQUES consommes ici pour les
 * en-tetes ET les cellules (la colonne N° porte sa propre proprie `linkTo`,
 * round 2 — plus d index magique `i === 0` dans ce fichier). Montants
 * rendus TELS QUE LE SERVEUR LES SERT, AUCUNE conversion en `number` ni
 * calcul ici (E10.8 gelee, PricingEngine E10.21 non appele).
 *
 * ── COQUILLE GENERIQUE (condition (b1) de l architecte, §8.24 e-1 point 10,
 * durcie en qa-review round 2 PUIS round 3) ──────────────────────────────
 * Ce depot n a AUCUN outil de rendu React. Ce composant ne porte AUCUNE
 * decision : l etat et ses transitions vivent dans `ordersListReducer`
 * (`orders-list.helpers.ts`) ; le SEUL appel reseau de chargement passe par
 * `loadOrdersListPage()`/`loadMoreOrders()`/`loadOrdersListStepsAction()`,
 * qui rendent une action a `dispatch()` — jamais un `setState` isole. Les
 * FILTRES — periode, ETAPE, TRI **ET CLIENT** (round 3 : le filtre client
 * n est plus une exception a part, voir plus bas) — sont des DESCRIPTEURS
 * (`ORDERS_LIST_FILTERS`) parcourus par UNE SEULE boucle generique,
 * dispatchee par `handleOrdersListFilterChange()`. Chaque descripteur porte
 * son propre libelle (`label`) et son propre alignement (`align`) — round 3,
 * en reponse a la qa-review (X08 : le libelle "Du"/"Au" vivait dans une
 * table indexee par `id` DANS CE FICHIER ; l alignement du tri vivait dans
 * une comparaison `filter.id === 'sort'` DANS CE FICHIER — les deux etaient
 * donc, comme les anciens `onChange`, des points ecrits pour un filtre
 * PRECIS plutot que portes par le descripteur lui-meme).
 *
 * ── Le filtre CLIENT, round 3 ─────────────────────────────────────────────
 * `CustomerFilterSelect` reste un widget a part (recherche serveur, pas un
 * `<input>`/`<select>` natif) — mais son DESCRIPTEUR (`kind:
 * 'customer-search'`) vit dans `ORDERS_LIST_FILTERS`, au meme titre que les
 * autres, et son `onSelect`/`onClear` appellent la MEME fonction generique
 * que tous les autres filtres (`handleOrdersListFilterChange`), avec une
 * valeur `{ customerId, label } | null` plutot qu une chaine. Le point qui
 * reste NON PROUVE par un test — parce qu il n existe aucun outil de rendu
 * React dans ce depot — est desormais EXACTEMENT le meme, structurellement,
 * pour TOUS les filtres : est-ce que la boucle appelle bien
 * `handleOrdersListFilterChange` au bon `onChange`/`onSelect`/`onClear`, et
 * le clic sur une option du menu du selecteur (evenement `cmdk`). Ce n est
 * plus une exception du filtre client : c est la meme limite que la boucle
 * de colonnes.
 *
 * Ce que ce fichier fait ENCORE seul et qui reste NON PROUVE par un test —
 * verifie par la recette navigateur du coordinateur, jamais affirme comme
 * teste : la boucle de rendu des colonnes ET des filtres (est-ce qu elle
 * lit bien les descripteurs plutot que de les recopier), la liaison
 * generique du selecteur client (le clic sur une option), `maxLength` du
 * champ de recherche, les dependances des effets, le bandeau d erreur des
 * etapes, la destruction du controleur de recherche au demontage.
 *
 * ── Course entre requetes (B1 round 1 ; V1/V2 round 2) ───────────────────
 * `state.generation` est incremente a CHAQUE changement de filtre/tri.
 * `loadOrdersListPage()` capture la generation ET le curseur utilise AVANT
 * l appel reseau ; le reducteur rejette toute reponse dont la generation ne
 * correspond plus a l etat courant, et, pour une reponse "Charger plus",
 * exige en plus que l etat soit encore `loading-more` et que le curseur de
 * la reponse corresponde au curseur courant (round 2).
 *
 * ── "Charger plus", round 3 (moyen X24) ──────────────────────────────────
 * `loadMoreOrders(dispatch, api, state)` est le SEUL point d entree du clic
 * — avant ce correctif, la page dispatchait `loadMoreRequested` PUIS
 * appelait le reseau elle-meme, deux etapes ecrites a la main dont l oubli
 * de la premiere aurait rendu le bouton silencieusement inoperant. La
 * VISIBILITE du bouton est decidee par `canLoadMore(state)` (round 3,
 * mineur X25), distincte de la decision de RELANCER une requete
 * (`planLoadMore`, interne a `loadMoreOrders`).
 *
 * ── Etapes de production dans le reducteur (round 2, condition (b1)) ─────
 * UN SEUL appel a `loadOrdersListStepsAction()`, dispatchee sur
 * `stepsLoaded`/`stepsFailed`. Un echec est signale par un bandeau DISTINCT
 * du tiret "sans etape" — jamais confondu avec "aucune commande n a
 * d etape".
 *
 * DECOUVRABLE DEPUIS LA SIDEBAR ("Commandes atelier", `surface-
 * contributions.ts`) depuis E10.18e-1.
 *
 * AUCUN CONTROLE METIER ICI : les filtres ne sont qu une mise en forme de
 * requete (`buildOrdersListQuery`) — la validation du format, l ordre des
 * bornes de periode et la conversion de fuseau sont FAITS PAR LE SERVEUR
 * (`src/server/api/commercial-orders-routes.ts`, `src/kernel/clock`). Une
 * reponse 400/422 est affichee telle quelle, jamais devinee cote client.
 *
 * ── D5, heritee et REELLEMENT NON AGGRAVEE (round 3) ─────────────────────
 * La resolution des clients d une page (`GET /customers/{id}`, patron deja
 * present dans `QuotesPage.tsx`) part de `missingCustomerIds()`
 * (`orders-list.helpers.ts`, pure et testee), qui exclut les clients DEJA
 * CONNUS et ceux DEJA EN VOL (`inFlightCustomerIds`, un `ref`). Round 2
 * affirmait "D5 non aggravee" en ne relancant plus la resolution pour une
 * page REJETEE — vrai, mais round 2 continuait d ANNULER (donc de jeter) le
 * lot de la page precedente des que `state.orders` changeait a nouveau
 * (ex. "Charger plus" resout avant les fiches clients de la page 1), ce qui
 * relancait ces memes appels en double. Round 3 corrige la aussi : l effet
 * ne porte plus de fonction de nettoyage qui annule un lot en vol — un
 * client reste valide quel que soit ce qui a change entre-temps ; seul un
 * DEMONTAGE reel du composant (`isMountedRef`) empeche une mise a jour
 * tardive.
 */
import { useEffect, useReducer, useRef, useState } from 'react';
import { Link } from 'react-router';
import { PackageSearch } from 'lucide-react';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CustomersApiClient, type CustomerDto } from '@/modules/customers';
import { ProductionStepsApiClient } from '@/modules/production-steps';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { CommercialOrdersApiClient } from '../../api/client';
import { CustomerFilterSelect } from '../components/CustomerFilterSelect';
import { buildCustomerSearch } from '../components/customer-filter-select.helpers';
import { OrderExportPanel } from '../components/OrderExportPanel';
import {
  buildCellContext,
  canLoadMore,
  handleOrdersListFilterChange,
  hasActiveOrdersListFilters,
  INITIAL_ORDERS_LIST_STATE,
  loadMoreOrders,
  loadOrdersListPage,
  loadOrdersListStepsAction,
  missingCustomerIds,
  ORDERS_LIST_COLUMNS,
  ORDERS_LIST_FILTERS,
  ordersListReducer,
  type OrdersListFilterOptionsContext,
} from './orders-list.helpers';

const T = TEST_IDS.commercialOrder;

export function DashboardCommercialOrders() {
  const tp = useTenantPath();
  const ordersApi = useWorkspaceApi(CommercialOrdersApiClient);
  const customersApi = useWorkspaceApi(CustomersApiClient);
  const productionStepsApi = useWorkspaceApi(ProductionStepsApiClient);

  const [state, dispatch] = useReducer(ordersListReducer, INITIAL_ORDERS_LIST_STATE);
  const [customersById, setCustomersById] = useState<Readonly<Record<string, CustomerDto>>>({});
  const inFlightCustomerIds = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Un seul appel, une seule fois : `loadOrdersListStepsAction()` (§8.24
  // point (iii)) — cette collection n est jamais paginee (plafond de 50
  // etapes par tenant). Le catalogue et un echec eventuel vivent dans le
  // reducteur (round 2, condition (b1)).
  useEffect(() => {
    let cancelled = false;
    void loadOrdersListStepsAction(productionStepsApi).then((action) => {
      if (!cancelled) dispatch(action);
    });
    return () => {
      cancelled = true;
    };
  }, [productionStepsApi]);

  // Resolution des clients — DEPUIS `state.orders` et `missingCustomerIds()`
  // (round 3, mineur) : AUCUNE fonction de nettoyage n annule un lot en vol
  // — un client reste valide quel que soit le changement de `state.orders`
  // survenu entre-temps. `inFlightCustomerIds` (un `ref`, partage entre
  // executions successives de cet effet) empeche deux executions qui se
  // chevauchent de redemander le meme client.
  useEffect(() => {
    const known = new Set(Object.keys(customersById));
    const missing = missingCustomerIds(state.orders, known, inFlightCustomerIds.current);
    if (missing.length === 0) return;
    for (const id of missing) inFlightCustomerIds.current.add(id);
    void Promise.all(
      missing.map(async (id) => {
        try {
          return [id, await customersApi.getDetail(id)] as const;
        } catch {
          return null;
        } finally {
          inFlightCustomerIds.current.delete(id);
        }
      }),
    ).then((fetched) => {
      if (!isMountedRef.current) return;
      setCustomersById((current) => {
        const next = { ...current };
        for (const entry of fetched) {
          if (entry) next[entry[0]] = entry[1];
        }
        return next;
      });
    });
    // customersById volontairement absent des deps : sa propre mise a jour
    // ne doit pas redeclencher cet effet (meme motif qu avant ce lot).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.orders, customersApi]);

  // Chargement de PREMIERE page — declenche a chaque nouvelle GENERATION
  // (periode, client, etape OU tri changes, cf. `ordersListReducer`).
  // `loadOrdersListPage()` est le SEUL point d appel reseau de ce cycle ; sa
  // reponse est simplement dispatchee, jamais interpretee ici (B1/M08).
  useEffect(() => {
    let cancelled = false;
    void loadOrdersListPage(ordersApi, state, 'initial').then((action) => {
      if (!cancelled) dispatch(action);
    });
    return () => {
      cancelled = true;
    };
    // Seule `state.generation` pilote ce cycle : elle change EXACTEMENT
    // quand `state.filters` change (meme transition de reducteur), donc
    // `state` lu ici est toujours celui de la generation en cours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersApi, state.generation]);

  const loadMore = () => {
    void loadMoreOrders(dispatch, ordersApi, state);
  };

  const searchCustomers = buildCustomerSearch(customersApi);
  const customersByIdMap = new Map(Object.entries(customersById));
  const cellContext = buildCellContext(state.stepCatalog.byId, customersByIdMap);
  const filterOptionsContext: OrdersListFilterOptionsContext = { stepCatalog: state.stepCatalog };

  return (
    <div data-testid={T.listPage} className="max-w-[1400px]" style={{ fontFamily: 'var(--font-ui)' }}>
      <div className="mb-6">
        <h1
          className="text-ink m-0"
          style={{ fontWeight: 300, fontSize: '34px', letterSpacing: '-0.025em', lineHeight: 1.05 }}
        >
          Commandes atelier
        </h1>
        <p className="mt-2 mb-0 text-ink-muted" style={{ fontSize: '13.5px' }}>
          {state.orders.length} commande{state.orders.length > 1 ? 's' : ''} de gestion commerciale.
        </p>
      </div>

      {state.stepsLoadError && (
        <p data-testid={T.listStepsLoadErrorBanner} className="text-sm text-err-fg mb-3">
          Chargement des étapes de production impossible — les libellés d'étape peuvent être incomplets.
        </p>
      )}

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {ORDERS_LIST_FILTERS.map((filter) => {
          const value = filter.read(state);
          const alignClassName = filter.align === 'end' ? 'ml-auto' : '';

          if (filter.kind === 'date') {
            return (
              <label key={filter.id} className={`flex items-center gap-1.5 text-ink-muted ${alignClassName}`} style={{ fontSize: '12.5px' }}>
                {filter.label}
                <input
                  type="date"
                  data-testid={filter.testId}
                  value={value}
                  onChange={(e) => handleOrdersListFilterChange(dispatch, ORDERS_LIST_FILTERS, filter.id, e.target.value)}
                  className="px-2 py-1 rounded-md border border-line bg-paper text-ink"
                  style={{ fontSize: '12.5px' }}
                />
              </label>
            );
          }

          if (filter.kind === 'customer-search') {
            return (
              <CustomerFilterSelect
                key={filter.id}
                testId={filter.testId}
                optionTestId={T.listCustomerFilterOption}
                value={value}
                selectedLabel={state.selectedCustomerLabel}
                search={searchCustomers}
                onSelect={(customerId, label) =>
                  handleOrdersListFilterChange(dispatch, ORDERS_LIST_FILTERS, filter.id, { customerId, label })
                }
                onClear={() => handleOrdersListFilterChange(dispatch, ORDERS_LIST_FILTERS, filter.id, null)}
              />
            );
          }

          const options = filter.options ? filter.options(filterOptionsContext) : [];
          return (
            <select
              key={filter.id}
              data-testid={filter.testId}
              value={value}
              onChange={(e) => handleOrdersListFilterChange(dispatch, ORDERS_LIST_FILTERS, filter.id, e.target.value)}
              className={`px-2 py-1 rounded-md border border-line bg-paper text-ink ${alignClassName}`}
              style={{ fontSize: '12.5px' }}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );
        })}
      </div>

      {state.error && (
        <p data-testid={T.listErrorBanner} className="text-sm text-err-fg mb-3">
          {state.error}
        </p>
      )}

      <div className="border border-line rounded-md overflow-hidden bg-paper">
        {state.status === 'loading' ? (
          <div className="py-12 text-center text-ink-muted" style={{ fontSize: '13px' }}>Chargement…</div>
        ) : state.orders.length === 0 ? (
          <div className="py-16 text-center text-ink-mute-2">
            <PackageSearch className="w-10 h-10 mx-auto mb-3 opacity-40" strokeWidth={1.5} />
            <p style={{ fontSize: '13.5px', fontWeight: 400 }}>
              {hasActiveOrdersListFilters(state.filters) ? 'Aucune commande pour ces filtres.' : "Aucune commande pour l'instant."}
            </p>
          </div>
        ) : (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-line bg-bg">
                {ORDERS_LIST_COLUMNS.map((col, i) => (
                  <th
                    key={i}
                    className="text-left px-4 py-2 font-mono uppercase text-ink-muted"
                    style={{ fontSize: '10.5px', fontWeight: 500, letterSpacing: '0.06em' }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.orders.map((o) => (
                <tr
                  key={o.id}
                  data-testid={T.listRow}
                  data-order-id={o.id}
                  className="border-b border-line hover:bg-bg transition-colors"
                >
                  {ORDERS_LIST_COLUMNS.map((col, i) => {
                    const content = col.cell(o, cellContext);
                    return (
                      <td key={i} className="px-4 py-2 text-ink-2" style={{ fontSize: '12.5px' }}>
                        {col.linkTo ? (
                          <Link
                            to={tp(`/dashboard/${col.linkTo(o)}`)}
                            className="hover:underline font-mono text-ink"
                            style={{ fontWeight: 500 }}
                          >
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canLoadMore(state) && (
        <div className="mt-3 flex justify-center">
          <button
            data-testid={T.listLoadMoreBtn}
            onClick={loadMore}
            disabled={state.status === 'loading-more'}
            className="px-4 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg disabled:opacity-50"
            style={{ fontSize: '12.5px', fontWeight: 500 }}
          >
            {state.status === 'loading-more' ? 'Chargement…' : 'Charger plus'}
          </button>
        </div>
      )}

      {/* E10.18e-2 — bouton d export, modale et registre. Domicile UNIQUE
          de la fonctionnalite (docs/api/CONVENTIONS.md §8.24, consigne
          E10.18e-2) : `OrderExportPanel` recoit les filtres ACTIFS de
          CETTE grille (meme etat que `state.filters`/`selectedCustomerLabel`/
          `state.stepCatalog`), jamais une copie amendee — c est ce qui rend
          "exactement les filtres de la grille" possible (voir
          `buildOrderExportFilters`, `order-export.helpers.ts`). Se rend
          seul (`null`) si l acteur n a pas `can_export_orders`. */}
      <OrderExportPanel filters={state.filters} selectedCustomerLabel={state.selectedCustomerLabel} stepCatalog={state.stepCatalog} />
    </div>
  );
}
