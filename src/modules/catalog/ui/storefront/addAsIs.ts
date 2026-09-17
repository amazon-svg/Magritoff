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
 * (point 3.7 (a), "Qui l'évalue"). **CORRIGÉ le 2026-09-17 (constat de la
 * qa-review de Q14-a round 1, vérifié par l'architecte, point 3.7 (a) et
 * (g)) : la phrase d'origine, « la fermeté du prix est établie côté serveur
 * au moment du chiffrage », était FAUSSE.** Le serveur **ne revalorise pas**
 * le prix d'une commande boutique : `api_create_storefront_order` accepte
 * le `unitPriceHt` que le navigateur lui envoie et se contente de refuser
 * `unit_price_ht < 0` (`20260817000100_storefront_order_identity.sql`),
 * sans le rapprocher de `product_library.price_ht` ni de
 * `shop_product_pricing`. **Ce module ne crée et ne corrige aucune règle
 * serveur** — il cesse seulement de proposer un geste que l'interface juge
 * imprudent. Un contournement direct de l'API (bouton HTML forgé, appel
 * direct à la création de commande) n'est PAS empêché par ce module, et ne
 * l'a jamais été : cette dette est nommée et remontée à Arnaud sous
 * **Q17** (point 9 du cadrage), pas traitée ici.
 *
 * Où il vit : `src/modules/catalog/ui/storefront/addAsIs.ts`, à côté de
 * `productPriceDisplay.ts` (BCP-10), et non dans
 * `src/modules/clariprint/application/` comme la première rédaction du
 * cadrage le supposait — ce module `application/` n'existe pas encore
 * (il naît avec BCP-2), et loger le prédicat à cet endroit aurait fait
 * importer `ui/` depuis `application/`, à rebours de la dépendance du
 * module clariprint (point 3.7 (a), "Précision du 2026-09-17").
 */

import { resolvePrice, type PriceResolution } from '@/modules/clariprint/ui/helpers';
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
 * Liste BLANCHE, jamais liste noire (réserve non bloquante de la qa-review
 * round 1) : seules les deux sources qui garantissent une origine imprimeur
 * rendent `true`. Une liste noire (`!== 'prix_marche' && !== 'zero'`) serait
 * équivalente tant que `PriceSource` compte quatre valeurs, mais rendrait
 * `true` par défaut si un cinquième membre apparaissait un jour (bug de
 * `resolvePrice`, évolution future) — l'inverse du principe « échec fermé »
 * de ce module. La liste blanche rend `false` par défaut.
 */
export function isFirmPriceSource(source: PriceResolution['source']): boolean {
  return source === 'clariprint' || source === 'library_cached';
}

/**
 * C2 seule (Q14-a). `product` et `quote` sont exactement les arguments de
 * `resolvePrice` : ce prédicat ne recalcule rien, il expose le verdict déjà
 * calculé par la hiérarchie de prix existante.
 *
 * **Réserve de la qa-review round 1, tranchée par l'architecte (point 3.7
 * (b-ter), "Réserves") : un devis Clariprint réussi à `priceHT: 0` échoue
 * TOUJOURS, quelle que soit la source.** Un prix à 0 € actif contredirait la
 * règle « jamais 0 € » du point 4 — c'est `BCP-4` qui doit, lui, empêcher
 * `resolvePrice` de rendre `clariprint` sur un prix nul ; ce module se
 * protège en attendant, par une garde explicite plutôt que d'en dépendre.
 */
export function canAddAsIs(
  product: ShopProduct,
  quote: ClariprintQuoteResult | null,
): AddAsIsEligibility {
  const resolution = resolvePrice(product, quote);
  if (resolution.priceHT <= 0) {
    return { ok: false, reason: 'price-not-firm' };
  }
  if (isFirmPriceSource(resolution.source)) {
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
