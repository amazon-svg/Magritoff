/**
 * REFONTE-UX (2026-08-08) — Wizard Parc machine (RP#070826).
 *
 * Implemente les logiques detaillees en seance avec Xavier Pechoultres :
 *
 *   BK-15 — DEUX PARCOURS COMPARATIFS, au choix sur l ecran d entree :
 *     A « Déroulé complet »   (position Expert Solutions) : question binaire
 *       type par type, dans l ordre fixe, aucune navigation libre.
 *     B « Types déclarés »    (position AGE Dvt.) : qualification prealable
 *       des types de production pratiques, puis passage en revue des seuls
 *       types declares, navigation par onglets dynamiques.
 *     Le COMPTEUR DE CLICS (critere d arbitrage acte en seance) est affiche
 *     en permanence et consigne dans le parc a la fin du parcours.
 *
 *   BK-16 — selection par tags / facettes (marque, format, couleurs, vernis),
 *     logique panier, pas d arborescence.
 *   BK-17 — massicot obligatoire (blocage explicite, le message dit la
 *     consequence), confirmation si aucune plieuse.
 *   BK-09/10 — qualification interne / externe DISPONIBLE mais non bloquante ;
 *     machine externe → sous-traitant par autocompletion, cout transport
 *     (zero admis, BK-13).
 *   BK-18 — ecrans fournisseurs papier et transport SEPARES (papier d abord).
 *   BK-19 — champs encres avec valeurs par defaut.
 *   BK-22 — modele de cout : taux horaire main d oeuvre saisi (defaut
 *     propose), kWh en valeur par defaut non saisie.
 *   BK-20 — ecran recapitulatif, retour par section, atterrissage sur le parc.
 */
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Factory, ArrowRight, ArrowLeft, Check, ShoppingCart, X, AlertTriangle,
  MousePointerClick, Wand2,
} from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { useTenantPath } from '../../../hooks/useTenantPath';
import {
  DEFAULT_ENERGY_RATE, DEFAULT_INKS, DEFAULT_LABOR_RATE, KNOWN_SUBCONTRACTORS,
  MACHINE_LIBRARY, MACHINE_TYPES, PAPER_SUPPLIERS, TRANSPORT_SUPPLIERS,
  parkIsCalculable, savePark,
  type LibraryMachine, type MachinePark, type MachineTypeDef, type MachineTypeKey, type ParkMachine,
} from './machinePark.helpers';

type Variant = 'A' | 'B';

/** Etapes hors types machines, communes aux deux parcours (BK-18/19/22/20). */
type FinalStep = 'paper' | 'transport' | 'inks' | 'costs' | 'recap';
const FINAL_STEPS: FinalStep[] = ['paper', 'transport', 'inks', 'costs', 'recap'];
const FINAL_STEP_LABEL: Record<FinalStep, string> = {
  paper: 'Fournisseurs papier',
  transport: 'Fournisseurs transport',
  inks: 'Encres',
  costs: 'Modèle de coût',
  recap: 'Récapitulatif',
};

const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium inline-flex items-center gap-2';
const btnGhost =
  'px-4 py-2 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink inline-flex items-center gap-2';
const inputCls =
  'px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';

