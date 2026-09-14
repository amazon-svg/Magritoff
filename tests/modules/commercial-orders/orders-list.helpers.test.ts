/**
 * Tests unitaires des helpers PURS de la grille des commandes (E10.18a,
 * etendus E10.18e-1, DURCIS en qa-review round 1 puis round 2, 2026-09-14)
 * — aucune dependance React, aucun appel reseau reel, aucun calcul de
 * prix/seuil.
 *
 * Regle opposable (docs/api/CONVENTIONS.md §8.24 point 8, consigne e-1
 * point 10, rappelee par la qa-review) : chaque test doit ECHOUER sur le
 * code d avant sa correction — chaque `describe`/cas porte en commentaire
 * la mutation qui le ferait tomber.
 */
import { describe, expect, it, vi } from 'vitest';
import type { CommercialOrderDto } from '@/modules/commercial-orders/api/contracts';
import { TEST_IDS } from '@/shared/presentation/testIds';
import {
  buildCellContext,
  buildInitialLoadRequest,
  buildLoadMoreRequest,
  buildOrdersListQuery,
  canLoadMore,
  customerFilterCleared,
  customerFilterSelected,
  DEFAULT_ORDERS_LIST_FILTERS,
  DEFAULT_ORDERS_LIST_SORT,
  formatOrderCreatedAt,
  formatOrderMoney,
  formatProductionStepLabel,
  handleOrdersListFilterChange,
  hasActiveOrdersListFilters,
  INITIAL_ORDERS_LIST_STATE,
  loadMoreOrders,
  loadOrdersListPage,
  loadOrdersListStepsAction,
  loadProductionStepCatalog,
  missingCustomerIds,
  ORDERS_LIST_COLUMNS,
  ORDERS_LIST_FILTERS,
  ORDERS_LIST_PAGE_SIZE,
  ORDERS_LIST_SORT_OPTIONS,
  ordersListReducer,
  planLoadMore,
  requestMoreOrders,
  resolveCurrentProductionStepLabel,
  type OrdersListCellContext,
  type OrdersListFilters,
  type OrdersListState,
} from '@/modules/commercial-orders/ui/workspace/orders-list.helpers';

const T = TEST_IDS.commercialOrder;

function fixtureOrder(overrides: Partial<CommercialOrderDto> = {}): CommercialOrderDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenant_id: '22222222-2222-4222-8222-222222222222',
    customer_id: '33333333-3333-4333-8333-333333333333',
    quote_id: '44444444-4444-4444-8444-444444444444',
    number: 'CDE-2026-00001',
    status: 'validated',
    source_quote_status: 'accepted',
    current_production_step_id: null,
    totals: {
      lines_subtotal: '10.00',
      global_discount: '0.00',
      effective_discount_rate: null,
      net_total: '10.00',
      vat_rate: '0.2000',
      vat_regime: null,
      vat_amount: '2.00',
      total_incl_tax: '12.00',
    },
    created_by: null,
    created_at: '2026-08-31T22:30:00.000Z',
    updated_at: '2026-08-31T22:30:00.000Z',
    ...overrides,
  };
}

function fixtureState(overrides: Partial<OrdersListState> = {}): OrdersListState {
  return { ...INITIAL_ORDERS_LIST_STATE, ...overrides };
}

function fixtureStep(overrides: Partial<{ id: string; label: string; position: number; is_active: boolean }> = {}) {
  return {
    id: 'step-1',
    tenant_id: 't1',
    label: 'Impression',
    position: 0,
    color: 'blue',
    is_terminal: false,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildOrdersListQuery', () => {
  it('omet toutes les cles quand l etat est celui par defaut', () => {
    expect(buildOrdersListQuery(DEFAULT_ORDERS_LIST_FILTERS)).toEqual({});
  });

  it('ne porte que la periode quand seule la periode est renseignee', () => {
    const filters: OrdersListFilters = { ...DEFAULT_ORDERS_LIST_FILTERS, createdFrom: '2026-09-01', createdTo: '2026-09-30' };
    expect(buildOrdersListQuery(filters)).toEqual({ createdFrom: '2026-09-01', createdTo: '2026-09-30' });
  });

  it('transmet le client selectionne sous `customerId`', () => {
    const filters: OrdersListFilters = { ...DEFAULT_ORDERS_LIST_FILTERS, customerId: 'cust-1' };
    expect(buildOrdersListQuery(filters)).toEqual({ customerId: 'cust-1' });
  });

  it('transmet l etape de production sous `currentProductionStepId`', () => {
    const filters: OrdersListFilters = { ...DEFAULT_ORDERS_LIST_FILTERS, productionStepId: 'step-1' };
    expect(buildOrdersListQuery(filters)).toEqual({ currentProductionStepId: 'step-1' });
  });

  it('transmet le tri uniquement quand il differe du defaut', () => {
    expect(buildOrdersListQuery({ ...DEFAULT_ORDERS_LIST_FILTERS, sort: 'production_step' })).toEqual({
      sort: 'production_step',
    });
    expect(buildOrdersListQuery({ ...DEFAULT_ORDERS_LIST_FILTERS, sort: '-production_step' })).toEqual({
      sort: '-production_step',
    });
  });

  it('combine tous les axes a la fois, sans en perdre aucun', () => {
    const filters: OrdersListFilters = {
      createdFrom: '2026-09-01',
      createdTo: '2026-09-30',
      customerId: 'cust-1',
      productionStepId: 'step-1',
      sort: '-production_step',
    };
    expect(buildOrdersListQuery(filters)).toEqual({
      createdFrom: '2026-09-01',
      createdTo: '2026-09-30',
      customerId: 'cust-1',
      currentProductionStepId: 'step-1',
      sort: '-production_step',
    });
  });

  it('ne transmet jamais une chaine vide ou uniquement des espaces sur aucun axe', () => {
    const filters: OrdersListFilters = {
      createdFrom: '   ',
      createdTo: '2026-09-30',
      customerId: '  ',
      productionStepId: '',
      sort: DEFAULT_ORDERS_LIST_SORT,
    };
    expect(buildOrdersListQuery(filters)).toEqual({ createdTo: '2026-09-30' });
  });
});

