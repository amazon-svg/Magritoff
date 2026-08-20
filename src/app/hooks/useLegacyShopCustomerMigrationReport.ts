import { useEffect, useState } from 'react';
import type { LegacyShopCustomerMigrationReportRow } from '../../modules/shop-customers';
import { useShopCustomersApi } from '../contexts/ModuleClientsContext';

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
  const api = useShopCustomersApi();
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
