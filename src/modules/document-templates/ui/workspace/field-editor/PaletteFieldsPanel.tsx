/**
 * Palette "Champs" (wireframe ecran A) : les 25 donnees positionnables,
 * groupees par famille. Un champ DEJA POSE disparait de la liste (contrat :
 * "un champ posé disparaît de la liste des champs disponibles" —
 * l imprimeur ne peut donc jamais le poser deux fois depuis cet ecran).
 */
import { GripVertical } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import type {
  DocumentFieldId,
  DocumentFieldPlacementDto,
  DocumentType,
} from '@/modules/document-templates/api/contracts';
import {
  FIELD_CATALOG,
  FIELD_FAMILY_HINTS,
  FIELD_FAMILY_LABELS,
  FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE,
} from './field-catalog';

export type PaletteFieldsPanelProps = Readonly<{
  placements: readonly DocumentFieldPlacementDto[];
  /**
   * E10.19a — palette FILTREE par type de gabarit (contrat §4 : "l editeur ne
   * le propose pas" pour un champ hors du sous-ensemble opposable du type).
   */
  documentType: DocumentType;
  /** qa-review R7 : le compteur du wireframe (§2, "0/26") compte le tableau EN PLUS des 25 champs. */
  hasTable: boolean;
  armedField: DocumentFieldId | null;
  onArm(field: DocumentFieldId): void;
  onPlaceAtCenter(field: DocumentFieldId): void;
  onDragStart(field: DocumentFieldId, event: React.DragEvent): void;
}>;

export function PaletteFieldsPanel({
  placements,
  documentType,
  hasTable,
  armedField,
  onArm,
  onPlaceAtCenter,
  onDragStart,
}: PaletteFieldsPanelProps) {
  const placedFields = new Set(placements.map((placement) => placement.field));
  const familyOrder = FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE[documentType];
  const catalogForType = FIELD_CATALOG.filter((entry) => (familyOrder as readonly string[]).includes(entry.family));
  // qa-review R7 : "0/26" au wireframe = 25 champs + le tableau des lignes
  // compte A PART (contrat §2, note de l ecran A : "Le compteur 0/26 (25
  // champs + le tableau)"). E10.19a : le denominateur suit desormais le
  // CATALOGUE FILTRE par type (un gabarit de commande ne propose jamais les
  // 4 champs `quote.*`, ils ne doivent pas compter dans son total).
  const totalCount = catalogForType.length + 1;
  const positionedCount = catalogForType.filter((entry) => placedFields.has(entry.id)).length + (hasTable ? 1 : 0);

  return (
    <div className="space-y-4">
      <p
        className="text-xs text-ink-muted bg-bg border border-line-2 rounded-lg p-2"
        title="Repère informatif — un gabarit peut très bien n’utiliser qu’une partie de ces données."
      >
        {positionedCount} / {totalCount} donnée{positionedCount > 1 ? 's' : ''} positionnée
        {positionedCount > 1 ? 's' : ''}
      </p>

      {familyOrder.map((family) => {
        const entries = catalogForType.filter((entry) => entry.family === family && !placedFields.has(entry.id));
        return (
          <section key={family} className="space-y-1.5">
            <h3 className="text-xs font-bold text-ink-2 uppercase tracking-wider">
              {FIELD_FAMILY_LABELS[family]}
            </h3>
            {FIELD_FAMILY_HINTS[family] && (
              <p className="text-xs text-ink-muted">{FIELD_FAMILY_HINTS[family]}</p>
            )}
            {entries.length === 0 ? (
              <p className="text-xs text-ink-muted italic">Tout est positionné dans cette section.</p>
            ) : (
              <ul className="space-y-1">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => onDragStart(entry.id, event)}
                      onClick={() => onArm(entry.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onPlaceAtCenter(entry.id);
                        }
                      }}
                      title="Glissez-le sur le document, ou cliquez ici puis cliquez sur le document."
                      className={`w-full flex items-center gap-1.5 text-left text-sm px-2 py-1.5 rounded-lg border transition-colors ${
                        armedField === entry.id
                          ? 'border-brand bg-brand/10 text-ink'
                          : 'border-transparent hover:border-line-2 hover:bg-bg text-ink-2'
                      }`}
                      data-testid={TEST_IDS.documentTemplateFields.paletteItem}
                      data-field-id={entry.id}
                    >
                      <GripVertical className="w-3.5 h-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
                      {entry.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
