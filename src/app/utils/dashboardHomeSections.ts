/**
 * S2.16 (Epic 2, FR-ECOM-06, option C) — Sections dérivées de la home dashboard.
 *
 * Bloc « Vos devis en attente » : les devis au statut « en cours »
 * (draft/sent/pending, cf. `quoteStatus.statusGroup`), triés par date de création
 * décroissante, plafonnés. Data-driven (pas de curation) : la section se replie
 * si aucun devis en cours (AC3).
 *
 * Générique structurel : n'importe pas `QuotesContext` (évite une dépendance
 * lourde/circulaire) — tout objet portant `status` + `created_at` convient.
 */

import { statusGroup } from './quoteStatus';

export function resolvePendingQuotes<
  T extends { status?: string | null; created_at?: string },
>(quotes: T[] | null | undefined, limit: number): T[] {
  if (!quotes?.length || limit <= 0) return [];
  const ts = (q: T): number => {
    const v = q.created_at ? new Date(q.created_at).getTime() : NaN;
    return Number.isFinite(v) ? v : -Infinity; // sans date → en fin
  };
  return quotes
    .filter((q) => statusGroup(q.status) === 'en_cours')
    .sort((a, b) => ts(b) - ts(a))
    .slice(0, limit);
}
