/**
 * Logique PURE de l export comptable des commandes (E10.18e-2,
 * docs/api/CONVENTIONS.md §8.24, consigne E10.18e-2 points 1 a 11).
 * Couvre, au minimum, la liste opposable du mandat : parite des filtres,
 * absence du tri, idempotence/double-clic, table des statuts, arret de
 * l interrogation (demontage + etat terminal), reemission de l URL, les
 * deux messages d erreur, `download_url` nul pour un non-demandeur.
 */
import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/platform/api';
import type { OrderExportDto } from '@/modules/order-exports';
import {
  buildOrderExportFilters,
  buildOrderExportFilterSummary,
  CAN_EXPORT_ORDERS,
  CLOSED_ORDER_EXPORT_DIALOG_STATE,
  createOrderExportSubmitController,
  describeOrderExportDownload,
  describeOrderExportRow,
  describeOrderExportStatus,
  INITIAL_ORDER_EXPORT_REGISTRY_STATE,
  isOrderExportSubmitDisabled,
  isOrderExportTerminalStatus,
  mergeOrderExportItems,
  nextOrderExportPollDelayMs,
  nonTerminalOrderExportIds,
  ORDER_EXPORT_FORMAT_OPTIONS,
  ORDER_EXPORT_GRANULARITY_OPTIONS,
  ORDER_EXPORT_POLL_BACKOFF_AFTER_MS,
  ORDER_EXPORT_POLL_BACKOFF_INTERVAL_MS,
  ORDER_EXPORT_POLL_INTERVAL_MS,
  orderExportDialogReducer,
  orderExportRegistryReducer,
  refreshOrderExportDownloadUrl,
  resolveOrderExportDownloadState,
  resolveOrderExportFailureMessage,
  resolveOrderExportUnreachableMessage,
  startOrderExportPolling,
  type OrderExportDialogState,
  type OrderExportRegistryState,
} from '@/modules/commercial-orders/ui/components/order-export.helpers';
import {
  buildOrdersListQuery,
  DEFAULT_ORDERS_LIST_FILTERS,
  EMPTY_PRODUCTION_STEP_CATALOG,
  type OrdersListFilters,
  type ProductionStepCatalog,
} from '@/modules/commercial-orders/ui/workspace/orders-list.helpers';

function fixtureExport(overrides: Partial<OrderExportDto> = {}): OrderExportDto {
  return {
    id: 'export-1',
    status: 'pending',
    format: 'xlsx',
    granularity: 'order',
    filters: {},
    layout_version: 1,
    requested_by: 'user-a',
    requested_by_label: 'Alice Imprimeur',
    requested_at: '2026-09-15T10:00:00.000Z',
    started_at: null,
    completed_at: null,
    row_count: null,
    file_name: null,
    byte_size: null,
    sha256: null,
    content_type: null,
    download_url: null,
    download_url_expires_at: null,
    expires_at: null,
    attempts: 0,
    error_code: null,
    error_detail: null,
    ...overrides,
  };
}

describe('buildOrderExportFilters — parite STRUCTURELLE avec la requete de grille (point 3)', () => {
  it('reprend exactement les quatre axes partages de buildOrdersListQuery, quand ils sont tous actifs', () => {
    const filters: OrdersListFilters = {
      createdFrom: '2026-09-01',
      createdTo: '2026-09-30',
      customerId: 'customer-1',
      productionStepId: 'step-1',
      sort: 'production_step',
    };
    const gridQuery = buildOrdersListQuery(filters);
    const exportFilters = buildOrderExportFilters(filters);

    expect(exportFilters.customer_id).toBe(gridQuery.customerId);
    expect(exportFilters.current_production_step_id).toBe(gridQuery.currentProductionStepId);
    expect(exportFilters.created_from).toBe(gridQuery.createdFrom);
    expect(exportFilters.created_to).toBe(gridQuery.createdTo);
  });

  it('omet un axe ABSENT de la grille — jamais null, jamais chaine vide', () => {
    // Mutation qui ferait tomber ce test : `result.customer_id = gridQuery.customerId ?? ''`.
    const exportFilters = buildOrderExportFilters(DEFAULT_ORDERS_LIST_FILTERS);
    expect('customer_id' in exportFilters).toBe(false);
    expect('current_production_step_id' in exportFilters).toBe(false);
    expect('created_from' in exportFilters).toBe(false);
    expect('created_to' in exportFilters).toBe(false);
  });

  it('LE TRI N EST JAMAIS REPRIS, meme non par defaut (point (ii) du cadrage)', () => {
    // Mutation qui ferait tomber ce test : ajouter `sort: gridQuery.sort` dans `buildOrderExportFilters`.
    const filters: OrdersListFilters = { ...DEFAULT_ORDERS_LIST_FILTERS, sort: 'production_step' };
    const exportFilters = buildOrderExportFilters(filters);
    expect('sort' in exportFilters).toBe(false);
    expect(Object.keys(exportFilters)).toEqual([]);
  });

  it('ne reprend ni quote_id ni status (point (i) : la grille ne les montre pas)', () => {
    const exportFilters = buildOrderExportFilters({ ...DEFAULT_ORDERS_LIST_FILTERS, customerId: 'c1' });
    expect(exportFilters).toEqual({ customer_id: 'c1' });
  });

  it('un seul axe actif (client) ne fait fuiter aucun autre axe', () => {
    const exportFilters = buildOrderExportFilters({ ...DEFAULT_ORDERS_LIST_FILTERS, createdFrom: '2026-09-01' });
    expect(exportFilters).toEqual({ created_from: '2026-09-01' });
  });
});

describe('buildOrderExportFilterSummary — resume affiche dans la modale (point 3)', () => {
  const catalogWithStep: ProductionStepCatalog = {
    byId: new Map([['step-1', { id: 'step-1', label: 'Façonnage', is_active: true, position: 2 } as never]]),
    ordered: [],
  };

  it('rend une liste vide quand aucun filtre n est actif', () => {
    expect(buildOrderExportFilterSummary(DEFAULT_ORDERS_LIST_FILTERS, '', EMPTY_PRODUCTION_STEP_CATALOG)).toEqual([]);
  });

  it('affiche la periode, le client (libelle deja connu) et l etape (libellee via le catalogue)', () => {
    const filters: OrdersListFilters = {
      ...DEFAULT_ORDERS_LIST_FILTERS,
      createdFrom: '2026-09-01',
      createdTo: '2026-09-30',
      customerId: 'customer-1',
      productionStepId: 'step-1',
    };
    const summary = buildOrderExportFilterSummary(filters, 'Imprimerie Dupont', catalogWithStep);
    expect(summary).toEqual([
      { label: 'Période', value: '2026-09-01 → 2026-09-30' },
      { label: 'Client', value: 'Imprimerie Dupont' },
      { label: 'Étape', value: 'Façonnage' },
    ]);
  });
});

