/**
 * BCP-10 (docs/api/CONVENTIONS.md §8.25 point 3.5) — alignement des deux
 * parcours de configuration produit.
 *
 * Défaut corrigé : `PortalProduct.tsx:446` passait `selectedOpts` en
 * troisième argument à `onAddToCart`, mais `addToCart(product, qty = 1)`
 * (`PublicShop.tsx:176`) n'avait que deux paramètres — la sélection de la
 * fiche produit était silencieusement jetée. Le correctif retire le
 * troisième argument (et tout ce qui le produisait) au lieu d'en ajouter un
 * quatrième : le compilateur garantit alors la non-régression (point (f)).
 *
 * Ces tests suivent le pattern déjà en usage dans ce dossier
 * (PublicShop.submitCart.test.ts) : assertions texte sur les fichiers
 * sources, pour une classe de défaut (câblage entre composants, signature de
 * callback) qu'un test de rendu isolé ne verrait pas plus sûrement.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');
const read = (relPath: string) => readFileSync(resolve(root, relPath), 'utf-8');

describe('BCP-10 — la fiche produit ne configure, ne chiffre et n ajoute plus rien elle-même', () => {
  it("PortalProduct n'a plus de bloc d'options mort (listes en dur, chiffrage propre)", () => {
    const src = read('src/modules/catalog/ui/storefront/PortalProduct.tsx');

    // Les trois listes écrites en dur (point (c)).
    expect(src).not.toMatch(/paperOptions/);
    expect(src).not.toMatch(/finishOptions/);
    expect(src).not.toMatch(/cornerOptions/);
    // La valeur inventée qui n'existe dans aucun vocabulaire Clariprint réel.
    expect(src).not.toMatch(/Soft touch/);
    // Le chiffrage et la mise à l'échelle propres à la fiche (point (g)).
    expect(src).not.toMatch(/calculatePrice/);
    expect(src).not.toMatch(/qty\s*\/\s*500/);
    expect(src).not.toMatch(/computeClariprintQuoteSafe/);
    // Le sélecteur de quantité éditable disparaît avec le configurateur.
    expect(src).not.toMatch(/setQty/);
  });

  it("le troisième argument d'onAddToCart a disparu — pas remplacé par un quatrième", () => {
    const src = read('src/modules/catalog/ui/storefront/PortalProduct.tsx');

    // Le défaut exact du rapport : une sélection en objet, jetée par le récepteur.
    expect(src).not.toMatch(/opts:\s*Record<string,\s*string>/);
    expect(src).not.toMatch(/selectedOpts/);
    // La fiche n'ajoute plus au panier : elle ouvre la surcouche.
    expect(src).not.toMatch(/onAddToCart/);
    expect(src).toMatch(/onConfigure:\s*\(product:\s*ShopProduct\)\s*=>\s*void/);
    expect(src).toMatch(/onConfigure\(product\)/);
  });

  it("addToCart garde EXACTEMENT sa signature à deux paramètres (point (f))", () => {
    const src = read('src/modules/shops/ui/storefront/PublicShop.tsx');

    // Signature exacte : aucun troisième paramètre, ni ajouté ni réintroduit.
    expect(src).toMatch(/const addToCart = \(product: ShopProduct, qty = 1\) => \{/);
    expect(src).not.toMatch(/addToCart = \(product: ShopProduct, qty = 1, [^)]+\)/);
  });

  it('PublicShop est l HÔTE UNIQUE de ProductOverlay (une seule instance, un seul onConfirm)', () => {
    const publicShop = read('src/modules/shops/ui/storefront/PublicShop.tsx');
    const catalog = read('src/modules/catalog/ui/storefront/PortalCatalog.tsx');

    expect(publicShop.match(/<ProductOverlay/g)?.length).toBe(1);
    expect(publicShop).toContain('const [overlayProduct, setOverlayProduct] = useState<ShopProduct | null>(null);');
    expect(publicShop).toContain('const onConfigure = (product: ShopProduct) => setOverlayProduct(product);');

    // La duplication qui a produit le défaut (point (b)) : la règle "qty =
    // exemplaires, on ajoute 1 paquet" ne doit plus vivre dans PortalCatalog.
    expect(catalog).not.toMatch(/<ProductOverlay/);
    expect(catalog).not.toMatch(/setOverlayProduct/);
  });

  it("les cartes des cinq autres surfaces ouvrent la surcouche, pas la fiche, pour le geste Configurer", () => {
    const home = read('src/modules/catalog/ui/storefront/PortalHome.tsx');
    const gamme = read('src/modules/catalog/ui/storefront/gamme/GammePage.tsx');
    const landing = read('src/modules/catalog/ui/storefront/PortalCategoryLanding.tsx');
    const catalog = read('src/modules/catalog/ui/storefront/PortalCatalog.tsx');

    // Défaut exact relevé par l'architecte : `onConfigure={onSelectProduct}`
    // envoyait le clic "Configurer" vers la fiche (bloc mort) au lieu de la
    // surcouche. Aucune des surfaces ne doit plus faire ce câblage.
    for (const src of [home, gamme]) {
      expect(src).not.toMatch(/onConfigure=\{onSelectProduct\}/);
    }
    expect(home).toMatch(/onConfigure=\{onConfigure\}/);
    expect(gamme).toMatch(/onConfigure=\{onConfigure\}/);

    // Landing : la tuile "Les plus demandés" n'a pas de bouton séparé, le
    // clic entier doit désormais ouvrir la surcouche (point (b)).
    expect(landing).not.toMatch(/onClick=\{\(\) => onSelectProduct\(p\)\}/);
    expect(landing).toMatch(/onClick=\{\(\) => onConfigure\(p\)\}/);

    // Suggestions de Magrit (résultats IA) : bouton "Configurer" dédié.
    expect(catalog).not.toMatch(/onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*onSelectProduct\(p\);/);
  });
});
