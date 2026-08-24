/**
 * S7.3 — GammeConfigurator : rendu PAGE du moteur useProductConfigurator.
 *
 * Chips Top formats (1 clic), selects hiérarchisés (mêmes constantes que
 * l'overlay — moteur unique S7.2), paliers de quantité cliquables + saisie
 * libre. Toujours pré-rempli : l'acheteur ajuste, ne construit jamais de zéro
 * (Form Patterns spec UX).
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import {
  DORURES,
  FINISHINGS,
  FORMATS,
  PAPERS,
  PRINTINGS,
  QUANTITIES,
  type ConfigOptions,
} from '@/modules/catalog/ui/storefront/ProductOverlay.helpers';
import type { ConfiguratorPhase } from '@/modules/clariprint/ui/hooks';
import { TOP_FORMAT_CHIPS } from '@/modules/catalog/ui/storefront/gamme/gammePage.helpers';

const selectCls =
  'w-full px-3 py-2 rounded-md border border-line-2 bg-paper text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-accent';

export interface GammeConfiguratorProps {
  options: ConfigOptions;
  patchOptions: (patch: Partial<ConfigOptions>) => void;
  phase: ConfiguratorPhase;
  onRetry: () => void;
}

export function GammeConfigurator({
  options,
  patchOptions,
  phase,
  onRetry,
}: GammeConfiguratorProps) {
  return (
    <div
      data-testid={TEST_IDS.shop.gammeConfigurator}
      className="flex flex-col gap-4"
    >
      {/* Top formats — pré-remplissage 1 clic */}
      <fieldset className="m-0 p-0 border-0">
        <legend
          className="font-mono uppercase text-ink-mute-2 mb-1.5"
          style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
        >
          Top formats
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {TOP_FORMAT_CHIPS.map((f) => (
            <button
              key={f}
              type="button"
              data-testid={TEST_IDS.shop.gammeTopFormatChip}
              aria-pressed={options.format === f}
              onClick={() => patchOptions({ format: f })}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                options.format === f
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper text-ink border-line-2 hover:border-ink'
              }`}
              style={{ fontSize: '12.5px', fontWeight: 500, minHeight: '32px' }}
            >
              {f}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Options principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Format">
          <select
            value={options.format}
            onChange={(e) => patchOptions({ format: e.target.value })}
            className={selectCls}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>

        {options.format === 'Custom' && (
          <>
            <Field label="Largeur (mm)">
              <input
                type="number"
                min={10}
                max={2000}
                value={options.customWidth ?? 100}
                onChange={(e) =>
                  patchOptions({ customWidth: parseInt(e.target.value, 10) || 100 })
                }
                className={selectCls}
              />
            </Field>
            <Field label="Hauteur (mm)">
              <input
                type="number"
                min={10}
                max={2000}
                value={options.customHeight ?? 100}
                onChange={(e) =>
                  patchOptions({ customHeight: parseInt(e.target.value, 10) || 100 })
                }
                className={selectCls}
              />
            </Field>
          </>
        )}

        <Field
          label="Papier"
          hint="Plus le grammage est élevé, plus le papier est rigide — 350 g : cartes premium."
        >
          <select
            value={options.paper}
            onChange={(e) => patchOptions({ paper: e.target.value })}
            className={selectCls}
          >
            {PAPERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Impression">
          <select
            value={options.printing}
            onChange={(e) =>
              patchOptions({ printing: e.target.value as ConfigOptions['printing'] })
            }
            className={selectCls}
          >
            {PRINTINGS.map((p) => (
              <option key={p} value={p}>
                {p === 'recto' ? 'Recto' : 'Recto-verso'}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Finition recto"
          hint="Le pelliculage protège et change le toucher — mat : sobre, brillant : couleurs vives."
        >
          <select
            value={options.finishingFront}
            onChange={(e) => patchOptions({ finishingFront: e.target.value })}
            className={selectCls}
          >
            {FINISHINGS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>

        {options.printing === 'recto-verso' && (
          <Field label="Finition verso">
            <select
              value={options.finishingVerso}
              onChange={(e) => patchOptions({ finishingVerso: e.target.value })}
              className={selectCls}
            >
              {FINISHINGS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Dorure">
          <select
            value={options.dorure}
            onChange={(e) => patchOptions({ dorure: e.target.value })}
            className={selectCls}
          >
            {DORURES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Paliers de quantité cliquables + saisie libre */}
      <fieldset className="m-0 p-0 border-0">
        <legend
          className="font-mono uppercase text-ink-mute-2 mb-1.5"
          style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
        >
          Quantité
        </legend>
        <div className="flex flex-wrap items-center gap-1.5">
          {QUANTITIES.map((q) => (
            <button
              key={q}
              type="button"
              data-testid={TEST_IDS.shop.gammeQuantityTier}
              aria-pressed={options.quantity === q}
              onClick={() => patchOptions({ quantity: q })}
              className={`px-3 py-1.5 rounded-md border transition-colors ${
                options.quantity === q
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper text-ink border-line-2 hover:border-ink'
              }`}
              style={{
                fontSize: '12.5px',
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
                minHeight: '32px',
              }}
            >
              {q.toLocaleString('fr-FR')}
            </button>
          ))}
          <input
            type="number"
            aria-label="Quantité personnalisée"
            inputMode="numeric"
            min={50}
            max={100000}
            value={options.quantity}
            onChange={(e) =>
              patchOptions({
                quantity: Math.max(50, Math.min(100000, parseInt(e.target.value, 10) || 50)),
              })
            }
            className="w-24 px-3 py-1.5 rounded-md border border-line-2 bg-paper text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </fieldset>

      {/* Erreur : inline, jamais de modal bloquante */}
      {phase.kind === 'error' && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-warn-bg border border-warn-fg/20 text-warn-fg"
          style={{ fontSize: '12.5px', fontWeight: 400 }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="flex-1">
            <p className="m-0">{phase.message}</p>
            {(phase.errorKind === 'network' ||
              phase.errorKind === 'timeout' ||
              phase.errorKind === 'unknown') && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 mt-1.5 text-warn-fg hover:underline"
                style={{ fontSize: '12px', fontWeight: 500 }}
              >
                <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                Réessayer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="font-mono uppercase text-ink-mute-2 inline-flex items-center gap-1"
        style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
      >
        {label}
        {hint && (
          <span
            className="normal-case font-sans text-ink-mute-2 cursor-help"
            title={hint}
            aria-label={hint}
            style={{ fontSize: '11px', letterSpacing: 0 }}
          >
            ℹ
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
