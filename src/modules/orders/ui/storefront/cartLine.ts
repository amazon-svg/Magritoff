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
 * paquet réécrite en toutes lettres, garde textuel) ni un objet littéral qui
 * porte à la fois une clé `product` et une clé `qty` (une `CartLine`
 * construite à la main, garde par ANALYSE SYNTAXIQUE depuis le round 3 —
 * round 2 utilisait une découpe textuelle par profondeur de parenthèses,
 * contournée par la qa-review en 3 lignes : une valeur imbriquée
 * `{ product: { ...product }, qty: 500 }`, un commentaire de bloc entre la
 * virgule et la clé, et la quatrième porte reconstruite entièrement à la
 * main sans jamais appeler `toPackLine`/`packLine`. Le second garde parcourt
 * maintenant le vrai AST TypeScript (`ts.createSourceFile` +
 * `ObjectLiteralExpression`), insensible à l'indentation, aux commentaires,
 * aux guillemets de clé et à l'imbrication).
 *
 * **Limite assumée du PREMIER garde (textuel), à lire avant de croire les
 * deux gardes équivalents** : lui seul reste un test TEXTUEL. Une réécriture
 * qui évite la forme `config: { ...spread, quantity }` (par exemple
 * `const nextConfig = { ...base }; nextConfig.quantity = result.qty;` suivi
 * d'une `CartLine` assemblée en plusieurs instructions, chaque propriété
 * posée par affectation plutôt que par un littéral unique) lui échappe
 * encore. Le second garde (AST) ne couvre que la forme `{ product, qty }`
 * construite en UN SEUL littéral d'objet — une construction répartie sur
 * plusieurs instructions (`const line = {} as CartLine; line.product = p;
 * line.qty = q;`) n'est pas un `ObjectLiteralExpression` portant les deux
 * clés et lui échappe aussi. Le domicile unique couvre le copier-coller de
 * la règle sous une forme reconnaissable syntaxiquement, pas toute
 * réécriture imaginable de la même règle.
 *
 * `toPackLine()` prend un troisième paramètre, `packCount` — **OBLIGATOIRE**
 * (round 3, qa-review) : un geste d'ajout au panier (surcouche, gamme) passe
 * `ONE_PACK` explicitement, et le RENOUVELLEMENT d'une commande
 * (`rebuildCartFromOrderItems`) reconstruit le nombre de paquets tel qu'il a
 * été réellement commandé (le tiroir panier permet d'en cumuler plusieurs,
 * `updateQty`). Round 2 le rendait optionnel avec `= ONE_PACK` par défaut :
 * la qa-review a jugé cette forme équivalente au « helper partagé » écarté
 * au point 3.6 (d) — *« un helper qu'on peut décliner est une convention,
 * pas une garantie »* — puisque la valeur par défaut était EXACTEMENT celle
 * qui avait produit la régression du round 1 (figer `qty` à `ONE_PACK` sans
 * condition, cassant la VALEUR pour un acheteur ayant commandé 2 paquets à
 * 70 €, qui en retrouvait 1 à 35 € après un « Commander à nouveau »). Rendre
 * le paramètre obligatoire force chaque appelant à déclarer son intention
 * (`ONE_PACK` pour un ajout normal, `packs(qty)` pour une reconstruction) au
 * lieu de l'hériter silencieusement — avant que BCP-2, BCP-3, BCP-4 et
 * BCP-8 ne recopient cette signature.
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
  packCount: PackCount,
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
