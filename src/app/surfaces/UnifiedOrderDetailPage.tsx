import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { DashboardOrderDetail as CommercialOrderDetail } from '@/modules/commercial-orders/ui';
import { OrdersApiClient, type OrderDetail } from '@/modules/orders';
import { DashboardShopOrderDetail } from '@/modules/orders/ui';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { ApiClientError } from '@/platform/api';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';

type ResolvedOrder =
  | Readonly<{ origin: 'storefront'; detail: OrderDetail }>
  | Readonly<{ origin: 'quote'; detail: null }>;

/**
 * Point d entree unique de la fiche Commande.
 *
 * Les commandes partagent la persistance canonique `tenant_orders`. Les deux
 * projections API distinguent encore leur workflow d'origine pour rendre la
 * fiche adaptée. La route canonique reste `/orders/:id` ; l'ancien chemin
 * `/commercial-orders/:id` monte ce même composant.
 */
export function UnifiedOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const ordersApi = useWorkspaceApi(OrdersApiClient);
  const [resolved, setResolved] = useState<ResolvedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setResolved(null);
    setError(null);
    if (!orderId) {
      setError('Identifiant de commande absent.');
      return () => { active = false; };
    }

    void ordersApi.getDetail(orderId).then(
      (detail) => {
        if (active) setResolved({ origin: 'storefront', detail });
      },
      (cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiClientError && cause.problem.status === 404) {
          setResolved({ origin: 'quote', detail: null });
          return;
        }
        setError(cause instanceof Error ? cause.message : 'Chargement de la commande impossible.');
      },
    );

    return () => { active = false; };
  }, [orderId, ordersApi]);

  if (error) return <UnifiedOrderError message={error} />;
  if (!resolved) return <p className="text-sm text-ink-muted">Chargement de la commande…</p>;
  if (resolved.origin === 'storefront') return <DashboardShopOrderDetail initialOrder={resolved.detail} />;
  return <CommercialOrderDetail />;
}

/** L ancienne grille devient un alias vers la grille metier unique. */
export function LegacyCommercialOrdersRedirect() {
  const tenantPath = useTenantPath();
  return <Navigate replace to={tenantPath('/dashboard/orders')} />;
}

function UnifiedOrderError({ message }: { message: string }) {
  const tenantPath = useTenantPath();
  return (
    <div className="space-y-3">
      <Link to={tenantPath('/dashboard/orders')} className="text-sm text-ink-muted hover:text-ink">
        Retour aux commandes
      </Link>
      <p className="text-sm text-err-fg">{message}</p>
    </div>
  );
}
