/**
 * Assertion de compilation pour `ShopProductCard.onAddToCart` — jamais
 * exécutée, jamais importée : vérifiée par `tsc` (`pnpm typecheck`), pas par
 * vitest. Même convention que `tests/kernel/types.typecheck.ts`.
 *
 * BCP-11 (docs/api/CONVENTIONS.md §8.25 point 3.6 (e)) :
 *  - T10 : le canal quantité a été retiré de `onAddToCart`. Un appelant qui
 *    lui passerait un second (ou troisième) argument ne doit plus compiler —
 *    le canal retiré ne doit pas pouvoir revenir sans qu'aucun test ne le
 *    voie.
 */

import type { ShopProduct } from '@/modules/shops';
import type { ShopProductCardProps } from '@/modules/catalog/ui/storefront/ShopProductCard';

declare const onAddToCart: ShopProductCardProps['onAddToCart'];
declare const product: ShopProduct;

// Un seul argument compile.
onAddToCart(product);

// T10 — un troisième argument (le canal quantité retiré) ne doit plus compiler.
// @ts-expect-error BCP-11 T10 — onAddToCart ne prend plus qu un seul argument.
onAddToCart(product, 1, 2);
