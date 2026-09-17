/**
 * Q14 — l'ajout direct au panier n'est offert que si le produit porte les
 * caractéristiques qui l'ont chiffré (docs/api/CONVENTIONS.md §8.25 point
 * 3.7).
 *
 * Critère à DEUX conditions (point 3.7 (a)) :
 *  - **C1** configuration chiffrable — verdict du normaliseur de BCP-2, qui
 *    n'existe pas encore (BCP-2 dépend de la campagne d'appels réels chez
 *    l'imprimeur, non jouée). C'est **Q14-b**, hors périmètre de ce fichier
 *    à ce stade : la signature et le libellé de son motif
 *    (`'config-incomplete'`) sont posés ICI, dès maintenant, pour que Q14-b
 *    n'ait ni la signature ni la table à réécrire (point 3.7 (a), "ordre des
 *    motifs").
 *  - **C2** prix d'origine imprimeur — `resolvePrice(product,
 *    quote).source ∈ { 'clariprint', 'library_cached' }`. C'est **Q14-a**,
 *    la seule condition vérifiée par ce fichier aujourd'hui.
 *
 * `canAddAsIs` ne rend donc, pour l'instant, QUE `'price-not-firm'` — jamais
 * `'config-incomplete'`, faute de C1 implémentable. Quand Q14-b branchera le
 * verdict du normaliseur, l'ordre des motifs est déjà fixé : une
 * configuration incomplète l'emporte sur un prix non ferme (point 3.7 (a)),
 * parce que configurer répare les deux, alors qu'un prix ferme ne répare pas
 * une configuration incomplète.
 *
 * **Ce n'est pas une garantie de prix, c'est une affordance d'interface**
 * (point 3.7 (a), "Qui l'évalue") : la fermeté du prix est établie côté
 * serveur au moment du chiffrage. Ce fichier ne crée aucune règle serveur
 * nouvelle — il cesse seulement de proposer un geste que le serveur ne
 * valoriserait pas comme définitif. Un contournement direct de l'API
 * (bouton HTML forgé, appel direct à la création de commande) n'est PAS
 * empêché par ce module : seule l'API/la base font foi sur ce qu'une
 * commande peut valoriser.
 *
 * Où il vit : `src/modules/catalog/ui/storefront/addAsIs.ts`, à côté de
 * `productPriceDisplay.ts` (BCP-10), et non dans
 * `src/modules/clariprint/application/` comme la première rédaction du
 * cadrage le supposait — ce module `application/` n'existe pas encore
 * (il naît avec BCP-2), et loger le prédicat à cet endroit aurait fait
 * importer `ui/` depuis `application/`, à rebours de la dépendance du
 * module clariprint (point 3.7 (a), "Précision du 2026-09-17").
 */

import { resolvePrice } from '@/modules/clariprint/ui/helpers';
import type { ClariprintQuoteResult } from '@/modules/clariprint';
import type { ShopProduct } from '@/modules/shops';

/**
 * Motif pour lequel l'ajout « tel quel » au panier n'est pas offert.
 * `'price-not-firm'` (C2) est le seul motif rendu par Q14-a. `'config-
 * incomplete'` (C1) est réservé à Q14-b — déclaré dès maintenant dans cette
 * union pour que `ADD_AS_IS_REASON_LABELS` reste une table FERMÉE : un motif
 * ajouté sans libellé ne compile pas.
 */
export type AddAsIsReason = 'config-incomplete' | 'price-not-firm';

export type AddAsIsEligibility =
  | { ok: true }
  | { ok: false; reason: AddAsIsReason };

/**
 * Libellés exacts, visibles par l'acheteur sans survol (point 3.7 (b-bis)
 * 1). Table fermée : `Record<AddAsIsReason, string>` force un libellé pour
 * chaque motif de l'union, y compris `'config-incomplete'` que Q14-a ne rend
 * jamais encore — c'est la garantie que Q14-b ne pourra pas brancher ce
 * motif en oubliant son texte.
 */
export const ADD_AS_IS_REASON_LABELS: Readonly<Record<AddAsIsReason, string>> = {
  'price-not-firm': 'Configurez ce produit pour obtenir son prix définitif.',
  'config-incomplete': 'Configurez ce produit pour préciser ses caractéristiques.',
};

/**
 * C2 seule (Q14-a). `product` et `quote` sont exactement les arguments de
 * `resolvePrice` : ce prédicat ne recalcule rien, il expose le verdict déjà
 * calculé par la hiérarchie de prix existante.
 */
export function canAddAsIs(
  product: ShopProduct,
  quote: ClariprintQuoteResult | null,
): AddAsIsEligibility {
  const resolution = resolvePrice(product, quote);
  if (resolution.source === 'clariprint' || resolution.source === 'library_cached') {
    return { ok: true };
  }
  return { ok: false, reason: 'price-not-firm' };
}

/** Tout ce que le JSX pose sur le bouton « + Panier » et sous lui. */
export interface AddToCartButtonState {
  disabled: boolean;
  describedBy?: string;
  reason?: AddAsIsReason;
  label?: string;
}

/**
 * Traduit un verdict de `canAddAsIs` en état de bouton — le composant ne
 * fait que PARCOURIR ce résultat, il ne lit ni `reason` pour choisir un
 * texte, ni `source` pour décider d'un état (point 3.7 (b-bis) 2).
 *
 * `reasonId` est l'identifiant DOM, propre à l'instance de carte (deux
 * rendus de la même carte produit doivent porter deux identifiants
 * distincts), que le bouton référence par `aria-describedby` et que
 * l'élément du libellé porte.
 */
export function addToCartButtonState(
  eligibility: AddAsIsEligibility,
  reasonId: string,
): AddToCartButtonState {
  if (eligibility.ok) {
    return { disabled: false };
  }
  return {
    disabled: true,
    describedBy: reasonId,
    reason: eligibility.reason,
    label: ADD_AS_IS_REASON_LABELS[eligibility.reason],
  };
}