describe('buildInitialLoadRequest / buildLoadMoreRequest', () => {
  it('la requete de premiere page ne porte jamais de curseur, quel que soit l etat des filtres', () => {
    const filters: OrdersListFilters = { ...DEFAULT_ORDERS_LIST_FILTERS, customerId: 'cust-1', sort: 'production_step' };
    const request = buildInitialLoadRequest(filters, 50);
    expect(request.pageCursor).toBeUndefined();
    expect(request).toEqual({ customerId: 'cust-1', sort: 'production_step', pageSize: 50 });
  });

  it('la requete de page suivante porte le curseur fourni, en plus des filtres courants', () => {
    const filters: OrdersListFilters = { ...DEFAULT_ORDERS_LIST_FILTERS, createdFrom: '2026-09-01' };
    const request = buildLoadMoreRequest(filters, 50, 'cursor-abc');
    expect(request).toEqual({ createdFrom: '2026-09-01', pageSize: 50, pageCursor: 'cursor-abc' });
  });
});

describe('ORDERS_LIST_PAGE_SIZE', () => {
  it('vaut 50 (decision d Arnaud, §8.24 point 3)', () => {
    expect(ORDERS_LIST_PAGE_SIZE).toBe(50);
  });
});

describe('ORDERS_LIST_SORT_OPTIONS — tri expose a l ecran', () => {
  it('expose le defaut et le tri par etape dans les deux sens, jamais `created_at` croissant seul', () => {
    expect(ORDERS_LIST_SORT_OPTIONS.map((o) => o.value)).toEqual(['-created_at', 'production_step', '-production_step']);
  });
});

describe('formatProductionStepLabel / resolveCurrentProductionStepLabel', () => {
  const active = { label: 'Impression', is_active: true };
  const disabled = { label: 'Massicot', is_active: false };

  it('rend le libelle nu pour une etape active', () => {
    expect(formatProductionStepLabel(active)).toBe('Impression');
  });

  it('signale une etape desactivee, sans jamais la confondre avec une etape active', () => {
    expect(formatProductionStepLabel(disabled)).toBe('Massicot (désactivée)');
  });

  it('affiche un tiret pour une commande sans etape courante (null)', () => {
    expect(resolveCurrentProductionStepLabel(null, new Map())).toBe('—');
  });

  it('affiche un tiret si l etape referencee est absente de la collection chargee', () => {
    expect(resolveCurrentProductionStepLabel('step-missing', new Map())).toBe('—');
  });

  it('resout le libelle d une etape active a partir de la collection chargee', () => {
    const stepsById = new Map([['step-1', active]]);
    expect(resolveCurrentProductionStepLabel('step-1', stepsById)).toBe('Impression');
  });

  it('resout et signale le libelle d une etape DESACTIVEE sur laquelle une commande reste posee', () => {
    const stepsById = new Map([['step-2', disabled]]);
    expect(resolveCurrentProductionStepLabel('step-2', stepsById)).toBe('Massicot (désactivée)');
  });
});

describe('formatOrderMoney — aucune conversion en nombre', () => {
  it('rend le montant serveur tel quel, suffixe du symbole monetaire', () => {
    expect(formatOrderMoney('1234.5')).toBe('1234.5 €');
    expect(formatOrderMoney('0.00')).toBe('0.00 €');
    expect(formatOrderMoney('90000.00')).toBe('90000.00 €');
  });
});

describe('formatOrderCreatedAt', () => {
  it('affiche la date/heure dans le fuseau de reference Europe/Paris, jamais UTC', () => {
    const formatted = formatOrderCreatedAt('2026-08-31T22:30:00.000Z');
    expect(formatted).toContain('01/09/2026');
  });
});

describe('ORDERS_LIST_COLUMNS — descripteurs UNIQUES pour en-tetes, cellules ET lien (qa-review round 1 M1, round 2 N01)', () => {
  it('expose exactement les six colonnes, dans cet ordre', () => {
    expect(ORDERS_LIST_COLUMNS.map((c) => c.header)).toEqual([
      'N°',
      'Client',
      'Créée le',
      'Étape de production',
      'Net HT',
      'Total TTC',
    ]);
  });

  it('rend exactement les six cellules attendues pour une commande fixture (net different du TTC, etape nulle)', () => {
    const order = fixtureOrder({ number: 'CDE-2026-00042' });
    const ctx: OrdersListCellContext = { stepsById: new Map(), customerLabel: () => 'Client Test' };
    expect(ORDERS_LIST_COLUMNS.map((c) => c.cell(order, ctx))).toEqual([
      'CDE-2026-00042',
      'Client Test',
      formatOrderCreatedAt(order.created_at),
      '—',
      '10.00 €',
      '12.00 €',
    ]);
  });

  it('distingue reellement Net HT de Total TTC : une fixture ou les deux DIFFERENT prouve qu aucune colonne ne lit l autre champ', () => {
    const order = fixtureOrder({
      totals: {
        lines_subtotal: '100.00',
        global_discount: '10.00',
        effective_discount_rate: '0.1000',
        net_total: '90.00',
        vat_rate: '0.2000',
        vat_regime: null,
        vat_amount: '18.00',
        total_incl_tax: '108.00',
      },
    });
    const ctx: OrdersListCellContext = { stepsById: new Map(), customerLabel: () => 'X' };
    const [, , , , netHt, totalTtc] = ORDERS_LIST_COLUMNS.map((c) => c.cell(order, ctx));
    expect(netHt).toBe('90.00 €');
    expect(totalTtc).toBe('108.00 €');
  });

  it('affiche le libelle d etape (avec suffixe si desactivee) via le meme contexte que le filtre', () => {
    const order = fixtureOrder({ current_production_step_id: 'step-9' });
    const ctx: OrdersListCellContext = {
      stepsById: new Map([['step-9', { label: 'Massicot', is_active: false }]]),
      customerLabel: () => 'X',
    };
    const stepColumn = ORDERS_LIST_COLUMNS[3];
    expect(stepColumn.header).toBe('Étape de production');
    expect(stepColumn.cell(order, ctx)).toBe('Massicot (désactivée)');
  });

  it('seule la colonne N° porte un lien (round 2, N01) — une permutation de colonnes ne peut plus deplacer le lien', () => {
    // Mutation qui ferait tomber ce test : deplacer `linkTo` sur une autre
    // entree du tableau (ex. la colonne Client), ou en ajouter un second.
    const withLink = ORDERS_LIST_COLUMNS.filter((c) => c.linkTo);
    expect(withLink).toHaveLength(1);
    expect(withLink[0]!.header).toBe('N°');
  });

  it('le lien de la colonne N° pointe vers la fiche de la commande', () => {
    const order = fixtureOrder({ id: 'order-42' });
    expect(ORDERS_LIST_COLUMNS[0]!.linkTo!(order)).toBe('commercial-orders/order-42');
  });
});

