import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { LegacyShopCustomerMigrationReportRow } from '../../../modules/shop-customers';
import { useShopCustomersApi } from '../../contexts/ModuleClientsContext';
import { useShops } from '../../contexts/ShopsContext';
import { useTenant } from '../../contexts/TenantContext';

type ReportState =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'ready'; rows: LegacyShopCustomerMigrationReportRow[] };

export function LegacyShopCustomerMigrationSection() {
  const api = useShopCustomersApi();
  const { currentTenant } = useTenant();
  const { shops } = useShops();
  const [state, setState] = useState<ReportState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    if (!currentTenant) {
      setState({ kind: 'hidden' });
      return () => { active = false; };
    }

    setState({ kind: 'loading' });
    api.migrationReport(currentTenant.id)
      .then((rows) => {
        if (active) setState(rows.length > 0 ? { kind: 'ready', rows } : { kind: 'hidden' });
      })
      .catch((error) => {
        // La surface est réservée aux gestionnaires. Un refus d'autorisation ne
        // doit pas polluer l'écran des autres membres ni révéler l'audit privé.
        console.warn('[LegacyShopCustomerMigration] report unavailable', error);
        if (active) setState({ kind: 'hidden' });
      });

    return () => { active = false; };
  }, [api, currentTenant?.id]);

  if (state.kind !== 'ready') return null;

  const pending = state.rows.filter((row) => row.migrationOutcome === null).length;
  const skipped = state.rows.filter((row) => row.migrationOutcome?.startsWith('skipped_')).length;
  const ordersLinked = state.rows.reduce((total, row) => total + row.ordersLinkedCount, 0);
  const shopName = (shopId: string | null) => shops.find((shop) => shop.id === shopId)?.name
    ?? (shopId ? `Boutique ${shopId.slice(0, 8)}` : 'Aucune boutique');

  return (
    <section
      className="rounded-lg border border-warn-fg/25 bg-warn-bg/45 p-4"
      data-testid="legacy-shop-customer-migration-report"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn-fg" strokeWidth={1.7} />
          <div>
            <h2 className="m-0 text-base font-medium text-ink">Migration des anciens accès boutique</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Ces accès <code>shop_only</code> ont été convertis en comptes propres à chaque boutique.
              Ils restent visibles ici jusqu’au nettoyage final UM8.
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-xs text-ink-muted">
          <div>{state.rows.length} rattachement{state.rows.length > 1 ? 's' : ''}</div>
          <div>{ordersLinked} commande{ordersLinked > 1 ? 's' : ''} reliée{ordersLinked > 1 ? 's' : ''}</div>
        </div>
      </div>

      {(pending > 0 || skipped > 0) && (
        <p className="mt-3 rounded border border-warn-fg/20 bg-paper/70 px-3 py-2 text-sm text-warn-fg">
          Contrôle requis : {pending} rattachement{pending > 1 ? 's' : ''} sans résultat,
          {' '}{skipped} ligne{skipped > 1 ? 's' : ''} ignorée{skipped > 1 ? 's' : ''}.
        </p>
      )}

      <div className="mt-3 overflow-hidden rounded-md border border-line bg-paper">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-bg/50 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink-mute-2">
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Boutique</th>
              <th className="px-3 py-2 font-medium">Résultat</th>
              <th className="px-3 py-2 text-right font-medium">Commandes</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row) => {
              const completed = row.migrationOutcome === 'created'
                || row.migrationOutcome === 'matched_existing';
              return (
                <tr key={`${row.legacyUserId}:${row.shopId ?? 'none'}`} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-ink">{row.normalizedEmail ?? 'Email absent'}</td>
                  <td className="px-3 py-2 text-ink-muted">{shopName(row.shopId)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 ${completed ? 'text-ok-fg' : 'text-warn-fg'}`}>
                      {completed && <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />}
                      {migrationLabel(row)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink-muted">{row.ordersLinkedCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function migrationLabel(row: LegacyShopCustomerMigrationReportRow): string {
  switch (row.migrationOutcome) {
    case 'created': return 'Compte boutique créé';
    case 'matched_existing': return 'Compte existant réutilisé';
    case 'skipped_no_shop': return 'Aucune boutique autorisée';
    case 'skipped_invalid_shop': return 'Boutique invalide';
    case 'skipped_missing_email': return 'Email absent';
    case 'skipped_invalid_email': return 'Email invalide';
    default: return row.proposedAction === 'create_delegated' ? 'À migrer' : 'À contrôler';
  }
}
