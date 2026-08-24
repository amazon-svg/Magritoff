/**
 * S7.4 — Helpers PURS de l'éditorial PIM (page gamme).
 *
 * Sélection de la définition (`fr` prioritaire, repli famille), résolution des
 * placeholders `{{format}}/{{grammage}}/{{finition}}/{{papier}}` depuis la
 * config courante, parsing markdown léger et normalisation des specs.
 */

import type { ProductDefinition } from '@/modules/catalog/ui/helpers/productEnrichment';
import type { ConfigOptions } from '@/modules/catalog/ui/storefront/ProductOverlay.helpers';

/**
 * Définition à rendre pour une gamme : locale fr d'abord (les doublons EN
 * historiques existent en prod), puis n'importe quelle locale, puis la
 * définition de la famille (repli) si fournie.
 */
export function pickDefinition(
  definitions: ProductDefinition[],
  gammeSlug: string | undefined,
  familySlug?: string | undefined,
): ProductDefinition | null {
  const forSlug = (slug: string | undefined): ProductDefinition | null => {
    if (!slug) return null;
    const candidates = definitions.filter((d) => d.gamme_slug === slug);
    if (candidates.length === 0) return null;
    return candidates.find((d) => d.locale === 'fr') ?? candidates[0] ?? null;
  };
  return forSlug(gammeSlug) ?? forSlug(familySlug);
}

/** Sous-ensemble de config utilisé pour résoudre les templates PIM. */
export type PimTemplateOptions = Partial<
  Pick<
    ConfigOptions,
    'format' | 'paper' | 'finishingFront' | 'finishingVerso' | 'quantity'
  >
>;

/**
 * Résout les placeholders `{{token}}` d'un template PIM depuis la config
 * courante. Vocabulaire prod (audit 2026-07-26) : format, grammage, papier,
 * finition, finition_recto, finition_verso, quantite (+ binding/matiere/pages/
 * impression_* non mappables → RETIRÉS). Jamais de `{{x}}` brut affiché (AC1),
 * espaces doublés nettoyés.
 * NB : `papier` (type de papier réel, ex. « couché mat ») n'est pas dans la
 * config → retiré, pour éviter le doublon « 135g 135g/m² ».
 */
export function resolvePimTemplate(
  template: string | null | undefined,
  options?: PimTemplateOptions | null,
): string {
  if (!template) return '';
  const vars: Record<string, string> = options
    ? {
        format: String(options.format ?? ''),
        grammage: String(options.paper ?? '').replace(/g$/i, ''),
        finition: String(options.finishingFront ?? ''),
        finition_recto: String(options.finishingFront ?? ''),
        finition_verso: String(options.finishingVerso ?? ''),
        quantite:
          options.quantity != null ? options.quantity.toLocaleString('fr-FR') : '',
      }
    : {};
  return template
    .replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.;:!?])/g, '$1')
    .trim();
}

/** Bloc de rendu markdown léger (pas de dépendance markdown). */
export type EditorialBlock =
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] };

/**
 * Parse un markdown SIMPLE (##/###, listes -/*, paragraphes). Suffisant pour
 * les description_template PIM ; tout le reste est rendu en paragraphe.
 */
export function parseLightMarkdown(md: string): EditorialBlock[] {
  const blocks: EditorialBlock[] = [];
  let list: string[] | null = null;
  const flushList = () => {
    if (list && list.length > 0) blocks.push({ kind: 'ul', items: list });
    list = null;
  };
  for (const rawLine of md.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      blocks.push({ kind: 'h3', text: line.slice(4).trim() });
    } else if (line.startsWith('## ')) {
      flushList();
      blocks.push({ kind: 'h2', text: line.slice(3).trim() });
    } else if (line.startsWith('# ')) {
      // Un seul H1 par page (le titre gamme) : rétrogradé en h2.
      flushList();
      blocks.push({ kind: 'h2', text: line.slice(2).trim() });
    } else if (/^[-*•]\s+/.test(line)) {
      if (!list) list = [];
      list.push(line.replace(/^[-*•]\s+/, '').replace(/\*\*/g, ''));
    } else {
      flushList();
      blocks.push({ kind: 'p', text: line.replace(/\*\*/g, '') });
    }
  }
  flushList();
  return blocks;
}

/** Normalise technical_spec (dict libre) en lignes [libellé, valeur]. */
export function specRows(spec: unknown): Array<[string, string]> {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return [];
  const rows: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(spec as Record<string, unknown>)) {
    if (value == null) continue;
    const label = key.replace(/_/g, ' ');
    const rendered = Array.isArray(value)
      ? value.map((v) => String(v)).join(', ')
      : typeof value === 'object'
        ? Object.entries(value as Record<string, unknown>)
            .map(([k, v]) => `${k.replace(/_/g, ' ')} : ${String(v)}`)
            .join(' · ')
        : String(value);
    if (rendered.trim()) rows.push([label, rendered]);
  }
  return rows;
}

/** usage_examples/use_cases : tolère les deux formes (objets ou strings). */
export function normalizeUsageExamples(
  raw: ProductDefinition['usage_examples'] | ProductDefinition['use_cases'],
): Array<{ title: string; description: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return { title: item, description: '' };
      if (item && typeof item === 'object' && 'title' in item) {
        return {
          title: String((item as { title: unknown }).title ?? ''),
          description: String(
            (item as { description?: unknown }).description ?? '',
          ),
        };
      }
      return null;
    })
    .filter((x): x is { title: string; description: string } => !!x && !!x.title);
}
