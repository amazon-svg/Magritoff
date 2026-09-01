/**
 * Rendu visuel des jetons de couleur de tag (E10.2, CA1).
 *
 * Le contrat ne transporte qu un JETON (`slate`, `blue`, ...), jamais un code
 * hexadecimal : la charte peut evoluer sans migration. Cette table associe
 * chaque jeton a des classes Tailwind du design system deja en place
 * (`src/shared/ui`) — le seul endroit qui traduit un jeton en presentation.
 */
import type { ProjectTagColor } from '@/modules/project-tags';

const PROJECT_TAG_COLOR_CLASSES: Record<ProjectTagColor, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-300',
  blue: 'bg-blue-100 text-blue-700 border-blue-300',
  green: 'bg-green-100 text-green-700 border-green-300',
  amber: 'bg-amber-100 text-amber-700 border-amber-300',
  red: 'bg-red-100 text-red-700 border-red-300',
  violet: 'bg-violet-100 text-violet-700 border-violet-300',
};

/** Classes Tailwind d un badge de tag pour un jeton de couleur donne. */
export function projectTagColorClassName(color: ProjectTagColor): string {
  return PROJECT_TAG_COLOR_CLASSES[color];
}
