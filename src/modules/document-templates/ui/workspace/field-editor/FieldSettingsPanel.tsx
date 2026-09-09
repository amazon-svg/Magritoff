/**
 * Panneau de reglages d un champ SELECTIONNE (wireframe ecran B) : police
 * (deux menus couples famille/style), taille, alignement (desactive tant
 * qu aucune largeur n est donnee), couleur, reglages avances (nombre de
 * lignes de repli), retrait du gabarit.
 *
 * ECART SIGNALE AU RAPPORT DE FIN DE STORY : le wireframe decrit une
 * poignee de redimensionnement tiree sur le document pour donner une
 * largeur a l etiquette ("tirez son bord droit"). Ce lot remplace ce geste
 * par un controle explicite ("Donner une largeur" + valeur en points) —
 * fonctionnellement equivalent (active align centre/droite, cf. contrat
 * DocumentTextAlign), mais sans l affordance graphique de la poignee.
 */
import { useState } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import type { DocumentFieldPlacementDto } from '@/modules/document-templates/api/contracts';
import { fieldLabel, fontFromEnum, fontToEnum, FONT_FAMILY_LABELS, FONT_STYLE_LABELS, FONT_STYLES_BY_FAMILY } from './field-catalog';
import type { FontFamilyId, FontStyleId } from './field-catalog';

const COLOR_SWATCHES = ['#111111', '#374151', '#b91c1c', '#1d4ed8'] as const;

export type FieldSettingsPanelProps = Readonly<{
  placement: DocumentFieldPlacementDto;
  onChange(next: DocumentFieldPlacementDto): void;
  onRemove(): void;
}>;

