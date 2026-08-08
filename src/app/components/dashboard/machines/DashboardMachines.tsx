/**
 * REFONTE-UX (2026-08-08) — Parc machine : liste du parc constitue.
 *
 * BK-21 : tris, filtres et tags sur la liste du parc existant — tags cliquables
 * coherents avec ceux du wizard (BK-16). Edition de la qualification
 * interne / externe a posteriori (BK-09).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Factory, Wand2, AlertTriangle, Trash2, MapPin, ExternalLink as ExternalIcon,
} from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { useTenantPath } from '../../../hooks/useTenantPath';
import {
  MACHINE_TYPES, loadPark, savePark, parkIsCalculable,
  type MachinePark, type MachineTypeKey, type ParkMachine,
} from './machinePark.helpers';

export function DashboardMachines() {
  const { currentTenant } = useTenant();
  const tp = useTenantPath();
  const tenantId = currentTenant?.id ?? '';
  const [park, setPark] = useState<MachinePark | null>(() => (tenantId ? loadPark(tenantId) : null));
  const [typeFilter, setTypeFilter] = useState<MachineTypeKey | null>(null);
  const [brandFilter, setBrandFilter] = useState<string | null>(null);

  const wizardPath = tp('/dashboard/machines/wizard');

  const brands = useMemo(
    () => Array.from(new Set((park?.machines ?? []).map((m) => m.brand))).sort(),
    [park],
  );

  const visible = useMemo(
    () =>
      (park?.machines ?? []).filter(
        (m) => (!typeFilter || m.type === typeFilter) && (!brandFilter || m.brand === brandFilter),
      ),
    [park, typeFilter, brandFilter],
  );

  const update = (mutate: (p: MachinePark) => MachinePark) => {
    if (!park || !tenantId) return;
    const next = mutate(park);
    setPark(next);
    savePark(tenantId, next);
  };

  const removeMachine = (m: ParkMachine) => {
    if (!window.confirm(`Retirer ${m.brand} ${m.model} du parc ?`)) return;
    update((p) => ({ ...p, machines: p.machines.filter((x) => x.id !== m.id) }));
  };

  const setLocation = (m: ParkMachine, location: 'interne' | 'externe' | null) => {
    update((p) => ({
      ...p,
      machines: p.machines.map((x) => (x.id === m.id ? { ...x, location } : x)),
    }));
  };

  const typeLabel = (key: MachineTypeKey) => MACHINE_TYPES.find((t) => t.key === key)?.label ?? key;

  if (!park || park.machines.length === 0) {
    return (
      <div className="max-w-2xl space-y-5">
        <Header />
        <div className="border border-line rounded-xl bg-paper p-10 text-center space-y-3">
          <Factory className="w-8 h-8 text-ink-mute-2 mx-auto" strokeWidth={1.25} />
          <p className="text-ink font-medium">Aucun parc machine déclaré</p>
          <p className="text-sm text-ink-muted max-w-md mx-auto">
            Décrivez votre parc en quelques minutes avec l'assistant guidé : machines par grand
            type, fournisseurs papier et transport, modèle de coût. Un prix peut sortir dès la fin
            du parcours.
          </p>
          <Link
            to={wizardPath}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 text-sm font-medium"
          >
            <Wand2 className="w-4 h-4" strokeWidth={1.5} />
            Décrire mon parc
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <Header />
        <Link
          to={wizardPath}
          className="inline-flex items-center gap-2 px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink shrink-0"
        >
          <Wand2 className="w-4 h-4" strokeWidth={1.5} />
          Relancer l'assistant
        </Link>
      </div>

      {!parkIsCalculable(park) && (
        <div className="border border-warn-fg/30 bg-warn-bg rounded-xl p-4 flex gap-3 text-sm">
          <AlertTriangle className="w-4.5 h-4.5 text-warn-fg shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-ink-2">
            <span className="font-medium text-ink">Aucun massicot dans le parc.</span> Sans massicot,
            aucun prix ne peut être calculé — ajoutez-en un via l'assistant.
          </p>
        </div>
      )}

      {/* Filtres par tags — coherents avec le wizard (BK-16/21) */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip label="Tous types" active={!typeFilter} onClick={() => setTypeFilter(null)} />
        {MACHINE_TYPES.filter((t) => park.machines.some((m) => m.type === t.key)).map((t) => (
          <FilterChip
            key={t.key}
            label={t.label}
            active={typeFilter === t.key}
            onClick={() => setTypeFilter(typeFilter === t.key ? null : t.key)}
          />
        ))}
        <span className="w-px bg-line mx-1" />
        {brands.map((b) => (
          <FilterChip
            key={b}
            label={b}
            active={brandFilter === b}
            onClick={() => setBrandFilter(brandFilter === b ? null : b)}
          />
        ))}
      </div>

      <div className="border border-line rounded-xl bg-paper overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {['Machine', 'Type', 'Format', 'Couleurs', 'Localisation', ''].map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-ink-mute-2 font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-b-0">
                <td className="px-4 py-2.5">
                  <span className="text-ink font-medium">{m.brand}</span>{' '}
                  <span className="text-ink-2">{m.model}</span>
                </td>
                <td className="px-4 py-2.5 text-ink-muted">{typeLabel(m.type)}</td>
                <td className="px-4 py-2.5 font-mono text-ink-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {m.format}
                </td>
                <td className="px-4 py-2.5 text-ink-muted">
                  {m.colors ? `${m.colors}${m.varnish ? ' + vernis' : ''}` : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={m.location ?? ''}
                    onChange={(e) =>
                      setLocation(m, (e.target.value || null) as 'interne' | 'externe' | null)
                    }
                    className="text-sm border border-line rounded-md px-2 py-1 bg-paper text-ink-2"
                    title="Qualification interne / externe — modifiable a tout moment (BK-09)"
                  >
                    <option value="">Non renseignée</option>
                    <option value="interne">Interne</option>
                    <option value="externe">Externe (sous-traitée)</option>
                  </select>
                  {m.location === 'externe' && m.subcontractor && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-ink-muted">
                      <ExternalIcon className="w-3 h-3" strokeWidth={1.5} />
                      {m.subcontractor}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => removeMachine(m)}
                    className="p-1.5 rounded-md text-ink-muted hover:text-err-fg hover:bg-err-bg"
                    title="Retirer du parc"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-ink-muted">
        <span>
          <MapPin className="w-3.5 h-3.5 inline mr-1" strokeWidth={1.5} />
          Papier : {park.paperSuppliers.length ? park.paperSuppliers.join(', ') : 'aucun fournisseur'}
        </span>
        <span>Transport : {park.transportSuppliers.length ? park.transportSuppliers.join(', ') : 'aucun'}</span>
        <span className="font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
          Main-d'œuvre : {park.laborRate} €/h
        </span>
        {park.wizardVariant && (
          <span className="font-mono text-ink-mute-2">
            Parcours {park.wizardVariant} · {park.wizardClicks ?? '?'} clics
          </span>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h2 className="text-lg font-medium text-ink mb-1 flex items-center gap-2" style={{ letterSpacing: '-0.015em' }}>
        <Factory className="w-5 h-5" strokeWidth={1.5} />
        Parc machine
      </h2>
      <p className="text-sm text-ink-muted max-w-xl">
        Votre environnement de production et vos coûts — machines internes et sous-traitées,
        fournisseurs papier et transport. Les prix de vente, eux, se gèrent dans la Gestion
        commerciale.
      </p>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
        active
          ? 'bg-brand text-brand-ink border-brand'
          : 'bg-paper text-ink-2 border-line-2 hover:border-brand/50'
      }`}
    >
      {label}
    </button>
  );
}
