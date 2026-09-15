/**
 * BCP-6 — arbitrage architecte du 2026-09-15 (qa-review round 1, CONVENTIONS
 * §8.25 5.2) : le lot couvre TOUTES les fenêtres de la boutique, par un
 * critère et non une liste fermée.
 *
 * Critère : tout `SheetContent`, `DialogContent` ou `AlertDialogContent`
 * rendu sous `src/modules/*\/ui/storefront/` porte une description — soit un
 * `*Description` descendant non vide, soit un `aria-describedby` dont la
 * valeur n'est ni `undefined`, ni `{undefined}`, ni une chaîne vide.
 *
 * Round 2 de la qa-review (2026-09-15) a REJETÉ la version texte/regex du
 * round précédent : 4 contournements (G1-G4) la faisaient passer alors que
 * la description manquait réellement. Cette version résout les composants
 * via le compilateur TypeScript (`storefront-dialog-description-guard.ts`) :
 * imports nommés, alias, `import * as`, et ne cherche la description que
 * dans le sous-arbre JSX du `*Content` trouvé.
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
import { findStorefrontContentFindings } from './storefront-dialog-description-guard';

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

const sourceRoot = resolve(process.cwd(), 'src');
const modulesRoot = resolve(sourceRoot, 'modules');

/** Tous les fichiers .tsx sous src/modules/<domaine>/ui/storefront/ (tous domaines). */
const storefrontFiles = readdirSync(modulesRoot).flatMap((moduleName) =>
  listSourceFiles(resolve(modulesRoot, moduleName, 'ui', 'storefront')),
);

describe('description des fenêtres de la boutique (garde AST — SheetContent/DialogContent/AlertDialogContent)', () => {
  // Garde-fou anti-faux-négatif : si l'inventaire change de forme, le test
  // ne doit pas se taire silencieusement sur zéro fichier trouvé.
  it('trouve au moins les 7 fichiers de l inventaire vérifié', () => {
    expect(storefrontFiles.length).toBeGreaterThanOrEqual(7);
  });

  it.each(storefrontFiles.map((file) => [relative(sourceRoot, file), file] as const))(
    '%s — toute fenêtre Content (résolue par ses imports) porte une description',
    (_label, file) => {
      const source = readFileSync(file, 'utf8');
      const findings = findStorefrontContentFindings(file, source);
      const missing = findings.filter((finding) => !finding.hasDescription);
      expect(missing).toEqual([]);
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
//
// Fix BCP-6 lot 6 point 5.2 (recette navigateur 2026-09-15/16) : le wrapper
// partage SheetDescription applique `text-sm`, qui imposait sa propre
// hauteur de ligne (17.14px observe) au lieu de la hauteur heritee (18px)
// d'avant BCP-6. Le className litteral est devenu la constante
// `PRODUCT_OVERLAY_SUBTITLE_CLASSNAME` (ProductOverlay.helpers.ts), qui
// neutralise `text-sm` au point d'appel sans toucher au wrapper partage —
// voir tests/components/shop/ProductOverlay.sheetDescriptionStyle.test.ts
// pour la preuve par `cn()` reel.
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
    // Fix BCP-6 5.2 : className passe par la constante partagee (pas une
    // chaine litterale recopiee) pour neutraliser `text-sm` du wrapper —
    // cf. ProductOverlay.helpers.ts.
    expect(overlay).toMatch(
      /<SheetDescription\s+className=\{PRODUCT_OVERLAY_SUBTITLE_CLASSNAME\}\s+style=\{\{ fontSize: "12px", fontWeight: 400 \}\}\s*>/,
    );
    // Le texte reste visible : pas de classe sr-only sur cette description
    // (contrairement au panier, qui n a pas de texte visible a reprendre).
    expect(overlay).not.toMatch(/<SheetDescription[^>]*sr-only/);
  });

  it('B7 — le vieux <p> du sous-titre a disparu (promu, pas duplique)', () => {
    expect(overlay).not.toMatch(/<p\s+className="text-ink-muted m-0 mt-1"/);
  });

  it('BCP-6 5.2 — la constante de className vient de ProductOverlay.helpers.ts (pas de valeur inventee au point d appel)', () => {
    expect(overlay).toMatch(
      /import\s*\{[^}]*PRODUCT_OVERLAY_SUBTITLE_CLASSNAME[^}]*\}\s*from\s*["']@\/modules\/catalog\/ui\/storefront\/ProductOverlay\.helpers["']/,
    );
  });
});