describe('buildCellContext — repli sur un tiret, jamais l identifiant technique (qa-review round 2, N19 ; round 3, X27)', () => {
  it('rend un tiret pour un client encore inconnu du cache', () => {
    // Mutation qui ferait tomber ce test : replier sur `customerId` au lieu
    // de `'—'` quand le client n est pas dans `customersById`.
    const ctx = buildCellContext(new Map(), new Map());
    expect(ctx.customerLabel('unknown-customer-id')).toBe('—');
  });

  it('X27 — calcule le libelle d affichage LUI-MEME (customerDisplayName), jamais depuis un libelle deja calcule dans la page', () => {
    // Mutation qui ferait tomber ce test : la page (ou cette fonction)
    // indexant les clients par leur identifiant brut au lieu de leur nom
    // affichable (X27 : `[id, id]` au lieu de `[id, customerDisplayName(c)]`).
    const ctx = buildCellContext(
      new Map(),
      new Map([['cust-1', { type: 'company', company_name: 'Client Un SARL', first_name: null, last_name: null }]]),
    );
    expect(ctx.customerLabel('cust-1')).toBe('Client Un SARL');
  });

  it('calcule aussi le libelle d un particulier (prenom + nom)', () => {
    const ctx = buildCellContext(
      new Map(),
      new Map([['cust-2', { type: 'individual', company_name: null, first_name: 'Jean', last_name: 'Dupont' }]]),
    );
    expect(ctx.customerLabel('cust-2')).toBe('Jean Dupont');
  });

  it('transmet le catalogue d etapes tel quel', () => {
    const stepsById = new Map([['step-1', { label: 'Impression', is_active: true }]]);
    const ctx = buildCellContext(stepsById, new Map());
    expect(ctx.stepsById).toBe(stepsById);
  });
});

describe('hasActiveOrdersListFilters', () => {
  it('est faux quand aucun filtre (hors tri) n est renseigne', () => {
    expect(hasActiveOrdersListFilters(DEFAULT_ORDERS_LIST_FILTERS)).toBe(false);
  });

  it('est vrai des qu un seul axe est renseigne, quel qu il soit', () => {
    expect(hasActiveOrdersListFilters({ ...DEFAULT_ORDERS_LIST_FILTERS, createdFrom: '2026-09-01' })).toBe(true);
    expect(hasActiveOrdersListFilters({ ...DEFAULT_ORDERS_LIST_FILTERS, createdTo: '2026-09-30' })).toBe(true);
    expect(hasActiveOrdersListFilters({ ...DEFAULT_ORDERS_LIST_FILTERS, customerId: 'cust-1' })).toBe(true);
    expect(hasActiveOrdersListFilters({ ...DEFAULT_ORDERS_LIST_FILTERS, productionStepId: 'step-1' })).toBe(true);
  });

  it('un tri non-defaut seul ne compte pas comme un filtre actif', () => {
    expect(hasActiveOrdersListFilters({ ...DEFAULT_ORDERS_LIST_FILTERS, sort: 'production_step' })).toBe(false);
  });
});

describe('loadProductionStepCatalog (qa-review round 1, M2/m3)', () => {
  it('appelle `list` SANS argument de statut', async () => {
    const list = vi.fn().mockResolvedValue({ data: [], etag: null });
    await loadProductionStepCatalog({ list });
    expect(list).toHaveBeenCalledWith();
  });

  it('garde les etapes desactivees et les trie par position', async () => {
    const stepActive = fixtureStep({ id: 's-active', label: 'Impression', position: 1, is_active: true });
    const stepDisabled = fixtureStep({ id: 's-disabled', label: 'Massicot', position: 0, is_active: false });
    const list = vi.fn().mockResolvedValue({ data: [stepActive, stepDisabled], etag: null });

    const result = await loadProductionStepCatalog({ list });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.catalog.ordered.map((s) => s.id)).toEqual(['s-disabled', 's-active']);
    expect(result.catalog.byId.get('s-disabled')).toEqual(stepDisabled);
  });

  it('rend un resultat `ok:false` distinct, jamais une exception, si le catalogue ne charge pas', async () => {
    const list = vi.fn().mockRejectedValue(new Error('boom'));
    const result = await loadProductionStepCatalog({ list });
    expect(result).toEqual({ ok: false, error: 'boom' });
  });
});

describe('loadOrdersListStepsAction — combine le chargement et le choix de l action (qa-review round 2, N10)', () => {
  it('rend `stepsLoaded` avec le catalogue quand le chargement reussit', async () => {
    const stepActive = fixtureStep({ id: 's1' });
    const list = vi.fn().mockResolvedValue({ data: [stepActive], etag: null });

    const action = await loadOrdersListStepsAction({ list });

    expect(action.type).toBe('stepsLoaded');
    if (action.type !== 'stepsLoaded') throw new Error('unreachable');
    expect(action.catalog.ordered.map((s) => s.id)).toEqual(['s1']);
  });

  it('rend `stepsFailed` avec le message d erreur reel quand le chargement echoue — jamais avale (N10)', async () => {
    // Mutation qui ferait tomber ce test : rendre `stepsLoaded` avec un
    // catalogue vide au lieu de `stepsFailed`, ou vider le message d erreur.
    const list = vi.fn().mockRejectedValue(new Error('catalogue indisponible'));

    const action = await loadOrdersListStepsAction({ list });

    expect(action).toEqual({ type: 'stepsFailed', error: 'catalogue indisponible' });
  });
});

