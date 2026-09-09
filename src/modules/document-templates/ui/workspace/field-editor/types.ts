import type { DocumentFieldId } from '@/modules/document-templates/api/contracts';

/**
 * Etat de selection de l editeur (E10.10b-4b).
 *  - `none`      : rien de selectionne, palette/onglet Tableau affiches tels quels.
 *  - `armed`      : un champ de la palette est "arme" (clic simple), le
 *    curseur pose au survol du canvas (wireframe A2). Un clic sur le canvas
 *    le pose ; Echap desarme.
 *  - `placement`  : un champ DEJA POSE est selectionne, panneau de reglages
 *    ouvert a droite (wireframe ecran B).
 */
export type FieldSelection =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'armed'; field: DocumentFieldId }>
  | Readonly<{ kind: 'placement'; field: DocumentFieldId }>;

export const NO_SELECTION: FieldSelection = Object.freeze({ kind: 'none' });
