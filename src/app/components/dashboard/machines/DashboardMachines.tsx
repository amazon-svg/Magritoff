/**
 * REFONTE-UX (2026-08-08) — Parc machine : liste des parcs en cartes.
 *
 * Point 8 (retour Arnaud) : un client a potentiellement PLUSIEURS parcs —
 * chaque parc constitue est presente comme une carte (façon product card)
 * dans laquelle on entre pour voir le detail (MachineParkDetail).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { Factory, Wand2, AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { useTenantPath } from '../../../hooks/useTenantPath';
import { useCurrency } from '../../../contexts/CurrencyContext';
import { formatCurrencyPerUnit } from '../../../utils/currency';
import {
  MACHINE_TYPES, deletePark, loadParks, parkIsCalculable,
  type MachinePark,
} from './machinePark.helpers';

export function DashboardMachines() {
  const { currentTenant } = useTenant();
  // Multi-devise tranche 1 : seul l AFFICHAGE de l unite suit la devise ici.
  // Le modele de cout du parc machine passe en `Money` en tranche 2.
  const currency = useCurrency();
  const tp = useTenantPath();
  const tenantId = currentTenant?.id ?? '';
  const [parks, setParks] = useState<MachinePark[]>(() => (tenantId ? loadParks(tenantId) : []));

  const wizardPath = tp('/dashboard/machines/wizard');

  const removePark = (park: MachinePark) => {
    if (!window.confirm(`Supprimer le parc « ${park.name} » et ses ${park.machines.length} machines ?`)) return;
    deletePark(tenantId, park.id);
    setParks(loadParks(tenantId));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-ink mb-1 flex items-center gap-2" style={{ letterSpacing: '-0.015em' }}>
            <Factory className="w-5 h-5" strokeWidth={1.5} />
            Parc machine
          </h2>
          <p className="text-sm text-ink-muted max-w-xl">
            Vos environnements de production — machines internes et sous-traitées, fournisseurs,
            modèle de coût. Un client peut avoir plusieurs parcs (sites, ateliers, lignes).
          </p>
        </div>
        {parks.length > 0 && (
          <Link
            to={wizardPath}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink shrink-0"
          >
            <Wand2 className="w-4 h-4" strokeWidth={1.5} />
            Nouveau parc
          </Link>
        )}
      </div>

      {parks.length === 0 ? (
        <div className="border border-line rounded-xl bg-paper p-10 text-center space-y-3 max-w-2xl">
          <Factory className="w-8 h-8 text-ink-mute-2 mx-auto" strokeWidth={1.25} />
          <p className="text-ink font-medium">Aucun parc machine déclaré</p>
          <p className="text-sm text-ink-muted max-w-md mx-auto">
            Décrivez votre premier parc en quelques minutes avec l'assistant guidé : machines par
            grand type, fournisseurs papier et transport, modèle de coût.
          </p>
          <Link
            to={wizardPath}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 text-sm font-medium"
          >
            <Wand2 className="w-4 h-4" strokeWidth={1.5} />
            Décrire mon parc
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {parks.map((park) => {
            const calculable = parkIsCalculable(park);
            const typeCount = MACHINE_TYPES.filter((t) =>
              park.machines.some((m) => m.type === t.key),
            ).length;
            const external = park.machines.filter((m) => m.location === 'externe').length;
            return (
              <div
                key={park.id}
                className="relative border border-line rounded-xl bg-paper hover:border-brand/50 hover:shadow-sm transition-all group"
              >
                <Link to={tp(`/dashboard/machines/${park.id}`)} className="block p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-ink font-medium" style={{ letterSpacing: '-0.01em' }}>
                      {park.name}
                    </p>
                    {calculable ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ok-fg bg-ok-bg px-1.5 py-0.5 rounded" title="Le parc peut sortir un prix">
                        <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />
                        calculable
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-warn-fg bg-warn-bg px-1.5 py-0.5 rounded" title="Massicot manquant — aucun prix ne peut sortir">
                        <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />
                        massicot manquant
                      </span>
                    )}
                  </div>
                  <p
                    className="text-2xl text-ink font-mono"
                    style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 400 }}
                  >
                    {park.machines.length}
                    <span className="text-sm text-ink-muted font-sans">
                      {' '}machine{park.machines.length > 1 ? 's' : ''}
                    </span>
                  </p>
                  <p className="text-xs text-ink-muted">
                    {typeCount} type{typeCount > 1 ? 's' : ''} de production
                    {external > 0 && ` · ${external} sous-traitée${external > 1 ? 's' : ''}`}
                  </p>
                  <p className="font-mono text-[11px] text-ink-mute-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {park.paperSuppliers.length} fourn. papier · {park.transportSuppliers.length} transport
                    · {park.laborRate} {formatCurrencyPerUnit(currency, 'h')}
                    {park.wizardVariant && ` · parcours ${park.wizardVariant} (${park.wizardClicks ?? '?'} clics)`}
                  </p>
                </Link>
                <button
                  onClick={() => removePark(park)}
                  className="absolute bottom-3 right-3 p-1.5 rounded-md text-ink-mute-2 hover:text-err-fg hover:bg-err-bg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Supprimer ce parc"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            );
          })}
          <Link
            to={wizardPath}
            className="border border-dashed border-line-2 rounded-xl grid place-items-center p-5 text-ink-muted hover:text-ink hover:border-brand/50 transition-colors min-h-[150px]"
          >
            <span className="inline-flex items-center gap-2 text-sm">
              <Wand2 className="w-4 h-4" strokeWidth={1.5} />
              Nouveau parc
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