describe('ORDERS_LIST_FILTERS / handleOrdersListFilterChange (qa-review round 2, condition (b1) — R08b/R32/N16/R14b/R15b/N15 ; DURCI round 3)', () => {
  it('X05/X06 — chaque descripteur porte exactement le testId, le kind et le libelle attendus, CLIENT COMPRIS (table unique)', () => {
    // Mutation qui ferait tomber ce test : permuter les testId d etape et de
    // tri (X05), ou donner au filtre etape le kind 'date' au lieu de
    // 'select' (X06), ou tout ecart sur le filtre client desormais integre
    // au meme tableau (round 3, condition (b1)).
    expect(ORDERS_LIST_FILTERS.map((f) => [f.id, f.kind, f.testId, f.label ?? null, f.align ?? null])).toEqual([
      ['createdFrom', 'date', T.listCreatedFromInput, 'Du', null],
      ['createdTo', 'date', T.listCreatedToInput, 'Au', null],
      ['customerId', 'customer-search', T.listCustomerFilter, null, null],
      ['productionStepId', 'select', T.listStepFilter, null, null],
      ['sort', 'select', T.listSortSelect, null, 'end'],
    ]);
  });

  it('expose exactement cinq filtres : periode (deux bornes), client, etape, tri', () => {
    expect(ORDERS_LIST_FILTERS.map((f) => f.id)).toEqual(['createdFrom', 'createdTo', 'customerId', 'productionStepId', 'sort']);
  });

  it('lit la valeur courante depuis l etat, un filtre a la fois, client compris', () => {
    const state = fixtureState({
      filters: { createdFrom: '2026-09-01', createdTo: '2026-09-30', customerId: 'cust-1', productionStepId: 'step-1', sort: 'production_step' },
    });
    const byId = Object.fromEntries(ORDERS_LIST_FILTERS.map((f) => [f.id, f.read(state)]));
    expect(byId).toEqual({
      createdFrom: '2026-09-01',
      createdTo: '2026-09-30',
      customerId: 'cust-1',
      productionStepId: 'step-1',
      sort: 'production_step',
    });
  });

  it('round 3 (condition (b1)) — le filtre client dispatche customerSelected/customerCleared via la MEME fonction generique que les autres filtres', () => {
    // Mutation qui ferait tomber ce test : `toAction` du descripteur
    // `customerId` ignorant la selection ou perdant le libelle (equivalent
    // de N14 deplace sur le descripteur plutot que sur la page).
    const dispatch = vi.fn();
    handleOrdersListFilterChange(dispatch, ORDERS_LIST_FILTERS, 'customerId', { customerId: 'cust-9', label: 'Client Neuf' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'customerSelected', customerId: 'cust-9', label: 'Client Neuf' });

    dispatch.mockClear();
    handleOrdersListFilterChange(dispatch, ORDERS_LIST_FILTERS, 'customerId', null);
    expect(dispatch).toHaveBeenCalledWith({ type: 'customerCleared' });
  });

  it('dispatch la bonne action pour le filtre identifie par id, jamais un autre (R32 — le tri dispatche bien `filtersChanged` avec `sort`)', () => {
    // Mutation qui ferait tomber ce test : un `onChange` de tri qui ne
    // dispatche rien (R32) ne peut plus exister a cote de ce point unique —
    // et une regression dans `handleOrdersListFilterChange`/`toAction` du
    // descripteur `sort` est directement detectee ici.
    const dispatch = vi.fn();
    handleOrdersListFilterChange(dispatch, ORDERS_LIST_FILTERS, 'sort', 'production_step');
    expect(dispatch).toHaveBeenCalledWith({ type: 'filtersChanged', patch: { sort: 'production_step' } });
  });

  it('N16 — le filtre "Du" (createdFrom) ne peut jamais ecrire dans createdTo, et reciproquement', () => {
    // Mutation qui ferait tomber ce test : `toAction` du descripteur
    // `createdFrom` ecrivant `patch: { createdTo: value }` (N16).
    const dispatch = vi.fn();
    handleOrdersListFilterChange(dispatch, ORDERS_LIST_FILTERS, 'createdFrom', '2026-09-01');
    expect(dispatch).toHaveBeenCalledWith({ type: 'filtersChanged', patch: { createdFrom: '2026-09-01' } });
    dispatch.mockClear();
    handleOrdersListFilterChange(dispatch, ORDERS_LIST_FILTERS, 'createdTo', '2026-09-30');
    expect(dispatch).toHaveBeenCalledWith({ type: 'filtersChanged', patch: { createdTo: '2026-09-30' } });
  });

  it('R08b — le filtre etape transmet la valeur RECUE, jamais une chaine vide codee en dur', () => {
    // Mutation qui ferait tomber ce test : `toAction` du descripteur
    // `productionStepId` ignorant `value` et posant toujours `''`.
    const dispatch = vi.fn();
    handleOrdersListFilterChange(dispatch, ORDERS_LIST_FILTERS, 'productionStepId', 'step-9');
    expect(dispatch).toHaveBeenCalledWith({ type: 'filtersChanged', patch: { productionStepId: 'step-9' } });
  });

  it('ne dispatche rien pour un identifiant de filtre inconnu', () => {
    const dispatch = vi.fn();
    handleOrdersListFilterChange(dispatch, ORDERS_LIST_FILTERS, 'unknown', 'x');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('R14b/R15b — les options d etape gardent les etapes desactivees (signalees) et suivent l ordre de position, jamais celui de `byId`', () => {
    // Mutation qui ferait tomber ce test : construire les options depuis
    // `stepCatalog.byId` (ordre d insertion, R15b) ou filtrer sur
    // `is_active` (R14b) au lieu de `stepCatalog.ordered`.
    const stepFilter = ORDERS_LIST_FILTERS.find((f) => f.id === 'productionStepId')!;
    const stepDisabled = fixtureStep({ id: 's-disabled', label: 'Massicot', position: 0, is_active: false });
    const stepActive = fixtureStep({ id: 's-active', label: 'Impression', position: 1, is_active: true });
    // byId est construit dans un ordre DIFFERENT de la position, pour
    // detecter une lecture accidentelle depuis byId plutot que ordered.
    const byId = new Map([[stepActive.id, stepActive], [stepDisabled.id, stepDisabled]]);
    const options = stepFilter.options!({ stepCatalog: { byId, ordered: [stepDisabled, stepActive] } });
    expect(options).toEqual([
      { value: '', label: 'Toutes les étapes' },
      { value: 's-disabled', label: 'Massicot (désactivée)' },
      { value: 's-active', label: 'Impression' },
    ]);
  });

  it('N15 — le libelle d option d etape est TOUJOURS produit par formatProductionStepLabel (suffixe compris), jamais le libelle nu', () => {
    // Mutation qui ferait tomber ce test : `options()` du filtre etape
    // rendant `step.label` nu au lieu de `formatProductionStepLabel(step)`.
    const stepFilter = ORDERS_LIST_FILTERS.find((f) => f.id === 'productionStepId')!;
    const stepDisabled = fixtureStep({ id: 's-disabled', label: 'Massicot', position: 0, is_active: false });
    const options = stepFilter.options!({ stepCatalog: { byId: new Map(), ordered: [stepDisabled] } });
    expect(options.map((o) => o.label)).toContain('Massicot (désactivée)');
    expect(options.map((o) => o.label)).not.toContain('Massicot');
  });

  it('le filtre de tri expose les memes options que ORDERS_LIST_SORT_OPTIONS', () => {
    const sortFilter = ORDERS_LIST_FILTERS.find((f) => f.id === 'sort')!;
    const options = sortFilter.options!({ stepCatalog: { byId: new Map(), ordered: [] } });
    expect(options.map((o) => o.value)).toEqual(ORDERS_LIST_SORT_OPTIONS.map((o) => o.value));
  });
});

describe('customerFilterSelected / customerFilterCleared (qa-review round 2, N14)', () => {
  it('customerFilterSelected transmet le libelle RECU, jamais une chaine vide codee en dur', () => {
    // Mutation qui ferait tomber ce test : `customerFilterSelected` ignorant
    // `label` et posant toujours `''` (N14).
    expect(customerFilterSelected('cust-9', 'Client Neuf')).toEqual({
      type: 'customerSelected',
      customerId: 'cust-9',
      label: 'Client Neuf',
    });
  });

  it('customerFilterCleared rend l action de reinitialisation, sans argument', () => {
    expect(customerFilterCleared()).toEqual({ type: 'customerCleared' });
  });
});

describe('ordersListReducer (qa-review round 1 B1/B2/M4 ; round 2 V1/V2/N02/N03/N12/N13)', () => {
  it('B2 — filtersChanged remet orders/nextCursor a zero et incremente la generation, meme depuis un etat qui porte deja des lignes et un curseur', () => {
    const before = fixtureState({
      generation: 3,
      status: 'idle',
      orders: [fixtureOrder()],
      nextCursor: 'cursor-old',
      filters: { ...DEFAULT_ORDERS_LIST_FILTERS, sort: '-created_at' },
    });

    const after = ordersListReducer(before, { type: 'filtersChanged', patch: { createdFrom: '2026-09-01' } });

    expect(after.orders).toEqual([]);
    expect(after.nextCursor).toBeNull();
    expect(after.generation).toBe(4);
    expect(after.status).toBe('loading');
    expect(buildInitialLoadRequest(after.filters, ORDERS_LIST_PAGE_SIZE).pageCursor).toBeUndefined();
  });

  it('B1 — un pageLoaded de la generation n-1 recu APRES filtersChanged ne modifie ni orders ni nextCursor', () => {
    const gen0 = fixtureState({ generation: 0, orders: [fixtureOrder({ id: 'order-a' })], nextCursor: 'cursor-a' });
    const gen1 = ordersListReducer(gen0, { type: 'filtersChanged', patch: { sort: 'production_step' } });
    expect(gen1.generation).toBe(1);

    const afterStalePageLoaded = ordersListReducer(gen1, {
      type: 'pageLoaded',
      generation: 0,
      mode: 'more',
      cursor: 'cursor-a',
      items: [fixtureOrder({ id: 'order-stale' })],
      nextCursor: 'cursor-stale',
    });

    expect(afterStalePageLoaded).toBe(gen1);
    expect(afterStalePageLoaded.orders).toEqual([]);
    expect(afterStalePageLoaded.nextCursor).toBeNull();
  });

  it('N02 — retirer la garde de generation de pageLoaded ferait apparaitre une reponse perimee (temoin explicite de la mutation)', () => {
    // Ce test documente EXACTEMENT ce que N02 mute : sans la garde, l assertion
    // ci-dessus ("B1") echouerait avec orders=['order-stale']. Non redondant :
    // il isole le cas ou generation ET cursor/status matchent, pour prouver que
    // c est bien LA GENERATION qui protege ici, pas la garde de curseur.
    const state = fixtureState({ generation: 5, status: 'loading', orders: [], nextCursor: null });
    const after = ordersListReducer(state, {
      type: 'pageLoaded',
      generation: 4,
      mode: 'initial',
      cursor: null,
      items: [fixtureOrder({ id: 'perime' })],
      nextCursor: 'c',
    });
    expect(after).toBe(state);
  });

  it('N03 — pageLoadFailed perime (generation anterieure) est ignore, meme en mode initial', () => {
    const state = fixtureState({ generation: 2, status: 'loading' });
    const after = ordersListReducer(state, { type: 'pageLoadFailed', generation: 1, mode: 'initial', cursor: null, message: 'perime' });
    expect(after).toBe(state);
  });

  it('pageLoaded (generation courante, mode initial) REMPLACE orders — jamais un ajout (M10)', () => {
    const before = fixtureState({ generation: 2, orders: [fixtureOrder({ id: 'ancienne' })], status: 'loading' });
    const after = ordersListReducer(before, {
      type: 'pageLoaded',
      generation: 2,
      mode: 'initial',
      cursor: null,
      items: [fixtureOrder({ id: 'nouvelle' })],
      nextCursor: 'cursor-1',
    });
    expect(after.orders.map((o) => o.id)).toEqual(['nouvelle']);
    expect(after.status).toBe('idle');
  });

  it('pageLoaded (generation courante, mode more, statut loading-more, curseur correspondant) AJOUTE aux lignes existantes', () => {
    const before = fixtureState({ generation: 2, orders: [fixtureOrder({ id: 'page-1' })], status: 'loading-more', nextCursor: 'cursor-1' });
    const after = ordersListReducer(before, {
      type: 'pageLoaded',
      generation: 2,
      mode: 'more',
      cursor: 'cursor-1',
      items: [fixtureOrder({ id: 'page-2' })],
      nextCursor: 'cursor-2',
    });
    expect(after.orders.map((o) => o.id)).toEqual(['page-1', 'page-2']);
    expect(after.status).toBe('idle');
  });

  it('V1 (mineur, round 2) — deux pageLoaded "more" IDENTIQUES (meme generation, meme curseur) n ajoutent la page qu UNE SEULE FOIS', () => {
    // Sonde qa-review round 2 : sans la garde de curseur, la deuxieme
    // application ajoute 'b' une seconde fois -> ['a','b','b'].
    const s0 = fixtureState({ generation: 1, status: 'loading-more', orders: [fixtureOrder({ id: 'a' })], nextCursor: 'c1' });
    const page = {
      type: 'pageLoaded' as const,
      generation: 1,
      mode: 'more' as const,
      cursor: 'c1',
      items: [fixtureOrder({ id: 'b' })],
      nextCursor: 'c2',
    };
    const s1 = ordersListReducer(s0, page);
    const s2 = ordersListReducer(s1, page);
    expect(s2.orders.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('V2 (mineur, round 2) — un pageLoaded "more" est ignore quand l etat n attend PAS de reponse "more" (status idle)', () => {
    const s0 = fixtureState({ generation: 1, status: 'idle', orders: [fixtureOrder({ id: 'a' })], nextCursor: 'c1' });
    const after = ordersListReducer(s0, {
      type: 'pageLoaded',
      generation: 1,
      mode: 'more',
      cursor: 'c1',
      items: [fixtureOrder({ id: 'z' })],
      nextCursor: 'cz',
    });
    expect(after).toBe(s0);
  });

  it('un pageLoaded "more" avec un curseur different du curseur courant est ignore (reponse hors contexte)', () => {
    const s0 = fixtureState({ generation: 1, status: 'loading-more', orders: [fixtureOrder({ id: 'a' })], nextCursor: 'c1' });
    const after = ordersListReducer(s0, {
      type: 'pageLoaded',
      generation: 1,
      mode: 'more',
      cursor: 'c-not-current',
      items: [fixtureOrder({ id: 'z' })],
      nextCursor: 'cz',
    });
    expect(after).toBe(s0);
  });

  it('customerSelected — action du reducteur, testee (M4) : filtre le client ET son libelle, remet a zero', () => {
    const before = fixtureState({ orders: [fixtureOrder()], nextCursor: 'cur', generation: 0 });
    const after = ordersListReducer(before, { type: 'customerSelected', customerId: 'cust-9', label: 'Client Neuf' });
    expect(after.filters.customerId).toBe('cust-9');
    expect(after.selectedCustomerLabel).toBe('Client Neuf');
    expect(after.orders).toEqual([]);
    expect(after.nextCursor).toBeNull();
    expect(after.generation).toBe(1);
  });

  it('N12 — customerSelected remet TOUJOURS a zero orders/nextCursor/generation, meme si l on omettait resetForNewQuery', () => {
    // Mutation qui ferait tomber ce test : retirer `...resetForNewQuery(state)`
    // du cas `customerSelected`.
    const before = fixtureState({ orders: [fixtureOrder(), fixtureOrder({ id: 'b' })], nextCursor: 'cur', generation: 3 });
    const after = ordersListReducer(before, { type: 'customerSelected', customerId: 'cust-1', label: 'X' });
    expect(after.orders).toEqual([]);
    expect(after.nextCursor).toBeNull();
    expect(after.generation).toBe(4);
  });

  it('customerCleared — "Tous les clients", action du reducteur, testee (M4) : efface le client ET son libelle', () => {
    const before = fixtureState({
      filters: { ...DEFAULT_ORDERS_LIST_FILTERS, customerId: 'cust-9' },
      selectedCustomerLabel: 'Client Neuf',
      generation: 1,
    });
    const after = ordersListReducer(before, { type: 'customerCleared' });
    expect(after.filters.customerId).toBe('');
    expect(after.selectedCustomerLabel).toBe('');
    expect(after.generation).toBe(2);
  });

  it('filtersChanged avec un tri (M4) : le tri change, remise a zero identique aux autres axes', () => {
    const before = fixtureState({ orders: [fixtureOrder()], nextCursor: 'cur' });
    const after = ordersListReducer(before, { type: 'filtersChanged', patch: { sort: '-production_step' } });
    expect(after.filters.sort).toBe('-production_step');
    expect(after.orders).toEqual([]);
  });

  it('loadMoreRequested est un no-op sans curseur suivant, ou pendant un chargement deja en cours', () => {
    const noCursor = fixtureState({ nextCursor: null, status: 'idle' });
    expect(ordersListReducer(noCursor, { type: 'loadMoreRequested' })).toBe(noCursor);

    const alreadyLoading = fixtureState({ nextCursor: 'cur', status: 'loading-more' });
    expect(ordersListReducer(alreadyLoading, { type: 'loadMoreRequested' })).toBe(alreadyLoading);

    const idle = fixtureState({ nextCursor: 'cur', status: 'idle' });
    const after = ordersListReducer(idle, { type: 'loadMoreRequested' });
    expect(after.status).toBe('loading-more');
  });

  it('N13 — loadMoreRequested SANS curseur suivant ne bascule jamais en loading-more', () => {
    // Mutation qui ferait tomber ce test : retirer la garde du cas
    // `loadMoreRequested` (bascule inconditionnelle en `loading-more`).
    const noCursor = fixtureState({ nextCursor: null, status: 'idle' });
    const after = ordersListReducer(noCursor, { type: 'loadMoreRequested' });
    expect(after.status).toBe('idle');
  });

  it('pageLoadFailed (mode initial) vide la liste ; (mode more, statut/curseur corrects) la laisse intacte ; generation OU curseur perimes ignores', () => {
    const beforeInitial = fixtureState({ generation: 1, orders: [fixtureOrder()], status: 'loading' });
    const afterInitial = ordersListReducer(beforeInitial, {
      type: 'pageLoadFailed',
      generation: 1,
      mode: 'initial',
      cursor: null,
      message: 'erreur',
    });
    expect(afterInitial.orders).toEqual([]);
    expect(afterInitial.status).toBe('error');
    expect(afterInitial.error).toBe('erreur');

    const beforeMore = fixtureState({ generation: 1, orders: [fixtureOrder({ id: 'garde-moi' })], status: 'loading-more', nextCursor: 'c1' });
    const afterMore = ordersListReducer(beforeMore, {
      type: 'pageLoadFailed',
      generation: 1,
      mode: 'more',
      cursor: 'c1',
      message: 'erreur reseau',
    });
    expect(afterMore.orders.map((o) => o.id)).toEqual(['garde-moi']);
    expect(afterMore.status).toBe('error');

    const staleGeneration = ordersListReducer(beforeMore, { type: 'pageLoadFailed', generation: 0, mode: 'more', cursor: 'c1', message: 'perimee' });
    expect(staleGeneration).toBe(beforeMore);

    const staleCursor = ordersListReducer(beforeMore, { type: 'pageLoadFailed', generation: 1, mode: 'more', cursor: 'c-other', message: 'hors contexte' });
    expect(staleCursor).toBe(beforeMore);
  });

  it('stepsLoaded/stepsFailed vivent dans le reducteur (round 2, condition (b1))', () => {
    const catalog = { byId: new Map([['s1', fixtureStep()]]), ordered: [fixtureStep()] };
    const loaded = ordersListReducer(fixtureState(), { type: 'stepsLoaded', catalog });
    expect(loaded.stepCatalog).toBe(catalog);
    expect(loaded.stepsLoadError).toBeNull();

    const failed = ordersListReducer(fixtureState({ stepCatalog: catalog }), { type: 'stepsFailed', error: 'boom' });
    expect(failed.stepsLoadError).toBe('boom');
    // Un echec ne doit pas effacer un catalogue deja charge avec succes.
    expect(failed.stepCatalog).toBe(catalog);
  });
});

describe('planLoadMore / requestMoreOrders (qa-review round 2, mineur N04/N18)', () => {
  it('planLoadMore est faux sans curseur suivant, ou pendant un chargement "more" deja en cours', () => {
    expect(planLoadMore(fixtureState({ nextCursor: null }))).toBe(false);
    expect(planLoadMore(fixtureState({ nextCursor: 'c1', status: 'loading-more' }))).toBe(false);
    expect(planLoadMore(fixtureState({ nextCursor: 'c1', status: 'idle' }))).toBe(true);
  });

  it('N04 — requestMoreOrders n appelle JAMAIS le reseau quand planLoadMore est faux', async () => {
    // Mutation qui ferait tomber ce test : retirer le `if (!planLoadMore(state)) return null;`
    // de `requestMoreOrders` — une requete serait envoyee malgre l absence de curseur.
    const list = vi.fn();
    const result = await requestMoreOrders({ list }, fixtureState({ nextCursor: null }));
    expect(result).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it('N18 — requestMoreOrders appelle bien loadOrdersListPage en mode "more", jamais "initial"', async () => {
    // Mutation qui ferait tomber ce test : appeler `loadOrdersListPage(api, state, 'initial')`
    // a l interieur de `requestMoreOrders` (N18).
    const list = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const state = fixtureState({ nextCursor: 'cursor-1', status: 'idle' });

    const action = await requestMoreOrders({ list }, state);

    expect(action?.mode).toBe('more');
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ pageCursor: 'cursor-1' }));
  });
});

describe('loadOrdersListPage — orchestration reseau (qa-review round 1 B1/M08 ; round 2 cursor)', () => {
  it('tire la requete initiale EXACTEMENT de state.filters, sans amendement au point d appel (M08)', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const state = fixtureState({
      filters: { ...DEFAULT_ORDERS_LIST_FILTERS, productionStepId: 'step-9', customerId: 'cust-1' },
      generation: 5,
    });

    await loadOrdersListPage({ list }, state, 'initial');

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ currentProductionStepId: 'step-9', customerId: 'cust-1', pageSize: ORDERS_LIST_PAGE_SIZE }),
    );
    expect(list.mock.calls[0][0].pageCursor).toBeUndefined();
  });

  it('R09b/R11c — une requete INITIALE ne porte jamais pageCursor, meme depuis un etat qui porte deja un curseur', async () => {
    // Mutation qui ferait tomber ce test : passer `state.nextCursor` a
    // `buildInitialLoadRequest`/a l appel `api.list` en mode initial.
    const list = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const state = fixtureState({ nextCursor: 'cursor-old', filters: DEFAULT_ORDERS_LIST_FILTERS });

    await loadOrdersListPage({ list }, state, 'initial');

    expect(list.mock.calls[0][0].pageCursor).toBeUndefined();
  });

  it('tire la requete "Charger plus" avec le curseur de l etat, sans reconstruire les filtres', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const state = fixtureState({ nextCursor: 'cursor-1', filters: { ...DEFAULT_ORDERS_LIST_FILTERS, sort: 'production_step' } });

    await loadOrdersListPage({ list }, state, 'more');

    expect(list).toHaveBeenCalledWith(expect.objectContaining({ sort: 'production_step', pageCursor: 'cursor-1' }));
  });

  it('rend une action pageLoaded portant la generation CAPTUREE et le curseur UTILISE', async () => {
    const list = vi.fn().mockResolvedValue({ items: [fixtureOrder()], nextCursor: 'next' });
    const state = fixtureState({ generation: 7 });

    const action = await loadOrdersListPage({ list }, state, 'initial');

    expect(action).toEqual({ type: 'pageLoaded', generation: 7, mode: 'initial', cursor: null, items: [fixtureOrder()], nextCursor: 'next' });
  });

  it('en mode "more", le curseur porte par l action est celui REELLEMENT utilise (state.nextCursor au moment de l appel)', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], nextCursor: 'next' });
    const state = fixtureState({ generation: 1, nextCursor: 'cursor-used', status: 'loading-more' });

    const action = await loadOrdersListPage({ list }, state, 'more');

    expect(action).toMatchObject({ mode: 'more', cursor: 'cursor-used' });
  });

  it('ne throw jamais : un echec reseau devient une action pageLoadFailed, curseur compris', async () => {
    const list = vi.fn().mockRejectedValue(new Error('reseau indisponible'));
    const state = fixtureState({ generation: 2 });

    const action = await loadOrdersListPage({ list }, state, 'initial');

    expect(action).toEqual({ type: 'pageLoadFailed', generation: 2, mode: 'initial', cursor: null, message: 'reseau indisponible' });
  });

  it('scenario B1 complet : un "Charger plus" en vol sous un ancien tri ne peut plus reinstaller son curseur apres un changement de tri', async () => {
    let resolveMore!: (value: { items: CommercialOrderDto[]; nextCursor: string | null }) => void;
    const list = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveMore = resolve; }))
      .mockImplementationOnce(async () => ({ items: [fixtureOrder({ id: 'nouveau-tri' })], nextCursor: 'cursor-nouveau' }));

    const state0 = fixtureState({
      generation: 0,
      status: 'loading-more',
      orders: [fixtureOrder({ id: 'ancien-tri-page-1' })],
      nextCursor: 'cursor-ancien',
      filters: { ...DEFAULT_ORDERS_LIST_FILTERS, sort: '-created_at' },
    });

    const loadMorePromise = loadOrdersListPage({ list }, state0, 'more');

    const state1 = ordersListReducer(state0, { type: 'filtersChanged', patch: { sort: 'production_step' } });
    expect(state1.generation).toBe(1);

    const initialAction = await loadOrdersListPage({ list }, state1, 'initial');
    const state2 = ordersListReducer(state1, initialAction);
    expect(state2.orders.map((o) => o.id)).toEqual(['nouveau-tri']);
    expect(state2.nextCursor).toBe('cursor-nouveau');

    resolveMore({ items: [fixtureOrder({ id: 'ancien-tri-page-2' })], nextCursor: 'cursor-ancien-2' });
    const staleAction = await loadMorePromise;
    const state3 = ordersListReducer(state2, staleAction);

    expect(state3.orders.map((o) => o.id)).toEqual(['nouveau-tri']);
    expect(state3.nextCursor).toBe('cursor-nouveau');
  });
});

