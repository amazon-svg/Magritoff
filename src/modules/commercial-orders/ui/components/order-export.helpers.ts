/**
 * Logique PURE (hors rendu) de l export comptable des commandes (E10.18e-2,
 * docs/api/CONVENTIONS.md §8.24, bloc « E10.18e — perimetre arrete le
 * 2026-09-14 », consigne E10.18e-2 points 1 a 11) — MEME DISCIPLINE que
 * `orders-list.helpers.ts` (E10.18e-1, condition (b1) de l architecte) :
 * ce depot n a AUCUN outil de rendu React, donc chaque decision (quels
 * filtres envoyer, quand desactiver le bouton, quand interroger le serveur,
 * quel texte afficher pour un statut) vit ICI, pure et testee. `OrderExport-
 * Dialog.tsx`/`OrderExportPanel.tsx` ne font que PARCOURIR ces descripteurs
 * et appeler ces fonctions — condition (b1)/(11) de la consigne.
 *
 * ── Parite des filtres (point 3) ─────────────────────────────────────────
 * `buildOrderExportFilters()` NE RECALCULE RIEN : elle appelle
 * `buildOrdersListQuery()` (`orders-list.helpers.ts`), EXACTEMENT LA MEME
 * FONCTION QUE LA GRILLE, et ne fait que renommer les quatre axes partages
 * en snake_case pour le contrat (`OrderExportFiltersDto`). `sort` n est
 * jamais lu depuis le resultat de `buildOrdersListQuery()` — structurellement,
 * il ne peut donc jamais fuiter dans les filtres d export (point (ii) du
 * cadrage : « le tri n est PAS repris »).
 *
 * ── Idempotence (point 4) ─────────────────────────────────────────────────
 * `orderExportDialogReducer` est un reducteur PUR : la cle est fournie par
 * l ACTION (`opened`/`submitSucceeded`), jamais generee a l interieur du
 * reducteur — c est `generateOrderExportIdempotencyKey()` (impure, un simple
 * `crypto.randomUUID()`) qui la produit, au point d appel (composant), de la
 * meme facon que le reste du depot isole son alea. Cycle : creee a
 * l ouverture, INCHANGEE a un echec (donc REJOUEE si l utilisateur reessaie),
 * RENOUVELEE seulement apres un succes.
 *
 * ── Double-clic (point 1) ─────────────────────────────────────────────────
 * `createOrderExportSubmitController()` garde un booleen `inFlight` DANS SA
 * FERMETURE, verifie et pose de facon SYNCHRONE avant le premier `await` —
 * contrairement a un simple `if (state.status === 'submitting')` qui ne
 * verrait rien si les deux appels partent avant le premier rendu React. Deux
 * appels synchrones (le double-clic) ne declenchent donc qu UN SEUL appel
 * reseau, verifiable sans rendre de composant (voir le test dedie).
 *
 * ── Suivi (point 5) ───────────────────────────────────────────────────────
 * `startOrderExportPolling()` interroge toutes les `ORDER_EXPORT_POLL_
 * INTERVAL_MS` (2 s, cadence du contrat), espace au dela d une minute
 * (`ORDER_EXPORT_POLL_BACKOFF_INTERVAL_MS`), s arrete d elle-meme sur un
 * etat TERMINAL (`isOrderExportTerminalStatus`) et sur `stop()` — meme style
 * que `createDebouncedSearch()` (`customer-filter-select.helpers.ts`) :
 * timers GLOBAUX, testables avec `vi.useFakeTimers()`, sans injection de
 * clock qui alourdirait chaque appelant pour un depot qui ne le fait nulle
 * part ailleurs.
 *
 * ── Messages d echec (point 8) ────────────────────────────────────────────
 * `resolveOrderExportFailureMessage()` est le SEUL endroit qui traduit
 * `order_export.row_limit_exceeded` en texte ecran, et il ne porte AUCUN
 * CHIFFRE (cadrage §8.24 point 8, alinea 8 : le plafond change sans
 * prevenir l ecran — 2 500 aujourd hui, 5 000 vise). Toute AUTRE erreur
 * (comprise `order_export.pending_limit_reached`, dont le « trois » vient
 * du serveur via `detail`) s affiche TELLE QUELLE : ce fichier ne la
 * reecrit pas, `ApiClientError.message` (deja egal a `problem.detail ??
 * problem.title`) suffit — voir `OrderExportDialog.tsx`.
 */
import { ApiClientError } from '@/platform/api';
import type {
  OrderExportDto,
  OrderExportFiltersDto,
  OrderExportFormat,
  OrderExportGranularity,
  OrderExportStatus,
  OrderExportsApiClient,
} from '@/modules/order-exports';
import {
  buildOrdersListQuery,
  formatProductionStepLabel,
  type OrdersListFilters,
  type ProductionStepCatalog,
} from '../workspace/orders-list.helpers.ts';

/**
 * MOYEN V02, qa-review round 1 (2026-09-15) — SOURCE UNIQUE du droit metier
 * (contrat, `x-magrit-capabilities` : `can_export_orders`). Avant ce
 * correctif, cette chaine etait un `const` LOCAL a `OrderExportPanel.tsx`,
 * jamais teste : une faute de frappe (`can_export_order`, sans le `s`) y
 * aurait masque le bouton/panneau a TOUS les administrateurs, en silence,
 * avec toutes les gates vertes. Exportee et fixee par un test dedie.
 */
export const CAN_EXPORT_ORDERS = 'can_export_orders';

// ---------------------------------------------------------------------------
// 0bis. Messages d echec — panne RESEAU vs echec HTTP DEJA REPONDU (DEFAUT R3)
// ---------------------------------------------------------------------------

