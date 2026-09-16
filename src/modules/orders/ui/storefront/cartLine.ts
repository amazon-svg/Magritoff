/**
 * Point unique de construction d'une CartLine pour un produit configuré.
 *
 * BCP-11 (docs/api/CONVENTIONS.md §8.25 point 3.6) — la règle S-FIX-PANIER-11/05
 * ("qty = nombre d'exemplaires, on ajoute 1 PAQUET au panier") a vécu, avant ce
 * lot, en trois copies littérales (PortalCatalog.tsx, PortalProduct.tsx —
 * fermées par BCP-10 — et GammePage.tsx, une troisième copie non détectée par
 * BCP-10). Aucune de ces copies n'était protégée par le compilateur : rien
 * n'empêchait un futur appelant de faire transiter un nombre d'exemplaires là
 * où un nombre de paquets est attendu, ce qui ferait afficher 17 500 € pour un
 * forfait de 35 € à 500 exemplaires (`cartPricing.ts:27`,
 * `lineTotalHt = priceHT * line.qty`).
 *
 * Ce fichier ferme ce chemin par le typage, pas par une convention :
 *  - `CopyCount` et `PackCount` sont deux `number` marqués, incompatibles
 *    entre eux à la compilation ;
 *  - `copies()`, `packs()` et `ONE_PACK` sont les SEULS constructeurs ;
 *  - `toPackLine()` est la SEULE fonction qui écrit `config.quantity` et
 *    construit une `CartLine` pour un produit configuré. Un nombre nu
 *    (`toPackLine(product, 500)`) ne compile plus.
 *
 * `CartLine.qty` reste un `number` ordinaire (décision de l'architecte,
 * §8.25 point 3.6 (g)) : le tiroir panier incrémente une ligne existante
 * (`updateQty`, `PublicShop.tsx`) et cette opération doit rester possible.
 * Ce que cette discipline garantit : aucun nombre d'exemplaires ne peut plus
 * atteindre `CartLine.qty` par un appel non contrôlé. Ce qu'elle ne garantit
 * pas : qu'un appelant transmette la BONNE valeur de `CopyCount` (un site qui
 * passerait `copies(1)` au lieu de `copies(500)` compilerait toujours).
 *
 * `packLine()` est le second constructeur : une `CartLine` "brute" pour un
 * produit NON configuré (quantité = nombre de paquets ordinaire, pas de
 * forfait). Il existe pour que `PublicShop.addToCart` et
 * `rebuildCartFromOrderItems` n'aient eux non plus jamais à écrire l'objet
 * `{ product, qty }` en littéral — le test d'architecture
 * (`tests/architecture/cart-line-single-constructor.test.ts`) vérifie qu'AUCUN
 * fichier sous `src/modules/*\/ui/` autre que ce fichier ne le fait.
 */

import type { ShopProduct } from '@/modules/shops';
import type { CartLine } from '@/modules/orders/ui/storefront/types';

/** Nombre d'exemplaires — le contenu physique d'un paquet configuré. */
export type CopyCount = number & { readonly __unit: 'copies' };

/** Nombre de paquets ajoutés au panier (l'unité de `CartLine.qty`). */
export type PackCount = number & { readonly __unit: 'packs' };

/** Construit un `CopyCount` à partir d'un nombre d'exemplaires. */
export function copies(n: number): CopyCount {
  return n as CopyCount;
}

/** Construit un `PackCount` à partir d'un nombre de paquets. */
export function packs(n: number): PackCount {
  return n as PackCount;
}

/**
 * Un geste d'ajout au panier ajoute toujours exactement 1 paquet. C'est la
 * valeur que `toPackLine` écrit systématiquement dans `CartLine.qty` — le
 * tiroir panier (`updateQty`) peut ensuite la faire évoluer.
 */
export const ONE_PACK: PackCount = packs(1);

/**
 * Construit une `CartLine` "brute" : `product` tel quel, `qty` en paquets.
 * Pour un produit NON configuré (pas de forfait Clariprint), où `qty`
 * multiplie légitimement `price_ht` (voir `cartPricing.test.ts`,
 * "réutilise le prix catalogue"). Ne touche jamais `config`.
 */
export function packLine(product: ShopProduct, packCount: PackCount = ONE_PACK): CartLine {
  return { product, qty: packCount };
}

/**
 * Construit la `CartLine` d'un produit configuré : `quantity` (exemplaires)
 * est écrit dans `config.quantity`, et `qty` (paquets) est toujours
 * `ONE_PACK`. C'est la SEULE fonction qui doit faire cette conversion —
 * `rebuildCartFromOrderItems` (renouvellement de commande) l'utilise aussi,
 * pour que les deux seules entrées du panier (`addToCart` et `setCart` du
 * renouvellement) traversent le même point.
 */
export function toPackLine(productConfigured: ShopProduct, quantity: CopyCount): CartLine {
  return packLine(
    {
      ...productConfigured,
      config: {
        ...(productConfigured.config ?? {}),
        quantity,
      },
    },
    ONE_PACK,
  );
}