describe('missingCustomerIds — decide quels clients restent a charger (qa-review round 3, mineur X07)', () => {
  it('exclut les clients DEJA CONNUS', () => {
    const orders = [fixtureOrder({ customer_id: 'c1' }), fixtureOrder({ customer_id: 'c2' })];
    expect(missingCustomerIds(orders, new Set(['c1']), new Set())).toEqual(['c2']);
  });

  it('X07 — exclut les clients DEJA EN VOL, pour ne jamais les redemander en double', () => {
    // Mutation qui ferait tomber ce test : ignorer `inFlight` (le meme
    // client serait redemande a chaque page suivante avant que sa premiere
    // reponse ne soit revenue).
    const orders = [fixtureOrder({ customer_id: 'c1' }), fixtureOrder({ customer_id: 'c2' })];
    expect(missingCustomerIds(orders, new Set(), new Set(['c1']))).toEqual(['c2']);
  });

  it('deduplique les commandes qui partagent le meme client', () => {
    const orders = [fixtureOrder({ id: 'o1', customer_id: 'c1' }), fixtureOrder({ id: 'o2', customer_id: 'c1' })];
    expect(missingCustomerIds(orders, new Set(), new Set())).toEqual(['c1']);
  });

  it('rend une liste vide quand aucune commande ne porte de client manquant', () => {
    expect(missingCustomerIds([], new Set(), new Set())).toEqual([]);
  });
});