describe('orderExportDialogReducer — cycle de vie de la cle d idempotence (point 4)', () => {
  it('cree la cle a l ouverture, la CONSERVE a un echec, la RENOUVELLE apres succes', () => {
    let state = orderExportDialogReducer(CLOSED_ORDER_EXPORT_DIALOG_STATE, { type: 'opened', idempotencyKey: 'key-a' });
    expect(state.idempotencyKey).toBe('key-a');
    expect(state.open).toBe(true);

    state = orderExportDialogReducer(state, { type: 'submitStarted' });
    expect(state.status).toBe('submitting');

    state = orderExportDialogReducer(state, { type: 'submitFailed', message: 'reseau indisponible' });
    // Mutation qui ferait tomber cette assertion : regenerer une cle dans le cas `submitFailed`.
    expect(state.idempotencyKey).toBe('key-a');
    expect(state.status).toBe('error');
    expect(state.error).toBe('reseau indisponible');

    // Reessai — la MEME cle repart (jamais recalculee ici, voir le controleur).
    state = orderExportDialogReducer(state, { type: 'submitStarted' });
    expect(state.idempotencyKey).toBe('key-a');

    state = orderExportDialogReducer(state, { type: 'submitSucceeded', nextIdempotencyKey: 'key-b' });
    // Mutation qui ferait tomber cette assertion : conserver `key-a` dans le cas `submitSucceeded`.
    expect(state.idempotencyKey).toBe('key-b');
    expect(state.open).toBe(false);
    expect(state.status).toBe('idle');
  });

  it('formatChanged/granularityChanged sont ignores PENDANT l envoi', () => {
    const submitting: OrderExportDialogState = { ...CLOSED_ORDER_EXPORT_DIALOG_STATE, open: true, status: 'submitting' };
    expect(
      orderExportDialogReducer(submitting, { type: 'formatChanged', format: 'csv', freshIdempotencyKey: 'unused' }).format,
    ).toBe('xlsx');
    expect(
      orderExportDialogReducer(submitting, { type: 'granularityChanged', granularity: 'line', freshIdempotencyKey: 'unused' })
        .granularity,
    ).toBe('order');
  });

  it('formatChanged/granularityChanged s appliquent hors envoi', () => {
    const idle: OrderExportDialogState = { ...CLOSED_ORDER_EXPORT_DIALOG_STATE, open: true };
    expect(orderExportDialogReducer(idle, { type: 'formatChanged', format: 'csv', freshIdempotencyKey: 'unused' }).format).toBe(
      'csv',
    );
    expect(
      orderExportDialogReducer(idle, { type: 'granularityChanged', granularity: 'line', freshIdempotencyKey: 'unused' })
        .granularity,
    ).toBe('line');
  });

  it('closed ramene l etat CLOS par defaut', () => {
    const open: OrderExportDialogState = { ...CLOSED_ORDER_EXPORT_DIALOG_STATE, open: true, idempotencyKey: 'key-a' };
    expect(orderExportDialogReducer(open, { type: 'closed' })).toEqual(CLOSED_ORDER_EXPORT_DIALOG_STATE);
  });

  describe('BLOQUANT B1 (qa-review round 1) — la cle se renouvelle SI ET SEULEMENT SI un envoi a deja ete tente', () => {
    it('hors echec (modale a peine ouverte) : formatChanged/granularityChanged GARDENT la cle courante', () => {
      // Mutation qui ferait tomber ce test : toujours utiliser
      // `action.freshIdempotencyKey`, meme quand `state.status !== 'error'`.
      const opened = orderExportDialogReducer(CLOSED_ORDER_EXPORT_DIALOG_STATE, { type: 'opened', idempotencyKey: 'k1' });
      const afterFormat = orderExportDialogReducer(opened, {
        type: 'formatChanged',
        format: 'csv',
        freshIdempotencyKey: 'candidate-non-utilisee',
      });
      expect(afterFormat.idempotencyKey).toBe('k1');
      const afterGranularity = orderExportDialogReducer(afterFormat, {
        type: 'granularityChanged',
        granularity: 'line',
        freshIdempotencyKey: 'candidate-non-utilisee-2',
      });
      expect(afterGranularity.idempotencyKey).toBe('k1');
    });

    it('APRES un echec, changer le FORMAT renouvelle la cle — sonde qa-review Q1 (corps different, meme cle interdite)', () => {
      // Mutation qui ferait tomber ce test : la ligne
      // `state.status === 'error' ? action.freshIdempotencyKey : state.idempotencyKey`
      // remplacee par `state.idempotencyKey` inconditionnel dans le cas `formatChanged`.
      let state = orderExportDialogReducer(CLOSED_ORDER_EXPORT_DIALOG_STATE, { type: 'opened', idempotencyKey: 'k1' });
      state = orderExportDialogReducer(state, { type: 'submitStarted' });
      state = orderExportDialogReducer(state, { type: 'submitFailed', message: 'coupure' });
      expect(state.idempotencyKey).toBe('k1');

      state = orderExportDialogReducer(state, { type: 'formatChanged', format: 'csv', freshIdempotencyKey: 'k2' });

      expect(state.idempotencyKey).toBe('k2');
      expect(state.idempotencyKey).not.toBe('k1');
      // L echec est efface : une nouvelle configuration merite un etat propre.
      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
    });

    it('APRES un echec, changer la GRANULARITE renouvelle aussi la cle', () => {
      let state = orderExportDialogReducer(CLOSED_ORDER_EXPORT_DIALOG_STATE, { type: 'opened', idempotencyKey: 'k1' });
      state = orderExportDialogReducer(state, { type: 'submitStarted' });
      state = orderExportDialogReducer(state, { type: 'submitFailed', message: 'coupure' });

      state = orderExportDialogReducer(state, { type: 'granularityChanged', granularity: 'line', freshIdempotencyKey: 'k2' });

      expect(state.idempotencyKey).toBe('k2');
    });

    it('un REESSAI A L IDENTIQUE (sans changer format/granularite) apres un echec GARDE la meme cle', () => {
      // C est la moitie de la sonde Q1 : `calls[0].key === calls[1].key`
      // quand le corps n a pas change entre les deux tentatives.
      let state = orderExportDialogReducer(CLOSED_ORDER_EXPORT_DIALOG_STATE, { type: 'opened', idempotencyKey: 'k1' });
      state = orderExportDialogReducer(state, { type: 'submitStarted' });
      state = orderExportDialogReducer(state, { type: 'submitFailed', message: 'coupure' });

      // Reessai — aucune action formatChanged/granularityChanged entre les deux.
      state = orderExportDialogReducer(state, { type: 'submitStarted' });

      expect(state.idempotencyKey).toBe('k1');
    });
  });
});