export function MachineParkWizard() {
  const { currentTenant } = useTenant();
  const tp = useTenantPath();
  const navigate = useNavigate();

  // ── Etat global du parcours ────────────────────────────────────────────────
  const [variant, setVariant] = useState<Variant | null>(null);
  /** Parcours B : types declares a la qualification prealable. */
  const [declaredTypes, setDeclaredTypes] = useState<MachineTypeKey[]>([]);
  /** Position dans la sequence de types (A : index MACHINE_TYPES ; B : index declaredTypes). */
  const [typeIndex, setTypeIndex] = useState(0);
  /** Parcours A : phase question binaire vs picker pour le type courant. */
  const [phase, setPhase] = useState<'question' | 'pick'>('question');
  const [finalStep, setFinalStep] = useState<FinalStep | null>(null);
  const [confirmingEmpty, setConfirmingEmpty] = useState<MachineTypeDef | null>(null);

  // ── Donnees du parc en cours de constitution ───────────────────────────────
  const [selected, setSelected] = useState<ParkMachine[]>([]);
  const [paperSuppliers, setPaperSuppliers] = useState<string[]>([PAPER_SUPPLIERS[0]]);
  const [transportSuppliers, setTransportSuppliers] = useState<string[]>([]);
  const [inks, setInks] = useState(DEFAULT_INKS);
  const [laborRate, setLaborRate] = useState(String(DEFAULT_LABOR_RATE));
  const [showEnergyDefault, setShowEnergyDefault] = useState(false);

  // ── Compteur de clics — critere d arbitrage BK-15 ──────────────────────────
  const [clicks, setClicks] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const typeSequence: MachineTypeDef[] = useMemo(() => {
    if (variant === 'B')
      return MACHINE_TYPES.filter((t) => declaredTypes.includes(t.key));
    return MACHINE_TYPES;
  }, [variant, declaredTypes]);

  const currentType: MachineTypeDef | null =
    variant && finalStep === null ? typeSequence[typeIndex] ?? null : null;

  const goNextType = () => {
    if (typeIndex + 1 < typeSequence.length) {
      setTypeIndex(typeIndex + 1);
      setPhase('question');
    } else {
      setFinalStep('paper');
    }
  };

  /** Sortie d un type : verifie la confirmation plieuse (BK-17). */
  const leaveType = (t: MachineTypeDef) => {
    const hasAny = selected.some((m) => m.type === t.key);
    if (!hasAny && t.confirmIfEmpty && confirmingEmpty?.key !== t.key) {
      setConfirmingEmpty(t);
      return;
    }
    setConfirmingEmpty(null);
    goNextType();
  };

  const addMachine = (lib: LibraryMachine) => {
    const count = selected.filter((m) => m.libraryId === lib.id).length;
    setSelected((s) => [
      ...s,
      {
        id: count === 0 ? lib.id : `${lib.id}-${count + 1}`,
        libraryId: lib.id,
        type: lib.type,
        brand: lib.brand,
        model: lib.model,
        format: lib.format,
        colors: lib.colors,
        varnish: lib.varnish,
        location: null,
      },
    ]);
  };

  const removeMachine = (id: string) => setSelected((s) => s.filter((m) => m.id !== id));

  const updateMachine = (id: string, patch: Partial<ParkMachine>) =>
    setSelected((s) => s.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const finish = () => {
    if (!currentTenant) return;
    const park: MachinePark = {
      machines: selected,
      paperSuppliers,
      transportSuppliers,
      inks,
      laborRate: Number(laborRate) || DEFAULT_LABOR_RATE,
      energyRate: DEFAULT_ENERGY_RATE,
      wizardVariant: variant ?? undefined,
      wizardClicks: clicks,
      completedAt: new Date().toISOString(),
    };
    savePark(currentTenant.id, park);
    navigate(tp('/dashboard/machines'));
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div
      ref={rootRef}
      onClickCapture={() => setClicks((c) => c + 1)}
      className="max-w-3xl space-y-6"
    >
      {/* Bandeau : titre + compteur de clics (arbitrage BK-15) */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-ink mb-1 flex items-center gap-2" style={{ letterSpacing: '-0.015em' }}>
            <Wand2 className="w-5 h-5" strokeWidth={1.5} />
            Assistant parc machine
          </h2>
          <p className="text-sm text-ink-muted">
            Objectif : un parc complet, le plus vite possible. Tout s'affine ensuite, machine par
            machine.
          </p>
        </div>
        <span
          className="font-mono text-[11px] text-ink-mute-2 border border-line rounded-md px-2 py-1 inline-flex items-center gap-1.5 shrink-0"
          title="Nombre de clics depuis le debut du parcours — critere d arbitrage des deux maquettes (RP#070826)"
        >
          <MousePointerClick className="w-3.5 h-3.5" strokeWidth={1.5} />
          {clicks} clic{clicks > 1 ? 's' : ''}
          {variant && <span className="text-ink-muted">· parcours {variant}</span>}
        </span>
      </div>

      {/* ── Ecran d entree : choix du parcours (BK-15) ── */}
      {variant === null && (
        <div className="space-y-4">
          <p className="text-sm text-ink-2 max-w-xl">
            Deux parcours sont proposés pour l'arbitrage ergonomique décidé en séance du 7 août
            (critère : nombre de clics jusqu'au premier prix, et taux d'oubli d'équipement).
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <VariantCard
              title="Parcours A — Déroulé complet"
              subtitle="Position Expert Solutions"
              body="L'assistant passe en revue TOUS les types de machines, un par un. Garantie d'exhaustivité : impossible d'oublier un poste nécessaire au calcul."
              onPick={() => setVariant('A')}
            />
            <VariantCard
              title="Parcours B — Types déclarés"
              subtitle="Position AGE Dvt."
              body="Vous déclarez d'abord vos types de production, puis l'assistant ne passe en revue que ceux-là. Moins d'écrans, navigation par onglets."
              onPick={() => setVariant('B')}
            />
          </div>
        </div>
      )}

      {/* ── Parcours B : qualification prealable ── */}
      {variant === 'B' && declaredTypes.length === 0 && finalStep === null && typeIndex === 0 && (
        <BQualification
          onValidate={(types) => {
            setDeclaredTypes(types);
            setTypeIndex(0);
            setPhase('pick');
          }}
        />
      )}

      {/* ── Etapes types machines ── */}
      {currentType && (variant === 'A' || declaredTypes.length > 0) && (
        <div className="space-y-4">
          {/* Fil d ariane / onglets */}
          {variant === 'B' ? (
            <div className="flex flex-wrap gap-1.5">
              {typeSequence.map((t, i) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setTypeIndex(i);
                    setPhase('pick');
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    i === typeIndex
                      ? 'bg-brand text-brand-ink border-brand'
                      : 'bg-paper text-ink-2 border-line-2 hover:border-brand/50'
                  }`}
                >
                  {t.label}
                  {selected.some((m) => m.type === t.key) && ' ✓'}
                </button>
              ))}
            </div>
          ) : (
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-mute-2">
              Étape {typeIndex + 1} / {typeSequence.length} — {currentType.label}
            </p>
          )}

          {/* Parcours A : question binaire d abord */}
          {variant === 'A' && phase === 'question' ? (
            <div className="border border-line rounded-xl bg-paper p-8 text-center space-y-4">
              <p className="text-ink text-base font-medium">{currentType.question}</p>
              {currentType.mandatory && (
                <p className="text-sm text-warn-fg">
                  Poste indispensable : sans massicot, aucun prix ne peut sortir.
                </p>
              )}
              <div className="flex justify-center gap-3">
                <button className={btnPrimary} onClick={() => setPhase('pick')}>
                  Oui
                </button>
                <button
                  className={btnGhost}
                  onClick={() => leaveType(currentType)}
                >
                  Non
                </button>
              </div>
            </div>
          ) : (
            <MachinePicker
              type={currentType}
              selected={selected}
              onAdd={addMachine}
              onRemove={removeMachine}
              onUpdate={updateMachine}
            />
          )}

          {/* Navigation bas d ecran */}
          {(variant === 'B' || phase === 'pick') && (
            <div className="flex justify-between">
              <button
                className={btnGhost}
                onClick={() => {
                  if (variant === 'A' && phase === 'pick') setPhase('question');
                  else if (typeIndex > 0) {
                    setTypeIndex(typeIndex - 1);
                    setPhase('pick');
                  } else if (variant === 'B') setDeclaredTypes([]);
                }}
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                Retour
              </button>
              <button className={btnPrimary} onClick={() => leaveType(currentType)}>
                Continuer
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          )}

          {/* Confirmation plieuse absente (BK-17) */}
          {confirmingEmpty && (
            <div className="border border-warn-fg/30 bg-warn-bg rounded-xl p-4 space-y-3 text-sm">
              <p className="text-ink-2 flex gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-warn-fg shrink-0 mt-0.5" strokeWidth={1.5} />
                {confirmingEmpty.confirmIfEmpty}
              </p>
              <div className="flex gap-2 pl-6">
                <button
                  className={btnGhost}
                  onClick={() => {
                    setConfirmingEmpty(null);
                    goNextType();
                  }}
                >
                  Oui, aucune plieuse
                </button>
                <button className={btnPrimary} onClick={() => setConfirmingEmpty(null)}>
                  En ajouter une
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Etapes finales ── */}
      {finalStep && (
        <FinalSteps
          step={finalStep}
          setStep={setFinalStep}
          selected={selected}
          paperSuppliers={paperSuppliers}
          setPaperSuppliers={setPaperSuppliers}
          transportSuppliers={transportSuppliers}
          setTransportSuppliers={setTransportSuppliers}
          inks={inks}
          setInks={setInks}
          laborRate={laborRate}
          setLaborRate={setLaborRate}
          showEnergyDefault={showEnergyDefault}
          setShowEnergyDefault={setShowEnergyDefault}
          onBackToTypes={() => {
            setFinalStep(null);
            setTypeIndex(typeSequence.length - 1);
            setPhase('pick');
          }}
          onFinish={finish}
          variant={variant}
          clicks={clicks}
        />
      )}
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function VariantCard({
  title, subtitle, body, onPick,
}: {
  title: string;
  subtitle: string;
  body: string;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      className="text-left border border-line rounded-xl bg-paper p-5 space-y-2 hover:border-brand/60 hover:shadow-sm transition-all"
    >
      <p className="text-ink font-medium">{title}</p>
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-mute-2">{subtitle}</p>
      <p className="text-sm text-ink-muted">{body}</p>
      <span className="text-sm text-brand font-medium inline-flex items-center gap-1">
        Choisir ce parcours <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
      </span>
    </button>
  );
}

function BQualification({ onValidate }: { onValidate: (types: MachineTypeKey[]) => void }) {
  const [picked, setPicked] = useState<MachineTypeKey[]>(['massicot']);
  const toggle = (key: MachineTypeKey) =>
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  return (
    <div className="border border-line rounded-xl bg-paper p-6 space-y-4">
      <p className="text-ink font-medium">Quels types de production pratiquez-vous ?</p>
      <p className="text-sm text-ink-muted">
        Seuls les types cochés seront passés en revue. Le massicot est pré-coché : sans lui, aucun
        prix ne peut sortir.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {MACHINE_TYPES.map((t) => (
          <label
            key={t.key}
            className={`flex items-center gap-2.5 border rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors ${
              picked.includes(t.key)
                ? 'border-brand bg-brand-soft text-ink'
                : 'border-line text-ink-2 hover:border-line-2'
            }`}
          >
            <input
              type="checkbox"
              checked={picked.includes(t.key)}
              onChange={() => toggle(t.key)}
            />
            {t.label}
            {t.mandatory && <span className="ml-auto text-[11px] font-mono text-warn-fg">requis</span>}
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          className={btnPrimary}
          disabled={picked.length === 0}
          onClick={() => onValidate([...picked])}
        >
          Continuer
          <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

/** Selection par facettes + panier (BK-16). */
function MachinePicker({
  type, selected, onAdd, onRemove, onUpdate,
}: {
  type: MachineTypeDef;
  selected: ParkMachine[];
  onAdd: (m: LibraryMachine) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ParkMachine>) => void;
}) {
  const [brandFacet, setBrandFacet] = useState<string | null>(null);
  const [colorFacet, setColorFacet] = useState<number | null>(null);
  const [varnishFacet, setVarnishFacet] = useState(false);

  const pool = useMemo(() => MACHINE_LIBRARY.filter((m) => m.type === type.key), [type.key]);
  const brands = useMemo(() => Array.from(new Set(pool.map((m) => m.brand))).sort(), [pool]);
  const colorOptions = useMemo(
    () => Array.from(new Set(pool.map((m) => m.colors).filter(Boolean))).sort() as number[],
    [pool],
  );

  const visible = pool.filter(
    (m) =>
      (!brandFacet || m.brand === brandFacet) &&
      (!colorFacet || m.colors === colorFacet) &&
      (!varnishFacet || m.varnish),
  );

  const inCart = selected.filter((m) => m.type === type.key);

  return (
    <div className="space-y-4">
      {/* Facettes — tags cliquables, pas d arborescence (BK-16) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {brands.map((b) => (
          <FacetChip key={b} label={b} active={brandFacet === b} onClick={() => setBrandFacet(brandFacet === b ? null : b)} />
        ))}
        {colorOptions.length > 0 && <span className="w-px h-4 bg-line mx-1" />}
        {colorOptions.map((c) => (
          <FacetChip
            key={c}
            label={`${c} couleurs`}
            active={colorFacet === c}
            onClick={() => setColorFacet(colorFacet === c ? null : c)}
          />
        ))}
        {pool.some((m) => m.varnish) && (
          <FacetChip label="Groupe vernis" active={varnishFacet} onClick={() => setVarnishFacet(!varnishFacet)} />
        )}
      </div>

      {/* Bibliotheque filtree */}
      <div className="grid sm:grid-cols-2 gap-2">
        {visible.map((m) => (
          <button
            key={m.id}
            onClick={() => onAdd(m)}
            className="text-left border border-line rounded-lg bg-paper px-3 py-2.5 hover:border-brand/60 transition-colors"
          >
            <p className="text-sm text-ink">
              <span className="font-medium">{m.brand}</span> {m.model}
            </p>
            <p className="font-mono text-[11px] text-ink-mute-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {m.format}
              {m.colors ? ` · ${m.colors} gr.` : ''}
              {m.varnish ? ' · vernis' : ''}
            </p>
          </button>
        ))}
        {visible.length === 0 && (
          <p className="text-sm text-ink-muted col-span-2 py-4 text-center">
            Aucune machine ne correspond aux filtres.
          </p>
        )}
      </div>

      {/* Panier du type courant */}
      {inCart.length > 0 && (
        <div className="border border-line rounded-xl bg-bg p-4 space-y-2.5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-mute-2 flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" strokeWidth={1.5} />
            Dans le parc — {type.label}
          </p>
          {inCart.map((m) => (
            <CartRow key={m.id} machine={m} onRemove={() => onRemove(m.id)} onUpdate={(p) => onUpdate(m.id, p)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FacetChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

/** Ligne panier : qualification interne/externe optionnelle (BK-09/10/13). */
function CartRow({
  machine, onRemove, onUpdate,
}: {
  machine: ParkMachine;
  onRemove: () => void;
  onUpdate: (patch: Partial<ParkMachine>) => void;
}) {
  const [showSub, setShowSub] = useState(machine.location === 'externe');
  const suggestions = KNOWN_SUBCONTRACTORS.filter(
    (s) =>
      machine.subcontractor &&
      s.toLowerCase().includes(machine.subcontractor.toLowerCase()) &&
      s !== machine.subcontractor,
  );

  return (
    <div className="bg-paper border border-line rounded-lg px-3 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink">
          <span className="font-medium">{machine.brand}</span> {machine.model}
        </span>
        <select
          value={machine.location ?? ''}
          onChange={(e) => {
            const loc = (e.target.value || null) as ParkMachine['location'];
            onUpdate({ location: loc });
            setShowSub(loc === 'externe');
          }}
          className="ml-auto text-xs border border-line rounded-md px-1.5 py-1 bg-paper text-ink-2"
          title="Facultatif — editable plus tard sur la fiche machine"
        >
          <option value="">Interne / externe ?</option>
          <option value="interne">Interne</option>
          <option value="externe">Externe (sous-traitée)</option>
        </select>
        <button onClick={onRemove} className="p-1 rounded-md text-ink-muted hover:text-err-fg hover:bg-err-bg" title="Retirer">
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
      {showSub && (
        <div className="flex flex-wrap gap-2 items-start pl-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Sous-traitant…"
              value={machine.subcontractor ?? ''}
              onChange={(e) => onUpdate({ subcontractor: e.target.value })}
              className={`${inputCls} w-56 text-xs`}
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-56 bg-paper border border-line rounded-lg shadow-sm overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => onUpdate({ subcontractor: s })}
                    className="block w-full text-left px-3 py-1.5 text-xs text-ink-2 hover:bg-bg"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="text-xs text-ink-muted flex items-center gap-1.5">
            Transport (€/job)
            <input
              type="number"
              min="0"
              step="1"
              value={machine.transportCost ?? 0}
              onChange={(e) => onUpdate({ transportCost: Number(e.target.value) })}
              className={`${inputCls} w-20 text-xs`}
            />
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Etapes finales : papier / transport / encres / couts / recap ────────────

function FinalSteps(props: {
  step: FinalStep;
  setStep: (s: FinalStep) => void;
  selected: ParkMachine[];
  paperSuppliers: string[];
  setPaperSuppliers: (v: string[]) => void;
  transportSuppliers: string[];
  setTransportSuppliers: (v: string[]) => void;
  inks: { type: string; costPerKg: number }[];
  setInks: (v: { type: string; costPerKg: number }[]) => void;
  laborRate: string;
  setLaborRate: (v: string) => void;
  showEnergyDefault: boolean;
  setShowEnergyDefault: (v: boolean) => void;
  onBackToTypes: () => void;
  onFinish: () => void;
  variant: Variant | null;
  clicks: number;
}) {
  const {
    step, setStep, selected, paperSuppliers, setPaperSuppliers, transportSuppliers,
    setTransportSuppliers, inks, setInks, laborRate, setLaborRate, showEnergyDefault,
    setShowEnergyDefault, onBackToTypes, onFinish, variant, clicks,
  } = props;

  const stepIdx = FINAL_STEPS.indexOf(step);
  const calculable = parkIsCalculable({ machines: selected });

  const toggleIn = (list: string[], setList: (v: string[]) => void, item: string) =>
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <div className="space-y-4">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-mute-2">
        {FINAL_STEP_LABEL[step]} — étape {stepIdx + 1} / {FINAL_STEPS.length}
      </p>

      {step === 'paper' && (
        <CheckList
          intro="Chez qui achetez-vous votre papier ? Votre propre stock compte : beaucoup d'imprimeurs stockent leurs papiers courants et pratiquent un prix à la feuille."
          options={PAPER_SUPPLIERS}
          value={paperSuppliers}
          onToggle={(s) => toggleIn(paperSuppliers, setPaperSuppliers, s)}
        />
      )}

      {step === 'transport' && (
        <CheckList
          intro="Qui livre vos travaux ? Les grilles tarifaires négociées s'importent ensuite (CSV) — les API transporteurs ne connaissent pas vos conditions."
          options={TRANSPORT_SUPPLIERS}
          value={transportSuppliers}
          onToggle={(s) => toggleIn(transportSuppliers, setTransportSuppliers, s)}
        />
      )}

      {step === 'inks' && (
        <div className="border border-line rounded-xl bg-paper p-5 space-y-3">
          <p className="text-sm text-ink-muted">
            Coûts encres par défaut — modifiables, ils affinent le calcul des consommables.
          </p>
          {inks.map((ink, i) => (
            <label key={ink.type} className="flex items-center gap-3 text-sm text-ink-2">
              <span className="flex-1">{ink.type}</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={ink.costPerKg}
                onChange={(e) =>
                  setInks(inks.map((x, j) => (j === i ? { ...x, costPerKg: Number(e.target.value) } : x)))
                }
                className={`${inputCls} w-24`}
              />
              <span className="font-mono text-[11px] text-ink-mute-2 w-10">€/kg</span>
            </label>
          ))}
        </div>
      )}

      {step === 'costs' && (
        <div className="border border-line rounded-xl bg-paper p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Taux horaire main-d'œuvre (€/h)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={laborRate}
              onChange={(e) => setLaborRate(e.target.value)}
              className={`${inputCls} w-32`}
            />
            <p className="text-xs text-ink-muted mt-1">
              Valeur proposée : {DEFAULT_LABOR_RATE} €/h — à ajuster à votre réalité.
            </p>
          </div>
          <button
            className="text-xs text-ink-muted underline underline-offset-2"
            onClick={() => setShowEnergyDefault(!showEnergyDefault)}
          >
            {showEnergyDefault ? 'Masquer' : 'Voir'} les valeurs par défaut non saisies
          </button>
          {showEnergyDefault && (
            <p className="text-xs text-ink-muted font-mono">
              Énergie : {DEFAULT_ENERGY_RATE} €/kWh (défaut, non saisi — affinable plus tard)
            </p>
          )}
        </div>
      )}

      {step === 'recap' && (
        <div className="space-y-3">
          {/* Blocage massicot (BK-17) — le message dit la consequence */}
          {!calculable && (
            <div className="border border-err-fg/30 bg-err-bg rounded-xl p-4 flex gap-3 text-sm">
              <AlertTriangle className="w-4.5 h-4.5 text-err-fg shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-ink-2">
                <span className="font-medium text-ink">Aucun massicot dans le parc.</span> Sans
                massicot, aucun prix ne pourra être calculé — le parcours ne peut pas se terminer.
                Revenez aux machines pour en ajouter un.
              </p>
            </div>
          )}
          <RecapSection title={`Machines (${selected.length})`} onEdit={onBackToTypes}>
            {selected.map((m) => (
              <p key={m.id} className="text-sm text-ink-2">
                {m.brand} {m.model}
                <span className="font-mono text-[11px] text-ink-mute-2">
                  {' '}· {m.format}
                  {m.location ? ` · ${m.location}` : ' · localisation non renseignée'}
                  {m.location === 'externe' && m.subcontractor ? ` · ${m.subcontractor}` : ''}
                </span>
              </p>
            ))}
          </RecapSection>
          <RecapSection title="Fournisseurs papier" onEdit={() => setStep('paper')}>
            <p className="text-sm text-ink-2">{paperSuppliers.join(', ') || 'Aucun'}</p>
          </RecapSection>
          <RecapSection title="Fournisseurs transport" onEdit={() => setStep('transport')}>
            <p className="text-sm text-ink-2">{transportSuppliers.join(', ') || 'Aucun'}</p>
          </RecapSection>
          <RecapSection title="Modèle de coût" onEdit={() => setStep('costs')}>
            <p className="text-sm text-ink-2 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
              Main-d'œuvre {laborRate || DEFAULT_LABOR_RATE} €/h · énergie {DEFAULT_ENERGY_RATE} €/kWh (défaut)
            </p>
          </RecapSection>
          <p className="font-mono text-[11px] text-ink-mute-2">
            Parcours {variant} · {clicks} clics — consigné pour l'arbitrage des deux maquettes.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          className={btnGhost}
          onClick={() => (stepIdx === 0 ? onBackToTypes() : setStep(FINAL_STEPS[stepIdx - 1]))}
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Retour
        </button>
        {step !== 'recap' ? (
          <button className={btnPrimary} onClick={() => setStep(FINAL_STEPS[stepIdx + 1])}>
            Continuer
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        ) : (
          <button className={btnPrimary} disabled={!calculable} onClick={onFinish}>
            <Check className="w-4 h-4" strokeWidth={1.5} />
            Valider le parc
          </button>
        )}
      </div>
    </div>
  );
}

function CheckList({
  intro, options, value, onToggle,
}: {
  intro: string;
  options: string[];
  value: string[];
  onToggle: (s: string) => void;
}) {
  return (
    <div className="border border-line rounded-xl bg-paper p-5 space-y-3">
      <p className="text-sm text-ink-muted">{intro}</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {options.map((o) => (
          <label
            key={o}
            className={`flex items-center gap-2.5 border rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors ${
              value.includes(o)
                ? 'border-brand bg-brand-soft text-ink'
                : 'border-line text-ink-2 hover:border-line-2'
            }`}
          >
            <input type="checkbox" checked={value.includes(o)} onChange={() => onToggle(o)} />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}

function RecapSection({
  title, onEdit, children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-line rounded-xl bg-paper p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-mute-2">{title}</p>
        <button onClick={onEdit} className="text-xs text-brand hover:underline underline-offset-2">
          Modifier
        </button>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
