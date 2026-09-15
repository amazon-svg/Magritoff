/**
 * BCP-6 — arbitrage architecte du 2026-09-15 (qa-review round 1, CONVENTIONS
 * §8.25 5.2) : le lot couvre TOUTES les fenêtres de la boutique, par un
 * critère et non par une liste fermée.
 *
 * Critère : tout `SheetContent`, `DialogContent` ou `AlertDialogContent`
 * rendu sous `src/modules/*\/ui/storefront/` porte une description — soit un
 * `*Description` sœur (`SheetDescription`/`DialogDescription`/
 * `AlertDialogDescription`), soit un `aria-describedby` explicite sur le
 * fichier. Sans quoi Radix émet « Missing Description » à l'ouverture, et
 * un lecteur d'écran n'a rien à annoncer.
 *
 * Avant BCP-6 (round 1), ce test échoue sur deux fichiers :
 *   - `src/modules/shops/ui/storefront/ShopLayout.tsx` (tiroir panier) ;
 *   - `src/modules/catalog/ui/storefront/ProductOverlay.tsx` (configurateur).
 * Les cinq dialogues de commande (`CancelOrderConfirmDialog`,
 * `RejectOrderConfirmDialog`, `ValidateOrderConfirmDialog`,
 * `OrderAuditTrailModal`, `PortalOrderEditor`) en ont déjà une.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function listSourceFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((entry) => {
    const path = resolve(root, entry);
    return statSync(path).isDirectory()
      ? listSourceFiles(path)
      : /\.tsx$/.test(path)
        ? [path]
        : [];
  });
}

const CONTENT_COMPONENTS = ['SheetContent', 'DialogContent', 'AlertDialogContent'] as const;
const DESCRIPTION_COMPONENTS = [
  'SheetDescription',
  'DialogDescription',
  'AlertDialogDescription',
] as const;

const sourceRoot = resolve(process.cwd(), 'src');
const modulesRoot = resolve(sourceRoot, 'modules');

/** Tous les fichiers .tsx sous src/modules/<domaine>/ui/storefront/ (tous domaines). */
const storefrontFiles = readdirSync(modulesRoot)
  .flatMap((moduleName) => {
    const storefrontDir = resolve(modulesRoot, moduleName, 'ui', 'storefront');
    return listSourceFiles(storefrontDir);
  });

function usesContentComponent(source: string, name: string): boolean {
  return new RegExp(`<${name}[\\s>]`).test(source);
}

function hasDescription(source: string): boolean {
  const hasDescriptionComponent = DESCRIPTION_COMPONENTS.some((name) =>
    new RegExp(`<${name}[\\s>]`).test(source),
  );
  const hasAriaDescribedBy = /aria-describedby=/.test(source);
  return hasDescriptionComponent || hasAriaDescribedBy;
}

describe('description des fenêtres de la boutique (SheetContent/DialogContent/AlertDialogContent)', () => {
  // Garde-fou anti-faux-négatif : si l'inventaire change de forme, le test
  // ne doit pas se taire silencieusement sur zéro fichier trouvé.
  it('trouve au moins les 7 fichiers de l inventaire vérifié', () => {
    expect(storefrontFiles.length).toBeGreaterThanOrEqual(7);
  });

  it.each(storefrontFiles.map((file) => [relative(sourceRoot, file), file] as const))(
    '%s — toute fenêtre Content porte une description',
    (_label, file) => {
      const source = readFileSync(file, 'utf8');
      const usedContentComponents = CONTENT_COMPONENTS.filter((name) =>
        usesContentComponent(source, name),
      );
      if (usedContentComponents.length === 0) {
        // Fichier du dossier storefront sans fenêtre modale : rien à vérifier.
        return;
      }
      expect(hasDescription(source)).toBe(true);
    },
  );
});

// B5, B6 (qa-review round 1) — le tiroir panier n'a aucun texte visible à
// promouvoir : sa description reste masquée (`sr-only`), texte exact fixé
// par le contrat (CONVENTIONS §8.25 5.2).
describe('description du tiroir panier — ShopLayout.tsx (texte exact, sr-only)', () => {
  const layout = readFileSync(
    resolve(sourceRoot, 'modules/shops/ui/storefront/ShopLayout.tsx'),
    'utf8',
  );

  it('B5 — porte le texte exact impose par le contrat', () => {
    expect(layout).toContain('Articles de votre panier et total de la commande.');
  });

  it('B6 — via une SheetDescription visuellement masquee (sr-only)', () => {
    expect(layout).toMatch(
      /<SheetDescription className="sr-only">\s*Articles de votre panier et total de la commande\.\s*<\/SheetDescription>/,
    );
  });
});

// B7 (arbitrage architecte 2026-09-15) — ProductOverlay a deja un sous-titre
// visible qui dit la meme chose : il DEVIENT la SheetDescription, meme
// texte, meme style. Pas de sr-only ici (on ne double pas un texte deja
// visible), et le texte ne change pas (ce n'est pas l'objet du lot).
describe('description du configurateur produit — ProductOverlay.tsx (sous-titre promu, visible)', () => {
  const overlay = readFileSync(
    resolve(sourceRoot, 'modules/catalog/ui/storefront/ProductOverlay.tsx'),
    'utf8',
  );

  it('B7 — le sous-titre existant devient la SheetDescription, meme texte', () => {
    expect(overlay).toMatch(
      /<SheetDescription[^>]*>\s*Configurez puis ajoutez au panier\s*<\/SheetDescription>/,
    );
  });

  it('B7 — meme style que l ancien sous-titre visible (pas sr-only, classes et style conserves)', () => {
    expect(overlay).toMatch(
      /<SheetDescription\s+className="text-ink-muted m-0 mt-1"\s+style=\{\{ fontSize: "12px", fontWeight: 400 \}\}\s*>/,
    );
    // Le texte reste visible : pas de classe sr-only sur cette description
    // (contrairement au panier, qui n a pas de texte visible a reprendre).
    expect(overlay).not.toMatch(/<SheetDescription[^>]*sr-only/);
  });

  it('B7 — le vieux <p> du sous-titre a disparu (promu, pas duplique)', () => {
    expect(overlay).not.toMatch(/<p\s+className="text-ink-muted m-0 mt-1"/);
  });
});
