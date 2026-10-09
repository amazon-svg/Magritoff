import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { ShopCustomersApiClient, type ShopCustomerDetail, type ShopCustomerOrdersPage, type UpdateShopCustomerCommand } from '@/modules/shop-customers';
import { shopCustomerManagementError } from './useShopCustomerAccountManagement';

export function useShopCustomerDetail(tenantId: string, shopId: string, customerId: string) {
  const api = useWorkspaceApi(ShopCustomersApiClient);
  const [detail, setDetail] = useState<ShopCustomerDetail | null>(null);
  const [orders, setOrders] = useState<ShopCustomerOrdersPage>({ items: [], nextCursor: null });
  const [page, setPage] = useState<{ cursor: string | null; previous: (string | null)[] }>({ cursor: null, previous: [] });
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const version = useRef(0);
  const scope = `${tenantId}:${shopId}:${customerId}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const refresh = useCallback(async () => {
    const request = ++version.current;
    setLoading(true); setError(null);
    try {
      const result = await api.detail(tenantId, shopId, customerId);
      if (request === version.current) setDetail(result);
    } catch (cause) {
      if (request === version.current) setError(shopCustomerManagementError(cause, 'Impossible de charger ce client.'));
    } finally { if (request === version.current) setLoading(false); }
  }, [api, tenantId, shopId, customerId]);

  useEffect(() => {
    setDetail(null); setFeedback(null); setSaving(false);
    setPage({ cursor: null, previous: [] });
    void refresh();
    return () => { version.current += 1; };
  }, [refresh]);

  const [ordersRevision, setOrdersRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setOrdersLoading(true); setOrdersError(null);
    void api.ordersPage(tenantId, shopId, customerId, { size: 20, cursor: page.cursor })
      .then(result => { if (current) setOrders(result); })
      .catch(cause => { if (current) setOrdersError(shopCustomerManagementError(cause, 'Impossible de charger les commandes.')); })
      .finally(() => { if (current) setOrdersLoading(false); });
    return () => { current = false; };
  }, [api, tenantId, shopId, customerId, page.cursor, ordersRevision]);

  const update = async (command: UpdateShopCustomerCommand): Promise<boolean> => {
    const target = scope;
    setSaving(true); setError(null); setFeedback(null);
    try {
      const customer = await api.update(tenantId, shopId, customerId, command);
      if (target !== scopeRef.current) return false;
      setDetail(previous => previous ? { ...previous, customer } : previous);
      setFeedback(command.enabled === false ? 'Accès désactivé. Les commandes sont conservées.'
        : command.enabled === true ? 'Accès réactivé.' : 'Informations enregistrées.');
      return true;
    } catch (cause) {
      if (target === scopeRef.current) setError(shopCustomerManagementError(cause, 'Impossible d’enregistrer ce client.'));
      return false;
    } finally { if (target === scopeRef.current) setSaving(false); }
  };

  return { detail, loading, error, refresh, saving, feedback, update,
    orders, ordersLoading, ordersError,
    retryOrders: () => setOrdersRevision(value => value + 1),
    pageNumber: page.previous.length + 1,
    previousPage: () => setPage(current => current.previous.length ? { cursor: current.previous.at(-1) ?? null, previous: current.previous.slice(0, -1) } : current),
    nextPage: () => { if (orders.nextCursor) setPage(current => ({ cursor: orders.nextCursor, previous: [...current.previous, current.cursor] })); },
  };
}