/**
 * DEFAUT R3, recette navigateur (2026-09-15) — une panne reseau (mise hors
 * ligne pendant l envoi, coupure du suivi) s affichait en ANGLAIS BRUT :
 * `FetchApiClient.send()` (`src/platform/api/fetch-api-client.ts`) ne
 * capture JAMAIS le rejet de `fetch()` lui-meme — seul un echec HTTP DEJA
 * REPONDU devient une `ApiClientError`. La norme Fetch garantit uniquement
 * le TYPE de ce rejet (`TypeError`), jamais son texte : « Failed to fetch »
 * sous Chromium, « NetworkError when attempting to fetch resource. » sous
 * Firefox, « Load failed » sous Safari — trois textes, tous en anglais,
 * aucun ecrit pour un utilisateur.
 *
 * SEUL endroit qui tranche entre les deux cas :
 * - `ApiClientError` — message DEJA francais, POSE PAR LE SERVEUR
 *   (`problem.detail ?? problem.title`) : rendu TEL QUEL, INCHANGE ;
 * - `TypeError` (panne reseau, quel que soit son texte exact) — remplace
 *   par `networkMessage`, fourni par l appelant (le texte differe entre la
 *   modale et le registre, voir `OrderExportDialog.tsx`/`OrderExportPanel.tsx`) ;
 * - tout le reste (une autre exception `Error`, deja rare sur ce chemin) —
 *   comportement INCHANGE, `cause.message` tel quel (ex. un message de
 *   test) ; une valeur qui n est meme pas une `Error` recoit
 *   `genericMessage`.
 */
export function resolveOrderExportUnreachableMessage(
  cause: unknown,
  options: Readonly<{ genericMessage: string; networkMessage: string }>,
): string {
  if (cause instanceof ApiClientError) return cause.message;
  if (cause instanceof TypeError) return options.networkMessage;
  return cause instanceof Error ? cause.message : options.genericMessage;
}

/**
 * DEFAUT R3, qa-review round 4 (2026-09-15) — DEUX AUTRES points, signales
 * par la qa-review, affichaient encore `cause.message` TEL QUEL dans
 * `OrderExportPanel.tsx` : l echec de CHARGEMENT initial du registre
 * (`useEffect` de montage) et l echec de RAFRAICHISSEMENT de l URL au clic
 * sur « Telecharger » (`handleDownloadClick`). Ni l un ni l autre ne vit
 * dans du JSX — mais le composant qui les porte n est TESTABLE PAR AUCUN
 * OUTIL DE RENDU (constat deja fait plusieurs fois dans ce fichier) :
 * extraites ICI, en fonctions pures NOMMEES et EXPORTEES, exactement pour la
 * meme raison que `resolveOrderExportFailureMessage`/`resolveOrderExport
 * PollingTimeoutMessage` plus bas — le composant ne fait plus qu APPELER,
 * jamais DECIDER. `tests/architecture/order-export-panel-network-
 * messages.test.ts` verifie, par lecture du SOURCE de `OrderExportPanel.
 * tsx`, que ces deux fonctions sont bien celles APPELEES (et que le motif
 * BRUT `cause instanceof Error ? cause.message` a disparu du fichier) —
 * seule preuve possible sans outil de rendu.
 */
export function resolveOrderExportListLoadErrorMessage(cause: unknown): string {
  return resolveOrderExportUnreachableMessage(cause, {
    genericMessage: 'Chargement des exports impossible.',
    networkMessage: 'Connexion impossible. Vérifiez votre réseau, puis réessayez.',
  });
}

export function resolveOrderExportDownloadRefreshErrorMessage(cause: unknown): string {
  return resolveOrderExportUnreachableMessage(cause, {
    genericMessage: 'Rafraîchissement du lien impossible.',
    networkMessage: 'Connexion impossible. Vérifiez votre réseau, puis réessayez.',
  });
}

// ---------------------------------------------------------------------------
// 1. Parite des filtres — point 3 de la consigne
// ---------------------------------------------------------------------------

/** Les quatre seuls axes que la grille ET l export partagent (point (i) : ni `quote_id` ni `status`, la grille ne les montre pas). */
export type OrderExportRequestFilters = Pick<
  OrderExportFiltersDto,
  'customer_id' | 'current_production_step_id' | 'created_from' | 'created_to'
>;

/**
 * Tire les filtres d export EXACTEMENT du meme etat et de la meme fonction
 * que la requete de grille (`buildOrdersListQuery`, `orders-list.helpers.ts`)
 * — c est cela, et non une simple ressemblance de code, qui rend « exactement
 * les filtres de la grille » VRAI par construction plutot qu affirme. Une
 * valeur absente de la grille (chaine vide) reste ABSENTE ici (jamais `null`
 * ni chaine vide envoyee) — meme discipline que `buildOrdersListQuery`.
 */
export function buildOrderExportFilters(filters: OrdersListFilters): OrderExportRequestFilters {
  const gridQuery = buildOrdersListQuery(filters);
  const result: { -readonly [K in keyof OrderExportRequestFilters]?: string } = {};
  if (gridQuery.customerId) result.customer_id = gridQuery.customerId;
  if (gridQuery.currentProductionStepId) result.current_production_step_id = gridQuery.currentProductionStepId;
  if (gridQuery.createdFrom) result.created_from = gridQuery.createdFrom;
  if (gridQuery.createdTo) result.created_to = gridQuery.createdTo;
  return result;
}

export type OrderExportFilterSummaryItem = Readonly<{ label: string; value: string }>;

