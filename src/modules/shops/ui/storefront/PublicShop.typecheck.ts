/**
 * Assertion de compilation pour `PublicShop.addToCart` — jamais exécutée,
 * jamais importée : vérifiée par `tsc` (`pnpm typecheck`), pas par vitest.
 * Même convention que `cartLine.typecheck.ts` et
 * `ShopProductCard.typecheck.ts`.
 *
 * BCP-11 (docs/api/CONVENTIONS.md §8.25 point 3.6 (e)) :
 *  - T8 : `addToCart` ne doit plus jamais accepter un nombre nu en second
 *    argument, seulement un `PackCount` construit via `packs()`/`ONE_PACK`.
 *
 *    Round 2 (qa-review, défaut 5) : round 1 gardait cette assertion en code
 *    mort DANS le corps du composant React `PublicShop` (une fonction
 *    locale jamais appelée, recréée à chaque rendu, maintenue vivante par un
 *    `void`). L'assertion était légitime, son domicile ne l'était pas.
 *    `addToCart` reste une fermeture locale, non exportable telle quelle :
 *    ce fichier teste son CONTRAT (`AddToCartFn`, exporté par
 *    `PublicShop.tsx`), pas la fermeture elle-même — même principe que T9
 *    qui teste le type de `toPackLine`, pas une instance particulière.
 */

import type { ShopProduct } from '@/modules/shops';
import type { AddToCartFn } from '@/modules/shops/ui/storefront/PublicShop';
import { ONE_PACK } from '@/modules/orders/ui/storefront';

declare const addToCart: AddToCartFn;
declare const product: ShopProduct;

// Sans second argument (paquet par défaut) : compile.
addToCart(product);

// Avec un PackCount explicite : compile.
addToCart(product, ONE_PACK);

// T8 — un nombre nu ne compile plus ici.
// @ts-expect-error BCP-11 T8 — addToCart ne doit plus accepter un nombre nu.
addToCart(product, 500);
