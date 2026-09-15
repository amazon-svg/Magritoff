import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// BCP-6b (CONVENTIONS.md §8.25 point 5.2) — verrou de non-régression sur le
// mécanisme mesuré en recette le 2026-09-16 : la boucle `session/current` +
// `catalog` toutes les ~5 s venait de deux `setInterval(15_000)` et de deux
// écouteurs `focus`, un par hook. Ce test échoue si l'un ou l'autre
// réapparaît, ou si `visibilitychange` disparaît.

const catalogHookSource = readFileSync(
  resolve(process.cwd(), 'src/modules/shops/ui/hooks/usePublicShopCatalog.ts'),
  'utf8',
);
const sessionHookSource = readFileSync(
  resolve(process.cwd(), 'src/modules/shop-customers/ui/hooks/useStorefrontSession.ts'),
  'utf8',
);

describe('usePublicShopCatalog.ts — aucun minuteur, aucun focus', () => {
  it("n'arme plus aucun setInterval", () => {
    expect(catalogHookSource).not.toMatch(/setInterval/);
  });

  it("n'écoute plus l'événement focus", () => {
    expect(catalogHookSource).not.toMatch(/addEventListener\(\s*['"]focus['"]/);
  });

  it('recharge sur visibilitychange, jamais sur focus', () => {
    expect(catalogHookSource).toMatch(/addEventListener\(\s*['"]visibilitychange['"]/);
  });
});

describe('useStorefrontSession.ts — aucun minuteur, aucun focus', () => {
  it("n'arme plus aucun setInterval", () => {
    expect(sessionHookSource).not.toMatch(/setInterval/);
  });

  it("n'écoute plus l'événement focus", () => {
    expect(sessionHookSource).not.toMatch(/addEventListener\(\s*['"]focus['"]/);
  });

  it('revalide sur visibilitychange, jamais sur focus', () => {
    expect(sessionHookSource).toMatch(/addEventListener\(\s*['"]visibilitychange['"]/);
  });
});
