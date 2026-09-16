/**
 * Assertions de compilation pour `cartLine.ts` — jamais exécutées, jamais
 * importées : ce fichier existe pour être vérifié par `tsc` (`pnpm
 * typecheck`), pas par vitest. Même convention que `tests/kernel/types.typecheck.ts`.
 *
 * BCP-11 (docs/api/CONVENTIONS.md §8.25 point 3.6 (e)) :
 *  - T9 : `CopyCount` et `PackCount` ne sont pas interchangeables.
 *  - Round 3 (qa-review, deuxième correction) : `packCount` est désormais
 *    OBLIGATOIRE dans `toPackLine` — un appel à deux arguments ne compile
 *    plus, quel que soit le type du second.
 */

import type { ShopProduct } from '@/modules/shops';
import { ONE_PACK, copies, toPackLine } from '@/modules/orders/ui/storefront/cartLine';

declare const product: ShopProduct;

// Avec les trois arguments (CopyCount valide + PackCount explicite) : compile.
toPackLine(product, copies(500), ONE_PACK);

// Round 3 — packCount ne peut plus être omis, même avec un CopyCount valide
// en second argument (c'est exactement la forme qui compilait au round 2,
// avec ONE_PACK comme défaut silencieux — la régression du round 1 tenait
// tout entière dans ce défaut).
// @ts-expect-error BCP-11 round 3 — packCount est desormais obligatoire.
toPackLine(product, copies(500));

// T9 — un PackCount (ONE_PACK) n'est pas un CopyCount en deuxième position,
// même avec un troisième argument par ailleurs valide.
// @ts-expect-error BCP-11 T9 — CopyCount et PackCount sont deux unités distinctes.
toPackLine(product, ONE_PACK, ONE_PACK);

// T8 (complément) — un nombre nu n'est pas un CopyCount non plus.
// @ts-expect-error BCP-11 T8/T9 — un nombre nu ne compile plus ici.
toPackLine(product, 500, ONE_PACK);
