/**
 * Aides UI pures du panneau Liens de depot (E10.20a). Aucun appel reseau,
 * aucun controle metier : le serveur reste la seule verite
 * (`.claude/rules/frontend.md`).
 */
import type { OrderUploadLinkDto } from '../api/contracts.ts';

export function formatUploadLinkDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** URL publique composee CLIENT (le serveur ne la compose jamais, contrat §"story E10.20"). */
export function buildUploadLinkPublicUrl(token: string): string {
  return `${window.location.origin}/depot/${token}`;
}

export function describeUploadLinkUsage(link: OrderUploadLinkDto): string {
  if (link.use_count === 0) return 'Jamais ouvert';
  if (link.use_count === 1) return 'Ouvert 1 fois';
  return `Ouvert ${link.use_count} fois`;
}