describe('isOrderExportSubmitDisabled — bouton INACTIF pendant l envoi (point 1)', () => {
  it.each([
    ['idle', false],
    ['submitting', true],
    ['error', false],
  ] as const)('status=%s -> disabled=%s', (status, expected) => {
    expect(isOrderExportSubmitDisabled({ ...CLOSED_ORDER_EXPORT_DIALOG_STATE, status })).toBe(expected);
  });
});

describe('createOrderExportSubmitController — double-clic (point 1)', () => {
  const openState: OrderExportDialogState = {
    ...CLOSED_ORDER_EXPORT_DIALOG_STATE,
    open: true,
    idempotencyKey: 'key-a',
  };

  it('un double-clic (deux appels synchrones avec le MEME etat) ne cree qu UNE SEULE demande', async () => {
    // Mutation qui ferait tomber ce test : retirer la garde `inFlight` (ou la
    // remplacer par `state.status === 'submitting'` seul) dans le controleur.
    const api = { request: vi.fn().mockResolvedValue(fixtureExport()) };
    const dispatch = vi.fn();
    const controller = createOrderExportSubmitController(api, dispatch, () => 'key-b');

    const [first, second] = await Promise.all([controller.submit(openState, {}), controller.submit(openState, {})]);

    expect(api.request).toHaveBeenCalledTimes(1);
    expect([first, second].filter((result) => result === null)).toHaveLength(1);
    expect([first, second].filter((result) => result !== null)).toHaveLength(1);
  });

  it('transmet la cle de `state.idempotencyKey` a l API, jamais une cle recalculee au point d appel', async () => {
    const api = { request: vi.fn().mockResolvedValue(fixtureExport()) };
    const controller = createOrderExportSubmitController(api, vi.fn(), () => 'key-b');

    await controller.submit(openState, { customer_id: 'c1' });

    expect(api.request).toHaveBeenCalledWith(
      { format: 'xlsx', granularity: 'order', filters: { customer_id: 'c1' } },
      'key-a',
    );
  });

  it('dispatche submitStarted PUIS submitSucceeded (avec la cle NEUVE) en cas de succes', async () => {
    const created = fixtureExport();
    const api = { request: vi.fn().mockResolvedValue(created) };
    const dispatch = vi.fn();
    const controller = createOrderExportSubmitController(api, dispatch, () => 'key-b');

    const result = await controller.submit(openState, {});

    expect(dispatch.mock.calls.map((call) => call[0])).toEqual([
      { type: 'submitStarted' },
      { type: 'submitSucceeded', nextIdempotencyKey: 'key-b' },
    ]);
    expect(result).toBe(created);
  });

  it('dispatche submitFailed avec le message TEL QUEL en cas d echec (point 8 : aucune reecriture)', async () => {
    const api = { request: vi.fn().mockRejectedValue(new Error('order_export.pending_limit_reached: 3 demandes en cours')) };
    const dispatch = vi.fn();
    const controller = createOrderExportSubmitController(api, dispatch);

    const result = await controller.submit(openState, {});

    expect(result).toBeNull();
    expect(dispatch).toHaveBeenCalledWith({
      type: 'submitFailed',
      message: 'order_export.pending_limit_reached: 3 demandes en cours',
    });
  });

  it('DEFAUT R3 (recette navigateur, 2026-09-15) : un envoi HORS LIGNE (TypeError de fetch) dispatche un message FRANCAIS, jamais "Failed to fetch"', async () => {
    // AVANT ce correctif : `message: cause instanceof Error ? cause.message
    // : ...` dispatchait LITTERALEMENT le texte anglais du navigateur.
    const api = { request: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) };
    const dispatch = vi.fn();
    const controller = createOrderExportSubmitController(api, dispatch);

    const result = await controller.submit(openState, {});

    expect(result).toBeNull();
    expect(dispatch).toHaveBeenCalledWith({
      type: 'submitFailed',
      message: 'Connexion impossible. Vérifiez votre réseau, puis réessayez.',
    });
  });

  it('libere `inFlight` apres un echec — un appel SUIVANT (pas simultane) repart normalement', async () => {
    const api = { request: vi.fn().mockRejectedValueOnce(new Error('echec')).mockResolvedValueOnce(fixtureExport()) };
    const dispatch = vi.fn();
    const controller = createOrderExportSubmitController(api, dispatch, () => 'key-b');

    await controller.submit(openState, {});
    const second = await controller.submit(openState, {});

    expect(api.request).toHaveBeenCalledTimes(2);
    expect(second).not.toBeNull();
  });

  it('n appelle pas l API si `state.status` est deja `submitting` (defense en profondeur)', async () => {
    const api = { request: vi.fn() };
    const dispatch = vi.fn();
    const controller = createOrderExportSubmitController(api, dispatch);

    const result = await controller.submit({ ...openState, status: 'submitting' }, {});

    expect(result).toBeNull();
    expect(api.request).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('MINEUR Q4 (qa-review round 1) — refuse l envoi tant que la cle est VIDE, jamais un envoi avec cle vide', async () => {
    // Sonde qa-review Q4, rejouee : avant ce correctif, le controleur
    // envoyait `''` au serveur si `submit()` etait appele avant que `opened`
    // n ait pose une cle reelle. Mutation qui ferait tomber ce test :
    // retirer `|| !state.idempotencyKey` de la garde.
    const api = { request: vi.fn().mockResolvedValue(fixtureExport()) };
    const dispatch = vi.fn();
    const controller = createOrderExportSubmitController(api, dispatch, () => 'k2');

    const result = await controller.submit(CLOSED_ORDER_EXPORT_DIALOG_STATE, {});

    expect(result).toBeNull();
    expect(api.request).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

function regState(overrides: Partial<OrderExportRegistryState> = {}): OrderExportRegistryState {
  return { status: 'idle', items: [], error: null, hasMore: false, ...overrides };
}

describe('orderExportRegistryReducer — registre du panneau', () => {
  it('listLoaded remplace items et passe status a idle', () => {
    const items = [fixtureExport()];
    const state = orderExportRegistryReducer(INITIAL_ORDER_EXPORT_REGISTRY_STATE, { type: 'listLoaded', items, hasMore: false });
    expect(state).toEqual(regState({ items }));
  });

  it('listLoaded porte `hasMore` TEL QUE fourni par l appelant (signal du registre limite a 50, mineur)', () => {
    const state = orderExportRegistryReducer(INITIAL_ORDER_EXPORT_REGISTRY_STATE, {
      type: 'listLoaded',
      items: [fixtureExport()],
      hasMore: true,
    });
    expect(state.hasMore).toBe(true);
  });

  it('listLoadFailed porte le message et conserve les items existants', () => {
    const loaded = orderExportRegistryReducer(INITIAL_ORDER_EXPORT_REGISTRY_STATE, {
      type: 'listLoaded',
      items: [fixtureExport()],
      hasMore: false,
    });
    const failed = orderExportRegistryReducer(loaded, { type: 'listLoadFailed', message: 'reseau' });
    expect(failed.status).toBe('error');
    expect(failed.error).toBe('reseau');
    expect(failed.items).toHaveLength(1);
  });

  it('exportCreated ajoute EN TETE une demande absente du registre', () => {
    const state = orderExportRegistryReducer(
      regState({ items: [fixtureExport({ id: 'export-old' })] }),
      { type: 'exportCreated', item: fixtureExport({ id: 'export-new' }) },
    );
    expect(state.items.map((item) => item.id)).toEqual(['export-new', 'export-old']);
  });

  it('exportCreated NE DUPLIQUE PAS un rejeu de la meme Idempotency-Key (meme id)', () => {
    const existing = fixtureExport({ id: 'export-1', status: 'pending' });
    const state = orderExportRegistryReducer(regState({ items: [existing] }), {
      type: 'exportCreated',
      item: fixtureExport({ id: 'export-1', status: 'pending' }),
    });
    expect(state.items).toHaveLength(1);
  });

  it('exportUpdated remplace UNIQUEMENT la ligne visee, en place', () => {
    const state = orderExportRegistryReducer(
      regState({ items: [fixtureExport({ id: 'a', status: 'pending' }), fixtureExport({ id: 'b', status: 'pending' })] }),
      { type: 'exportUpdated', item: fixtureExport({ id: 'b', status: 'ready' }) },
    );
    expect(state.items.map((item) => [item.id, item.status])).toEqual([
      ['a', 'pending'],
      ['b', 'ready'],
    ]);
  });

  it('exportUpdated pour un id ABSENT du registre ne fait rien (jamais de creation silencieuse)', () => {
    const initial = regState({ items: [fixtureExport({ id: 'a' })] });
    const state = orderExportRegistryReducer(initial, { type: 'exportUpdated', item: fixtureExport({ id: 'ghost' }) });
    expect(state).toBe(initial);
  });

  describe('MINEUR Q2 (qa-review round 1) — listLoaded FUSIONNE, il ne remplace plus', () => {
    it('une demande creee localement AVANT la reponse d une liste partie plus tot n est PAS effacee', () => {
      // Mutation qui ferait tomber ce test : revenir a `items: action.items`
      // dans le cas `listLoaded` (remplacement plutot que fusion). La sonde
      // qa-review « Q2 » constatait exactement cette perte.
      const withCreated = orderExportRegistryReducer(INITIAL_ORDER_EXPORT_REGISTRY_STATE, {
        type: 'exportCreated',
        item: fixtureExport({ id: 'neuf', requested_at: '2026-09-15T12:00:00.000Z' }),
      });
      const state = orderExportRegistryReducer(withCreated, {
        type: 'listLoaded',
        items: [fixtureExport({ id: 'ancien', status: 'ready', requested_at: '2026-09-15T10:00:00.000Z' })],
        hasMore: false,
      });
      expect(state.items.map((item) => item.id)).toEqual(['neuf', 'ancien']);
    });

    it('un id CONNU DU SERVEUR est rafraichi par la reponse (le serveur fait foi pour ce qu il connait)', () => {
      const withCreated = orderExportRegistryReducer(INITIAL_ORDER_EXPORT_REGISTRY_STATE, {
        type: 'exportCreated',
        item: fixtureExport({ id: 'e1', status: 'pending', requested_at: '2026-09-15T12:00:00.000Z' }),
      });
      const state = orderExportRegistryReducer(withCreated, {
        type: 'listLoaded',
        items: [fixtureExport({ id: 'e1', status: 'ready', requested_at: '2026-09-15T12:00:00.000Z' })],
        hasMore: false,
      });
      expect(state.items).toHaveLength(1);
      expect(state.items[0]!.status).toBe('ready');
    });
  });
});

describe('mergeOrderExportItems — fusion PURE (Q2)', () => {
  it('conserve un id local absent de la reponse serveur', () => {
    const merged = mergeOrderExportItems(
      [fixtureExport({ id: 'local', requested_at: '2026-09-15T12:00:00.000Z' })],
      [fixtureExport({ id: 'server', requested_at: '2026-09-15T10:00:00.000Z' })],
    );
    expect(merged.map((item) => item.id)).toEqual(['local', 'server']);
  });

  it('trie le resultat par requested_at DECROISSANT, quelle que soit la provenance', () => {
    const merged = mergeOrderExportItems(
      [fixtureExport({ id: 'a', requested_at: '2026-09-15T08:00:00.000Z' })],
      [fixtureExport({ id: 'b', requested_at: '2026-09-15T14:00:00.000Z' })],
    );
    expect(merged.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('le serveur REMPLACE la version locale d un id qu il connait deja (pas de doublon)', () => {
    const merged = mergeOrderExportItems(
      [fixtureExport({ id: 'e1', status: 'pending' })],
      [fixtureExport({ id: 'e1', status: 'ready' })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]!.status).toBe('ready');
  });
});

describe('nonTerminalOrderExportIds / isOrderExportTerminalStatus', () => {
  it('ready/failed/expired sont terminaux ; pending/running ne le sont pas', () => {
    expect(isOrderExportTerminalStatus('ready')).toBe(true);
    expect(isOrderExportTerminalStatus('failed')).toBe(true);
    expect(isOrderExportTerminalStatus('expired')).toBe(true);
    expect(isOrderExportTerminalStatus('pending')).toBe(false);
    expect(isOrderExportTerminalStatus('running')).toBe(false);
  });

  it('ne retient que les ids des demandes NON terminales', () => {
    const items = [
      fixtureExport({ id: 'a', status: 'pending' }),
      fixtureExport({ id: 'b', status: 'ready' }),
      fixtureExport({ id: 'c', status: 'running' }),
      fixtureExport({ id: 'd', status: 'failed' }),
      fixtureExport({ id: 'e', status: 'expired' }),
    ];
    expect(nonTerminalOrderExportIds(items)).toEqual(['a', 'c']);
  });
});

describe('nextOrderExportPollDelayMs — cadence pure (point 5)', () => {
  it('vaut la cadence normale sous une minute ecoulee', () => {
    expect(nextOrderExportPollDelayMs(0)).toBe(ORDER_EXPORT_POLL_INTERVAL_MS);
    expect(nextOrderExportPollDelayMs(ORDER_EXPORT_POLL_BACKOFF_AFTER_MS - 1)).toBe(ORDER_EXPORT_POLL_INTERVAL_MS);
  });

  it('espace au dela d une minute ecoulee', () => {
    expect(nextOrderExportPollDelayMs(ORDER_EXPORT_POLL_BACKOFF_AFTER_MS)).toBe(ORDER_EXPORT_POLL_BACKOFF_INTERVAL_MS);
    expect(nextOrderExportPollDelayMs(ORDER_EXPORT_POLL_BACKOFF_AFTER_MS + 120_000)).toBe(ORDER_EXPORT_POLL_BACKOFF_INTERVAL_MS);
  });
});

describe('startOrderExportPolling — orchestration a horloge simulee (point 5)', () => {
  it('interroge toutes les 2 s tant que le statut n est pas terminal', async () => {
    vi.useFakeTimers();
    try {
      const api = { get: vi.fn().mockResolvedValue(fixtureExport({ status: 'running' })) };
      const onUpdate = vi.fn();
      const handle = startOrderExportPolling('export-1', api, onUpdate, vi.fn());

      expect(api.get).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
      expect(api.get).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
      expect(api.get).toHaveBeenCalledTimes(2);

      handle.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('ESPACE les sondages au dela d une minute ecoulee depuis le PREMIER sondage', async () => {
    vi.useFakeTimers();
    try {
      const api = { get: vi.fn().mockResolvedValue(fixtureExport({ status: 'running' })) };
      const handle = startOrderExportPolling('export-1', api, vi.fn(), vi.fn());

      // Fait avancer jusqu a depasser la minute (30 sondages de 2 s = 60 s).
      for (let i = 0; i < 30; i += 1) {
        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
      }
      const callsAtOneMinute = api.get.mock.calls.length;

      // Le sondage suivant doit intervenir 10 s plus tard, pas 2 s : a +2 s,
      // aucun appel de plus.
      await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
      expect(api.get.mock.calls.length).toBe(callsAtOneMinute);

      // A +10 s au total, un sondage de plus est intervenu.
      await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_BACKOFF_INTERVAL_MS - ORDER_EXPORT_POLL_INTERVAL_MS);
      expect(api.get.mock.calls.length).toBe(callsAtOneMinute + 1);

      handle.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('S ARRETE D ELLE-MEME des qu un etat TERMINAL est rendu — aucun sondage de plus', async () => {
    // Mutation qui ferait tomber ce test : retirer la garde
    // `if (!isOrderExportTerminalStatus(item.status)) scheduleNext();`.
    vi.useFakeTimers();
    try {
      const api = { get: vi.fn().mockResolvedValue(fixtureExport({ status: 'ready' })) };
      const onUpdate = vi.fn();
      startOrderExportPolling('export-1', api, onUpdate, vi.fn());

      await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
      expect(api.get).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }));

      await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS * 5);
      expect(api.get).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('S ARRETE AU DEMONTAGE (stop()) — aucun sondage de plus, meme en cours de vol', async () => {
    // Mutation qui ferait tomber ce test : `stop()` qui ne pose pas `stopped = true`.
    vi.useFakeTimers();
    try {
      const api = { get: vi.fn().mockResolvedValue(fixtureExport({ status: 'running' })) };
      const handle = startOrderExportPolling('export-1', api, vi.fn(), vi.fn());

      await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
      expect(api.get).toHaveBeenCalledTimes(1);

      handle.stop();
      await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS * 10);
      expect(api.get).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  describe('MOYEN M1 (qa-review round 1) — un echec TRANSITOIRE ne fige plus le suivi', () => {
    it('un GET qui echoue UNE FOIS puis reussit aboutit a `ready`, sans intervention exterieure', async () => {
      // Sonde qa-review Q3, rejouee : avant ce correctif, `get` n etait
      // appelee qu une fois sur 120 s et `updates` restait vide — l export
      // affichait "En cours" a vie. Mutation qui ferait tomber ce test :
      // retirer `scheduleNext()` de la branche d echec du `tick()`.
      vi.useFakeTimers();
      try {
        const api = { get: vi.fn().mockRejectedValueOnce(new Error('reseau')).mockResolvedValue(fixtureExport({ status: 'ready' })) };
        const updates: string[] = [];
        startOrderExportPolling('e1', api, (item) => updates.push(item.status), vi.fn());

        await vi.advanceTimersByTimeAsync(120_000);

        expect(api.get.mock.calls.length).toBeGreaterThan(1);
        expect(updates).toEqual(['ready']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('notifie `onError` a CHAQUE echec, meme si le sondage reprend ensuite', async () => {
      vi.useFakeTimers();
      try {
        const api = { get: vi.fn().mockRejectedValueOnce(new Error('reseau')).mockResolvedValue(fixtureExport({ status: 'running' })) };
        const onError = vi.fn();
        const handle = startOrderExportPolling('e1', api, vi.fn(), onError);

        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
        expect(onError).toHaveBeenCalledWith('reseau');

        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
        expect(api.get).toHaveBeenCalledTimes(2);

        handle.stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('DEFAUT R3 (recette navigateur, 2026-09-15) : une COUPURE du suivi (TypeError de fetch) notifie un message FRANCAIS qui dit que la reprise est automatique', async () => {
      // AVANT ce correctif : `onError(cause instanceof Error ? cause.message
      // : ...)` aurait notifie LITTERALEMENT "Failed to fetch".
      vi.useFakeTimers();
      try {
        const api = {
          get: vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(fixtureExport({ status: 'running' })),
        };
        const onError = vi.fn();
        const handle = startOrderExportPolling('e1', api, vi.fn(), onError);

        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
        expect(onError).toHaveBeenCalledWith('Connexion perdue. Nouvel essai automatique…');

        handle.stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('respecte la MEME cadence apres un echec (2 s, pas un reessai immediat)', async () => {
      vi.useFakeTimers();
      try {
        const api = { get: vi.fn().mockRejectedValue(new Error('reseau')) };
        const handle = startOrderExportPolling('e1', api, vi.fn(), vi.fn());

        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
        expect(api.get).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS - 1);
        expect(api.get).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        expect(api.get).toHaveBeenCalledTimes(2);

        handle.stop();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('MOYEN M3 (qa-review round 1, S02/S03) — stop() PENDANT un GET en vol', () => {
    it('une reponse qui arrive APRES stop() ne declenche ni onUpdate ni nouveau sondage', async () => {
      // Mutation qui ferait tomber ce test : `stop()` qui ne pose pas
      // `stopped = true` (S02), ou le `.then()` de succes qui omet
      // `if (stopped) return;` avant `onUpdate` (S03).
      vi.useFakeTimers();
      try {
        let resolveSecondCall: ((item: OrderExportDto) => void) | undefined;
        const api = {
          get: vi
            .fn()
            .mockResolvedValueOnce(fixtureExport({ status: 'running' }))
            .mockImplementationOnce(() => new Promise<OrderExportDto>((resolve) => (resolveSecondCall = resolve))),
        };
        const onUpdate = vi.fn();
        const handle = startOrderExportPolling('e1', api, onUpdate, vi.fn());

        // Premier sondage : resout normalement, la deuxieme requete part.
        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
        expect(onUpdate).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
        expect(api.get).toHaveBeenCalledTimes(2);

        // Le DEUXIEME `get()` est encore EN VOL : on arrete le suivi maintenant.
        handle.stop();
        resolveSecondCall!(fixtureExport({ status: 'ready' }));
        await vi.advanceTimersByTimeAsync(0);
        await Promise.resolve();

        expect(onUpdate).toHaveBeenCalledTimes(1);
        // Et aucun nouveau sondage n a ete programme derriere cette reponse tardive.
        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS * 5);
        expect(api.get).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('BLOQUANT M1 (qa-review round 2, 2026-09-15) — arret DEFINITIF sur 401/403/404, borne de duree', () => {
    it('un GET rejetant en 404 donne exactement UN appel puis un onError, et le suivi s ARRETE (sonde qa-review round 2, 84 GET en 10 min avant ce correctif)', async () => {
      vi.useFakeTimers();
      try {
        const notFound = new ApiClientError({
          type: 'about:blank',
          title: 'Introuvable',
          status: 404,
          code: 'order_export.not_found',
          detail: 'Cette demande d’export n’existe plus.',
          requestId: 'req-1',
        });
        const api = { get: vi.fn().mockRejectedValue(notFound) };
        const onError = vi.fn();
        startOrderExportPolling('e1', api, vi.fn(), onError);

        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
        expect(api.get).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(notFound.message);

        // AVANT ce correctif : le sondage reprenait a la MEME cadence,
        // indefiniment (round 1, M1) — la sonde qa-review a compte 84 appels
        // en 10 minutes sur un 404 durable. Ici, aucun appel de plus, meme
        // 10 minutes plus tard.
        await vi.advanceTimersByTimeAsync(600_000);
        expect(api.get).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('idem en 403 : exactement UN appel puis un onError, arret du suivi', async () => {
      vi.useFakeTimers();
      try {
        const forbidden = new ApiClientError({
          type: 'about:blank',
          title: 'Interdit',
          status: 403,
          code: 'auth.forbidden',
          detail: 'Vous n’avez plus le droit de suivre cet export.',
          requestId: 'req-2',
        });
        const api = { get: vi.fn().mockRejectedValue(forbidden) };
        const onError = vi.fn();
        startOrderExportPolling('e1', api, vi.fn(), onError);

        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
        expect(api.get).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(600_000);
        expect(api.get).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    // qa-review round 3 (2026-09-15) — F1c : « retirer 401 des erreurs
    // fatales ne casse aucun test » etait vrai avant ce cas dedie (401
    // n etait exercee que via `resolveOrderExportPollingErrorMessage`
    // ailleurs, jamais via `startOrderExportPolling`). Mutation qui ferait
    // tomber CE test : retirer `401` de `ORDER_EXPORT_POLL_FATAL_STATUSES`.
    it('un 401 DURABLE : exactement UN appel puis un onError, arret du suivi (qa-review round 3, F1c)', async () => {
      vi.useFakeTimers();
      try {
        const unauthorized = new ApiClientError({
          type: 'about:blank',
          title: 'Non authentifie',
          status: 401,
          code: 'auth.session_expired',
          detail: 'Session expirée — reconnectez-vous.',
          requestId: 'req-4',
        });
        const api = { get: vi.fn().mockRejectedValue(unauthorized) };
        const onError = vi.fn();
        startOrderExportPolling('e1', api, vi.fn(), onError);

        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
        expect(api.get).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(unauthorized.message);

        await vi.advanceTimersByTimeAsync(600_000);
        expect(api.get).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('un 503 (transitoire) suivi de `ready` ABOUTIT — le suivi continue de reprendre sur une erreur serveur/reseau', async () => {
      vi.useFakeTimers();
      try {
        const serviceUnavailable = new ApiClientError({
          type: 'about:blank',
          title: 'Indisponible',
          status: 503,
          code: 'api.unavailable',
          detail: 'Service momentanément indisponible.',
          requestId: 'req-3',
        });
        const api = {
          get: vi.fn().mockRejectedValueOnce(serviceUnavailable).mockResolvedValue(fixtureExport({ status: 'ready' })),
        };
        const onUpdate = vi.fn();
        startOrderExportPolling('e1', api, onUpdate, vi.fn());

        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
        expect(api.get).toHaveBeenCalledTimes(1);
        expect(onUpdate).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
        expect(api.get).toHaveBeenCalledTimes(2);
        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }));

        // Etat TERMINAL atteint : aucun sondage de plus.
        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS * 5);
        expect(api.get).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    // qa-review round 3 (2026-09-15) — F2 : « ajouter 500 aux erreurs
    // fatales ne casse aucun test » etait vrai avant ce cas dedie (seul 503
    // etait exerce comme representant d une erreur serveur transitoire).
    // Mutation qui ferait tomber CE test : ajouter `500` a
    // `ORDER_EXPORT_POLL_FATAL_STATUSES` — le suivi s arreterait apres UN
    // seul appel au lieu de reprendre et d atteindre `ready` en DEUX appels.
    it('un 500 (transitoire) suivi de `ready` ABOUTIT en DEUX appels (qa-review round 3, F2)', async () => {
      vi.useFakeTimers();
      try {
        const internalError = new ApiClientError({
          type: 'about:blank',
          title: 'Erreur interne',
          status: 500,
          code: 'api.internal_error',
          detail: 'Erreur interne du serveur.',
          requestId: 'req-5',
        });
        const api = {
          get: vi.fn().mockRejectedValueOnce(internalError).mockResolvedValue(fixtureExport({ status: 'ready' })),
        };
        const onUpdate = vi.fn();
        startOrderExportPolling('e1', api, onUpdate, vi.fn());

        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
        expect(api.get).toHaveBeenCalledTimes(1);
        expect(onUpdate).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS);
        expect(api.get).toHaveBeenCalledTimes(2);
        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }));

        await vi.advanceTimersByTimeAsync(ORDER_EXPORT_POLL_INTERVAL_MS * 5);
        expect(api.get).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('l ECHEANCE de duree (10 min) arrete le suivi d une demande qui ne devient jamais terminale, et le SIGNALE', async () => {
      // Mutation qui ferait tomber ce test : retirer la verification de
      // duree dans `scheduleNext()`, ou l omettre du chemin de succes.
      vi.useFakeTimers();
      try {
        const api = { get: vi.fn().mockResolvedValue(fixtureExport({ status: 'running' })) };
        const onError = vi.fn();
        startOrderExportPolling('e1', api, vi.fn(), onError);

        // 30 sondages de 2 s = 60 s, puis des sondages de 10 s jusqu a 10 min.
        await vi.advanceTimersByTimeAsync(10 * 60_000);

        const callsAtTimeout = api.get.mock.calls.length;
        expect(callsAtTimeout).toBeGreaterThan(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0]![0]).toMatch(/10 minutes/);

        // Plus AUCUN appel apres l echeance, meme longtemps apres.
        await vi.advanceTimersByTimeAsync(600_000);
        expect(api.get.mock.calls.length).toBe(callsAtTimeout);
        expect(onError).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe('resolveOrderExportFailureMessage — les deux messages d echec (point 8)', () => {
  it('order_export.row_limit_exceeded invite a RESSERRER LA PERIODE, SANS AUCUN CHIFFRE', () => {
    // Mutation qui ferait tomber ce test : ecrire "2 500 lignes" ou "5000" dans le message.
    const message = resolveOrderExportFailureMessage('order_export.row_limit_exceeded', 'peu importe');
    expect(message).toMatch(/p[ée]riode/i);
    expect(message).not.toMatch(/\d/);
  });

  it('toute AUTRE erreur affiche error_detail TEL QUEL, sans reecriture', () => {
    const message = resolveOrderExportFailureMessage('order_export.generation_failed', 'Bibliotheque XLSX indisponible');
    expect(message).toBe('Bibliotheque XLSX indisponible');
  });

  it('un error_detail absent retombe sur un message generique, jamais une chaine vide', () => {
    expect(resolveOrderExportFailureMessage('order_export.storage_failed', null)).toBe('Échec de la génération de l’export.');
  });
});

describe('resolveOrderExportUnreachableMessage — DEFAUT R3 (recette navigateur, 2026-09-15) : panne reseau vs echec HTTP deja repondu', () => {
  const options = { genericMessage: 'generique', networkMessage: 'reseau-fr' };

  it('une TypeError (rejet de fetch(), ex. "Failed to fetch") donne le texte FRANCAIS fourni par l appelant', () => {
    // AVANT ce correctif : le texte ANGLAIS du navigateur (`cause.message`)
    // etait affiche tel quel — ce test tombe sur l ancien code
    // (`cause instanceof Error ? cause.message : ...`), qui aurait rendu
    // "Failed to fetch" au lieu de "reseau-fr".
    const cause = new TypeError('Failed to fetch');
    expect(resolveOrderExportUnreachableMessage(cause, options)).toBe('reseau-fr');
  });

  it('une TypeError avec un AUTRE texte de navigateur (Firefox/Safari) recoit AUSSI le texte francais : seul le TYPE compte, jamais le texte', () => {
    const firefox = new TypeError('NetworkError when attempting to fetch resource.');
    const safari = new TypeError('Load failed');
    expect(resolveOrderExportUnreachableMessage(firefox, options)).toBe('reseau-fr');
    expect(resolveOrderExportUnreachableMessage(safari, options)).toBe('reseau-fr');
  });

  it('une ApiClientError garde SON message (deja francais, pose par le serveur), INCHANGE', () => {
    const cause = new ApiClientError({
      type: 'about:blank',
      title: 'Trop de demandes en file',
      status: 422,
      code: 'order_export.pending_limit_reached',
      detail: "Vous avez déjà trois demandes d'export en cours.",
      requestId: 'req-1',
    });
    expect(resolveOrderExportUnreachableMessage(cause, options)).toBe(cause.message);
    expect(resolveOrderExportUnreachableMessage(cause, options)).not.toBe(options.networkMessage);
  });

  it('une Error QUELCONQUE (ni ApiClientError ni TypeError) garde SON message, comportement INCHANGE', () => {
    expect(resolveOrderExportUnreachableMessage(new Error('reseau'), options)).toBe('reseau');
  });

  it('une valeur qui n est meme pas une Error recoit le message generique', () => {
    expect(resolveOrderExportUnreachableMessage('boom', options)).toBe('generique');
    expect(resolveOrderExportUnreachableMessage(undefined, options)).toBe('generique');
  });
});

describe('describeOrderExportStatus — table STATUT -> AFFICHAGE (point 2)', () => {
  it.each([
    ['pending', 'En attente', 'pending'],
    ['running', 'En cours', 'pending'],
    ['ready', 'Prêt', 'success'],
    ['expired', 'Expiré', 'neutral'],
  ] as const)('status=%s -> label=%s, tone=%s, aucun message', (status, label, tone) => {
    const display = describeOrderExportStatus(fixtureExport({ status, error_code: null, error_detail: null }));
    expect(display).toEqual({ label, tone, message: null });
  });

  it('failed porte le message resolu depuis error_code/error_detail', () => {
    const display = describeOrderExportStatus(
      fixtureExport({ status: 'failed', error_code: 'order_export.row_limit_exceeded', error_detail: 'x' }),
    );
    expect(display.label).toBe('Échec');
    expect(display.tone).toBe('error');
    expect(display.message).not.toBeNull();
    expect(display.message).not.toMatch(/\d/);
  });
});

describe('resolveOrderExportDownloadState — les TROIS cas de download_url:null + le cas disponible', () => {
  it('pending/running -> not_ready', () => {
    expect(resolveOrderExportDownloadState(fixtureExport({ status: 'pending', download_url: null })).kind).toBe('not_ready');
    expect(resolveOrderExportDownloadState(fixtureExport({ status: 'running', download_url: null })).kind).toBe('not_ready');
  });

  it('expired -> expired', () => {
    expect(resolveOrderExportDownloadState(fixtureExport({ status: 'expired', download_url: null })).kind).toBe('expired');
  });

  it('ready SANS download_url -> not_requester (download_url NUL pour un non-demandeur)', () => {
    // Mutation qui ferait tomber ce test : rendre `available` avec une url `null`/`undefined`.
    const state = resolveOrderExportDownloadState(fixtureExport({ status: 'ready', download_url: null }));
    expect(state).toEqual({ kind: 'not_requester' });
  });

  it('ready AVEC download_url -> available, url portee TELLE QUELLE', () => {
    const state = resolveOrderExportDownloadState(
      fixtureExport({ status: 'ready', download_url: 'https://storage.test/fichier.xlsx' }),
    );
    expect(state).toEqual({ kind: 'available', url: 'https://storage.test/fichier.xlsx' });
  });

  it('failed est distingue des trois cas de "pas pret" (jamais confondu avec not_ready)', () => {
    expect(resolveOrderExportDownloadState(fixtureExport({ status: 'failed', download_url: null })).kind).toBe('failed');
  });
});

describe('refreshOrderExportDownloadUrl — reemission de l URL au clic (point 7)', () => {
  it('rend une URL FRAICHE lue par get(), jamais une valeur en cache', async () => {
    const api = { get: vi.fn().mockResolvedValue(fixtureExport({ status: 'ready', download_url: 'https://storage.test/fresh' })) };

    const result = await refreshOrderExportDownloadUrl(api, 'export-1');

    expect(api.get).toHaveBeenCalledWith('export-1');
    expect(result.url).toBe('https://storage.test/fresh');
  });

  it('rend url:null si l export n est plus disponible (expire entre-temps)', async () => {
    const api = { get: vi.fn().mockResolvedValue(fixtureExport({ status: 'expired', download_url: null })) };

    const result = await refreshOrderExportDownloadUrl(api, 'export-1');

    expect(result.url).toBeNull();
  });

  it('ignore un download_url RESIDUEL quand le statut n est pas ready (le raw ne suffit pas — L03/L04)', async () => {
    // Mutation qui ferait tomber ce test : `return { item, url: item.download_url };`
    // (recopie brute) au lieu de passer par `resolveOrderExportDownloadState`.
    const api = { get: vi.fn().mockResolvedValue(fixtureExport({ status: 'expired', download_url: 'https://storage.test/stale' })) };

    const result = await refreshOrderExportDownloadUrl(api, 'export-1');

    expect(result.url).toBeNull();
  });
});

describe('CAN_EXPORT_ORDERS — MOYEN V02 (qa-review round 1)', () => {
  it('vaut exactement `can_export_orders` (contrat, x-magrit-capabilities)', () => {
    // Mutation qui ferait tomber ce test : une faute de frappe sur cette
    // constante (ex. `can_export_order`, sans le `s` final) masquerait le
    // bouton/panneau a TOUT LE MONDE, en silence, sans qu aucune gate ne le
    // voie — c est exactement ce qui s est produit avant ce correctif (la
    // constante vivait, non testee, dans `OrderExportPanel.tsx`).
    expect(CAN_EXPORT_ORDERS).toBe('can_export_orders');
  });
});

describe('describeOrderExportDownload — BLOQUANT B2 (qa-review round 1) : table PURE, source unique des libelles', () => {
  it.each([
    ['pending' as const, null, 'not_ready', '—', false],
    ['running' as const, null, 'not_ready', '—', false],
    ['failed' as const, null, 'failed', '—', false],
    // DEFAUT R4, recette navigateur (2026-09-15) : AVANT ce correctif, ce cas
    // valait `'Expiré'` — DOUBLON avec le libelle de STATUT (« Expiré ») deja
    // rendu par `describeOrderExportStatus()` pour la MEME ligne : la colonne
    // Statut ET la colonne Telechargement affichaient toutes les deux
    // « Expiré » (« ... Expiré Expiré » releve en recette). Desormais un
    // tiret, comme les deux autres cas non telechargeables ci-dessus.
    ['expired' as const, null, 'expired', '—', false],
    ['ready' as const, null, 'not_requester', 'Demandé par un autre membre', false],
    ['ready' as const, 'https://storage.test/f.xlsx', 'available', 'Télécharger', true],
  ])('status=%s, download_url=%s -> kind=%s, label=%s, downloadable=%s', (status, downloadUrl, kind, label, downloadable) => {
    // Mutation qui ferait tomber ce test : permuter les libelles "—"/
    // "Demandé par un autre membre" dans `ORDER_EXPORT_DOWNLOAD_LABELS`
    // (D04), ou exposer une url via ce descripteur.
    const display = describeOrderExportDownload(fixtureExport({ status, download_url: downloadUrl }));
    expect(display).toEqual({ kind, label, downloadable });
    expect(display).not.toHaveProperty('url');
  });
});

describe('describeOrderExportRow — BLOQUANT B2 (qa-review round 1) : descripteur de ligne UNIQUE, source ORDER_EXPORT_*_OPTIONS', () => {
  it('le libelle de granularite vient de ORDER_EXPORT_GRANULARITY_OPTIONS, pas d un ternaire local (D05)', () => {
    // Mutation qui ferait tomber ce test : inverser les deux branches d un
    // ternaire ecrit a la main (D05) — impossible ici, il n y a plus de
    // ternaire local, seulement une lecture de la table partagee avec la
    // modale.
    const rowOrder = describeOrderExportRow(fixtureExport({ granularity: 'order' }));
    const rowLine = describeOrderExportRow(fixtureExport({ granularity: 'line' }));
    expect(rowOrder.granularityLabel).toBe(
      ORDER_EXPORT_GRANULARITY_OPTIONS.find((option) => option.value === 'order')!.label,
    );
    expect(rowLine.granularityLabel).toBe(
      ORDER_EXPORT_GRANULARITY_OPTIONS.find((option) => option.value === 'line')!.label,
    );
    expect(rowOrder.granularityLabel).not.toBe(rowLine.granularityLabel);
  });

  it('le libelle de format vient de ORDER_EXPORT_FORMAT_OPTIONS', () => {
    const rowXlsx = describeOrderExportRow(fixtureExport({ format: 'xlsx' }));
    const rowCsv = describeOrderExportRow(fixtureExport({ format: 'csv' }));
    expect(rowXlsx.formatLabel).toBe(ORDER_EXPORT_FORMAT_OPTIONS.find((option) => option.value === 'xlsx')!.label);
    expect(rowCsv.formatLabel).toBe(ORDER_EXPORT_FORMAT_OPTIONS.find((option) => option.value === 'csv')!.label);
  });

  it('requestedByLabel retombe sur un tiret quand requested_by_label est nul', () => {
    expect(describeOrderExportRow(fixtureExport({ requested_by_label: null })).requestedByLabel).toBe('—');
  });

  it('combine statut ET telechargement dans le MEME descripteur (une seule lecture pour le JSX)', () => {
    const row = describeOrderExportRow(fixtureExport({ status: 'ready', download_url: 'https://storage.test/f.xlsx' }));
    expect(row.status.label).toBe('Prêt');
    expect(row.download.downloadable).toBe(true);
  });

  describe('DEFAUT R4 (recette navigateur, 2026-09-15) — le mot du statut ne se repete pas dans la colonne telechargement', () => {
    it('un export EXPIRE affiche "Expiré" une seule fois (statut), pas dans la colonne telechargement', () => {
      // AVANT ce correctif : `row.download.label` valait AUSSI 'Expiré' —
      // la ligne affichait "... Expiré Expiré" (releve en recette
      // navigateur : « Excel (XLSX) · Une ligne par commande
      // recette.admin@magrit.local Expiré Expiré »).
      const row = describeOrderExportRow(fixtureExport({ status: 'expired', download_url: null }));
      expect(row.status.label).toBe('Expiré');
      expect(row.download.label).not.toBe('Expiré');
      expect(row.download.label).toBe('—');
    });

    it('un export PRET demande par un AUTRE membre reste INCHANGE : "Prêt" (statut) puis "Demandé par un autre membre" (telechargement)', () => {
      // Cas EXPLICITEMENT preserve par la consigne : ce n est PAS une
      // repetition (deux informations distinctes), ne pas le confondre avec
      // le cas `expired` ci-dessus.
      const row = describeOrderExportRow(fixtureExport({ status: 'ready', download_url: null }));
      expect(row.status.label).toBe('Prêt');
      expect(row.download.label).toBe('Demandé par un autre membre');
    });
  });
});
