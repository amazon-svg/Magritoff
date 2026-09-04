/**
 * quoteStatus — mapping du statut `commercial_quotes.status` vers 3 groupes
 * d'affichage (liste, filtres).
 *
 * Adapte depuis `src/modules/quotes/ui/helpers/quoteStatus.ts` (ancien
 * systeme, supprime — chantier d unification des devis, voir
 * docs/api/CONVENTIONS.md §8.10). L enum de statut est desormais celui du
 * contrat E10.3 (`quoteStatusSchema`) : `draft | sent | accepted | rejected |
 * converted` — plus de valeurs legacy (`won`/`lost`/`pending`/`validated`).
 *
 *   en cours = draft · sent (+ tout statut inconnu, defensif)
 *   validé   = accepted · converted
 *   rejeté   = rejected
 */
import type { QuoteStatus } from '../../api/contracts';

export type QuoteStatusGroup = 'en_cours' | 'valide' | 'rejete';

export interface QuoteStatusGroupDef {
  key: QuoteStatusGroup;
  label: string;
  /** Classes badge (couleurs design system Magrit). */
  cls: string;
}

export const QUOTE_STATUS_GROUPS: QuoteStatusGroupDef[] = [
  { key: 'en_cours', label: 'En cours', cls: 'bg-warn-bg text-warn-fg' },
  { key: 'valide', label: 'Validé', cls: 'bg-ok-bg text-ok-fg' },
  { key: 'rejete', label: 'Rejeté', cls: 'bg-err-bg text-err-fg' },
];

export const QUOTE_STATUS_LABELS: Readonly<Record<QuoteStatus, string>> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  rejected: 'Refusé',
  converted: 'Converti',
};

/** Groupe d'affichage d'un statut stocke. */
export function statusGroup(status: string | null | undefined): QuoteStatusGroup {
  if (status === 'accepted' || status === 'converted') return 'valide';
  if (status === 'rejected') return 'rejete';
  return 'en_cours';
}

/** Definition (label + classes) du groupe d'un statut. */
export function statusGroupDef(status: string | null | undefined): QuoteStatusGroupDef {
  const g = statusGroup(status);
  return QUOTE_STATUS_GROUPS.find((s) => s.key === g) ?? QUOTE_STATUS_GROUPS[0]!;
}

/** Libelle humain d'un statut (Brouillon, Envoyé, ...). */
export function statusLabel(status: string): string {
  return (QUOTE_STATUS_LABELS as Record<string, string>)[status] ?? status;
}
