/**
 * DashboardCommercialOrders — grille des commandes de gestion commerciale
 * (E10.18a, "la periode, a la grille d abord").
 *
 * PERIMETRE VOLONTAIREMENT ETROIT : cette grille existe pour porter le
 * filtre `created_from`/`created_to` de `listCommercialOrders` (E10.18a),
 * pas pour livrer un tableau de bord complet. Elle reprend le patron deja
 * en place pour la grille voisine des devis (`DashboardQuotes`,
 * `commercial-quotes/ui/workspace/QuotesPage.tsx`) : chargement paginable
 * par curseur, "Charger plus", pas de pagination numerotee.
 *
 * Colonnes : N°, Client, Cree le (fuseau `Europe/Paris`, meme constante que
 * le serveur — `orders-list.helpers.ts`), Total TTC (deja calcule et fige
 * par le serveur, `CommercialOrder.totals.total_incl_tax` — AUCUN calcul ici,
 * E10.8 gelee). Lien vers `OrderDetailPage` (E10.16), deja livree.
 *
 * ACCESSIBLE PAR URL DIRECTE UNIQUEMENT — meme prudence qu E10.16 (aucune
 * entree de navigation). Le module `orders` porte deja une entree de
 * sidebar "Commandes" pour les commandes BOUTIQUE (`tenant_orders`), un
 * domaine SANS RAPPORT (voir l en-tete de
 * `commercial-orders/surface-contributions.ts`) : choisir comment nommer et
 * distinguer les deux dans la sidebar est une decision produit qui
 * n appartient pas a ce lot etroit — a trancher par une story dediee
 * (probablement E10.18e, qui pose deja "le bouton sur la grille").
 *
 * TITRE "Commandes atelier" (qa-review E10.18a round 1, arbitrage Arnaud
 * 2026-09-12), PAS "Commandes" tout court : le module `orders` (commandes
 * BOUTIQUE, domaine etanche, voir ci-dessus) porte deja une entree de
 * sidebar "Commandes". Le jour ou cet ecran gagnera une entree de
 * navigation, deux libelles identiques designeraient deux domaines sans
 * rapport — source de confusion pour l imprimeur qui les verrait cote a
 * cote. "Commandes atelier" est le terme choisi par Arnaud parce qu il
 * parle le langage de l imprimeur (par opposition aux commandes passees par
 * un client final sur la boutique en ligne).
 *
 * AUCUN CONTROLE METIER ICI : le filtre de periode n est qu une mise en
 * forme de requete (`buildPeriodQuery`) — la validation du format, l ordre
 * des bornes et la conversion de fuseau sont FAITS PAR LE SERVEUR
 * (`src/server/api/commercial-orders-routes.ts`, `src/kernel/clock`). Une
 * reponse 400/422 est affichee telle quelle, jamais devinee cote client.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PackageSearch } from 'lucide-react';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CustomersApiClient, type CustomerDto } from '@/modules/customers';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { CommercialOrdersApiClient } from '../../api/client';
import type { CommercialOrderDto } from '../../api/contracts';
import { customerDisplayName } from './order-detail.helpers';
import { buildPeriodQuery, formatOrderCreatedAt } from './orders-list.helpers';

const T = TEST_IDS.commercialOrder;

const PAGE_SIZE = 50;

export function DashboardCommercialOrders() {
  const tp = useTenantPath();
  const ordersApi = useWorkspaceApi(CommercialOrdersApiClient);
  const customersApi = useWorkspaceApi(CustomersApiClient);

  const [orders, setOrders] = useState<CommercialOrderDto[]>([]);
  const [customersById, setCustomersById] = useState<Readonly<Record<string, CustomerDto>>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const period = useMemo(() => buildPeriodQuery(createdFrom, createdTo), [createdFrom, createdTo]);

  const loadCustomers = useCallback(
    async (rows: readonly CommercialOrderDto[]) => {
      const missingIds = Array.from(new Set(rows.map((o) => o.customer_id))).filter(
        (id) => !(id in customersById),
      );
      if (missingIds.length === 0) return;
      const fetched = await Promise.all(
        missingIds.map(async (id) => {
          try {
            return [id, await customersApi.getDetail(id)] as const;
          } catch {
            return null;
          }
        }),
      );
      setCustomersById((current) => {
        const next = { ...current };
        for (const entry of fetched) {
          if (entry) next[entry[0]] = entry[1];
        }
        return next;
      });
    },
    [customersApi, customersById],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await ordersApi.list({ ...period, pageSize: PAGE_SIZE });
      setOrders(page.items as CommercialOrderDto[]);
      setNextCursor(page.nextCursor);
      await loadCustomers(page.items);
    } catch (cause) {
      setOrders([]);
      setNextCursor(null);
      setError(cause instanceof Error ? cause.message : 'Chargement des commandes impossible.');
    } finally {
      setLoading(false);
    }
    // loadCustomers volontairement absent des deps, meme motif que QuotesPage :
    // sa propre dependance (customersById) changerait a chaque appel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersApi, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await ordersApi.list({ ...period, pageSize: PAGE_SIZE, pageCursor: nextCursor });
      setOrders((current) => [...current, ...(page.items as CommercialOrderDto[])]);
      setNextCursor(page.nextCursor);
      await loadCustomers(page.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement des commandes impossible.');
    } finally {
      setLoadingMore(false);
    }
  };

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
          {orders.length} commande{orders.length > 1 ? 's' : ''} de gestion commerciale.
        </p>
      </div>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-ink-muted" style={{ fontSize: '12.5px' }}>
          Du
          <input
            type="date"
            data-testid={T.listCreatedFromInput}
            value={createdFrom}
            onChange={(e) => setCreatedFrom(e.target.value)}
            className="px-2 py-1 rounded-md border border-line bg-paper text-ink"
            style={{ fontSize: '12.5px' }}
          />
        </label>
        <label className="flex items-center gap-1.5 text-ink-muted" style={{ fontSize: '12.5px' }}>
          Au
          <input
            type="date"
            data-testid={T.listCreatedToInput}
            value={createdTo}
            onChange={(e) => setCreatedTo(e.target.value)}
            className="px-2 py-1 rounded-md border border-line bg-paper text-ink"
            style={{ fontSize: '12.5px' }}
          />
        </label>
      </div>

      {error && (
        <p data-testid={T.listErrorBanner} className="text-sm text-err-fg mb-3">
          {error}
        </p>
      )}

      <div className="border border-line rounded-md overflow-hidden bg-paper">
        {loading ? (
          <div className="py-12 text-center text-ink-muted" style={{ fontSize: '13px' }}>Chargement…</div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-ink-mute-2">
            <PackageSearch className="w-10 h-10 mx-auto mb-3 opacity-40" strokeWidth={1.5} />
            <p style={{ fontSize: '13.5px', fontWeight: 400 }}>
              {createdFrom || createdTo ? 'Aucune commande sur cette periode.' : "Aucune commande pour l'instant."}
            </p>
          </div>
        ) : (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-line bg-bg">
                {['N°', 'Client', 'Créée le', 'Total TTC'].map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-4 py-2 font-mono uppercase text-ink-muted"
                    style={{ fontSize: '10.5px', fontWeight: 500, letterSpacing: '0.06em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const customer = customersById[o.customer_id];
                return (
                  <tr
                    key={o.id}
                    data-testid={T.listRow}
                    data-order-id={o.id}
                    className="border-b border-line hover:bg-bg transition-colors"
                  >
                    <td className="px-4 py-2 font-mono text-ink" style={{ fontSize: '12.5px', fontWeight: 500 }}>
                      <Link to={tp(`/dashboard/commercial-orders/${o.id}`)} className="hover:underline">
                        {o.number}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-ink-2" style={{ fontSize: '13px' }}>
                      {customer ? customerDisplayName(customer) : <span className="text-ink-mute-2">—</span>}
                    </td>
                    <td className="px-4 py-2 text-ink-muted" style={{ fontSize: '12px' }}>
                      {formatOrderCreatedAt(o.created_at)}
                    </td>
                    <td className="px-4 py-2 text-ink" style={{ fontSize: '12.5px' }}>
                      {o.totals.total_incl_tax} €
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && nextCursor && (
        <div className="mt-3 flex justify-center">
          <button
            data-testid={T.listLoadMoreBtn}
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg disabled:opacity-50"
            style={{ fontSize: '12.5px', fontWeight: 500 }}
          >
            {loadingMore ? 'Chargement…' : 'Charger plus'}
          </button>
        </div>
      )}
    </div>
  );
}
