/**
 * Helpers PURS de la grille des commandes (E10.18a) — AUCUN calcul de
 * prix/seuil/quota (meme discipline que `order-detail.helpers.ts`) : ce
 * fichier ne fait que deriver un affichage ou construire les parametres
 * d une requete deja validee/convertie par le SERVEUR.
 */
import { PRODUCT_REFERENCE_TIME_ZONE } from '../../../../kernel/clock/index.ts';

/**
 * Formate un `Timestamp` (`created_at`) dans le fuseau de reference du
 * produit (`Europe/Paris`) — jamais dans le fuseau du navigateur, qui
 * afficherait un jour DIFFERENT de celui que `created_from`/`created_to`
 * viennent de filtrer (contrat, docs/api/CONVENTIONS.md §8.24 point 5
 * regle 8). Meme constante que le serveur : une seule source du fuseau.
 */
export function formatOrderCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: PRODUCT_REFERENCE_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Construit les cles `createdFrom`/`createdTo` d une requete `list()` a
 * partir des deux champs `<input type="date">` du filtre — une chaine vide
 * (champ efface) devient une cle ABSENTE, jamais une chaine vide envoyee au
 * serveur (le contrat n accepte que `YYYY-MM-DD` ou l absence du parametre).
 */
export function buildPeriodQuery(
  createdFrom: string,
  createdTo: string,
): Readonly<{ createdFrom?: string; createdTo?: string }> {
  const query: { createdFrom?: string; createdTo?: string } = {};
  if (createdFrom.trim()) query.createdFrom = createdFrom.trim();
  if (createdTo.trim()) query.createdTo = createdTo.trim();
  return query;
}
