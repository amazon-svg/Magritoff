import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
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

/**
 * Extrait le bloc source du PREMIER `useEffect` qui enregistre l'écouteur
 * `visibilitychange` donné (bornage : du `useEffect(() => {` le plus proche
 * en amont jusqu'au `}, [...])` de fermeture le plus proche en aval). Sert à
 * vérifier que l'écouteur appelle RÉELLEMENT la politique et l'action
 * qu'elle commande — pas seulement leur présence quelque part dans le
 * fichier (M7b/M8, correction qa-review round 1).
 */
function extractVisibilityEffectBlock(source: string): string {
  const listenerIndex = source.indexOf("addEventListener('visibilitychange'");
  if (listenerIndex === -1) throw new Error('addEventListener visibilitychange introuvable');
  const effectStart = source.lastIndexOf('useEffect(() => {', listenerIndex);
  const closingIndex = source.indexOf('}, [', listenerIndex);
  if (effectStart === -1 || closingIndex === -1) throw new Error('bornes de l effet introuvables');
  return source.slice(effectStart, source.indexOf(');', closingIndex) + 2);
}

describe('M8 — le retour au premier plan du catalogue est réellement câblé (pas seulement présent)', () => {
  const block = extractVisibilityEffectBlock(catalogHookSource);

  it('appelle la politique pure avec un événement "visible"', () => {
    expect(block).toContain('shouldReloadPublicShopCatalogOnVisible(');
    expect(block).toContain("{ type: 'visible', at: Date.now() }");
  });

  it('ne recharge le catalogue QUE si la politique l\'autorise (garde avant action)', () => {
    const guardIndex = block.indexOf('if (!shouldReload) return;');
    const actionIndex = block.indexOf('api.publicCatalog(slug)');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(actionIndex).toBeGreaterThan(guardIndex);
  });

  it("ignore l'événement si l'onglet n'est pas visible", () => {
    expect(block).toContain("document.visibilityState !== 'visible'");
  });
});

describe('M7b — le retour au premier plan de la session est réellement câblé (pas seulement présent)', () => {
  const block = extractVisibilityEffectBlock(sessionHookSource);

  it('appelle la politique pure avec un événement "visible"', () => {
    expect(block).toContain('shouldRevalidateStorefrontSession(');
    expect(block).toContain("{ type: 'visible', at: Date.now() }");
  });

  it('ne revalide QUE si la politique l\'autorise (garde avant action)', () => {
    const guardIndex = block.indexOf('if (!shouldRevalidate) return;');
    const actionIndex = block.indexOf('checkCurrent(false)');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(actionIndex).toBeGreaterThan(guardIndex);
  });

  // M12 — la revalidation au retour sur l'onglet ne bascule jamais `loading`
  // (pas de clignotement de l'écran de chargement) : elle appelle
  // `checkCurrent(false)`, jamais `checkCurrent(true)`, et `checkCurrent`
  // lui-même ne bascule `loading` que si `blocking` est vrai.
  it('M12 — revalide en silence : checkCurrent(false), jamais checkCurrent(true)', () => {
    expect(block).toContain('checkCurrent(false)');
    expect(block).not.toContain('checkCurrent(true)');
  });

  it('M12 — checkCurrent ne bascule loading que si blocking est vrai', () => {
    expect(sessionHookSource).toContain('if (blocking) setLoading(true);');
  });
});

/**
 * Dette qa-review round 1 (non bloquante) — élargit la garde à tous les
 * fichiers de la surface boutique, et à des formes détournées de minuteur
 * qu'une regex ciblée sur les deux hooks ne verrait pas si le mécanisme
 * réapparaissait ailleurs (ex. dans un composant, ou sous une forme
 * obfusquée). Ne couvre PAS un `setTimeout` auto-réarmé (récursif) : aucun
 * motif statique fiable ne le distingue d'un usage légitime (debounce,
 * temporisation ponctuelle) sans lecture humaine — laissé en dette, comme
 * autorisé par le mandat qa-review ("si c'est simple, sinon laisse-le en
 * dette").
 */
const STOREFRONT_SURFACE_ROOTS = [
  'src/modules/shops/ui',
  'src/modules/shop-customers/ui',
  'src/modules/orders/ui',
  'src/modules/catalog/ui/storefront',
  'src/modules/account/ui/customer-portal',
  'src/surfaces/customer-portal',
  'src/app/surfaces',
  'src/platform/runtime',
];

const FORBIDDEN_SCHEDULING_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'setInterval littéral', pattern: /\bsetInterval\s*\(/ },
  {
    label: "setInterval obfusqué via globalThis['set'+'Interval']",
    pattern: /globalThis\s*\[\s*(['"])set\1\s*\+\s*(['"])Interval\2\s*\]/,
  },
  { label: 'window.onfocus', pattern: /\bwindow\s*\.\s*onfocus\b/ },
  { label: "addEventListener('focus', ...)", pattern: /addEventListener\(\s*['"]focus['"]/ },
];

function listSourceFiles(root: string): string[] {
  const absoluteRoot = resolve(process.cwd(), root);
  let entries: string[];
  try {
    entries = readdirSync(absoluteRoot);
  } catch {
    return []; // dossier absent (ex. restructuration) : rien à scanner, pas un échec
  }
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(absoluteRoot, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listSourceFiles(join(root, entry)));
    } else if (stats.isFile() && ['.ts', '.tsx'].includes(extname(entry))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('BCP-6b — dette qa-review round 1 : garde élargie à la surface boutique entière', () => {
  const allFiles = STOREFRONT_SURFACE_ROOTS.flatMap(listSourceFiles);

  it('trouve bien des fichiers à scanner (anti-faux-négatif si la structure change)', () => {
    expect(allFiles.length).toBeGreaterThan(20);
  });

  it.each(FORBIDDEN_SCHEDULING_PATTERNS)('aucun fichier de la surface boutique ne contient : $label', ({ pattern }) => {
    const offenders = allFiles.filter((file) => pattern.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