export function FieldSettingsPanel({ placement, onChange, onRemove }: FieldSettingsPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { family, style } = fontFromEnum(placement.font);
  const hasWidth = placement.width !== null && placement.width !== undefined;
  // customer.billing_address_block est le cas d usage explicite de
  // max_lines (wireframe A4) : le reglage avance reste discret pour les
  // autres champs, qui n en ont pas besoin.
  const showsMaxLinesHint = placement.field === 'customer.billing_address_block';

  return (
    <div className="space-y-4" data-testid={TEST_IDS.documentTemplateFields.settingsPanel}>
      <h3 className="text-sm font-bold text-ink truncate" title={fieldLabel(placement.field)}>
        {fieldLabel(placement.field)}
      </h3>

      <div className="space-y-1">
        <label htmlFor="field-settings-font-family" className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
          Police
        </label>
        <select
          id="field-settings-font-family"
          className="w-full px-2 py-1.5 border border-line-2 rounded-lg bg-paper text-sm"
          value={family}
          data-testid={TEST_IDS.documentTemplateFields.fontFamilySelect}
          onChange={(event) => {
            const nextFamily = event.target.value as FontFamilyId;
            const nextStyle = FONT_STYLES_BY_FAMILY[nextFamily].includes(style) ? style : 'normal';
            onChange({ ...placement, font: fontToEnum(nextFamily, nextStyle) });
          }}
        >
          {(Object.keys(FONT_FAMILY_LABELS) as FontFamilyId[]).map((id) => (
            <option key={id} value={id}>
              {FONT_FAMILY_LABELS[id]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="field-settings-font-style" className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
          Style
        </label>
        <select
          id="field-settings-font-style"
          className="w-full px-2 py-1.5 border border-line-2 rounded-lg bg-paper text-sm"
          value={style}
          data-testid={TEST_IDS.documentTemplateFields.fontStyleSelect}
          onChange={(event) => onChange({ ...placement, font: fontToEnum(family, event.target.value as FontStyleId) })}
        >
          {FONT_STYLES_BY_FAMILY[family].map((id) => (
            <option key={id} value={id}>
              {FONT_STYLE_LABELS[id]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="field-settings-font-size" className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
          Taille
        </label>
        <input
          id="field-settings-font-size"
          type="number"
          min={4}
          max={72}
          step={0.5}
          value={placement.font_size}
          data-testid={TEST_IDS.documentTemplateFields.fontSizeInput}
          onChange={(event) => onChange({ ...placement, font_size: Number(event.target.value) })}
          className="w-24 px-2 py-1.5 border border-line-2 rounded-lg bg-paper text-sm"
        />
        <span className="text-xs text-ink-muted ml-1">pt</span>
      </div>

      <div className="space-y-1">
        <label htmlFor="field-settings-width-toggle" className="flex items-center gap-2 text-xs font-semibold text-ink-2 uppercase tracking-wide">
          <input
            id="field-settings-width-toggle"
            type="checkbox"
            checked={hasWidth}
            data-testid={TEST_IDS.documentTemplateFields.widthToggle}
            onChange={(event) => {
              const checked = event.target.checked;
              // qa-review R4 : decocher la largeur DOIT forcer l alignement a
              // gauche — sans largeur, `align: center/right` est une carte
              // invalide (422 a l enregistrement) alors que les radios
              // centre/droite restent visuellement cochees (disabled ne les
              // decoche pas). Un champ sans largeur n a plus qu un
              // alignement possible.
              onChange({
                ...placement,
                width: checked ? (placement.width ?? 120) : null,
                align: checked ? placement.align : 'left',
              });
            }}
          />
          Donner une largeur
        </label>
        {hasWidth && (
          <input
            type="number"
            min={0}
            max={20000}
            value={placement.width ?? 0}
            aria-label="Largeur en points"
            data-testid={TEST_IDS.documentTemplateFields.widthInput}
            onChange={(event) => onChange({ ...placement, width: Number(event.target.value) })}
            className="w-28 px-2 py-1.5 border border-line-2 rounded-lg bg-paper text-sm"
          />
        )}
      </div>

      <fieldset className="space-y-1" data-testid={TEST_IDS.documentTemplateFields.alignInput}>
        <legend className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Alignement</legend>
        {(['left', 'center', 'right'] as const).map((align) => (
          <label
            key={align}
            className={`flex items-center gap-2 text-sm ${!hasWidth && align !== 'left' ? 'opacity-40' : ''}`}
            title={
              !hasWidth && align !== 'left'
                ? 'Pour centrer ou aligner à droite, donnez d’abord une largeur à cette étiquette.'
                : undefined
            }
          >
            <input
              type="radio"
              name={`align-${placement.field}`}
              checked={placement.align === align}
              disabled={!hasWidth && align !== 'left'}
              onChange={() => onChange({ ...placement, align })}
            />
            {align === 'left' ? 'Gauche' : align === 'center' ? 'Centré' : 'Droite'}
          </label>
        ))}
      </fieldset>

      <div className="space-y-1">
        <span id="field-settings-color-label" className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
          Couleur
        </span>
        <div className="flex items-center gap-1.5" role="group" aria-labelledby="field-settings-color-label">
          {COLOR_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              onClick={() => onChange({ ...placement, color })}
              className={`w-6 h-6 rounded-full border-2 ${placement.color === color ? 'border-brand' : 'border-line-2'}`}
              style={{ backgroundColor: color }}
            />
          ))}
          <input
            type="color"
            value={placement.color}
            aria-label="Autre couleur"
            data-testid={TEST_IDS.documentTemplateFields.colorInput}
            onChange={(event) => onChange({ ...placement, color: event.target.value })}
            className="w-6 h-6 rounded border border-line-2"
            title="Autre couleur…"
          />
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((current) => !current)}
          className="flex items-center gap-1 text-xs text-ink-2 hover:text-ink"
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-90' : ''}`} />
          Réglages avancés
        </button>
        {advancedOpen && (
          <div className="mt-2 space-y-1">
            {showsMaxLinesHint && (
              <p className="text-xs text-ink-muted">
                Cette étiquette s’écrit sur plusieurs lignes si l’adresse est longue. Réglez le nombre maximal de
                lignes ci-dessous.
              </p>
            )}
            <label htmlFor="field-settings-max-lines" className="text-xs text-ink-2">
              Nombre de lignes de repli
            </label>
            <input
              id="field-settings-max-lines"
              type="number"
              min={1}
              max={10}
              value={placement.max_lines}
              data-testid={TEST_IDS.documentTemplateFields.maxLinesInput}
              onChange={(event) => onChange({ ...placement, max_lines: Number(event.target.value) })}
              className="w-20 px-2 py-1.5 border border-line-2 rounded-lg bg-paper text-sm block"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        data-testid={TEST_IDS.documentTemplateFields.removeFieldBtn}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-err-fg border border-err-fg/40 rounded-lg hover:bg-err-bg"
      >
        <Trash2 className="w-4 h-4" />
        Retirer du gabarit
      </button>
    </div>
  );
}
