/**
 * DashboardOrders — Vue agregee toutes commandes du tenant (persona owner).
 *
 * S-DASHBOARD-ORDERS-DUAL (Sprint 4 Phase 1 complement, 2026-05-18) :
 * remplace l ancien placeholder. Dual-read shop_orders + tenant_orders.
 *
 * S3.1 (Sprint 5, 2026-05-23) : refactor pour deleguer rendu/filtres/tri
 * au composant <OrderHistoryTable>, avec extraColumn 'Boutique' pour
 * afficher le slug par ligne.
 */

import { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useShops } from '../../contexts/ShopsContext';
import { type OrderUI } from '../shop/portal/PortalOrders.helpers';
import { OrderHistoryTable } from '../shop/portal/OrderHistoryTable';
import { CancelOrderConfirmDialog } from '../shop/portal/CancelOrderConfirmDialog';
import { ValidateOrderConfirmDialog } from '../shop/portal/ValidateOrderConfirmDialog';
import { useUserCapability } from '../../hooks/useUserCapability';
import {
  type DashboardOrderUI,
  useDashboardOrderManagement,
} from '../../hooks/useDashboardOrderManagement';

export function DashboardOrders() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { shops } = useShops();
  const shopIds = useMemo(() => shops.map((shop) => shop.id), [shops]);
  const {
    orders,
    loading,
    error,
    cancel,
    validate,
    startProduction,
    markShipped,
    auditApi,
  } = useDashboardOrderManagement({
    enabled: Boolean(user),
    tenantId: currentTenant?.id ?? null,
    shopIds,
  });

  // Fix 2026-05-25 : Map shop_id -> { name, slug } pour afficher le NOM
  // humain dans la colonne Boutique (et plus le slug technique qui ressemble
  // à wuqezh-8ggfvk pour les boutiques créées sans slug humain explicite).
  const shopInfoById = useMemo(() => {
    const map = new Map<string, { name: string; slug: string }>();
    for (const s of shops) {
      map.set(s.id, { name: s.name, slug: s.slug });
    }
    return map;
  }, [shops]);

  // Helper : retourne le label humain à afficher (name préféré, fallback slug puis '—').
  const shopDisplayLabel = (shopId: string): string => {
    const info = shopInfoById.get(shopId);
    if (!info) return '—';
    return info.name?.trim() || info.slug || '—';
  };

  // S3.4 : modal annulation. orderToCancel = null → modal fermé.
  const [orderToCancel, setOrderToCancel] = useState<DashboardOrderUI | null>(null);
  // Fix 2026-05-25 : modal validation. orderToValidate = null → modal fermé.
  const [orderToValidate, setOrderToValidate] = useState<DashboardOrderUI | null>(null);

  // S-USERS-REFONTE Phase A (2026-05-25) : le bouton "Valider" est role-driven.
  // Visible uniquement si l'utilisateur courant a la capability can_validate
  // via au moins un rôle actif dans le tenant (preset Owner / Admin /
  // Validateur par défaut). Évite que les Acheteurs voient un bouton qui
  // serait refusé par le RPC (UX confusion).
  const { hasIt: canValidate } = useUserCapability('can_validate');
  // S-ORDER-ROLES-3-UI (2026-06-09) : Démarrer la production + Marquer
  // expédiée gardes par can_modify (preset Owner / Admin / Validateur /
  // Producteur). Cohérence avec PortalOrders tab "À produire" mais
  // accessible à l'admin tenant sur l'ensemble des boutiques.
  const { hasIt: canModifyProduction } = useUserCapability('can_modify');
  // Les owner/admin sont aussi autorisés par la commande serveur. Ce fallback
  // évite de masquer le workflow si un tenant brownfield n'a pas encore son
  // assignation de rôle fonctionnel synchronisée avec tenant_members.
  const isTenantAdmin = currentTenant?.myRole === 'owner' || currentTenant?.myRole === 'admin';

  // S3.4 : handlers cancel (admin tenant peut annuler n'importe quelle draft).
  const handleCancelOrderRequest = (order: OrderUI) => {
    setOrderToCancel(order as DashboardOrderUI);
  };

  const handleCancelConfirm = async (orderId: string): Promise<string | null> => {
    return cancel(orderId);
  };

  // Fix 2026-05-25 : handlers validation (admin tenant uniquement —
  // RPC matrice draft→validated réservée role owner/admin).
  const handleValidateOrderRequest = (order: OrderUI) => {
    setOrderToValidate(order as DashboardOrderUI);
  };

  const handleValidateConfirm = async (orderId: string): Promise<string | null> => {
    return validate(orderId);
  };

  // S-ORDER-ROLES-3-UI : transitions production (admin tenant via can_modify).
  // Sans modal de confirmation — actions tactiques rapides côté pilotage atelier.
  const handleStartProduction = (order: OrderUI) => startProduction(order);
  const handleMarkShipped = (order: OrderUI) => markShipped(order);

  return (
    <div
      className="max-w-[1400px]"
      style={{ fontFamily: 'var(--font-ui)' }}
      data-testid="dashboard-orders-page"
    >
      <div className="mb-6">
        <h1
          className="text-ink m-0"
          style={{ fontWeight: 300, fontSize: '34px', letterSpacing: '-0.025em', lineHeight: 1.05 }}
        >
          Commandes
        </h1>
        <p className="mt-2 mb-0 text-ink-muted" style={{ fontSize: '13.5px' }}>
          {orders.length} commande{orders.length > 1 ? 's' : ''} enregistrée{orders.length > 1 ? 's' : ''} sur l’ensemble de vos boutiques.
        </p>
      </div>

      <OrderHistoryTable
        orders={orders}
        loading={loading}
        error={error}
        auditApi={auditApi}
        appearance="dashboard"
        persistKey={currentTenant ? `orderHistory:dashboard:${currentTenant.id}` : undefined}
        onCancelOrder={handleCancelOrderRequest}
        // S-USERS-REFONTE Phase A : bouton Valider visible uniquement si
        // l'utilisateur courant a la capability can_validate (via rôle actif).
        // Sinon, undefined => OrderHistoryTable masque le bouton.
        onValidateOrder={canValidate || isTenantAdmin ? handleValidateOrderRequest : undefined}
        // S-ORDER-ROLES-3-UI : boutons Démarrer prod + Marquer expédiée
        // role-driven via can_modify (preset Owner / Admin / Validateur /
        // Producteur). Sans modal de confirmation côté admin tenant.
        onStartProductionOrder={canModifyProduction || isTenantAdmin ? handleStartProduction : undefined}
        onMarkShippedOrder={canModifyProduction || isTenantAdmin ? handleMarkShipped : undefined}
        extraColumn={{
          header: 'Boutique',
          position: 'after-date',
          render: (o) => (
            <span className="text-xs">
              {shopDisplayLabel((o as DashboardOrderUI).shop_id)}
            </span>
          ),
          // Fix 2026-05-25 : retrait du sortValue (lesson : sur colonne
          // catégorielle, l'usage primaire est le filtre, pas le tri).
        }}
        extraFilter={{
          label: 'Boutique',
          getOptionKey: (o) => (o as DashboardOrderUI).shop_id,
          getOptionLabel: (o) => shopDisplayLabel((o as DashboardOrderUI).shop_id),
        }}
      />

      <CancelOrderConfirmDialog
        orderId={orderToCancel?.id ?? null}
        orderShortId={
          orderToCancel?.id ? orderToCancel.id.replace(/-/g, '').slice(0, 8).toUpperCase() : undefined
        }
        onConfirm={handleCancelConfirm}
        onClose={() => setOrderToCancel(null)}
      />

      <ValidateOrderConfirmDialog
        orderId={orderToValidate?.id ?? null}
        orderShortId={
          orderToValidate?.id ? orderToValidate.id.replace(/-/g, '').slice(0, 8).toUpperCase() : undefined
        }
        onConfirm={handleValidateConfirm}
        onClose={() => setOrderToValidate(null)}
      />
    </div>
  );
}
