/**
 * Assertions de compilation pour `cartLine.ts` — jamais exécutées, jamais
 * importées : ce fichier existe pour être vérifié par `tsc` (`pnpm
 * typecheck`), pas par vitest. Même convention que `tests/kernel/types.typecheck.ts`.
 *
 * BCP-11 (docs/api/CONVENTIONS.md §8.25 point 3.6 (e)) :
 *  - T9 : `CopyCount` et `PackCount` ne sont pas interchangeables.
 */

import type { ShopProduct } from '@/modules/shops';
import { ONE_PACK, copies, toPackLine } from '@/modules/orders/ui/storefront/cartLine';

declare const product: ShopProduct;

// Un CopyCount construit via copies() compile.
toPackLine(product, copies(500));

// T9 — un PackCount (ONE_PACK) n'est pas un CopyCount : ne doit plus compiler.
// @ts-expect-error BCP-11 T9 — CopyCount et PackCount sont deux unités distinctes.
toPackLine(product, ONE_PACK);

// T8 (complément) — un nombre nu n'est pas un CopyCount non plus.
// @ts-expect-error BCP-11 T8/T9 — un nombre nu ne compile plus ici.
toPackLine(product, 500);
