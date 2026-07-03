/**
 * quoteStatus — mapping des statuts devis vers les 3 groupes produit
 * (S-QUOTES-3). Partage par l'editeur et la bibliotheque.
 *
 * Stockage DB : text avec CHECK large (draft/sent/won/lost/pending/validated/
 * rejected). Affichage : 3 groupes.
 *   en cours = draft · sent · pending (+ tout statut inconnu)
 *   validé   = validated · won (legacy)
 *   rejeté   = rejected · lost (legacy)
 */

export type QuoteStatusGroup = 'en_cours' | 'valide' | 'rejete';

export interface QuoteStatusGroupDef {
  key: QuoteStatusGroup;
  label: string;
  /** Valeur ecrite en base quand l'utilisateur choisit ce groupe. */
  store: string;
  /** Classes badge (couleurs design system Magrit). */
  cls: string;
}

export const QUOTE_STATUS_GROUPS: QuoteStatusGroupDef[] = [
  { key: 'en_cours', label: 'En cours', store: 'draft',     cls: 'bg-warn-bg text-warn-fg' },
  { key: 'valide',   label: 'Validé',   store: 'validated', cls: 'bg-ok-bg text-ok-fg' },
  { key: 'rejete',   label: 'Rejeté',   store: 'rejected',  cls: 'bg-err-bg text-err-fg' },
];

/** Groupe d'affichage d'un statut stocke. */
export function statusGroup(status: string | null | undefined): QuoteStatusGroup {
  if (status === 'validated' || status === 'won') return 'valide';
  if (status === 'rejected' || status === 'lost') return 'rejete';
  return 'en_cours';
}

/** Definition (label + classes) du groupe d'un statut. */
export function statusGroupDef(status: string | null | undefined): QuoteStatusGroupDef {
  const g = statusGroup(status);
  return QUOTE_STATUS_GROUPS.find((s) => s.key === g) ?? QUOTE_STATUS_GROUPS[0];
}

/** Valeur a stocker en base pour un groupe donne. */
export function storeValueForGroup(group: QuoteStatusGroup): string {
  return QUOTE_STATUS_GROUPS.find((s) => s.key === group)?.store ?? 'draft';
}