// G1-G4 (qa-review round 2, 2026-09-15) — les 4 contournements qui faisaient
// passer la version texte/regex du round précédent. Chaque snippet est un
// fichier .tsx minimal, structurellement calqué sur
// CancelOrderConfirmDialog.tsx, avec UNE seule des quatre ruses appliquées
// et AUCUNE vraie description. La garde doit les refuser tous les quatre.
describe('contournements G1-G4 (mutations exécutées — doivent tomber)', () => {
  it('G1 — alias d import (AlertDialogContent as ConfirmPanel) n échappe pas à la résolution', () => {
    const snippet = `
      import {
        AlertDialog,
        AlertDialogContent as ConfirmPanel,
        AlertDialogHeader,
        AlertDialogTitle,
      } from '@/shared/ui/alert-dialog';

      export function Mutated() {
        return (
          <AlertDialog>
            <ConfirmPanel>
              <AlertDialogHeader>
                <AlertDialogTitle>Annuler cette commande ?</AlertDialogTitle>
              </AlertDialogHeader>
            </ConfirmPanel>
          </AlertDialog>
        );
      }
    `;
    const findings = findStorefrontContentFindings('G1.tsx', snippet);
    // La résolution par import doit quand même reconnaître ConfirmPanel
    // comme un AlertDialogContent — sinon G1 ne serait même pas détecté.
    expect(findings).toHaveLength(1);
    expect(findings[0]?.component).toBe('AlertDialogContent');
    expect(findings[0]?.hasDescription).toBe(false);
  });

  it('G2 — description vide (<AlertDialogDescription></AlertDialogDescription>) est refusée', () => {
    const snippet = `
      import {
        AlertDialog,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogHeader,
        AlertDialogTitle,
      } from '@/shared/ui/alert-dialog';

      export function Mutated() {
        return (
          <AlertDialog>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Annuler cette commande ?</AlertDialogTitle>
                <AlertDialogDescription></AlertDialogDescription>
              </AlertDialogHeader>
            </AlertDialogContent>
          </AlertDialog>
        );
      }
    `;
    const findings = findStorefrontContentFindings('G2.tsx', snippet);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.hasDescription).toBe(false);
  });

  it('G3 — aria-describedby={undefined} ne fait pas taire la garde (§8.25 5.2)', () => {
    const snippet = `
      import {
        AlertDialog,
        AlertDialogContent,
        AlertDialogHeader,
        AlertDialogTitle,
      } from '@/shared/ui/alert-dialog';

      export function Mutated() {
        return (
          <AlertDialog>
            <AlertDialogContent aria-describedby={undefined}>
              <AlertDialogHeader>
                <AlertDialogTitle>Annuler cette commande ?</AlertDialogTitle>
              </AlertDialogHeader>
            </AlertDialogContent>
          </AlertDialog>
        );
      }
    `;
    const findings = findStorefrontContentFindings('G3.tsx', snippet);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.hasDescription).toBe(false);
  });

  it('G4 — description placée ailleurs dans le fichier (hors du sous-arbre Content) ne compte pas', () => {
    const snippet = `
      import {
        AlertDialog,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogHeader,
        AlertDialogTitle,
      } from '@/shared/ui/alert-dialog';

      export function Mutated() {
        return (
          <div>
            <AlertDialogDescription>
              Description égarée, hors de la fenêtre.
            </AlertDialogDescription>
            <AlertDialog>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Annuler cette commande ?</AlertDialogTitle>
                </AlertDialogHeader>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      }
    `;
    const findings = findStorefrontContentFindings('G4.tsx', snippet);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.hasDescription).toBe(false);
  });

  // Contrôle positif : la garde ne doit pas être « toujours rouge ». Un
  // alias ET une vraie description (elle-même important sous son nom réel)
  // doivent passer.
  it('témoin positif — alias sur Content + vraie description non vide passe', () => {
    const snippet = `
      import {
        AlertDialog,
        AlertDialogContent as ConfirmPanel,
        AlertDialogDescription,
        AlertDialogHeader,
        AlertDialogTitle,
      } from '@/shared/ui/alert-dialog';

      export function Ok() {
        return (
          <AlertDialog>
            <ConfirmPanel>
              <AlertDialogHeader>
                <AlertDialogTitle>Annuler cette commande ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
              </AlertDialogHeader>
            </ConfirmPanel>
          </AlertDialog>
        );
      }
    `;
    const findings = findStorefrontContentFindings('OK.tsx', snippet);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.hasDescription).toBe(true);
  });

  // Contrôle positif : un aria-describedby réel (pas undefined) suffit.
  it('témoin positif — aria-describedby avec un vrai id passe', () => {
    const snippet = `
      import { Dialog, DialogContent } from '@/shared/ui/dialog';

      export function Ok() {
        return (
          <Dialog>
            <DialogContent aria-describedby="my-real-description-id">
              contenu
            </DialogContent>
          </Dialog>
        );
      }
    `;
    const findings = findStorefrontContentFindings('OK2.tsx', snippet);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.hasDescription).toBe(true);
  });
});
