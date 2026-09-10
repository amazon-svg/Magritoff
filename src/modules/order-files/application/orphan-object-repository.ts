/**
 * Port du volet "objets orphelins" (E10.22c, docs/api/CONVENTIONS.md §8.22
 * §6 — ferme la dette D7 signalee au `qa-review` d E10.20b : "le contrat dit
 * *sans confirmation les octets sont ignores*, pas *supprimes*"). Implementation
 * Supabase dans `src/adapters/supabase/order-file-purge-repository.ts`
 * (`SupabaseOrphanObjectRepository`).
 *
 * DEUX categories d objets balayees, JAMAIS de ligne a marquer cote
 * applicatif (ce sont soit des objets qui n ont AUCUNE trace en base, soit
 * des objets dont la ligne atteste DEJA qu ils auraient du disparaitre) :
 *  1. Objets deposes via un billet mais JAMAIS confirmes — aucune ligne
 *     `commercial_order_files` ne les revendique — plus vieux que le delai
 *     de securite (24h proposees, reserve (b) du contrat : le billet de
 *     depot vit ~2h maximum, E10.17a/E10.20a — la marge est large pour ne
 *     jamais courir contre une confirmation lente).
 *  2. Objets dont la ligne correspondante porte deja `purged_at` (E10.22b) :
 *     un retrait precedent a echoue, rattrape SANS delai supplementaire —
 *     la ligne atteste deja que la destruction est autorisee.
 */
export interface OrphanObjectRepository {
  /**
   * Un TOUR complet : liste les objets orphelins du bucket
   * `commercial_order_files` (les deux categories ci-dessus), les retire par
   * lot (best-effort). Rend le nombre d objets candidats trouves.
   * `olderThanHours` borne la premiere categorie ; `limit` borne le nombre
   * d objets traites en un tour.
   */
  removeOrphanObjects(olderThanHours: number, limit: number): Promise<number>;
}