describe('canLoadMore — visibilite du bouton "Charger plus" (qa-review round 3, mineur X25)', () => {
  it('X25 — faux SANS curseur suivant, meme si le statut n est pas "loading"', () => {
    // Mutation qui ferait tomber ce test : rendre le bouton visible sans
    // curseur suivant (X25 : bouton visible en permanence).
    expect(canLoadMore(fixtureState({ status: 'idle', nextCursor: null }))).toBe(false);
  });

  it('faux pendant le chargement INITIAL, meme avec un curseur suivant deja connu', () => {
    expect(canLoadMore(fixtureState({ status: 'loading', nextCursor: 'c1' }))).toBe(false);
  });

  it('vrai avec un curseur suivant, y compris PENDANT un chargement "more" deja en cours (le bouton reste visible, desactive)', () => {
    expect(canLoadMore(fixtureState({ status: 'loading-more', nextCursor: 'c1' }))).toBe(true);
    expect(canLoadMore(fixtureState({ status: 'idle', nextCursor: 'c1' }))).toBe(true);
  });
});

describe('loadMoreOrders — orchestre ENTIEREMENT le clic "Charger plus" (qa-review round 3, moyen X24)', () => {
  it('X24 — emet loadMoreRequested AVANT de dispatcher la reponse reseau', async () => {
    // Mutation qui ferait tomber ce test : oublier de dispatcher
    // `loadMoreRequested` avant l appel reseau (X24 — "Charger plus" ne
    // ferait plus rien, en silence, si cette etape disparaissait).
    const dispatch = vi.fn();
    const list = vi.fn().mockResolvedValue({ items: [fixtureOrder()], nextCursor: null });
    const state = fixtureState({ nextCursor: 'c1', status: 'idle' });

    await loadMoreOrders(dispatch, { list }, state);

    expect(dispatch.mock.calls[0]![0]).toEqual({ type: 'loadMoreRequested' });
    expect(dispatch.mock.calls[1]![0]).toMatchObject({ type: 'pageLoaded', mode: 'more' });
  });

  it('ne dispatche RIEN et n appelle jamais le reseau quand planLoadMore refuse', async () => {
    const dispatch = vi.fn();
    const list = vi.fn();
    const state = fixtureState({ nextCursor: null });

    await loadMoreOrders(dispatch, { list }, state);

    expect(dispatch).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });
});
