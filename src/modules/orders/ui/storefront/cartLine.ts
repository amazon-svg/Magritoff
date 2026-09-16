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
 * (`tests/architecture/cart-line-single-constructor.test.ts`) vérifie
 * qu'aucun fichier sous `src/modules/*\/ui/` autre que ce fichier ne
 * construit ni la forme `config: { ...spread, quantity }` (la règle du
 * paquet réécrite en toutes lettres) ni un objet littéral qui porte à la
 * fois une clé `product` et une clé `qty` (une `CartLine` construite à la
 * main). **Limite assumée, à lire avant de croire ce garde plus large qu'il
 * n'est** : c'est un test TEXTUEL, pas un contrôle du compilateur — une
 * réécriture équivalente qui évite ces deux formes précises (par exemple
 * `const nextConfig = { ...base }; nextConfig.quantity = result.qty;` suivi
 * d'un objet `CartLine` construit en plusieurs instructions plutôt qu'un
 * seul littéral) lui échappe. Le domicile unique couvre le copier-coller de
 * la règle, pas sa réécriture délibérée.
 *
 * `toPackLine()` accepte un troisième paramètre optionnel, `packCount`
 * (par défaut `ONE_PACK`) : un geste d'ajout au panier (surcouche, gamme)
 * ajoute toujours exactement 1 paquet, mais le RENOUVELLEMENT d'une commande
 * (`rebuildCartFromOrderItems`) doit reconstruire le nombre de paquets tel
 * qu'il a été réellement commandé (le tiroir panier permet d'en cumuler
 * plusieurs, `updateQty`). Fixer `qty` à `ONE_PACK` sans condition aurait
 * réparé l'UNITÉ (exemplaires ne peuvent plus fuiter dans `qty`) en cassant
 * la VALEUR (un acheteur qui a commandé 2 paquets à 70 € en retrouverait 1 à
 * 35 € après un « Commander à nouveau », sans un mot) — précisément la
 * distinction posée par le cadrage (§8.25 point 3.6 (b), conséquence 1) :
 * « ce qu'il faut distinguer, c'est l'unité, pas la valeur ».
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
 * est écrit dans `config.quantity` ; `qty` (paquets) vaut `ONE_PACK` par
 * défaut — le geste normal d'ajout au panier — ou le `packCount` fourni
 * explicitement par un appelant qui reconstruit un état antérieur (voir
 * `rebuildCartFromOrderItems`, seul appelant à passer ce troisième
 * paramètre). C'est la SEULE fonction qui doit écrire `config.quantity`,
 * pour que les deux entrées connues du panier storefront B2B — `addToCart`
 * (`PublicShop.tsx`) et `setCart` du renouvellement
 * (`rebuildCartFromOrderItems`) — traversent le même point. Il existe un
 * SECOND panier dans le dépôt, indépendant (`CartContext.tsx`,
 * `src/modules/orders/ui/runtime/`) : hors périmètre de BCP-11, non couvert
 * par ce point unique — voir le cadrage, ce lot ne visait que le panier
 * storefront B2B (`CartLine`).
 */
export function toPackLine(
  productConfigured: ShopProduct,
  quantity: CopyCount,
  packCount: PackCount = ONE_PACK,
): CartLine {
  return packLine(
    {
      ...productConfigured,
      config: {
        ...(productConfigured.config ?? {}),
        quantity,
      },
    },
    packCount,
  );
}