/**
 * Resume LISIBLE des filtres repris, affiche dans la modale (point 3 :
 * « la modale affiche les filtres repris »). AUCUN filtre actif -> liste
 * vide, l appelant affiche alors « tout l historique de l espace » (contrat :
 * « Un export sans created_from ni created_to couvre tout l historique »).
 */
export function buildOrderExportFilterSummary(
  filters: OrdersListFilters,
  selectedCustomerLabel: string,
  stepCatalog: ProductionStepCatalog,
): readonly OrderExportFilterSummaryItem[] {
  const items: OrderExportFilterSummaryItem[] = [];
  if (filters.createdFrom || filters.createdTo) {
    items.push({ label: 'Période', value: `${filters.createdFrom || '…'} → ${filters.createdTo || '…'}` });
  }
  if (filters.customerId) {
    items.push({ label: 'Client', value: selectedCustomerLabel || filters.customerId });
  }
  if (filters.productionStepId) {
    const step = stepCatalog.byId.get(filters.productionStepId);
    items.push({
      label: 'Étape',
      value: step ? formatProductionStepLabel(step) : filters.productionStepId,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// 2. Format / granularite — descripteurs pour la boucle generique (point 11)
// ---------------------------------------------------------------------------

export const DEFAULT_ORDER_EXPORT_FORMAT: OrderExportFormat = 'xlsx';
export const DEFAULT_ORDER_EXPORT_GRANULARITY: OrderExportGranularity = 'order';

export const ORDER_EXPORT_FORMAT_OPTIONS: ReadonlyArray<{ value: OrderExportFormat; label: string }> = [
  { value: 'xlsx', label: 'Excel (XLSX)' },
  { value: 'csv', label: 'CSV' },
];

export const ORDER_EXPORT_GRANULARITY_OPTIONS: ReadonlyArray<{ value: OrderExportGranularity; label: string }> = [
  { value: 'order', label: 'Une ligne par commande' },
  { value: 'line', label: 'Une ligne par ligne de commande' },
];

// ---------------------------------------------------------------------------
// 3. Modale — etat, actions, reducteur PUR (point 4 et point 11)
// ---------------------------------------------------------------------------

export type OrderExportDialogStatus = 'idle' | 'submitting' | 'error';

export type OrderExportDialogState = Readonly<{
  open: boolean;
  format: OrderExportFormat;
  granularity: OrderExportGranularity;
  /** Cycle de vie decrit en tete de fichier — jamais generee ICI, toujours fournie par l action. */
  idempotencyKey: string;
  status: OrderExportDialogStatus;
  error: string | null;
}>;

export const CLOSED_ORDER_EXPORT_DIALOG_STATE: OrderExportDialogState = Object.freeze({
  open: false,
  format: DEFAULT_ORDER_EXPORT_FORMAT,
  granularity: DEFAULT_ORDER_EXPORT_GRANULARITY,
  idempotencyKey: '',
  status: 'idle',
  error: null,
});

export type OrderExportDialogAction =
  | Readonly<{ type: 'opened'; idempotencyKey: string }>
  | Readonly<{ type: 'closed' }>
  // `freshIdempotencyKey` OBLIGATOIRE (qa-review round 1, B1) : le reducteur
  // decide SEUL s il l utilise (voir plus bas), mais il ne genere jamais
  // rien lui-meme — l appelant fournit toujours une candidate, meme quand
  // elle ne sert pas.
  | Readonly<{ type: 'formatChanged'; format: OrderExportFormat; freshIdempotencyKey: string }>
  | Readonly<{ type: 'granularityChanged'; granularity: OrderExportGranularity; freshIdempotencyKey: string }>
  | Readonly<{ type: 'submitStarted' }>
  | Readonly<{ type: 'submitSucceeded'; nextIdempotencyKey: string }>
  | Readonly<{ type: 'submitFailed'; message: string }>;

/**
 * SEULE fonction qui fait transitionner l etat de la modale. Aucune branche
 * n appelle `crypto.randomUUID()` ni aucune autre source d alea : les cles
 * (`opened.idempotencyKey`, `formatChanged`/`granularityChanged.fresh
 * IdempotencyKey`, `submitSucceeded.nextIdempotencyKey`) sont TOUJOURS
 * fournies par l appelant — c est ce qui rend ce reducteur testable avec des
 * cles fixes, sans mock de `crypto`.
 *
 * ── BLOQUANT B1, qa-review round 1 (2026-09-15) ─────────────────────────
 * L empreinte d idempotence cote serveur couvre le CORPS de la requete
 * (`gescom-middleware.ts`) : rejouer la MEME cle avec un corps DIFFERENT
 * rend 409 `api.idempotency_key_reused`. Avant ce correctif, changer le
 * format/la granularite APRES un echec gardait la meme cle alors que le
 * corps allait changer au prochain envoi — l utilisateur restait bloque en
 * 409 tant que la modale restait ouverte. Corrige : `formatChanged`/
 * `granularityChanged` renouvellent la cle SI ET SEULEMENT SI `state.status
 * === 'error'` (un envoi a deja ete tente avec la cle courante, donc un
 * changement de configuration produirait un corps different pour la MEME
 * cle). Hors de ce cas (modale a peine ouverte, aucun envoi tente), la cle
 * reste celle de l ouverture — un reessai a l IDENTIQUE (sans changer
 * format/granularite) continue de reutiliser la meme cle, ce qui est
 * exactement le comportement voulu (point 4 : « reutilisee si l envoi est
 * rejoue »).
 */
export function orderExportDialogReducer(
  state: OrderExportDialogState,
  action: OrderExportDialogAction,
): OrderExportDialogState {
  switch (action.type) {
    case 'opened':
      return { ...CLOSED_ORDER_EXPORT_DIALOG_STATE, open: true, idempotencyKey: action.idempotencyKey };
    case 'closed':
      return CLOSED_ORDER_EXPORT_DIALOG_STATE;
    case 'formatChanged':
      if (state.status === 'submitting') return state;
      return {
        ...state,
        format: action.format,
        status: 'idle',
        error: null,
        idempotencyKey: state.status === 'error' ? action.freshIdempotencyKey : state.idempotencyKey,
      };
    case 'granularityChanged':
      if (state.status === 'submitting') return state;
      return {
        ...state,
        granularity: action.granularity,
        status: 'idle',
        error: null,
        idempotencyKey: state.status === 'error' ? action.freshIdempotencyKey : state.idempotencyKey,
      };
    case 'submitStarted':
      return state.status === 'submitting' ? state : { ...state, status: 'submitting', error: null };
    case 'submitSucceeded':
      // La demande est creee, elle vit desormais dans le panneau (registre) —
      // la modale se ferme et repart a zero, prete pour une prochaine
      // ouverture avec une cle NEUVE (point 4 : « renouvelee apres succes »).
      return { ...CLOSED_ORDER_EXPORT_DIALOG_STATE, idempotencyKey: action.nextIdempotencyKey };
    case 'submitFailed':
      // La cle N EST PAS CHANGEE : un reessai reprend `state.idempotencyKey`
      // tel quel (point 4 : « reutilisee si l envoi est rejoue »). Elle ne
      // se renouvelle que si `formatChanged`/`granularityChanged` survient
      // APRES cet echec (voir plus haut).
      return { ...state, status: 'error', error: action.message };
    default:
      return state;
  }
}

/** Bouton d envoi INACTIF pendant l envoi (point 1). */
export function isOrderExportSubmitDisabled(state: OrderExportDialogState): boolean {
  return state.status === 'submitting';
}

/** `crypto.randomUUID()` isole dans une seule fonction impure — jamais appele depuis le reducteur (voir en-tete). */
export function generateOrderExportIdempotencyKey(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// 4. Soumission — controleur avec garde de double-clic REELLE (point 1)
// ---------------------------------------------------------------------------

export type OrderExportSubmitController = Readonly<{
  /** Rend l export cree, ou `null` si l appel a ete ignore (deja en vol) ou a echoue (l echec est deja dispatche). */
  submit: (state: OrderExportDialogState, filters: OrderExportRequestFilters) => Promise<OrderExportDto | null>;
}>;

/**
 * `inFlight` vit dans la FERMETURE de ce controleur, pas dans `state` — un
 * `if (state.status === 'submitting')` seul ne suffirait pas : deux appels
 * synchrones (le double-clic) verraient tous les deux `state.status ===
 * 'idle'` si React n a pas encore re-rendu entre les deux. `inFlight` est
 * pose de facon SYNCHRONE, avant le premier `await` — le second appel le
 * voit donc a coup sur, quel que soit l etat de rendu.
 *
 * ── MINEUR Q4, qa-review round 1 ────────────────────────────────────────
 * Refuse l envoi tant que `state.idempotencyKey` est VIDE (`CLOSED_ORDER_
 * EXPORT_DIALOG_STATE.idempotencyKey === ''`, avant que l action `opened`
 * n ait pose une cle reelle) — meme discipline defensive que la garde
 * `inFlight` : un appel HTTP porteur d une cle vide echouerait cote serveur
 * (`idempotencyKeySchema`, 8 a 255 caracteres) pour une raison que
 * l utilisateur ne peut pas comprendre depuis l ecran.
 */
export function createOrderExportSubmitController(
  api: Pick<OrderExportsApiClient, 'request'>,
  dispatch: (action: OrderExportDialogAction) => void,
  newIdempotencyKey: () => string = generateOrderExportIdempotencyKey,
): OrderExportSubmitController {
  let inFlight = false;

  return {
    async submit(state, filters) {
      if (inFlight || state.status === 'submitting' || !state.idempotencyKey) return null;
      inFlight = true;
      dispatch({ type: 'submitStarted' });
      try {
        const created = await api.request(
          { format: state.format, granularity: state.granularity, filters },
          state.idempotencyKey,
        );
        dispatch({ type: 'submitSucceeded', nextIdempotencyKey: newIdempotencyKey() });
        return created;
      } catch (cause) {
        dispatch({
          type: 'submitFailed',
          // TELLE QUELLE (point 8) pour une `ApiClientError` : son message
          // vaut deja `problem.detail ?? problem.title` — aucune reecriture,
          // y compris pour `order_export.pending_limit_reached`. DEFAUT R3 :
          // une panne reseau (envoi hors ligne) ne doit plus afficher le
          // texte ANGLAIS brut du navigateur (`TypeError`, voir l en-tete de
          // fichier) — `resolveOrderExportUnreachableMessage()` est le SEUL
          // endroit qui tranche.
          message: resolveOrderExportUnreachableMessage(cause, {
            genericMessage: 'Demande d’export impossible.',
            networkMessage: 'Connexion impossible. Vérifiez votre réseau, puis réessayez.',
          }),
        });
        return null;
      } finally {
        inFlight = false;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Panneau des exports — registre, etat et reducteur PUR
// ---------------------------------------------------------------------------

/**
 * MINEUR, qa-review round 2 (2026-09-15) — SOURCE UNIQUE de la taille de
 * page du registre : avant ce correctif, `50` etait ecrit deux fois dans
 * `OrderExportPanel.tsx` (l appel `api.list({ pageSize: 50 })` ET le texte
 * du signal `hasMore`, « Registre limite aux 50 demandes... ») — deux
 * litteraux qu un futur ajustement du plafond aurait pu faire diverger sans
 * qu aucun test ne le remarque, meme famille de defaut que B2/D05.
 */
export const ORDER_EXPORT_REGISTRY_PAGE_SIZE = 50;

export type OrderExportRegistryStatus = 'loading' | 'idle' | 'error';

export type OrderExportRegistryState = Readonly<{
  status: OrderExportRegistryStatus;
  items: readonly OrderExportDto[];
  error: string | null;
  /** MINEUR, qa-review round 1 : au moins une demande plus ancienne que la page chargee existe (`nextCursor` non nul a la derniere lecture). Pilote le signal explicite du panneau — voir decision dediee du story doc. */
  hasMore: boolean;
}>;

export const INITIAL_ORDER_EXPORT_REGISTRY_STATE: OrderExportRegistryState = Object.freeze({
  status: 'loading',
  items: [],
  error: null,
  hasMore: false,
});

export type OrderExportRegistryAction =
  | Readonly<{ type: 'listLoaded'; items: readonly OrderExportDto[]; hasMore: boolean }>
  | Readonly<{ type: 'listLoadFailed'; message: string }>
  | Readonly<{ type: 'exportCreated'; item: OrderExportDto }>
  | Readonly<{ type: 'exportUpdated'; item: OrderExportDto }>;

/**
 * MINEUR Q2, qa-review round 1 (2026-09-15) : `listLoaded` REMPLACAIT
 * `state.items`, donc une demande creee localement (`exportCreated`) AVANT
 * qu une lecture du registre partie plus tot ne reponde etait EFFACEE des
 * qu elle arrivait — la ligne fraichement creee disparaissait, son poller
 * n etait plus jamais relance (`nonTerminalOrderExportIds` ne la voit plus).
 * Corrige : `listLoaded` FUSIONNE avec l existant (`mergeOrderExportItems`)
 * — un id deja connu localement mais ABSENT de la reponse serveur (course
 * exportCreated/list) est CONSERVE, jamais efface silencieusement.
 */
export function orderExportRegistryReducer(
  state: OrderExportRegistryState,
  action: OrderExportRegistryAction,
): OrderExportRegistryState {
  switch (action.type) {
    case 'listLoaded':
      return { status: 'idle', items: mergeOrderExportItems(state.items, action.items), error: null, hasMore: action.hasMore };
    case 'listLoadFailed':
      return { ...state, status: 'error', error: action.message };
    case 'exportCreated':
      // Rejeu d une meme Idempotency-Key -> meme id : pas de doublon en tete.
      return upsertsOrEmpty(state, action.item, 'prepend');
    case 'exportUpdated':
      return upsertsOrEmpty(state, action.item, 'in_place_only');
    default:
      return state;
  }
}

function upsertsOrEmpty(
  state: OrderExportRegistryState,
  item: OrderExportDto,
  whenMissing: 'prepend' | 'in_place_only',
): OrderExportRegistryState {
  const index = state.items.findIndex((existing) => existing.id === item.id);
  if (index === -1) {
    return whenMissing === 'prepend' ? { ...state, items: [item, ...state.items] } : state;
  }
  return { ...state, items: state.items.map((existing, i) => (i === index ? item : existing)) };
}

/**
 * FUSIONNE une reponse serveur (`incoming`, deja triee du plus recent au
 * plus ancien) avec l etat LOCAL courant (`current`) : le serveur fait foi
 * pour tout id qu il connait deja (statut, download_url... rafraichis),
 * mais un id present localement et ABSENT de `incoming` (cree APRES le
 * depart de la requete `list`, cf. Q2) est CONSERVE plutot qu efface. Le
 * resultat est retrie par `requested_at` decroissant, pour que l ordre
 * reste celui du registre (le plus recent en tete) quelle que soit la
 * provenance de chaque ligne.
 */
export function mergeOrderExportItems(
  current: readonly OrderExportDto[],
  incoming: readonly OrderExportDto[],
): readonly OrderExportDto[] {
  const byId = new Map(current.map((item) => [item.id, item] as const));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => (a.requested_at < b.requested_at ? 1 : a.requested_at > b.requested_at ? -1 : 0));
}

/** Identifiants des demandes NON TERMINALES du registre — c est le jeu d exports que le panneau doit interroger. */
export function nonTerminalOrderExportIds(items: readonly OrderExportDto[]): readonly string[] {
  return items.filter((item) => !isOrderExportTerminalStatus(item.status)).map((item) => item.id);
}

// ---------------------------------------------------------------------------
// 6. Suivi periodique — fonction de calendrier PURE + orchestration (point 5)
// ---------------------------------------------------------------------------

/** Cadence normale (contrat : « toutes les deux secondes est une cadence raisonnable »). */
export const ORDER_EXPORT_POLL_INTERVAL_MS = 2_000;
/** Au dela de cette duree ecoulee depuis le PREMIER sondage, on espace (contrat : « en espacant au-dela d une minute »). */
export const ORDER_EXPORT_POLL_BACKOFF_AFTER_MS = 60_000;
export const ORDER_EXPORT_POLL_BACKOFF_INTERVAL_MS = 10_000;

/**
 * BLOQUANT M1, qa-review round 2 (2026-09-15) — BORNE de la duree totale du
 * suivi d UNE demande, depuis son PREMIER sondage. Avant ce correctif, la
 * reprise apres echec (round 1) n avait AUCUNE limite : la sonde qa-review a
 * compte 84 `GET` en 10 minutes sur un 404 DURABLE (route disparue, demande
 * introuvable), sans qu aucun signal ne distingue ce cas d une generation
 * simplement lente. Valeur retenue et motif : `magrit-order-export-runner`
 * est declenche par un `pg_cron` A LA MINUTE (migration
 * `20260913000000_gescom_e10_18c_order_exports.sql`, `* * * * *` — meme
 * cadence que `magrit-outbox-dispatch`/`magrit-notification-send`) ; un
 * export qui n a pas atteint un etat TERMINAL apres DIX cycles de runner
 * (10 minutes) signale une anomalie (file bloquee, incident du runner ou du
 * reseau) que reessayer indefiniment, meme a la cadence basse frequence de
 * l espacement, ne resout pas et masque a l utilisateur. Passe ce delai, le
 * suivi de CETTE demande s arrete et le SIGNALE (`onError`) — le registre
 * (`GET /commercial-order-exports`) reste la source de verite si l utilisateur
 * recharge la page.
 */
export const ORDER_EXPORT_POLL_MAX_DURATION_MS = 10 * 60_000;

/** Message affiche quand l echeance de duree (ci-dessus) est atteinte — distinct d un echec de sondage ponctuel. */
export function resolveOrderExportPollingTimeoutMessage(): string {
  return 'Suivi automatique interrompu après 10 minutes sans confirmation — rechargez le registre pour connaître l’état actuel de cet export.';
}

/**
 * BLOQUANT M1, qa-review round 2 — distingue une erreur de sondage qui doit
 * ARRETER le suivi de CETTE demande (401 : session perimee, 403 : droit
 * retire, 404 : demande introuvable — aucun nombre de tentatives
 * supplementaires ne changera l issue) d une erreur qui doit le laisser
 * REPRENDRE (coupure reseau, 5xx passager — le cas deja traite par le
 * correctif du round 1, M1 initial, qui reste inchange pour ces deux
 * familles). `ApiClientError.problem.status` porte le code HTTP
 * (`platform/api/fetch-api-client.ts`) ; toute autre forme d echec (reseau,
 * timeout `fetch`, reponse hors contrat) n est PAS une `ApiClientError` et
 * retombe dans le cas « reprend », comme avant ce correctif.
 */
const ORDER_EXPORT_POLL_FATAL_STATUSES: ReadonlySet<number> = new Set([401, 403, 404]);

export function isOrderExportPollingFatal(cause: unknown): boolean {
  return cause instanceof ApiClientError && ORDER_EXPORT_POLL_FATAL_STATUSES.has(cause.problem.status);
}

const ORDER_EXPORT_TERMINAL_STATUSES: ReadonlySet<OrderExportStatus> = new Set(['ready', 'failed', 'expired']);

export function isOrderExportTerminalStatus(status: OrderExportStatus): boolean {
  return ORDER_EXPORT_TERMINAL_STATUSES.has(status);
}

/** Fonction de calendrier PURE, testee independamment de tout timer reel. */
export function nextOrderExportPollDelayMs(elapsedSinceFirstPollMs: number): number {
  return elapsedSinceFirstPollMs >= ORDER_EXPORT_POLL_BACKOFF_AFTER_MS
    ? ORDER_EXPORT_POLL_BACKOFF_INTERVAL_MS
    : ORDER_EXPORT_POLL_INTERVAL_MS;
}

export type OrderExportPollingHandle = Readonly<{
  /** Arrete le suivi — a appeler au demontage (point 5 : « arret au demontage ») ET des qu un etat terminal est atteint (fait automatiquement, voir plus bas). */
  stop: () => void;
}>;

/**
 * Interroge `getCommercialOrderExport` a la cadence de `nextOrderExportPoll
 * DelayMs`, jusqu a un etat TERMINAL ou jusqu a `stop()`. Timers GLOBAUX
 * (`setTimeout`/`clearTimeout`/`Date.now`), meme parti que `createDebounced
 * Search()` — testable avec `vi.useFakeTimers()`/`vi.advanceTimersByTimeAsync()`,
 * sans injection de clock.
 */
export function startOrderExportPolling(
  exportId: string,
  api: Pick<OrderExportsApiClient, 'get'>,
  onUpdate: (item: OrderExportDto) => void,
  onError: (message: string) => void,
): OrderExportPollingHandle {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const startedAt = Date.now();

  const scheduleNext = () => {
    if (stopped) return;
    const elapsed = Date.now() - startedAt;
    // BLOQUANT M1, qa-review round 2 : ECHEANCE de la duree totale du suivi
    // (voir `ORDER_EXPORT_POLL_MAX_DURATION_MS` pour le motif) — verifiee ICI,
    // au SEUL point qui programme un sondage de plus, donc valable que le
    // dernier sondage ait reussi (etat non terminal persistant) ou echoue
    // (branche reseau/5xx ci-dessous).
    if (elapsed >= ORDER_EXPORT_POLL_MAX_DURATION_MS) {
      stopped = true;
      onError(resolveOrderExportPollingTimeoutMessage());
      return;
    }
    timer = setTimeout(tick, nextOrderExportPollDelayMs(elapsed));
  };

  const tick = () => {
    if (stopped) return;
    api.get(exportId).then(
      (item) => {
        if (stopped) return;
        onUpdate(item);
        // ARRET AUTOMATIQUE sur un etat terminal — pas de sondage de plus.
        if (!isOrderExportTerminalStatus(item.status)) scheduleNext();
      },
      (cause: unknown) => {
        if (stopped) return;
        // DEFAUT R3, recette navigateur (2026-09-15) : une coupure PASSAGERE
        // du suivi affichait le texte ANGLAIS brut du navigateur (`TypeError`
        // de `fetch`, voir l en-tete de fichier) — remplace par un message
        // qui dit que la reprise est automatique, puisque `scheduleNext()`
        // (plus bas) la relance reellement.
        onError(
          resolveOrderExportUnreachableMessage(cause, {
            genericMessage: 'Suivi de l’export impossible.',
            networkMessage: 'Connexion perdue. Nouvel essai automatique…',
          }),
        );
        // BLOQUANT M1, qa-review round 2 (2026-09-15) : un 401/403/404 est
        // PERMANENT — la session, le droit ou la ressource elle-meme ont
        // disparu, et aucun nombre de tentatives supplementaires ne change
        // l issue. Avant ce correctif, la reprise du round 1 (ci-dessous)
        // s appliquait a TOUTE erreur sans distinction : la sonde qa-review a
        // compte 84 `GET` en 10 minutes sur un 404 durable. Le suivi de CETTE
        // demande s arrete desormais ICI pour ces trois codes — `onError` a
        // deja ete notifie juste au-dessus, le message reste celui du
        // serveur (jamais de JSON brut : `ApiClientError.message` vaut deja
        // `problem.detail ?? problem.title`).
        if (isOrderExportPollingFatal(cause)) {
          stopped = true;
          return;
        }
        // MOYEN M1, qa-review round 1 (2026-09-15) : un echec TRANSITOIRE de
        // suivi (reseau coupe un instant, 500 passager) NE DOIT PAS figer le
        // suivi indefiniment — avant ce correctif, un seul GET en echec
        // sortait cette demande de toute boucle et le panneau affichait
        // "En cours" a vie, sans aucun moyen de s en rendre compte. Le
        // sondage REPREND a la MEME cadence (`nextOrderExportPollDelayMs`,
        // donc borne : au plus toutes les 2 s, puis 10 s au dela d une
        // minute, et desormais borne dans le temps par
        // `ORDER_EXPORT_POLL_MAX_DURATION_MS`, voir `scheduleNext`) —
        // `onError` reste appele a CHAQUE echec, pour que l appelant puisse
        // signaler un suivi degrade sans pour autant l arreter.
        scheduleNext();
      },
    );
  };

  scheduleNext();

  return {
    stop: () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}

// ---------------------------------------------------------------------------
// 7. Affichage du statut et du telechargement (points 6 et 8)
// ---------------------------------------------------------------------------

export type OrderExportStatusTone = 'pending' | 'success' | 'error' | 'neutral';

export type OrderExportStatusDisplay = Readonly<{
  label: string;
  tone: OrderExportStatusTone;
  /** Message d echec a afficher, `null` hors `failed`. */
  message: string | null;
}>;

const ROW_LIMIT_EXCEEDED_CODE = 'order_export.row_limit_exceeded';

/**
 * SEUL endroit qui traduit `error_code` en texte ecran. `row_limit_exceeded`
 * NE PORTE AUCUN CHIFFRE (cadrage §8.24 point 8 : le plafond change sans
 * prevenir l ecran) — le test dedie verifie l ABSENCE de chiffre dans le
 * message, pas seulement sa presence.
 */
export function resolveOrderExportFailureMessage(errorCode: string | null, errorDetail: string | null): string {
  if (errorCode === ROW_LIMIT_EXCEEDED_CODE) {
    return 'Trop de commandes pour cette période : resserrez la période et relancez l’export.';
  }
  return errorDetail ?? 'Échec de la génération de l’export.';
}

/** Table PURE, un cas par `OrderExportStatus` — consommee par le panneau sans aucune decision d affichage dans le JSX (point 11). */
export function describeOrderExportStatus(item: Pick<OrderExportDto, 'status' | 'error_code' | 'error_detail'>): OrderExportStatusDisplay {
  switch (item.status) {
    case 'pending':
      return { label: 'En attente', tone: 'pending', message: null };
    case 'running':
      return { label: 'En cours', tone: 'pending', message: null };
    case 'ready':
      return { label: 'Prêt', tone: 'success', message: null };
    case 'failed':
      return { label: 'Échec', tone: 'error', message: resolveOrderExportFailureMessage(item.error_code, item.error_detail) };
    case 'expired':
      return { label: 'Expiré', tone: 'neutral', message: null };
    default:
      return { label: item.status, tone: 'neutral', message: null };
  }
}

export type OrderExportDownloadState =
  | Readonly<{ kind: 'not_ready' }>
  | Readonly<{ kind: 'failed' }>
  | Readonly<{ kind: 'expired' }>
  | Readonly<{ kind: 'not_requester' }>
  | Readonly<{ kind: 'available'; url: string }>;

/**
 * Distingue les TROIS cas de `download_url: null` (point 6 : « pas pret,
 * expire, ou pas le demandeur ») PAR LE STATUT — jamais par une supposition
 * sur `requested_by` : sur `ready`, le contrat garantit que le DEMANDEUR
 * recoit toujours une URL non nulle ; un `download_url` nul sur `ready` ne
 * peut donc signifier qu une chose, « ce n est pas moi qui ai demande cet
 * export ». Un `failed` est distingue de ces trois cas (deja explique par
 * `describeOrderExportStatus`), jamais confondu avec « pas pret ».
 */
export function resolveOrderExportDownloadState(
  item: Pick<OrderExportDto, 'status' | 'download_url'>,
): OrderExportDownloadState {
  switch (item.status) {
    case 'pending':
    case 'running':
      return { kind: 'not_ready' };
    case 'failed':
      return { kind: 'failed' };
    case 'expired':
      return { kind: 'expired' };
    case 'ready':
      return item.download_url ? { kind: 'available', url: item.download_url } : { kind: 'not_requester' };
    default:
      return { kind: 'not_ready' };
  }
}

/**
 * Libelle affiche, un par `OrderExportDownloadState['kind']` — table PURE,
 * SOURCE UNIQUE (qa-review round 1, B2 : avant ce correctif, ces libelles
 * etaient ecrits a la main dans le JSX du panneau, et permutables sans
 * qu aucun test ne le remarque, D04).
 *
 * DEFAUT R4, recette navigateur (2026-09-15) — `expired` valait « Expiré »
 * ICI, alors que `describeOrderExportStatus()` rend DEJA « Expiré » pour ce
 * MEME statut (colonne Statut) : le panneau affichait le mot DEUX FOIS sur
 * une meme ligne (« Excel (XLSX) ... Expiré Expiré »). `not_requester` ne
 * porte pas ce defaut : son statut (colonne Statut) reste « Prêt », son
 * libelle de telechargement (« Demande par un autre membre ») est une
 * information DIFFERENTE, pas une repetition — INCHANGE. `expired` rejoint
 * `not_ready`/`failed` : le statut suffit, la colonne telechargement reste
 * vide (tiret).
 */
const ORDER_EXPORT_DOWNLOAD_LABELS: Readonly<Record<OrderExportDownloadState['kind'], string>> = {
  not_ready: '—',
  failed: '—',
  expired: '—',
  not_requester: 'Demandé par un autre membre',
  available: 'Télécharger',
};

export type OrderExportDownloadDisplay = Readonly<{
  kind: OrderExportDownloadState['kind'];
  label: string;
  /** Vrai UNIQUEMENT pour `kind: 'available'` — jamais l URL elle-meme (voir en-tete de fichier, MOYEN M2). */
  downloadable: boolean;
}>;

/**
 * BLOQUANT B2 / MOYEN M2, qa-review round 1 (2026-09-15) — table PURE de
 * l affichage du telechargement, DELIBEREMENT SANS URL. Avant ce correctif,
 * le JSX du panneau posait l URL signee (deja connue, potentiellement
 * PERIMEE de plusieurs minutes) directement dans un `href` — un clic
 * milieu, « ouvrir dans un nouvel onglet » ou « copier le lien » contournait
 * alors le rafraichissement au clic (contrat : « au clic, relire l export
 * pour obtenir un lien frais »). En ne rendant JAMAIS l URL disponible a
 * l affichage — seul un booleen `downloadable` en sort — ce n est plus une
 * discipline de composant a respecter (`preventDefault()` qu on pourrait
 * oublier), c est une IMPOSSIBILITE STRUCTURELLE : rien dans ce que cette
 * fonction rend ne peut devenir un `href`. L URL reelle n est obtenue
 * qu au moment du clic, via `refreshOrderExportDownloadUrl()`.
 */
export function describeOrderExportDownload(
  item: Pick<OrderExportDto, 'status' | 'download_url'>,
): OrderExportDownloadDisplay {
  const state = resolveOrderExportDownloadState(item);
  return { kind: state.kind, label: ORDER_EXPORT_DOWNLOAD_LABELS[state.kind], downloadable: state.kind === 'available' };
}

export type OrderExportRowDisplay = Readonly<{
  formatLabel: string;
  granularityLabel: string;
  requestedByLabel: string;
  status: OrderExportStatusDisplay;
  download: OrderExportDownloadDisplay;
}>;

/**
 * BLOQUANT B2, qa-review round 1 — descripteur de ligne UNIQUE pour le
 * panneau : le format et la granularite sont LUS depuis les MEMES options
 * que la modale (`ORDER_EXPORT_FORMAT_OPTIONS`/`ORDER_EXPORT_GRANULARITY_
 * OPTIONS`), jamais un second libelle ecrit a la main (avant ce correctif,
 * la granularite etait un ternaire local au JSX du panneau, INDEPENDANT de
 * `ORDER_EXPORT_GRANULARITY_OPTIONS` — deux sources pour la meme
 * information, permutables sans qu aucun test ne le remarque, D05). Le JSX
 * du panneau ne garde plus qu une seule boucle generique de rendu : un
 * lien si `download.downloadable`, du texte sinon.
 */
export function describeOrderExportRow(item: OrderExportDto): OrderExportRowDisplay {
  return {
    formatLabel: ORDER_EXPORT_FORMAT_OPTIONS.find((option) => option.value === item.format)?.label ?? item.format,
    granularityLabel:
      ORDER_EXPORT_GRANULARITY_OPTIONS.find((option) => option.value === item.granularity)?.label ?? item.granularity,
    requestedByLabel: item.requested_by_label ?? '—',
    status: describeOrderExportStatus(item),
    download: describeOrderExportDownload(item),
  };
}

/**
 * Rafraichit le lien de telechargement AU CLIC (point 7 : « au clic, relire
 * l export pour obtenir un lien frais ») — ne renvoie JAMAIS un lien deja
 * en memoire, toujours celui d une lecture FRAICHE de `getCommercialOrder
 * Export`. Rend `null` si l export n est plus telechargeable au moment du
 * clic (expire entre-temps, ou n est plus le demandeur — cas theorique).
 */
export async function refreshOrderExportDownloadUrl(
  api: Pick<OrderExportsApiClient, 'get'>,
  exportId: string,
): Promise<Readonly<{ item: OrderExportDto; url: string | null }>> {
  const item = await api.get(exportId);
  const state = resolveOrderExportDownloadState(item);
  return { item, url: state.kind === 'available' ? state.url : null };
}
