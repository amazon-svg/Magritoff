/**
 * REFONTE-UX (2026-08-08) — Detail d un parc machine.
 *
 * Points 8 et 9 (retour Arnaud) : on entre dans un parc depuis sa carte ;
 * cliquer sur une machine ouvre un panneau de parametrage — localisation
 * interne/externe (BK-09), sous-traitant par autocompletion (BK-10), couts de
 * transport et couts fixes (BK-13), taux horaire propre a la machine,
 * activation (esquisse du draft BK-27 : une machine inactive est exclue des
 * calculs).
 */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, AlertTriangle, Factory, Trash2, X, MapPin } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { useTenantPath } from '../../../hooks/useTenantPath';
import {
  KNOWN_SUBCONTRACTORS, MACHINE_TYPES, loadParks, parkIsCalculable, upsertPark,
  type MachinePark, type MachineTypeKey, type ParkMachine,
} from './machinePark.helpers';

const inputCls =
  'px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const labelCls = 'block text-sm font-medium text-ink-2 mb-1';

export function MachineParkDetail() {
  const { parkId } = useParams<{ parkId: string }>();
  const { currentTenant } = useTenant();
  const tp = useTenantPath();
  const tenantId = currentTenant?.id ?? '';
  const [park, setPark] = useState<MachinePark | null>(
    () => loadParks(tenantId).find((p) => p.id === parkId) ?? null,
  );
  const [typeFilter, setTypeFilter] = useState<MachineTypeKey | null>(null);
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<ParkMachine | null>(null);

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

  const persist = (next: MachinePark) => {
    setPark(next);
    upsertPark(tenantId, next);
  };

  const updateMachine = (id: string, patch: Partial<ParkMachine>) => {
    if (!park) return;
    persist({ ...park, machines: park.machines.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  };

  const removeMachine = (m: ParkMachine) => {
    if (!park || !window.confirm(`Retirer ${m.brand} ${m.model} du parc ?`)) return;
    persist({ ...park, machines: park.machines.filter((x) => x.id !== m.id) });
  };

  const typeLabel = (key: MachineTypeKey) => MACHINE_TYPES.find((t) => t.key === key)?.label ?? key;

  if (!park) {
    return (
      <div className="space-y-4">
        <BackLink to={tp('/dashboard/machines')} />
        <p className="text-sm text-ink-muted">Parc introuvable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BackLink to={tp('/dashboard/machines')} />

      <div>
        <h2 className="text-lg font-medium text-ink mb-1 flex items-center gap-2" style={{ letterSpacing: '-0.015em' }}>
          <Factory className="w-5 h-5" strokeWidth={1.5} />
          {park.name}
        </h2>
        <p className="text-sm text-ink-muted">
          {park.machines.length} machine{park.machines.length > 1 ? 's' : ''} — cliquez sur une
          machine pour la paramétrer.
        </p>
      </div>

      {!parkIsCalculable(park) && (
        <div className="border border-warn-fg/30 bg-warn-bg rounded-xl p-4 flex gap-3 text-sm max-w-2xl">
          <AlertTriangle className="w-4.5 h-4.5 text-warn-fg shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-ink-2">
            <span className="font-medium text-ink">Aucun massicot dans ce parc.</span> Sans
            massicot, aucun prix ne peut être calculé.
          </p>
        </div>
      )}

      {/* Filtres par tags — coherents avec le wizard (BK-16/21) */}
      <div className="flex flex-wrap gap-1.5">
        <Chip label="Tous types" active={!typeFilter} onClick={() => setTypeFilter(null)} />
        {MACHINE_TYPES.filter((t) => park.machines.some((m) => m.type === t.key)).map((t) => (
          <Chip
            key={t.key}
            label={t.label}
            active={typeFilter === t.key}
            onClick={() => setTypeFilter(typeFilter === t.key ? null : t.key)}
          />
        ))}
        {brands.length > 1 && <span className="w-px bg-line mx-1" />}
        {brands.length > 1 &&
          brands.map((b) => (
            <Chip
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
              {['Machine', 'Type', 'Format', 'Couleurs', 'Localisation', 'État', ''].map((h, i) => (
                <th key={i} className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-ink-mute-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <tr
                key={m.id}
                onClick={() => setEditing(m)}
                className="border-b border-line last:border-b-0 cursor-pointer hover:bg-bg transition-colors"
                title="Paramétrer cette machine"
              >
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
                  {m.location === 'externe' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                      <MapPin className="w-3 h-3" strokeWidth={1.5} />
                      Externe{m.subcontractor ? ` · ${m.subcontractor}` : ''}
                    </span>
                  ) : m.location === 'interne' ? (
                    <span className="text-xs text-ink-2">Interne</span>
                  ) : (
                    <span className="text-xs text-ink-mute-2">Non renseignée</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {m.active === false ? (
                    <span className="text-[11px] font-mono text-warn-fg bg-warn-bg px-1.5 py-0.5 rounded">inactive</span>
                  ) : (
                    <span className="text-[11px] font-mono text-ok-fg bg-ok-bg px-1.5 py-0.5 rounded">active</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMachine(m);
                    }}
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
        <span>Papier : {park.paperSuppliers.join(', ') || 'aucun fournisseur'}</span>
        <span>Transport : {park.transportSuppliers.join(', ') || 'aucun'}</span>
        <span className="font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
          Main-d'œuvre : {park.laborRate} €/h
        </span>
      </div>

      {editing && (
        <MachineDialog
          machine={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateMachine(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
      <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
      Tous les parcs
    </Link>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
        active ? 'bg-brand text-brand-ink border-brand' : 'bg-paper text-ink-2 border-line-2 hover:border-brand/50'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Panneau de parametrage d une machine (point 9).
 */
function MachineDialog({
  machine, onClose, onSave,
}: {
  machine: ParkMachine;
  onClose: () => void;
  onSave: (patch: Partial<ParkMachine>) => void;
}) {
  const [location, setLocation] = useState<ParkMachine['location']>(machine.location);
  const [subcontractor, setSubcontractor] = useState(machine.subcontractor ?? '');
  const [transportCost, setTransportCost] = useState(String(machine.transportCost ?? 0));
  const [fixedCost, setFixedCost] = useState(String(machine.fixedCost ?? 0));
  const [hourlyRate, setHourlyRate] = useState(machine.hourlyRate != null ? String(machine.hourlyRate) : '');
  const [active, setActive] = useState(machine.active !== false);

  const suggestions = KNOWN_SUBCONTRACTORS.filter(
    (s) => subcontractor && s.toLowerCase().includes(subcontractor.toLowerCase()) && s !== subcontractor,
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="bg-paper rounded-xl border border-line shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-ink">
              {machine.brand} {machine.model}
            </h3>
            <p className="font-mono text-[11px] text-ink-mute-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {machine.format}
              {machine.colors ? ` · ${machine.colors} groupes` : ''}
              {machine.varnish ? ' · vernis' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-bg">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div>
          <label className={labelCls}>Localisation</label>
          <select
            value={location ?? ''}
            onChange={(e) => setLocation((e.target.value || null) as ParkMachine['location'])}
            className={`${inputCls} w-full`}
          >
            <option value="">Non renseignée (autorisé — affinable plus tard)</option>
            <option value="interne">Interne</option>
            <option value="externe">Externe (sous-traitée)</option>
          </select>
        </div>

        {location === 'externe' && (
          <>
            <div className="relative">
              <label className={labelCls}>Sous-traitant</label>
              <input
                type="text"
                value={subcontractor}
                onChange={(e) => setSubcontractor(e.target.value)}
                placeholder="Nom du sous-traitant…"
                className={`${inputCls} w-full`}
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-paper border border-line rounded-lg shadow-sm overflow-hidden">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSubcontractor(s)}
                      className="block w-full text-left px-3 py-1.5 text-xs text-ink-2 hover:bg-bg"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Transport (€/job)</label>
                <input type="number" min="0" step="1" value={transportCost} onChange={(e) => setTransportCost(e.target.value)} className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className={labelCls}>Coûts fixes (€)</label>
                <input type="number" min="0" step="1" value={fixedCost} onChange={(e) => setFixedCost(e.target.value)} className={`${inputCls} w-full`} />
              </div>
            </div>
          </>
        )}

        <div>
          <label className={labelCls}>Taux horaire spécifique (€/h)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            placeholder="Vide = taux du parc"
            className={`${inputCls} w-full`}
          />
        </div>

        <button
          type="button"
          onClick={() => setActive(!active)}
          className="flex items-center gap-2 text-sm text-ink-2"
        >
          <span
            className={`w-9 h-5 rounded-full p-0.5 transition-colors ${active ? 'bg-brand' : 'bg-line-2'}`}
          >
            <span
              className={`block w-4 h-4 rounded-full bg-paper transition-transform ${active ? 'translate-x-4' : ''}`}
            />
          </span>
          Machine active dans les calculs
          <span className="text-xs text-ink-mute-2">(inactive = exclue des prix servis)</span>
        </button>

        <div className="flex justify-end gap-2 pt-1">
          <button
            className="px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink"
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            className="px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 text-sm font-medium"
            onClick={() =>
              onSave({
                location,
                subcontractor: location === 'externe' ? subcontractor || undefined : undefined,
                transportCost: location === 'externe' ? Number(transportCost) || 0 : undefined,
                fixedCost: location === 'externe' ? Number(fixedCost) || 0 : undefined,
                hourlyRate: hourlyRate === '' ? undefined : Number(hourlyRate),
                active,
              })
            }
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
