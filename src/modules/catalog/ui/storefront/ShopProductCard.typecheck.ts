/**
 * Assertion de compilation pour `ShopProductCard.onAddToCart` — jamais
 * exécutée, jamais importée : vérifiée par `tsc` (`pnpm typecheck`), pas par
 * vitest. Même convention que `tests/kernel/types.typecheck.ts`.
 *
 * BCP-11 (docs/api/CONVENTIONS.md §8.25 point 3.6 (e)) :
 *  - T10 : le canal quantité a été retiré de `onAddToCart`. Un appelant qui
 *    lui passerait un second argument ne doit plus compiler — le canal
 *    retiré ne doit pas pouvoir revenir sans qu'aucun test ne le voie.
 *
 *    Round 2 (qa-review, défaut 2) : la première version de ce fichier
 *    testait un TROISIÈME argument (`onAddToCart(product, 1, 2)`), qui était
 *    déjà une erreur AVANT ce lot (l'ancien type `(product, qty?: number) =>
 *    void` n'a jamais eu de troisième paramètre) — une assertion vraie de
 *    tout temps ne distingue rien. Preuve retenue par la qa-review :
 *    restaurer l'ancien type à deux paramètres laissait `pnpm typecheck` et
 *    la suite complète au vert. Le test qui compte est sur DEUX arguments :
 *    c'est le seul qui compile avant ce lot (canal ouvert) et plus après
 *    (canal retiré).
 */

import type { ShopProduct } from '@/modules/shops';
import type { ShopProductCardProps } from '@/modules/catalog/ui/storefront/ShopProductCard';

declare const onAddToCart: ShopProductCardProps['onAddToCart'];
declare const product: ShopProduct;

// Un seul argument compile.
onAddToCart(product);

// T10 — un second argument (le canal quantité retiré) ne doit plus compiler.
// Compilait avant ce lot (`(product, qty?: number) => void`), ne compile
// plus après (`(product) => void`) : c'est la forme qui distingue réellement
// les deux états, contrairement à un troisième argument (toujours une
// erreur, avant comme après).
// @ts-expect-error BCP-11 T10 — onAddToCart ne prend plus qu un seul argument.
onAddToCart(product, 1);
