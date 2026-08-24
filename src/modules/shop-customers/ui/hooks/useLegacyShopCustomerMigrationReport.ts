import { useEffect, useMemo, useState } from 'react';
import { ShopsApiClient } from '../../../shops';
import { useWorkspaceUiRuntime } from '../../../../platform/runtime/workspace-ui-runtime';
import { ShopCustomersApiClient } from '../../api/client';
import type { LegacyShopCustomerMigrationReportRow } from '../../api/contracts';

export type LegacyMigrationReportState =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'ready'; rows: LegacyShopCustomerMigrationReportRow[] };

export function summarizeLegacyMigration(rows: LegacyShopCustomerMigrationReportRow[]) {
  return {
    pending: rows.filter((row) => row.migrationOutcome === null).length,
    skipped: rows.filter((row) => row.migrationOutcome?.startsWith('skipped_')).length,
    ordersLinked: rows.reduce((total, row) => total + row.ordersLinkedCount, 0),
  } as const;
}

export function useLegacyShopCustomerMigrationReport(
  tenantId: string | null,
): LegacyMigrationReportState {
  const { apiClient } = useWorkspaceUiRuntime();
  const api = useMemo(() => new ShopCustomersApiClient(apiClient), [apiClient]);
  const [state, setState] = useState<LegacyMigrationReportState>({ kind: 'loading' });

  useEffect(() => {
    if (!tenantId) {
      setState({ kind: 'hidden' });
      return;
    }
    let active = true;
    setState({ kind: 'loading' });
    void api.migrationReport(tenantId)
      .then((rows) => {
        if (active) setState(rows.length > 0 ? { kind: 'ready', rows } : { kind: 'hidden' });
      })
      .catch((error) => {
        // Ce rapport est réservé aux gestionnaires. Le masquer sur refus évite
        // de révéler aux autres membres l'existence de l'audit privé.
        console.warn('[LegacyShopCustomerMigration] report unavailable', error);
        if (active) setState({ kind: 'hidden' });
      });
    return () => {
      active = false;
    };
  }, [api, tenantId]);

  return state;
}

export function useLegacyMigrationShopNames(tenantId: string | null): ReadonlyMap<string, string> {
  const { apiClient } = useWorkspaceUiRuntime();
  const api = useMemo(() => new ShopsApiClient(apiClient), [apiClient]);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    if (!tenantId) {
      setNames(new Map());
      return;
    }
    let active = true;
    void api.list(tenantId)
      .then((shops) => {
        if (active) setNames(new Map(shops.map((shop) => [shop.id, shop.name])));
      })
      .catch(() => {
        if (active) setNames(new Map());
      });
    return () => { active = false; };
  }, [api, tenantId]);

  return names;
}
