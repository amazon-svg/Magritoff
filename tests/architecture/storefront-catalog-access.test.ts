import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routes = readFileSync(resolve(process.cwd(), 'src/server/api/shops-routes.ts'), 'utf8');
const repository = readFileSync(resolve(process.cwd(), 'src/adapters/supabase/shops-repository.ts'), 'utf8');
const storefront = readFileSync(resolve(process.cwd(), 'src/modules/shops/ui/storefront/PublicShop.tsx'), 'utf8');
const catalogLifecycle = readFileSync(resolve(process.cwd(), 'src/modules/shops/ui/hooks/usePublicShopCatalog.ts'), 'utf8');

describe('accès catalogue par session storefront', () => {
  it('résout le cookie côté serveur sans le transmettre au module Shops', () => {
    expect(routes).toContain('readStorefrontSessionCookie');
    expect(routes).toContain("kind: 'shop_customer'");
    expect(routes).not.toContain('opaqueToken: token');
  });

  it('borne le catalogue à la boutique portée par la session', () => {
    expect(repository).toContain('access.storefront?.shopId !== gate.id');
    expect(repository).not.toContain('access.magritUserId');
    expect(repository).not.toContain('current_user_can_access_shop');
  });

  it('attend la résolution storefront avant de charger un catalogue privé', () => {
    expect(storefront).toContain('storefrontSessionLoading');
    expect(storefront).toContain('sessionShopId: storefrontSession?.identity.shopId ?? null');
    // BCP-6b — la porte d'entrée du catalogue latche UNE FOIS que la session
    // s'est résolue (`sessionReady`), plutôt que de dépendre directement de
    // `sessionLoading` : une revalidation silencieuse ultérieure de la
    // session ne doit plus jamais relancer le catalogue (CONVENTIONS.md
    // §8.25 point 5.2).
    expect(catalogLifecycle).toContain('if (!sessionLoading) setSessionReady(true)');
    expect(catalogLifecycle).toContain('if (!slug || !sessionReady) return');
    expect(catalogLifecycle).toContain('storefrontShopId: sessionShopId');
    expect(storefront).not.toContain('resolveShopAccessFromMemberships');
    expect(storefront).not.toContain('useTenant');
    expect(storefront).not.toContain('useAuth');
  });

  // BCP-6b (correction qa-review round 1, M9/M10/M11) — le fichier contient
  // DEUX effets qui partagent le même garde littéral
  // `if (!slug || !sessionReady) return` (l'effet principal, sonde +
  // catalogue, et l'effet de retour au premier plan). Une assertion qui se
  // contente de chercher cette chaîne ne prouve rien sur l'effet PRINCIPAL en
  // particulier : elle passerait même si une mutation retirait
  // `sessionShopId` ou `attempt` de son tableau de dépendances, tant que le
  // garde littéral survit ailleurs dans le fichier. Ce test extrait le
  // tableau de dépendances qui suit IMMÉDIATEMENT la première occurrence du
  // garde (donc celui de l'effet principal, qui apparaît en premier dans le
  // fichier) et l'exige identique, terme à terme.
  it('M9/M10/M11 — l\'effet principal (sonde + catalogue) dépend de sessionShopId ET de attempt, distinct de l\'effet de retour au premier plan', () => {
    const mainEffectMatch = catalogLifecycle.match(
      /if \(!slug \|\| !sessionReady\) return;[\s\S]*?\}, \[([^\]]+)\]\);/,
    );
    expect(mainEffectMatch).not.toBeNull();
    // M9 : sessionShopId (changement d'identité) ; M10 : attempt (retry) ;
    // M11 : le garde sessionReady est bien celui de CET effet, avec CES
    // dépendances exactes (pas une réordonnance, pas un oubli).
    expect(mainEffectMatch?.[1]).toBe('api, attempt, sessionReady, sessionShopId, slug');

    // L'effet de retour au premier plan existe, mais ne partage PAS ces
    // dépendances : il ne relance jamais la sonde, seulement le catalogue,
    // et seulement via son écouteur `visibilitychange` (voir
    // tests/architecture/storefront-refresh-scheduling.test.ts, M8).
    const allDependencyArrays = [...catalogLifecycle.matchAll(/\}, \[([^\]]+)\]\);/g)].map((m) => m[1]);
    expect(allDependencyArrays).toContain('api, sessionReady, slug');
    expect(allDependencyArrays).not.toContain('api, attempt, sessionReady, sessionShopId, slug, sessionLoading');
  });
});
